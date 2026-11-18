# Internet Archive

- **id:** `internetarchive`
- **domain:** books, comics, audio, video, software
- **base:** `https://archive.org`
- **auth:** none
- **freshness:** 24h
- **limits:** be polite
- **evidence fixtures:** archive.json (245 B) (245 B)

## Verified routes

| method | path | status | note |
| --- | --- | --- | --- |
| GET | `/advancedsearch.php?q=&fl[]=&rows=&output=json` | 200 | search |
| GET | `/metadata/{identifier}` | 200 | item metadata + files |
| GET | `/services/loans/beta/loan/{identifier}` | 200 | lending status |

## Observed field universe

15 distinct key paths, preserved verbatim from evidence.

```
response
response.docs
response.docs.[].identifier
response.numFound
response.start
responseHeader
responseHeader.QTime
responseHeader.params
responseHeader.params.fields
responseHeader.params.qin
responseHeader.params.query
responseHeader.params.rows
responseHeader.params.start
responseHeader.params.wt
responseHeader.status
```

## Limitations / unknowns

- mixed rights
- some items dark
