import { fetchJson } from "../core/http.ts";
import type { Entity } from "../schema/entities.ts";

import { baseEntity, src, stripHtml } from "./_util.ts";
import type { Provider } from "./_types.ts";

const BASE = "https://en.wikipedia.org/w/api.php";
/** Search result -> heuristic kind. */
function guessKind(desc = "", title = ""): Entity["kind"] {
  const t = `${desc} ${title}`.toLowerCase();
  if (/anime|manga/.test(t)) return "anime";
  if (/film|movie/.test(t)) return "movie";
  if (/television series|tv series|sitcom/.test(t)) return "tv_show";
  if (/album/.test(t)) return "music_album";
  if (/song|single/.test(t)) return "music_track";
  if (/novel|book/.test(t)) return "book";
  if (/comic/.test(t)) return "comic";
  if (/footballer|basketball player|baseball player|athlete|racing driver/.test(t)) return "sports_player";
  if (/singer|rapper|musician|band|idol/.test(t)) return "music_artist";
  if (/vtube|virtual youtuber/.test(t)) return "vtuber";
  return "person";
}

/** Wikidata classes a work page must be an instance of (film, series, anime, manga, ...). */
const WATCHABLE = new Set(["Q11424", "Q24856", "Q93204", "Q202866", "Q506240", "Q5398426", "Q1366112", "Q117467246", "Q581714", "Q1259759", "Q3464665", "Q15416", "Q622812", "Q1261214", "Q21198342", "Q8274", "Q1667921", "Q63952888", "Q220898", "Q100269041"]);
const COUNTRY_LANG: Record<string, string> = { KR: "ko", JP: "ja", CN: "zh", TW: "zh", HK: "zh", TH: "th", PH: "tl", ID: "id", VN: "vi" };
const LICENSE = "CC BY-SA 4.0";

async function itemFits(qid: string, year: number | null): Promise<boolean> {
  const sparql = `SELECT ?inst ?start WHERE { OPTIONAL { wd:${qid} wdt:P31 ?inst } OPTIONAL { wd:${qid} wdt:P577|wdt:P580 ?start } }`;
  const res = await fetchJson<any>(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`, { provider: "wikidata", ttlMs: 30 * 86_400_000, timeoutMs: 3_000, headers: { accept: "application/sparql-results+json" } });
  const rows = res.data?.results?.bindings ?? [];
  const insts = rows.map((b: any) => b.inst?.value?.split("/").pop()).filter(Boolean);
  const years = rows.map((b: any) => Number(String(b.start?.value ?? "").slice(0, 4))).filter((y: number) => y > 0);
  if (!insts.some((i: string) => WATCHABLE.has(i))) return false;
  return !year || !years.length || years.some((y: number) => Math.abs(y - year) <= 1);
}

/**
 * Synopsis of last resort for a work whose own sources have none (G5).
 * Candidates are the work's titles on en.wikipedia and on the wiki of its
 * origin language. A page is accepted when its Wikidata item is the work's
 * own item, or is a film/series/anime/manga item whose start year is within
 * one of the work's. The text is CC BY-SA: provenance carries the article URL
 * and licence so the credit can be shown.
 */
export async function describeFallback(e: Entity): Promise<boolean> {
  const hasText = Object.values(e.description.long ?? {}).some((v) => typeof v === "string" && v.trim().length > 0);
  if (hasText) return false;
  const titles = [...new Set([e.title.english, e.name, e.title.native, e.title.romaji].filter((t): t is string => !!t && t.trim().length > 0))].slice(0, 3);
  const langs = [...new Set(["en", COUNTRY_LANG[e.broadcast.country ?? ""]].filter(Boolean) as string[])];
  const year = e.dates.start?.year ?? e.dates.release?.year ?? e.dates.premiere?.year ?? e.season?.year ?? null;
  const own = new Set(e.external_ids.wikidata ?? []);
  for (const lang of langs) {
    for (const title of titles) {
      if (lang === "en" && /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(title)) continue;
      const res = await fetchJson<any>(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`, { provider: "wikipedia", ttlMs: 86_400_000, timeoutMs: 3_000, allowStatus: [404] }).catch(() => null);
      const d = res?.data;
      if (!d || d.type !== "standard" || (d.extract ?? "").length < 80 || !d.wikibase_item) continue;
      if (!own.has(d.wikibase_item) && !(await itemFits(d.wikibase_item, year).catch(() => false))) continue;
      const url = d.content_urls?.desktop?.page ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`;
      e.description.long = { ...(e.description.long ?? {}), [lang]: d.extract };
      e.description.synopsis = { ...(e.description.synopsis ?? {}), [lang]: d.extract };
      const source = { provider: "wikipedia", url, fetched_at: new Date().toISOString(), confidence: "probable" as const, license: LICENSE, note: `${lang}.wikipedia.org article ${d.title}` };
      for (const path of ["description.long", `description.long.${lang}`, "description.synopsis"]) e.provenance.field_sources[path] = [source];
      if (!e.provenance.sources.some((s) => s.provider === "wikipedia")) e.provenance.sources.push(source);
      e.urls.wikipedia = url;
      if (!own.has(d.wikibase_item)) e.external_ids.wikidata = [...(e.external_ids.wikidata ?? []), d.wikibase_item];
      return true;
    }
  }
  return false;
}

export const wikipedia: Provider = {
  id: "wikipedia", name: "Wikipedia", domains: ["meta", "people"], priority: 55,
  kinds: ["movie", "tv_show", "anime", "manga", "book", "comic", "music_artist", "music_album", "music_track", "sports_player", "person", "vtuber", "idol", "award", "company"],
  operations: ["search", "get"],
  namespaces: ["wikipedia"],
  auth: "none", base: BASE, license: "CC BY-SA 4.0",
  freshness: "24h", homepage: "https://en.wikipedia.org",
  notes: "Descriptive fallback and biography source. MediaWiki Action API + REST summary.",
  async search(ctx, q) {
    const res = await fetchJson<any>(`${BASE}?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=${Math.min(ctx.limit, 20)}&format=json&origin=*`, { provider: "wikipedia", ttlMs: 86_400_000 });
    return (res.data.query?.search ?? []).map((r: any) => {
      const kind = guessKind(r.snippet, r.title);
      const e = baseEntity(kind, r.title, "wikipedia", `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, "_"))}`);
      e.description.short = { en: stripHtml(r.snippet) };
      e.urls.wikipedia = `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, "_"))}`;
      e.score = 10 - (r.position ?? 0);
      return e;
    });
  },
  async get(ctx, ref) {
    const title = ref.externalIds?.wikipedia ?? ref.id;
    const res = await fetchJson<any>(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`, { provider: "wikipedia", ttlMs: 86_400_000, allowStatus: [404] }).catch(() => null);
    if (!res?.data?.title) return null;
    const d = res.data;
    const e = baseEntity(guessKind(d.description, d.title), d.title, "wikipedia", d.content_urls?.desktop?.page);
    e.description.long = { en: d.extract ?? "" };
    e.description.short = { en: d.description ?? "" };
    e.images.poster = d.originalimage?.source ? [d.originalimage.source] : [];
    e.links.push({ url: d.content_urls?.desktop?.page, site: "wikipedia", kind: "reference", is_official: false });
    e.raw.wikipedia = d;
    return e;
  },
};

export default wikipedia;
void src;
