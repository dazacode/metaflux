import { fetchText } from "../core/http.ts";
import type { Entity } from "../schema/entities.ts";
import { addId, baseEntity, decodeEntities, src, stripHtml, tag } from "./_util.ts";
import type { Provider } from "./_types.ts";

const BASE = "https://mydramalist.com";
const HEADERS = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "upgrade-insecure-requests": "1",
};

function countryOf(typeLine: string): string | null {
  if (/Korean/i.test(typeLine)) return "KR";
  if (/Chinese/i.test(typeLine)) return "CN";
  if (/Japanese/i.test(typeLine)) return "JP";
  if (/Thai/i.test(typeLine)) return "TH";
  if (/Filipino|Pinoy/i.test(typeLine)) return "PH";
  if (/Taiwanese/i.test(typeLine)) return "TW";
  return null;
}

function searchCards(html: string): { id: string; slug: string; title: string; image: string | null; meta: string; rank: number | null; score: number | null; synopsis: string }[] {
  const out: any[] = [];
  const cardRe = /<div id="mdl-(\d+)"[\s\S]*?<a class="block" href="\/([^"]+)"[\s\S]*?data-src="([^"]+)"[\s\S]*?alt="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = cardRe.exec(html))) {
    const tail = html.slice(m.index, m.index + 3000);
    const meta = tail.match(/<span class="text-muted">([\s\S]*?)<\/span>/)?.[1] ?? "";
    const rank = tail.match(/<div class="ranking pull-right"><span>#(\d+)<\/span>/)?.[1];
    const score = tail.match(/class="score">([\d.]+)<\/span>/)?.[1];
    const syn = tail.match(/<p>([\s\S]*?)<\/p>/)?.[1] ?? "";
    out.push({ id: m[1], slug: m[2], image: m[3], title: decodeEntities(m[4]), meta: stripHtml(meta), rank: rank ? Number(rank) : null, score: score ? Number(score) / 10 : null, synopsis: stripHtml(syn) });
  }
  return out;
}

function detail(html: string, id: string, slug: string): Entity {
  const title = decodeEntities(html.match(/<h1[^>]*class="[^"]*film-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/)?.[1]?.replace(/<[^>]+>/g, "") ?? html.match(/<meta property="og:title" content="([^"]*)"/)?.[1] ?? slug);
  const e = baseEntity(/movie/i.test(html) && /movie-details/i.test(html) ? "movie" : "tv_show", title.trim(), "mydramalist", `${BASE}/${id}-${slug}`);
  addId(e, "mdl", id);
  const og = html.match(/<meta property="og:description" content="([^"]*)"/)?.[1];
  const synopsis = html.match(/<div class="show-synopsis">([\s\S]*?)<\/div>/)?.[1];
  e.description.long = { en: stripHtml(synopsis ?? og ?? "") };
  e.description.synopsis = e.description.long;
  e.images.poster = [html.match(/<meta property="og:image" content="([^"]*)"/)?.[1]].filter(Boolean) as string[];
  e.title.native = decodeEntities(html.match(/<b class="inline">Native Title:<\/b>\s*<a[^>]*>([^<]*)<\/a>/)?.[1] ?? "") || null;
  const aka = html.match(/<span class="mdl-aka-titles">([\s\S]*?)<\/span>/)?.[1] ?? "";
  e.title.aliases = aka.split(/,|\n/).map((s) => decodeEntities(s.trim())).filter(Boolean);
  const typeLine = stripHtml(html.match(/<li[^>]*><b class="inline">Type:<\/b>([\s\S]*?)<\/li>/)?.[1] ?? "");
  const countryLine = stripHtml(html.match(/<li[^>]*><b class="inline">Country:<\/b>([\s\S]*?)<\/li>/)?.[1] ?? "");
  e.broadcast.country = countryOf(typeLine) ?? (countryLine ? countryLine.slice(0, 2).toUpperCase() : null);
  const date = html.match(/<b class="inline">Aired:<\/b>\s*<span[^>]*>([^<]*)<\/span>/)?.[1] ?? html.match(/<b class="inline">Released:<\/b>\s*([^<]*)</)?.[1] ?? "";
  const dm = date.match(/(\d{4})/);
  if (dm) e.dates.start = { year: Number(dm[1]) };
  const eps = Number(stripHtml(html.match(/<b class="inline">Episodes:<\/b>\s*([^<]*)</)?.[1] ?? "").replace(/\D/g, ""));
  if (eps) e.technical.episode_runtime_minutes = null, e.technical.runtime_minutes = eps;
  const dur = Number(stripHtml(html.match(/<b class="inline">Duration:<\/b>\s*([^<]*)</)?.[1] ?? "").replace(/\D/g, ""));
  if (dur) e.technical.episode_runtime_minutes = dur;
  for (const g of html.matchAll(/<li class="list-item[^"]*show-genres">([\s\S]*?)<\/li>/g)) {
    e.classification.genres = [...g[1].matchAll(/<a[^>]*>([^<]+)<\/a>/g)].map((x) => decodeEntities(x[1]));
  }
  for (const t of html.matchAll(/<li class="list-item[^"]*show-tags">([\s\S]*?)<\/li>/g)) {
    e.classification.tags = [...t[1].matchAll(/<a[^>]*>([^<]+)<\/a>/g)].filter((x) => !/Vote tags/.test(x[1])).map((x) => ({ name: decodeEntities(x[1]) }));
  }
  const score = Number(html.match(/"ratingValue">([\d.]+)</)?.[1]);
  if (Number.isFinite(score)) { e.metrics.score = score; e.metrics.score_scale = 10; }
  const voters = Number(html.match(/from ([\d,]+) users/)?.[1]?.replace(/,/g, ""));
  if (voters) e.metrics.votes = voters;
  const watchers = Number(html.match(/# of Watchers: <b>([\d,]+)</)?.[1]?.replace(/,/g, ""));
  if (watchers) { e.metrics.popularity = watchers; e.metrics.followers = watchers; }
  const rank = Number(html.match(/Ranked <span>#(\d+)</)?.[1]);
  if (rank) e.metrics.rank = rank;
  for (const [label, role] of [["Director", "director"], ["Screenwriter", "writer"]] as const) {
    const block = html.match(new RegExp(`<b class="inline">${label}:</b>([\\s\\S]*?)</li>`))?.[1] ?? "";
    for (const p of block.matchAll(/<a class="text-primary" href="\/people\/([^"]+)">([^<]+)<\/a>/g)) {
      e.credits.push({ person: { id: `mdl_person_${p[1].split("-")[0]}`, name: decodeEntities(p[2]), kind: "person", external_ids: { mdl: [p[1].split("-")[0]] } }, role, department: "crew", voice: false, sources: [src("mydramalist", `${BASE}/people/${p[1]}`)] });
    }
  }
  for (const c of html.matchAll(/<a class="text-primary" href="\/people\/([^"]+)">([^<]+)<\/a>/g)) {
    const name = decodeEntities(c[2]);
    if (e.credits.some((x) => x.person.name === name)) continue;
    e.credits.push({ person: { id: `mdl_person_${c[1].split("-")[0]}`, name, kind: "person", external_ids: { mdl: [c[1].split("-")[0]] } }, role: "cast", department: "cast", voice: false, sources: [] });
  }
  for (const ep of html.matchAll(/href="\/(\d+)-[^"]*\/episodes"/g)) addId(e, "mdl_episodes", ep[1]);
  e.links.push({ url: `${BASE}/${id}-${slug}`, site: "MyDramaList", kind: "reference" });
  e.raw.mydramalist = { id, html: html.slice(0, 120_000) };
  tag(e, "region:asia");
  e.score = (score ?? 0) * 5 + (watchers ?? 0) / 10_000;
  return e;
}

export const mydramalist: Provider = {
  id: "mydramalist", name: "MyDramaList", domains: ["screen"], priority: 30,
  kinds: ["tv_show", "movie", "tv_episode", "person"],
  operations: ["search", "get", "episodes", "people", "schedule"],
  auth: "none", base: BASE, license: "MyDramaList community data",
  freshness: "12h", homepage: "https://mydramalist.com",
  notes: "K/C/J/Thai drama catalogue with cast, synopsis, ratings. Browser headers are required.",
  async search(ctx, q) {
    const res = await fetchText(`${BASE}/search?q=${encodeURIComponent(q)}`, { provider: "mydramalist", headers: HEADERS, ttlMs: 43_200_000 });
    return searchCards(res.data).slice(0, ctx.limit).map((c) => {
      const e = baseEntity("tv_show", c.title, "mydramalist", `${BASE}/${c.id}-${c.slug}`);
      addId(e, "mdl", c.id);
      e.description.short = { en: c.synopsis };
      e.images.poster = c.image ? [c.image] : [];
      e.metrics.score = c.score;
      e.metrics.rank = c.rank;
      e.score = 20 - (c.rank ?? 100) / 100;
      return e;
    });
  },
  async get(ctx, ref) {
    const idSlug = ref.externalIds?.mdl ?? ref.id;
    const id = idSlug.split("-")[0];
    if (!/^\d+$/.test(id)) return null;
    const res = await fetchText(`${BASE}/${idSlug}`, { provider: "mydramalist", headers: HEADERS, ttlMs: 43_200_000 });
    return detail(res.data, id, idSlug);
  },
  async episodes(ctx, id) {
    const res = await fetchText(`${BASE}/${id}/episodes`, { provider: "mydramalist", headers: HEADERS, ttlMs: 43_200_000 });
    const out: Entity[] = [];
    for (const m of res.data.matchAll(/<h3[^>]*class="[^"]*episode-title[^"]*"[^>]*>([\s\S]*?)<\/h3>/g)) {
      const title = stripHtml(m[1]);
      const e = baseEntity("tv_episode", title, "mydramalist");
      e.episodes = [{ id: `${id}_${out.length + 1}`, number: out.length + 1, title }];
      out.push(e);
    }
    return out;
  },
  async people(ctx, id) {
    const res = await fetchText(`${BASE}/${id}/cast`, { provider: "mydramalist", headers: HEADERS, ttlMs: 43_200_000 }).catch(() => null);
    if (!res) return [];
    const out: Entity[] = [];
    for (const c of res.data.matchAll(/<a class="text-primary" href="\/people\/([^"]+)">([^<]+)<\/a>/g)) {
      const e = baseEntity("person", decodeEntities(c[2]), "mydramalist", `${BASE}/people/${c[1]}`);
      addId(e, "mdl", c[1].split("-")[0]);
      out.push(e);
    }
    return out;
  },
  async schedule(ctx, p) {
    const res = await fetchText(`${BASE}/episode-calendar?d=${p.from.slice(0, 10)}`, { provider: "mydramalist", headers: HEADERS, ttlMs: 3_600_000 });
    return searchCards(res.data).map((c) => {
      const e = baseEntity("tv_episode", c.title, "mydramalist", `${BASE}/${c.id}-${c.slug}`);
      addId(e, "mdl", c.id);
      return e;
    });
  },
};

export default mydramalist;
