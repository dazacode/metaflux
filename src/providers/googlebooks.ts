import { fetchJson } from "../core/http.ts";
import type { Entity } from "../schema/entities.ts";
import { addId, baseEntity, stripHtml } from "./_util.ts";
import type { Provider } from "./_types.ts";

export const googlebooks: Provider = {
  id: "googlebooks", name: "Google Books", domains: ["reading"], priority: 26,
  kinds: ["book", "book_edition"],
  operations: ["search", "get"],
  auth: "none", base: "https://www.googleapis.com/books/v1", license: "Google Books API terms",
  freshness: "24h", homepage: "https://books.google.com",
  notes: "ISBN/industry identifiers, sale + access info, previews. Shared unkeyed quota.",
  async search(ctx, q) {
    const res = await fetchJson<any>(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=${Math.min(ctx.limit, 20)}&printType=books`, { provider: "googlebooks", ttlMs: 86_400_000, retries: 3 });
    return (res.data.items ?? []).map(map);
  },
  async get(ctx, ref) {
    const id = ref.externalIds?.googlebooks ?? ref.id;
    const res = await fetchJson<any>(`https://www.googleapis.com/books/v1/volumes/${id}`, { provider: "googlebooks", ttlMs: 86_400_000, allowStatus: [404] });
    return res.data?.id ? map(res.data) : null;
  },
};

function map(d: any): Entity {
  const v = d.volumeInfo ?? {};
  const e = baseEntity(/comic/i.test(v.printType ?? "") ? "comic" : "book", v.title ?? "Unknown", "googlebooks", v.infoLink);
  addId(e, "googlebooks", d.id);
  for (const id of v.industryIdentifiers ?? []) {
    if (id.type === "ISBN_13") addId(e, "isbn13", id.identifier);
    if (id.type === "ISBN_10") addId(e, "isbn10", id.identifier);
  }
  e.title.english = v.title;
  e.title.short = v.subtitle ?? null;
  e.description.long = { en: stripHtml(v.description ?? "") };
  e.description.synopsis = e.description.long;
  e.images.cover = [v.imageLinks?.extraLarge, v.imageLinks?.large, v.imageLinks?.thumbnail].filter(Boolean);
  e.literature.pages = v.pageCount ?? null;
  e.literature.publisher = undefined as any;
  e.literature.subjects = v.categories ?? [];
  e.literature.audience = v.maturityRating ?? null;
  e.literature.language = undefined as any;
  e.literature.binding = v.printType ?? null;
  e.literature.copyright = { status: d.accessInfo?.publicDomain ? "public-domain" : "in-copyright" };
  e.literature.fulltext_url = d.accessInfo?.webReaderLink ?? v.previewLink ?? null;
  e.technical.formats = Object.keys(d.accessInfo?.downloadLink ? { download: 1 } : {});
  e.metrics.score = v.averageRating ?? null;
  e.metrics.votes = v.ratingsCount ?? null;
  e.person.publisher = undefined as any;
  e.companies.publishers = v.publisher ? [{ name: v.publisher, kind: "publisher" }] : [];
  e.dates.start = v.publishedDate ? { year: Number(v.publishedDate.slice(0, 4)), date: v.publishedDate } : null;
  for (const a of v.authors ?? []) e.credits.push({ person: { name: a, kind: "person" }, role: "author", department: "crew", voice: false, sources: [] });
  e.language = undefined as any;
  e.technical.audio_languages = v.language ? [v.language] : [];
  e.raw.googlebooks = d;
  e.score = (v.ratingsCount ?? 0) / 100 + (v.averageRating ?? 0);
  return e;
}
export default googlebooks;
