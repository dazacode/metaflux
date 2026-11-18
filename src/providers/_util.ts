import type { Entity, SourceRef } from "../schema/entities.ts";
import { makeEntity } from "../core/merge.ts";

export const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export function src(provider: string, url?: string, confidence: SourceRef["confidence"] = "verified"): SourceRef {
  return { provider, url, fetched_at: new Date().toISOString(), confidence };
}

export function text(provider: string, url: string, lang = "en"): SourceRef {
  return src(provider, url);
}

export function stripHtml(input: unknown): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function list(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  if (typeof v === "string" && v) return [v];
  return [];
}

export function dateParts(v: unknown) {
  const s = str(v);
  if (!s) return null;
  const m = s.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/);
  if (!m) return null;
  return { year: Number(m[1]), month: m[2] ? Number(m[2]) : null, day: m[3] ? Number(m[3]) : null, date: s };
}

export function jsonLd(html: string): any[] {
  const out: any[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1]);
      if (Array.isArray(parsed)) out.push(...parsed);
      else out.push(parsed);
    } catch { /* skip malformed */ }
  }
  return out;
}

export function metaTags(html: string) {
  const map: Record<string, string[]> = {};
  const re = /<meta\s+[^>]*?(?:property|name)=["']([^"']+)["'][^>]*?content=["']([^"']*)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) (map[m[1]] ??= []).push(m[2]);
  return map;
}

export function decodeEntities(s: string): string {
  return s.replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ");
}

export function baseEntity(kind: Entity["kind"], name: string, provider: string, url?: string): Entity {
  const e = makeEntity(kind, name, provider);
  if (url) e.provenance.sources.push(src(provider, url));
  return e;
}

/**
 * Record an internal `namespace:value` marker (`type:series`, `source:MANGA`).
 * Markers live in classification.keywords so classification.tags stays
 * human-readable (G20).
 */
export function tag(e: Entity, label: string) {
  if (!e.classification.keywords.includes(label)) e.classification.keywords.push(label);
}

export function addId(e: Entity, provider: string, id: string | null | undefined) {
  if (!id) return;
  const arr = (e.external_ids[provider] ??= []);
  if (!arr.includes(String(id))) arr.push(String(id));
}

export function languageName(code: string | null | undefined): string | null {
  if (!code) return null;
  try { return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code; } catch { return code; }
}
