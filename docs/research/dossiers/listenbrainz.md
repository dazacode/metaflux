# ListenBrainz

- **id:** `listenbrainz`
- **domain:** music popularity, similar artists, trending
- **base:** `https://api.listenbrainz.org/1`
- **auth:** none
- **freshness:** 24h
- **limits:** be polite
- **evidence fixtures:** none recorded (0 B)

## Verified routes

| method | path | status | note |
| --- | --- | --- | --- |
| POST | `/popularity/artist` | 200 | body {artist_ids: []} |
| GET | `/stats/sitewide/artists?range=` | 200 | sitewide charts |

## Observed field universe

0 distinct key paths, preserved verbatim from evidence.

```
```

## Limitations / unknowns

- POST popularity
- MBID-keyed
