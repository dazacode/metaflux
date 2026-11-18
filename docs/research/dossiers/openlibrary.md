# Open Library

- **id:** `openlibrary`
- **domain:** books, authors, editions, subjects
- **base:** `https://openlibrary.org`
- **auth:** none
- **freshness:** 24h
- **limits:** be polite; UA recommended
- **evidence fixtures:** openlibrary.json (1860 B) (1860 B)

## Verified routes

| method | path | status | note |
| --- | --- | --- | --- |
| GET | `/search.json?q=&limit=` | 200 | search incl. cover ids, ia scans, edition counts |
| GET | `/works/{id}.json` | 200 | work record |
| GET | `/authors/{id}.json` | 200 | author record |
| GET | `/subjects/{subject}.json` | 200 | subject listing |

## Observed field universe

29 distinct key paths, preserved verbatim from evidence.

```
docs
docs.[].author_key
docs.[].author_name
docs.[].cover_edition_key
docs.[].cover_height
docs.[].cover_i
docs.[].cover_width
docs.[].ebook_access
docs.[].edition_count
docs.[].first_publish_year
docs.[].has_fulltext
docs.[].ia
docs.[].ia_collection
docs.[].key
docs.[].language
docs.[].lending_edition_s
docs.[].lending_identifier_s
docs.[].public_scan_b
docs.[].series_key
docs.[].series_name
docs.[].series_position
docs.[].title
documentation_url
numFound
numFoundExact
num_found
offset
q
start
```

## Limitations / unknowns

- volunteer data
- borrowable scans are lending-only
