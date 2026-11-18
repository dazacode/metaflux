import { fetchJson } from "../core/http.ts";
import type { Entity } from "../schema/entities.ts";
import { baseEntity, src, stripHtml } from "./_util.ts";
import type { Provider } from "./_types.ts";

const BASE = "https://en.wikipedia.org/w/api.php";
/** Search result -> heuristic kind. */
function guessKind(desc = "", title = ""): Entity["kind"] {
  const t = `${desc} ${title}`.toLowerCase();
  if (/anime|manga/.test(t)) return "anime";
  if (/film|movie/.test(t)) return "movie";
  if (/television series|tv series|sitcom/.test(t)) return "tv_show";
  if (/album/.test(t)) return "music_album";
  if (/song|single/.test(t)) return "music_track";
  if (/novel|book/.test(t)) return "book";
  if (/comic/.test(t)) return "comic";
  if (/footballer|basketball player|baseball player|athlete|racing driver/.test(t)) return "sports_player";
  if (/singer|rapper|musician|band|idol/.test(t)) return "music_artist";
  if (/vtube|virtual youtuber/.test(t)) return "vtuber";
  return "person";
}

export const wikipedia: Provider = {
  id: "wikipedia", name: "Wikipedia", domains: ["meta", "people"], priority: 55,
  kinds: ["movie", "tv_show", "anime", "manga", "book", "comic", "music_artist", "music_album", "music_track", "sports_player", "person", "vtuber", "idol", "award", "company"],
  operations: ["search", "get"],
  auth: "none", base: BASE, license: "CC BY-SA 4.0",
  freshness: "24h", homepage: "https://en.wikipedia.org",
  notes: "Descriptive fallback and biography source. MediaWiki Action API + REST summary.",
  async search(ctx, q) {
    const res = await fetchJson<any>(`${BASE}?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=${Math.min(ctx.limit, 20)}&format=json&origin=*`, { provider: "wikipedia", ttlMs: 86_400_000 });
    return (res.data.query?.search ?? []).map((r: any) => {
      const kind = guessKind(r.snippet, r.title);
      const e = baseEntity(kind, r.title, "wikipedia", `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, "_"))}`);
      e.description.short = { en: stripHtml(r.snippet) };
      e.urls.wikipedia = `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, "_"))}`;
      e.score = 10 - (r.position ?? 0);
      return e;
    });
  },
  async get(ctx, ref) {
    const title = ref.externalIds?.wikipedia ?? ref.id;
    const res = await fetchJson<any>(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`, { provider: "wikipedia", ttlMs: 86_400_000, allowStatus: [404] }).catch(() => null);
    if (!res?.data?.title) return null;
    const d = res.data;
    const e = baseEntity(guessKind(d.description, d.title), d.title, "wikipedia", d.content_urls?.desktop?.page);
    e.description.long = { en: d.extract ?? "" };
    e.description.short = { en: d.description ?? "" };
    e.images.poster = d.originalimage?.source ? [d.originalimage.source] : [];
    e.links.push({ url: d.content_urls?.desktop?.page, site: "wikipedia", kind: "reference", is_official: false });
    e.raw.wikipedia = d;
    return e;
  },
};

export default wikipedia;
void src;
