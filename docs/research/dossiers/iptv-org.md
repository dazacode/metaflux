# iptv-org

- **id:** `iptv-org`
- **domain:** iptv channels, streams, EPG guides, countries, languages, categories
- **base:** `https://iptv-org.github.io/api`
- **auth:** none
- **freshness:** 6h static snapshots
- **limits:** static GitHub Pages; ingest locally
- **evidence fixtures:** iptv.json (8002771 B), iptv_guides.json (25619805 B), iptv_categories.json (2773 B) (33625349 B)

## Verified routes

| method | path | status | note |
| --- | --- | --- | --- |
| GET | `/channels.json` | 200 | channel directory with logos, country, categories, network |
| GET | `/streams.json` | 200 | stream urls with quality/referrer/user-agent |
| GET | `/guides.json` | 200 | XMLTV EPG endpoints per country/site |
| GET | `/categories.json` | 200 | categories |

## Observed field universe

20 distinct key paths, preserved verbatim from evidence.

```
[].alt_names
[].categories
[].channel
[].closed
[].country
[].description
[].feed
[].id
[].is_nsfw
[].lang
[].launched
[].name
[].network
[].owners
[].replaced_by
[].site
[].site_id
[].site_name
[].sources
[].website
```

## Limitations / unknowns

- CORS/geo varies by stream
- CC0 index, stream rights vary
