# NHL API

- **id:** `nhl`
- **domain:** hockey standings, schedule, rosters, players
- **base:** `https://api-web.nhle.com/v1`
- **auth:** none
- **freshness:** 30s live
- **limits:** undocumented
- **evidence fixtures:** nhl.json (58397 B) (58397 B)

## Verified routes

| method | path | status | note |
| --- | --- | --- | --- |
| GET | `/standings/now` | 200 | standings |
| GET | `/club-schedule/{team}/now` | 200 | schedule |
| GET | `/player/{id}/landing` | 200 | player |

## Observed field universe

89 distinct key paths, preserved verbatim from evidence.

```
standings
standings.[].conferenceAbbrev
standings.[].conferenceHomeSequence
standings.[].conferenceL10Sequence
standings.[].conferenceName
standings.[].conferenceRoadSequence
standings.[].conferenceSequence
standings.[].date
standings.[].divisionAbbrev
standings.[].divisionHomeSequence
standings.[].divisionL10Sequence
standings.[].divisionName
standings.[].divisionRoadSequence
standings.[].divisionSequence
standings.[].gameTypeId
standings.[].gamesPlayed
standings.[].goalAgainst
standings.[].goalDifferential
standings.[].goalDifferentialPctg
standings.[].goalFor
standings.[].goalsForPctg
standings.[].homeGamesPlayed
standings.[].homeGoalDifferential
standings.[].homeGoalsAgainst
standings.[].homeGoalsFor
standings.[].homeLosses
standings.[].homeOtLosses
standings.[].homePoints
standings.[].homeRegulationPlusOtWins
standings.[].homeRegulationWins
standings.[].homeTies
standings.[].homeWins
standings.[].l10GamesPlayed
standings.[].l10GoalDifferential
standings.[].l10GoalsAgainst
standings.[].l10GoalsFor
standings.[].l10Losses
standings.[].l10OtLosses
standings.[].l10Points
standings.[].l10RegulationPlusOtWins
standings.[].l10RegulationWins
standings.[].l10Ties
standings.[].l10Wins
standings.[].leagueHomeSequence
standings.[].leagueL10Sequence
standings.[].leagueRoadSequence
standings.[].leagueSequence
standings.[].losses
standings.[].otLosses
standings.[].placeName
standings.[].placeName.default
standings.[].pointPctg
standings.[].points
standings.[].regulationPlusOtWinPctg
standings.[].regulationPlusOtWins
standings.[].regulationWinPctg
standings.[].regulationWins
standings.[].roadGamesPlayed
standings.[].roadGoalDifferential
standings.[].roadGoalsAgainst
standings.[].roadGoalsFor
standings.[].roadLosses
standings.[].roadOtLosses
standings.[].roadPoints
standings.[].roadRegulationPlusOtWins
standings.[].roadRegulationWins
standings.[].roadTies
standings.[].roadWins
standings.[].seasonId
standings.[].shootoutLosses
standings.[].shootoutWins
standings.[].streakCode
standings.[].streakCount
standings.[].teamAbbrev
standings.[].teamAbbrev.default
standings.[].teamCommonName
standings.[].teamCommonName.default
standings.[].teamLogo
standings.[].teamLogoDark
standings.[].teamName
standings.[].teamName.default
standings.[].teamName.fr
standings.[].ties
standings.[].waiversSequence
standings.[].wildcardSequence
standings.[].winPctg
standings.[].wins
standingsDateTimeUtc
wildCardIndicator
```

## Limitations / unknowns

- NHL only
- unofficial
