import { fetchJson } from "../core/http.ts";
import type { Entity } from "../schema/entities.ts";
import { addId, baseEntity, stripHtml } from "./_util.ts";
import type { Provider } from "./_types.ts";

const BASE = "https://api.comick.io";

function map(d: any): Entity {
  const e = baseEntity(d.country === "kr" ? "manhwa" : d.country === "zh" ? "manhua" : "comic", d.title ?? d.slug, "comick", `https://comick.io/comic/${d.slug}`);
  addId(e, "comick", d.hid ?? d.slug);
  if (d.md_covers?.[0]?.b2key) e.images.poster = [`https://meo.comick.pictures/${d.md_covers[0].b2key}`];
  e.description.long = { en: stripHtml(d.desc) };
  e.status.state = d.status === 1 ? "ongoing" : d.status === 2 ? "completed" : d.status === 3 ? "cancelled" : d.status === 4 ? "hiatus" : "unknown";
  e.classification.genres = (d.genres ?? []).map((g: any) => g.name ?? g);
  e.classification.demographics = (d.demographics ?? []).map((g: any) => g.name ?? g);
  e.metrics.score = d.rating ? Number(d.rating) : null;
  e.metrics.score_scale = 10;
  e.metrics.followers = d.follow_count ?? null;
  e.metrics.votes = d.rating_count ?? null;
  e.dates.start = d.year ? { year: d.year } : null;
  e.manga.original_language = d.country ?? null;
  e.manga.latest_chapter = d.last_chapter ? String(d.last_chapter) : null;
  for (const a of d.authors ?? []) e.credits.push({ person: { name: a.name, kind: "person" }, role: "author", department: "crew", voice: false, sources: [] });
  e.technical.page_count = null;
  e.links.push({ url: `https://comick.io/comic/${d.slug}`, site: "ComicK", kind: "reference" });
  e.raw.comick = d;
  e.score = (e.metrics.followers ?? 0) / 100;
  return e;
}

export const comick: Provider = {
  id: "comick", name: "ComicK", domains: ["reading"], priority: 32,
  kinds: ["comic", "comic_series", "manhwa", "manhua", "webtoon"],
  operations: ["search", "get", "chapters", "related"],
  auth: "none", base: BASE, license: "ComicK data",
  freshness: "10min", homepage: "https://comick.io",
  notes: "Manhwa/manhua/webtoon discovery with chapter feeds. Origin intermittently 522.",
  async search(ctx, q) {
    const res = await fetchJson<any>(`${BASE}/v1.0/search?q=${encodeURIComponent(q)}&limit=${Math.min(ctx.limit, 25)}`, { provider: "comick", ttlMs: 600_000 });
    return (res.data ?? []).map(map);
  },
  async get(ctx, ref) {
    const slug = ref.externalIds?.comick ?? ref.id;
    const res = await fetchJson<any>(`${BASE}/comic/${encodeURIComponent(slug)}?tachiyomi=true`, { provider: "comick", ttlMs: 600_000, allowStatus: [404] });
    return res.data?.comic ? map(res.data.comic) : null;
  },
  async chapters(ctx, id) {
    const res = await fetchJson<any>(`${BASE}/comic/${encodeURIComponent(id)}/chapters?lang=en&limit=300&chap-order=1`, { provider: "comick", ttlMs: 600_000 }).catch(() => null);
    return (res?.data ?? []).map((c: any) => {
      const e = baseEntity("comic_issue", `Chapter ${c.chap}`, "comick", `https://comick.io/comic/${id}/${c.hid}-chapter-${c.chap}`);
      e.chapters = [{ id: c.hid, number: c.chap, volume: c.vol, title: c.title, language: c.lang, published_at: c.created_at, sources: [] }];
      return e;
    });
  },
  async related(ctx, id) {
    const e = await this.get!(ctx, { id });
    return (e?.relations ?? []).map((r) => r.target).filter(Boolean) as Entity[];
  },
};
export default comick;
