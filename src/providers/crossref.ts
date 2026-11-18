import { fetchJson } from "../core/http.ts";
import type { Entity } from "../schema/entities.ts";
import { addId, baseEntity } from "./_util.ts";
import type { Provider } from "./_types.ts";

const BASE = "https://api.crossref.org";

function map(d: any): Entity {
  const kind = d.type === "book" ? "book" : d.type === "book-chapter" ? "book_edition" : d.type === "posted-content" ? "short_story" : "book";
  const title = (Array.isArray(d.title) ? d.title[0] : d.title) || "Untitled";
  const e = baseEntity(kind, title, "crossref", d.URL);
  addId(e, "doi", d.DOI);
  e.title.english = title;
  e.description.long = { en: (Array.isArray(d.abstract) ? d.abstract[0] : d.abstract) ?? "" };
  e.dates.start = d.issued?.date_parts?.[0]?.length ? { year: d.issued.date_parts[0][0] } : null;
  e.literature.publisher = undefined as any;
  e.companies.publishers = (d.publisher ? [{ name: d.publisher, kind: "publisher" as const }] : []);
  for (const a of d.author ?? []) e.credits.push({ person: { name: [a.given, a.family].filter(Boolean).join(" ") || a.name || "Unknown", kind: "person", external_ids: a.ORCID ? { orcid: [a.ORCID] } : {} }, role: "author", department: "crew", voice: false, sources: [] });
  e.literature.isbn13 = d.ISBN?.filter((x: string) => x.length === 13) ?? [];
  e.literature.isbn10 = d.ISBN?.filter((x: string) => x.length === 10) ?? [];
  e.literature.issn = d.ISSN ?? [];
  e.literature.doi = [d.DOI];
  e.literature.pages = d["page-count"] ?? null;
  e.literature.copyright = { license: d.license?.map((l: any) => l.URL).join(", ") ?? null };
  e.classification.genres = d.subject ?? [];
  e.metrics.votes = d["is-referenced-by-count"] ?? null;
  e.technical.page_count = d["page-count"] ?? null;
  e.raw.crossref = d;
  e.score = (d["is-referenced-by-count"] ?? 0) / 100;
  return e;
}

export const crossref: Provider = {
  id: "crossref", name: "Crossref", domains: ["reading"], priority: 46,
  kinds: ["book", "book_edition", "short_story"],
  operations: ["search", "get", "related"],
  auth: "none", base: BASE, license: "Crossref metadata; CC0 where declared",
  freshness: "7d", homepage: "https://www.crossref.org",
  notes: "DOI-rich scholarly books, chapters and papers with references.",
  async search(ctx, q) {
    const res = await fetchJson<any>(`${BASE}/works?query=${encodeURIComponent(q)}&rows=${Math.min(ctx.limit, 20)}`, { provider: "crossref", ttlMs: 604_800_000 });
    return (res.data.message?.items ?? []).map(map);
  },
  async get(ctx, ref) {
    const doi = ref.externalIds?.doi ?? ref.id;
    const res = await fetchJson<any>(`${BASE}/works/${encodeURIComponent(doi)}`, { provider: "crossref", ttlMs: 604_800_000, allowStatus: [404] });
    return res.data?.message ? map(res.data.message) : null;
  },
  async related(ctx, id) {
    const e = await this.get!(ctx, { id });
    const refs = (e?.raw.crossref?.reference ?? []) as any[];
    return refs.slice(0, 10).map((r) => {
      const x = baseEntity("book", r["article-title"] ?? r.unstructured ?? r.DOI ?? "Reference", "crossref");
      if (r.DOI) addId(x, "doi", r.DOI);
      return x;
    });
  },
};
export default crossref;
