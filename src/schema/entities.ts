/**
 * The MetaFlux record schema.
 *
 * Design rules:
 * 1. Superset: every field any provider can supply has a home here. Missing data
 *    is `null`, never absent-by-shape.
 * 2. Every scalar can be attributed. `_sources` maps a dotted field path to the
 *    provider, route and timestamp that produced it.
 * 3. `raw` keeps provider payloads so consumers can bypass normalization.
 * 4. Objects are passthrough: a new provider field never requires a breaking
 *    schema change.
 */
import { z } from "zod";

export const KINDS = [
  "movie", "tv_show", "tv_season", "tv_episode", "tv_special", "award_show",
  "anime", "anime_episode", "anime_movie",
  "manga", "manhwa", "manhua", "webtoon", "comic", "comic_issue", "comic_series",
  "book", "book_edition", "audiobook", "short_story", "poem",
  "music_artist", "music_group", "music_album", "music_track", "music_video",
  "concert", "tour", "festival",
  "sports_league", "sports_team", "sports_player", "sports_event", "sports_venue", "sports_season",
  "iptv_channel", "iptv_stream", "radio_station",
  "idol", "idol_group", "vtuber", "vtuber_group",
  "person", "character", "studio", "company", "network", "label", "publisher",
  "award", "genre", "country", "language", "schedule_entry", "collection", "software", "podcast",
] as const;

export const Kind = z.enum(KINDS);
export type Kind = (typeof KINDS)[number];

export const DOMAINS = [
  "screen", "anime", "reading", "music", "sports", "live", "people", "meta",
] as const;
export type Domain = (typeof DOMAINS)[number];

export const CONFIDENCE = ["verified", "probable", "possible", "unverified"] as const;

export const Text = z.record(z.string(), z.string()).describe("BCP-47 language tag -> text");
export const Strings = z.array(z.string());
export const Url = z.string();

export const SourceRef = z.object({
  provider: z.string(),
  route: z.string().nullish(),
  url: z.string().nullish(),
  fetched_at: z.string().datetime(),
  confidence: z.enum(CONFIDENCE).default("verified"),
  sha256: z.string().nullish(),
  license: z.string().nullish(),
  note: z.string().nullish(),
}).passthrough();

export const ExternalIds = z.record(z.string(), z.array(z.string())).describe(
  "provider -> ids. imdb, tmdb, tvdb, tvmaze, anilist, mal, anidb, mangadex, mangaupdates, comick, openlibrary, isbn10/13, oclc, lccn, doi, musicbrainz, deezer, itunes, isrc, upc, wikidata, espn, thesportsdb, mlb, nhl, iptv, radio, youtube, twitch, holodex, mdl, mydramalist, comicvine",
);

export const Title = z.object({
  display: z.string(),
  romaji: z.string().nullish(),
  english: z.string().nullish(),
  native: z.string().nullish(),
  sort: z.string().nullish(),
  short: z.string().nullish(),
  full: z.string().nullish(),
  acronym: z.string().nullish(),
  aliases: Strings.default([]),
  localized: Text.default({} as any),
  transliterations: Strings.default([]),
  former: Strings.default([]),
  is_placeholder: z.boolean().nullish(),
}).passthrough();

export const Description = z.object({
  tagline: Text.default({} as any),
  short: Text.default({} as any),
  long: Text.default({} as any),
  synopsis: Text.default({} as any),
  outline: Text.default({} as any),
  notes: Text.default({} as any),
  trivia: Text.default({} as any),
  warning: Text.default({} as any),
  quote: Text.default({} as any),
}).passthrough();

export const ImageSet = z.object({
  poster: Strings.default([]),
  backdrop: Strings.default([]),
  banner: Strings.default([]),
  logo: Strings.default([]),
  clearart: Strings.default([]),
  cutout: Strings.default([]),
  thumbnail: Strings.default([]),
  icon: Strings.default([]),
  fanart: Strings.default([]),
  screenshots: Strings.default([]),
  profile: Strings.default([]),
  cover: Strings.default([]),
  hero: Strings.default([]),
  color: Strings.default([]),
  blurhash: Strings.default([]),
  aspect_ratio: z.number().nullish(),
  width: z.number().nullish(),
  height: z.number().nullish(),
  dominant_color: z.string().nullish(),
}).passthrough();

export const DateParts = z.object({
  year: z.number().nullish(),
  month: z.number().nullish(),
  day: z.number().nullish(),
  date: z.string().nullish(),
  time: z.string().nullish(),
  timezone: z.string().nullish(),
  precision: z.enum(["year", "month", "day", "minute", "second"]).nullish(),
}).passthrough();

export const Dates = z.object({
  start: DateParts.nullish(),
  end: DateParts.nullish(),
  premiere: DateParts.nullish(),
  finale: DateParts.nullish(),
  airing: DateParts.nullish(),
  release: DateParts.nullish(),
  announced: DateParts.nullish(),
  cancelled: DateParts.nullish(),
  founded: DateParts.nullish(),
  born: DateParts.nullish(),
  died: DateParts.nullish(),
  debut: DateParts.nullish(),
  graduation: DateParts.nullish(),
  last_updated: DateParts.nullish(),
  added: DateParts.nullish(),
  modified: DateParts.nullish(),
}).passthrough();

export const Status = z.object({
  state: z.enum([
    "announced", "upcoming", "airing", "releasing", "ongoing", "completed",
    "finished", "hiatus", "cancelled", "ended", "live", "scheduled", "postponed",
    "discontinued", "unknown",
  ]).default("unknown"),
  comment: Text.default({} as any),
  is_upcoming: z.boolean().nullish(),
  is_airing: z.boolean().nullish(),
  is_complete: z.boolean().nullish(),
  is_cancelled: z.boolean().nullish(),
  is_live: z.boolean().nullish(),
  quality: z.enum(["verified", "unverified", "rumor"]).nullish(),
}).passthrough();

export const Metrics = z.object({
  score: z.number().nullish(),
  score_scale: z.number().nullish(),
  weighted_score: z.number().nullish(),
  mean_score: z.number().nullish(),
  votes: z.number().nullish(),
  rank: z.number().nullish(),
  rank_context: z.string().nullish(),
  popularity: z.number().nullish(),
  trending: z.number().nullish(),
  favourites: z.number().nullish(),
  followers: z.number().nullish(),
  members: z.number().nullish(),
  views: z.number().nullish(),
  subscribers: z.number().nullish(),
  likes: z.number().nullish(),
  comments: z.number().nullish(),
  downloads: z.number().nullish(),
  plays: z.number().nullish(),
  listeners: z.number().nullish(),
  viewers: z.number().nullish(),
  concurrent_viewers: z.number().nullish(),
  rating_breakdown: z.record(z.string(), z.number()).default({} as any),
  distributions: z.record(z.string(), z.number()).default({} as any),
}).passthrough();

export const PersonRef = z.object({
  id: z.string().nullish(),
  name: z.string(),
  native_name: z.string().nullish(),
  occupations: Strings.optional(),
  kind: z.string().default("person"),
  image: z.string().nullish(),
  url: z.string().nullish(),
  external_ids: ExternalIds.optional(),
  language: z.string().nullish(),
  country: z.string().nullish(),
}).passthrough();

export const Credit = z.object({
  person: PersonRef,
  role: z.string().nullish(),
  character: PersonRef.nullish(),
  voice: z.boolean().default(false),
  order: z.number().nullish(),
  department: z.string().nullish(),
  job: z.string().nullish(),
  as: z.string().nullish(),
  episodes: z.array(z.string()).optional(),
  /** Spoken language of a voice credit (`Japanese`, `English`). */
  language: z.string().nullish(),
  /** On a character credit: who voices the character, per language. */
  voices: z.array(z.object({ person: PersonRef, language: z.string().nullish() }).passthrough()).optional(),
  sources: z.array(SourceRef).optional(),
}).passthrough();

export const Companies = z.object({
  production: z.array(PersonRef).default([]),
  studios: z.array(PersonRef).default([]),
  distributors: z.array(PersonRef).default([]),
  publishers: z.array(PersonRef).default([]),
  labels: z.array(PersonRef).default([]),
  networks: z.array(PersonRef).default([]),
  licensors: z.array(PersonRef).default([]),
  developers: z.array(PersonRef).default([]),
}).passthrough();

export const RelationEdge = z.object({
  kind: z.enum([
    "sequel", "prequel", "side_story", "spin_off", "adaptation", "source",
    "alternative", "parent", "child", "season", "episode", "chapter", "volume",
    "track", "album", "member", "subgroup", "solo", "collaboration", "remake",
    "reboot", "compilation", "summary", "character", "staff", "venue", "tour",
    "league", "team", "player", "event", "edition", "translation", "recommendation", "collection", "software", "podcast",
  ]),
  target_id: z.string().nullish(),
  target: z.lazy((): z.ZodTypeAny => Entity).nullish(),
  title: z.string().nullish(),
  direction: z.enum(["outgoing", "incoming"]).optional(),
  /** Free-text role on a person->work edge (`Director`, `MAIN`, `Voice Actor`). */
  role: z.string().nullish(),
  weight: z.number().nullish(),
  note: Text.optional(),
  sources: z.array(SourceRef).optional(),
}).passthrough();

export const Chapter = z.object({
  id: z.string(),
  number: z.string().nullish(),
  volume: z.string().nullish(),
  title: z.string().nullish(),
  language: z.string().nullish(),
  pages: z.number().nullish(),
  published_at: z.string().nullish(),
  updated_at: z.string().nullish(),
  external_url: z.string().nullish(),
  scanlation_group: z.string().nullish(),
  sources: z.array(SourceRef).optional(),
}).passthrough();

export const Episode = z.object({
  id: z.string(),
  season: z.number().nullish(),
  number: z.number().nullish(),
  absolute_number: z.number().nullish(),
  title: z.string().nullish(),
  /** Episode title per language (`en`, `ja`, `x-jat` romaji, ...). */
  titles: Text.optional(),
  description: Text.optional(),
  air_date: z.string().nullish(),
  air_time: z.string().nullish(),
  runtime: z.number().nullish(),
  image: z.string().nullish(),
  rating: z.number().nullish(),
  votes: z.number().nullish(),
  is_filler: z.boolean().nullish(),
  is_recap: z.boolean().nullish(),
  /** Ids of this episode at other services (`tvdb`, `anidb`, `tmdb`, `imdb`). */
  external_ids: ExternalIds.optional(),
  kind: z.enum(["regular", "special", "recap", "ova", "ona", "movie", "filler", "unknown"]).optional(),
  sources: z.array(SourceRef).optional(),
}).passthrough();

export const Season = z.object({
  id: z.string().nullish(),
  number: z.number(),
  title: z.string().nullish(),
  description: Text.optional(),
  air_date: z.string().nullish(),
  end_date: z.string().nullish(),
  episodes: z.number().nullish(),
  image: z.string().nullish(),
  score: z.number().nullish(),
  sources: z.array(SourceRef).default([]),
}).passthrough();

export const Track = z.object({
  id: z.string(),
  number: z.number().nullish(),
  disc: z.number().nullish(),
  title: z.string().nullish(),
  duration_ms: z.number().nullish(),
  isrc: z.string().nullish(),
  preview_url: z.string().nullish(),
  explicit: z.boolean().nullish(),
  bpm: z.number().nullish(),
  musical_key: z.string().nullish(),
  rank: z.number().nullish(),
  lyrics: z.object({ plain: z.string().nullish(), synced: z.string().nullish(), language: z.string().nullish(), source: z.string().nullish() }).nullish(),
  credits: z.array(Credit).optional(),
  sources: z.array(SourceRef).optional(),
}).passthrough();

export const StreamOption = z.object({
  provider: z.string(),
  region: z.array(z.string()).optional(),
  url: z.string().nullish(),
  kind: z.enum(["subscription", "free", "ads", "rent", "buy", "linear", "iptv", "radio", "embed", "download", "trailer"]).optional(),
  quality: z.string().nullish(),
  audio: Strings.optional(),
  subtitles: Strings.optional(),
  price: z.object({ amount: z.number().nullish(), currency: z.string().nullish(), period: z.string().nullish() }).nullish(),
  drm: z.string().nullish(),
  expires_at: z.string().nullish(),
  is_official: z.boolean().nullish(),
  sources: z.array(SourceRef).optional(),
}).passthrough();

export const Availability = z.object({
  regions: Strings.default([]),
  streaming: z.array(StreamOption).default([]),
  linear: z.array(StreamOption).default([]),
  iptv: z.array(StreamOption).default([]),
  radio: z.array(StreamOption).default([]),
  rental: z.array(StreamOption).default([]),
  purchase: z.array(StreamOption).default([]),
  free: z.array(StreamOption).default([]),
  downloads: z.array(StreamOption).default([]),
  official_site: z.string().nullish(),
  where_to_watch_url: z.string().nullish(),
}).passthrough();

export const Technical = z.object({
  runtime_minutes: z.number().nullish(),
  episode_runtime_minutes: z.number().nullish(),
  episode_count: z.number().nullish(),
  special_count: z.number().nullish(),
  season_count: z.number().nullish(),
  total_runtime_minutes: z.number().nullish(),
  resolution: z.string().nullish(),
  width: z.number().nullish(),
  height: z.number().nullish(),
  aspect_ratio: z.string().nullish(),
  fps: z.number().nullish(),
  bitrate_kbps: z.number().nullish(),
  video_codec: z.string().nullish(),
  audio_codec: z.string().nullish(),
  audio_channels: z.string().nullish(),
  container: z.string().nullish(),
  audio_languages: Strings.default([]),
  subtitle_languages: Strings.default([]),
  is_subtitled: z.boolean().nullish(),
  is_dubbed: z.boolean().nullish(),
  is_color: z.boolean().nullish(),
  is_3d: z.boolean().nullish(),
  is_hdr: z.boolean().nullish(),
  has_chapters: z.boolean().nullish(),
  page_count: z.number().nullish(),
  word_count: z.number().nullish(),
  file_size_bytes: z.number().nullish(),
  formats: Strings.default([]),
  drm: Strings.default([]),
}).passthrough();

export const Broadcast = z.object({
  network: PersonRef.nullish(),
  web_channel: PersonRef.nullish(),
  country: z.string().nullish(),
  timezone: z.string().nullish(),
  time: z.string().nullish(),
  days: Strings.default([]),
  schedule: z.array(z.object({ day: z.string(), time: z.string().nullish(), timezone: z.string().nullish() })).default([]),
  /** The next scheduled broadcast, when one is announced. */
  next_episode: z.object({ number: z.number(), airing_at: z.string(), time_until_s: z.number().nullish(), precision: z.enum(["minute", "day"]).nullish() }).passthrough().nullish(),
  is_simulcast: z.boolean().nullish(),
  is_subbed: z.boolean().nullish(),
  is_dubbed: z.boolean().nullish(),
}).passthrough();

export const MangaInfo = z.object({
  demographic: z.string().nullish(),
  publication: z.string().nullish(),
  serialization: z.string().nullish(),
  magazine: z.string().nullish(),
  imprint: z.string().nullish(),
  is_oneshot: z.boolean().nullish(),
  is_doujin: z.boolean().nullish(),
  is_colored: z.boolean().nullish(),
  is_webtoon: z.boolean().nullish(),
  reading_direction: z.enum(["ltr", "rtl", "vertical"]).nullish(),
  original_language: z.string().nullish(),
  translated_languages: Strings.default([]),
  available_chapters: z.number().nullish(),
  chapter_count: z.number().nullish(),
  volume_count: z.number().nullish(),
  latest_chapter: z.string().nullish(),
  latest_volume: z.string().nullish(),
  chapter_reset_on_volume: z.boolean().nullish(),
  scanlation_groups: Strings.default([]),
  official_links: z.array(StreamOption).default([]),
  chapters: z.array(Chapter).default([]),
  volumes: z.array(z.object({ number: z.string(), title: z.string().nullish(), chapters: z.array(Chapter).default([]), cover: z.string().nullish() }).passthrough()).default([]),
}).passthrough();

export const LiteratureInfo = z.object({
  isbn10: Strings.default([]),
  isbn13: Strings.default([]),
  issn: Strings.default([]),
  lccn: Strings.default([]),
  oclc: Strings.default([]),
  doi: Strings.default([]),
  dewey: Strings.default([]),
  pages: z.number().nullish(),
  word_count: z.number().nullish(),
  reading_level: z.string().nullish(),
  audience: z.string().nullish(),
  edition: z.string().nullish(),
  edition_number: z.number().nullish(),
  printing: z.string().nullish(),
  imprint: z.string().nullish(),
  binding: z.string().nullish(),
  format: z.string().nullish(),
  series: z.array(RelationEdge).default([]),
  subjects: Strings.default([]),
  fulltext_url: z.string().nullish(),
  ia_identifier: z.string().nullish(),
  lending: z.object({ available: z.boolean().nullish(), status: z.string().nullish(), url: z.string().nullish() }).nullish(),
  copyright: z.object({ status: z.string().nullish(), year: z.number().nullish(), holder: z.string().nullish(), license: z.string().nullish() }).nullish(),
}).passthrough();

export const MusicInfo = z.object({
  artist: z.array(PersonRef).default([]),
  album: PersonRef.nullish(),
  release_type: z.string().nullish(),
  release_status: z.string().nullish(),
  release_country: z.string().nullish(),
  label: z.array(PersonRef).default([]),
  catalog_number: z.string().nullish(),
  barcode: z.string().nullish(),
  isrc: Strings.default([]),
  upc: Strings.default([]),
  bpm: z.number().nullish(),
  musical_key: z.string().nullish(),
  duration_ms: z.number().nullish(),
  explicit: z.boolean().nullish(),
  is_instrumental: z.boolean().nullish(),
  track_count: z.number().nullish(),
  disc_count: z.number().nullish(),
  genres: Strings.default([]),
  styles: Strings.default([]),
  moods: Strings.default([]),
  preview_url: z.string().nullish(),
  stream_url: z.string().nullish(),
  lyrics: Track.shape.lyrics,
  credits: z.array(Credit).default([]),
  tracks: z.array(Track).default([]),
  discs: z.array(z.object({ number: z.number(), title: z.string().nullish(), tracks: z.array(Track).default([]) }).passthrough()).default([]),
  related_projects: z.array(RelationEdge).default([]),
}).passthrough();

export const SportsInfo = z.object({
  sport: z.string().nullish(),
  league: PersonRef.nullish(),
  season: z.string().nullish(),
  round: z.string().nullish(),
  week: z.number().nullish(),
  venue: PersonRef.nullish(),
  city: z.string().nullish(),
  country: z.string().nullish(),
  home_team: PersonRef.nullish(),
  away_team: PersonRef.nullish(),
  home_score: z.number().nullish(),
  away_score: z.number().nullish(),
  clock: z.string().nullish(),
  period: z.number().nullish(),
  period_label: z.string().nullish(),
  status_detail: z.string().nullish(),
  officials: z.array(PersonRef).default([]),
  attendance: z.number().nullish(),
  weather: z.object({ condition: z.string().nullish(), temperature_f: z.number().nullish(), wind_mph: z.number().nullish(), humidity: z.number().nullish() }).nullish(),
  odds: z.object({
    provider: z.string().nullish(), details: z.string().nullish(), spread: z.number().nullish(),
    over_under: z.number().nullish(), home_moneyline: z.string().nullish(), away_moneyline: z.string().nullish(),
    home_favorite: z.boolean().nullish(), last_updated: z.string().nullish(),
  }).nullish(),
  standings: z.object({
    rank: z.number().nullish(), wins: z.number().nullish(), losses: z.number().nullish(),
    ties: z.number().nullish(), points: z.number().nullish(), pct: z.number().nullish(),
    games_played: z.number().nullish(), streak: z.string().nullish(), form: z.string().nullish(),
    home: z.record(z.string(), z.number()).default({} as any), away: z.record(z.string(), z.number()).default({} as any),
  }).nullish(),
  lineups: z.array(z.object({ team: PersonRef, players: z.array(PersonRef).default([]), formation: z.string().nullish() }).passthrough()).default([]),
  injuries: z.array(z.object({ team: PersonRef.nullish(), player: PersonRef, status: z.string().nullish(), detail: z.string().nullish(), date: z.string().nullish() }).passthrough()).default([]),
  plays: z.array(z.object({ id: z.string().nullish(), sequence: z.number().nullish(), clock: z.string().nullish(), text: z.string().nullish(), team: PersonRef.nullish(), score: z.string().nullish(), scoring: z.boolean().nullish() }).passthrough()).default([]),
  statistics: z.record(z.string(), z.union([z.number(), z.string()])).default({} as any),
  tickets: Strings.default([]),
  broadcast: Strings.default([]),
}).passthrough();

export const BroadcastLive = z.object({
  is_live: z.boolean().nullish(),
  started_at: z.string().nullish(),
  scheduled_start: z.string().nullish(),
  ended_at: z.string().nullish(),
  viewers: z.number().nullish(),
  likes: z.number().nullish(),
  chat_id: z.string().nullish(),
  topic: z.string().nullish(),
  status: z.string().nullish(),
  clips: z.array(z.object({ id: z.string(), title: z.string().nullish(), url: z.string().nullish(), thumbnail: z.string().nullish(), views: z.number().nullish() }).passthrough()).default([]),
  videos: z.array(z.object({ id: z.string(), title: z.string().nullish(), url: z.string().nullish(), thumbnail: z.string().nullish(), published_at: z.string().nullish(), duration: z.number().nullish(), views: z.number().nullish(), kind: z.string().nullish() }).passthrough()).default([]),
}).passthrough();

export const EventInfo = z.object({
  event_type: z.string().nullish(),
  venue: PersonRef.nullish(),
  city: z.string().nullish(),
  country: z.string().nullish(),
  address: z.string().nullish(),
  coordinates: z.object({ lat: z.number(), lon: z.number() }).nullish(),
  doors_open: z.string().nullish(),
  start: z.string().nullish(),
  end: z.string().nullish(),
  timezone: z.string().nullish(),
  tour: RelationEdge.nullish(),
  lineup: z.array(PersonRef).default([]),
  setlist: z.array(z.object({ order: z.number().nullish(), title: z.string(), info: z.string().nullish(), cover: RelationEdge.nullish(), tape: z.boolean().nullish() }).passthrough()).default([]),
  age_rating: z.string().nullish(),
  ticket_status: z.string().nullish(),
  ticket_url: z.string().nullish(),
  is_streamed: z.boolean().nullish(),
  stream_url: z.string().nullish(),
}).passthrough();

export const IptvInfo = z.object({
  channel_id: z.string().nullish(),
  channel_name: z.string().nullish(),
  alt_names: Strings.default([]),
  network: z.string().nullish(),
  owners: Strings.default([]),
  country: z.string().nullish(),
  country_name: z.string().nullish(),
  subdivision: z.string().nullish(),
  city: z.string().nullish(),
  languages: Strings.default([]),
  categories: Strings.default([]),
  is_nsfw: z.boolean().nullish(),
  launched: z.string().nullish(),
  closed: z.string().nullish(),
  replaced_by: z.string().nullish(),
  website: z.string().nullish(),
  epg_ids: Strings.default([]),
  geo_block: Strings.default([]),
  streams: z.array(StreamOption).default([]),
  stream_count: z.number().nullish(),
  has_epg: z.boolean().nullish(),
}).passthrough();

export const PersonInfo = z.object({
  gender: z.string().nullish(),
  birthday: z.string().nullish(),
  deathday: z.string().nullish(),
  age: z.number().nullish(),
  birthplace: z.string().nullish(),
  home_town: z.string().nullish(),
  nationality: Strings.default([]),
  ethnicity: z.string().nullish(),
  height_cm: z.number().nullish(),
  weight_kg: z.number().nullish(),
  blood_type: z.string().nullish(),
  zodiac: z.string().nullish(),
  occupations: Strings.default([]),
  instruments: Strings.default([]),
  genres: Strings.default([]),
  member_of: z.array(RelationEdge).default([]),
  former_member_of: z.array(RelationEdge).default([]),
  agency: PersonRef.nullish(),
  label: PersonRef.nullish(),
  debut_date: z.string().nullish(),
  graduation_date: z.string().nullish(),
  years_active: z.string().nullish(),
  positions: Strings.default([]),
  socials: z.record(z.string(), z.string()).default({} as any),
  official_site: z.string().nullish(),
  fanclub: z.string().nullish(),
  fandom_name: z.string().nullish(),
  is_group: z.boolean().nullish(),
  member_count: z.number().nullish(),
  subunit_of: z.array(RelationEdge).default([]),
  associated_acts: z.array(RelationEdge).default([]),
  awards: z.array(RelationEdge).default([]),
  discography: z.array(RelationEdge).default([]),
  filmography: z.array(RelationEdge).default([]),
  trivia: Text.default({} as any),
}).passthrough();

export const VtuberInfo = z.object({
  org: z.string().nullish(),
  suborg: z.string().nullish(),
  group: z.string().nullish(),
  unit: z.string().nullish(),
  debut_date: z.string().nullish(),
  graduation_date: z.string().nullish(),
  birthday: z.string().nullish(),
  height_cm: z.number().nullish(),
  character_designer: z.array(PersonRef).default([]),
  character_modeler: z.array(PersonRef).default([]),
  persona: Text.default({} as any),
  oshi_mark: z.string().nullish(),
  fan_name: z.string().nullish(),
  hashtags: z.record(z.string(), Strings.default([])).default({} as any),
  catchphrases: Strings.default([]),
  lore: Text.default({} as any),
  streams: z.array(RelationEdge).default([]),
  songs: z.array(RelationEdge).default([]),
  collabs: z.array(RelationEdge).default([]),
  is_independent: z.boolean().nullish(),
  is_graduated: z.boolean().nullish(),
  is_affiliated: z.boolean().nullish(),
  languages: Strings.default([]),
  content_topics: Strings.default([]),
  youtube: z.object({ channel_id: z.string().nullish(), handle: z.string().nullish(), subscribers: z.number().nullish(), videos: z.number().nullish(), clips: z.number().nullish() }).nullish(),
  twitch: z.object({ login: z.string().nullish(), followers: z.number().nullish() }).nullish(),
  twitter: z.string().nullish(),
}).passthrough();

export const Provenance = z.object({
  generated_at: z.string().datetime(),
  generated_by: z.string().default("metaflux"),
  version: z.string(),
  field_sources: z.record(z.string(), z.array(SourceRef)).default({} as any),
  sources: z.array(SourceRef).default([]),
  warnings: Strings.default([]),
  coverage: z.record(z.string(), z.string()).default({} as any),
  cache: z.object({ hit: z.boolean().default(false), age_ms: z.number().nullish(), ttl_ms: z.number().nullish(), stale: z.boolean().default(false) }).nullish(),
  partial: z.boolean().default(false),
  unavailable: Strings.default([]),
}).passthrough();


export const Classification = z.object({
  genres: Strings.default([]),
  themes: Strings.default([]),
  demographics: Strings.default([]),
  keywords: Strings.default([]),
  content_warnings: Strings.default([]),
  tags: z.array(z.object({ name: z.string(), category: z.string().nullish(), rank: z.number().nullish(), spoiler: z.boolean().nullish(), adult: z.boolean().nullish() }).passthrough()).default([]),
  audience: z.string().nullish(),
  content_rating: z.string().nullish(),
  age_rating: z.string().nullish(),
  is_adult: z.boolean().nullish(),
}).passthrough();

export const MediaInfo = z.object({
  trailers: z.array(z.object({ id: z.string().nullish(), site: z.string().nullish(), title: z.string().nullish(), url: z.string().nullish(), thumbnail: z.string().nullish(), kind: z.string().nullish(), published_at: z.string().nullish() }).passthrough()).default([]),
  videos: z.array(z.any()).default([]),
  screenshots: Strings.default([]),
  theme_songs: z.array(Track).default([]),
  soundtrack: z.array(Track).default([]),
}).passthrough();

export const Entity = z.object({
  id: z.string(),
  kind: Kind,
  domain: z.enum(DOMAINS),
  name: z.string(),
  title: Title,
  /** Release format: TV, TV_SHORT, MOVIE, SPECIAL, OVA, ONA, MUSIC, MANGA, NOVEL, ONE_SHOT, SERIES. */
  format: z.string().nullish(),
  /** Broadcast season (anime): `{ name: "fall", year: 2023 }`. */
  season: z.object({ name: z.enum(["winter", "spring", "summer", "fall"]).nullish(), year: z.number().nullish() }).passthrough().nullish(),
  description: Description.default({} as any),
  images: ImageSet.default({} as any),
  external_ids: ExternalIds.default({} as any),
  urls: z.record(z.string(), z.string()).default({} as any),
  dates: Dates.default({} as any),
  status: Status.default({} as any),
  classification: Classification.default({} as any),
  metrics: Metrics.default({} as any),
  credits: z.array(Credit).default([]),
  companies: Companies.default({} as any),
  relations: z.array(RelationEdge).default([]),
  seasons: z.array(Season).default([]),
  episodes: z.array(Episode).default([]),
  chapters: z.array(Chapter).default([]),
  volumes: z.array(z.any()).default([]),
  tracks: z.array(Track).default([]),
  members: z.array(RelationEdge).default([]),
  availability: Availability.default({} as any),
  technical: Technical.default({} as any),
  broadcast: Broadcast.default({} as any),
  manga: MangaInfo.default({} as any),
  literature: LiteratureInfo.default({} as any),
  music: MusicInfo.default({} as any),
  sports: SportsInfo.default({} as any),
  live: BroadcastLive.default({} as any),
  event: EventInfo.default({} as any),
  iptv: IptvInfo.default({} as any),
  person: PersonInfo.default({} as any),
  vtuber: VtuberInfo.default({} as any),
  media: MediaInfo.default({} as any),
  links: z.array(z.object({ url: z.string(), site: z.string().nullish(), kind: z.string().nullish(), language: z.string().nullish(), is_official: z.boolean().nullish(), color: z.string().nullish(), icon: z.string().nullish() }).passthrough()).default([]),
  raw: z.record(z.string(), z.any()).default({} as any),
  provenance: Provenance,
  score: z.number().default(0),
}).passthrough();

export type Entity = z.infer<typeof Entity>;
export type SourceRef = z.infer<typeof SourceRef>;
export type CreditT = z.infer<typeof Credit>;
export type StreamOptionT = z.infer<typeof StreamOption>;

export const DOMAIN_OF: Record<Kind, Domain> = {
  movie: "screen", tv_show: "screen", tv_season: "screen", tv_episode: "screen",
  tv_special: "screen", award_show: "screen",
  anime: "anime", anime_episode: "anime", anime_movie: "anime",
  manga: "reading", manhwa: "reading", manhua: "reading", webtoon: "reading",
  comic: "reading", comic_issue: "reading", comic_series: "reading",
  book: "reading", book_edition: "reading", audiobook: "reading",
  short_story: "reading", poem: "reading",
  music_artist: "music", music_group: "music", music_album: "music",
  music_track: "music", music_video: "music", concert: "music", tour: "music",
  festival: "music",
  sports_league: "sports", sports_team: "sports", sports_player: "sports",
  sports_event: "sports", sports_venue: "sports", sports_season: "sports",
  iptv_channel: "live", iptv_stream: "live", radio_station: "live",
  idol: "people", idol_group: "people", vtuber: "people", vtuber_group: "people",
  person: "people", character: "people", studio: "people", company: "people",
  network: "people", label: "people", publisher: "people",
  award: "meta", genre: "meta", country: "meta", language: "meta",
  schedule_entry: "meta", collection: "meta", podcast: "screen", software: "meta",
};

export function emptyEntity(kind: Kind, name: string): Entity {
  const e = Entity.parse({
    id: "",
    kind,
    domain: DOMAIN_OF[kind],
    name,
    title: { display: name, aliases: [], localized: {}, transliterations: [], former: [] },
    provenance: { generated_at: new Date().toISOString(), version: "0.1.0", field_sources: {}, sources: [], warnings: [], coverage: {} },
  });
  // `.default({})` does not expand nested defaults, so expand them explicitly.
  e.description = Description.parse({});
  e.images = ImageSet.parse({});
  e.external_ids = ExternalIds.parse({});
  e.urls = {};
  e.format = null;
  e.season = null;
  e.dates = Dates.parse({});
  e.status = Status.parse({});
  e.classification = Classification.parse({});
  e.metrics = Metrics.parse({});
  e.companies = Companies.parse({});
  e.availability = Availability.parse({});
  e.technical = Technical.parse({});
  e.broadcast = Broadcast.parse({});
  e.manga = MangaInfo.parse({});
  e.literature = LiteratureInfo.parse({});
  e.music = MusicInfo.parse({});
  e.sports = SportsInfo.parse({});
  e.live = BroadcastLive.parse({});
  e.event = EventInfo.parse({});
  e.iptv = IptvInfo.parse({});
  e.person = PersonInfo.parse({});
  e.vtuber = VtuberInfo.parse({});
  e.media = MediaInfo.parse({});
  return e;
}
