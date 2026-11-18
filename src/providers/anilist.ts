import { postJson } from "../core/http.ts";
import type { Entity, Kind } from "../schema/entities.ts";
import { addId, baseEntity, src, stripHtml, tag } from "./_util.ts";
import type { DiscoverParams, ListResult, Provider, ProviderContext } from "./_types.ts";

const ENDPOINT = "https://graphql.anilist.co";
const CACHE = 60_000;
const LIST_CACHE = 10 * 60_000;
const DETAIL_CACHE = 6 * 3600_000;

/** Fields every row carries, list or detail. Cheap enough for 50-row pages. */
const LIST_FIELDS = `
id idMal type format status isAdult countryOfOrigin source hashtag
title{romaji english native userPreferred} synonyms
description(asHtml:false) startDate{year month day} endDate{year month day} season seasonYear
episodes duration chapters volumes updatedAt
coverImage{extraLarge large medium color} bannerImage
genres tags{id name category rank isGeneralSpoiler isMediaSpoiler isAdult}
averageScore meanScore popularity favourites trending
trailer{id site thumbnail}
siteUrl
nextAiringEpisode{airingAt timeUntilAiring episode}
studios{edges{isMain node{id name siteUrl}}}
`;

/** The detail document: list fields plus credits, schedule, relations, stats. */
const MEDIA_FIELDS = `${LIST_FIELDS}
rankings{rank type format year season allTime}
externalLinks{id url site type language color icon notes isDisabled}
streamingEpisodes{title thumbnail url site}
airingSchedule(perPage:50){nodes{id airingAt timeUntilAiring episode}}
relations{edges{id relationType} nodes{id idMal type format title{romaji english native} coverImage{large} status}}
characters(perPage:25,sort:[ROLE,RELEVANCE]){edges{id role voiceActors(sort:[RELEVANCE]){id name{full native} image{large} languageV2} node{id name{full native} image{large} gender age favourites}}}
staff(perPage:25,sort:[RELEVANCE]){edges{id role node{id name{full native} image{large} languageV2 primaryOccupations}}}
stats{scoreDistribution{score amount} statusDistribution{status amount}}
recommendations(perPage:10,sort:RATING_DESC){nodes{rating mediaRecommendation{id idMal type format title{romaji english} coverImage{large}}}}
`;

const KIND: Record<string, Kind> = {
  TV: "anime", TV_SHORT: "anime", ONA: "anime", OVA: "anime", SPECIAL: "anime",
  MOVIE: "anime_movie", MUSIC: "anime", MANGA: "manga", NOVEL: "manga", ONE_SHOT: "manga",
};

function kindOf(m: { type?: string; format?: string; countryOfOrigin?: string }): Kind {
  if (m.type === "MANGA") return m.countryOfOrigin === "KR" ? "manhwa" : m.countryOfOrigin === "CN" || m.countryOfOrigin === "TW" ? "manhua" : "manga";
  return KIND[m.format ?? ""] ?? "anime";
}

const isManga = (kind?: Kind) => kind === "manga" || kind === "manhwa" || kind === "manhua" || kind === "webtoon";

/** AniList FuzzyDate -> DateParts. AniList sends objects, never strings. */
function fuzzy(d: any) {
  if (!d?.year) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = d.month && d.day ? `${d.year}-${pad(d.month)}-${pad(d.day)}` : d.month ? `${d.year}-${pad(d.month)}` : `${d.year}`;
  return { year: d.year, month: d.month ?? null, day: d.day ?? null, date, precision: (d.day ? "day" : d.month ? "month" : "year") as "day" | "month" | "year" };
}

const STATE: Record<string, Entity["status"]["state"]> = {
  RELEASING: "releasing", FINISHED: "finished", NOT_YET_RELEASED: "upcoming", CANCELLED: "cancelled", HIATUS: "hiatus",
};

/** The id a client keys this work by: MAL when AniList knows it. */
export function workRef(m: { id: number; idMal?: number | null; type?: string }): string {
  const manga = m.type === "MANGA" ? "manga:" : "";
  return m.idMal ? `mal:${manga}${m.idMal}` : `anilist:${manga}${m.id}`;
}

function personRef(n: any, kind: "person" | "character") {
  return {
    id: `anilist:${kind === "character" ? "character" : "staff"}:${n.id}`,
    name: n.name?.full ?? n.name?.native ?? "Unknown",
    native_name: n.name?.native ?? null,
    kind,
    image: n.image?.large ?? null,
    url: `https://anilist.co/${kind === "character" ? "character" : "staff"}/${n.id}`,
    language: n.languageV2 ?? null,
    occupations: n.primaryOccupations ?? undefined,
    external_ids: { anilist: [String(n.id)], [kind === "character" ? "anilist_character" : "anilist_staff"]: [String(n.id)] },
  };
}

export function map(m: any): Entity {
  const type = kindOf(m);
  const e = baseEntity(type, m.title.english || m.title.romaji || m.title.native || `AniList ${m.id}`, "anilist", m.siteUrl);
  const url = m.siteUrl ?? `https://anilist.co/${m.type === "MANGA" ? "manga" : "anime"}/${m.id}`;
  addId(e, "anilist", String(m.id));
  if (m.idMal) addId(e, "mal", String(m.idMal));
  e.format = m.format ?? null;
  e.season = m.season || m.seasonYear ? { name: m.season ? m.season.toLowerCase() : null, year: m.seasonYear ?? null } : null;
  e.title.romaji = m.title.romaji ?? null;
  e.title.english = m.title.english ?? null;
  e.title.native = m.title.native ?? null;
  e.title.aliases = m.synonyms ?? [];
  e.urls.anilist = url;
  if (m.description) {
    e.description.long = { en: stripHtml(m.description) };
    e.description.synopsis = { en: stripHtml(m.description) };
  }
  e.images.poster = [m.coverImage?.extraLarge, m.coverImage?.large, m.coverImage?.medium].filter(Boolean);
  e.images.banner = m.bannerImage ? [m.bannerImage] : [];
  if (m.coverImage?.color) e.images.dominant_color = m.coverImage.color;
  e.dates.start = fuzzy(m.startDate);
  e.dates.end = fuzzy(m.endDate);
  if (m.type === "MANGA" && !e.season && e.dates.start?.year) e.season = { name: null, year: e.dates.start.year };
  e.status.state = STATE[m.status ?? ""] ?? "unknown";
  e.status.is_airing = m.status === "RELEASING";
  e.classification.genres = m.genres ?? [];
  e.classification.is_adult = m.isAdult ?? null;
  e.classification.tags = (m.tags ?? []).map((t: any) => ({
    name: t.name, category: t.category, rank: t.rank, spoiler: t.isGeneralSpoiler || t.isMediaSpoiler, adult: t.isAdult,
  }));
  e.classification.themes = (m.tags ?? []).filter((t: any) => /^Theme/.test(t.category ?? "")).map((t: any) => t.name);
  e.classification.demographics = (m.tags ?? []).filter((t: any) => t.category === "Demographic").map((t: any) => t.name);
  e.classification.content_warnings = (m.tags ?? []).filter((t: any) => t.isAdult).map((t: any) => t.name);
  e.metrics.score = m.averageScore ?? null;
  e.metrics.score_scale = m.averageScore != null ? 100 : null;
  e.metrics.mean_score = m.meanScore ?? null;
  e.metrics.popularity = m.popularity ?? null;
  e.metrics.favourites = m.favourites ?? null;
  e.metrics.trending = m.trending ?? null;
  e.metrics.rank = (m.rankings ?? []).find((r: any) => r.type === "RANKED" && r.allTime)?.rank ?? null;
  if (m.stats) {
    e.metrics.distributions = Object.fromEntries((m.stats.statusDistribution ?? []).map((s: any) => [s.status, s.amount]));
    e.metrics.rating_breakdown = Object.fromEntries((m.stats.scoreDistribution ?? []).map((s: any) => [String(s.score), s.amount]));
  }
  e.technical.episode_count = m.episodes ?? null;
  e.technical.episode_runtime_minutes = m.duration ?? null;
  e.technical.runtime_minutes = m.duration && m.episodes ? m.duration * m.episodes : null;
  e.manga.chapter_count = m.chapters ?? null;
  e.manga.volume_count = m.volumes ?? null;
  if (m.type === "MANGA") e.manga.demographic = (m.tags ?? []).find((t: any) => t.category === "Demographic")?.name ?? null;
  e.broadcast.country = m.countryOfOrigin ?? null;
  e.media.trailers = m.trailer?.id ? [{ id: m.trailer.id, site: m.trailer.site, thumbnail: m.trailer.thumbnail, url: m.trailer.site === "youtube" ? `https://youtube.com/watch?v=${m.trailer.id}` : m.trailer.site === "dailymotion" ? `https://www.dailymotion.com/video/${m.trailer.id}` : null }] : [];
  e.availability.streaming = (m.streamingEpisodes ?? []).map((s: any) => ({ provider: s.site ?? "unknown", url: s.url, kind: "subscription" as const, title: s.title, thumbnail: s.thumbnail }));
  e.links = (m.externalLinks ?? []).map((l: any) => ({ url: l.url, site: l.site, kind: l.type, language: l.language, color: l.color, icon: l.icon, is_official: true }));
  e.availability.official_site = url;
  for (const edge of m.relations?.edges ?? []) {
    const node = (m.relations?.nodes ?? []).find((n: any) => n.id === edge.id);
    if (!node) continue;
    const target = baseEntity(kindOf(node), node.title?.english || node.title?.romaji || String(node.id), "anilist");
    addId(target, "anilist", String(node.id));
    if (node.idMal) addId(target, "mal", String(node.idMal));
    target.format = node.format ?? null;
    target.title.romaji = node.title?.romaji ?? null;
    target.title.english = node.title?.english ?? null;
    target.images.poster = node.coverImage?.large ? [node.coverImage.large] : [];
    target.status.state = STATE[node.status ?? ""] ?? "unknown";
    e.relations.push({
      kind: relationKind(edge.relationType), target_id: workRef(node), role: edge.relationType,
      title: node.title?.english || node.title?.romaji || null, target, sources: [src("anilist", url)],
    });
  }
  for (const rec of m.recommendations?.nodes ?? []) {
    const r = rec.mediaRecommendation;
    if (!r) continue;
    e.relations.push({ kind: "recommendation", target_id: workRef(r), title: r.title?.english || r.title?.romaji || null, weight: rec.rating ?? null, sources: [src("anilist", url)] });
  }
  for (const edge of m.characters?.edges ?? []) {
    if (!edge.node?.id) continue;
    const character = personRef(edge.node, "character");
    const role = String(edge.role ?? "BACKGROUND").toUpperCase();
    const vas = edge.voiceActors ?? [];
    // Per-credit sources are omitted: every credit comes from the same document,
    // and provenance.field_sources["credits"] already names it (keeps a 25-character cast under 100 KB).
    e.credits.push({
      person: character, role, department: "characters", character: null, voice: false,
      voices: vas.map((va: any) => ({ person: { id: `anilist:staff:${va.id}`, name: va.name?.full ?? va.name?.native ?? "Unknown" }, language: va.languageV2 ?? null })),
    });
    // The same voices as flat rows: person = the voice actor (full ref), character = who they voice.
    const charRef = { id: character.id, name: character.name, native_name: character.native_name, kind: "character" };
    for (const va of vas) {
      e.credits.push({
        person: personRef(va, "person"), character: charRef, role, department: "voice", job: "Voice Actor", voice: true,
        language: va.languageV2 ?? null,
      });
    }
  }
  for (const edge of m.staff?.edges ?? []) {
    if (!edge.node?.id) continue;
    e.credits.push({
      person: personRef(edge.node, "person"),
      role: edge.role, job: edge.role, character: null, voice: false, department: "staff",
    });
  }
  for (const edge of m.studios?.edges ?? []) {
    const n = edge.node;
    const ref = { id: `anilist:studio:${n.id}`, name: n.name, kind: "studio" as const, url: n.siteUrl ?? null, external_ids: { anilist_studio: [String(n.id)] } };
    if (edge.isMain) e.companies.studios.push(ref); else e.companies.production.push(ref);
  }
  if (m.nextAiringEpisode) {
    const at = new Date(m.nextAiringEpisode.airingAt * 1000).toISOString();
    e.status.is_upcoming = true;
    e.dates.airing = { date: at, precision: "second" };
    e.broadcast.next_episode = { number: m.nextAiringEpisode.episode, airing_at: at, time_until_s: m.nextAiringEpisode.timeUntilAiring ?? null, precision: "minute" };
  }
  for (const node of m.airingSchedule?.nodes ?? []) {
    e.episodes.push({
      id: `anilist:${m.id}:ep:${node.episode}`, number: node.episode,
      air_date: new Date(node.airingAt * 1000).toISOString(), kind: "regular",
      sources: [src("anilist", url)],
    });
  }
  e.raw.anilist = m;
  if (m.source) tag(e, `source:${m.source}`);
  if (m.hashtag) tag(e, `hashtag:${m.hashtag}`);
  e.score = (m.popularity ?? 0) / 1000 + (m.averageScore ?? 0) / 100;
  return e;
}

function relationKind(r: string): any {
  const map: Record<string, string> = {
    SEQUEL: "sequel", PREQUEL: "prequel", SIDE_STORY: "side_story", SPIN_OFF: "spin_off",
    ADAPTATION: "adaptation", SOURCE: "source", ALTERNATIVE: "alternative", PARENT: "parent", CHARACTER: "character",
    SUMMARY: "summary", COMPILATION: "compilation", CONTAINS: "child", OTHER: "alternative",
  };
  return map[r] ?? "alternative";
}

async function query(_ctx: ProviderContext | null, body: string, vars: Record<string, unknown>, ttlMs = CACHE) {
  const res = await postJson<any>(ENDPOINT, { query: body, variables: vars }, {
    provider: "anilist", ttlMs, headers: { "content-type": "application/json", referer: "https://anilist.co/" }, timeoutMs: 15_000,
  });
  if (res.data.errors?.length && !res.data.data) throw new Error(res.data.errors.map((e: any) => e.message).join("; "));
  return res.data.data;
}

const PAGE_ARGS = `$type:MediaType,$page:Int,$per:Int,$q:String,$sort:[MediaSort],$season:MediaSeason,$year:Int,$genres:[String],$format:MediaFormat,$status:MediaStatus,$country:CountryCode,$adult:Boolean`;
const PAGE = `query(${PAGE_ARGS}){Page(page:$page,perPage:$per){pageInfo{total currentPage lastPage hasNextPage} media(type:$type,search:$q,sort:$sort,season:$season,seasonYear:$year,genre_in:$genres,format:$format,status:$status,countryOfOrigin:$country,isAdult:$adult){${LIST_FIELDS}}}}`;
const GET = `query($id:Int,$type:MediaType){Media(id:$id,type:$type){${MEDIA_FIELDS}}}`;
const DETAIL_TTL = 15 * 60_000;
const GET_MAL = `query($id:Int,$type:MediaType){Media(idMal:$id,type:$type){${MEDIA_FIELDS}}}`;
const SCHEDULE = `query($from:Int,$to:Int,$page:Int,$per:Int){Page(page:$page,perPage:$per){pageInfo{hasNextPage} airingSchedules(airingAt_greater:$from,airingAt_lesser:$to,sort:TIME){airingAt episode timeUntilAiring media{${LIST_FIELDS}}}}}`;
const GENRES = `query{GenreCollection}`;
const STAFF = `query($id:Int,$page:Int){Staff(id:$id){id name{full native alternative} image{large} description(asHtml:false) primaryOccupations gender age dateOfBirth{year month day} dateOfDeath{year month day} yearsActive homeTown bloodType languageV2 favourites siteUrl
  staffMedia(page:$page,perPage:25,sort:POPULARITY_DESC){edges{staffRole node{id idMal type format title{english romaji native} coverImage{large} startDate{year}}}}
  characters(page:$page,perPage:25,sort:FAVOURITES_DESC){edges{role node{id name{full native} image{large}} media{id idMal type format title{english romaji} coverImage{large}}}}}}`;
const CHARACTER = `query($id:Int){Character(id:$id){id name{full native alternative} image{large} description(asHtml:false) gender age dateOfBirth{year month day} bloodType favourites siteUrl
  media(perPage:25,sort:POPULARITY_DESC){edges{characterRole voiceActors(sort:[RELEVANCE]){id name{full native} image{large} languageV2} node{id idMal type format title{english romaji native} coverImage{large}}}}}}`;

const SORTS: Record<string, string[]> = {
  popular: ["POPULARITY_DESC"], trending: ["TRENDING_DESC", "POPULARITY_DESC"], score: ["SCORE_DESC"],
  newest: ["START_DATE_DESC"], title: ["TITLE_ROMAJI"], episodes: ["EPISODES_DESC"], chapters: ["CHAPTERS_DESC"],
  favourites: ["FAVOURITES_DESC"], relevance: ["SEARCH_MATCH"],
  // Aliases the Yorozo client sends.
  popularity: ["POPULARITY_DESC"], start_date_desc: ["START_DATE_DESC"], start_date: ["START_DATE"],
};
const STATUS_IN: Record<string, string> = {
  releasing: "RELEASING", airing: "RELEASING", ongoing: "RELEASING", finished: "FINISHED", completed: "FINISHED",
  upcoming: "NOT_YET_RELEASED", not_yet_released: "NOT_YET_RELEASED", cancelled: "CANCELLED", hiatus: "HIATUS",
};

async function page(ctx: ProviderContext, kind: Kind, p: Partial<DiscoverParams>, defaultSort: string): Promise<ListResult> {
  const manga = isManga(kind);
  let sort = p.sort ?? (p.query ? "relevance" : defaultSort);
  if (manga && sort === "episodes") sort = "chapters";
  const genres = [...(p.genres ?? []), ...(p.genre ? p.genre.split(",") : [])].map((g) => g.trim()).filter(Boolean);
  const country = p.country?.split(",")[0]?.toUpperCase() || (kind === "manhwa" ? "KR" : kind === "manhua" ? "CN" : undefined);
  const vars = {
    type: manga ? "MANGA" : "ANIME", page: p.page ?? ctx.page ?? 1, per: Math.min(ctx.limit, 50), q: p.query || undefined,
    sort: SORTS[sort] ?? SORTS.popular, season: p.season?.toUpperCase(), year: p.year,
    genres: genres.length ? genres : undefined, format: p.format?.toUpperCase(), status: p.status ? STATUS_IN[p.status.toLowerCase()] : undefined,
    country, adult: false,
  };
  const data = await query(ctx, PAGE, vars, sort === "trending" ? CACHE : LIST_CACHE);
  const info = data.Page?.pageInfo;
  let rows = (data.Page?.media ?? []).map(map);
  if (kind === "anime_movie") rows = rows.filter((r: Entity) => r.kind === "anime_movie");
  const out = rows as ListResult;
  out.hasNext = info?.hasNextPage ?? false;
  // AniList's pageInfo.total is capped at 5000; past that it is a floor, not a count.
  out.total = info?.hasNextPage === false ? ((vars.page - 1) * vars.per + rows.length) : info?.total && info.total < 5000 ? info.total : null;
  return out;
}

function workEdge(node: any, role: string | null, relKind: "staff" | "character", url: string) {
  const target = baseEntity(kindOf(node), node.title?.english || node.title?.romaji || String(node.id), "anilist");
  addId(target, "anilist", String(node.id));
  if (node.idMal) addId(target, "mal", String(node.idMal));
  target.format = node.format ?? null;
  target.title.romaji = node.title?.romaji ?? null;
  target.title.english = node.title?.english ?? null;
  target.title.native = node.title?.native ?? null;
  target.images.poster = node.coverImage?.large ? [node.coverImage.large] : [];
  if (node.startDate?.year) target.dates.start = fuzzy(node.startDate);
  return { kind: relKind, target_id: workRef(node), title: node.title?.english || node.title?.romaji || null, role, target, direction: "outgoing" as const, sources: [src("anilist", url)] };
}

function mapPersonCommon(e: Entity, n: any) {
  e.title.native = n.name?.native ?? null;
  e.title.aliases = (n.name?.alternative ?? []).filter(Boolean);
  if (n.description) e.description.long = { en: stripHtml(n.description) };
  e.images.profile = n.image?.large ? [n.image.large] : [];
  e.person.gender = n.gender ?? null;
  e.person.age = n.age ? Number(String(n.age).replace(/\D.*$/, "")) || null : null;
  e.person.blood_type = n.bloodType ?? null;
  const born = fuzzy(n.dateOfBirth);
  if (born) { e.dates.born = born; e.person.birthday = born.date; }
  e.metrics.favourites = n.favourites ?? null;
}

async function getStaff(id: string): Promise<Entity | null> {
  const data = await query(null, STAFF, { id: Number(id), page: 1 }, DETAIL_CACHE);
  const n = data.Staff;
  if (!n) return null;
  const url = n.siteUrl ?? `https://anilist.co/staff/${n.id}`;
  const e = baseEntity("person", n.name?.full ?? n.name?.native ?? `Staff ${n.id}`, "anilist", url);
  addId(e, "anilist", String(n.id));
  addId(e, "anilist_staff", String(n.id));
  mapPersonCommon(e, n);
  e.person.occupations = n.primaryOccupations ?? [];
  e.person.home_town = n.homeTown ?? null;
  e.person.years_active = (n.yearsActive ?? []).map(String);
  const died = fuzzy(n.dateOfDeath);
  if (died) { e.dates.died = died; e.person.deathday = died.date; }
  if (n.languageV2) e.person.languages = [n.languageV2];
  for (const edge of n.staffMedia?.edges ?? []) if (edge.node) e.person.filmography.push(workEdge(edge.node, edge.staffRole ?? null, "staff", url));
  for (const edge of n.characters?.edges ?? []) {
    for (const media of edge.media ?? []) {
      const rel = workEdge(media, edge.role ? `${String(edge.role).toLowerCase()} · ${edge.node?.name?.full ?? ""}`.trim() : null, "character", url);
      (rel as any).character = edge.node ? personRef(edge.node, "character") : null;
      e.person.filmography.push(rel);
    }
  }
  e.raw.anilist = n;
  return e;
}

async function getCharacter(id: string): Promise<Entity | null> {
  const data = await query(null, CHARACTER, { id: Number(id) }, DETAIL_CACHE);
  const n = data.Character;
  if (!n) return null;
  const url = n.siteUrl ?? `https://anilist.co/character/${n.id}`;
  const e = baseEntity("character", n.name?.full ?? n.name?.native ?? `Character ${n.id}`, "anilist", url);
  addId(e, "anilist", String(n.id));
  addId(e, "anilist_character", String(n.id));
  mapPersonCommon(e, n);
  const voices = new Map<string, any>();
  for (const edge of n.media?.edges ?? []) {
    if (edge.node) e.person.filmography.push(workEdge(edge.node, edge.characterRole ? String(edge.characterRole).toLowerCase() : null, "character", url));
    for (const va of edge.voiceActors ?? []) voices.set(String(va.id), va);
  }
  for (const va of voices.values()) {
    e.credits.push({ person: personRef(va, "person"), role: "voice", department: "voice", voice: true, language: va.languageV2 ?? null, character: null, sources: [src("anilist", url)] });
  }
  e.raw.anilist = n;
  return e;
}

export const anilist: Provider = {
  id: "anilist", name: "AniList", domains: ["anime", "reading", "people"], priority: 10,
  kinds: ["anime", "anime_movie", "manga", "manhwa", "manhua", "person", "character"],
  operations: ["search", "get", "trending", "discover", "schedule", "episodes", "related", "genres"],
  namespaces: ["anilist", "mal", "anilist_staff", "anilist_character"],
  scopes: ["anime", "manga", "person", "character"],
  limits: { "graphql.anilist.co": { rate: 30, windowMs: 60_000, burst: 6, concurrency: 3 } },
  auth: "none", base: "https://graphql.anilist.co", license: "AniList ToS; community data",
  freshness: "realtime; 60s-6h cache", homepage: "https://anilist.co",
  notes: "GraphQL. Primary anime/manga identity, credits, voice actors, staff, characters, airing schedule. Serves mal: ids via idMal. Live budget is 30 req/min (X-RateLimit-Limit).",
  async search(ctx, q) {
    const wants = ctx.kinds?.length ? ctx.kinds : ["anime", "manga"] as Kind[];
    const anime = wants.some((k) => !isManga(k) && k !== "person" && k !== "character");
    const manga = wants.some((k) => isManga(k) || k === "comic");
    const [a, m] = await Promise.all([
      anime ? page(ctx, "anime", { query: q }, "relevance") : Promise.resolve([] as Entity[]),
      manga ? page(ctx, "manga", { query: q }, "relevance") : Promise.resolve([] as Entity[]),
    ]);
    return [...a, ...m];
  },
  async get(ctx, ref) {
    const ns = ref.namespace ?? "anilist";
    if (ref.kind === "person" || ns === "anilist_staff") return /^\d+$/.test(ref.id) ? getStaff(ref.id) : null;
    if (ref.kind === "character" || ns === "anilist_character") return /^\d+$/.test(ref.id) ? getCharacter(ref.id) : null;
    if (!/^\d+$/.test(ref.id)) return null;
    const type = isManga(ref.kind) ? "MANGA" : "ANIME";
    const data = await query(ctx, ns === "mal" ? GET_MAL : GET, { id: Number(ref.id), type }, DETAIL_TTL);
    return data?.Media ? map(data.Media) : null;
  },
  async trending(ctx, kind) {
    return page(ctx, kind, {}, "trending");
  },
  async discover(ctx, p) {
    return page(ctx, p.kind, p, "popular");
  },
  async genres() {
    const data = await query(null, GENRES, {}, 24 * 3600_000);
    return (data.GenreCollection ?? []).filter((g: string) => g !== "Hentai");
  },
  async schedule(ctx, p) {
    // AniList bounds are exclusive.
    const from = Math.floor(Date.parse(p.from) / 1000) - 1;
    const to = Math.ceil(Date.parse(p.to) / 1000);
    const out: Entity[] = [];
    const fetchPage = (pg: number) => query(ctx, SCHEDULE, { from, to, per: 50, page: pg }, 10 * 60_000);
    // Page 1 tells us whether there is more; later pages go three at a time inside the host budget.
    const pages: any[] = [await fetchPage(1)];
    for (let pg = 2; pg <= 20 && pages.at(-1)?.Page?.pageInfo?.hasNextPage && pages.length * 50 < ctx.limit; pg += 3) {
      const batch = await Promise.all([pg, pg + 1, pg + 2].filter((n) => n <= 20 && (n - 1) * 50 < ctx.limit).map(fetchPage));
      pages.push(...batch);
      if (batch.some((b) => !b.Page?.pageInfo?.hasNextPage)) break;
    }
    for (const data of pages) {
      for (const s of data.Page?.airingSchedules ?? []) {
        if (!s.media || s.media.isAdult) continue;
        const e = map(s.media);
        const at = new Date(s.airingAt * 1000).toISOString();
        e.kind = "anime_episode";
        addId(e, "anilist_episode", `${s.media.id}:${s.episode}`);
        e.dates.airing = { date: at, precision: "second" };
        e.broadcast.next_episode = { number: s.episode, airing_at: at, time_until_s: s.timeUntilAiring ?? null, precision: "minute" };
        e.episodes = [{ id: `anilist:${s.media.id}:ep:${s.episode}`, number: s.episode, air_date: at, kind: "regular", sources: [src("anilist", e.urls.anilist)] }];
        e.score = -s.airingAt;
        out.push(e);
      }
    }
    return out.slice(0, ctx.limit);
  },
  async episodes(ctx, id) {
    const data = await query(ctx, GET, { id: Number(id), type: "ANIME" });
    if (!data.Media) return [];
    return (data.Media.airingSchedule?.nodes ?? []).map((n: any) => {
      const e = baseEntity("anime_episode", `${data.Media.title.romaji} ${n.episode}`, "anilist");
      e.episodes = [{ id: `anilist:${data.Media.id}:ep:${n.episode}`, number: n.episode, air_date: new Date(n.airingAt * 1000).toISOString(), kind: "regular" }];
      addId(e, "anilist", String(data.Media.id));
      return e;
    });
  },
  async related(ctx, id) {
    const e = await this.get!(ctx, { id, namespace: "anilist" });
    return (e?.relations ?? []).map((r) => r.target).filter(Boolean) as Entity[];
  },
};

export default anilist;
