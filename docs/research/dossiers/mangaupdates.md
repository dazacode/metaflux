# MangaUpdates

- **id:** `mangaupdates`
- **domain:** manga, manhwa, manhua
- **base:** `https://api.mangaupdates.com/v1`
- **auth:** none
- **freshness:** 24h cache
- **limits:** be polite, ~1 req/s
- **evidence fixtures:** mangaupdates.json (48613 B) (48613 B)

## Verified routes

| method | path | status | note |
| --- | --- | --- | --- |
| POST | `/series/search` | 200 | body {search} |
| GET | `/series/{id}` | 200 | record |

## Observed field universe

34 distinct key paths, preserved verbatim from evidence.

```
page
per_page
results
results.[].hit_title
results.[].metadata
results.[].metadata.user_genre_highlights
results.[].metadata.user_list
results.[].metadata.user_list.list_icon
results.[].metadata.user_list.list_type
results.[].metadata.user_list.status
results.[].metadata.user_list.status.chapter
results.[].metadata.user_list.status.volume
results.[].record
results.[].record.bayesian_rating
results.[].record.description
results.[].record.genres
results.[].record.genres.[].genre
results.[].record.image
results.[].record.image.height
results.[].record.image.url
results.[].record.image.url.original
results.[].record.image.url.thumb
results.[].record.image.width
results.[].record.last_updated
results.[].record.last_updated.as_rfc3339
results.[].record.last_updated.as_string
results.[].record.last_updated.timestamp
results.[].record.rating_votes
results.[].record.series_id
results.[].record.title
results.[].record.type
results.[].record.url
results.[].record.year
total_hits
```

## Limitations / unknowns

- POST search
- records include genre/year/rating only
