# Verification

Environment: macOS arm64, Bun 1.4.4, November 2026. Live upstreams, then offline fixtures.

## Gate results

| Gate | Result |
| --- | --- |
| `bunx tsc --noEmit` | 0 errors |
| `bun test` | 20 pass / 0 fail (5 files) |
| `bun run smoke` | 14/14 domains returned data |
| `/v1/providers` | 36 providers, 35 keyless, 1 optional-key |
| Required env vars | 0 |
| Server boot | ~0.4 s, 36 providers loaded |
| Search cold p95 | ~3.5 s (deadline bounded) |
| Search warm | 40–600 ms |
| Get cold | 0.2–8 s by source |
| Get warm | 2–10 ms |
| IPTV ingest | 31,843 channels in 48 s |
| Offline search after ingest | 22 ms |
| Offline stream lookup from store | 1 URL, no network |

Smoke output (trimmed):

```
PASS anime     3542ms results=3  providers=anilist,itunes
PASS manga     3522ms results=5  providers=anilist,mangadex,mangaupdates,internetarchive
PASS manhwa    3508ms results=5  providers=anilist,mangadex,mangaupdates,internetarchive
PASS comics    3507ms results=5  providers=anilist,mangadex,internetarchive
PASS books     3503ms results=5  providers=openlibrary,itunes,gutendex,internetarchive,crossref
PASS tv         565ms results=4  providers=cinemeta,anilist,tvmaze,itunes
PASS movie      242ms results=4  providers=cinemeta,anilist,itunes
PASS kdrama     283ms results=5  providers=cinemeta,anilist,tvmaze,itunes
PASS kpop      3503ms results=5  providers=espn,musicbrainz,deezer,itunes
PASS music     252ms results=5  providers=musicbrainz,openlibrary,deezer,itunes
PASS sports     544ms results=1  providers=espn
PASS iptv        40ms results=4  providers=iptv-org
PASS vtubers   3505ms results=5  providers=holodex,musicbrainz,deezer,itunes
PASS radio     3507ms results=5  providers=iptv-org,radio-browser
14/14 domains returned data across 36 providers
```

## Endpoint checks

| Request | Result |
| --- | --- |
| `GET /health` | 200, providers 36, cache/entity counters |
| `GET /v1/providers` | 200, capabilities + licences, no secrets |
| `GET /v1/search?q=frieren&kind=anime` | 200, AniList title, ids, genres, 24 episodes, staff, studios, provenance per field |
| `GET /v1/anime/anilist:154587` | 200, merged AniList + ARM, title `Frieren: Beyond Journey's End` |
| `GET /v1/movie/tt1375666` | 200, bare IMDb detection, Cinemeta |
| `GET /v1/tv_show/tvmaze:1` | 200, full embed record |
| `GET /v1/sports/scoreboard?league=basketball/nba` | 200, 5 finished games with scores |
| `GET /v1/sports/standings?league=football/nfl` | 200, 20 teams |
| `GET /v1/iptv/channels?q=nasa&limit=3` | 200, 3 channels |
| `GET /v1/music/lyrics?artist=IU&track=Love%20wins%20all` | 200, synced LRC |
| `GET /v1/resolve?ids=anilist:154587` | 200, imdb/mal/tmdb/tvdb/kitsu ids |
| `GET /v1/anime/anilist:154587/credits` | 200, 32 KB |
| `GET /v1/anime/not-an-id` | 400 with hint |
| `GET /nope` | 404 with docs pointer |
| `GET /openapi.json` | 200, OpenAPI 3.1 |

## Failure-path checks

| Scenario | Behaviour |
| --- | --- |
| Provider 500 | retry, then stale copy if present, else `partial` |
| Provider 429 | `Retry-After` honoured, stale/fallback |
| Timeout | deadline, `unavailable` entry, other providers unaffected |
| 5 consecutive failures | breaker opens 60 s, half-open probe |
| All providers fail, cache exists | stale 200 with `provenance.cache.stale` |
| No cache, all fail | 404/502 with code |
| Duplicate concurrent miss | one upstream call (single-flight) |

## Known gaps

- some sources were unreachable from the build network (Jikan, occasional ComicK/Gutendex); adapters exist and degrade
- Google Books unkeyed quota returns `429` from shared IPs
- Kprofiles selector depth is shallow; a markup change returns empty
- no subtitles, TV listings per market, or streaming-price normalisation yet
- Cyclic relation graphs are serialised by value, not by link

## Evidence provenance

70 fixtures, ~34 MB, in `docs/research/evidence`. Each dossier records the status code and exact URL per route. `bun scripts/dossier.ts` reproduces the field inventories.
