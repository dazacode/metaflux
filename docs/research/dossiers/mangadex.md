# MangaDex

- **id:** `mangadex`
- **domain:** manga, manhwa, manhua, chapters
- **base:** `https://api.mangadex.org`
- **auth:** none
- **freshness:** 5min search, 1h chapter
- **limits:** 5 req/s per IP, 429 + Retry-After
- **evidence fixtures:** mangadex_one.json (7826 B), mangadex_detail.json (7836 B) (15662 B)

## Verified routes

| method | path | status | note |
| --- | --- | --- | --- |
| GET | `/manga?title=&limit=&includes[]=` | 200 | search with author/artist/cover includes |
| GET | `/manga/{id}?includes[]=` | 200 | record; relationships carry authors, cover, tags |
| GET | `/manga/{id}/feed?translatedLanguage[]=&order[chapter]=` | 200 | chapter feed |
| GET | `/at-home/server/{chapterId}` | 200 | page image URLs |

## Observed field universe

133 distinct key paths, preserved verbatim from evidence.

```
data
data.[].attributes
data.[].attributes.altTitles
data.[].attributes.altTitles.[].ca
data.[].attributes.altTitles.[].ja
data.[].attributes.availableTranslatedLanguages
data.[].attributes.chapterNumbersResetOnNewVolume
data.[].attributes.contentRating
data.[].attributes.createdAt
data.[].attributes.description
data.[].attributes.description.en
data.[].attributes.isLocked
data.[].attributes.lastChapter
data.[].attributes.lastVolume
data.[].attributes.latestUploadedChapter
data.[].attributes.links
data.[].attributes.links.al
data.[].attributes.links.ap
data.[].attributes.links.engtl
data.[].attributes.links.mal
data.[].attributes.links.mu
data.[].attributes.officialLinks
data.[].attributes.originalLanguage
data.[].attributes.publicationDemographic
data.[].attributes.state
data.[].attributes.status
data.[].attributes.tags
data.[].attributes.tags.[].attributes
data.[].attributes.tags.[].id
data.[].attributes.tags.[].relationships
data.[].attributes.tags.[].type
data.[].attributes.title
data.[].attributes.title.en
data.[].attributes.updatedAt
data.[].attributes.version
data.[].attributes.year
data.[].id
data.[].relationships
data.[].relationships.[].attributes
data.[].relationships.[].attributes.biography
data.[].relationships.[].attributes.booth
data.[].relationships.[].attributes.createdAt
data.[].relationships.[].attributes.fanBox
data.[].relationships.[].attributes.fantia
data.[].relationships.[].attributes.imageUrl
data.[].relationships.[].attributes.melonBook
data.[].relationships.[].attributes.name
data.[].relationships.[].attributes.namicomi
data.[].relationships.[].attributes.naver
data.[].relationships.[].attributes.nicoVideo
data.[].relationships.[].attributes.pixiv
data.[].relationships.[].attributes.skeb
data.[].relationships.[].attributes.tumblr
data.[].relationships.[].attributes.twitter
data.[].relationships.[].attributes.updatedAt
data.[].relationships.[].attributes.version
data.[].relationships.[].attributes.website
data.[].relationships.[].attributes.weibo
data.[].relationships.[].attributes.youtube
data.[].relationships.[].id
data.[].relationships.[].type
data.[].type
data.attributes
data.attributes.altTitles
data.attributes.altTitles.[].ca
data.attributes.altTitles.[].ja
data.attributes.availableTranslatedLanguages
data.attributes.chapterNumbersResetOnNewVolume
data.attributes.contentRating
data.attributes.createdAt
data.attributes.description
data.attributes.description.en
data.attributes.isLocked
data.attributes.lastChapter
data.attributes.lastVolume
data.attributes.latestUploadedChapter
data.attributes.links
data.attributes.links.al
data.attributes.links.ap
data.attributes.links.engtl
data.attributes.links.mal
data.attributes.links.mu
data.attributes.officialLinks
data.attributes.originalLanguage
data.attributes.publicationDemographic
data.attributes.state
data.attributes.status
data.attributes.tags
data.attributes.tags.[].attributes
data.attributes.tags.[].attributes.description
data.attributes.tags.[].attributes.group
data.attributes.tags.[].attributes.name
data.attributes.tags.[].attributes.version
data.attributes.tags.[].id
data.attributes.tags.[].relationships
data.attributes.tags.[].type
data.attributes.title
data.attributes.title.en
data.attributes.updatedAt
data.attributes.version
data.attributes.year
data.id
data.relationships
data.relationships.[].attributes
data.relationships.[].attributes.biography
data.relationships.[].attributes.biography.en
data.relationships.[].attributes.booth
data.relationships.[].attributes.createdAt
data.relationships.[].attributes.fanBox
data.relationships.[].attributes.fantia
data.relationships.[].attributes.imageUrl
data.relationships.[].attributes.melonBook
data.relationships.[].attributes.name
data.relationships.[].attributes.namicomi
data.relationships.[].attributes.naver
data.relationships.[].attributes.nicoVideo
data.relationships.[].attributes.pixiv
data.relationships.[].attributes.skeb
data.relationships.[].attributes.tumblr
data.relationships.[].attributes.twitter
data.relationships.[].attributes.updatedAt
data.relationships.[].attributes.version
data.relationships.[].attributes.website
data.relationships.[].attributes.weibo
data.relationships.[].attributes.youtube
data.relationships.[].id
data.relationships.[].type
data.type
limit
offset
response
result
total
```

## Limitations / unknowns

- scanlation sources, not official text
- region CDN drift
