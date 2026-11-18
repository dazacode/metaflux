# MusicBrainz

- **id:** `musicbrainz`
- **domain:** music artists, releases, recordings, works, events, relations
- **base:** `https://musicbrainz.org/ws/2`
- **auth:** none-header
- **freshness:** 24h
- **limits:** 1 req/s; descriptive UA with contact required
- **evidence fixtures:** musicbrainz.json (1734 B), mb_artist2.json (134699 B), mb_events3.json (71 B) (136504 B)

## Verified routes

| method | path | status | note |
| --- | --- | --- | --- |
| GET | `/artist?query=&fmt=json` | 200 | search with area, life-span, aliases, tags |
| GET | `/artist/{mbid}?inc=aliases+tags+genres+url-rels+artist-rels+release-groups&fmt=json` | 200 | full relations, release groups, members |
| GET | `/event?query=&fmt=json` | 200 | concerts |
| GET | `/release-group/{id}?inc=artist-credits+genres+ratings&fmt=json` | 200 | album |

## Observed field universe

147 distinct key paths, preserved verbatim from evidence.

```
aliases
aliases.[].begin
aliases.[].end
aliases.[].ended
aliases.[].locale
aliases.[].name
aliases.[].primary
aliases.[].sort-name
aliases.[].type
aliases.[].type-id
area
area.disambiguation
area.id
area.iso-3166-2-codes
area.name
area.sort-name
area.type
area.type-id
artists
artists.[].aliases
artists.[].aliases.[].begin-date
artists.[].aliases.[].end-date
artists.[].aliases.[].locale
artists.[].aliases.[].name
artists.[].aliases.[].primary
artists.[].aliases.[].sort-name
artists.[].aliases.[].type
artists.[].aliases.[].type-id
artists.[].area
artists.[].area.id
artists.[].area.life-span
artists.[].area.life-span.ended
artists.[].area.name
artists.[].area.sort-name
artists.[].area.type
artists.[].area.type-id
artists.[].begin-area
artists.[].begin-area.id
artists.[].begin-area.life-span
artists.[].begin-area.life-span.ended
artists.[].begin-area.name
artists.[].begin-area.sort-name
artists.[].begin-area.type
artists.[].begin-area.type-id
artists.[].country
artists.[].gender
artists.[].gender-id
artists.[].id
artists.[].ipis
artists.[].isnis
artists.[].life-span
artists.[].life-span.begin
artists.[].life-span.ended
artists.[].name
artists.[].score
artists.[].sort-name
artists.[].tags
artists.[].tags.[].count
artists.[].tags.[].name
artists.[].type
artists.[].type-id
begin-area
begin-area.disambiguation
begin-area.id
begin-area.name
begin-area.sort-name
begin-area.type
begin-area.type-id
count
country
created
disambiguation
end-area
events
gender
gender-id
genres
genres.[].count
genres.[].disambiguation
genres.[].id
genres.[].name
id
ipis
isnis
life-span
life-span.begin
life-span.end
life-span.ended
name
offset
relations
relations.[].artist
relations.[].artist.country
relations.[].artist.disambiguation
relations.[].artist.id
relations.[].artist.name
relations.[].artist.sort-name
relations.[].artist.type
relations.[].artist.type-id
relations.[].attribute-credits
relations.[].attribute-ids
relations.[].attribute-ids.bass guitar
relations.[].attribute-ids.guitar
relations.[].attribute-values
relations.[].attributes
relations.[].begin
relations.[].direction
relations.[].end
relations.[].ended
relations.[].source-credit
relations.[].target-credit
relations.[].target-type
relations.[].type
relations.[].type-id
release-groups
release-groups.[].aliases
release-groups.[].aliases.[].begin
release-groups.[].aliases.[].end
release-groups.[].aliases.[].ended
release-groups.[].aliases.[].locale
release-groups.[].aliases.[].name
release-groups.[].aliases.[].primary
release-groups.[].aliases.[].sort-name
release-groups.[].aliases.[].type
release-groups.[].aliases.[].type-id
release-groups.[].disambiguation
release-groups.[].first-release-date
release-groups.[].genres
release-groups.[].genres.[].count
release-groups.[].genres.[].disambiguation
release-groups.[].genres.[].id
release-groups.[].genres.[].name
release-groups.[].id
release-groups.[].primary-type
release-groups.[].primary-type-id
release-groups.[].secondary-type-ids
release-groups.[].secondary-types
release-groups.[].tags
release-groups.[].tags.[].count
release-groups.[].tags.[].name
release-groups.[].title
sort-name
tags
tags.[].count
tags.[].name
type
type-id
```

## Limitations / unknowns

- MBID-keyed
- relation coverage uneven
- CC0 core / CC BY-NC-SA some
