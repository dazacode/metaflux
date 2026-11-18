#!/usr/bin/env bash
set -euo pipefail
BASE="${METAFLUX_URL:-http://127.0.0.1:8787}"

echo "— search anime"
curl -sS "$BASE/v1/search?q=frieren&kind=anime&limit=2" | jq '.data[] | {id, title: .title.display, ids: .external_ids}'

echo "— full record, provenance and a section"
curl -sS "$BASE/v1/anime/anilist:154587" | jq '{name: .data.title.display, studios: [.data.companies.studios[].name], sources: .data.provenance.sources}'
curl -sS "$BASE/v1/anime/anilist:154587/episodes" | jq '.data | length'

echo "— local sports"
curl -sS "$BASE/v1/sports/scoreboard?league=soccer/eng.1" | jq '.data[] | {name, state: .status.state, score: [.sports.away_score, .sports.home_score]}'

echo "— live TV and lyrics"
curl -sS "$BASE/v1/iptv/channels?country=JP&q=news&limit=2" | jq '.data[] | {name: .title.display, streams: (.iptv.stream_count)}'
curl -sS "$BASE/v1/music/lyrics?artist=IU&track=Love%20wins%20all" | jq -r '.data.music.lyrics.synced // .data.music.lyrics.plain' | head -10

echo "— resolve across providers"
curl -sS "$BASE/v1/resolve?ids=anilist:154587" | jq '.data.external_ids'
