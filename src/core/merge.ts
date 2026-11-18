/** Field-level provenance + conservative multi-provider merge. */
import { emptyEntity, type Entity, type Kind, type SourceRef } from "../schema/entities.ts";
import { entityId } from "./id.ts";
import { idsConflict, idsShared } from "./identity.ts";

type Any = Record<string, any>;

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
}

function dedupeArray(arr: unknown[]): unknown[] {
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const v of arr) {
    const key = typeof v === "object" && v && "id" in (v as Any) ? String((v as Any).id) : JSON.stringify(v);
    if (seen.has(key)) continue;
    seen.add(key); out.push(v);
  }
  return out;
}

export function recordSource(entity: Entity, path: string, source: SourceRef) {
  const root = path.split(".")[0];
  if (root === "raw" || root === "provenance" || root === "id" || root === "kind" || root === "domain") return;
  const map = (entity.provenance.field_sources ??= {});
  const arr = (map[path] ??= []);
  if (!arr.some((s) => s.provider === source.provider && s.url === source.url)) arr.push(source);
  if (!entity.provenance.sources.some((s) => s.provider === source.provider && s.url === source.url)) {
    entity.provenance.sources.push(source);
  }
}

/** Deep merge `incoming` into `base`, keeping the first non-empty scalar and unioning arrays. */
export function mergeEntity(base: Entity, incoming: Entity, source: SourceRef, opts: { priority?: number } = {}) {
  base.provenance.field_sources ??= {};
  walk(base, base as Any, incoming as Any, "", source, opts.priority ?? 50);
  return base;
}

function walk(root: Entity, target: Any, src: Any, path: string, source: SourceRef, priority: number) {
  for (const [key, value] of Object.entries(src)) {
    if (key === "provenance" || key === "raw" || key === "id" || key === "kind" || key === "domain") continue;
    const p = path ? `${path}.${key}` : key;
    if (isEmpty(value)) continue;
    const cur = target[key];

    if (key === "external_ids" && value && typeof value === "object") {
      target.external_ids ??= {};
      for (const [provider, ids] of Object.entries(value as Record<string, any>)) {
        const existing = (target.external_ids[provider] ??= []);
        for (const id of Array.isArray(ids) ? ids : [ids]) if (id != null && !existing.includes(String(id))) existing.push(String(id));
      }
      recordSource(root, p, source);
      continue;
    }

    if (Array.isArray(value)) {
      target[key] = Array.isArray(cur) ? dedupeArray([...cur, ...value]) : dedupeArray(value);
      recordSource(root, p, source);
      continue;
    }

    if (value && typeof value === "object") {
      if (cur && typeof cur === "object" && !Array.isArray(cur)) {
        walk(root, cur, value, p, source, priority);
      } else {
        target[key] = structuredClone(value);
        recordSource(root, p, source);
      }
      continue;
    }

    if (isEmpty(cur)) {
      target[key] = value;
      recordSource(root, p, source);
    }
  }
}

/**
 * Merge entities by canonical external ids first, then normalized title+kind.
 * Returns one representative and absorbs the rest.
 */
export function collapse(candidates: Entity[]): Entity[] {
  const out: Entity[] = [];
  for (const cand of candidates) {
    let merged = false;
    for (const existing of out) {
      if (existing.kind !== cand.kind) continue;
      // Two different MAL/AniList/IMDb ids are two different works, whatever the title says.
      if (idsConflict(existing, cand) || idsConflict(cand, existing)) continue;
      if (idsShared(existing, cand) || sameName(existing, cand)) {
        const src: SourceRef = { provider: cand.provenance.sources[0]?.provider ?? "merge", fetched_at: new Date().toISOString(), confidence: "probable" };
        mergeEntity(existing, cand, src);
        merged = true; break;
      }
    }
    if (!merged) out.push(cand);
  }
  return out;
}

function sameName(a: Entity, b: Entity): boolean {
  const names = [a.name, a.title.english, a.title.romaji, ...a.title.aliases].filter(Boolean).map((s) => normalize(s!));
  const others = [b.name, b.title.english, b.title.romaji, ...b.title.aliases].filter(Boolean).map((s) => normalize(s!));
  return names.some((n) => others.some((o) => n === o));
}
function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function makeEntity(kind: Kind, name: string, provider: string): Entity {
  const e = emptyEntity(kind, name);
  e.id = entityId(kind);
  e.score = 0;
  e.provenance.sources.push({ provider, fetched_at: new Date().toISOString(), confidence: "verified" });
  e.provenance.field_sources = {};
  return e;
}

/**
 * One row per episode. Providers number episodes differently (AniList and
 * ani.zip by the work's own numbering, Cinemeta and TVmaze per season), so
 * anime episodes key on (special?, number) and screen episodes on
 * (season, number). Earlier rows win per field, flags OR, sources union.
 */
export function consolidateEpisodes(entity: Entity) {
  if (entity.episodes.length < 2) return;
  const anime = entity.domain === "anime";
  const groups = new Map<string, any>();
  const order: string[] = [];
  for (const ep of entity.episodes as any[]) {
    if (ep.number == null) { const k = `id:${ep.id}`; groups.set(k, ep); order.push(k); continue; }
    const special = ep.kind === "special" || ep.season === 0;
    const key = anime ? `${special ? "S" : "E"}${ep.number}` : `${ep.season ?? 1}:${ep.number}`;
    const cur = groups.get(key);
    if (!cur) { groups.set(key, { ...ep }); order.push(key); continue; }
    for (const [k, v] of Object.entries(ep)) {
      if (k === "sources") { cur.sources = [...(cur.sources ?? []), ...((v as any[]) ?? [])]; continue; }
      if (k === "is_filler" || k === "is_recap") { cur[k] = Boolean(cur[k]) || Boolean(v); continue; }
      if ((k === "description" || k === "titles" || k === "external_ids") && v && typeof v === "object") { cur[k] = { ...(v as object), ...(cur[k] ?? {}) }; continue; }
      if (cur[k] === null || cur[k] === undefined || cur[k] === "") cur[k] = v;
    }
  }
  const rows = order.map((k) => groups.get(k));
  const isSpecial = (e: any) => e.kind === "special" || e.season === 0;
  // Stable ids keyed on the work's client id, whichever provider supplied the row first.
  const owner = anime
    ? (entity.external_ids.mal?.[0] ? `mal:${entity.external_ids.mal[0]}` : entity.external_ids.anilist?.[0] ? `anilist:${entity.external_ids.anilist[0]}` : null)
    : (entity.external_ids.imdb?.[0] ? `imdb:${entity.external_ids.imdb[0]}` : entity.external_ids.tvmaze?.[0] ? `tvmaze:${entity.external_ids.tvmaze[0]}` : null);
  if (owner) for (const ep of rows) {
    if (ep.number == null) continue;
    ep.id = anime ? `${owner}:ep:${isSpecial(ep) ? "S" : ""}${ep.number}` : `${owner}:s${ep.season ?? 1}e${ep.number}`;
  }
  rows.sort((a, b) => Number(isSpecial(a)) - Number(isSpecial(b)) || (anime ? 0 : (a.season ?? 1) - (b.season ?? 1)) || (a.number ?? 0) - (b.number ?? 0));
  entity.episodes = rows;
}

/** One row per season number; earlier rows win per field. */
export function consolidateSeasons(entity: Entity) {
  if (entity.seasons.length < 2) return;
  const by = new Map<number, any>();
  for (const s of entity.seasons as any[]) {
    const cur = by.get(s.number);
    if (!cur) { by.set(s.number, { ...s }); continue; }
    for (const [k, v] of Object.entries(s)) {
      if (k === "sources") cur.sources = [...(cur.sources ?? []), ...((v as any[]) ?? [])];
      else if (cur[k] === null || cur[k] === undefined || cur[k] === "" || (k === "description" && !Object.keys(cur[k] ?? {}).length)) cur[k] = v;
    }
  }
  entity.seasons = [...by.values()].sort((a, b) => a.number - b.number);
}

export function finalize(entity: Entity): Entity {
  entity.provenance.generated_at = new Date().toISOString();
  consolidateEpisodes(entity);
  consolidateSeasons(entity);
  entity.name = entity.title.display || entity.name;
  entity.title.aliases = dedupeArray(entity.title.aliases) as string[];
  entity.description.long = entity.description.long ?? entity.description.synopsis ?? {};
  return entity;
}

const SKIP = new Set(["id", "kind", "domain", "raw", "provenance", "score"]);
/** Record every populated leaf against its provider so attribution exists without a merge. */
export function indexEntity(e: Entity, provider: string, url?: string | null) {
  e.provenance.field_sources ??= {};
  const source: SourceRef = { provider, url: url ?? undefined, fetched_at: new Date().toISOString(), confidence: "verified" };
  const walk = (node: any, path: string, depth: number) => {
    if (depth > 3 || node == null) return;
    if (Array.isArray(node)) {
      if (node.length) recordSource(e, path, source);
      for (const v of node.slice(0, 30)) if (v && typeof v === "object") walk(v, path, depth + 1);
      return;
    }
    if (typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        if (!path && SKIP.has(k)) continue;
        walk(v, path ? `${path}.${k}` : k, depth + 1);
      }
      return;
    }
    if (node !== "") recordSource(e, path, source);
  };
  walk(e, "", 0);
}
