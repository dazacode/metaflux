# YouTube channel RSS

- **id:** `youtube-rss`
- **domain:** vtuber, idol, creator uploads
- **base:** `https://www.youtube.com/feeds/videos.xml`
- **auth:** none
- **freshness:** 15min
- **limits:** be polite
- **evidence fixtures:** none recorded (37115 B)

## Verified routes

| method | path | status | note |
| --- | --- | --- | --- |
| GET | `?channel_id=` | 200 | latest uploads with media:group title, thumbnail, views, rating |
| GET | `?playlist_id=` | 200 | playlist feed |

## Observed field universe

0 distinct key paths, preserved verbatim from evidence.

```
```

## Limitations / unknowns

- latest ~15 only
- no search
