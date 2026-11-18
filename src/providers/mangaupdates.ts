import { postJson, fetchJson } from "../core/http.ts";
import type { Entity } from "../schema/entities.ts";
import { addId, baseEntity, stripHtml } from "./_util.ts";
import type { Provider } from "./_types.ts";

function map(d: any): Entity {
  const t = d.record ?? d;
  const e = baseEntity(t.type?.includes("Manhwa") ? "manhwa" : t.type?.includes("Manhua") ? "manhua" : "manga", t.title, "mangaupdates", t.url);
  addId(e, "mangaupdates", String(t.series_id));
  e.description.long = { en: stripHtml(t.description) };
  e.images.poster = t.image?.url?.original ? [t.image.url.original] : [];
  e.dates.start = t.year ? { year: t.year } : null;
  e.metrics.score = t.bayesian_rating ?? null;
  e.metrics.score_scale = 10;
  e.metrics.votes = t.rating_votes ?? null;
  e.classification.genres = (t.genres ?? []).map((g: any) => g.genre ?? g);
  e.dates.added = t.last_updated ? { date: t.last_updated } : null;
  e.links.push({ url: t.url, site: "MangaUpdates", kind: "reference" });
  for (const p of t.publishers ?? []) e.companies.publishers.push({ name: p.publisher_name ?? p, kind: "publisher" });
  for (const a of t.authors ?? []) e.credits.push({ person: { id: `mu_author_${a.author_id}`, name: a.name, kind: "person", external_ids: { mangaupdates: [String(a.author_id)] } }, role: a.type ?? "author", department: "crew", voice: false, sources: [] });
  e.manga.original_language = t.type?.includes("Manhwa") ? "ko" : t.type?.includes("Manhua") ? "zh" : "ja";
  e.manga.chapters = undefined as any;
  e.raw.mangaupdates = d;
  e.score = (t.bayesian_rating ?? 0) * 10 + (t.rating_votes ?? 0) / 1000;
  return e;
}

export const mangaupdates: Provider = {
  id: "mangaupdates", name: "MangaUpdates", domains: ["reading"], priority: 28,
  kinds: ["manga", "manhwa", "manhua"],
  namespaces: ["mangaupdates"], scopes: ["manga"],
  operations: ["search", "get", "related"],
  auth: "none", base: "https://api.mangaupdates.com/v1", license: "MangaUpdates data",
  freshness: "24h", homepage: "https://www.mangaupdates.com",
  notes: "Series metadata, genres, ratings, publishers, author credits.",
  async search(ctx, q) {
    const res = await postJson<any>("https://api.mangaupdates.com/v1/series/search", { search: q, perpage: Math.min(ctx.limit, 25), page: 1 }, { provider: "mangaupdates", ttlMs: 86_400_000 });
    return (res.data.results ?? []).map(map);
  },
  async get(ctx, ref) {
    const id = ref.externalIds?.mangaupdates ?? ref.id;
    const res = await fetchJson<any>(`https://api.mangaupdates.com/v1/series/${id}`, { provider: "mangaupdates", ttlMs: 86_400_000, allowStatus: [404] });
    return res.data?.series_id ? map(res.data) : null;
  },
  async related(ctx, id) {
    const res = await fetchJson<any>(`https://api.mangaupdates.com/v1/series/${id}/relations`, { provider: "mangaupdates", ttlMs: 86_400_000 }).catch(() => null);
    return (res?.data ?? []).map((r: any) => {
      const e = baseEntity("manga", r.relation?.series_name ?? r.series_name ?? "Related", "mangaupdates", r.relation?.url);
      if (r.relation?.series_id) addId(e, "mangaupdates", String(r.relation.series_id));
      return e;
    });
  },
};
export default mangaupdates;
