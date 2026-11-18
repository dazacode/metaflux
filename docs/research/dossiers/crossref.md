# Crossref

- **id:** `crossref`
- **domain:** books, chapters, papers, DOI
- **base:** `https://api.crossref.org`
- **auth:** none
- **freshness:** 7d
- **limits:** 50 req/s polite pool with mailto
- **evidence fixtures:** crossref.json (2591 B) (2591 B)

## Verified routes

| method | path | status | note |
| --- | --- | --- | --- |
| GET | `/works?query=&rows=` | 200 | works with DOI, publisher, ISBN/ISSN, license, references |
| GET | `/works/{doi}` | 200 | record |

## Observed field universe

66 distinct key paths, preserved verbatim from evidence.

```
message
message-type
message-version
message.facets
message.items
message.items-per-page
message.items.[].DOI
message.items.[].ISBN
message.items.[].URL
message.items.[].abstract
message.items.[].aliases
message.items.[].author
message.items.[].author.[].affiliation
message.items.[].author.[].family
message.items.[].author.[].given
message.items.[].author.[].role
message.items.[].author.[].sequence
message.items.[].container-title
message.items.[].content-domain
message.items.[].content-domain.crossmark-restriction
message.items.[].content-domain.domain
message.items.[].created
message.items.[].created.date-parts
message.items.[].created.date-time
message.items.[].created.timestamp
message.items.[].deposited
message.items.[].deposited.date-parts
message.items.[].deposited.date-time
message.items.[].deposited.timestamp
message.items.[].indexed
message.items.[].indexed.date-parts
message.items.[].indexed.date-time
message.items.[].indexed.timestamp
message.items.[].indexed.version
message.items.[].is-referenced-by-count
message.items.[].isbn-type
message.items.[].isbn-type.[].type
message.items.[].isbn-type.[].value
message.items.[].issued
message.items.[].issued.date-parts
message.items.[].language
message.items.[].member
message.items.[].original-title
message.items.[].page
message.items.[].prefix
message.items.[].published
message.items.[].published-online
message.items.[].published-online.date-parts
message.items.[].published-print
message.items.[].published-print.date-parts
message.items.[].published.date-parts
message.items.[].publisher
message.items.[].reference-count
message.items.[].references-count
message.items.[].resource
message.items.[].resource.primary
message.items.[].resource.primary.URL
message.items.[].score
message.items.[].source
message.items.[].title
message.items.[].type
message.query
message.query.search-terms
message.query.start-index
message.total-results
status
```

## Limitations / unknowns

- scholarly bias
- abstract coverage partial
