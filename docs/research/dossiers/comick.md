# ComicK

- **id:** `comick`
- **domain:** manhwa, manhua, webtoon, comics
- **base:** `https://api.comick.io`
- **auth:** none
- **freshness:** 10min
- **limits:** ~5 req/s; origin incident returns 522
- **evidence fixtures:** none recorded (0 B)

## Verified routes

| method | path | status | note |
| --- | --- | --- | --- |
| GET | `/v1.0/search?q=` | 200 | search |
| GET | `/comic/{slug}` | 200 | record + chapters |

## Observed field universe

0 distinct key paths, preserved verbatim from evidence.

```
```

## Limitations / unknowns

- origin instability
- community metadata
