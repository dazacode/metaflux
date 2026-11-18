# LRCLIB

- **id:** `lrclib`
- **domain:** lyrics (synced + plain)
- **base:** `https://lrclib.net/api`
- **auth:** none
- **freshness:** 30d
- **limits:** be polite
- **evidence fixtures:** lrclib.json (164715 B) (164715 B)

## Verified routes

| method | path | status | note |
| --- | --- | --- | --- |
| GET | `/search?q=` | 200 | lyrics records with syncedLyrics/plainLyrics, duration |
| GET | `/get?artist_name=&track_name=` | 200 | exact lookup |

## Observed field universe

11 distinct key paths, preserved verbatim from evidence.

```
[].albumName
[].artistName
[].duration
[].hasWordSync
[].id
[].instrumental
[].lyricsfile
[].name
[].plainLyrics
[].syncedLyrics
[].trackName
```

## Limitations / unknowns

- community lyrics
- licensing per lyric
