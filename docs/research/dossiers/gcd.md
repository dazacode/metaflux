# Grand Comics Database

- **id:** `gcd`
- **domain:** comics, issues, publishers, creators
- **base:** `https://www.comics.org/api`
- **auth:** none
- **freshness:** 30d
- **limits:** be polite; site sometimes 403s
- **evidence fixtures:** gcd.json (519 B) (519 B)

## Verified routes

| method | path | status | note |
| --- | --- | --- | --- |
| GET | `/series/{id}/?format=json` | 200 | series with publisher, years, issue descriptors |
| GET | `/issue/{id}/?format=json` | 200 | issue + stories + credits |

## Observed field universe

15 distinct key paths, preserved verbatim from evidence.

```
active_issues
api_url
binding
color
country
dimensions
issue_descriptors
language
name
notes
paper_stock
publisher
publishing_format
year_began
year_ended
```

## Limitations / unknowns

- comics-focused, partial modern coverage
- site WAF
