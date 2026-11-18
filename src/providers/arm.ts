import { fetchJson } from "../core/http.ts";
import type { Entity } from "../schema/entities.ts";
import { addId, baseEntity, tag } from "./_util.ts";
import type { Provider } from "./_types.ts";

const BASE = "https://arm.haglund.dev/api/v2";

const SOURCE_MAP: Record<string, string> = {
  anilist: "anilist", myanimelist: "mal", anidb: "anidb", kitsu: "kitsu",
  imdb: "imdb", themoviedb: "tmdb", thetvdb: "tvdb", trakt: "trakt", "themoviedb-season": "tmdb_season", "thetvdb-season": "tvdb_season",
  animecountdown: "animecountdown", animeschedule: "animeschedule",
  livechart: "livechart", anisearch: "anisearch", animeplanet: "animeplanet",
  ann: "ann", simkl: "simkl",
};

export const arm: Provider = {
  id: "arm", name: "Anime Relational Mapping", domains: ["meta", "anime"], priority: 12,
  kinds: ["anime", "anime_movie", "manga"],
  operations: ["resolve", "get"],
  auth: "none", base: BASE, license: "ARM community mapping",
  freshness: "30d", homepage: "https://arm.haglund.dev",
  notes: "Cross-provider anime id map (AniList, MAL, AniDB, Kitsu, IMDb, TMDB, TVDB, Trakt).",
  async resolve(ctx, ids) {
    const [source, id] = Object.entries(ids)[0] ?? [];
    if (!source || !id) return null;
    const res = await fetchJson<any>(`${BASE}/ids?source=${encodeURIComponent(source)}&id=${encodeURIComponent(id)}`, { provider: "arm", ttlMs: 2_592_000_000, allowStatus: [404] });
    if (!res.data || res.data.error) return null;
    const e = baseEntity("anime", res.data.title?.romaji ?? res.data.title?.english ?? `ARM ${id}`, "arm");
    for (const [key, value] of Object.entries(res.data)) {
      const mapped = SOURCE_MAP[key];
      if (!mapped || value == null) continue;
      if (Array.isArray(value)) for (const item of value) addId(e, mapped, String(item));
      else addId(e, mapped, String(value));
    }
    if (res.data.media?.type) tag(e, `media:${res.data.media.type}`);
    e.raw.arm = res.data;
    return e;
  },
  async get(ctx, ref) {
    const [source, id] = Object.entries(ref.externalIds ?? {})[0] ?? [];
    if (!source || !id) return null;
    return this.resolve!(ctx, { [source]: id });
  },
};
export default arm;
