# Holodex

- **id:** `holodex`
- **domain:** vtubers, live streams, videos, clips, channels
- **base:** `https://holodex.net/api/v2`
- **auth:** none-header
- **freshness:** 15s live, 5min channel
- **limits:** key normally required; browser Origin/Referer grants public access
- **evidence fixtures:** none recorded (0 B)

## Verified routes

| method | path | status | note |
| --- | --- | --- | --- |
| GET | `/live?limit=` | 200 | live streams with channel org/group/photo/viewers |
| GET | `/channels?limit=` | 200 | channel identities, socials, subscriber counts, topics |
| GET | `/videos?channel_id=&limit=` | 200 | videos |
| GET | `/channels/{id}` | 200 | channel |

## Observed field universe

0 distinct key paths, preserved verbatim from evidence.

```
```

## Limitations / unknowns

- Origin header required
- org allowlist incl. independent vtubers
