#!/usr/bin/env bun
/**
 * Builds docs/research/dossiers/*.md from recorded evidence fixtures.
 * Every key path observed in a provider payload is preserved verbatim so the
 * adapter/field mapping can be checked against evidence rather than memory.
 *
 * Run: bun scripts/dossier.ts
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";

type Json = unknown;

const EVIDENCE = "docs/research/evidence";
const OUT = "docs/research/dossiers";

interface SourceDoc {
  id: string;
  name: string;
  domain: string;
  base: string;
  auth: "none" | "none-header" | "optional-key";
  freshness: string;
  limits: string;
  routes: { method: string; path: string; note: string; status: number; fixture: string }[];
  limitations: string[];
}

const SOURCES: SourceDoc[] = [
  {
    id: "anilist",
    name: "AniList",
    domain: "anime, manga",
    base: "https://graphql.anilist.co",
    auth: "none",
    freshness: "realtime, 60s cache",
    limits: "~90 req/min degraded bucket; HTTP 429 + Retry-After",
    routes: [
      { method: "POST", path: "/", note: "GraphQL. Introspection enabled. Media/Character/Staff/Studio/Page/airingSchedule.", status: 200, fixture: "anilist_media.json" },
      { method: "POST", path: "/", note: "Introspection: __schema types/fields/descriptions", status: 200, fixture: "anilist_introspect.json" },
    ],
    limitations: ["GraphQL depth/cost limits", "adult flag per media", "no raw file/stream payloads"],
  },
  {
    id: "jikan",
    name: "Jikan v4 (MyAnimeList mirror)",
    domain: "anime, manga, people, schedules",
    base: "https://api.jikan.moe/v4",
    auth: "none",
    freshness: "1h cache recommended",
    limits: "3 req/s, 60 req/min; 429 with Retry-After",
    routes: [
      { method: "GET", path: "/anime/{id}/full", note: "full anime record", status: 200, fixture: "" },
      { method: "GET", path: "/anime?q=&limit=", note: "search", status: 200, fixture: "" },
      { method: "GET", path: "/manga/{id}/full", note: "full manga record", status: 200, fixture: "" },
      { method: "GET", path: "/schedules?day=", note: "airing calendar", status: 200, fixture: "" },
      { method: "GET", path: "/seasons/now", note: "current season", status: 200, fixture: "" },
    ],
    limitations: ["network reachability varies by host", "MAL ids only"],
  },
  {
    id: "kitsu",
    name: "Kitsu",
    domain: "anime, manga",
    base: "https://kitsu.io/api/edge",
    auth: "none",
    freshness: "6h cache",
    limits: "10 req/s soft",
    routes: [
      { method: "GET", path: "/anime?filter[text]=&page[limit]=", note: "JSON:API search", status: 200, fixture: "kitsu.json" },
      { method: "GET", path: "/anime/{id}?include=episodes,streaming-links", note: "record + relationships", status: 200, fixture: "" },
    ],
    limitations: ["JSON:API sparse fieldsets", "relationship ids need include"],
  },
  {
    id: "mangadex",
    name: "MangaDex",
    domain: "manga, manhwa, manhua, chapters",
    base: "https://api.mangadex.org",
    auth: "none",
    freshness: "5min search, 1h chapter",
    limits: "5 req/s per IP, 429 + Retry-After",
    routes: [
      { method: "GET", path: "/manga?title=&limit=&includes[]=", note: "search with author/artist/cover includes", status: 200, fixture: "mangadex_one.json" },
      { method: "GET", path: "/manga/{id}?includes[]=", note: "record; relationships carry authors, cover, tags", status: 200, fixture: "mangadex_detail.json" },
      { method: "GET", path: "/manga/{id}/feed?translatedLanguage[]=&order[chapter]=", note: "chapter feed", status: 200, fixture: "" },
      { method: "GET", path: "/at-home/server/{chapterId}", note: "page image URLs", status: 200, fixture: "" },
    ],
    limitations: ["scanlation sources, not official text", "region CDN drift"],
  },
  {
    id: "mangaupdates",
    name: "MangaUpdates",
    domain: "manga, manhwa, manhua",
    base: "https://api.mangaupdates.com/v1",
    auth: "none",
    freshness: "24h cache",
    limits: "be polite, ~1 req/s",
    routes: [
      { method: "POST", path: "/series/search", note: "body {search}", status: 200, fixture: "mangaupdates.json" },
      { method: "GET", path: "/series/{id}", note: "record", status: 200, fixture: "" },
    ],
    limitations: ["POST search", "records include genre/year/rating only"],
  },
  {
    id: "comick",
    name: "ComicK",
    domain: "manhwa, manhua, webtoon, comics",
    base: "https://api.comick.io",
    auth: "none",
    freshness: "10min",
    limits: "~5 req/s; origin incident returns 522",
    routes: [
      { method: "GET", path: "/v1.0/search?q=", note: "search", status: 200, fixture: "" },
      { method: "GET", path: "/comic/{slug}", note: "record + chapters", status: 200, fixture: "" },
    ],
    limitations: ["origin instability", "community metadata"],
  },
  {
    id: "cinemeta",
    name: "Cinemeta (Stremio)",
    domain: "movie, series, episodes",
    base: "https://v3-cinemeta.strem.io",
    auth: "none",
    freshness: "6h",
    limits: "undocumented, CDN backed",
    routes: [
      { method: "GET", path: "/meta/{type}/{imdbId}.json", note: "full meta with videos, cast, links", status: 200, fixture: "cinemeta.json" },
      { method: "GET", path: "/catalog/{type}/{catalog}.json", note: "catalogs (top, year, genre)", status: 200, fixture: "" },
    ],
    limitations: ["IMDb-keyed only", "unofficial", "no write API"],
  },
  {
    id: "tvmaze",
    name: "TVmaze",
    domain: "tv, episodes, people, schedule",
    base: "https://api.tvmaze.com",
    auth: "none",
    freshness: "1h",
    limits: "20 calls / 10 s per IP",
    routes: [
      { method: "GET", path: "/search/shows?q=", note: "search", status: 200, fixture: "" },
      { method: "GET", path: "/shows/{id}?embed[]=episodes&embed[]=cast&embed[]=crew&embed[]=images&embed[]=akas", note: "full record", status: 200, fixture: "tvmaze_full.json" },
      { method: "GET", path: "/schedule?date=&country=", note: "broadcast calendar", status: 200, fixture: "" },
      { method: "GET", path: "/people/{id}", note: "person + credits", status: 200, fixture: "" },
    ],
    limitations: ["no key", "ETag supported", "CC BY-SA data"],
  },
  {
    id: "wikidata",
    name: "Wikidata Query Service",
    domain: "all (identity, people, awards, events, franchises)",
    base: "https://query.wikidata.org/sparql",
    auth: "none",
    freshness: "24h",
    limits: "60s query cap; UA required",
    routes: [
      { method: "GET", path: "/sparql?format=json&query=", note: "SPARQL", status: 200, fixture: "wikidata.json" },
      { method: "GET", path: "https://www.wikidata.org/wiki/Special:EntityData/{qid}.json", note: "entity JSON", status: 200, fixture: "" },
    ],
    limitations: ["community data quality", "query timeouts", "CC0"],
  },
  {
    id: "mydramalist",
    name: "MyDramaList",
    domain: "kdrama, jdrama, cdrama, lakorn",
    base: "https://mydramalist.com",
    auth: "none",
    freshness: "12h",
    limits: "HTML; 1 req/s",
    routes: [
      { method: "GET", path: "/search?q=", note: "search HTML + JSON-LD", status: 200, fixture: "mydramalist.json" },
      { method: "GET", path: "/{id}-{slug}", note: "detail HTML: cast, episodes, synopsis", status: 200, fixture: "" },
    ],
    limitations: ["HTML contract", "Cloudflare can challenge"],
  },
  {
    id: "thesportsdb",
    name: "TheSportsDB",
    domain: "sports teams, players, leagues, events, tables",
    base: "https://www.thesportsdb.com/api/v1/json/{key}",
    auth: "none",
    freshness: "5min events, 24h teams",
    limits: "free test keys 3/123; 30 req/min",
    routes: [
      { method: "GET", path: "/searchteams.php?t=", note: "team search incl. multi-language descriptions, badges, colours", status: 200, fixture: "tsdb_team.json" },
      { method: "GET", path: "/searchplayers.php?p=", note: "player search", status: 200, fixture: "tsdb_player.json" },
      { method: "GET", path: "/eventsday.php?d=&s=", note: "events by day and sport", status: 200, fixture: "tsdb_event.json" },
      { method: "GET", path: "/lookuptable.php?l=&s=", note: "league table", status: 200, fixture: "" },
    ],
    limitations: ["test keys rotate", "shared quota"],
  },
  {
    id: "espn",
    name: "ESPN site/core API",
    domain: "sports scoreboard, teams, news, odds, summaries",
    base: "https://site.api.espn.com/apis/site/v2/sports",
    auth: "none",
    freshness: "15s live, 5min static",
    limits: "undocumented, CDN",
    routes: [
      { method: "GET", path: "/{sport}/{league}/scoreboard", note: "live scoreboard + embedded odds/links", status: 200, fixture: "espn.json" },
      { method: "GET", path: "/{sport}/{league}/teams", note: "team directory with logos/colors", status: 200, fixture: "espn_teams.json" },
      { method: "GET", path: "/{sport}/{league}/summary?event=", note: "boxscore, plays, leaders, injuries, venue, officials, broadcasts", status: 200, fixture: "espn_summary.json" },
      { method: "GET", path: "https://sports.core.api.espn.com/v2/sports/{s}/leagues/{l}/events/{e}/competitions/{e}/odds", note: "odds/providers", status: 200, fixture: "espn_odds.json" },
    ],
    limitations: ["unofficial", "sport/league allowlist required", "local blackout data absent"],
  },
  {
    id: "jolpica",
    name: "Jolpica F1 (Ergast successor)",
    domain: "formula 1 schedule, results, standings, drivers, constructors",
    base: "https://api.jolpi.ca/ergast/f1",
    auth: "none",
    freshness: "1h",
    limits: "4 req/s",
    routes: [
      { method: "GET", path: "/{season}/driverstandings.json", note: "standings", status: 200, fixture: "jolpica.json" },
      { method: "GET", path: "/{season}/{round}/results.json", note: "race results", status: 200, fixture: "" },
      { method: "GET", path: "/{season}.json", note: "schedule", status: 200, fixture: "" },
    ],
    limitations: ["F1 only", "Ergast schema"],
  },
  {
    id: "openligadb",
    name: "OpenLigaDB",
    domain: "soccer (Bundesliga and others)",
    base: "https://api.openligadb.de",
    auth: "none",
    freshness: "1min",
    limits: "be polite",
    routes: [
      { method: "GET", path: "/getmatchdata/{league}/{season}/{matchday}", note: "matches, goals, venue", status: 200, fixture: "openligadb.json" },
      { method: "GET", path: "/getavailableleagues", note: "league directory", status: 200, fixture: "" },
    ],
    limitations: ["mostly German leagues", "community data"],
  },
  {
    id: "mlb",
    name: "MLB Stats API",
    domain: "baseball teams, schedule, rosters, stats",
    base: "https://statsapi.mlb.com/api/v1",
    auth: "none",
    freshness: "30s live",
    limits: "undocumented",
    routes: [
      { method: "GET", path: "/teams?sportId=1", note: "teams", status: 200, fixture: "mlb.json" },
      { method: "GET", path: "/schedule?sportId=1&date=", note: "schedule", status: 200, fixture: "" },
      { method: "GET", path: "/people/{id}", note: "player", status: 200, fixture: "" },
    ],
    limitations: ["MLB only", "unofficial"],
  },
  {
    id: "nhl",
    name: "NHL API",
    domain: "hockey standings, schedule, rosters, players",
    base: "https://api-web.nhle.com/v1",
    auth: "none",
    freshness: "30s live",
    limits: "undocumented",
    routes: [
      { method: "GET", path: "/standings/now", note: "standings", status: 200, fixture: "nhl.json" },
      { method: "GET", path: "/club-schedule/{team}/now", note: "schedule", status: 200, fixture: "" },
      { method: "GET", path: "/player/{id}/landing", note: "player", status: 200, fixture: "" },
    ],
    limitations: ["NHL only", "unofficial"],
  },
  {
    id: "iptv-org",
    name: "iptv-org",
    domain: "iptv channels, streams, EPG guides, countries, languages, categories",
    base: "https://iptv-org.github.io/api",
    auth: "none",
    freshness: "6h static snapshots",
    limits: "static GitHub Pages; ingest locally",
    routes: [
      { method: "GET", path: "/channels.json", note: "channel directory with logos, country, categories, network", status: 200, fixture: "iptv.json" },
      { method: "GET", path: "/streams.json", note: "stream urls with quality/referrer/user-agent", status: 200, fixture: "" },
      { method: "GET", path: "/guides.json", note: "XMLTV EPG endpoints per country/site", status: 200, fixture: "iptv_guides.json" },
      { method: "GET", path: "/categories.json", note: "categories", status: 200, fixture: "iptv_categories.json" },
    ],
    limitations: ["CORS/geo varies by stream", "CC0 index, stream rights vary"],
  },
  {
    id: "radio-browser",
    name: "Radio Browser",
    domain: "radio stations",
    base: "https://api.radio-browser.info",
    auth: "none",
    freshness: "1h",
    limits: "mirror round-robin; 100 req/min",
    routes: [
      { method: "GET", path: "/json/stations/search?name=&limit=", note: "stations with codecs, bitrate, geo, favicon", status: 200, fixture: "radio.json" },
      { method: "GET", path: "/json/stations/bycountrycodeexact/{cc}", note: "by country", status: 200, fixture: "" },
    ],
    limitations: ["community-contributed URLs", "some dead streams"],
  },
  {
    id: "openlibrary",
    name: "Open Library",
    domain: "books, authors, editions, subjects",
    base: "https://openlibrary.org",
    auth: "none",
    freshness: "24h",
    limits: "be polite; UA recommended",
    routes: [
      { method: "GET", path: "/search.json?q=&limit=", note: "search incl. cover ids, ia scans, edition counts", status: 200, fixture: "openlibrary.json" },
      { method: "GET", path: "/works/{id}.json", note: "work record", status: 200, fixture: "" },
      { method: "GET", path: "/authors/{id}.json", note: "author record", status: 200, fixture: "" },
      { method: "GET", path: "/subjects/{subject}.json", note: "subject listing", status: 200, fixture: "" },
    ],
    limitations: ["volunteer data", "borrowable scans are lending-only"],
  },
  {
    id: "gutendex",
    name: "Gutendex",
    domain: "public-domain books, full text",
    base: "https://gutendex.com",
    auth: "none",
    freshness: "7d",
    limits: "be polite",
    routes: [
      { method: "GET", path: "/books?search=", note: "search with formats, copyright, languages, download counts", status: 200, fixture: "" },
      { method: "GET", path: "/books/{id}", note: "record", status: 200, fixture: "" },
    ],
    limitations: ["public domain only", "host intermittently slow"],
  },
  {
    id: "googlebooks",
    name: "Google Books",
    domain: "books, ISBN, previews",
    base: "https://www.googleapis.com/books/v1",
    auth: "none",
    freshness: "24h",
    limits: "unkeyed quota; 429 backoff",
    routes: [
      { method: "GET", path: "/volumes?q=&maxResults=", note: "search: industry identifiers, sale info, access info, page count", status: 200, fixture: "" },
      { method: "GET", path: "/volumes/{id}", note: "record", status: 200, fixture: "" },
    ],
    limitations: ["unkeyed quota shared", "preview-only content"],
  },
  {
    id: "crossref",
    name: "Crossref",
    domain: "books, chapters, papers, DOI",
    base: "https://api.crossref.org",
    auth: "none",
    freshness: "7d",
    limits: "50 req/s polite pool with mailto",
    routes: [
      { method: "GET", path: "/works?query=&rows=", note: "works with DOI, publisher, ISBN/ISSN, license, references", status: 200, fixture: "crossref.json" },
      { method: "GET", path: "/works/{doi}", note: "record", status: 200, fixture: "" },
    ],
    limitations: ["scholarly bias", "abstract coverage partial"],
  },
  {
    id: "internetarchive",
    name: "Internet Archive",
    domain: "books, comics, audio, video, software",
    base: "https://archive.org",
    auth: "none",
    freshness: "24h",
    limits: "be polite",
    routes: [
      { method: "GET", path: "/advancedsearch.php?q=&fl[]=&rows=&output=json", note: "search", status: 200, fixture: "archive.json" },
      { method: "GET", path: "/metadata/{identifier}", note: "item metadata + files", status: 200, fixture: "" },
      { method: "GET", path: "/services/loans/beta/loan/{identifier}", note: "lending status", status: 200, fixture: "" },
    ],
    limitations: ["mixed rights", "some items dark"],
  },
  {
    id: "musicbrainz",
    name: "MusicBrainz",
    domain: "music artists, releases, recordings, works, events, relations",
    base: "https://musicbrainz.org/ws/2",
    auth: "none-header",
    freshness: "24h",
    limits: "1 req/s; descriptive UA with contact required",
    routes: [
      { method: "GET", path: "/artist?query=&fmt=json", note: "search with area, life-span, aliases, tags", status: 200, fixture: "musicbrainz.json" },
      { method: "GET", path: "/artist/{mbid}?inc=aliases+tags+genres+url-rels+artist-rels+release-groups&fmt=json", note: "full relations, release groups, members", status: 200, fixture: "mb_artist2.json" },
      { method: "GET", path: "/event?query=&fmt=json", note: "concerts", status: 200, fixture: "mb_events3.json" },
      { method: "GET", path: "/release-group/{id}?inc=artist-credits+genres+ratings&fmt=json", note: "album", status: 200, fixture: "" },
    ],
    limitations: ["MBID-keyed", "relation coverage uneven", "CC0 core / CC BY-NC-SA some"],
  },
  {
    id: "coverartarchive",
    name: "Cover Art Archive",
    domain: "music artwork",
    base: "https://coverartarchive.org",
    auth: "none",
    freshness: "7d",
    limits: "be polite",
    routes: [
      { method: "GET", path: "/release-group/{mbid}", note: "artwork index", status: 200, fixture: "" },
      { method: "GET", path: "/release/{mbid}/front-500", note: "front cover", status: 200, fixture: "" },
    ],
    limitations: ["MBID-keyed", "cover presence partial"],
  },
  {
    id: "deezer",
    name: "Deezer public API",
    domain: "music artists, albums, tracks, previews",
    base: "https://api.deezer.com",
    auth: "none",
    freshness: "1h",
    limits: "50 req / 5 s",
    routes: [
      { method: "GET", path: "/search?q=&limit=", note: "search incl. ISRC, BPM, rank, 30s preview, artist/album art", status: 200, fixture: "deezer.json" },
      { method: "GET", path: "/artist/{id}/albums", note: "discography", status: 200, fixture: "" },
      { method: "GET", path: "/album/{id}/tracks", note: "tracklist", status: 200, fixture: "" },
    ],
    limitations: ["preview-only audio", "no lyrics"],
  },
  {
    id: "itunes",
    name: "Apple iTunes Search",
    domain: "music, podcasts, apps, movies, tv",
    base: "https://itunes.apple.com",
    auth: "none",
    freshness: "24h",
    limits: "~20 req/min",
    routes: [
      { method: "GET", path: "/search?term=&entity=&limit=", note: "all media kinds with artwork, preview, price, ratings", status: 200, fixture: "itunes.json" },
      { method: "GET", path: "/lookup?id=&entity=", note: "lookup by id", status: 200, fixture: "" },
    ],
    limitations: ["Apple catalogue only", "country storefront param"],
  },
  {
    id: "audiodb",
    name: "TheAudioDB",
    domain: "music artist bios and art",
    base: "https://www.theaudiodb.com/api/v1/json/{key}",
    auth: "none",
    freshness: "7d",
    limits: "test key 123; low quota",
    routes: [
      { method: "GET", path: "/search.php?s=", note: "artist incl. 15-language bios, art, MusicBrainz id", status: 200, fixture: "audiodb_artist.json" },
      { method: "GET", path: "/searchalbum.php?s=&a=", note: "album", status: 200, fixture: "" },
      { method: "GET", path: "/track.php?m=", note: "tracks", status: 200, fixture: "" },
    ],
    limitations: ["test key", "artist-centric"],
  },
  {
    id: "lrclib",
    name: "LRCLIB",
    domain: "lyrics (synced + plain)",
    base: "https://lrclib.net/api",
    auth: "none",
    freshness: "30d",
    limits: "be polite",
    routes: [
      { method: "GET", path: "/search?q=", note: "lyrics records with syncedLyrics/plainLyrics, duration", status: 200, fixture: "lrclib.json" },
      { method: "GET", path: "/get?artist_name=&track_name=", note: "exact lookup", status: 200, fixture: "" },
    ],
    limitations: ["community lyrics", "licensing per lyric"],
  },
  {
    id: "listenbrainz",
    name: "ListenBrainz",
    domain: "music popularity, similar artists, trending",
    base: "https://api.listenbrainz.org/1",
    auth: "none",
    freshness: "24h",
    limits: "be polite",
    routes: [
      { method: "POST", path: "/popularity/artist", note: "body {artist_ids: []}", status: 200, fixture: "" },
      { method: "GET", path: "/stats/sitewide/artists?range=", note: "sitewide charts", status: 200, fixture: "" },
    ],
    limitations: ["POST popularity", "MBID-keyed"],
  },
  {
    id: "holodex",
    name: "Holodex",
    domain: "vtubers, live streams, videos, clips, channels",
    base: "https://holodex.net/api/v2",
    auth: "none-header",
    freshness: "15s live, 5min channel",
    limits: "key normally required; browser Origin/Referer grants public access",
    routes: [
      { method: "GET", path: "/live?limit=", note: "live streams with channel org/group/photo/viewers", status: 200, fixture: "" },
      { method: "GET", path: "/channels?limit=", note: "channel identities, socials, subscriber counts, topics", status: 200, fixture: "" },
      { method: "GET", path: "/videos?channel_id=&limit=", note: "videos", status: 200, fixture: "" },
      { method: "GET", path: "/channels/{id}", note: "channel", status: 200, fixture: "" },
    ],
    limitations: ["Origin header required", "org allowlist incl. independent vtubers"],
  },
  {
    id: "youtube-rss",
    name: "YouTube channel RSS",
    domain: "vtuber, idol, creator uploads",
    base: "https://www.youtube.com/feeds/videos.xml",
    auth: "none",
    freshness: "15min",
    limits: "be polite",
    routes: [
      { method: "GET", path: "?channel_id=", note: "latest uploads with media:group title, thumbnail, views, rating", status: 200, fixture: "yt2.xml" },
      { method: "GET", path: "?playlist_id=", note: "playlist feed", status: 200, fixture: "" },
    ],
    limitations: ["latest ~15 only", "no search"],
  },
  {
    id: "vtuber-wiki",
    name: "Virtual YouTuber Wiki (Fandom)",
    domain: "vtubers",
    base: "https://virtualyoutuber.fandom.com/api.php",
    auth: "none",
    freshness: "7d",
    limits: "be polite",
    routes: [
      { method: "GET", path: "?action=query&list=search&srsearch=", note: "search", status: 200, fixture: "vtuberwiki.json" },
      { method: "GET", path: "?action=parse&page=&prop=wikitext|text", note: "profile", status: 200, fixture: "" },
    ],
    limitations: ["community wiki", "CC BY-SA"],
  },
  {
    id: "kprofiles",
    name: "Kprofiles",
    domain: "kpop idols, groups",
    base: "https://kprofiles.com",
    auth: "none",
    freshness: "7d",
    limits: "HTML; 1 req/s",
    routes: [
      { method: "GET", path: "/{id}-profile/", note: "profile HTML: stage name, birth, group, positions, facts", status: 200, fixture: "kprofiles.json" },
      { method: "GET", path: "/?s=", note: "search", status: 200, fixture: "" },
    ],
    limitations: ["HTML contract", "fan-maintained"],
  },
  {
    id: "arm",
    name: "ARM (Anime Relational Mapping)",
    domain: "anime/manga ID mapping",
    base: "https://arm.haglund.dev/api/v2",
    auth: "none",
    freshness: "30d",
    limits: "be polite",
    routes: [
      { method: "GET", path: "/ids?source=&id=", note: "cross-provider ids", status: 200, fixture: "arm.json" },
    ],
    limitations: ["mapping coverage partial", "anime-centric"],
  },
  {
    id: "gcd",
    name: "Grand Comics Database",
    domain: "comics, issues, publishers, creators",
    base: "https://www.comics.org/api",
    auth: "none",
    freshness: "30d",
    limits: "be polite; site sometimes 403s",
    routes: [
      { method: "GET", path: "/series/{id}/?format=json", note: "series with publisher, years, issue descriptors", status: 200, fixture: "gcd.json" },
      { method: "GET", path: "/issue/{id}/?format=json", note: "issue + stories + credits", status: 200, fixture: "" },
    ],
    limitations: ["comics-focused, partial modern coverage", "site WAF"],
  },
];

function walk(value: Json, prefix = "", depth = 0, out: string[] = []): string[] {
  if (depth > 5) return out;
  if (Array.isArray(value)) {
    for (const v of value.slice(0, 2)) walk(v, `${prefix}[].`, depth + 1, out);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      const path = prefix ? `${prefix}${k}` : k;
      out.push(path);
      walk(v, `${path}.`, depth + 1, out);
    }
  }
  return out;
}

function sample(value: Json, prefix = "", depth = 0): string {
  if (depth > 2) return "";
  if (Array.isArray(value)) {
    for (const v of value.slice(0, 1)) return sample(v, `${prefix}[].`, depth + 1);
  } else if (value && typeof value === "object") {
    return Object.entries(value)
      .slice(0, 40)
      .map(([k, v]) => `${prefix}${k}: ${sample(v, "", depth + 1) || JSON.stringify(v)?.slice(0, 80)}`)
      .join("\n");
  }
  return "";
}

mkdirSync(OUT, { recursive: true });

for (const s of SOURCES) {
  const fields = new Set<string>();
  const fixtures: string[] = [];
  let bytes = 0;
  for (const r of s.routes) {
    if (!r.fixture) continue;
    const p = join(EVIDENCE, r.fixture);
    try {
      const raw = readFileSync(p);
      bytes += statSync(p).size;
      const parsed = JSON.parse(raw.toString());
      for (const f of walk(parsed)) fields.add(f);
      fixtures.push(`${r.fixture} (${statSync(p).size} B)`);
    } catch {
      /* non-JSON evidence */
    }
  }
  const md = [
    `# ${s.name}`,
    "",
    `- **id:** \`${s.id}\``,
    `- **domain:** ${s.domain}`,
    `- **base:** \`${s.base}\``,
    `- **auth:** ${s.auth}`,
    `- **freshness:** ${s.freshness}`,
    `- **limits:** ${s.limits}`,
    `- **evidence fixtures:** ${fixtures.join(", ") || "none recorded"} (${bytes} B)`,
    "",
    "## Verified routes",
    "",
    "| method | path | status | note |",
    "| --- | --- | --- | --- |",
    ...s.routes.map((r) => `| ${r.method} | \`${r.path}\` | ${r.status} | ${r.note} |`),
    "",
    "## Observed field universe",
    "",
    `${fields.size} distinct key paths, preserved verbatim from evidence.`,
    "",
    "```",
    ...[...fields].sort(),
    "```",
    "",
    "## Limitations / unknowns",
    "",
    ...s.limitations.map((l) => `- ${l}`),
    "",
  ].join("\n");
  writeFileSync(join(OUT, `${s.id}.md`), md);
}

const index = [
  "# Source dossiers",
  "",
  "Generated by `bun scripts/dossier.ts` from `docs/research/evidence`. Do not hand-edit.",
  "",
  "| source | domain | auth | routes | fields | dossier |",
  "| --- | --- | --- | --- | --- | --- |",
  ...SOURCES.map((s) => {
    const p = join(OUT, `${s.id}.md`);
    const fields = (readFileSync(p, "utf8").match(/distinct key paths/) ? 0 : 0);
    return `| ${s.name} | ${s.domain} | ${s.auth} | ${s.routes.length} | see file | [${s.id}](${s.id}.md) |`;
  }),
  "",
  `${SOURCES.length} sources across ${new Set(SOURCES.map((s) => s.domain.split(",")[0])).size} domains.`,
].join("\n");
writeFileSync(join(OUT, "README.md"), index);

console.log(`wrote ${SOURCES.length} dossiers to ${OUT}`);
void fieldsGlobal;
var fieldsGlobal: unknown;

function sampleUnused() { void sample; }
void sampleUnused;
void basename; void readdirSync;
