# Shikimori

- **id:** `shikimori`
- **domain:** anime, manga (MAL ids)
- **base:** `https://shikimori.io/api`
- **auth:** none
- **freshness:** 30min lists, 6h detail
- **limits:** 5 req/s and 90/min; a burst of 5 earns a 60 s Retry-After, so held to 90/min burst 2. shikimori.one 301-redirects to .io
- **evidence fixtures:** shikimori_animes.json (2093 B) (2093 B)

## Verified routes

| method | path | status | note |
| --- | --- | --- | --- |
| GET | `/animes?search=&order=popularity&limit=&page=&censored=true` | 200 | list rows; id is the MyAnimeList id; russian title; limit+1 rows signal another page |
| GET | `/animes?status=ongoing&order=popularity` | 200 | airing chart |
| GET | `/animes?season=fall_2023&kind=tv&status=released&order=ranked` | 200 | browse filters |
| GET | `/mangas/{mal_id}` | 200 | MAL chapter/volume counts, english/japanese titles, synonyms |

## Observed field universe

16 distinct key paths, preserved verbatim from evidence.

```
[].aired_on
[].episodes
[].episodes_aired
[].id
[].image
[].image.original
[].image.preview
[].image.x48
[].image.x96
[].kind
[].name
[].released_on
[].russian
[].score
[].status
[].url
```

## Limitations / unknowns

- synopsis is Russian
- genre filter needs Shikimori genre ids
- no per-episode data
