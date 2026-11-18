# Cinemeta (Stremio)

- **id:** `cinemeta`
- **domain:** movie, series, episodes
- **base:** `https://v3-cinemeta.strem.io`
- **auth:** none
- **freshness:** 6h
- **limits:** undocumented, CDN backed
- **evidence fixtures:** cinemeta.json (25032 B) (25032 B)

## Verified routes

| method | path | status | note |
| --- | --- | --- | --- |
| GET | `/meta/{type}/{imdbId}.json` | 200 | full meta with videos, cast, links |
| GET | `/catalog/{type}/{catalog}.json` | 200 | catalogs (top, year, genre) |

## Observed field universe

57 distinct key paths, preserved verbatim from evidence.

```
meta
meta.awards
meta.background
meta.behaviorHints
meta.behaviorHints.defaultVideoId
meta.behaviorHints.hasScheduledVideos
meta.cast
meta.country
meta.description
meta.director
meta.genre
meta.genres
meta.id
meta.imdbRating
meta.imdb_id
meta.links
meta.links.[].category
meta.links.[].name
meta.links.[].url
meta.logo
meta.moviedb_id
meta.name
meta.popularities
meta.popularities.moviedb
meta.popularities.stremio
meta.popularities.stremio_lib
meta.popularities.trakt
meta.popularity
meta.poster
meta.releaseInfo
meta.released
meta.runtime
meta.slug
meta.status
meta.trailerStreams
meta.trailerStreams.[].title
meta.trailerStreams.[].ytId
meta.trailers
meta.trailers.[].source
meta.trailers.[].type
meta.tvdb_id
meta.type
meta.videos
meta.videos.[].description
meta.videos.[].episode
meta.videos.[].firstAired
meta.videos.[].id
meta.videos.[].name
meta.videos.[].number
meta.videos.[].overview
meta.videos.[].rating
meta.videos.[].released
meta.videos.[].season
meta.videos.[].thumbnail
meta.videos.[].tvdb_id
meta.writer
meta.year
```

## Limitations / unknowns

- IMDb-keyed only
- unofficial
- no write API
