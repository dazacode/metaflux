# Kitsu

- **id:** `kitsu`
- **domain:** anime, manga
- **base:** `https://kitsu.io/api/edge`
- **auth:** none
- **freshness:** 6h cache
- **limits:** 10 req/s soft
- **evidence fixtures:** kitsu.json (6547 B) (6547 B)

## Verified routes

| method | path | status | note |
| --- | --- | --- | --- |
| GET | `/anime?filter[text]=&page[limit]=` | 200 | JSON:API search |
| GET | `/anime/{id}?include=episodes,streaming-links` | 200 | record + relationships |

## Observed field universe

144 distinct key paths, preserved verbatim from evidence.

```
data
data.[].attributes
data.[].attributes.abbreviatedTitles
data.[].attributes.ageRating
data.[].attributes.ageRatingGuide
data.[].attributes.averageRating
data.[].attributes.canonicalTitle
data.[].attributes.coverImage
data.[].attributes.coverImage.large
data.[].attributes.coverImage.meta
data.[].attributes.coverImage.meta.dimensions
data.[].attributes.coverImage.original
data.[].attributes.coverImage.small
data.[].attributes.coverImage.tiny
data.[].attributes.coverImageTopOffset
data.[].attributes.createdAt
data.[].attributes.description
data.[].attributes.endDate
data.[].attributes.episodeCount
data.[].attributes.episodeLength
data.[].attributes.favoritesCount
data.[].attributes.nextRelease
data.[].attributes.nsfw
data.[].attributes.popularityRank
data.[].attributes.posterImage
data.[].attributes.posterImage.large
data.[].attributes.posterImage.medium
data.[].attributes.posterImage.meta
data.[].attributes.posterImage.meta.dimensions
data.[].attributes.posterImage.original
data.[].attributes.posterImage.small
data.[].attributes.posterImage.tiny
data.[].attributes.ratingFrequencies
data.[].attributes.ratingFrequencies.10
data.[].attributes.ratingFrequencies.11
data.[].attributes.ratingFrequencies.12
data.[].attributes.ratingFrequencies.13
data.[].attributes.ratingFrequencies.14
data.[].attributes.ratingFrequencies.15
data.[].attributes.ratingFrequencies.16
data.[].attributes.ratingFrequencies.17
data.[].attributes.ratingFrequencies.18
data.[].attributes.ratingFrequencies.19
data.[].attributes.ratingFrequencies.2
data.[].attributes.ratingFrequencies.20
data.[].attributes.ratingFrequencies.3
data.[].attributes.ratingFrequencies.4
data.[].attributes.ratingFrequencies.5
data.[].attributes.ratingFrequencies.6
data.[].attributes.ratingFrequencies.7
data.[].attributes.ratingFrequencies.8
data.[].attributes.ratingFrequencies.9
data.[].attributes.ratingRank
data.[].attributes.showType
data.[].attributes.slug
data.[].attributes.startDate
data.[].attributes.status
data.[].attributes.subtype
data.[].attributes.synopsis
data.[].attributes.tba
data.[].attributes.titles
data.[].attributes.titles.en
data.[].attributes.titles.en_jp
data.[].attributes.titles.en_us
data.[].attributes.titles.ja_jp
data.[].attributes.totalLength
data.[].attributes.updatedAt
data.[].attributes.userCount
data.[].attributes.youtubeVideoId
data.[].id
data.[].links
data.[].links.self
data.[].relationships
data.[].relationships.animeCharacters
data.[].relationships.animeCharacters.links
data.[].relationships.animeCharacters.links.related
data.[].relationships.animeCharacters.links.self
data.[].relationships.animeProductions
data.[].relationships.animeProductions.links
data.[].relationships.animeProductions.links.related
data.[].relationships.animeProductions.links.self
data.[].relationships.animeStaff
data.[].relationships.animeStaff.links
data.[].relationships.animeStaff.links.related
data.[].relationships.animeStaff.links.self
data.[].relationships.castings
data.[].relationships.castings.links
data.[].relationships.castings.links.related
data.[].relationships.castings.links.self
data.[].relationships.categories
data.[].relationships.categories.links
data.[].relationships.categories.links.related
data.[].relationships.categories.links.self
data.[].relationships.characters
data.[].relationships.characters.links
data.[].relationships.characters.links.related
data.[].relationships.characters.links.self
data.[].relationships.episodes
data.[].relationships.episodes.links
data.[].relationships.episodes.links.related
data.[].relationships.episodes.links.self
data.[].relationships.genres
data.[].relationships.genres.links
data.[].relationships.genres.links.related
data.[].relationships.genres.links.self
data.[].relationships.installments
data.[].relationships.installments.links
data.[].relationships.installments.links.related
data.[].relationships.installments.links.self
data.[].relationships.mappings
data.[].relationships.mappings.links
data.[].relationships.mappings.links.related
data.[].relationships.mappings.links.self
data.[].relationships.mediaRelationships
data.[].relationships.mediaRelationships.links
data.[].relationships.mediaRelationships.links.related
data.[].relationships.mediaRelationships.links.self
data.[].relationships.productions
data.[].relationships.productions.links
data.[].relationships.productions.links.related
data.[].relationships.productions.links.self
data.[].relationships.quotes
data.[].relationships.quotes.links
data.[].relationships.quotes.links.related
data.[].relationships.quotes.links.self
data.[].relationships.reviews
data.[].relationships.reviews.links
data.[].relationships.reviews.links.related
data.[].relationships.reviews.links.self
data.[].relationships.staff
data.[].relationships.staff.links
data.[].relationships.staff.links.related
data.[].relationships.staff.links.self
data.[].relationships.streamingLinks
data.[].relationships.streamingLinks.links
data.[].relationships.streamingLinks.links.related
data.[].relationships.streamingLinks.links.self
data.[].type
links
links.first
links.last
links.next
meta
meta.count
```

## Limitations / unknowns

- JSON:API sparse fieldsets
- relationship ids need include
