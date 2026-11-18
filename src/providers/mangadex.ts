import { fetchJson } from "../core/http.ts";
import type { Entity } from "../schema/entities.ts";
import { addId, baseEntity, dateParts, stripHtml, tag } from "./_util.ts";
import type { Provider } from "./_types.ts";

const BASE = "https://api.mangadex.org";

function map(d: any): Entity {
  const a = d.attributes;
  const rel = (type: string) => (d.relationships ?? []).filter((r: any) => r.type === type).map((r: any) => r.attributes).filter(Boolean);
  const title = a.title?.en ?? Object.values(a.title ?? {})[0] ?? `MangaDex ${d.id}`;
  const e = baseEntity(a.originalLanguage === "ko" ? "manhwa" : a.originalLanguage === "zh" ? "manhua" : "manga", String(title), "mangadex", `https://mangadex.org/title/${d.id}`);
  addId(e, "mangadex", d.id);
  e.title.aliases = Object.values(a.altTitles ?? {}).flatMap((x: any) => Object.values(x)) as string[];
  e.description.long = Object.fromEntries(Object.entries(a.description ?? {}).map(([k, v]) => [k, stripHtml(v)]));
  e.images.poster = rel("cover_art").map((c: any) => `https://uploads.mangadex.org/covers/${d.id}/${c.fileName}`).filter(Boolean);
  e.status.state = a.status === "ongoing" ? "ongoing" : a.status === "completed" ? "completed" : a.status === "hiatus" ? "hiatus" : a.status === "cancelled" ? "cancelled" : "unknown";
  e.dates.start = a.year ? { year: a.year } : null;
  e.manga.original_language = a.originalLanguage;
  e.manga.translated_languages = a.availableTranslatedLanguages ?? [];
  e.manga.latest_chapter = a.lastChapter ?? null;
  e.manga.latest_volume = a.lastVolume ?? null;
  e.manga.demographic = a.publicationDemographic ?? null;
  e.manga.content_rating = undefined as any;
  e.classification.content_rating = a.contentRating ?? null;
  e.classification.is_adult = a.contentRating === "erotica" || a.contentRating === "pornographic";
  e.classification.genres = (a.tags ?? []).filter((t: any) => t.attributes.group === "genre").map((t: any) => t.attributes.name.en);
  e.classification.themes = (a.tags ?? []).filter((t: any) => t.attributes.group === "theme").map((t: any) => t.attributes.name.en);
  e.classification.tags = (a.tags ?? []).map((t: any) => ({ name: t.attributes.name.en, category: t.attributes.group }));
  e.manga.chapter_reset_on_volume = a.chapterNumbersResetOnNewVolume;
  e.links = Object.entries(a.links ?? {}).map(([site, url]) => ({ url: String(url), site, kind: "external" }));
  e.links.push(...(a.officialLinks ?? []).map((l: any) => ({ url: l.url, site: l.site ?? "official", kind: "official", is_official: true })));
  for (const author of rel("author")) {
    e.credits.push({ person: { name: author.name, kind: "person" }, role: "author", voice: false, sources: [] });
  }
  for (const artist of rel("artist")) {
    e.credits.push({ person: { name: artist.name, kind: "person" }, role: "artist", voice: false, sources: [] });
  }
  e.raw.mangadex = d;
  tag(e, `lang:${a.originalLanguage}`);
  e.score = (a.availableTranslatedLanguages?.length ?? 0) + (a.lastChapter ? 1 : 0);
  return e;
}

/**
 * MangaDex has no lookup by MAL/AniList id (links[mal]= filters are rejected),
 * so find the title by name and accept only a row whose own `links.mal` /
 * `links.al` names the work. Never a title-only match.
 */
export async function findByLinks(titles: string[], ids: { mal?: string; anilist?: string }): Promise<string | null> {
  for (const title of [...new Set(titles.filter(Boolean))].slice(0, 3)) {
    const res = await fetchJson<any>(`${BASE}/manga?title=${encodeURIComponent(title)}&limit=10&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica`, { provider: "mangadex", ttlMs: 7 * 86_400_000 }).catch(() => null);
    for (const d of res?.data?.data ?? []) {
      const links = d.attributes?.links ?? {};
      if ((ids.mal && links.mal === ids.mal) || (ids.anilist && links.al === ids.anilist)) return d.id;
    }
  }
  return null;
}

/** Every chapter in one language, oldest first, paged through the feed (MangaDex caps a page at 500). */
export async function chapterFeed(id: string, lang = "en", max = 2000) {
  const out: any[] = [];
  for (let offset = 0; offset < max; offset += 500) {
    const res = await fetchJson<any>(`${BASE}/manga/${id}/feed?limit=500&offset=${offset}&translatedLanguage[]=${encodeURIComponent(lang)}&includes[]=scanlation_group&order[volume]=asc&order[chapter]=asc&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`, { provider: "mangadex", ttlMs: 3_600_000 });
    const rows = res.data.data ?? [];
    for (const c of rows) {
      const a = c.attributes ?? {};
      out.push({
        id: `mangadex:chapter:${c.id}`, number: a.chapter ?? null, volume: a.volume ?? null, title: a.title || null,
        language: a.translatedLanguage ?? lang, pages: a.pages ?? null, published_at: a.publishAt ?? a.readableAt ?? null, updated_at: a.updatedAt ?? null,
        external_url: a.externalUrl ?? `https://mangadex.org/chapter/${c.id}`,
        scanlation_group: (c.relationships ?? []).find((r: any) => r.type === "scanlation_group")?.attributes?.name ?? null,
        sources: [{ provider: "mangadex", url: `https://mangadex.org/chapter/${c.id}`, fetched_at: new Date().toISOString(), confidence: "verified" as const }],
      });
    }
    if (rows.length < 500 || offset + 500 >= (res.data.total ?? 0)) break;
  }
  return out;
}

export const mangadex: Provider = {
  id: "mangadex", name: "MangaDex", domains: ["reading"], priority: 14,
  kinds: ["manga", "manhwa", "manhua"],
  operations: ["search", "get", "chapters", "related"],
  namespaces: ["mangadex"], scopes: ["manga"],
  limits: { "api.mangadex.org": { rate: 5, windowMs: 1_000, burst: 5, concurrency: 4 } },
  auth: "none", base: BASE, license: "MangaDex API ToS; scanlation data",
  freshness: "5min search / 1h chapter", homepage: "https://mangadex.org",
  notes: "Primary manga/manhwa/manhua source. Chapter feeds + At-Home page URLs.",
  async search(ctx, q) {
    const res = await fetchJson<any>(`${BASE}/manga?title=${encodeURIComponent(q)}&limit=${Math.min(ctx.limit, 24)}&includes[]=cover_art&includes[]=author&includes[]=artist&order[relevance]=desc`, { provider: "mangadex", ttlMs: 300_000 });
    return (res.data.data ?? []).map(map);
  },
  async get(ctx, ref) {
    const id = ref.externalIds?.mangadex ?? ref.id;
    const res = await fetchJson<any>(`${BASE}/manga/${id}?includes[]=cover_art&includes[]=author&includes[]=artist`, { provider: "mangadex", ttlMs: 600_000 });
    return map(res.data.data);
  },
  async chapters(ctx, id) {
    const res = await fetchJson<any>(`${BASE}/manga/${id}/feed?limit=100&includes[]=scanlation_group&order[chapter]=asc&order[volume]=asc`, { provider: "mangadex", ttlMs: 600_000 });
    return (res.data.data ?? []).map((c: any) => {
      const e = baseEntity("manga", c.attributes.title || `Chapter ${c.attributes.chapter}`, "mangadex");
      e.chapters = [{
        id: c.id, number: c.attributes.chapter, volume: c.attributes.volume, title: c.attributes.title,
        language: c.attributes.translatedLanguage, pages: c.attributes.pages,
        published_at: c.attributes.publishAt, updated_at: c.attributes.updatedAt,
        scanlation_group: (c.relationships ?? []).find((r: any) => r.type === "scanlation_group")?.attributes?.name,
        sources: [{ provider: "mangadex", url: `https://mangadex.org/chapter/${c.id}`, fetched_at: new Date().toISOString(), confidence: "verified" }],
      }];
      return e;
    });
  },
  async related(ctx, id) {
    const e = await this.get!(ctx, { id });
    return (e?.relations ?? []).map((r) => r.target).filter(Boolean) as Entity[];
  },
};

export default mangadex;
void dateParts;
