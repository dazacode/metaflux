import { fetchJson } from "../core/http.ts";
import type { Entity, Kind } from "../schema/entities.ts";
import { addId, baseEntity, src, stripHtml } from "./_util.ts";
import type { Provider } from "./_types.ts";

const BASE = "https://api.ani.zip";
const TTL = 12 * 3600_000;

/** Our namespace -> ani.zip query parameter. */
const PARAM: Record<string, string> = { mal: "mal_id", anilist: "anilist_id", kitsu: "kitsu_id", anidb: "anidb_id" };

/** ani.zip `mappings` keys -> our namespaces. */
const MAPPING: Record<string, string> = {
  mal_id: "mal", anilist_id: "anilist", kitsu_id: "kitsu", anidb_id: "anidb", thetvdb_id: "tvdb",
  imdb_id: "imdb", themoviedb_id: "tmdb", livechart_id: "livechart", anisearch_id: "anisearch",
  animeplanet_id: "animeplanet", notifymoe_id: "notifymoe",
};

const IMAGE: Record<string, keyof Entity["images"]> = { Poster: "poster", Banner: "banner", Fanart: "backdrop", Clearlogo: "logo" };

function episodeTitle(t: Record<string, string> | undefined): string | null {
  if (!t) return null;
  return t.en || t["x-jat"] || t.ja || Object.values(t).find(Boolean) || null;
}

export function mapEpisode(key: string, ep: any, ownerId: string, url: string) {
  const special = /^S\d+$/.test(key);
  const number = Number(special ? key.slice(1) : key);
  const overview = stripHtml(ep.overview ?? "") || stripHtml(String(ep.summary ?? "").replace(/\n?Source:.*$/s, "")) || "";
  const external: Record<string, string[]> = {};
  if (ep.tvdbId) external.tvdb = [String(ep.tvdbId)];
  if (ep.anidbEid) external.anidb = [String(ep.anidbEid)];
  return {
    id: `anizip:${ownerId}:ep:${key}`,
    number,
    season: special ? 0 : ep.seasonNumber ?? null,
    absolute_number: special ? null : ep.absoluteEpisodeNumber ?? null,
    title: episodeTitle(ep.title),
    titles: ep.title ?? {},
    description: (overview ? { en: overview } : {}) as Record<string, string>,
    air_date: ep.airDateUtc ?? ep.airDate ?? ep.airdate ?? null,
    runtime: ep.runtime ?? ep.length ?? null,
    image: ep.image || null,
    rating: ep.rating != null && ep.rating !== "" ? Number(ep.rating) : null,
    kind: special ? ("special" as const) : ("regular" as const),
    external_ids: external,
    sources: [src("anizip", url)],
  };
}

export function map(d: any, url: string, kind: Kind = "anime"): Entity | null {
  const m = d?.mappings;
  if (!m || typeof m !== "object") return null;
  const t = d.titles ?? {};
  const owner = String(m.mal_id ?? m.anilist_id ?? m.anidb_id ?? "x");
  const e = baseEntity(m.type === "MOVIE" ? "anime_movie" : kind, t.en || t["x-jat"] || t.ja || `ani.zip ${owner}`, "anizip", url);
  for (const [key, ns] of Object.entries(MAPPING)) {
    const v = m[key];
    if (v !== null && v !== undefined && v !== "") addId(e, ns, String(v));
  }
  e.title.english = t.en ?? null;
  e.title.romaji = t["x-jat"] ?? null;
  e.title.native = t.ja ?? null;
  e.title.localized = Object.fromEntries(Object.entries(t).filter(([, v]) => typeof v === "string" && v)) as Record<string, string>;
  e.format = m.type ?? null;
  for (const img of d.images ?? []) {
    const slot = IMAGE[img.coverType];
    if (slot && img.url) (e.images[slot] as string[]).push(img.url);
  }
  e.technical.episode_count = d.episodeCount ?? null;
  e.technical.special_count = d.specialCount ?? null;
  for (const [key, ep] of Object.entries<any>(d.episodes ?? {})) {
    if (!/^S?\d+$/.test(key)) continue;
    e.episodes.push(mapEpisode(key, ep, owner, url));
  }
  e.episodes.sort((a, b) => Number(a.kind === "special") - Number(b.kind === "special") || (a.number ?? 0) - (b.number ?? 0));
  e.raw.anizip = { titles: d.titles, mappings: d.mappings, images: d.images, episodeCount: d.episodeCount, specialCount: d.specialCount };
  return e;
}

export const anizip: Provider = {
  id: "anizip", name: "ani.zip", domains: ["anime", "meta"], priority: 15,
  kinds: ["anime", "anime_movie"],
  operations: ["get", "episodes"],
  namespaces: ["mal", "anilist", "kitsu", "anidb"], scopes: ["anime"],
  limits: { "api.ani.zip": { rate: 60, windowMs: 60_000, burst: 4, concurrency: 3 } },
  auth: "none", base: BASE, license: "ani.zip mappings; episode data from TheTVDB and AniDB",
  freshness: "12h", homepage: "https://ani.zip",
  notes: "One keyless call per show: id map (MAL/AniList/Kitsu/AniDB/TVDB/TMDB/IMDb), localized titles, TVDB clearlogo/fanart/banner, per-episode titles, synopsis, stills, runtimes, UTC air dates, TVDB season and absolute numbers, specials.",
  async get(ctx, ref) {
    const param = PARAM[ref.namespace ?? "mal"];
    if (!param || !/^\d+$/.test(ref.id)) return null;
    const url = `${BASE}/mappings?${param}=${ref.id}`;
    const res = await fetchJson<any>(url, { provider: "anizip", ttlMs: TTL, allowStatus: [404] });
    if (res.status === 404) return null;
    return map(res.data, url, ref.kind === "anime_movie" ? "anime_movie" : "anime");
  },
  async episodes(ctx, id) {
    const e = await this.get!(ctx, { id, namespace: "mal", kind: "anime" });
    if (!e) return [];
    return e.episodes.map((ep) => {
      const row = baseEntity("anime_episode", ep.title ?? `Episode ${ep.number}`, "anizip");
      for (const [k, v] of Object.entries(e.external_ids)) for (const x of v) addId(row, k, x);
      row.episodes = [ep];
      return row;
    });
  },
};

export default anizip;
