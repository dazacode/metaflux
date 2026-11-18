# TheAudioDB

- **id:** `audiodb`
- **domain:** music artist bios and art
- **base:** `https://www.theaudiodb.com/api/v1/json/{key}`
- **auth:** none
- **freshness:** 7d
- **limits:** test key 123; low quota
- **evidence fixtures:** audiodb_artist.json (30098 B) (30098 B)

## Verified routes

| method | path | status | note |
| --- | --- | --- | --- |
| GET | `/search.php?s=` | 200 | artist incl. 15-language bios, art, MusicBrainz id |
| GET | `/searchalbum.php?s=&a=` | 200 | album |
| GET | `/track.php?m=` | 200 | tracks |

## Observed field universe

54 distinct key paths, preserved verbatim from evidence.

```
artists
artists.[].idArtist
artists.[].idLabel
artists.[].intBornYear
artists.[].intCharted
artists.[].intChecked
artists.[].intDiedYear
artists.[].intFollowers
artists.[].intFormedYear
artists.[].intMembers
artists.[].intPopularity
artists.[].strArtist
artists.[].strArtistAlternate
artists.[].strArtistBanner
artists.[].strArtistClearart
artists.[].strArtistCutout
artists.[].strArtistFanart
artists.[].strArtistFanart2
artists.[].strArtistFanart3
artists.[].strArtistFanart4
artists.[].strArtistLogo
artists.[].strArtistStripped
artists.[].strArtistThumb
artists.[].strArtistWideThumb
artists.[].strBiography
artists.[].strBiographyCN
artists.[].strBiographyDE
artists.[].strBiographyES
artists.[].strBiographyFR
artists.[].strBiographyHU
artists.[].strBiographyIL
artists.[].strBiographyIT
artists.[].strBiographyJP
artists.[].strBiographyNL
artists.[].strBiographyNO
artists.[].strBiographyPL
artists.[].strBiographyPT
artists.[].strBiographyRU
artists.[].strBiographySE
artists.[].strCountry
artists.[].strCountryCode
artists.[].strDisbanded
artists.[].strFacebook
artists.[].strGender
artists.[].strGenre
artists.[].strISNIcode
artists.[].strLabel
artists.[].strLastFMChart
artists.[].strLocked
artists.[].strMood
artists.[].strMusicBrainzID
artists.[].strStyle
artists.[].strTwitter
artists.[].strWebsite
```

## Limitations / unknowns

- test key
- artist-centric
