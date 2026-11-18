# Virtual YouTuber Wiki (Fandom)

- **id:** `vtuber-wiki`
- **domain:** vtubers
- **base:** `https://virtualyoutuber.fandom.com/api.php`
- **auth:** none
- **freshness:** 7d
- **limits:** be polite
- **evidence fixtures:** vtuberwiki.json (206 B) (206 B)

## Verified routes

| method | path | status | note |
| --- | --- | --- | --- |
| GET | `?action=query&list=search&srsearch=` | 200 | search |
| GET | `?action=parse&page=&prop=wikitext|text` | 200 | profile |

## Observed field universe

13 distinct key paths, preserved verbatim from evidence.

```
batchcomplete
continue
continue.continue
continue.sroffset
query
query.search
query.search.[].ns
query.search.[].pageid
query.search.[].size
query.search.[].snippet
query.search.[].timestamp
query.search.[].title
query.search.[].wordcount
```

## Limitations / unknowns

- community wiki
- CC BY-SA
