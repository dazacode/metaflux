import { fetchJson } from "../core/http.ts";
import type { Entity, Kind } from "../schema/entities.ts";
import { addId, baseEntity, dateParts, num, src, tag } from "./_util.ts";
import type { Provider } from "./_types.ts";

const BASE = "https://v3-cinemeta.strem.io";

function map(m: any, kind: Kind): Entity {
  const e = baseEntity(kind, m.name, "cinemeta", `https://www.imdb.com/title/${m.imdb_id}/`);
  addId(e, "imdb", m.imdb_id);
  if (m.moviedb_id) addId(e, "tmdb", String(m.moviedb_id));
  if (m.tvdb_id) addId(e, "tvdb", String(m.tvdb_id));
  e.title.english = m.name;
  e.title.aliases = [m.slug, m.releaseInfo].filter(Boolean);
  e.description.long = { en: m.description ?? "" };
  e.description.synopsis = { en: m.description ?? "" };
  e.images.poster = [m.poster].filter(Boolean);
  e.images.backdrop = [m.background].filter(Boolean);
  e.images.logo = [m.logo].filter(Boolean);
  e.dates.release = dateParts(m.released) ?? null;
  e.dates.start = dateParts(m.released) ?? null;
  e.status.state = m.status === "Continuing" ? "airing" : m.status === "Ended" ? "ended" : "unknown";
  e.classification.genres = m.genres ?? m.genre ?? [];
  e.metrics.score = num(m.imdbRating);
  e.metrics.score_scale = 10;
  e.metrics.popularity = num(m.popularity);
  e.technical.runtime_minutes = m.runtime ? parseInt(String(m.runtime).replace(/\D/g, "")) || null : null;
  for (const c of m.cast ?? []) e.credits.push({ person: { name: c, kind: "person" }, role: "cast", voice: false, sources: [] });
  if (m.director) for (const d of Array.isArray(m.director) ? m.director : [m.director]) e.credits.push({ person: { name: d, kind: "person" }, role: "director", department: "crew", voice: false, sources: [] });
  if (m.writer) for (const w of Array.isArray(m.writer) ? m.writer : [m.writer]) e.credits.push({ person: { name: w, kind: "person" }, role: "writer", department: "crew", voice: false, sources: [] });
  e.companies.production = (m.country ? [{ name: m.country, kind: "company" as const }] : []);
  e.availability.official_site = `https://www.imdb.com/title/${m.imdb_id}/`;
  for (const v of m.videos ?? []) {
    e.episodes.push({
      id: String(v.id), season: v.season, number: v.number, title: v.name ?? v.episode, description: v.overview ? { en: v.overview } : {},
      air_date: v.firstAired ?? v.released, image: v.thumbnail ?? null, rating: v.rating ?? null, kind: "regular", sources: [],
    });
  }
  for (const t of m.trailers ?? []) e.media.trailers.push({ id: t.source, site: t.type, url: t.source });
  for (const l of m.links ?? []) e.links.push({ url: l.url, site: l.name, kind: l.category });
  e.raw.cinemeta = m;
  tag(e, `type:${m.type}`);
  e.score = (num(m.imdbRating) ?? 0) * 10 + (num(m.popularity) ?? 0);
  return e;
}

export const cinemeta: Provider = {
  id: "cinemeta", name: "Cinemeta (Stremio)", domains: ["screen"], priority: 8,
  kinds: ["movie", "tv_show", "tv_episode"],
  operations: ["search", "get", "discover", "related"],
  namespaces: ["imdb"], scopes: ["movie", "tv", "screen"],
  auth: "none", base: BASE, license: "Stremio addon, IMDb-derived data",
  freshness: "6h", homepage: "https://v3-cinemeta.strem.io",
  notes: "Keyless IMDb/TMDB bridge with rich descriptions, cast, videos and art. IMDB-id keyed.",
  async search(ctx, q) {
    // IMDb suggestion is keyless, typo-tolerant and returns type + rank directly.
    const suggest = await fetchJson<any>(`https://v2.sg.media-imdb.com/suggestion/i/${encodeURIComponent(q.toLowerCase().replace(/\s+/g, "_"))}.json`, { provider: "cinemeta", ttlMs: 21_600_000, allowStatus: [404] }).catch(() => null);
    const rows: Entity[] = [];
    for (const d of suggest?.data?.d ?? []) {
      if (!/^tt\d+$/.test(d.id ?? "")) continue;
      const kind: Kind | null = d.qid === "movie" ? "movie" : d.qid === "tvSeries" || d.qid === "tvMiniSeries" ? "tv_show" : d.qid === "tvMovie" ? "movie" : null;
      if (!kind) continue;
      const e = baseEntity(kind, d.l, "cinemeta", `https://www.imdb.com/title/${d.id}/`);
      addId(e, "imdb", d.id);
      e.title.english = d.l;
      e.images.poster = d.i?.imageUrl ? [d.i.imageUrl] : [];
      e.dates.release = d.y ? { year: Number(d.y) } : null;
      for (const star of String(d.s ?? "").split(", ").filter(Boolean)) e.credits.push({ person: { name: star, kind: "person" }, role: "cast", voice: false, sources: [] });
      e.metrics.popularity = Number(d.rank) || null;
      e.raw.imdb_suggest = d;
      rows.push(e);
    }
    if (rows.length) return rows.slice(0, ctx.limit);
    const [movies, series] = await Promise.all([
      fetchJson<any>(`${BASE}/catalog/movie/top.json`, { provider: "cinemeta", ttlMs: 3_600_000 }).catch(() => null),
      fetchJson<any>(`${BASE}/catalog/series/top.json`, { provider: "cinemeta", ttlMs: 3_600_000 }).catch(() => null),
    ]);
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const filter = (arr: any[]) => arr.filter((m) => words.every((w) => `${m.name} ${m.description}`.toLowerCase().includes(w)));
    return [
      ...filter(movies?.data?.metas ?? []).slice(0, ctx.limit).map((m: any) => map(m, "movie")),
      ...filter(series?.data?.metas ?? []).slice(0, ctx.limit).map((m: any) => map(m, "tv_show")),
    ];
  },
  async get(ctx, ref) {
    const imdb = ref.externalIds?.imdb ?? (/^tt\d+$/.test(ref.id) ? ref.id : null);
    if (!imdb) return null;
    for (const type of ["movie", "series"]) {
      const res = await fetchJson<any>(`${BASE}/meta/${type}/${imdb}.json`, { provider: "cinemeta", ttlMs: 3600_000, allowStatus: [404] }).catch(() => null);
      if (res?.data?.meta) return map(res.data.meta, type === "movie" ? "movie" : "tv_show");
    }
    return null;
  },
  async discover(ctx, p) {
    if (p.kind !== "movie" && p.kind !== "tv_show") return [];
    const res = await fetchJson<any>(`${BASE}/catalog/${p.kind === "movie" ? "movie" : "series"}/top.json`, { provider: "cinemeta", ttlMs: 3600_000 });
    return (res.data.metas ?? []).slice(0, ctx.limit).map((m: any) => map(m, p.kind as Kind));
  },
};

export default cinemeta;
void src;
