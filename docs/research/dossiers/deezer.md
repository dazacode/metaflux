# Deezer public API

- **id:** `deezer`
- **domain:** music artists, albums, tracks, previews
- **base:** `https://api.deezer.com`
- **auth:** none
- **freshness:** 1h
- **limits:** 50 req / 5 s
- **evidence fixtures:** deezer.json (2192 B) (2192 B)

## Verified routes

| method | path | status | note |
| --- | --- | --- | --- |
| GET | `/search?q=&limit=` | 200 | search incl. ISRC, BPM, rank, 30s preview, artist/album art |
| GET | `/artist/{id}/albums` | 200 | discography |
| GET | `/album/{id}/tracks` | 200 | tracklist |

## Observed field universe

40 distinct key paths, preserved verbatim from evidence.

```
data
data.[].album
data.[].album.cover
data.[].album.cover_big
data.[].album.cover_medium
data.[].album.cover_small
data.[].album.cover_xl
data.[].album.id
data.[].album.md5_image
data.[].album.title
data.[].album.tracklist
data.[].album.type
data.[].artist
data.[].artist.id
data.[].artist.link
data.[].artist.name
data.[].artist.picture
data.[].artist.picture_big
data.[].artist.picture_medium
data.[].artist.picture_small
data.[].artist.picture_xl
data.[].artist.tracklist
data.[].artist.type
data.[].duration
data.[].explicit_content_cover
data.[].explicit_content_lyrics
data.[].explicit_lyrics
data.[].id
data.[].isrc
data.[].link
data.[].md5_image
data.[].preview
data.[].rank
data.[].readable
data.[].title
data.[].title_short
data.[].title_version
data.[].type
next
total
```

## Limitations / unknowns

- preview-only audio
- no lyrics
