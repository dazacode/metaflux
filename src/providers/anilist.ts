import { postJson } from "../core/http.ts";
import type { Entity, Kind } from "../schema/entities.ts";
import { addId, baseEntity, dateParts, num, src, stripHtml, tag } from "./_util.ts";
import type { Provider, ProviderContext } from "./_types.ts";

const ENDPOINT = "https://graphql.anilist.co";
const CACHE = 60_000;

const MEDIA_FIELDS = `
id idMal type format status isAdult isLocked isLicensed countryOfOrigin source hashtag
title{romaji english native userPreferred} synonyms
description(asHtml:false) startDate{year month day} endDate{year month day} season seasonYear
episodes duration chapters volumes updatedAt
coverImage{extraLarge large medium color} bannerImage
genres tags{id name description category rank isGeneralSpoiler isMediaSpoiler isAdult}
averageScore meanScore weightedScore popularity favourites trending
rankings{rank type format year season allTime}
trailer{id site thumbnail}
siteUrl
externalLinks{id url site type language color icon notes isDisabled}
streamingEpisodes{title thumbnail url site}
nextAiringEpisode{airingAt timeUntilAiring episode}
airingSchedule(perPage:50){nodes{id airingAt timeUntilAiring episode}}
relations{edges{id relationType} nodes{id type format title{romaji english native} coverImage{large} status}}
characters(perPage:25,sort:[ROLE,RELEVANCE]){edges{id role node{id name{full native} image{large} description(asHtml:false) gender age dateOfBirth{year month day} bloodType favourites}}}
staff(perPage:25){edges{id role node{id name{full native} image{large} languageV2 primaryOccupations homeTown age dateOfBirth{year month day} favourites}}}
studios{edges{id isMain node{id name siteUrl}}}
stats{scoreDistribution{score amount} statusDistribution{status amount}}
reviews(perPage:5){nodes{id summary body(asHtml:false) rating ratingAmount score user{id name}}}
recommendations(perPage:10,sort:RATING_DESC){nodes{rating mediaRecommendation{id type title{romaji english}}}}
`;

interface AniMedia {
  id: number; idMal?: number; type: "ANIME" | "MANGA"; format?: string; status?: string;
  isAdult?: boolean; countryOfOrigin?: string; source?: string; hashtag?: string;
  title: { romaji?: string; english?: string; native?: string; userPreferred?: string };
  synonyms?: string[]; description?: string; startDate?: any; endDate?: any;
  season?: string; seasonYear?: number; episodes?: number; duration?: number;
  chapters?: number; volumes?: number; updatedAt?: number;
  coverImage?: any; bannerImage?: string; genres?: string[]; tags?: any[];
  averageScore?: number; meanScore?: number; popularity?: number; favourites?: number;
  trending?: number; rankings?: any[]; trailer?: any; siteUrl?: string;
  externalLinks?: any[]; streamingEpisodes?: any[]; nextAiringEpisode?: any;
  airingSchedule?: { nodes: any[] }; relations?: any; characters?: any; staff?: any;
  studios?: any; stats?: any; reviews?: any; recommendations?: any;
}

const KIND: Record<string, Kind> = {
  TV: "anime", TV_SHORT: "anime", ONA: "anime", OVA: "anime", SPECIAL: "anime",
  MOVIE: "anime_movie", MUSIC: "music_video", MANGA: "manga", NOVEL: "book", ONE_SHOT: "manga",
};

function map(m: AniMedia): Entity {
  const type: Kind = m.type === "MANGA" ? (m.format === "NOVEL" ? "book" : "manga") : (KIND[m.format ?? ""] ?? "anime");
  const e = baseEntity(type, m.title.english || m.title.romaji || m.title.native || `AniList ${m.id}`, "anilist", m.siteUrl);
  addId(e, "anilist", String(m.id));
  if (m.idMal) addId(e, "mal", String(m.idMal));
  e.title.romaji = m.title.romaji ?? null;
  e.title.english = m.title.english ?? null;
  e.title.native = m.title.native ?? null;
  e.title.aliases = m.synonyms ?? [];
  e.urls.anilist = m.siteUrl ?? "";
  e.description.long = { en: stripHtml(m.description) };
  e.description.synopsis = m.description ? { en: stripHtml(m.description) } : {};
  e.images.poster = [m.coverImage?.extraLarge, m.coverImage?.large, m.coverImage?.medium].filter(Boolean);
  e.images.banner = m.bannerImage ? [m.bannerImage] : [];
  if (m.coverImage?.color) e.images.dominant_color = m.coverImage.color;
  e.dates.start = dateParts(m.startDate) ?? null;
  e.dates.end = dateParts(m.endDate) ?? null;
  e.status.state = m.status === "RELEASING" ? "releasing" : m.status === "FINISHED" ? "finished"
    : m.status === "NOT_YET_RELEASED" ? "upcoming" : m.status === "CANCELLED" ? "cancelled" : m.status === "HIATUS" ? "hiatus" : "unknown";
  e.classification.genres = m.genres ?? [];
  e.classification.is_adult = m.isAdult ?? null;
  e.classification.tags = (m.tags ?? []).map((t) => ({
    name: t.name, category: t.category, rank: t.rank, spoiler: t.isGeneralSpoiler || t.isMediaSpoiler, adult: t.isAdult,
  }));
  e.classification.themes = (m.tags ?? []).filter((t) => t.category === "Theme").map((t) => t.name);
  e.classification.demographics = (m.tags ?? []).filter((t) => t.category === "Demographic").map((t) => t.name);
  e.classification.content_warnings = (m.tags ?? []).filter((t) => t.isGeneralSpoiler).map((t) => t.name);
  e.metrics.score = m.averageScore ?? null;
  e.metrics.score_scale = m.averageScore != null ? 100 : null;
  e.metrics.mean_score = m.meanScore ?? null;
  e.metrics.popularity = m.popularity ?? null;
  e.metrics.favourites = m.favourites ?? null;
  e.metrics.trending = m.trending ?? null;
  e.metrics.rank = (m.rankings ?? []).find((r) => r.type === "RANKED" && r.allTime)?.rank ?? null;
  e.metrics.distributions = Object.fromEntries((m.stats?.statusDistribution ?? []).map((s: any) => [s.status, s.amount]));
  e.metrics.rating_breakdown = Object.fromEntries((m.stats?.scoreDistribution ?? []).map((s: any) => [String(s.score), s.amount]));
  e.technical.episode_runtime_minutes = m.duration ?? null;
  e.technical.runtime_minutes = m.duration && m.episodes ? m.duration * m.episodes : null;
  e.manga.demographic = (m.tags ?? []).find((t) => t.category === "Demographic")?.name ?? null;
  e.literature.pages = null;
  e.broadcast.country = m.countryOfOrigin ?? null;
  e.media.trailers = m.trailer ? [{ id: m.trailer.id, site: m.trailer.site, thumbnail: m.trailer.thumbnail, url: m.trailer.site === "youtube" ? `https://youtube.com/watch?v=${m.trailer.id}` : null }] : [];
  e.availability.streaming = (m.streamingEpisodes ?? []).map((s) => ({ provider: s.site ?? "unknown", url: s.url, kind: "subscription" as const, title: s.title }));
  e.links = (m.externalLinks ?? []).map((l) => ({ url: l.url, site: l.site, kind: l.type, language: l.language, color: l.color, icon: l.icon, is_official: true }));
  e.availability.official_site = m.siteUrl ?? null;
  for (const edge of m.relations?.edges ?? []) {
    const node = (m.relations?.nodes ?? []).find((n: any) => n.id === edge.id);
    if (!node) continue;
    e.relations.push({
      kind: relationKind(edge.relationType), target_id: `anilist:${node.id}`,
      title: node.title?.english || node.title?.romaji || null,
      target: undefined, sources: [src("anilist", m.siteUrl)],
    });
    const target = baseEntity(KIND[node.format ?? ""] ?? (node.type === "MANGA" ? "manga" : "anime"), node.title?.romaji ?? String(node.id), "anilist");
    addId(target, "anilist", String(node.id));
    target.images.poster = node.coverImage?.large ? [node.coverImage.large] : [];
    target.status.state = node.status === "RELEASING" ? "releasing" : node.status === "FINISHED" ? "finished" : "unknown";
    e.relations[e.relations.length - 1].target = target;
  }
  for (const edge of m.characters?.edges ?? []) {
    const n = edge.node;
    e.credits.push({
      person: { id: `anilist_character_${n.id}`, name: n.name?.full ?? n.name?.native ?? "Unknown", kind: "character", image: n.image?.large ?? null, external_ids: { anilist: [String(n.id)] } },
      role: edge.role, character: null, voice: false, sources: [src("anilist", m.siteUrl)],
    });
  }
  for (const edge of m.staff?.edges ?? []) {
    const n = edge.node;
    e.credits.push({
      person: {
        id: `anilist_staff_${n.id}`, name: n.name?.full ?? n.name?.native ?? "Unknown", kind: "person", image: n.image?.large ?? null,
        external_ids: { anilist: [String(n.id)] }, country: null,
      },
      role: edge.role, character: null, voice: false, department: "staff", sources: [src("anilist", m.siteUrl)],
    });
  }
  for (const edge of m.studios?.edges ?? []) {
    const n = edge.node;
    const ref = { id: `anilist_studio_${n.id}`, name: n.name, kind: "studio" as const, url: n.siteUrl ?? null, external_ids: { anilist: [String(n.id)] } };
    if (edge.isMain) e.companies.studios.push(ref); else e.companies.production.push(ref);
  }
  if (m.nextAiringEpisode) {
    e.status.is_upcoming = true;
    e.dates.airing = { date: new Date(m.nextAiringEpisode.airingAt * 1000).toISOString(), precision: "second" };
  }
  for (const node of m.airingSchedule?.nodes ?? []) {
    e.episodes.push({
      id: `anilist_ep_${m.id}_${node.episode}`, number: node.episode,
      air_date: new Date(node.airingAt * 1000).toISOString(), kind: "regular",
      sources: [src("anilist", m.siteUrl)],
    });
  }
  e.raw.anilist = m;
  tag(e, `source:${m.source ?? "unknown"}`);
  e.score = (m.popularity ?? 0) / 1000 + (m.averageScore ?? 0) / 100;
  return e;
}

function relationKind(r: string): any {
  const map: Record<string, string> = {
    SEQUEL: "sequel", PREQUEL: "prequel", SIDE_STORY: "side_story", SPIN_OFF: "spin_off",
    ADAPTATION: "adaptation", ALTERNATIVE: "alternative", PARENT: "parent", CHARACTER: "character",
    SUMMARY: "summary", COMPILATION: "compilation", CONTAINS: "child", OTHER: "alternative",
  };
  return map[r] ?? "alternative";
}

async function query(ctx: ProviderContext, body: string, vars: Record<string, unknown>) {
  const res = await postJson<any>(ENDPOINT, { query: body, variables: vars }, {
    provider: "anilist", ttlMs: CACHE, headers: { "content-type": "application/json" }, timeoutMs: 15_000,
  });
  if (res.data.errors?.length) throw new Error(res.data.errors.map((e: any) => e.message).join("; "));
  return res.data.data;
}

const SEARCH = `query($q:String,$type:MediaType,$page:Int,$per:Int){Page(page:$page,perPage:$per){pageInfo{total currentPage lastPage hasNextPage} media(search:$q,type:$type,sort:SEARCH_MATCH){${MEDIA_FIELDS}}}}`;
const GET = `query($id:Int){Media(id:$id){${MEDIA_FIELDS}}}`;
const TRENDING = `query($type:MediaType,$page:Int,$per:Int){Page(page:$page,perPage:$per){media(type:$type,sort:TRENDING_DESC){${MEDIA_FIELDS}}}}`;
const DISCOVER = `query($type:MediaType,$genre:String,$year:Int,$sort:[MediaSort],$page:Int,$per:Int){Page(page:$page,perPage:$per){media(type:$type,genre:$genre,seasonYear:$year,sort:$sort){${MEDIA_FIELDS}}}}`;
const SCHEDULE = `query($from:Int,$to:Int,$page:Int,$per:Int){Page(page:$page,perPage:$per){airingSchedules(airingAt_greater:$from,airingAt_lesser:$to,sort:TIME){airingAt episode media{${MEDIA_FIELDS}}}}}`;

export const anilist: Provider = {
  id: "anilist", name: "AniList", domains: ["anime", "reading"], priority: 10,
  kinds: ["anime", "anime_movie", "manga"],
  operations: ["search", "get", "trending", "discover", "schedule", "characters" as any, "episodes", "related"] as any,
  auth: "none", base: "https://graphql.anilist.co", license: "AniList ToS; community data",
  freshness: "realtime; 60s cache", homepage: "https://anilist.co",
  notes: "GraphQL, full introspection. Primary anime/manga identity source.",
  async search(ctx, q) {
    const [animeData, mangaData] = await Promise.all([
      query(ctx, SEARCH, { q, type: "ANIME", per: Math.min(ctx.limit, 25), page: 1 }),
      query(ctx, SEARCH, { q, type: "MANGA", per: Math.min(ctx.limit, 25), page: 1 }),
    ]);
    return [...(animeData.Page?.media ?? []).map(map), ...(mangaData.Page?.media ?? []).map(map)];
  },
  async get(ctx, ref) {
    const id = ref.externalIds?.anilist ?? ref.id;
    if (!/^\d+$/.test(id)) return null;
    const data = await query(ctx, GET, { id: Number(id) });
    return data.Media ? map(data.Media) : null;
  },
  async trending(ctx, kind) {
    const data = await query(ctx, TRENDING, { type: kind === "manga" ? "MANGA" : "ANIME", per: Math.min(ctx.limit, 25), page: 1 });
    return (data.Page?.media ?? []).map(map);
  },
  async discover(ctx, p) {
    const data = await query(ctx, DISCOVER, { type: p.kind === "manga" ? "MANGA" : "ANIME", genre: p.genre, year: p.year, sort: ["POPULARITY_DESC"], per: Math.min(ctx.limit, 25), page: 1 });
    return (data.Page?.media ?? []).map(map);
  },
  async schedule(ctx, p) {
    const from = Math.floor(Date.parse(p.from) / 1000);
    const to = Math.floor(Date.parse(p.to) / 1000);
    const data = await query(ctx, SCHEDULE, { from, to, per: Math.min(ctx.limit, 50), page: 1 });
    return (data.Page?.airingSchedules ?? []).map((s: any) => {
      const e = map(s.media);
      e.kind = "anime_episode";
      e.name = `${e.name} episode ${s.episode}`;
      e.external_ids.anilist_episode = [`${e.external_ids.anilist?.[0]}:${s.episode}`];
      e.dates.airing = { date: new Date(s.airingAt * 1000).toISOString(), precision: "second" };
      e.episodes = [{ id: `anilist_ep_${e.external_ids.anilist?.[0]}_${s.episode}`, number: s.episode, air_date: new Date(s.airingAt * 1000).toISOString(), kind: "regular" }];
      return e;
    });
  },
  async episodes(ctx, id) {
    const data = await query(ctx, GET, { id: Number(id) });
    if (!data.Media) return [];
    return (data.Media.airingSchedule?.nodes ?? []).map((n: any) => {
      const e = baseEntity("anime_episode", `${data.Media.title.romaji} ${n.episode}`, "anilist");
      e.episodes = [{ id: `anilist_ep_${data.Media.id}_${n.episode}`, number: n.episode, air_date: new Date(n.airingAt * 1000).toISOString(), kind: "regular" }];
      addId(e, "anilist", String(data.Media.id));
      return e;
    });
  },
  async related(ctx, id) {
    const e = await this.get!(ctx, { id });
    return (e?.relations ?? []).map((r) => r.target).filter(Boolean) as Entity[];
  },
};

export default anilist;
