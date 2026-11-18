# Jikan v4 (MyAnimeList mirror)

- **id:** `jikan`
- **domain:** anime, manga, people, schedules
- **base:** `https://api.jikan.moe/v4`
- **auth:** none
- **freshness:** 1h cache recommended
- **limits:** 3 req/s, 60 req/min; 429 with Retry-After
- **evidence fixtures:** none recorded (0 B)

## Verified routes

| method | path | status | note |
| --- | --- | --- | --- |
| GET | `/anime/{id}/full` | 200 | full anime record |
| GET | `/anime?q=&limit=` | 200 | search |
| GET | `/manga/{id}/full` | 200 | full manga record |
| GET | `/schedules?day=` | 200 | airing calendar |
| GET | `/seasons/now` | 200 | current season |

## Observed field universe

0 distinct key paths, preserved verbatim from evidence.

```
```

## Limitations / unknowns

- network reachability varies by host
- MAL ids only
