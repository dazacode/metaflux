# MetaFlux

**All entertainment metadata. One API. No API keys.**

MetaFlux is a self-hostable aggregation API for film, TV, anime, manga, manhwa, manhua, webtoons, comics, books, music, K-pop idols, vtubers, live IPTV, radio, sports and ticketed events. It merges 38 free upstreams into one dense, attributed record schema. You clone it, run it, and every project gets the metadata it needs without a signup, a key, a credit card or a per-call quota.

```
GET /v1/search?q=frieren&kind=anime
GET /v1/anime/anilist:154587?debug=true
GET /v1/sports/scoreboard?league=soccer/eng.1
GET /v1/iptv/channels?country=JP
GET /v1/music/lyrics?artist=IU&track=Love%20wins%20all
```

> Films, trending manga, your local derby, a must-see TV night, a K-drama, an idol concert, a vtuber stream, the radio in the kitchen. One schema.

## Why this exists

Every media project starts the same way: five API keys, five pricing pages, five schemas, five sets of rate limits, and a database that still has empty posters. MetaFlux removes the key ceremony. Upstreams are free public APIs, snapshots and open data; MetaFlux adds the parts that make them usable:

- one **superset schema** instead of 38 shapes
- **field-level provenance** (`provenance.field_sources`) with provider, URL and timestamp
- **raw payloads** preserved for every record
- **merge and identity resolution** across IMDb/TMDB/TVDB/AniList/MAL/MangaDex/ISBN/MusicBrainz/Wikidata/ESPN
- **SQLite cache, single-flight, per-host token buckets, Retry-After, circuit breakers**
- **bulk snapshots** (`bun run ingest iptv`) so the API stays fast and survives outages
- **DX surfaces**: OpenAPI 3.1, typed SDK, CLI, MCP server, batch endpoint, Docker

## Coverage

| Domain | What you can get | Keyless upstreams |
| --- | --- | --- |
| Film / TV | titles, year, runtime, cast, crew, episodes, artwork, trailers, streaming links, broadcast schedule | Cinemeta, TVmaze, Wikipedia, Wikidata |
| Anime | full media record, airing schedule, next episode, studios, characters with voice actors, staff, people, per-episode titles/stills/runtimes, clearlogos, rankings, relations | AniList, ani.zip, Jikan, Shikimori, Kitsu, ARM |
| Manga / manhwa / manhua / webtoons | alt titles, description, tags, demographic, chapters, scanlation groups, covers | MangaDex, MangaUpdates, ComicK |
| Comics | series, issues, publishers, creators, formats, years | GCD, ComicK, Internet Archive |
| Books | work/edition data, ISBN-10/13, pages, subjects, lending, full text | Open Library, Gutendex, Google Books, Crossref, Internet Archive |
| Music / K-pop | artists, groups, albums, tracks, ISRC, BPM, previews, lyrics, bios in 15 languages, concerts and setlists | MusicBrainz, Deezer, iTunes, TheAudioDB, LRCLIB, Wikidata |
| Idols / vtubers | profiles, groups, agencies, debut/graduation, socials, live streams, uploads, clips | Holodex, YouTube RSS, VTuber Wiki, Kprofiles |
| Sports | live scores, local teams, rosters, standings, odds, injuries, plays, venues, F1, NFL, NBA, MLB, NHL, soccer | ESPN, TheSportsDB, Jolpica, OpenLigaDB, MLB, NHL |
| Live | 10k+ IPTV channels, stream URLs, XMLTV EPG, 50k+ radio stations | iptv-org, Radio Browser |
| K-drama / J-drama / C-drama | cast, synopsis, episodes, ratings, native titles, AKA titles | MyDramaList |
| Identity | cross-provider ids, people, characters, studios, networks, awards, franchises | Wikidata, ARM |

The full route and field inventory for each upstream is in [`docs/research/dossiers`](docs/research/dossiers). It is generated from recorded evidence, not written from memory.

## Quick start

Requires [Bun](https://bun.sh) 1.2+.

```sh
git clone https://github.com/dazacode/metaflux && cd metaflux
bun install
bun run dev
# http://127.0.0.1:8787/docs
```

```sh
curl 'http://127.0.0.1:8787/v1/search?q=severance&kind=tv_show&limit=3'
curl 'http://127.0.0.1:8787/v1/manga/mangadex:32a8f510-1c71-4d1e-b2f8-37a3d3e30d3f'
curl 'http://127.0.0.1:8787/v1/book/isbn13:9780441013593'
curl 'http://127.0.0.1:8787/v1/vtuber/holodex:UCz6vnIbgiqFT9xUcD6Bp65Q'
curl 'http://127.0.0.1:8787/v1/calendar?kinds=sports_event,concert&from=2026-11-18&to=2026-11-25'
```

No environment variables are needed. The optional ones are in [`.env.example`](.env.example).

## SDK

```ts
import { MetaFlux } from "metaflux/sdk";

const mf = new MetaFlux({ baseUrl: "http://127.0.0.1:8787", region: "PH" });

const { data } = await mf.search("solo leveling", { kind: "manhwa", limit: 5 });
const detail = await mf.get("manhwa", data[0].id);

console.log(detail.data.title.localized);
console.log(detail.data.chapters.at(-1));
console.log(detail.data.provenance.field_sources["description.long.en"]);
```

Python and curl examples: [`examples/`](examples). An MCP server is included for agents:

```json
{
  "mcpServers": {
    "metaflux": { "command": "bun", "args": ["run", "src/mcp.ts"], "cwd": "/path/to/metaflux" }
  }
}
```

## The record

Every entity is the same superset shape, whichever domain it comes from. Missing data is `null` or `[]`; nothing is absent-by-shape. Highlights:

`title` (display, romaji, english, native, aliases, localized) · `description` (tagline, short, long, synopsis, notes, trivia, per language) · `images` (poster, backdrop, banner, logo, clearart, cutout, fanart, screenshots, profile, cover, dominant colour) · `external_ids` (per provider) · `dates` (start, end, release, airing, born, died, founded, debut) · `status` · `classification` (genres, themes, demographics, keywords, tags, ratings, warnings) · `metrics` (score, votes, rank, popularity, followers, views) · `credits` (cast, crew, characters, voices) · `companies` (studios, networks, publishers, labels, distributors) · `relations` (sequel, adaptation, member, season, tour…) · `episodes` / `chapters` / `tracks` / `seasons` · `availability` (streaming, linear, IPTV, radio, rent, buy, free, downloads with region, quality, audio, subtitles, price, DRM) · `technical` (runtime, resolution, codecs, languages, page count, formats) · `broadcast` · `manga` · `literature` · `music` · `sports` (score, clock, venue, officials, odds, standings, lineups, injuries, plays) · `live` · `event` · `iptv` · `person` · `vtuber` · `media` · `links` · `raw` · `provenance` · `score`.

`provenance` is the contract:

```json
{
  "partial": true,
  "unavailable": ["jikan"],
  "sources": [{ "provider": "anilist", "url": "https://anilist.co/anime/154587", "fetched_at": "…", "confidence": "verified" }],
  "field_sources": { "title.romaji": [{ "provider": "anilist", "fetched_at": "…" }] }
}
```

`meta.partial` and `meta.unavailable` tell you a source failed. A failure never blanks a response another provider answered.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/v1/search?q=&kind=&kinds=&limit=&region=&providers=` | Fan-out, de-duplicate, rank |
| GET | `/v1/{kind}/{id}` | Entity by `mf_*`, `provider:id`, IMDb, Wikidata QID or ISBN |
| GET | `/v1/{kind}/{id}/{section}` | `credits`, `episodes`, `chapters`, `seasons`, `tracks`, `related`, `people`, `streams`, `availability`, `lyrics` |
| GET | `/v1/trending`, `/v1/discover`, `/v1/calendar` | Charts, catalogue browse, schedules |
| GET | `/v1/discover?kind=&q=&genres=&format=&status=&season=&year=&country=&sort=&page=&limit=` | Browse with every filter; `meta.total`, `meta.has_next` |
| GET | `/v1/trending?kind=&country=&genres=&year=…` | With any discover filter, trending is discover sorted by trending; unknown params are a 400 |
| GET | `/v1/genres?kind=anime\|manga\|tv_show\|movie` | Genre vocabulary `discover` accepts |
| GET | `any?fields=title,images` | Project entities to those top-level keys |
| GET | `/v1/resolve?ids=imdb:tt1375666,tmdb:27205` | Canonical identity resolution |
| GET | `/v1/sports/scoreboard?league=basketball/nba` | Live score + odds |
| GET | `/v1/sports/standings?league=football/nfl` | Tables |
| GET | `/v1/iptv/channels?country=JP&q=news` | Channel directory |
| GET | `/v1/iptv/channels/{id}/streams` | Stream URLs, quality, referrer |
| GET | `/v1/iptv/epg?country=GB` | XMLTV guide endpoints |
| GET | `/v1/music/lyrics?artist=&track=` | Synced and plain lyrics |
| POST | `/v1/batch` | Up to 50 lookups |
| GET | `/v1/providers` | Capability matrix, auth, licence, limits |
| GET | `/openapi.json` | OpenAPI 3.1 |

Error shape: `{ "error": { "code": "not_found", "message": "…" } }`.

## Operations

```sh
bun run test          # unit + API tests, offline fixtures
bun run typecheck
bun run smoke         # live check across every domain
bun run ingest iptv   # channels + streams + EPG into SQLite
bun run ingest all
bun run openapi
bun run mcp
```

Configuration, Docker, Cloudflare and cron notes: [`docs/DEPLOY.md`](docs/DEPLOY.md).

## How merging works

1. Every request fans out to providers that declare the operation and kind.
2. Each result is indexed for field-level provenance.
3. Records collapse when they share a canonical external id or normalized title+kind.
4. Fields merge **union-first**: arrays union, the first non-empty scalar wins, provenance is appended, nothing is overwritten with empty.
5. Results rank by title similarity, kind fit, id count, popularity and assets.
6. The merged record is written to SQLite FTS so repeat searches are local.

Adapters never talk to each other; adding a provider never changes a consumer's schema.

## Bulk snapshots

Upstreams go down and rate-limit. Snapshots make that survivable:

- `iptv` — channels, streams, EPG index
- `radio` — top stations
- `openlibrary` — classic literature seed set

Entity pages are cached on read and served stale while revalidating. On a cache miss with an open circuit breaker the API returns the stale copy or a documented `circuit_open` error, never a blank page.

## Legal & licences

MetaFlux code is MIT. Upstream data keeps its own licence: Wikidata is CC0, Open Library and Crossref are open, TVmaze is CC BY-SA, MusicBrainz is CC0 core with some CC BY-NC-SA, AniList/MangaDex/ESPN are site terms, IPTV and radio are indices of third-party streams. `/v1/providers` carries the licence per source. Streams are links; no media is hosted.

## Status

`0.1.0` is a working foundation: 38 providers (37 keyless, 1 optional-key), all domains, 50+ kinds, tests, cache, snapshots, SDK, CLI, MCP, OpenAPI. The roadmap and acceptance criteria are in [`PLAN.md`](PLAN.md); the architecture is in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

Contributions are welcome, especially adapters, fixtures and schema fields. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`docs/research/README.md`](docs/research/README.md).
