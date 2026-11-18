import { config } from "./config.ts";
import { badRequest, notFound, unsupported } from "./errors.ts";
import { collapse, finalize, indexEntity, mergeEntity, recordSource } from "./merge.ts";
import { entityStore } from "./store.ts";
import { titleSimilarity } from "./id.ts";
import { chain, getProvider, type Operation, type Provider, type ProviderContext } from "../providers/_types.ts";
import { kindFamily, kindsForDomain } from "../schema/kinds.ts";
import type { Entity, Kind } from "../schema/entities.ts";

export interface QueryOptions {
  region?: string;
  lang?: string;
  limit?: number;
  providers?: string[];
  include?: string[];
  debug?: boolean;
  force?: boolean;
  kind?: Kind;
  provider?: string;
}

function deadline<T>(p: Promise<T>, ms = 7_000): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("provider deadline exceeded")), ms).unref?.()),
  ]);
}

function ctx(opts: QueryOptions): ProviderContext {
  return {
    region: opts.region ?? "us",
    lang: opts.lang ?? "en",
    now: new Date(),
    limit: Math.min(opts.limit ?? config.searchLimit, config.maxSearchLimit),
  };
}

function allowed(p: { id: string }, opts: QueryOptions) {
  return !opts.providers?.length || opts.providers.includes(p.id);
}

export interface Outcome {
  entities: Entity[];
  unavailable: { provider: string; error: string }[];
  providers_hit: string[];
  partial: boolean;
}

export async function searchEntities(q: string, kinds: Kind[], opts: QueryOptions = {}): Promise<Outcome> {
  const query = q.trim();
  if (!query) throw badRequest("q is required");
  const families = [...new Set(kinds.flatMap((k) => kindFamily(k)))];
  const c = ctx(opts);
  const candidates: Entity[] = [];
  const unavailable: Outcome["unavailable"] = [];
  const hit: string[] = [];
  const used: string[] = [];

  const selected = new Map<string, Provider>();
  const perFamily = Math.min(3, config.maxMergeProviders);
  for (const kind of families) {
    for (const p of chain("search", kind).filter((x) => allowed(x, opts)).slice(0, perFamily)) {
      if (!selected.has(p.id)) selected.set(p.id, p);
    }
  }
  const providers = [...selected.values()].sort((a, b) => a.priority - b.priority).slice(0, config.maxMergeProviders);
  const results = await Promise.all(providers.map(async (p): Promise<{ provider: string; rows?: Entity[]; error?: string }> => {
    try {
      return { provider: p.id, rows: await deadline(p.search!(c, query), 3_500) };
    } catch (err) {
      return { provider: p.id, error: err instanceof Error ? err.message : String(err) };
    }
  }));
  for (const item of results) {
    if (item.error || !item.rows) { unavailable.push({ provider: item.provider, error: item.error ?? "empty" }); continue; }
    if (!item.rows.length) continue;
    hit.push(item.provider);
    for (const row of item.rows) {
      row.provenance.partial = false;
      row.score = rank(row, query, kinds);
      indexEntity(row, item.provider, row.provenance.sources[0]?.url);
      candidates.push(row);
    }
  }
  const familySet = new Set(families);
  const inFamily = candidates.filter((e) => familySet.has(e.kind));

  const merged = collapse(inFamily.length ? inFamily : candidates)
    .map((e) => {
      e.score = Math.max(e.score ?? 0, rank(e, query, kinds));
      e.provenance.sources = e.provenance.sources.filter((s, i, a) => a.findIndex((x) => x.provider === s.provider) === i);
      e.provenance.partial = unavailable.length > 0;
      e.provenance.unavailable = [...new Set(unavailable.map((u) => u.provider))];
      return finalize(e);
    })
    .sort((a, b) => {
      const exact = Number(!kinds.includes(a.kind)) - Number(!kinds.includes(b.kind));
      return exact || b.score - a.score;
    })
    .slice(0, c.limit);

  for (const e of merged) entityStore.put(e as any);
  return { entities: merged, unavailable, providers_hit: [...new Set(hit)], partial: unavailable.length > 0 };
}

function rank(e: Entity, query: string, kinds: Kind[]): number {
  let score = 0;
  const names = [e.name, e.title.english, e.title.romaji, e.title.native, ...e.title.aliases].filter(Boolean) as string[];
  const best = Math.max(0, ...names.map((n) => titleSimilarity(n, query)));
  score += best * 100;
  if (!kinds.length || kinds.includes(e.kind)) score += 60;
  else score -= 10;
  if (names.some((n) => n.toLowerCase() === query.toLowerCase())) score += 40;
  score += Math.min(20, Object.values(e.external_ids).flat().length * 2);
  score += Math.min(15, (e.metrics.popularity ?? 0) / 5000);
  score += Math.min(10, (e.metrics.score ?? 0) / 10);
  if (e.images.poster.length) score += 3;
  if (e.description.long?.en) score += 2;
  return score;
}

export async function getEntity(kind: Kind, id: string, opts: QueryOptions = {}): Promise<Entity> {
  if (!id) throw badRequest("id is required");

  const localId = id.startsWith("mf_") ? id : null;
  if (localId) {
    const doc = entityStore.get(localId);
    if (doc) {
      if (!opts.force) return refresh(doc, opts);
      return hydrate(doc, opts);
    }
    throw notFound();
  }

  const external = parseExternal(id) ?? guessExternal(id, opts.provider);
  if (!external) throw badRequest("id must be mf_*, provider:id, tt/nm/Q id, ISBN, or a bare id with ?provider=");

  const existingId = entityStore.findId(external.provider, external.id);
  if (existingId) {
    const doc = entityStore.get(existingId);
    if (doc && !opts.force) return doc;
  }

  const providers = chain("get", kind)
    .filter((p) => allowed(p, opts))
    .sort((a, b) => (Number(b.operations.includes("resolve")) - Number(a.operations.includes("resolve"))) + (a.priority - b.priority) / 1000);
  if (!providers.length) throw unsupported(`no provider can get ${kind}`);

  const c = ctx(opts);
  const base: Entity[] = [];
  const unavailable: Outcome["unavailable"] = [];
  const resolvers = chain("resolve").filter((p) => allowed(p, opts));
  let resolved: Entity | null = null;
  if (external.provider !== "metaflux") {
    for (const r of resolvers) {
      try {
        const got = await r.resolve!(c, { [external.provider]: external.id });
        if (got) { resolved = got; addIdSafe(got, external.provider, external.id); break; }
      } catch { /* keep going */ }
    }
  }

  const extIds = resolved ? { ...resolved.external_ids, [external.provider]: [external.id] } : { [external.provider]: [external.id] };

  const settled = await Promise.all(providers.map(async (p) => {
    try {
      const row = await deadline(p.get!(c, { kind, id: external.id, externalIds: firstIds(extIds) }), 8_000);
      return { p, row };
    } catch (err) {
      unavailable.push({ provider: p.id, error: err instanceof Error ? err.message : String(err) });
      return { p, row: null };
    }
  }));
  const ok = settled.filter((x) => x.row).sort((a, b) => {
    const ar = a.p.operations.includes("resolve") ? 1 : 0;
    const br = b.p.operations.includes("resolve") ? 1 : 0;
    return ar - br || a.p.priority - b.p.priority;
  });
  for (const { p, row } of ok) {
    addIdSafe(row!, external.provider, external.id);
    indexEntity(row!, p.id, row!.provenance.sources[0]?.url);
    const source = { provider: p.id, fetched_at: new Date().toISOString(), confidence: "verified" as const };
    if (!base.length) { row!.provenance.field_sources = {}; base.push(row!); }
    else mergeEntity(base[0], row!, source, { priority: p.priority });
  }
  if (!base.length) throw notFound(`no provider matched ${kind}:${id}`);
  for (const [provider, ids] of Object.entries(extIds)) {
    for (const value of ids) addIdSafe(base[0], provider, value);
  }
  const e = finalize(base[0]);
  e.provenance.unavailable = [...new Set(unavailable.map((u) => u.provider))];
  e.provenance.partial = unavailable.length > 0;
  entityStore.put(e as any);
  return hydrate(e, opts);
}

async function refresh(doc: Entity, opts: QueryOptions): Promise<Entity> {
  const age = Date.now() - Date.parse(doc.provenance.generated_at);
  if (age < 5 * 60_000 && !opts.force) return hydrate(doc, opts);
  const ids = Object.entries(doc.external_ids).map(([p, v]) => (v[0] ? `${p}:${v[0]}` : null)).filter(Boolean) as string[];
  for (const candidate of ids.slice(0, 4)) {
    try {
      const fresh = await getEntity(doc.kind, candidate, { ...opts, force: true });
      return fresh;
    } catch { /* next id */ }
  }
  return hydrate(doc, opts);
}

async function hydrate(doc: Entity, opts: QueryOptions): Promise<Entity> {
  if (opts.include?.length) {
    const c = ctx(opts);
    for (const p of chain("related", doc.kind).filter((x) => allowed(x, opts))) {
      try {
        const related = await p.related!(c, doc.id);
        for (const r of related) {
          if (!r) continue;
          if (!doc.relations.some((x) => x.target_id === `${Object.keys(r.external_ids)[0]}:${Object.values(r.external_ids)[0]?.[0]}`)) {
            doc.relations.push({ kind: "recommendation", target: finalize(r), direction: "outgoing", sources: r.provenance.sources });
          }
        }
      } catch { /* ignore */ }
    }
  }
  const copy = structuredClone(doc);
  if (!opts.debug) {
    for (const k of Object.keys(copy.raw)) {
      const raw = copy.raw[k];
      if (raw && typeof raw === "object" && JSON.stringify(raw).length > 20_000) copy.raw[k] = { truncated: true, bytes: JSON.stringify(raw).length };
    }
  }
  return copy;
}

export function parseExternal(id: string): { provider: string; id: string } | null {
  const m = id.match(/^([a-z0-9_.-]+):(.+)$/i);
  if (m) return { provider: m[1].toLowerCase(), id: m[2] };
  return null;
}

function guessExternal(id: string, provider?: string): { provider: string; id: string } | null {
  if (/^tt\d{6,9}$/.test(id)) return { provider: "imdb", id };
  if (/^nm\d{6,9}$/.test(id)) return { provider: "imdb_name", id };
  if (/^Q\d+$/.test(id)) return { provider: "wikidata", id };
  if (/^97[89]\d{10}$/.test(id)) return { provider: "isbn13", id };
  if (/^\d{9}[\dX]$/i.test(id)) return { provider: "isbn10", id };
  if (provider) return { provider: provider.toLowerCase(), id };
  return null;
}

function firstIds(ids: Record<string, string[]>): Record<string, string> {
  return Object.fromEntries(Object.entries(ids).map(([k, v]) => [k, v[0]]).filter(([, v]) => v) as [string, string][]);
}

function addIdSafe(e: Entity, provider: string, id: string) {
  const arr = (e.external_ids[provider] ??= []);
  if (!arr.includes(id)) arr.push(id);
}

export async function resolveIds(ids: Record<string, string>, opts: QueryOptions = {}): Promise<Entity> {
  const c = ctx(opts);
  for (const p of chain("resolve")) {
    try {
      const got = await p.resolve!(c, ids);
      if (got) {
        const primary = Object.entries(got.external_ids).find(([p]) => p !== "arm")?.[1]?.[0];
        if (primary && got.kind) {
          try {
            const provider = Object.keys(got.external_ids).find((p) => p !== "arm")!;
            const doc = await getEntity(got.kind, `${provider}:${primary}`, { ...opts, force: true });
            for (const [p, values] of Object.entries(got.external_ids)) for (const value of values) if (value != null) addIdSafe(doc, p, String(value));
            entityStore.put(doc as any);
            return doc;
          } catch { /* fall back to resolver payload */ }
        }
        const e = finalize(got);
        entityStore.put(e as any);
        return e;
      }
    } catch { /* next */ }
  }
  throw notFound("no resolver matched");
}

export async function listEntities(op: Operation, kind: Kind | undefined, params: any, opts: QueryOptions = {}): Promise<Outcome> {
  const c = ctx(opts);
  const providers = chain(op, kind).filter((p) => allowed(p, opts)).slice(0, config.maxMergeProviders);
  const rows: Entity[] = [];
  const unavailable: Outcome["unavailable"] = [];
  const hit: string[] = [];
  await Promise.all(providers.map(async (p) => {
    try {
      const fn = (p as any)[op] as Function;
      const result: any = await deadline(fn.call(p, c, params));
      if (result?.length) { hit.push(p.id); rows.push(...result.map((e: Entity) => { e.score = e.score ?? 0; return finalize(e); })); }
    } catch (err) {
      unavailable.push({ provider: p.id, error: err instanceof Error ? err.message : String(err) });
    }
  }));
  const family = new Set(kind ? kindFamily(kind) : []);
  const filtered = family.size ? rows.filter((r) => family.has(r.kind)) : rows;
  const merged = collapse(filtered.length ? filtered : rows).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, c.limit);
  for (const e of merged) entityStore.put(e as any);
  return { entities: merged, unavailable, providers_hit: [...new Set(hit)], partial: unavailable.length > 0 };
}

export function resolveKind(input?: string): Kind | undefined {
  return input as Kind | undefined;
}
void getProvider; void recordSource; void kindsForDomain;

export async function getSection(kind: Kind, id: string, section: string, opts: QueryOptions = {}): Promise<{ rows: unknown[]; providers: string[]; unavailable: Outcome["unavailable"] }> {
  const entity = await getEntity(kind, id, opts);
  if (["credits", "episodes", "chapters", "seasons", "tracks"].includes(section)) {
    return { rows: ((entity as any)[section] ?? []) as unknown[], providers: [], unavailable: [] };
  }
  if (section === "availability") return { rows: [entity.availability], providers: [], unavailable: [] };
  if (section === "files") return { rows: [entity.availability.downloads], providers: [], unavailable: [] };
  const op: Operation = section === "people" ? "people" : section === "streams" ? "streams" : section === "lyrics" ? "lyrics" : "related";
  const c = ctx(opts);
  const rows: Entity[] = [];
  const unavailable: Outcome["unavailable"] = [];
  const hit: string[] = [];
  await Promise.allSettled(chain(op, kind).filter((p) => allowed(p, opts)).map(async (p) => {
    try {
      const fn = (p as any)[op] as Function;
      const result: any = await deadline(fn.call(p, c, section === "lyrics" ? entity.name : id));
      const items: any[] = Array.isArray(result) ? result : result ? [result] : [];
      if (items.length) { hit.push(p.id); rows.push(...items.map((x: Entity) => finalize(x))); }
    } catch (err) {
      unavailable.push({ provider: p.id, error: err instanceof Error ? err.message : String(err) });
    }
  }));
  return { rows: collapse(rows), providers: [...new Set(hit)], unavailable };
}
