# OpenLigaDB

- **id:** `openligadb`
- **domain:** soccer (Bundesliga and others)
- **base:** `https://api.openligadb.de`
- **auth:** none
- **freshness:** 1min
- **limits:** be polite
- **evidence fixtures:** openligadb.json (17837 B) (17837 B)

## Verified routes

| method | path | status | note |
| --- | --- | --- | --- |
| GET | `/getmatchdata/{league}/{season}/{matchday}` | 200 | matches, goals, venue |
| GET | `/getavailableleagues` | 200 | league directory |

## Observed field universe

56 distinct key paths, preserved verbatim from evidence.

```
[].goals
[].goals.[].comment
[].goals.[].goalGetterID
[].goals.[].goalGetterName
[].goals.[].goalID
[].goals.[].isOvertime
[].goals.[].isOwnGoal
[].goals.[].isPenalty
[].goals.[].matchMinute
[].goals.[].scoreTeam1
[].goals.[].scoreTeam2
[].goals.[].scoringTeamId
[].group
[].group.groupID
[].group.groupName
[].group.groupOrderID
[].lastUpdateDateTime
[].leagueId
[].leagueName
[].leagueSeason
[].leagueShortcut
[].location
[].location.locationCity
[].location.locationID
[].location.locationStadium
[].matchDateTime
[].matchDateTimeUTC
[].matchID
[].matchIsFinished
[].matchResults
[].matchResults.[].pointsTeam1
[].matchResults.[].pointsTeam2
[].matchResults.[].resultDescription
[].matchResults.[].resultID
[].matchResults.[].resultName
[].matchResults.[].resultOrderID
[].matchResults.[].resultTypeID
[].matchResults.[].resultTypeKind
[].numberOfViewers
[].team1
[].team1.shortName
[].team1.teamGroupName
[].team1.teamIconUrl
[].team1.teamId
[].team1.teamName
[].team1.tla
[].team1.wikidataId
[].team2
[].team2.shortName
[].team2.teamGroupName
[].team2.teamIconUrl
[].team2.teamId
[].team2.teamName
[].team2.tla
[].team2.wikidataId
[].timeZoneID
```

## Limitations / unknowns

- mostly German leagues
- community data
