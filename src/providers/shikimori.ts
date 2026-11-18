import { fetchJson } from "../core/http.ts";
import type { Entity, Kind } from "../schema/entities.ts";
import { addId, baseEntity } from "./_util.ts";
import type { ListResult, Provider, ProviderContext } from "./_types.ts";

const SITE = "https://shikimori.io";
const BASE = `${SITE}/api`;

const ANIME_FORMAT: Record<string, string> = { tv: "TV", movie: "MOVIE", ova: "OVA", ona: "ONA", special: "SPECIAL", tv_special: "SPECIAL", music: "MUSIC", pv: "MUSIC", cm: "MUSIC" };
const MANGA_FORMAT: Record<string, string> = { manga: "MANGA", manhwa: "MANGA", manhua: "MANGA", light_novel: "NOVEL", novel: "NOVEL", one_shot: "ONE_SHOT", doujin: "MANGA" };
const STATE: Record<string, Entity["status"]["state"]> = { anons: "upcoming", ongoing: "releasing", released: "finished", paused: "hiatus", discontinued: "cancelled" };
const STATUS_IN: Record<string, string> = { releasing: "ongoing", airing: "ongoing", finished: "released", completed: "released", upcoming: "anons", hiatus: "paused", cancelled: "discontinued" };
const FORMAT_IN: Record<string, string> = { TV: "tv", MOVIE: "movie", OVA: "ova", ONA: "ona", SPECIAL: "special", MUSIC: "music", MANGA: "manga", NOVEL: "light_novel", ONE_SHOT: "one_shot" };
const ORDER: Record<string, string> = { popular: "popularity", popularity: "popularity", trending: "popularity", score: "ranked", newest: "aired_on", start_date_desc: "aired_on", title: "name", episodes: "episodes" };

const isManga = (k?: Kind) => k === "manga" || k === "manhwa" || k === "manhua";

/** Shikimori ids are MyAnimeList ids, so every row is keyable as mal:<id> / mal:manga:<id>. */
function map(r: any, medium: "anime" | "manga"): Entity {
  const kind: Kind = medium === "manga" ? (r.kind === "manhwa" ? "manhwa" : r.kind === "manhua" ? "manhua" : "manga") : r.kind === "movie" ? "anime_movie" : "anime";
  const url = `${SITE}${r.url}`;
  const e = baseEntity(kind, r.name ?? r.russian ?? `MAL ${r.id}`, "shikimori", url);
  addId(e, "mal", String(r.id));
  e.title.romaji = r.name ?? null;
  e.title.native = r.japanese?.[0] ?? null;
  if (r.russian) e.title.localized = { ru: r.russian };
  const img = r.image?.original;
  if (img && !img.includes("missing_")) e.images.poster = [img.startsWith("http") ? img : `${SITE}${img}`];
  e.format = (medium === "manga" ? MANGA_FORMAT : ANIME_FORMAT)[r.kind] ?? null;
  e.status.state = STATE[r.status] ?? "unknown";
  const score = Number(r.score);
  if (score > 0) { e.metrics.score = Math.round(score * 10); e.metrics.score_scale = 100; }
  if (medium === "anime") {
    e.technical.episode_count = r.episodes > 0 ? r.episodes : null;
    if (r.aired_on) {
      const month = Number(r.aired_on.slice(5, 7));
      e.season = { name: month <= 3 ? "winter" : month <= 6 ? "spring" : month <= 9 ? "summer" : "fall", year: Number(r.aired_on.slice(0, 4)) };
    }
  } else {
    e.manga.chapter_count = r.chapters > 0 ? r.chapters : null;
    e.manga.volume_count = r.volumes > 0 ? r.volumes : null;
    if (r.aired_on) e.season = { name: null, year: Number(r.aired_on.slice(0, 4)) };
  }
  if (r.aired_on) e.dates.start = { year: Number(r.aired_on.slice(0, 4)), month: Number(r.aired_on.slice(5, 7)), day: Number(r.aired_on.slice(8, 10)), date: r.aired_on, precision: "day" };
  if (r.released_on) e.dates.end = { year: Number(r.released_on.slice(0, 4)), month: Number(r.released_on.slice(5, 7)), day: Number(r.released_on.slice(8, 10)), date: r.released_on, precision: "day" };
  e.raw.shikimori = r;
  e.score = score;
  return e;
}

async function page(ctx: ProviderContext, kind: Kind, params: Record<string, string | number | undefined>): Promise<ListResult> {
  const medium = isManga(kind) ? "manga" : "anime";
  const per = Math.min(ctx.limit, 50);
  const qs = new URLSearchParams({ limit: String(per), page: String(ctx.page ?? 1), censored: "true" });
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  const res = await fetchJson<any[]>(`${BASE}/${medium === "manga" ? "mangas" : "animes"}?${qs}`, { provider: "shikimori", ttlMs: 30 * 60_000 });
  const rows = (res.data ?? []).map((r) => map(r, medium)) as ListResult;
  // Shikimori returns limit+1 rows when another page exists.
  rows.hasNext = rows.length > per;
  rows.splice(per);
  rows.total = null;
  return rows;
}

export const shikimori: Provider = {
  id: "shikimori", name: "Shikimori", domains: ["anime", "reading"], priority: 24,
  kinds: ["anime", "anime_movie", "manga", "manhwa", "manhua"],
  operations: ["search", "get", "trending", "discover"],
  namespaces: ["mal"], scopes: ["anime", "manga"],
  limits: { "shikimori.io": { rate: 90, windowMs: 60_000, burst: 2, concurrency: 2 } },
  auth: "none", base: BASE, license: "Shikimori data (MAL ids)",
  freshness: "30min", homepage: SITE,
  notes: "Keyless MAL mirror for lists when AniList is saturated: every row is a MAL id. Russian titles in title.localized.ru. .one redirects to .io; burst above 2 earns a 60 s Retry-After.",
  async search(ctx, q) {
    const wants = ctx.kinds?.length ? ctx.kinds : (["anime"] as Kind[]);
    const out: Entity[] = [];
    if (wants.some((k) => !isManga(k))) out.push(...await page(ctx, "anime", { search: q, order: "popularity" }));
    if (wants.some((k) => isManga(k))) out.push(...await page(ctx, "manga", { search: q, order: "popularity" }));
    return out;
  },
  /**
   * MAL's own counts when AniList has none (AniList lists Vagabond with null
   * chapters; MAL has 327/37). Deliberately sparse: genres, studios and the
   * Russian synopsis are left to AniList so arrays do not fill with near-duplicates.
   */
  async get(ctx, ref) {
    if (!/^\d+$/.test(ref.id)) return null;
    const medium = isManga(ref.kind) ? "manga" : "anime";
    const res = await fetchJson<any>(`${BASE}/${medium === "manga" ? "mangas" : "animes"}/${ref.id}`, { provider: "shikimori", ttlMs: 6 * 3600_000, allowStatus: [404] });
    if (res.status === 404 || !res.data?.id) return null;
    const d = res.data;
    const e = map(d, medium);
    e.title.english = d.english?.[0] ?? null;
    e.title.native = d.japanese?.[0] ?? null;
    e.title.aliases = (d.synonyms ?? []).filter(Boolean);
    if (medium === "anime" && d.duration) e.technical.episode_runtime_minutes = d.duration;
    if (medium === "anime" && d.next_episode_at && d.episodes_aired != null) {
      e.broadcast.next_episode = { number: d.episodes_aired + 1, airing_at: new Date(d.next_episode_at).toISOString(), precision: "minute" };
    }
    e.raw.shikimori = { id: d.id, kind: d.kind, status: d.status, episodes: d.episodes, episodes_aired: d.episodes_aired, chapters: d.chapters, volumes: d.volumes, aired_on: d.aired_on, released_on: d.released_on, url: d.url };
    return e;
  },
  async trending(ctx, kind) {
    return page(ctx, kind, { order: "popularity", status: "ongoing" });
  },
  async discover(ctx, p) {
    // Genre filtering needs Shikimori's own genre ids; leave those requests to AniList/Kitsu.
    if (p.genre || p.genres?.length || p.country) return [];
    const medium = isManga(p.kind) ? "manga" : "anime";
    const season = medium === "anime" && (p.season || p.year) ? (p.season && p.year ? `${p.season}_${p.year}` : p.year ? String(p.year) : undefined) : undefined;
    const kind = p.format ? FORMAT_IN[p.format.toUpperCase()] : undefined;
    if (p.format && !kind) return [];
    return page({ ...ctx, page: p.page ?? ctx.page }, p.kind, {
      search: p.query, order: ORDER[p.sort ?? "popular"] ?? "popularity", season, kind,
      status: p.status ? STATUS_IN[p.status.toLowerCase()] : undefined,
    });
  },
};

export default shikimori;
