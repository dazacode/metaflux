import { fetchJson } from "../core/http.ts";
import { config } from "../core/config.ts";
import type { Entity } from "../schema/entities.ts";
import { addId, baseEntity, dateParts, tag } from "./_util.ts";
import type { Provider } from "./_types.ts";

const BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/original";

/** Optional, key-assisted enrichment. Everything still works without TMDB_API_KEY. */
function map(d: any, kind: Entity["kind"]): Entity {
  const e = baseEntity(kind, d.title ?? d.name, "tmdb", d.homepage);
  addId(e, "tmdb", String(d.id));
  if (d.imdb_id) addId(e, "imdb", d.imdb_id);
  e.title.english = d.title ?? d.name;
  e.title.original = d.original_title ?? d.original_name;
  e.description.long = { en: d.overview ?? "" };
  e.description.synopsis = e.description.long;
  e.description.tagline = d.tagline ? { en: d.tagline } : {};
  e.images.poster = [d.poster_path].filter(Boolean).map((p) => `${IMG}${p}`);
  e.images.backdrop = [d.backdrop_path].filter(Boolean).map((p) => `${IMG}${p}`);
  e.dates.release = dateParts(d.release_date) ?? null;
  e.dates.start = dateParts(d.first_air_date) ?? null;
  e.status.state = d.status === "Released" ? "released" as any : d.status === "Returning Series" ? "airing" : "unknown";
  e.classification.genres = (d.genres ?? []).map((g: any) => g.name);
  e.metrics.score = d.vote_average ?? null;
  e.metrics.score_scale = 10;
  e.metrics.votes = d.vote_count ?? null;
  e.metrics.popularity = d.popularity ?? null;
  e.technical.runtime_minutes = d.runtime ?? null;
  for (const c of d.credits?.cast ?? []) e.credits.push({ person: { id: `tmdb_person_${c.id}`, name: c.name, kind: "person", external_ids: { tmdb: [String(c.id)] }, image: c.profile_path ? `${IMG}${c.profile_path}` : null }, role: c.character, department: "cast", voice: false, order: c.order, sources: [] });
  for (const c of d.credits?.crew ?? []) e.credits.push({ person: { id: `tmdb_person_${c.id}`, name: c.name, kind: "person", external_ids: { tmdb: [String(c.id)] } }, role: c.job, department: c.department, voice: false, sources: [] });
  e.companies.production = (d.production_companies ?? []).map((c: any) => ({ id: `tmdb_company_${c.id}`, name: c.name, kind: "company", image: c.logo_path ? `${IMG}${c.logo_path}` : null, country: c.origin_country ?? null }));
  e.companies.networks = (d.networks ?? []).map((n: any) => ({ id: `tmdb_network_${n.id}`, name: n.name, kind: "network", image: n.logo_path ? `${IMG}${n.logo_path}` : null }));
  e.links = (d.external_ids ? Object.entries(d.external_ids).filter(([, v]) => v).map(([k, v]) => ({ url: k === "imdb" ? `https://www.imdb.com/title/${v}` : `https://www.themoviedb.org/${kind === "movie" ? "movie" : "tv"}/${d.id}`, site: k, kind: "external" })) : []);
  if (d.belongs_to_collection) e.relations.push({ kind: "collection", title: d.belongs_to_collection.name, direction: "outgoing", sources: [] });
  e.raw.tmdb = d;
  e.score = (d.popularity ?? 0);
  tag(e, "source:tmdb");
  return e;
}

export const tmdb: Provider = {
  id: "tmdb", name: "TMDB (optional key)", domains: ["screen", "people"], priority: 4,
  kinds: ["movie", "tv_show", "tv_episode", "person", "collection"],
  operations: ["search", "get", "trending", "discover", "related", "people"],
  namespaces: ["tmdb"], scopes: ["movie", "tv", "person"],
  auth: "optional-key", keyEnv: "TMDB_API_KEY", base: BASE, license: "TMDB terms",
  freshness: "6h", homepage: "https://www.themoviedb.org",
  notes: "Adds TMDB/IMDb ids, full credits, collections, translations. Disabled without a key.",
  async search(ctx, q) {
    if (!config.keys.tmdb) return [];
    const res = await fetchJson<any>(`${BASE}/search/multi?api_key=${config.keys.tmdb}&query=${encodeURIComponent(q)}&include_adult=false`, { provider: "tmdb", ttlMs: 21_600_000 });
    return (res.data.results ?? []).filter((r: any) => ["movie", "tv"].includes(r.media_type)).map((r: any) => map(r, r.media_type === "movie" ? "movie" : "tv_show"));
  },
  async get(ctx, ref) {
    if (!config.keys.tmdb) return null;
    const kind = ref.kind ?? "movie";
    const type = kind === "tv_show" || kind === "tv_episode" ? "tv" : "movie";
    const res = await fetchJson<any>(`${BASE}/${type}/${ref.id}?api_key=${config.keys.tmdb}&append_to_response=credits,external_ids`, { provider: "tmdb", ttlMs: 21_600_000, allowStatus: [404] });
    if (res.data?.success === false) return null;
    return map(res.data, type === "movie" ? "movie" : "tv_show");
  },
  async trending(ctx, kind) {
    if (!config.keys.tmdb) return [];
    const type = kind === "tv_show" ? "tv" : "movie";
    const res = await fetchJson<any>(`${BASE}/trending/${type}/day?api_key=${config.keys.tmdb}`, { provider: "tmdb", ttlMs: 3_600_000 });
    return (res.data.results ?? []).slice(0, ctx.limit).map((r: any) => map(r, type === "movie" ? "movie" : "tv_show"));
  },
};
export default tmdb;
