import { fetchJson } from "../core/http.ts";
import type { Entity } from "../schema/entities.ts";
import { addId, baseEntity, stripHtml } from "./_util.ts";
import type { Provider } from "./_types.ts";

function map(d: any): Entity {
  const e = baseEntity("comic_series", d.name, "gcd", d.api_url ? `https:${d.api_url}` : "https://www.comics.org");
  addId(e, "gcd", String(d.id));
  e.title.english = d.name;
  e.description.long = { en: stripHtml(d.notes) };
  e.dates.start = d.year_began ? { year: d.year_began } : null;
  e.dates.end = d.year_ended ? { year: d.year_ended } : null;
  e.broadcast.country = d.country?.code ?? null;
  e.technical.audio_languages = d.language?.code ? [d.language.code] : [];
  e.technical.formats = [d.publishing_format?.name, d.color?.name, d.dimensions?.name, d.binding?.name, d.paper_stock?.name].filter(Boolean) as string[];
  e.publisher_cache = undefined as any;
  e.companies.publishers = d.publisher ? [{ name: d.publisher.name, kind: "publisher", external_ids: { gcd: [String(d.publisher.id)] } }] : [];
  e.metrics.issues = d.active_issues ?? null;
  e.technical.page_count = null;
  e.raw.gcd = d;
  e.score = (d.active_issues ?? 0) / 10;
  return e;
}

export const gcd: Provider = {
  id: "gcd", name: "Grand Comics Database", domains: ["reading"], priority: 44,
  kinds: ["comic", "comic_series", "comic_issue", "person", "publisher"],
  operations: ["search", "get", "related"],
  auth: "none", base: "https://www.comics.org/api", license: "GCD data (CC BY-SA where declared)",
  freshness: "30d", homepage: "https://www.comics.org",
  notes: "Publisher/series/issue/creator catalogue. WAF sometimes 403s; use JSON format.",
  async search(ctx, q) {
    const res = await fetchJson<any>(`https://www.comics.org/searchNew/?q=${encodeURIComponent(q)}&format=json`, { provider: "gcd", ttlMs: 2_592_000_000, retries: 2 }).catch(() => null);
    const rows = res?.data?.results ?? res?.data?.series ?? [];
    return rows.slice(0, ctx.limit).map(map);
  },
  async get(ctx, ref) {
    const id = ref.externalIds?.gcd ?? ref.id;
    const type = ref.kind === "comic_issue" ? "issue" : ref.kind === "publisher" ? "publisher" : "series";
    const res = await fetchJson<any>(`https://www.comics.org/api/${type}/${id}/?format=json`, { provider: "gcd", ttlMs: 2_592_000_000, allowStatus: [404] });
    return res.data?.id ? map(res.data) : null;
  },
  async related(ctx, id) {
    const res = await fetchJson<any>(`https://www.comics.org/api/series/${id}/issue/?format=json`, { provider: "gcd", ttlMs: 2_592_000_000 }).catch(() => null);
    return (res?.data?.results ?? []).map((i: any) => {
      const e = baseEntity("comic_issue", i.descriptor ?? `Issue ${i.number}`, "gcd");
      addId(e, "gcd", String(i.id));
      e.dates.start = i.key_date ? { date: i.key_date } : null;
      return e;
    });
  },
};
export default gcd;
