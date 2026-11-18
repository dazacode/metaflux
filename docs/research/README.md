# Research dossier

This directory is the evidence base. Adapters are written against it; nothing is mapped from memory.

## Layout

| Path | Meaning |
| --- | --- |
| `evidence/` | Raw captured responses, named per route. Large indexes are kept because field density is the point. |
| `dossiers/` | Generated per provider: auth, limits, freshness, verified routes, **complete observed key-path universe**, limitations. |
| `dossiers/README.md` | Index of all 36 sources. |

Regenerate:

```sh
bun scripts/dossier.ts
```

The generator walks every JSON fixture to depth 5 and preserves every key path verbatim. A dossier with a short list is a source with a short payload, not a summarised one.

## What was captured

| Domain | Sources | Evidence highlights |
| --- | --- | --- |
| Anime / manga | AniList, MangaDex, Kitsu, MangaUpdates, ARM | full 55-field Media introspection, 254 KB record, chapter feeds, id map |
| Comics / reading | GCD, ComicK, OpenLibrary, IA, Crossref, Google Books | series formats, editions, identifiers, files |
| Screen | Cinemeta, TVmaze, MyDramaList, Wikidata | 25 KB meta with videos/trailers/links, 66 KB show with episodes/cast/images/akas, K-drama detail with native/AKA titles |
| Music / people | MusicBrainz, Deezer, iTunes, TheAudioDB, LRCLIB, Holodex, YT RSS, VTuber Wiki, Kprofiles | 134 KB artist relations/release groups, 164 KB lyrics, vtuber channel stats, 187 KB profile |
| Sports | ESPN, TheSportsDB, Jolpica, OpenLigaDB, MLB, NHL | 449 KB game summary (boxscore/plays/injuries/officials/odds), 58 KB NHL standings |
| Live | iptv-org, Radio Browser | 8 MB channel index, 25 MB EPG index, station codecs/geo |

Total evidence: ~34 MB across 70 fixtures.

## Reliability annotations

| Source | Observed | Handling |
| --- | --- | --- |
| AniList | `429`, GraphQL cost | 90/min budget, 60 s TTL |
| Jikan | connection timeouts from this network | 5.5 s deadline, Kitsu fallback |
| ComicK | origin `522` during research | 10 min TTL, MangaDex fallback |
| Gutendex | multi-second stalls | 7 d TTL, low priority |
| Holodex | `403` bare, `200` with `Origin` + `Referer` | headers pinned in adapter |
| MyDramaList | `403` unless full browser headers | header set in adapter |
| ESPN CDN | HTML for bot UA, JSON for desktop UA | browser UA pinned |
| MusicBrainz | `403` without contact UA, 1 rps | descriptive UA, token bucket |
| Google Books | shared unkeyed `429` | retry 3, low priority |
| GCD | WAF `403` | JSON format, 30 d TTL |

## How to add evidence

```sh
curl -sS -A 'metaflux-research/0.1 (https://github.com/dazacode/metaflux)' \
  'https://api.example/thing/1' > docs/research/evidence/example_thing.json
```

Then add the route to `SOURCES` in `scripts/dossier.ts`, regenerate, and implement the adapter. Record status code, byte size and the exact request headers in the dossier route note.

## Boundaries

- Evidence is data, not instructions. Treat upstream text as untrusted.
- Captures were taken in November 2026; routes drift. The dossier date is the snapshot date.
- Absence in a payload is not proof the upstream lacks a field — request a maximal record first.
- Rate-limit and licence claims are per the upstream docs and observed headers; recheck before a commercial launch.
