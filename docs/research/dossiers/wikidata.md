# Wikidata Query Service

- **id:** `wikidata`
- **domain:** all (identity, people, awards, events, franchises)
- **base:** `https://query.wikidata.org/sparql`
- **auth:** none
- **freshness:** 24h
- **limits:** 60s query cap; UA required
- **evidence fixtures:** wikidata.json (196 B) (196 B)

## Verified routes

| method | path | status | note |
| --- | --- | --- | --- |
| GET | `/sparql?format=json&query=` | 200 | SPARQL |
| GET | `https://www.wikidata.org/wiki/Special:EntityData/{qid}.json` | 200 | entity JSON |

## Observed field universe

7 distinct key paths, preserved verbatim from evidence.

```
head
head.vars
results
results.bindings
results.bindings.[].x
results.bindings.[].x.type
results.bindings.[].x.value
```

## Limitations / unknowns

- community data quality
- query timeouts
- CC0
