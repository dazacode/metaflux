# Radio Browser

- **id:** `radio-browser`
- **domain:** radio stations
- **base:** `https://api.radio-browser.info`
- **auth:** none
- **freshness:** 1h
- **limits:** mirror round-robin; 100 req/min
- **evidence fixtures:** radio.json (1631 B) (1631 B)

## Verified routes

| method | path | status | note |
| --- | --- | --- | --- |
| GET | `/json/stations/search?name=&limit=` | 200 | stations with codecs, bitrate, geo, favicon |
| GET | `/json/stations/bycountrycodeexact/{cc}` | 200 | by country |

## Observed field universe

37 distinct key paths, preserved verbatim from evidence.

```
[].bitrate
[].changeuuid
[].clickcount
[].clicktimestamp
[].clicktimestamp_iso8601
[].clicktrend
[].codec
[].country
[].countrycode
[].favicon
[].geo_distance
[].geo_lat
[].geo_long
[].has_extended_info
[].hls
[].homepage
[].iso_3166_2
[].language
[].languagecodes
[].lastchangetime
[].lastchangetime_iso8601
[].lastcheckok
[].lastcheckoktime
[].lastcheckoktime_iso8601
[].lastchecktime
[].lastchecktime_iso8601
[].lastlocalchecktime
[].lastlocalchecktime_iso8601
[].name
[].serveruuid
[].ssl_error
[].state
[].stationuuid
[].tags
[].url
[].url_resolved
[].votes
```

## Limitations / unknowns

- community-contributed URLs
- some dead streams
