# Google Books

- **id:** `googlebooks`
- **domain:** books, ISBN, previews
- **base:** `https://www.googleapis.com/books/v1`
- **auth:** none
- **freshness:** 24h
- **limits:** unkeyed quota; 429 backoff
- **evidence fixtures:** none recorded (0 B)

## Verified routes

| method | path | status | note |
| --- | --- | --- | --- |
| GET | `/volumes?q=&maxResults=` | 200 | search: industry identifiers, sale info, access info, page count |
| GET | `/volumes/{id}` | 200 | record |

## Observed field universe

0 distinct key paths, preserved verbatim from evidence.

```
```

## Limitations / unknowns

- unkeyed quota shared
- preview-only content
