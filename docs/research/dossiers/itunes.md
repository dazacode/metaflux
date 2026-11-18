# Apple iTunes Search

- **id:** `itunes`
- **domain:** music, podcasts, apps, movies, tv
- **base:** `https://itunes.apple.com`
- **auth:** none
- **freshness:** 24h
- **limits:** ~20 req/min
- **evidence fixtures:** itunes.json (1526 B) (1526 B)

## Verified routes

| method | path | status | note |
| --- | --- | --- | --- |
| GET | `/search?term=&entity=&limit=` | 200 | all media kinds with artwork, preview, price, ratings |
| GET | `/lookup?id=&entity=` | 200 | lookup by id |

## Observed field universe

33 distinct key paths, preserved verbatim from evidence.

```
resultCount
results
results.[].artistId
results.[].artistName
results.[].artistViewUrl
results.[].artworkUrl100
results.[].artworkUrl30
results.[].artworkUrl60
results.[].collectionCensoredName
results.[].collectionExplicitness
results.[].collectionId
results.[].collectionName
results.[].collectionPrice
results.[].collectionViewUrl
results.[].country
results.[].currency
results.[].discCount
results.[].discNumber
results.[].isStreamable
results.[].kind
results.[].previewUrl
results.[].primaryGenreName
results.[].releaseDate
results.[].trackCensoredName
results.[].trackCount
results.[].trackExplicitness
results.[].trackId
results.[].trackName
results.[].trackNumber
results.[].trackPrice
results.[].trackTimeMillis
results.[].trackViewUrl
results.[].wrapperType
```

## Limitations / unknowns

- Apple catalogue only
- country storefront param
