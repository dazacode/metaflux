# ARM (Anime Relational Mapping)

- **id:** `arm`
- **domain:** anime/manga ID mapping
- **base:** `https://arm.haglund.dev/api/v2`
- **auth:** none
- **freshness:** 30d
- **limits:** be polite
- **evidence fixtures:** arm.json (281 B) (281 B)

## Verified routes

| method | path | status | note |
| --- | --- | --- | --- |
| GET | `/ids?source=&id=` | 200 | cross-provider ids |

## Observed field universe

16 distinct key paths, preserved verbatim from evidence.

```
anidb
anilist
anime-planet
animecountdown
animenewsnetwork
anisearch
imdb
kitsu
livechart
media
myanimelist
simkl
themoviedb
themoviedb-season
thetvdb
thetvdb-season
```

## Limitations / unknowns

- mapping coverage partial
- anime-centric
