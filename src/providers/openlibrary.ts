import { fetchJson } from "../core/http.ts";
import type { Entity } from "../schema/entities.ts";
import { addId, baseEntity, src, tag } from "./_util.ts";
import type { Provider } from "./_types.ts";

const BASE = "https://openlibrary.org";
const COVER = "https://covers.openlibrary.org/b";

function map(d: any): Entity {
  const e = baseEntity("book", d.title, "openlibrary", `${BASE}${d.key}`);
  addId(e, "openlibrary", d.key);
  e.title.aliases = d.alternative_title ?? [];
  e.title.english = d.title;
  e.authors_cache = undefined as any;
  for (const name of d.author_name ?? []) e.credits.push({ person: { name, kind: "person" }, role: "author", department: "crew", voice: false, sources: [] });
  for (const key of d.author_key ?? []) e.credits.push({ person: { id: key, name: nameFor(key, d), kind: "person", external_ids: { openlibrary: [key] } }, role: "author", department: "crew", voice: false, sources: [] });
  e.dates.start = d.first_publish_year ? { year: d.first_publish_year } : null;
  e.literature.edition = d.edition_key?.[0] ?? null;
  e.literature.subjects = [...(d.subject ?? []), ...(d.person ?? []), ...(d.place ?? [])].slice(0, 80);
  e.literature.ia_identifier = d.ia?.[0] ?? null;
  e.literature.pages = d.number_of_pages_median ?? null;
  e.literature.lending = d.lending_edition_s ? { available: true, status: "borrowable", url: `${BASE}/borrow/${d.lending_edition_s}` } : null;
  e.literature.copyright = { status: d.public_scan_b ? "public_scan" : d.has_fulltext ? "fulltext" : "unknown" };
  if (d.cover_i) e.images.cover = [`${COVER}/id/${d.cover_i}-L.jpg`];
  if (d.isbn) { e.literature.isbn13 = d.isbn.filter((x: string) => x.length === 13); e.literature.isbn10 = d.isbn.filter((x: string) => x.length === 10); }
  e.metrics.edition_count = d.edition_count ?? null;
  e.metrics.popularity = d.edition_count ?? null;
  e.urls.openlibrary = `${BASE}${d.key}`;
  e.raw.openlibrary = d;
  tag(e, d.ebook_access ? `access:${d.ebook_access}` : "access:unknown");
  e.score = (d.edition_count ?? 0) / 100 + (d.has_fulltext ? 5 : 0);
  return e;
}
function nameFor(_key: string, _d: any) { return "Unknown author"; }

export const openlibrary: Provider = {
  id: "openlibrary", name: "Open Library", domains: ["reading"], priority: 12,
  kinds: ["book", "book_edition", "audiobook", "person", "publisher"],
  operations: ["search", "get", "discover", "people", "related"],
  auth: "none", base: BASE, license: "Open Library data; covers vary",
  freshness: "24h", homepage: "https://openlibrary.org",
  notes: "Work/edition/author/subject graph, cover ids, IA scans, lending status.",
  async search(ctx, q) {
    const res = await fetchJson<any>(`${BASE}/search.json?q=${encodeURIComponent(q)}&limit=${Math.min(ctx.limit, 25)}&fields=key,title,author_name,author_key,first_publish_year,cover_i,edition_key,edition_count,isbn,ia,has_fulltext,public_scan_b,ebook_access,subject,person,place,lending_edition_s,number_of_pages_median`, { provider: "openlibrary", ttlMs: 86_400_000 });
    return (res.data.docs ?? []).map(map);
  },
  async get(ctx, ref) {
    const key = ref.externalIds?.openlibrary ?? (ref.id.startsWith("/") ? ref.id : `/${ref.id}`);
    const res = await fetchJson<any>(`${BASE}${key}.json`, { provider: "openlibrary", ttlMs: 86_400_000, allowStatus: [404] });
    const d = res.data;
    if (!d?.title) return null;
    const e = map({ ...d, key });
    const authors = await fetchJson<any>(`${BASE}${key}/editions.json?limit=20`, { provider: "openlibrary", ttlMs: 86_400_000 }).catch(() => null);
    for (const ed of authors?.data?.entries ?? []) {
      e.literature.isbn13.push(...(ed.isbn_13 ?? []));
      e.literature.isbn10.push(...(ed.isbn_10 ?? []));
      if (ed.covers?.[0]) e.images.cover.push(`${COVER}/id/${ed.covers[0]}-L.jpg`);
      if (ed.number_of_pages) e.literature.pages = e.literature.pages ?? ed.number_of_pages;
      if (ed.publishers) e.companies.publishers.push(...ed.publishers.map((p: string) => ({ name: p, kind: "publisher" as const })));
    }
    return e;
  },
  async discover(ctx, p) {
    const q = [p.genre ? `subject:"${p.genre}"` : "", p.year ? `first_publish_year:${p.year}` : ""].filter(Boolean).join(" ") || "drama";
    const res = await fetchJson<any>(`${BASE}/search.json?q=${encodeURIComponent(q)}&limit=${Math.min(ctx.limit, 25)}&sort=editions`, { provider: "openlibrary", ttlMs: 86_400_000 });
    return (res.data.docs ?? []).map(map);
  },
  async people(ctx, id) {
    const res = await fetchJson<any>(`${BASE}/authors/${id}/works.json?limit=30`, { provider: "openlibrary", ttlMs: 86_400_000, allowStatus: [404] }).catch(() => null);
    return (res?.data?.entries ?? []).map((w: any) => {
      const e = baseEntity("book", w.title, "openlibrary", `${BASE}${w.key}`);
      addId(e, "openlibrary", w.key);
      return e;
    });
  },
  async related(ctx, id) {
    const e = await this.get!(ctx, { id });
    return e ? (e.literature.subjects ?? []).slice(0, 10).map((s) => {
      const x = baseEntity("book", s, "openlibrary");
      return x;
    }) : [];
  },
};
export default openlibrary;
void src;
