# TVmaze

- **id:** `tvmaze`
- **domain:** tv, episodes, people, schedule
- **base:** `https://api.tvmaze.com`
- **auth:** none
- **freshness:** 1h
- **limits:** 20 calls / 10 s per IP
- **evidence fixtures:** tvmaze_full.json (66768 B) (66768 B)

## Verified routes

| method | path | status | note |
| --- | --- | --- | --- |
| GET | `/search/shows?q=` | 200 | search |
| GET | `/shows/{id}?embed[]=episodes&embed[]=cast&embed[]=crew&embed[]=images&embed[]=akas` | 200 | full record |
| GET | `/schedule?date=&country=` | 200 | broadcast calendar |
| GET | `/people/{id}` | 200 | person + credits |

## Observed field universe

134 distinct key paths, preserved verbatim from evidence.

```
_embedded
_embedded.akas
_embedded.akas.[].country
_embedded.akas.[].country.code
_embedded.akas.[].country.name
_embedded.akas.[].country.timezone
_embedded.akas.[].name
_embedded.cast
_embedded.cast.[].character
_embedded.cast.[].character._links
_embedded.cast.[].character._links.self
_embedded.cast.[].character.id
_embedded.cast.[].character.image
_embedded.cast.[].character.image.medium
_embedded.cast.[].character.image.original
_embedded.cast.[].character.name
_embedded.cast.[].character.url
_embedded.cast.[].person
_embedded.cast.[].person._links
_embedded.cast.[].person._links.self
_embedded.cast.[].person.birthday
_embedded.cast.[].person.country
_embedded.cast.[].person.country.code
_embedded.cast.[].person.country.name
_embedded.cast.[].person.country.timezone
_embedded.cast.[].person.deathday
_embedded.cast.[].person.gender
_embedded.cast.[].person.id
_embedded.cast.[].person.image
_embedded.cast.[].person.image.medium
_embedded.cast.[].person.image.original
_embedded.cast.[].person.name
_embedded.cast.[].person.updated
_embedded.cast.[].person.url
_embedded.cast.[].self
_embedded.cast.[].voice
_embedded.crew
_embedded.crew.[].person
_embedded.crew.[].person._links
_embedded.crew.[].person._links.self
_embedded.crew.[].person.birthday
_embedded.crew.[].person.country
_embedded.crew.[].person.country.code
_embedded.crew.[].person.country.name
_embedded.crew.[].person.country.timezone
_embedded.crew.[].person.deathday
_embedded.crew.[].person.gender
_embedded.crew.[].person.id
_embedded.crew.[].person.image
_embedded.crew.[].person.image.medium
_embedded.crew.[].person.image.original
_embedded.crew.[].person.name
_embedded.crew.[].person.updated
_embedded.crew.[].person.url
_embedded.crew.[].type
_embedded.episodes
_embedded.episodes.[]._links
_embedded.episodes.[]._links.self
_embedded.episodes.[]._links.self.href
_embedded.episodes.[]._links.show
_embedded.episodes.[]._links.show.href
_embedded.episodes.[]._links.show.name
_embedded.episodes.[].airdate
_embedded.episodes.[].airstamp
_embedded.episodes.[].airtime
_embedded.episodes.[].id
_embedded.episodes.[].image
_embedded.episodes.[].image.medium
_embedded.episodes.[].image.original
_embedded.episodes.[].name
_embedded.episodes.[].number
_embedded.episodes.[].rating
_embedded.episodes.[].rating.average
_embedded.episodes.[].runtime
_embedded.episodes.[].season
_embedded.episodes.[].summary
_embedded.episodes.[].type
_embedded.episodes.[].url
_embedded.images
_embedded.images.[].id
_embedded.images.[].main
_embedded.images.[].resolutions
_embedded.images.[].resolutions.medium
_embedded.images.[].resolutions.medium.height
_embedded.images.[].resolutions.medium.url
_embedded.images.[].resolutions.medium.width
_embedded.images.[].resolutions.original
_embedded.images.[].resolutions.original.height
_embedded.images.[].resolutions.original.url
_embedded.images.[].resolutions.original.width
_embedded.images.[].type
_links
_links.previousepisode
_links.previousepisode.href
_links.previousepisode.name
_links.self
_links.self.href
averageRuntime
dvdCountry
ended
externals
externals.imdb
externals.thetvdb
externals.tvrage
genres
id
image
image.medium
image.original
language
name
network
network.country
network.country.code
network.country.name
network.country.timezone
network.id
network.name
network.officialSite
officialSite
premiered
rating
rating.average
runtime
schedule
schedule.days
schedule.time
status
summary
type
updated
url
webChannel
weight
```

## Limitations / unknowns

- no key
- ETag supported
- CC BY-SA data
