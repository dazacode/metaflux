# MLB Stats API

- **id:** `mlb`
- **domain:** baseball teams, schedule, rosters, stats
- **base:** `https://statsapi.mlb.com/api/v1`
- **auth:** none
- **freshness:** 30s live
- **limits:** undocumented
- **evidence fixtures:** mlb.json (23219 B) (23219 B)

## Verified routes

| method | path | status | note |
| --- | --- | --- | --- |
| GET | `/teams?sportId=1` | 200 | teams |
| GET | `/schedule?sportId=1&date=` | 200 | schedule |
| GET | `/people/{id}` | 200 | player |

## Observed field universe

41 distinct key paths, preserved verbatim from evidence.

```
copyright
teams
teams.[].abbreviation
teams.[].active
teams.[].allStarStatus
teams.[].clubName
teams.[].division
teams.[].division.id
teams.[].division.link
teams.[].division.name
teams.[].fileCode
teams.[].firstYearOfPlay
teams.[].franchiseName
teams.[].id
teams.[].league
teams.[].league.id
teams.[].league.link
teams.[].league.name
teams.[].link
teams.[].locationName
teams.[].name
teams.[].season
teams.[].shortName
teams.[].sport
teams.[].sport.id
teams.[].sport.link
teams.[].sport.name
teams.[].springLeague
teams.[].springLeague.abbreviation
teams.[].springLeague.id
teams.[].springLeague.link
teams.[].springLeague.name
teams.[].springVenue
teams.[].springVenue.id
teams.[].springVenue.link
teams.[].teamCode
teams.[].teamName
teams.[].venue
teams.[].venue.id
teams.[].venue.link
teams.[].venue.name
```

## Limitations / unknowns

- MLB only
- unofficial
