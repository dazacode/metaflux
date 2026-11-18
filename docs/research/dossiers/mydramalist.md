# MyDramaList

- **id:** `mydramalist`
- **domain:** kdrama, jdrama, cdrama, lakorn
- **base:** `https://mydramalist.com`
- **auth:** none
- **freshness:** 12h
- **limits:** HTML; 1 req/s
- **evidence fixtures:** none recorded (123031 B)

## Verified routes

| method | path | status | note |
| --- | --- | --- | --- |
| GET | `/search?q=` | 200 | search HTML + JSON-LD |
| GET | `/{id}-{slug}` | 200 | detail HTML: cast, episodes, synopsis |

## Observed field universe

0 distinct key paths, preserved verbatim from evidence.

```
```

## Limitations / unknowns

- HTML contract
- Cloudflare can challenge
