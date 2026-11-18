/** Field-level provenance + conservative multi-provider merge. */
import { emptyEntity, type Entity, type Kind, type SourceRef } from "../schema/entities.ts";
import { entityId } from "./id.ts";

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
      if (sharesId(existing, cand) || sameName(existing, cand)) {
        const src: SourceRef = { provider: cand.provenance.sources[0]?.provider ?? "merge", fetched_at: new Date().toISOString(), confidence: "probable" };
        mergeEntity(existing, cand, src);
        merged = true; break;
      }
    }
    if (!merged) out.push(cand);
  }
  return out;
}

function sharesId(a: Entity, b: Entity): boolean {
  for (const [p, ids] of Object.entries(a.external_ids)) {
    if ((b.external_ids[p] ?? []).some((id) => ids.includes(id))) return true;
  }
  return false;
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

export function finalize(entity: Entity): Entity {
  entity.provenance.generated_at = new Date().toISOString();
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
