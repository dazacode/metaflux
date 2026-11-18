import { fetchJson } from "../core/http.ts";
import type { Entity } from "../schema/entities.ts";
import { addId, baseEntity, list, stripHtml } from "./_util.ts";
import type { Provider } from "./_types.ts";

function map(d: any): Entity {
  const kind = /comic/i.test(d.mediatype) ? "comic" : /audio|etree/i.test(d.mediatype) ? "audiobook" : /movie|video/i.test(d.mediatype) ? "movie" : "book";
  const e = baseEntity(kind, d.title, "internetarchive", `https://archive.org/details/${d.identifier}`);
  addId(e, "internetarchive", d.identifier);
  e.title.english = d.title;
  e.title.aliases = list(d.alternative_title ?? d.alt_title);
  e.description.long = { en: stripHtml(d.description) };
  e.description.short = { en: stripHtml(d.description).slice(0, 400) };
  e.images.thumbnail = d.identifier ? [`https://archive.org/services/img/${d.identifier}`] : [];
  e.images.cover = e.images.thumbnail;
  e.literature.ia_identifier = d.identifier;
  e.literature.subjects = list(d.subject);
  e.literature.pages = Number(d.imagecount) || null;
  e.literature.copyright = { license: d.licenseurl ?? d.rights ?? null, status: d.possible_copyright_status ?? null };
  e.literature.fulltext_url = `https://archive.org/download/${d.identifier}`;
  e.dates.start = d.date ? { date: String(d.date).slice(0, 10) } : null;
  e.companies.publishers = list(d.publisher).map((p) => ({ name: p, kind: "publisher" as const }));
  for (const a of [...list(d.creator)]) e.credits.push({ person: { name: a, kind: "person" }, role: "creator", department: "crew", voice: false, sources: [] });
  e.technical.formats = list(d.format);
  e.metrics.downloads = Number(d.downloads) || null;
  e.classification.genres = list(d.collection);
  e.technical.audio_languages = list(d.language);
  e.raw.internetarchive = d;
  e.score = (e.metrics.downloads ?? 0) / 10_000;
  return e;
}

export const internetarchive: Provider = {
  id: "internetarchive", name: "Internet Archive", domains: ["reading", "screen", "music"], priority: 38,
  kinds: ["book", "comic", "audiobook", "movie", "music_track"],
  operations: ["search", "get", "related"],
  auth: "none", base: "https://archive.org", license: "mixed; per-item rights",
  freshness: "24h", homepage: "https://archive.org",
  notes: "Scans, comics, old time radio, film. Per-item rights and lending state.",
  async search(ctx, q) {
    const fields = "identifier,title,creator,description,subject,mediatype,format,language,publisher,date,licenseurl,rights,downloads,collection,imagecount";
    const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=${fields.split(",").join("&fl[]=")}&rows=${Math.min(ctx.limit, 25)}&output=json&sort[]=downloads+desc`;
    const res = await fetchJson<any>(url, { provider: "internetarchive", ttlMs: 86_400_000 });
    return (res.data.response?.docs ?? []).map(map);
  },
  async get(ctx, ref) {
    const id = ref.externalIds?.internetarchive ?? ref.id;
    const res = await fetchJson<any>(`https://archive.org/metadata/${id}`, { provider: "internetarchive", ttlMs: 86_400_000, allowStatus: [404] });
    const meta = res.data?.metadata;
    if (!meta?.title) return null;
    const e = map({ ...meta, identifier: id });
    for (const f of res.data.files ?? []) {
      if (/\.(pdf|epub|cbz|cbr|mp3|flac|mp4|mkv)$/i.test(f.name)) e.availability.downloads.push({ provider: "internetarchive", url: `https://archive.org/download/${id}/${f.name}`, kind: "download", quality: f.format ?? null });
    }
    return e;
  },
  async related(ctx, id) {
    const e = await this.get!(ctx, { id });
    return (e?.literature.subjects ?? []).slice(0, 8).map((s) => baseEntity("book", s, "internetarchive"));
  },
};
export default internetarchive;
