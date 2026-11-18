# Changelog

## 0.1.0 — 2026-11-17

Initial working release.

### Added

- 57-kind entertainment superset schema with per-field provenance and raw payload retention
- 36 providers across 12 domains; 35 need no key
- merge engine with external-id and title collapse, union arrays, first non-empty scalars
- SQLite HTTP cache with TTL, stale-while-revalidate, single-flight and FTS5 entity index
- per-host token buckets, global concurrency cap, retries, `Retry-After`, circuit breakers, provider deadlines
- REST routes for search, get, sections, resolve, trending, discover, calendar, sports, IPTV, EPG, lyrics, batch
- OpenAPI 3.1, HTML docs, typed SDK, CLI, MCP stdio server
- snapshot ingest for IPTV, radio and classic books; offline mode
- 20 offline tests, 14-domain live smoke, GitHub Actions
- research pipeline with recorded evidence and generated field dossiers

### Providers

AniList, Jikan, Kitsu, MangaDex, MangaUpdates, ComicK, GCD, Open Library, Gutendex, Google Books, Crossref, Internet Archive, Cinemeta, TVmaze, MyDramaList, Wikidata, Wikipedia, MusicBrainz, Deezer, iTunes, TheAudioDB, LRCLIB, Holodex, YouTube RSS, VTuber Wiki, Kprofiles, ESPN, TheSportsDB, Jolpica, OpenLigaDB, MLB, NHL, iptv-org, Radio Browser, ARM, and optional-key TMDB.
