import { fetchJson } from "../core/http.ts";
import type { Entity, Kind } from "../schema/entities.ts";
import { addId, baseEntity, dateParts, src } from "./_util.ts";
import type { Provider } from "./_types.ts";

const WD = "https://www.wikidata.org";
const SPARQL = "https://query.wikidata.org/sparql";

/** P31/P279 instance -> MetaFlux kind. */
const INSTANCE_KIND: Record<string, Kind> = {
  Q11424: "movie", Q24856: "movie", Q202866: "movie", Q506240: "tv_show", Q5398426: "tv_show",
  Q1107: "anime", Q220898: "anime", Q63952888: "anime", Q21198342: "manga", Q8274: "manga",
  Q1004: "comic", Q1760610: "comic", Q7725634: "book", Q571: "book", Q47461344: "book",
  Q8261: "book", Q17537576: "music_video", Q482994: "music_album", Q7366: "music_track",
  Q177220: "music_artist", Q5741069: "music_group", Q215380: "music_group",
  Q1078005: "sports_event", Q27020041: "sports_season", Q15991303: "sports_team",
  Q476028: "sports_team", Q937857: "sports_player", Q2066131: "sports_player",
  Q1524: "person", Q5: "person", Q95074: "character", Q105543609: "idol",
  Q219577: "vtuber", Q17125263: "vtuber", Q483501: "music_artist",
  Q13219666: "radio_station", Q1616075: "tv_show",
};

/** Wikidata external-id properties -> our namespaces. */
const ID_CLAIMS: Record<string, string> = {
  P4947: "tmdb", P4983: "tmdb", P4835: "tvdb", P8600: "tvmaze", P4086: "mal", P4087: "mal",
  P8729: "anilist", P8731: "anilist", P5646: "anidb", P3868: "mdl",
};

/** Which property holds a namespace's id for a given kind. */
function lookupProps(ns: string, kind?: Kind): string[] {
  const movie = kind === "movie" || kind === "anime_movie";
  const tv = kind === "tv_show" || kind === "tv_season" || kind === "tv_special";
  switch (ns) {
    case "imdb": return ["P345"];
    case "tmdb": return movie ? ["P4947"] : tv ? ["P4983"] : ["P4983", "P4947"];
    case "tvdb": return ["P4835"];
    case "tvmaze": return ["P8600"];
    default: return [];
  }
}

export interface ScreenIds { wikidata: string; imdb?: string; tmdb_tv?: string; tmdb_movie?: string; mdl?: string; tvmaze?: string; }

/**
 * Keyless TMDB ids for a page of rows in one SPARQL call: IMDb (P345) or
 * MyDramaList (P3868) values -> Wikidata item -> TMDB TV (P4983) / film (P4947),
 * IMDb, MDL and TVmaze ids. Cached 30 days per value set.
 */
export async function screenIdsBy(prop: "P345" | "P3868", values: string[]): Promise<Map<string, ScreenIds>> {
  const out = new Map<string, ScreenIds>();
  const clean = [...new Set(values.filter((v) => /^[\w-]+$/.test(v)))].slice(0, 100);
  if (!clean.length) return out;
  const key = prop === "P345" ? "imdb" : "mdl";
  const literals = clean.map((v) => JSON.stringify(v)).join(" ");
  // Wikidata stores MDL ids both bare ("18452") and with a slug that may be stale ("35729-emergency-lands-of-love").
  const match = prop === "P345"
    ? `VALUES ?imdb { ${literals} } ?item wdt:P345 ?imdb .`
    : `?item wdt:P3868 ?raw . BIND(IF(CONTAINS(?raw, "-"), STRBEFORE(?raw, "-"), ?raw) AS ?mdl) VALUES ?mdl { ${literals} }`;
  const sparql = `SELECT ?item ?${key} ?imdb2 ?tmdbtv ?tmdbm ?tvmaze WHERE { ${match} OPTIONAL{?item wdt:P345 ?imdb2} OPTIONAL{?item wdt:P4983 ?tmdbtv} OPTIONAL{?item wdt:P4947 ?tmdbm} OPTIONAL{?item wdt:P8600 ?tvmaze} }`;
  const res = await fetchJson<any>(`${SPARQL}?format=json&query=${encodeURIComponent(sparql)}`, { provider: "wikidata", ttlMs: 2_592_000_000, timeoutMs: 4_000, headers: { accept: "application/sparql-results+json" } });
  for (const b of res.data?.results?.bindings ?? []) {
    const v = (k: string) => b[k]?.value?.split("/").pop();
    const k = v(key);
    if (!k || out.has(k)) continue;
    out.set(k, { wikidata: v("item")!, imdb: key === "imdb" ? k : v("imdb2"), tmdb_tv: v("tmdbtv"), tmdb_movie: v("tmdbm"), mdl: key === "mdl" ? k : undefined, tvmaze: v("tvmaze") });
  }
  return out;
}

const norm = (s: string) => s.normalize("NFKD").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * Last resort for rows with no IMDb id and an MDL id Wikidata does not carry:
 * full-text search restricted to items that have a TMDB id, accepted only on an
 * exact (normalized) label/alias match and a start year within one.
 */
async function screenIdsByTitle(rows: Entity[]): Promise<Map<Entity, ScreenIds>> {
  const out = new Map<Entity, ScreenIds>();
  if (!rows.length) return out;
  const candidates = await Promise.all(rows.map(async (r) => {
    const prop = r.kind === "movie" ? "P4947" : "P4983";
    const res = await fetchJson<any>(`${WD}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(`${r.name} haswbstatement:${prop}`)}&srlimit=3&format=json`, { provider: "wikidata", ttlMs: 7 * 86_400_000, timeoutMs: 3_000 }).catch(() => null);
    return (res?.data?.query?.search ?? []).map((s: any) => s.title).filter((q: string) => /^Q\d+$/.test(q)) as string[];
  }));
  const qids = [...new Set(candidates.flat())];
  if (!qids.length) return out;
  const sparql = `SELECT ?item ?label ?alias ?tmdbtv ?tmdbm ?imdb ?tvmaze ?start WHERE { VALUES ?item { ${qids.map((q) => `wd:${q}`).join(" ")} } OPTIONAL{?item rdfs:label ?label FILTER(LANG(?label) IN ("en","ko","ja","zh"))} OPTIONAL{?item skos:altLabel ?alias FILTER(LANG(?alias) = "en")} OPTIONAL{?item wdt:P4983 ?tmdbtv} OPTIONAL{?item wdt:P4947 ?tmdbm} OPTIONAL{?item wdt:P345 ?imdb} OPTIONAL{?item wdt:P8600 ?tvmaze} OPTIONAL{?item wdt:P580|wdt:P577 ?start} }`;
  const res = await fetchJson<any>(`${SPARQL}?format=json&query=${encodeURIComponent(sparql)}`, { provider: "wikidata", ttlMs: 7 * 86_400_000, timeoutMs: 4_000, headers: { accept: "application/sparql-results+json" } });
  const items = new Map<string, { names: Set<string>; years: Set<number>; ids: ScreenIds }>();
  for (const b of res.data?.results?.bindings ?? []) {
    const v = (k: string) => b[k]?.value?.split("/").pop();
    const q = v("item")!;
    const it = items.get(q) ?? { names: new Set<string>(), years: new Set<number>(), ids: { wikidata: q } as ScreenIds };
    for (const n of [b.label?.value, b.alias?.value]) if (n) it.names.add(norm(n));
    if (b.start?.value) it.years.add(Number(b.start.value.slice(0, 4)));
    it.ids.tmdb_tv ??= v("tmdbtv"); it.ids.tmdb_movie ??= v("tmdbm"); it.ids.imdb ??= v("imdb"); it.ids.tvmaze ??= v("tvmaze");
    items.set(q, it);
  }
  rows.forEach((r, i) => {
    const names = [r.name, r.title.english, r.title.native, ...r.title.aliases].filter(Boolean).map((n) => norm(n!));
    const year = r.dates.start?.year ?? r.dates.release?.year ?? null;
    const match = candidates[i].map((q) => items.get(q)).find((it) => it && names.some((n) => it.names.has(n))
      && (!year || !it.years.size || [...it.years].some((y) => Math.abs(y - year) <= 1)));
    if (match) out.set(r, match.ids);
  });
  return out;
}

/** Fill external_ids.tmdb (and imdb/mdl/tvmaze) on movie/tv rows that lack it. Never throws. */
export async function bridgeScreenIds(rows: Entity[]): Promise<void> {
  const screen = rows.filter((r) => (r.kind === "movie" || r.kind === "tv_show") && !r.external_ids.tmdb?.length);
  if (!screen.length) return;
  try {
    const [byImdb, byMdl] = await Promise.all([
      screenIdsBy("P345", screen.map((r) => r.external_ids.imdb?.[0]).filter(Boolean) as string[]),
      screenIdsBy("P3868", screen.filter((r) => !r.external_ids.imdb?.length).map((r) => r.external_ids.mdl?.[0]).filter(Boolean) as string[]),
    ]);
    const misses = screen.filter((r) => !((r.external_ids.imdb?.[0] && byImdb.get(r.external_ids.imdb[0])) || (r.external_ids.mdl?.[0] && byMdl.get(r.external_ids.mdl[0]))));
    const byTitle = await screenIdsByTitle(misses.slice(0, 12)).catch(() => new Map<Entity, ScreenIds>());
    for (const r of screen) {
      const hit = (r.external_ids.imdb?.[0] && byImdb.get(r.external_ids.imdb[0])) || (r.external_ids.mdl?.[0] && byMdl.get(r.external_ids.mdl[0])) || byTitle.get(r);
      if (!hit) continue;
      const tmdb = r.kind === "movie" ? hit.tmdb_movie : hit.tmdb_tv;
      const via = { provider: "wikidata", url: `${WD}/wiki/${hit.wikidata}`, fetched_at: new Date().toISOString(), confidence: "verified" as const };
      if (tmdb) { addId(r, "tmdb", tmdb); (r.provenance.field_sources["external_ids.tmdb"] ??= []).push(via); }
      if (hit.imdb) addId(r, "imdb", hit.imdb);
      if (hit.mdl) addId(r, "mdl", hit.mdl);
      if (hit.tvmaze && r.kind === "tv_show") addId(r, "tvmaze", hit.tvmaze);
      addId(r, "wikidata", hit.wikidata);
    }
  } catch { /* ids stay as they were */ }
}

interface Feed {
  qid: string;
  label: string;
  description?: string;
  claims: Record<string, any[]>;
  sitelinks: Record<string, any>;
  aliases: string[];
}

function refs(snak: any): string[] {
  const dv = snak?.mainsnak?.datavalue?.value;
  if (!dv) return [];
  if (typeof dv === "string") return [dv];
  if (dv.id) return [dv.id];
  if (dv.time) return [dv.time];
  if (dv.amount) return [dv.amount];
  if (dv["numeric-id"]) return [`Q${dv["numeric-id"]}`];
  return [];
}

function claimValues(feed: Feed, prop: string): string[] {
  return (feed.claims[prop] ?? []).flatMap((c) => refs(c));
}

function feedToEntity(feed: Feed, kind: Kind): Entity {
  const e = baseEntity(kind, feed.label, "wikidata", `${WD}/wiki/${feed.qid}`);
  addId(e, "wikidata", feed.qid);
  e.title.aliases = feed.aliases;
  e.description.short = { en: feed.description ?? "" };
  e.images.poster = claimValues(feed, "P18").map((f) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(f)}?width=1200`);
  const country = claimValues(feed, "P495");
  e.broadcast.country = country[0] ?? null;
  e.dates.start = dateParts(claimValues(feed, "P580")[0] ?? claimValues(feed, "P577")[0]) ?? null;
  e.dates.end = dateParts(claimValues(feed, "P582")[0]) ?? null;
  e.dates.release = dateParts(claimValues(feed, "P577")[0]) ?? null;
  e.dates.founded = dateParts(claimValues(feed, "P571")[0]) ?? null;
  e.dates.born = dateParts(claimValues(feed, "P569")[0]) ?? null;
  e.dates.died = dateParts(claimValues(feed, "P570")[0]) ?? null;
  e.dates.debut = dateParts(claimValues(feed, "P2031")[0]) ?? null;
  e.person.birthday = claimValues(feed, "P569")[0]?.slice(0, 10) ?? e.person.birthday;
  e.person.deathday = claimValues(feed, "P570")[0]?.slice(0, 10) ?? e.person.deathday;
  e.person.birthplace = claimValues(feed, "P19")[0] ?? null;
  e.person.nationality = claimValues(feed, "P27");
  e.person.gender = claimValues(feed, "P21")[0] ?? null;
  e.person.occupations = claimValues(feed, "P106");
  e.person.instruments = claimValues(feed, "P1303");
  const height = (feed.claims.P2048 ?? [])[0];
  const hv = height?.mainsnak?.datavalue?.value;
  if (hv?.amount) e.person.height_cm = Math.round(Number(hv.amount) * (hv.unit?.includes("Q174728") ? 100 : 1));
  e.classification.genres = claimValues(feed, "P136");
  e.classification.themes = claimValues(feed, "P921");
  for (const id of claimValues(feed, "P345")) addId(e, "imdb", id);
  for (const [prop, key] of Object.entries(ID_CLAIMS)) for (const id of claimValues(feed, prop)) addId(e, key, id);
  for (const id of claimValues(feed, "P434")) addId(e, "musicbrainz", id);
  for (const id of claimValues(feed, "P212")) addId(e, "isbn13", id.replace(/-/g, ""));
  for (const id of claimValues(feed, "P957")) addId(e, "isbn10", id.replace(/-/g, ""));
  for (const id of claimValues(feed, "P236")) addId(e, "issn", id);
  for (const id of claimValues(feed, "P356")) addId(e, "doi", id);
  for (const id of claimValues(feed, "P1932")) addId(e, "gr", id);
  e.literature.isbn13 = e.external_ids.isbn13 ?? [];
  e.literature.isbn10 = e.external_ids.isbn10 ?? [];
  e.literature.doi = e.external_ids.doi ?? [];
  e.literature.pages = Number(claimValues(feed, "P1104")[0]) || null;
  e.literature.oclc = claimValues(feed, "P243");
  e.literature.lccn = claimValues(feed, "P1144");
  e.music.isrc = claimValues(feed, "P839");
  e.music.bpm = Number(claimValues(feed, "P1130")?.[0]) || null;
  e.music.duration_ms = Number(claimValues(feed, "P2047")?.[0]) || null;
  e.sports.sport = claimValues(feed, "P641")[0] ?? null;
  e.sports.season = claimValues(feed, "P5138")[0] ?? null;
  e.sports.round = claimValues(feed, "P4792")[0] ?? null;
  e.sports.home_team = claimValues(feed, "P1519")[0] ? { name: claimValues(feed, "P1519")[0], kind: "unknown" as const, external_ids: { wikidata: claimValues(feed, "P1519") } } : null;
  e.sports.away_team = claimValues(feed, "P1563")[0] ? { name: claimValues(feed, "P1563")[0], kind: "unknown" as const, external_ids: { wikidata: claimValues(feed, "P1563") } } : null;
  e.event.venue = claimValues(feed, "P276")[0] ? { name: claimValues(feed, "P276")[0], kind: "unknown" as const, external_ids: { wikidata: claimValues(feed, "P276") } } : null;
  e.event.coordinates = coordinate(feed);
  for (const [prop, role, field] of [
    ["P57", "director", "production"], ["P161", "cast", "production"], ["P86", "composer", "production"],
    ["P175", "performer", "production"], ["P264", "label", "labels"], ["P123", "publisher", "publishers"],
    ["P272", "production", "production"], ["P750", "distributor", "distributors"],
  ] as const) {
    for (const value of claimValues(feed, prop)) {
      const person = { name: value, kind: "unknown" as const, external_ids: { wikidata: [value] } };
      if (field === "labels") e.companies.labels.push(person as any);
      else if (field === "publishers") e.companies.publishers.push(person as any);
      else if (field === "distributors") e.companies.distributors.push(person as any);
      else e.credits.push({ person: person as any, role, voice: false, department: role === "cast" ? "cast" : "crew", sources: [] });
    }
  }
  if (feed.sitelinks?.enwiki?.title) {
    e.urls.wikipedia = `https://en.wikipedia.org/wiki/${encodeURIComponent(feed.sitelinks.enwiki.title.replace(/ /g, "_"))}`;
  }
  e.raw.wikidata = feed;
  e.score = (feed.sitelinks?.enwiki ? 30 : 0) + (feed.claims.P18?.length ?? 0) * 2;
  return e;
}

function coordinate(feed: Feed) {
  const c = feed.claims.P625?.[0]?.mainsnak?.datavalue?.value;
  return c ? { lat: c.latitude, lon: c.longitude } : null;
}

async function searchByKind(q: string, kind: Kind, limit: number): Promise<string[]> {
  const inst = Object.entries(INSTANCE_KIND).find(([, k]) => k === kind)?.[0];
  const filter = inst ? `VALUES ?inst { wd:${inst} } ?s wdt:P31 ?inst .` : "";
  const sparql = `SELECT ?s ?sLabel ?sDescription WHERE { ${filter} ?s rdfs:label ?l . FILTER(CONTAINS(LCASE(?l), LCASE(${JSON.stringify(q)}))) SERVICE wikibase:label { bd:serviceParam wikibase:language "en,ja,ko,zh". } } LIMIT ${Math.min(limit, 25)}`;
  const res = await fetchJson<any>(`${SPARQL}?format=json&query=${encodeURIComponent(sparql)}`, { provider: "wikidata", ttlMs: 86_400_000 });
  return (res.data.results?.bindings ?? []).map((b: any) => b.s.value.replace(`${WD}/entity/`, ""));
}

function toFeed(qid: string, entity: any): Feed {
  return {
    qid,
    label: entity.labels?.en?.value ?? entity.labels?.ja?.value ?? entity.labels?.ko?.value ?? qid,
    description: entity.descriptions?.en?.value,
    claims: entity.claims ?? {},
    sitelinks: entity.sitelinks ?? {},
    aliases: [...(entity.aliases?.en ?? []), ...(entity.aliases?.ja ?? [])].map((a: any) => a.value),
  };
}

export const wikidata: Provider = {
  id: "wikidata", name: "Wikidata", domains: ["meta", "people", "screen", "reading", "music", "sports"], priority: 40,
  kinds: [...new Set(Object.values(INSTANCE_KIND))],
  operations: ["search", "get", "resolve", "related"],
  namespaces: ["wikidata"],
  auth: "none", base: WD, license: "CC0",
  freshness: "24h", homepage: "https://www.wikidata.org",
  notes: "Identity backbone: cross-provider ids, people, dates, awards, franchises. SPARQL + EntityData.",
  async search(ctx, q) {
    const kinds = ["movie", "tv_show", "anime", "manga", "book", "music_artist", "sports_team", "person", "idol", "vtuber", "concert"];
    const groups = await Promise.all(kinds.slice(0, 6).map((k) => searchByKind(q, k as Kind, 5).catch(() => [])));
    const ids = [...new Set(groups.flat())].slice(0, ctx.limit);
    const out: Entity[] = [];
    for (const qid of ids) {
      const feed = await this.get!(ctx, { id: qid }).catch(() => null);
      if (feed) out.push(feed);
    }
    return out;
  },
  async get(ctx, ref) {
    const qid = ref.externalIds?.wikidata ?? (/^Q\d+$/.test(ref.id) ? ref.id : null);
    if (!qid) return null;
    const res = await fetchJson<any>(`${WD}/wiki/Special:EntityData/${qid}.json`, { provider: "wikidata", ttlMs: 86_400_000, allowStatus: [404] });
    const entity = res.data.entities?.[qid];
    if (!entity) return null;
    const feed = toFeed(qid, entity);
    const inst = claimValues(feed, "P31").concat(claimValues(feed, "P279"));
    const kind = inst.map((i) => INSTANCE_KIND[i]).find(Boolean) ?? (ref.kind ?? "person");
    return feedToEntity(feed, kind);
  },
  async resolve(ctx, ids, kind) {
    if (ids.wikidata) return this.get!(ctx, { id: ids.wikidata, kind });
    // Anime and manga have ARM/AniList/ani.zip; Wikidata is the keyless bridge for screen ids (TMDB -> IMDb).
    if (kind && ["anime", "anime_movie", "anime_episode", "manga", "manhwa", "manhua", "webtoon", "person", "character"].includes(kind)) return null;
    for (const [ns, id] of Object.entries(ids)) {
      for (const prop of lookupProps(ns, kind)) {
        const res = await fetchJson<any>(`${WD}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(`haswbstatement:${prop}=${id}`)}&srlimit=1&format=json`, { provider: "wikidata", ttlMs: 2_592_000_000 });
        const qid = res.data?.query?.search?.[0]?.title;
        if (qid && /^Q\d+$/.test(qid)) {
          const e = await this.get!(ctx, { id: qid, kind });
          if (e) { addId(e, ns, id); return e; }
        }
      }
    }
    return null;
  },
  async related(ctx, id) {
    const e = await this.get!(ctx, { id });
    return [];
  },
};

export default wikidata;
void src;
