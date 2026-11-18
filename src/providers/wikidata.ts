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
  async resolve(ctx, ids) {
    if (ids.wikidata) return this.get!(ctx, { id: ids.wikidata });
    return null;
  },
  async related(ctx, id) {
    const e = await this.get!(ctx, { id });
    return [];
  },
};

export default wikidata;
void src;
