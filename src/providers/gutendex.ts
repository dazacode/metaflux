import { fetchJson, postJson } from "../core/http.ts";
import { stripHtml, addId, baseEntity } from "./_util.ts";
import type { Provider } from "./_types.ts";
import type { Entity } from "../schema/entities.ts";

export const gutendex: Provider = {
  id: "gutendex", name: "Gutendex (Project Gutenberg)", domains: ["reading"], priority: 34,
  kinds: ["book", "audiobook", "short_story", "poem"],
  operations: ["search", "get"],
  auth: "none", base: "https://gutendex.com", license: "Project Gutenberg public domain",
  freshness: "7d", homepage: "https://gutendex.com",
  notes: "Public-domain full text with all download formats.",
  async search(ctx, q) {
    const res = await fetchJson<any>(`https://gutendex.com/books?search=${encodeURIComponent(q)}`, { provider: "gutendex", ttlMs: 604_800_000 });
    return (res.data.results ?? []).slice(0, ctx.limit).map(map);
  },
  async get(ctx, ref) {
    const id = ref.externalIds?.gutenberg ?? ref.id;
    const res = await fetchJson<any>(`https://gutendex.com/books/${id}`, { provider: "gutendex", ttlMs: 604_800_000, allowStatus: [404] });
    return res.data?.id ? map(res.data) : null;
  },
};

function map(d: any): Entity {
  const e = baseEntity("book", d.title, "gutendex", `https://www.gutenberg.org/ebooks/${d.id}`);
  addId(e, "gutenberg", String(d.id));
  e.title.english = d.title;
  e.description.short = { en: Object.values(d.summaries ?? {}).join(" ").slice(0, 2000) };
  e.literature.subjects = d.subjects ?? [];
  e.literature.copyright = { status: d.copyright ? "copyright" : "public-domain", license: "Project Gutenberg License" };
  e.literature.fulltext_url = d.formats?.["text/html"] ?? d.formats?.["text/plain; charset=utf-8"] ?? null;
  e.technical.formats = Object.keys(d.formats ?? {});
  e.technical.page_count = null;
  e.images.cover = [d.formats?.["image/jpeg"]].filter(Boolean);
  e.metrics.downloads = d.download_count ?? null;
  e.classification.genres = d.bookshelves ?? [];
  for (const a of d.authors ?? []) {
    e.credits.push({ person: { id: `gutenberg_author_${a.name}`, name: a.name, kind: "person", external_ids: a.birth_year ? {} : {} }, role: "author", department: "crew", voice: false, sources: [] });
    if (a.birth_year) e.dates.start = e.dates.start ?? { year: a.birth_year };
  }
  if (d.languages) e.technical.audio_languages = d.languages;
  e.raw.gutendex = d;
  e.score = (d.download_count ?? 0) / 1000;
  return e;
}
void stripHtml; void postJson;
export default gutendex;
