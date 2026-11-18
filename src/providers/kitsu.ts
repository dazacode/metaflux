import { fetchJson } from "../core/http.ts";
import type { Entity, Kind } from "../schema/entities.ts";
import { addId, baseEntity, dateParts, stripHtml } from "./_util.ts";
import type { Provider } from "./_types.ts";

const BASE = "https://kitsu.io/api/edge";
/** Kitsu is JSON:API and answers a plain `application/json` Accept with 406. */
const H = { accept: "application/vnd.api+json" };

function map(d: any): Entity {
  const a = d.attributes ?? {};
  const e = baseEntity(a.subtype === "manhwa" ? "manhwa" : a.subtype === "manhua" ? "manhua" : d.type === "manga" ? "manga" : "anime", a.canonicalTitle, "kitsu", `https://kitsu.io/${d.type}/${d.id}`);
  addId(e, "kitsu", String(d.id));
  e.title.english = a.titles?.en ?? a.canonicalTitle ?? null;
  e.title.romaji = a.titles?.en_jp ?? null;
  e.title.native = a.titles?.ja_jp ?? null;
  e.title.aliases = a.abbreviatedTitles ?? [];
  e.description.long = { en: stripHtml(a.synopsis ?? a.description) };
  e.images.poster = [a.posterImage?.large, a.posterImage?.original, a.posterImage?.medium].filter(Boolean);
  e.images.cover = [a.coverImage?.large, a.coverImage?.original].filter(Boolean);
  e.dates.start = dateParts(a.startDate) ?? null;
  e.dates.end = dateParts(a.endDate) ?? null;
  e.dates.release = dateParts(a.nextRelease) ?? null;
  e.status.state = a.status === "current" ? "ongoing" : a.status === "finished" ? "finished" : a.status === "tba" ? "announced" : a.status === "unreleased" ? "upcoming" : "unknown";
  e.classification.content_rating = a.ageRating ?? null;
  e.classification.is_adult = a.nsfw ?? null;
  e.metrics.score = a.averageRating ? Number(a.averageRating) : null;
  e.metrics.score_scale = a.averageRating ? 100 : null;
  e.metrics.rank = a.ratingRank ?? null;
  e.metrics.popularity = a.popularityRank ?? null;
  e.metrics.members = a.userCount ?? null;
  e.metrics.favourites = a.favoritesCount ?? null;
  e.technical.episode_runtime_minutes = a.episodeLength ?? null;
  e.technical.runtime_minutes = a.totalLength ?? null;
  e.media.trailers = a.youtubeVideoId ? [{ id: a.youtubeVideoId, site: "youtube", url: `https://youtube.com/watch?v=${a.youtubeVideoId}` }] : [];
  e.availability.official_site = `https://kitsu.io/${d.type}/${d.id}`;
  e.genres_cache = undefined as any;
  e.raw.kitsu = d;
  e.score = (a.userCount ?? 0) / 1000 + (a.averageRating ? Number(a.averageRating) / 10 : 0);
  return e;
}

/** Kitsu `mappings.externalSite` -> our namespace. Only same-medium sites are kept. */
const SITE: Record<string, string> = {
  "myanimelist/anime": "mal", "myanimelist/manga": "mal", "anilist/anime": "anilist", "anilist/manga": "anilist",
  "anidb": "anidb", "thetvdb/series": "tvdb", "thetvdb": "tvdb", "mangaupdates": "mangaupdates",
};

/** Map a JSON:API document, attaching MAL/AniList ids from `include=mappings` so fallback rows stay keyable. */
function mapDoc(doc: any): Entity[] {
  const included = new Map<string, any>((doc?.included ?? []).filter((i: any) => i.type === "mappings").map((i: any) => [String(i.id), i]));
  const rows = Array.isArray(doc?.data) ? doc.data : doc?.data ? [doc.data] : [];
  return rows.map((d: any) => {
    const e = map(d);
    const medium = d.type === "manga" ? "manga" : "anime";
    for (const ref of d.relationships?.mappings?.data ?? []) {
      const m = included.get(String(ref.id))?.attributes;
      const ns = m ? SITE[m.externalSite] : null;
      if (!ns || !m.externalId) continue;
      if ((ns === "mal" || ns === "anilist") && !String(m.externalSite).endsWith(medium)) continue;
      addId(e, ns, String(m.externalId));
    }
    const a = d.attributes ?? {};
    e.format = a.subtype ? String(a.subtype).toUpperCase().replace("ONESHOT", "ONE_SHOT") : null;
    e.technical.episode_count = a.episodeCount ?? null;
    e.manga.chapter_count = a.chapterCount ?? null;
    e.manga.volume_count = a.volumeCount ?? null;
    if (a.startDate && medium === "anime") {
      const month = Number(a.startDate.slice(5, 7));
      e.season = { name: month <= 3 ? "winter" : month <= 6 ? "spring" : month <= 9 ? "summer" : "fall", year: Number(a.startDate.slice(0, 4)) };
    }
    return e;
  });
}

const isManga = (k?: Kind) => k === "manga" || k === "manhwa" || k === "manhua";
const list = async (path: string, ttlMs: number) =>
  mapDoc((await fetchJson<any>(`${BASE}/${path}${path.includes("?") ? "&" : "?"}include=mappings`, { provider: "kitsu", headers: H, ttlMs })).data);

export const kitsu: Provider = {
  id: "kitsu", name: "Kitsu", domains: ["anime", "reading"], priority: 27,
  kinds: ["anime", "anime_movie", "manga", "manhwa", "manhua"],
  operations: ["search", "get", "trending", "discover", "episodes"],
  namespaces: ["kitsu"], scopes: ["anime", "manga"],
  limits: { "kitsu.io": { rate: 45, windowMs: 60_000, burst: 3, concurrency: 3 } },
  auth: "none", base: BASE, license: "Kitsu data; community",
  freshness: "6h", homepage: "https://kitsu.io",
  notes: "Anime/manga catalogue; fallback for search/trending/popular when AniList is saturated. Rows carry MAL/AniList ids via include=mappings. JSON:API Accept header required.",
  async search(ctx, q) {
    const wants = ctx.kinds?.length ? ctx.kinds : (["anime", "manga"] as Kind[]);
    const per = Math.min(ctx.limit, 20);
    const [anime, manga] = await Promise.all([
      wants.some((k) => !isManga(k)) ? list(`anime?filter[text]=${encodeURIComponent(q)}&page[limit]=${per}`, 21_600_000).catch(() => []) : [],
      wants.some((k) => isManga(k) || k === "comic") ? list(`manga?filter[text]=${encodeURIComponent(q)}&page[limit]=${per}`, 21_600_000).catch(() => []) : [],
    ]);
    return [...anime, ...manga];
  },
  async get(ctx, ref) {
    const type = isManga(ref.kind) ? "manga" : "anime";
    if (!/^\d+$/.test(ref.id)) return null;
    const res = await fetchJson<any>(`${BASE}/${type}/${ref.id}?include=mappings`, { provider: "kitsu", headers: H, ttlMs: 21_600_000, allowStatus: [404] });
    return res.data?.data ? mapDoc(res.data)[0] ?? null : null;
  },
  async trending(ctx, kind) {
    const per = Math.min(ctx.limit, 20);
    const offset = ((ctx.page ?? 1) - 1) * per;
    return list(`${isManga(kind) ? "manga" : "anime"}?sort=-userCount&page[limit]=${per}&page[offset]=${offset}`, 3_600_000);
  },
  async discover(ctx, p) {
    // Kitsu cannot combine genre/format/season filters reliably; it answers the plain popular and score charts.
    if (p.genre || p.genres?.length || p.format || p.season || p.country || p.query) return [];
    const per = Math.min(ctx.limit, 20);
    const offset = ((p.page ?? ctx.page ?? 1) - 1) * per;
    const sort = p.sort === "score" ? "-averageRating" : p.sort === "newest" ? "-startDate" : "-userCount";
    const year = p.year ? `&filter[seasonYear]=${p.year}` : "";
    return list(`${isManga(p.kind) ? "manga" : "anime"}?sort=${sort}${year}&page[limit]=${per}&page[offset]=${offset}`, 3_600_000);
  },
  async episodes(ctx, id) {
    const res = await fetchJson<any>(`${BASE}/anime/${id}/episodes?page[limit]=20&sort=number`, { provider: "kitsu", headers: H, ttlMs: 21_600_000 }).catch(() => null);
    return (res?.data?.data ?? []).map((ep: any) => {
      const a = ep.attributes ?? {};
      const e = baseEntity("anime_episode", a.canonicalTitle ?? `Episode ${a.number}`, "kitsu");
      e.episodes = [{ id: `kitsu:episode:${ep.id}`, number: a.number, season: a.seasonNumber ?? null, title: a.canonicalTitle ?? null, titles: a.titles ?? {}, description: a.synopsis ? { en: a.synopsis } : {}, air_date: a.airdate ?? null, runtime: a.length ?? null, image: a.thumbnail?.original ?? null, sources: [] }];
      return e;
    });
  },
};
export default kitsu;
