# Jolpica F1 (Ergast successor)

- **id:** `jolpica`
- **domain:** formula 1 schedule, results, standings, drivers, constructors
- **base:** `https://api.jolpi.ca/ergast/f1`
- **auth:** none
- **freshness:** 1h
- **limits:** 4 req/s
- **evidence fixtures:** jolpica.json (10478 B) (10478 B)

## Verified routes

| method | path | status | note |
| --- | --- | --- | --- |
| GET | `/{season}/driverstandings.json` | 200 | standings |
| GET | `/{season}/{round}/results.json` | 200 | race results |
| GET | `/{season}.json` | 200 | schedule |

## Observed field universe

14 distinct key paths, preserved verbatim from evidence.

```
MRData
MRData.StandingsTable
MRData.StandingsTable.StandingsLists
MRData.StandingsTable.StandingsLists.[].DriverStandings
MRData.StandingsTable.StandingsLists.[].round
MRData.StandingsTable.StandingsLists.[].season
MRData.StandingsTable.round
MRData.StandingsTable.season
MRData.limit
MRData.offset
MRData.series
MRData.total
MRData.url
MRData.xmlns
```

## Limitations / unknowns

- F1 only
- Ergast schema
