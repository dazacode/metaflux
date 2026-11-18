# Schema reference

The schema is a superset. Every field exists on every entity; missing data is `null` or `[]`. Language-keyed maps accept BCP-47 tags. Objects are passthrough, so a new provider field never breaks a client.

## Top level

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | `mf_<kind>_<ulid>` |
| `kind` | enum | one of 57, see `/v1/kinds` |
| `domain` | enum | screen, anime, reading, music, sports, live, people, meta |
| `name` | string | display fallback |
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

`provider -> string[]`. Keys in use: `imdb`, `tmdb`, `tvdb`, `tvmaze`, `anilist`, `mal`, `anidb`, `kitsu`, `mangadex`, `mangaupdates`, `comick`, `gcd`, `openlibrary`, `isbn10`, `isbn13`, `oclc`, `lccn`, `doi`, `musicbrainz`, `deezer`, `itunes`, `isrc`, `upc`, `wikidata`, `espn`, `thesportsdb`, `jolpica`, `mlb`, `nhl`, `iptv_org`, `radio`, `youtube`, `twitch`, `holodex`, `mdl`, `kprofiles`, `vtuber_wiki`, `internetarchive`, `gutenberg`, `crossref`, `googlebooks`, `arm`.

## `dates`

`start`, `end`, `premiere`, `finale`, `airing`, `release`, `announced`, `cancelled`, `founded`, `born`, `died`, `debut`, `graduation`, `last_updated`, `added`, `modified`. Each is `{ year, month, day, date, time, timezone, precision }`.

## `status`

`state` (announced, upcoming, airing, releasing, ongoing, completed, finished, hiatus, cancelled, ended, live, scheduled, postponed, discontinued, unknown), `comment{lang}`, boolean flags, `quality`.

## `classification`

`genres[]`, `themes[]`, `demographics[]`, `keywords[]`, `content_warnings[]`, `tags[{name,category,rank,spoiler,adult}]`, `audience`, `content_rating`, `age_rating`, `is_adult`.

## `metrics`

`score`, `score_scale`, `weighted_score`, `mean_score`, `votes`, `rank`, `rank_context`, `popularity`, `trending`, `favourites`, `followers`, `members`, `views`, `subscribers`, `likes`, `comments`, `downloads`, `plays`, `listeners`, `viewers`, `concurrent_viewers`, `rating_breakdown{}`, `distributions{}`.

## `credits`

Array of `{ person{id,name,kind,image,url,external_ids,language,country}, role, character, voice, order, department, job, as, episodes[], sources[] }`.

## `companies`

`production[]`, `studios[]`, `distributors[]`, `publishers[]`, `labels[]`, `networks[]`, `licensors[]`, `developers[]` of person refs.

## `relations`

`{ kind, target_id, target?, title, direction, weight, note{lang}, sources[] }`. Kinds: sequel, prequel, side_story, spin_off, adaptation, source, alternative, parent, child, season, episode, chapter, volume, track, album, member, subgroup, solo, collaboration, remake, reboot, compilation, summary, character, staff, venue, tour, league, team, player, event, edition, translation, recommendation, collection, software, podcast.

## `episodes`, `seasons`, `chapters`, `volumes`, `tracks`, `members`

- episode: `id`, season, number, absolute_number, title, description{lang}, air_date, air_time, runtime, image, rating, votes, kind (regular/special/recap/ova/ona/movie/filler), sources
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

`network`, `web_channel`, country, timezone, time, days[], schedule[{day,time,timezone}], simulcast/subbed/dubbed flags.

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

`generated_at`, `generated_by`, `version`, `field_sources{path: source[]}`, `sources[]`, `warnings[]`, `coverage{}`, `cache{hit,age_ms,ttl_ms,stale}`, `partial`, `unavailable[]`.

Source ref: `{ provider, route, url, fetched_at, confidence, sha256, license, note }`.

## Stability

Additive changes are minor. Removing or retyping a field is major. Consumers should ignore unknown keys and treat every field as optional.
