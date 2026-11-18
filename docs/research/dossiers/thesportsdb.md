# TheSportsDB

- **id:** `thesportsdb`
- **domain:** sports teams, players, leagues, events, tables
- **base:** `https://www.thesportsdb.com/api/v1/json/{key}`
- **auth:** none
- **freshness:** 5min events, 24h teams
- **limits:** free test keys 3/123; 30 req/min
- **evidence fixtures:** tsdb_team.json (24341 B), tsdb_player.json (463 B), tsdb_event.json (4574 B) (29378 B)

## Verified routes

| method | path | status | note |
| --- | --- | --- | --- |
| GET | `/searchteams.php?t=` | 200 | team search incl. multi-language descriptions, badges, colours |
| GET | `/searchplayers.php?p=` | 200 | player search |
| GET | `/eventsday.php?d=&s=` | 200 | events by day and sport |
| GET | `/lookuptable.php?l=&s=` | 200 | league table |

## Observed field universe

129 distinct key paths, preserved verbatim from evidence.

```
events
events.[].dateEvent
events.[].dateEventLocal
events.[].idAPIfootball
events.[].idAwayTeam
events.[].idEvent
events.[].idHomeTeam
events.[].idLeague
events.[].idVenue
events.[].intAwayScore
events.[].intAwayScoreExtra
events.[].intHomeScore
events.[].intHomeScoreExtra
events.[].intRound
events.[].intScore
events.[].intScoreVotes
events.[].intSpectators
events.[].strAwayTeam
events.[].strAwayTeamBadge
events.[].strBanner
events.[].strCity
events.[].strCountry
events.[].strDescriptionEN
events.[].strEvent
events.[].strEventAlternate
events.[].strFanart
events.[].strFilename
events.[].strGroup
events.[].strHomeTeam
events.[].strHomeTeamBadge
events.[].strLeague
events.[].strLeagueBadge
events.[].strLocked
events.[].strMap
events.[].strOfficial
events.[].strPoster
events.[].strPostponed
events.[].strResult
events.[].strSeason
events.[].strSport
events.[].strSquare
events.[].strStatus
events.[].strThumb
events.[].strThumbAlternate
events.[].strTime
events.[].strTimeLocal
events.[].strTimestamp
events.[].strTweet1
events.[].strVenue
events.[].strVideo
events.[].strWeather
player
player.[].dateBorn
player.[].idPlayer
player.[].idTeam
player.[].relevance
player.[].strCutout
player.[].strGender
player.[].strNationality
player.[].strPlayer
player.[].strPosition
player.[].strSport
player.[].strStatus
player.[].strTeam
player.[].strThumb
teams
teams.[].idAPIfootball
teams.[].idESPN
teams.[].idLeague
teams.[].idLeague2
teams.[].idLeague3
teams.[].idLeague4
teams.[].idLeague5
teams.[].idLeague6
teams.[].idLeague7
teams.[].idTeam
teams.[].idVenue
teams.[].intFormedYear
teams.[].intLoved
teams.[].strBadge
teams.[].strBanner
teams.[].strColour1
teams.[].strColour2
teams.[].strColour3
teams.[].strCountry
teams.[].strDescriptionCN
teams.[].strDescriptionDE
teams.[].strDescriptionEN
teams.[].strDescriptionES
teams.[].strDescriptionFR
teams.[].strDescriptionHU
teams.[].strDescriptionIL
teams.[].strDescriptionIT
teams.[].strDescriptionJP
teams.[].strDescriptionNL
teams.[].strDescriptionNO
teams.[].strDescriptionPL
teams.[].strDescriptionPT
teams.[].strDescriptionRU
teams.[].strDescriptionSE
teams.[].strDivision
teams.[].strEquipment
teams.[].strFacebook
teams.[].strFanart1
teams.[].strFanart2
teams.[].strFanart3
teams.[].strFanart4
teams.[].strGender
teams.[].strInstagram
teams.[].strKeywords
teams.[].strLeague
teams.[].strLeague2
teams.[].strLeague3
teams.[].strLeague4
teams.[].strLeague5
teams.[].strLeague6
teams.[].strLeague7
teams.[].strLocation
teams.[].strLocked
teams.[].strLogo
teams.[].strRSS
teams.[].strSport
teams.[].strStadium
teams.[].strTeam
teams.[].strTeamAlternate
teams.[].strTeamShort
teams.[].strTwitter
teams.[].strWebsite
teams.[].strYoutube
```

## Limitations / unknowns

- test keys rotate
- shared quota
