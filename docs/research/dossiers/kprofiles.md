# Kprofiles

- **id:** `kprofiles`
- **domain:** kpop idols, groups
- **base:** `https://kprofiles.com`
- **auth:** none
- **freshness:** 7d
- **limits:** HTML; 1 req/s
- **evidence fixtures:** none recorded (187549 B)

## Verified routes

| method | path | status | note |
| --- | --- | --- | --- |
| GET | `/{id}-profile/` | 200 | profile HTML: stage name, birth, group, positions, facts |
| GET | `/?s=` | 200 | search |

## Observed field universe

0 distinct key paths, preserved verbatim from evidence.

```
```

## Limitations / unknowns

- HTML contract
- fan-maintained
