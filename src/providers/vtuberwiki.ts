import { fetchJson } from "../core/http.ts";
import type { Entity } from "../schema/entities.ts";
import { addId, baseEntity, stripHtml } from "./_util.ts";
import type { Provider } from "./_types.ts";

const BASE = "https://virtualyoutuber.fandom.com/api.php";

function infobox(wikitext: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of wikitext.split("\n")) {
    const m = line.match(/^\|\s*([a-z_ ]+)\s*=\s*(.+)$/i);
    if (m) out[m[1].trim().toLowerCase().replace(/ /g, "_")] = stripHtml(m[2]);
  }
  return out;
}

export const vtuberWiki: Provider = {
  id: "vtuber-wiki", name: "Virtual YouTuber Wiki", domains: ["people"], priority: 48,
  kinds: ["vtuber", "vtuber_group", "person"],
  operations: ["search", "get"],
  auth: "none", base: BASE, license: "CC BY-SA 3.0",
  freshness: "7d", homepage: "https://virtualyoutuber.fandom.com",
  notes: "Lore, persona, debut, designers, units, socials from community wiki.",
  async search(ctx, q) {
    const res = await fetchJson<any>(`${BASE}?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=${Math.min(ctx.limit, 15)}&format=json&origin=*`, { provider: "vtuber-wiki", ttlMs: 604_800_000 });
    return (res.data.query?.search ?? []).map((r: any) => {
      const e = baseEntity("vtuber", r.title, "vtuber-wiki", `https://virtualyoutuber.fandom.com/wiki/${encodeURIComponent(r.title.replace(/ /g, "_"))}`);
      e.description.short = { en: stripHtml(r.snippet) };
      return e;
    });
  },
  async get(ctx, ref) {
    const page = ref.externalIds?.vtuber_wiki ?? ref.id;
    const res = await fetchJson<any>(`${BASE}?action=parse&page=${encodeURIComponent(page)}&prop=wikitext|text&format=json&origin=*`, { provider: "vtuber-wiki", ttlMs: 604_800_000, allowStatus: [404] });
    if (!res.data.parse) return null;
    const wikitext: string = res.data.parse.wikitext?.["*"] ?? "";
    const box = infobox(wikitext);
    const e = baseEntity("vtuber", res.data.parse.title, "vtuber-wiki", `https://virtualyoutuber.fandom.com/wiki/${encodeURIComponent(page)}`);
    addId(e, "vtuber_wiki", page);
    e.vtuber.org = box["organization"] ?? box["affiliation"] ?? null;
    e.vtuber.group = box["unit"] ?? box["group"] ?? null;
    e.vtuber.debut_date = box["debut_date"] ?? box["debut"] ?? null;
    e.vtuber.graduation_date = box["graduation_date"] ?? null;
    e.vtuber.birthday = box["birthday"] ?? null;
    e.images.profile = [box["image"]].filter(Boolean);
    e.vtuber.character_designer = box["character_designer"] ? [{ name: box["character_designer"], kind: "person" }] : [];
    e.vtuber.character_modeler = box["character_modeler"] ? [{ name: box["character_modeler"], kind: "person" }] : [];
    e.vtuber.hashtags = Object.fromEntries(Object.entries(box).filter(([k]) => k.startsWith("hashtag")).map(([k, v]) => [k.replace("hashtag_", ""), [v]]));
    e.vtuber.catchphrases = box["catchphrase"] ? [box["catchphrase"]] : [];
    e.vtuber.fan_name = box["fan_name"] ?? null;
    e.vtuber.height_cm = box["height"] ? parseInt(box["height"]) || null : null;
    e.person.gender = box["gender"] ?? null;
    e.person.birthday = e.vtuber.birthday;
    e.person.height_cm = e.vtuber.height_cm;
    e.person.socials = Object.fromEntries(Object.entries(box).filter(([k]) => ["twitter", "youtube", "twitch", "instagram", "tiktok"].includes(k)));
    e.description.long = { en: stripHtml(res.data.parse.text?.["*"] ?? "").slice(0, 4000) };
    e.vtuber.lore = e.description.long;
    e.raw.vtuber_wiki = { wikitext: wikitext.slice(0, 20_000) };
    return e;
  },
};
export default vtuberWiki;
