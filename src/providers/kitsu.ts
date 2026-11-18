import { fetchJson } from "../core/http.ts";
import type { Entity } from "../schema/entities.ts";
import { addId, baseEntity, dateParts, stripHtml } from "./_util.ts";
import type { Provider } from "./_types.ts";

const BASE = "https://kitsu.io/api/edge";

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

export const kitsu: Provider = {
  id: "kitsu", name: "Kitsu", domains: ["anime", "reading"], priority: 27,
  kinds: ["anime", "anime_movie", "manga", "manhwa", "manhua"],
  operations: ["search", "get", "trending", "episodes"],
  auth: "none", base: BASE, license: "Kitsu data; community",
  freshness: "6h", homepage: "https://kitsu.io",
  notes: "Anime/manga catalogue with titles, ratings, poster/cover art, relationships.",
  async search(ctx, q) {
    const [anime, manga] = await Promise.all([
      fetchJson<any>(`${BASE}/anime?filter[text]=${encodeURIComponent(q)}&page[limit]=${Math.min(ctx.limit, 15)}`, { provider: "kitsu", ttlMs: 21_600_000 }).catch(() => null),
      fetchJson<any>(`${BASE}/manga?filter[text]=${encodeURIComponent(q)}&page[limit]=${Math.min(ctx.limit, 15)}`, { provider: "kitsu", ttlMs: 21_600_000 }).catch(() => null),
    ]);
    return [...(anime?.data?.data ?? []), ...(manga?.data?.data ?? [])].map(map);
  },
  async get(ctx, ref) {
    const type = ["manga", "manhwa", "manhua"].includes(ref.kind ?? "") ? "manga" : "anime";
    const res = await fetchJson<any>(`${BASE}/${type}/${ref.id}`, { provider: "kitsu", ttlMs: 21_600_000, allowStatus: [404] });
    return res.data?.data ? map(res.data.data) : null;
  },
  async trending(ctx) {
    const res = await fetchJson<any>(`${BASE}/anime?sort=-userCount&page[limit]=${ctx.limit}`, { provider: "kitsu", ttlMs: 3_600_000 });
    return (res.data.data ?? []).map(map);
  },
  async episodes(ctx, id) {
    const res = await fetchJson<any>(`${BASE}/anime/${id}/episodes?page[limit]=100`, { provider: "kitsu", ttlMs: 21_600_000 }).catch(() => null);
    return (res?.data?.data ?? []).map((ep: any) => {
      const e = baseEntity("anime_episode", ep.attributes?.canonicalTitle ?? `Episode ${ep.attributes?.number}`, "kitsu");
      e.episodes = [{ id: String(ep.id), number: ep.attributes?.number, title: ep.attributes?.canonicalTitle, air_date: ep.attributes?.airdate, sources: [] }];
      return e;
    });
  },
};
export default kitsu;
