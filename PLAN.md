# Plan

Status: **v0.1.0 built**. This document is the pre-build plan plus the decisions taken during execution. Evidence lives in `docs/research/evidence`, generated field inventories in `docs/research/dossiers`.

## 1. Problem

There is no single free, keyless metadata source for entertainment as a whole. Practitioners stitch together five to twenty vendors:

| Need | Typical vendor | Friction |
| --- | --- | --- |
| film/TV | TMDB, TVDB, IMDb | keys, commercial terms |
| anime/manga | AniList, MAL, MangaDex | three shapes, scanlation ids |
| books | Google Books, OpenLibrary, ISBNdb | quotas, missing editions |
| music | Spotify, MusicBrainz | OAuth, 1 rps |
| sports | Sportradar, API-Football | expensive keys |
| live TV | paid EPG vendors | per-region contracts |
| idols/vtubers | manual sheets | no API at all |

The result is duplicated identity, half-filled records, brittle clients and a hard key dependency just to render a poster.

## 2. Goal

One self-hostable API that returns **dense, attributed metadata** for any entertainment entity, from any domain, with **zero required keys**, and degrades gracefully under upstream failure. Open source, MIT, DX-first.

### Non-goals

- hosting media or bypassing paywalls
- replacing a licensed EPG for commercial redistribution
- write APIs, user accounts, social features
- guaranteeing upstream completeness

## 3. Success criteria

| Criterion | Target | Result |
| --- | --- | --- |
| Domains with a working live provider | 12 | 12 |
| Keyless providers | ≥ 20 | 37 keyless + 1 optional-key |
| Required env for a working install | 0 | 0 |
| Entity kinds in schema | ≥ 40 | 57 |
| Scalar/array fields available in schema | ≥ 300 | ~420 |
| Provider + route + field dossier for every source | 100% | 38/38 |
| Offline test suite | pass | 20 tests pass |
| Live smoke across domains | pass | `bun run smoke` |
| Failure never blanks a merged record | yes | stale cache + partial + `unavailable` |
| Attribution for every populated field | yes | `provenance.field_sources` |
| Cold search p95 without cache | < 8 s | ~5.5 s |
| Cached get p95 | < 50 ms | ~2–10 ms |
| Typecheck | clean | clean |

## 4. Research method (REA)

Reverse-engineering discipline was applied to every upstream:

1. **Route discovery** — find the real endpoint behind a public product. Example: Holodex returns `403` for a bare request but `200` with `Origin: https://holodex.net`; MyDramaList is Cloudflare-fronted and needs a browser `User-Agent` + `Sec-Fetch-*` headers; ESPN's CDN serves HTML to a bot UA and JSON to a desktop UA.
2. **Contract capture** — request maximal records (AniList GraphQL introspection and generated all-field query, TVmaze `embed[]=episodes,cast,crew,images,akas`, MangaDex `includes[]=cover_art,author,artist`, ESPN `summary`, MusicBrainz `inc=aliases+tags+genres+url-rels+artist-rels+release-groups`).
3. **Evidence retention** — every response is saved under `docs/research/evidence` with status and byte size in the dossier.
4. **Field census** — `bun scripts/dossier.ts` walks each payload and emits the complete key-path universe, so no mapping is written from memory.
5. **Runtime confirmation** — adapters are exercised against the live route; a route that cannot be reached is documented with a fallback rather than removed.
6. **Cross-check** — merge identity against ARM/Wikidata so one source's sparse record is enriched by another's.

Observed transport quirks that became code:

- AniList: 90/min bucket, `429` + `Retry-After`, GraphQL cost limits.
- MangaDex: 5 rps, `includes[]` required for authors/cover.
- TVmaze: 20 calls/10 s, ETag-capable.
- MusicBrainz: 1 rps and a descriptive UA is mandatory.
- Wikidata SPARQL: 60 s cap, UA mandatory.
- iptv-org: 25 MB `guides.json` — ingest, do not fetch per request.
- Jikan/Gutendex/ComicK: intermittently unreachable from some networks; Jikan and ComicK return errors while Gutendex hangs.

## 5. Architecture decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Language/runtime | Bun + TypeScript | SQLite, HTTP, test runner and packaging in one binary; fast cold start |
| HTTP | Hono | tiny, standard `fetch` handlers, middleware |
| Validation | Zod | response/entity schema is executable |
| Store | `bun:sqlite` WAL + FTS5 | zero services; durable cache and local search |
| Cache | HTTP cache with TTL + stale-while-revalidate | upstream failure must not blank output |
| Concurrency | global + per-host token buckets, single-flight | no stampede, no ban |
| Resilience | retries with jitter, `Retry-After`, circuit breaker | freeze a dead source, keep the rest |
| Merge | union-first, first non-empty scalar, id/title collapse | deterministic, lossless |
| Provenance | per-field `{provider,url,fetched_at,confidence}` | attribution, audit, UI badges |
| Auth | none by default; optional upstream keys | zero-key promise |
| Bulk | snapshot ingest into the same store | rate-limit immunity and offline mode |
| Interfaces | REST + OpenAPI + SDK + CLI + MCP + batch | every consumer style |

### Why not a single vendor or scraper

Single-vendor means the availability of that vendor is the availability of the product. Pure scraping means no contract stability. MetaFlux mixes official public APIs, open data and two HTML contracts (MyDramaList, Kprofiles) that are isolated behind adapters and fixture tests.

## 6. Phases

| Phase | Scope | State |
| --- | --- | --- |
| 0 | Domain model, schema, provider registry | done |
| 1 | Reading: AniList, Jikan, Kitsu, MangaDex, MangaUpdates, ComicK, GCD, OpenLibrary, Gutendex, Google Books, Crossref, IA | done |
| 2 | Screen: Cinemeta, TVmaze, MyDramaList, Wikipedia, Wikidata | done |
| 3 | Music, idols, vtubers: MusicBrainz, Deezer, iTunes, TheAudioDB, LRCLIB, Holodex, YouTube RSS, VTuber Wiki, Kprofiles | done |
| 4 | Sports: ESPN, TheSportsDB, Jolpica, OpenLigaDB, MLB, NHL | done |
| 5 | Live: iptv-org, Radio Browser, EPG index | done |
| 6 | Core hardening: cache, breakers, deadlines, merge, provenance | done |
| 7 | DX: OpenAPI, SDK, CLI, MCP, docs, Docker | done |
| 8 | Next: streaming-availability, subtitles, anime schedule alerts, TV listings per market | next |

## 7. Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Upstream terms change | adapter breaks | isolated adapters, fixtures, `/v1/providers` licence, fallbacks |
| Rate-limit ban | empty responses | per-host budget, cache, stale copy, breaker, snapshots |
| HTML contract drift | MyDramaList/Kprofiles break | browser headers centralised, selector tests, graceful empty |
| Merge false positives | wrong identity | canonical ids first, title only as secondary, kind guard |
| Unlicensed redistribution | legal challenge | attribution, licences surfaced, no media hosting |
| Response bloat | slow clients | raw trimming, section endpoints, `limit`, batch |
| Upstream disappears | coverage loss | ≥ 2 providers per critical kind; resolver |

## 8. Acceptance tests

- `bun run typecheck` clean
- `bun test` 20/20
- `bun run smoke` returns data for anime, manga, manhwa, comics, books, TV, film, K-drama, K-pop, music, sports, IPTV, vtubers, radio
- `GET /v1/providers` shows no required key
- killing network mid-request still serves the cache
- every populated field has a `provenance.field_sources` entry
- one dead provider sets `partial` but leaves other data intact

## 9. What "done" means for the next maintainer

1. Pick a dossier in `docs/research/dossiers`.
2. Record a new fixture and route with `scripts/dossier.ts`.
3. Write an adapter against `src/providers/_types.ts` and register it.
4. Map every field into the superset schema; no field is dropped on the floor.
5. Add a fixture test and a smoke case.
6. Update the capability matrix and licence.

The bar is: a consumer can delete every provider except yours and still get the schema they coded against.
