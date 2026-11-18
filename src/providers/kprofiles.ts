import { fetchText } from "../core/http.ts";
import type { Entity } from "../schema/entities.ts";
import { addId, baseEntity, decodeEntities, stripHtml } from "./_util.ts";
import type { Provider } from "./_types.ts";

const BASE = "https://kprofiles.com";
const HEADERS = { accept: "text/html,application/xhtml+xml", "accept-language": "en-US,en;q=0.9" };

function profile(html: string, slug: string): Entity {
  const title = decodeEntities(html.match(/<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/)?.[1]?.replace(/<[^>]+>/g, "") ?? slug.replace(/-/g, " "));
  const name = title.replace(/\s*Profile.*$/i, "").replace(/\s*\(.*?\)\s*/g, "").trim();
  const e = baseEntity(/member/i.test(title) ? "idol" : "idol_group", name, "kprofiles", `${BASE}/${slug}/`);
  addId(e, "kprofiles", slug);
  const entry = html.match(/<div class="entry-content">([\s\S]*?)<\/div>/)?.[1] ?? "";
  const text = stripHtml(entry);
  e.description.long = { en: text.slice(0, 6000) };
  e.description.short = { en: text.slice(0, 400) };
  e.images.profile = [...html.matchAll(/<img[^>]+src="([^"]+)"[^>]*>/g)].map((m) => m[1]).filter((u) => /kprofiles|wp-content/.test(u)).slice(0, 4);
  for (const [label, field] of [
    ["Stage Name", "stage_name"], ["Birth Name", "birth_name"], ["Korean Name", "korean_name"],
    ["Group", "group"], ["Position", "positions"], ["Birthday", "birthday"], ["Height", "height"],
    ["Weight", "weight"], ["Blood Type", "blood_type"], ["MBTI", "mbti"], ["Agency", "agency"],
    ["Debut", "debut"], ["Zodiac", "zodiac"],
  ] as const) {
    const m = text.match(new RegExp(`${label}:\\s*([^\\n]+)`, "i"));
    if (!m) continue;
    (e as any)[field] = m[1].trim();
    if (field === "group") e.person.member_of.push({ kind: "member", title: m[1].trim(), direction: "outgoing", sources: [] });
    if (field === "positions") e.person.positions = m[1].split(/[,/]/).map((s) => s.trim());
    if (field === "birthday") e.person.birthday = m[1].trim();
    if (field === "height") e.person.height_cm = parseInt(m[1]) || null;
    if (field === "weight") e.person.weight_kg = parseInt(m[1]) || null;
    if (field === "blood_type") e.person.blood_type = m[1].trim();
    if (field === "zodiac") e.person.zodiac = m[1].trim();
    if (field === "agency") e.person.agency = { name: m[1].trim(), kind: "company" };
  }
  if (/female/i.test(text)) e.person.gender = "female";
  else if (/male/i.test(text)) e.person.gender = "male";
  e.person.occupations = ["idol"];
  e.classification.genres = ["kpop"];
  e.raw.kprofiles = { slug, text: text.slice(0, 20_000) };
  return e;
}

export const kprofiles: Provider = {
  id: "kprofiles", name: "Kprofiles", domains: ["people"], priority: 45,
  kinds: ["idol", "idol_group", "person"],
  operations: ["search", "get"],
  auth: "none", base: BASE, license: "Kprofiles fan data",
  freshness: "7d", homepage: "https://kprofiles.com",
  notes: "K-pop idol/group profiles: stage name, birth, group, positions, facts.",
  async search(ctx, q) {
    const res = await fetchText(`${BASE}/?s=${encodeURIComponent(q)}`, { provider: "kprofiles", headers: HEADERS, ttlMs: 604_800_000 });
    const out: Entity[] = [];
    for (const m of res.data.matchAll(/<h2[^>]*class="[^"]*entry-title[^"]*"[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
      out.push(baseEntity("idol", stripHtml(m[2]), "kprofiles", m[1]));
    }
    return out.slice(0, ctx.limit);
  },
  async get(ctx, ref) {
    const slug = ref.externalIds?.kprofiles ?? ref.id;
    const res = await fetchText(`${BASE}/${encodeURIComponent(slug)}/`, { provider: "kprofiles", headers: HEADERS, ttlMs: 604_800_000, allowStatus: [404] });
    return res.data?.includes("entry-title") ? profile(res.data, slug) : null;
  },
};
export default kprofiles;
