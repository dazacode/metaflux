import { config } from "./config.ts";
import { badRequest, notFound, unsupported } from "./errors.ts";
import { collapse, consolidateEpisodes, finalize, indexEntity, mergeEntity, recordSource } from "./merge.ts";
import { entityStore } from "./store.ts";
import { titleSimilarity } from "./id.ts";
import { effectiveKind, idScope, idsConflict, isIdentityKey, parseExternal, type ExternalRef } from "./identity.ts";
import { cache, singleflight } from "./store.ts";
import { sha256 } from "./id.ts";
import { chain, getProvider, ownedNamespaces, type Operation, type Provider, type ProviderContext } from "../providers/_types.ts";
import { kindFamily, kindsForDomain } from "../schema/kinds.ts";
import { bridgeScreenIds } from "../providers/wikidata.ts";
import { describeFallback } from "../providers/wikipedia.ts";
import { chapterFeed, findByLinks } from "../providers/mangadex.ts";
import type { Entity, Kind } from "../schema/entities.ts";

export interface QueryOptions {
  page?: number;
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
    page: opts.page && opts.page > 0 ? opts.page : 1,
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

const SEARCH_FRESH_MS = 5 * 60_000;
const SEARCH_STALE_MS = 6 * 3600_000;

/**
 * Merged search results are cached as a whole (fresh 5 min, then served stale
 * while one background refresh runs), so a repeated query costs one SQLite read
 * instead of a provider fan-out bounded by the slowest deadline.
 */
export async function searchEntities(q: string, kinds: Kind[], opts: QueryOptions = {}): Promise<Outcome> {
  const query = q.trim();
  if (!query) throw badRequest("q is required");
  if (opts.force) return searchFresh(query, kinds, opts);
  const key = `search:${sha256(JSON.stringify([query.toLowerCase(), [...kinds].sort(), opts.limit ?? null, opts.page ?? 1, opts.providers ?? null, opts.region ?? null]))}`;
  const hit = cache.get(key);
  const now = Date.now();
  const run = () => singleflight(key, async () => {
    const out = await searchFresh(query, kinds, opts);
    // A result that lost providers to deadlines is kept briefly so the next call retries them.
    if (out.entities.length) cache.set(key, { status: 200, body: JSON.stringify(out), ttlMs: out.partial ? 60_000 : SEARCH_FRESH_MS, staleMs: SEARCH_STALE_MS });
    return out;
  });
  if (hit && now < hit.staleUntil) {
    if (now >= hit.expiresAt) void run().catch(() => undefined);
    return JSON.parse(hit.body) as Outcome;
  }
  return run();
}

async function searchFresh(query: string, kinds: Kind[], opts: QueryOptions): Promise<Outcome> {
  const families = [...new Set(kinds.flatMap((k) => kindFamily(k)))];
  const c = { ...ctx(opts), kinds };
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
  // A requested kind is a contract: kind=anime returns anime rows, not Cinemeta films, whenever any exist.
  const scopes = new Set(kinds.map((k) => idScope(k)));
  const inScope = candidates.filter((e) => scopes.has(idScope(e.kind)));
  const pool = kinds.length && inScope.length ? inScope : inFamily.length ? inFamily : candidates;

  const merged = collapse(pool)
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

  await deadline(bridgeScreenIds(merged), 2_500).catch(() => undefined);
  for (const e of merged) entityStore.put(e as any, { index: false });
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

/** A stored record served without refetching while younger than this. */
const DETAIL_FRESH_MS = 15 * 60_000;

function isDetail(doc: Entity | null): doc is Entity {
  return !!doc && doc.provenance?.coverage?.detail === "full";
}

export async function getEntity(kindIn: Kind, id: string, opts: QueryOptions = {}): Promise<Entity> {
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
  const kind = effectiveKind(kindIn, external.kindHint);
  const flightKey = `get:${idScope(kind)}:${external.provider}:${external.id}:${(opts.providers ?? []).join(",")}`;

  const existingId = entityStore.findId(external.provider, external.id, kind);
  const existing = existingId ? entityStore.get(existingId) as Entity | null : null;
  if (isDetail(existing) && !opts.force) {
    const age = Date.now() - Date.parse(existing.provenance.generated_at);
    if (age > DETAIL_FRESH_MS) {
      // Stale-while-revalidate at the record level; the HTTP cache keeps it cheap.
      void singleflight(flightKey, () => fetchEntity(kind, external, opts)).catch(() => undefined);
    }
    return hydrate(existing, opts);
  }
  const e = await singleflight(flightKey, () => fetchEntity(kind, external, opts));
  return hydrate(e, opts);
}

async function fetchEntity(kind: Kind, external: ExternalRef, opts: QueryOptions): Promise<Entity> {
  const owned = ownedNamespaces();
  const candidates = chain("get", kind).filter((p) => allowed(p, opts));
  const scope = idScope(kind);
  const accepts = (p: Provider, ids: Record<string, string[]>) => {
    if (p.scopes && !p.scopes.includes(scope)) return null;
    if (!p.namespaces) {
      // Legacy adapters only see namespaces no declared adapter owns.
      return owned.has(external.provider) ? null : external.id;
    }
    const ns = p.namespaces.find((n) => ids[n]?.length);
    return ns ? ids[ns][0] : null;
  };
  if (!candidates.length) throw unsupported(`no provider can get ${kind}`);

  const c = ctx(opts);
  const unavailable: Outcome["unavailable"] = [];
  const extIds: Record<string, string[]> = { [external.provider]: [external.id] };
  const rows: { p: Provider; row: Entity }[] = [];
  const called = new Set<string>();

  const run = async (p: Provider, refId: string, ids: Record<string, string[]>) => {
    called.add(p.id);
    try {
      const ns = p.namespaces?.find((n) => ids[n]?.length) ?? external.provider;
      const row = await deadline(p.get!(c, { kind, id: refId, namespace: ns, externalIds: firstIds(ids) }), 6_000);
      if (row) rows.push({ p, row });
    } catch (err) {
      unavailable.push({ provider: p.id, error: err instanceof Error ? err.message : String(err) });
    }
  };
  const resolveAll = async () => {
    if (external.provider === "metaflux") return;
    const resolvers = chain("resolve").filter((p) => allowed(p, opts)).filter((p) => !p.scopes || p.scopes.includes(scope));
    await Promise.all(resolvers.map(async (r) => {
      try {
        const got = await deadline(r.resolve!(c, { [external.provider]: external.id }, kind), 4_000);
        if (got) for (const [prov, vals] of Object.entries(got.external_ids)) for (const v of vals) addTo(extIds, prov, v);
      } catch { /* resolver miss is not an outage */ }
    }));
  };

  // Wave 1: resolvers, plus every adapter that can serve the requested id directly.
  const wave1 = candidates.map((p) => [p, accepts(p, extIds)] as const).filter(([, refId]) => refId !== null);
  await Promise.all([resolveAll(), ...wave1.map(([p, refId]) => run(p, refId!, extIds))]);

  // Wave 2: adapters reachable only through ids learned in wave 1 (resolver or rows).
  for (const { row } of rows) for (const [prov, vals] of Object.entries(row.external_ids)) {
    if (!isIdentityKey(prov)) continue;
    for (const v of vals) addTo(extIds, prov, v);
  }
  // Resolver adapters (ARM, Wikidata) already contributed their ids; their raw records are not re-merged.
  const wave2 = candidates.filter((p) => !called.has(p.id) && p.namespaces && !p.operations.includes("resolve")).map((p) => [p, accepts(p, extIds)] as const).filter(([, refId]) => refId !== null);
  await Promise.all(wave2.map(([p, refId]) => run(p, refId!, extIds)));

  const ok = rows
    .filter(({ row }) => kindCompatible(kind, row.kind))
    .sort((a, b) => {
      const ar = a.p.operations.includes("resolve") ? 1 : 0;
      const br = b.p.operations.includes("resolve") ? 1 : 0;
      return ar - br || a.p.priority - b.p.priority;
    });
  const base: Entity[] = [];
  for (const { p, row } of ok) {
    if (base.length && (idsConflict(base[0], row) || idsConflict(row, base[0]))) {
      unavailable.push({ provider: p.id, error: "identity conflict; row discarded" });
      continue;
    }
    addIdSafe(row, external.provider, external.id);
    if (!base.length) row.provenance.field_sources = {};
    indexEntity(row, p.id, row.provenance.sources[0]?.url);
    const source = { provider: p.id, fetched_at: new Date().toISOString(), confidence: "verified" as const };
    if (!base.length) base.push(row);
    else mergeEntity(base[0], row, source, { priority: p.priority });
  }
  if (!base.length) throw notFound(`no provider matched ${kind}:${external.provider}:${external.id}`);
  const e = base[0];
  for (const [provider, ids] of Object.entries(extIds)) {
    // Coarse ids from resolvers only land on the record when no row contradicts them.
    if (e.external_ids[provider]?.length && !ids.some((v) => e.external_ids[provider].includes(v)) && provider !== external.provider) continue;
    for (const value of ids) addIdSafe(e, provider, value);
  }
  finalize(e);
  if (["anime", "manga", "movie", "tv"].includes(idScope(e.kind))) {
    await deadline(describeFallback(e), 4_000).catch(() => false);
  }
  e.provenance.unavailable = [...new Set(unavailable.map((u) => u.provider))];
  e.provenance.partial = unavailable.length > 0;
  e.provenance.coverage = { ...(e.provenance.coverage ?? {}), detail: "full" };
  entityStore.put(e as any);
  return e;
}

function addTo(ids: Record<string, string[]>, provider: string, value: unknown) {
  if (value == null || value === "") return;
  const arr = (ids[provider] ??= []);
  if (!arr.includes(String(value))) arr.push(String(value));
}

/** A row answers a request only from the same id scope: an anime row never answers /manga, a film never answers /tv_show. */
function kindCompatible(requested: Kind, got: Kind): boolean {
  return requested === got || idScope(requested) === idScope(got);
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

export { parseExternal } from "./identity.ts";

function guessExternal(id: string, provider?: string): ExternalRef | null {
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

export interface ListOutcome extends Outcome {
  total?: number | null;
  has_next?: boolean;
}

/**
 * Lists are answered failover-style for ranked operations (trending, discover):
 * the first provider by priority that returns rows wins, so its order and its
 * pagination are preserved. Schedules are unioned and sorted by air time.
 */
export async function listEntities(op: Operation, kind: Kind | undefined, params: any, opts: QueryOptions = {}): Promise<ListOutcome> {
  const c = ctx(opts);
  if (op === "schedule" && params?.limit) c.limit = Math.min(Number(params.limit), 1000);
  const providers = chain(op, kind).filter((p) => allowed(p, opts)).slice(0, config.maxMergeProviders);
  const unavailable: Outcome["unavailable"] = [];
  const hit: string[] = [];
  const family = new Set(kind ? kindFamily(kind) : []);
  // Ranked lists answer for exactly the requested kind's id space: a manga lane never shows anime.
  const strict = (op === "trending" || op === "discover") && kind;
  const call = async (p: Provider): Promise<Entity[] & { total?: number | null; hasNext?: boolean } | null> => {
    try {
      const fn = (p as any)[op] as Function;
      // trending(ctx, kind) takes the kind itself; the other list operations take a params object.
      const arg = op === "trending" ? (params?.kind ?? kind) : params;
      const result: any = await deadline(fn.call(p, c, arg), op === "schedule" ? 12_000 : 7_000);
      if (!result?.length) return null;
      const rows = result.map((e: Entity) => { e.score = e.score ?? 0; indexEntity(e, p.id, e.provenance.sources[0]?.url); return finalize(e); });
      if (strict) {
        const scoped = rows.filter((r: Entity) => idScope(r.kind) === idScope(kind!));
        if (!scoped.length) return null;
        hit.push(p.id);
        return Object.assign(scoped, { total: result.total, hasNext: result.hasNext });
      }
      hit.push(p.id);
      const inFamily = family.size ? rows.filter((r: Entity) => family.has(r.kind)) : rows;
      return Object.assign(inFamily.length ? inFamily : rows, { total: result.total, hasNext: result.hasNext });
    } catch (err) {
      unavailable.push({ provider: p.id, error: err instanceof Error ? err.message : String(err) });
      return null;
    }
  };

  if (op === "trending" || op === "discover") {
    for (const p of providers) {
      const rows = await call(p);
      if (!rows) continue;
      const out = rows.slice(0, c.limit);
      await deadline(bridgeScreenIds(out), 2_500).catch(() => undefined);
      for (const e of out) entityStore.put(e as any, { index: false });
      return { entities: out, unavailable, providers_hit: [...new Set(hit)], partial: unavailable.length > 0, total: rows.total ?? null, has_next: rows.hasNext };
    }
    return { entities: [], unavailable, providers_hit: [], partial: unavailable.length > 0, total: 0 };
  }

  const results = await Promise.all(providers.map(call));
  const rows = results.flatMap((r) => r ?? []);
  let merged: Entity[];
  if (op === "schedule") {
    const seen = new Set<string>();
    merged = rows.filter((e) => {
      const show = Object.entries(e.external_ids).find(([k]) => k === "mal" || k === "anilist" || k === "tvmaze" || k === "imdb");
      const key = `${show?.[0]}:${show?.[1]?.[0] ?? e.name}:${e.episodes[0]?.season ?? ""}:${e.episodes[0]?.number ?? ""}:${e.dates.airing?.date?.slice(0, 10) ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => (a.dates.airing?.date ?? a.dates.start?.date ?? "").localeCompare(b.dates.airing?.date ?? b.dates.start?.date ?? "")).slice(0, c.limit);
  } else {
    merged = collapse(rows).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, c.limit);
    for (const e of merged) entityStore.put(e as any, { index: false });
  }
  return { entities: merged, unavailable, providers_hit: [...new Set(hit)], partial: unavailable.length > 0 };
}

export function resolveKind(input?: string): Kind | undefined {
  return input as Kind | undefined;
}
void getProvider; void recordSource; void kindsForDomain;

/**
 * Chapters for a manga keyed by MAL/AniList: MangaDex is found by title and
 * accepted only when its own links name the work; then its feed is paged in
 * the requested language (`?lang=en`, default en). The MangaDex id is kept on
 * the stored record so the search happens once.
 */
async function chapterSection(entity: Entity, opts: QueryOptions & { lang?: string }) {
  const unavailable: Outcome["unavailable"] = [];
  if (entity.chapters.length) return { rows: entity.chapters as unknown[], providers: [], unavailable };
  if (!allowed({ id: "mangadex" }, opts)) return { rows: [], providers: [], unavailable };
  try {
    let id: string | null = entity.external_ids.mangadex?.[0] ?? null;
    if (!id) {
      id = await deadline(findByLinks([entity.title.english, entity.title.romaji, entity.name, ...entity.title.aliases].filter(Boolean) as string[], { mal: entity.external_ids.mal?.[0], anilist: entity.external_ids.anilist?.[0] }), 6_000);
      if (id) {
        const stored = entityStore.get(entity.id);
        if (stored) { (stored.external_ids.mangadex ??= []).push(id); entityStore.put(stored); }
      }
    }
    if (!id) return { rows: [], providers: [], unavailable: [{ provider: "mangadex", error: "no MangaDex title links to this work" }] };
    const rows = await deadline(chapterFeed(id, opts.lang ?? "en"), 10_000);
    return { rows, providers: ["mangadex"], unavailable };
  } catch (err) {
    unavailable.push({ provider: "mangadex", error: err instanceof Error ? err.message : String(err) });
    return { rows: [], providers: [], unavailable };
  }
}

/**
 * The detail record already merges AniList, ani.zip, Cinemeta and TVmaze episodes.
 * The section adds per-episode sources that cost extra calls (Jikan filler/recap
 * flags, paged), merged by episode number under a short deadline.
 */
async function episodeSection(entity: Entity, opts: QueryOptions) {
  const c = ctx(opts);
  const unavailable: Outcome["unavailable"] = [];
  const providers: string[] = [...new Set((entity.provenance.field_sources?.episodes ?? []).map((s) => s.provider))];
  const mal = entity.external_ids.mal?.[0];
  const copy = structuredClone(entity);
  if (entity.domain === "anime" && mal) {
    const jikan = getProvider("jikan");
    if (jikan?.episodes && allowed(jikan, opts)) {
      try {
        // Soft deadline: a slow Jikan keeps filling the HTTP cache in the background for the next call.
        const rows = await deadline(jikan.episodes(c, mal), 1_500);
        if (rows.length) {
          providers.push("jikan");
          for (const r of rows) for (const ep of r.episodes) {
            // Jikan only contributes flags and titles; it never adds an episode the others do not know about.
            const cur = copy.episodes.find((x) => x.number === ep.number && x.kind !== "special" && x.season !== 0);
            if (cur) { cur.is_filler = Boolean(cur.is_filler) || Boolean(ep.is_filler); cur.is_recap = Boolean(cur.is_recap) || Boolean(ep.is_recap); cur.title ??= ep.title; cur.titles = { ...(ep.titles ?? {}), ...(cur.titles ?? {}) }; cur.sources = [...(cur.sources ?? []), ...(ep.sources ?? [])]; }
            else if (!copy.episodes.length || (ep.air_date && Date.parse(ep.air_date) <= Date.now())) copy.episodes.push(ep);
          }
          consolidateEpisodes(copy);
        }
      } catch (err) {
        unavailable.push({ provider: "jikan", error: err instanceof Error ? err.message : String(err) });
      }
    }
  }
  return { rows: copy.episodes as unknown[], providers, unavailable };
}

export async function getSection(kind: Kind, id: string, section: string, opts: QueryOptions = {}): Promise<{ rows: unknown[]; providers: string[]; unavailable: Outcome["unavailable"] }> {
  const entity = await getEntity(kind, id, opts);
  if (section === "episodes") return episodeSection(entity, opts);
  if (section === "chapters" && idScope(entity.kind) === "manga") return chapterSection(entity, opts);
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
