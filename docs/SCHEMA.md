# Schema reference

The schema is a superset. Every field exists on every entity; missing data is `null` or `[]`. Language-keyed maps accept BCP-47 tags. Objects are passthrough, so a new provider field never breaks a client.

## Top level

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | `mf_<kind>_<ulid>` |
| `kind` | enum | one of 57, see `/v1/kinds` |
| `domain` | enum | screen, anime, reading, music, sports, live, people, meta |
| `name` | string | display fallback |
| `format` | string \| null | release format: `TV`, `TV_SHORT`, `MOVIE`, `SPECIAL`, `OVA`, `ONA`, `MUSIC`, `MANGA`, `NOVEL`, `ONE_SHOT`; live-action `MOVIE` / `SERIES` |
| `season` | object \| null | broadcast season `{ name: winter\|spring\|summer\|fall, year }`; manga carry `{ name: null, year }` |
| `score` | number | internal rank, not a rating |
| `raw` | object | verbatim provider payloads, trimmed over 600 B unless `?debug=true` |
| `provenance` | object | attribution and coverage |

## `title`

`display`, `romaji`, `english`, `native`, `sort`, `short`, `full`, `acronym`, `aliases[]`, `localized{lang:title}`, `transliterations[]`, `former[]`, `is_placeholder`.

## `description`

All language maps: `tagline`, `short`, `long`, `synopsis`, `outline`, `notes`, `trivia`, `warning`, `quote`.

## `images`

Arrays: `poster`, `backdrop`, `banner`, `logo`, `clearart`, `cutout`, `thumbnail`, `icon`, `fanart`, `screenshots`, `profile`, `cover`, `hero`, `color`, `blurhash`. Scalars: `aspect_ratio`, `width`, `height`, `dominant_color`.

## `external_ids`

`provider -> string[]`. The first value of a key is the record's own id (`external_ids.mal[0]` is the work itself). Keys in use: `imdb`, `tmdb`, `tvdb`, `tvmaze`, `anilist`, `mal`, `anidb`, `kitsu`, `mangadex`, `mangaupdates`, `comick`, `gcd`, `openlibrary`, `isbn10`, `isbn13`, `oclc`, `lccn`, `doi`, `musicbrainz`, `deezer`, `itunes`, `isrc`, `upc`, `wikidata`, `espn`, `thesportsdb`, `jolpica`, `mlb`, `nhl`, `iptv_org`, `radio`, `youtube`, `twitch`, `holodex`, `mdl`, `kprofiles`, `vtuber_wiki`, `internetarchive`, `gutenberg`, `crossref`, `googlebooks`, `arm`.

### Ids in requests

`GET /v1/{kind}/{provider}:{id}` accepts the compound forms clients store: `mal:52991` (anime), `mal:manga:13`, `anilist:154587`, `anilist:manga:30013`, `tmdb:tv:1396`, `tmdb:movie:603` (bare `tmdb:603` uses the path kind), `anilist:staff:95185`, `anilist:character:176754`, `mdl:18452`, `tvmaze:169`, `kitsu:46474`, `anidb:17617`, `imdb:tt0903747` or bare `tt0903747`.

Ids are looked up inside an **id scope** derived from the kind: `anime` (anime, anime_movie), `manga` (manga, manhwa, manhua, webtoon), `movie`, `tv`, `person`, `character`, else the domain. MAL anime 13 and MAL manga 13 never collide; TMDB movie and TV ids never collide.

Records never merge when they carry different values for a precise id (`mal`, `anilist`, `kitsu`, `anidb`, `mangadex`, `tvmaze`, `mdl`, `imdb`, `tmdb`, `tvdb`). For anime and manga, `imdb`/`tmdb`/`tvdb`/`wikidata` are coarse (every season of a franchise shares them) and never cause a merge. Keys ending in `_season`/`_episode` are labels, not identities.

## `dates`

`start`, `end`, `premiere`, `finale`, `airing`, `release`, `announced`, `cancelled`, `founded`, `born`, `died`, `debut`, `graduation`, `last_updated`, `added`, `modified`. Each is `{ year, month, day, date, time, timezone, precision }`.

## `status`

`state` (announced, upcoming, airing, releasing, ongoing, completed, finished, hiatus, cancelled, ended, live, scheduled, postponed, discontinued, unknown), `comment{lang}`, boolean flags, `quality`.

## `classification`

`tags[]` are human-readable (AniList tags, MyDramaList tags). Internal `namespace:value` markers (`type:series`, `source:MANGA`, `lang:ko`, `hashtag:#…`) live in `keywords[]`.

`genres[]`, `themes[]`, `demographics[]`, `keywords[]`, `content_warnings[]`, `tags[{name,category,rank,spoiler,adult}]`, `audience`, `content_rating`, `age_rating`, `is_adult`.

## `metrics`

`score`, `score_scale`, `weighted_score`, `mean_score`, `votes`, `rank`, `rank_context`, `popularity`, `trending`, `favourites`, `followers`, `members`, `views`, `subscribers`, `likes`, `comments`, `downloads`, `plays`, `listeners`, `viewers`, `concurrent_viewers`, `rating_breakdown{}`, `distributions{}`.

## `credits`

Array of `{ person{id,name,native_name,kind,image,url,external_ids,language,country,occupations[]}, role, character, voice, language, voices[], order, department, job, as, episodes[], sources[] }`.

Anime credits (AniList):

- character rows: `department: "characters"`, `role: MAIN|SUPPORTING|BACKGROUND`, `person` = the character (`id: anilist:character:<n>`, `native_name`), `voices: [{ person: {id, name}, language }]`
- voice rows: `voice: true`, `department: "voice"`, `person` = the voice actor (`external_ids.anilist`), `character` = `{id, name, native_name}` of the character, `language` (`Japanese`, `English`, …), `role` = the character's role
- staff rows: `department: "staff"`, `role` = AniList staff role (`Director`, `Original Creator`), `person.occupations`

Live-action cast (TVmaze): `role: "cast"`, `character.name`, `person.id: tvmaze:person:<n>`.

## `companies`

`production[]`, `studios[]`, `distributors[]`, `publishers[]`, `labels[]`, `networks[]`, `licensors[]`, `developers[]` of person refs.

## `relations`

`{ kind, target_id, target?, title, role, direction, weight, note{lang}, sources[] }`. `target_id` uses the client key form (`mal:<n>`, `mal:manga:<n>`, falling back to `anilist:<n>`).

People (`person`, `character`) list the works they are credited on in `person.filmography[]` as the same edge shape: `kind: staff|character`, `role` (`Director`, `main`, `Theme Song Performance (OP4)`), `target` a light work record with `external_ids.mal/anilist`, `format`, poster. Kinds: sequel, prequel, side_story, spin_off, adaptation, source, alternative, parent, child, season, episode, chapter, volume, track, album, member, subgroup, solo, collaboration, remake, reboot, compilation, summary, character, staff, venue, tour, league, team, player, event, edition, translation, recommendation, collection, software, podcast.

## `episodes`, `seasons`, `chapters`, `volumes`, `tracks`, `members`

- episode: `id`, season, number, absolute_number, title, titles{lang}, description{lang}, air_date, air_time, runtime, image, rating, votes, is_filler, is_recap, external_ids{tvdb,anidb}, kind (regular/special/recap/ova/ona/movie/filler), sources

Episodes are consolidated after every merge: one row per (special?, number) for anime and per (season, number) for screen. The earliest provider wins per field, `is_filler`/`is_recap` are OR-ed, sources union. Ids are stable: `mal:<id>:ep:<n>` (specials `…:ep:S<n>`) and `imdb:<tt>:s<season>e<n>`. Anime `season`/`absolute_number` are TVDB's (from ani.zip). Seasons are consolidated by `number`.
- season: `id`, number, title, description{lang}, air_date, end_date, episodes, image, score
- chapter: `id`, number, volume, title, language, pages, published_at, updated_at, external_url, scanlation_group
- track: `id`, number, disc, title, duration_ms, isrc, preview_url, explicit, bpm, musical_key, rank, lyrics{plain,synced,language,source}, credits
- member: relation edge

## `availability`

`regions[]`, and arrays of stream options in `streaming`, `linear`, `iptv`, `radio`, `rental`, `purchase`, `free`, `downloads`; `official_site`, `where_to_watch_url`.

Stream option: `{ provider, region[], url, kind, quality, audio[], subtitles[], price{amount,currency,period}, drm, expires_at, is_official, sources[] }`. Kinds: subscription, free, ads, rent, buy, linear, iptv, radio, embed, download, trailer.

## `technical`

Runtime, resolution, width, height, aspect_ratio, fps, bitrate_kbps, video_codec, audio_codec, audio_channels, container, audio_languages[], subtitle_languages[], subtitle/dub/color/3d/hdr/chapter flags, page_count, word_count, file_size_bytes, formats[], drm[].

## `broadcast`

`network`, `web_channel`, country (ISO-3166 alpha-2 origin country), timezone, time, days[], schedule[{day,time,timezone}], `next_episode{number, airing_at, time_until_s, precision, season?}`, simulcast/subbed/dubbed flags.

## Counts

`technical.episode_count` (planned total), `technical.special_count`, `technical.season_count`, `manga.chapter_count`, `manga.volume_count`.

## `manga`

Demographic, publication, serialization, magazine, imprint, oneshot/doujin/colored/webtoon flags, reading_direction, original_language, translated_languages[], chapter/volume counts, latest chapter/volume, reset flag, scanlation_groups[], official_links[], chapters[], volumes[].

## `literature`

ISBN-10/13, ISSN, LCCN, OCLC, DOI, Dewey, pages, word count, reading level, audience, edition, printing, imprint, binding, format, series[], subjects[], fulltext_url, IA identifier, lending{available,status,url}, copyright{status,year,holder,license}.

## `music`

artist[], album, release_type, release_status, release_country, label[], catalog_number, barcode, ISRC[], UPC[], BPM, key, duration_ms, explicit, instrumental, track/disc counts, genres, styles, moods, preview_url, stream_url, lyrics, credits[], tracks[], discs[], related_projects[].

## `sports`

Sport, league, season, round, week, venue, city, country, home/away team, scores, clock, period, status detail, officials[], attendance, weather{}, odds{}, standings{rank,wins,losses,ties,points,pct,games_played,streak,form,home{},away{}}, lineups[], injuries[], plays[], statistics{}, tickets[], broadcast[].

## `live`

`is_live`, started_at, scheduled_start, ended_at, viewers, likes, chat_id, topic, status, clips[], videos[].

## `event`

event_type, venue, city, country, address, coordinates, doors_open, start, end, timezone, tour, lineup[], setlist[], age_rating, ticket_status, ticket_url, is_streamed, stream_url.

## `iptv`

channel_id, channel_name, alt_names[], network, owners[], country, country_name, subdivision, city, languages[], categories[], is_nsfw, launched, closed, replaced_by, website, epg_ids[], geo_block[], streams[], stream_count, has_epg.

## `person` and `vtuber`

Person: gender, birthday, deathday, age, birthplace, home town, nationality[], ethnicity, height, weight, blood type, zodiac, occupations[], instruments[], genres[], member_of[], former_member_of[], agency, label, debut, graduation, years active, positions[], socials{}, site, fanclub, fandom name, group flags, subunit_of[], associated_acts[], awards[], discography[], filmography[], trivia{lang}.

Vtuber: org, suborg, group, unit, debut, graduation, birthday, height, designers[], modelers[], persona{lang}, oshi mark, fan name, hashtags{}, catchphrases[], lore{lang}, streams[], songs[], collabs[], independent/graduated/affiliated flags, languages[], topics[], youtube{}, twitch{}, twitter.

## `media` and `links`

`media.trailers[]`, `videos[]`, `screenshots[]`, `theme_songs[]`, `soundtrack[]`. `links[]` of `{url,site,kind,language,is_official,color,icon}`.

## `provenance`

A synopsis filled from Wikipedia (only when no provider has one) is credited in `field_sources["description.long"]` and `["description.long.<lang>"]` with the article `url` and `license: "CC BY-SA 4.0"`.

`generated_at`, `generated_by`, `version`, `field_sources{path: source[]}`, `sources[]`, `warnings[]`, `coverage{}`, `cache{hit,age_ms,ttl_ms,stale}`, `partial`, `unavailable[]`.

Source ref: `{ provider, route, url, fetched_at, confidence, sha256, license, note }`.

## Projection

Any endpoint takes `?fields=title,images,format` to return only those top-level keys of each entity (plus `id`, `kind`, `domain`, `name`, `external_ids`).

## Stability

Additive changes are minor. Removing or retyping a field is major. Consumers should ignore unknown keys and treat every field as optional.
