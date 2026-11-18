import { fetchJson } from "../core/http.ts";
import type { Entity, Kind } from "../schema/entities.ts";
import { addId, baseEntity, dateParts, list, num, src, stripHtml, tag } from "./_util.ts";
import type { Provider } from "./_types.ts";

const BASE = "https://api.jikan.moe/v4";

function map(d: any): Entity {
  const type: Kind = d.type === "Manga" ? "manga" : "anime";
  const e = baseEntity(type, d.title_english || d.title || `MAL ${d.mal_id}`, "jikan", d.url);
  addId(e, "mal", String(d.mal_id));
  e.title.display = d.title ?? e.name;
  e.title.english = d.title_english ?? null;
  e.title.romaji = d.title_japanese ? null : d.title ?? null;
  e.title.native = d.title_japanese ?? null;
  e.title.aliases = [...(d.title_synonyms ?? []), ...(d.titles ?? []).map((t: any) => t.title)].filter(Boolean);
  e.description.long = { en: stripHtml(d.synopsis) };
  e.description.synopsis = { en: stripHtml(d.synopsis) };
  e.description.notes = d.background ? { en: stripHtml(d.background) } : {};
  e.images.poster = [d.images?.jpg?.large_image_url, d.images?.jpg?.image_url, d.images?.webp?.large_image_url].filter(Boolean);
  e.dates.start = dateParts(d.aired?.from ?? d.published?.from) ?? null;
  e.dates.end = dateParts(d.aired?.to ?? d.published?.to) ?? null;
  e.status.state = d.status === "Currently Airing" || d.status === "Publishing" ? "releasing" :
    d.status === "Finished Airing" || d.status === "Finished" ? "finished" : d.status === "Not yet aired" ? "upcoming" : "unknown";
  e.classification.genres = (d.genres ?? []).map((g: any) => g.name);
  e.classification.themes = (d.themes ?? []).map((g: any) => g.name);
  e.classification.demographics = (d.demographics ?? []).map((g: any) => g.name);
  e.classification.is_adult = d.rating?.includes("Rx") ?? null;
  e.classification.content_rating = d.rating ?? null;
  e.metrics.score = d.score ?? null;
  e.metrics.score_scale = d.scored_by ? 10 : null;
  e.metrics.votes = d.scored_by ?? null;
  e.metrics.rank = d.rank ?? null;
  e.metrics.popularity = d.popularity ?? null;
  e.metrics.members = d.members ?? null;
  e.metrics.favourites = d.favorites ?? null;
  e.technical.episode_runtime_minutes = d.duration ? parseInt(d.duration) || null : null;
  e.technical.runtime_minutes = e.technical.episode_runtime_minutes && d.episodes ? e.technical.episode_runtime_minutes * d.episodes : null;
  e.manga.chapters = undefined as any;
  e.episodes = [];
  e.technical.page_count = null;
  e.classification.tags = (d.tags ?? []).map((t: any) => ({ name: t.name, category: t.category }));
  e.media.trailers = d.trailer?.youtube_id ? [{ id: d.trailer.youtube_id, site: "youtube", url: d.trailer.url, thumbnail: d.trailer.images?.maximum_image_url }] : [];
  e.links = (d.external ?? []).map((l: any) => ({ url: l.url, site: l.name, kind: "external", is_official: true }));
  e.availability.streaming = (d.streaming ?? []).map((s: any) => ({ provider: s.name, url: s.url, kind: "subscription" as const }));
  e.credits = (d.studios ?? []).map((s: any) => ({ person: { id: `mal_studio_${s.mal_id}`, name: s.name, kind: "studio" as const, external_ids: { mal: [String(s.mal_id)] } }, role: "studio", voice: false, sources: [src("jikan", d.url)] }));
  for (const p of d.producers ?? []) e.companies.production.push({ id: `mal_prod_${p.mal_id}`, name: p.name, kind: "company", external_ids: { mal: [String(p.mal_id)] } });
  for (const l of d.licensors ?? []) e.companies.licensors.push({ id: `mal_lic_${l.mal_id}`, name: l.name, kind: "company", external_ids: { mal: [String(l.mal_id)] } });
  if (d.aired?.string) e.broadcast.time = d.aired.string ?? null;
  e.raw.jikan = d;
  e.score = (d.members ?? 0) / 1000 + (d.score ?? 0);
  tag(e, `type:${d.type}`);
  return e;
}

export const jikan: Provider = {
  id: "jikan", name: "Jikan (MyAnimeList)", domains: ["anime", "reading"], priority: 18,
  kinds: ["anime", "anime_movie", "manga"],
  operations: ["search", "get", "schedule", "episodes", "related"],
  auth: "none", base: BASE, license: "MAL data via Jikan; CC BY-SA for wiki text",
  freshness: "1h", homepage: "https://jikan.moe", notes: "MAL mirror. 3 rps, 60 rpm. Sometimes unreachable from some hosts.",
  async search(ctx, q) {
    const [anime, manga] = await Promise.all([
      fetchJson<any>(`${BASE}/anime?q=${encodeURIComponent(q)}&limit=${Math.min(ctx.limit, 25)}&sfw`, { provider: "jikan", ttlMs: 3600_000 }).catch(() => null),
      fetchJson<any>(`${BASE}/manga?q=${encodeURIComponent(q)}&limit=${Math.min(ctx.limit, 25)}&sfw`, { provider: "jikan", ttlMs: 3600_000 }).catch(() => null),
    ]);
    return [...(anime?.data?.data ?? []), ...(manga?.data?.data ?? [])].map(map);
  },
  async get(ctx, ref) {
    const id = ref.externalIds?.mal ?? ref.id;
    const kind = ref.kind === "manga" ? "manga" : "anime";
    const res = await fetchJson<any>(`${BASE}/${kind}/${id}/full`, { provider: "jikan", ttlMs: 3600_000 });
    return res.data.data ? map(res.data.data) : null;
  },
  async schedule(ctx, p) {
    const res = await fetchJson<any>(`${BASE}/schedules?start_date=${p.from.slice(0, 10)}&end_date=${p.to.slice(0, 10)}&sfw`, { provider: "jikan", ttlMs: 600_000 });
    return (res.data.data ?? []).map((d: any) => { const e = map(d); e.kind = "anime_episode"; return e; });
  },
  async episodes(ctx, id) {
    const res = await fetchJson<any>(`${BASE}/anime/${id}/episodes`, { provider: "jikan", ttlMs: 3600_000 });
    return (res.data.data ?? []).map((ep: any) => {
      const e = baseEntity("anime_episode", ep.title ?? `Episode ${ep.mal_id}`, "jikan", ep.url);
      addId(e, "mal", String(ep.mal_id));
      e.episodes = [{ id: `mal_ep_${ep.mal_id}`, number: ep.mal_id, title: ep.title, air_date: ep.aired, kind: "regular", sources: [src("jikan", ep.url)] }];
      return e;
    });
  },
  async related(ctx, id) {
    const res = await fetchJson<any>(`${BASE}/anime/${id}/relations`, { provider: "jikan", ttlMs: 3600_000 });
    return (res.data.data ?? []).flatMap((r: any) => r.entry ?? []).map((x: any) => {
      const e = baseEntity(x.type === "manga" ? "manga" : "anime", x.name, "jikan", x.url);
      addId(e, "mal", String(x.mal_id));
      return e;
    });
  },
};

export default jikan;
void list; void num;
