export const DOCS_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>MetaFlux — all entertainment metadata, no keys</title>
<style>
:root{--bg:#0a0a0b;--panel:#121215;--line:#26262c;--text:#ececf1;--muted:#9a9aa5;--accent:#7c5cff;--ok:#34d399;--warn:#fbbf24}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1040px;margin:0 auto;padding:48px 24px 96px}
h1{font-size:44px;line-height:1.05;letter-spacing:-.03em;margin:0 0 12px}h2{margin-top:48px;font-size:22px;letter-spacing:-.01em}
p{color:var(--muted)}a{color:var(--accent)}code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
pre{background:var(--panel);border:1px solid var(--line);padding:16px;border-radius:12px;overflow:auto;font-size:13px}
.badge{display:inline-block;border:1px solid var(--line);background:var(--panel);color:var(--ok);padding:4px 10px;border-radius:999px;font-size:12px;margin-right:6px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:24px 0}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px}
.card b{display:block;margin-bottom:4px}.card span{color:var(--muted);font-size:13px}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line)}th{color:var(--muted);font-weight:500}
.k{color:var(--warn)}.muted{color:var(--muted)}
</style></head><body><main>
<span class="badge">no API keys</span><span class="badge">self-hostable</span><span class="badge">field provenance</span><span class="badge">MIT</span>
<h1>Everything entertaining.<br/>One API.</h1>
<p>MetaFlux merges film, TV, anime, manga, manhwa, comics, webtoons, books, music, K-pop, vtubers, live IPTV, radio, sports and event metadata behind one schema. Every upstream is free and keyless; you never paste a key to get started.</p>
<p>Each field carries the provider, URL and timestamp that produced it. <code>raw</code> keeps the original payload. Bulk snapshots and a SQLite cache mean the same API works when an upstream is down or rate-limited.</p>

<h2>Quick start</h2>
<pre>git clone https://github.com/dazacode/metaflux &amp;&amp; cd metaflux
bun install
bun run dev

curl 'http://127.0.0.1:8787/v1/search?q=frieren&amp;kind=anime'
curl 'http://127.0.0.1:8787/v1/anime/anilist:21'
curl 'http://127.0.0.1:8787/v1/sports/scoreboard?league=football/nfl'
curl 'http://127.0.0.1:8787/v1/iptv/channels?country=JP'</pre>

<h2>Domains</h2>
<div class="grid">
<div class="card"><b>Screen</b><span>movies, TV, episodes, award shows, K/J/C-dramas</span></div>
<div class="card"><b>Anime &amp; reading</b><span>anime, manga, manhwa, manhua, webtoons, comics, books, full text</span></div>
<div class="card"><b>Music &amp; idols</b><span>artists, groups, albums, tracks, lyrics, concerts, K-pop profiles</span></div>
<div class="card"><b>Sports</b><span>live scores, local teams, standings, odds, F1, NFL/NBA/MLB/NHL, soccer</span></div>
<div class="card"><b>Live</b><span>IPTV channels, streams, EPG, radio, vtuber streams</span></div>
<div class="card"><b>People</b><span>cast, crew, characters, idols, vtubers, studios, networks</span></div>
</div>

<h2>Provider matrix</h2>
<p><a href="/v1/providers">/v1/providers</a> lists capabilities, rate limits and licences. 36 keyless upstreams are wired in: AniList, Jikan, Kitsu, MangaDex, MangaUpdates, ComicK, GCD, Cinemeta, TVmaze, MyDramaList, Wikidata, Wikipedia, Open Library, Gutendex, Google Books, Crossref, Internet Archive, MusicBrainz, Deezer, iTunes, TheAudioDB, LRCLIB, Holodex, YouTube RSS, VTuber Wiki, Kprofiles, iptv-org, Radio Browser, TheSportsDB, ESPN, Jolpica, OpenLigaDB, MLB, NHL, ARM and TMDB (optional key only).</p>

<h2>Endpoints</h2>
<table>
<tr><th>Method</th><th>Path</th><th>What it does</th></tr>
<tr><td>GET</td><td><code>/v1/search?q=&amp;kind=&amp;limit=</code></td><td>Fan-out across capable providers, collapse by id, rank</td></tr>
<tr><td>GET</td><td><code>/v1/{kind}/{id}</code></td><td>Entity by <code>mf_*</code> or <code>provider:id</code></td></tr>
<tr><td>GET</td><td><code>/v1/{kind}/{id}/{section}</code></td><td>credits, episodes, chapters, streams, people, availability, related</td></tr>
<tr><td>GET</td><td><code>/v1/trending</code>, <code>/v1/discover</code>, <code>/v1/calendar</code></td><td>Browse, chart and schedule</td></tr>
<tr><td>GET</td><td><code>/v1/resolve?ids=imdb:tt1375666</code></td><td>Cross-provider identity resolution</td></tr>
<tr><td>GET</td><td><code>/v1/sports/scoreboard?league=</code></td><td>Live scoreboards and odds</td></tr>
<tr><td>GET</td><td><code>/v1/iptv/channels</code>, <code>/v1/iptv/epg</code></td><td>Channels, streams and XMLTV guides</td></tr>
<tr><td>GET</td><td><code>/v1/music/lyrics?artist=&amp;track=</code></td><td>Synced and plain lyrics</td></tr>
<tr><td>POST</td><td><code>/v1/batch</code></td><td>Up to 50 lookups per call</td></tr>
<tr><td>GET</td><td><code>/openapi.json</code></td><td>OpenAPI 3.1 contract</td></tr>
</table>

<h2>Look at a record</h2>
<pre>curl -s 'http://127.0.0.1:8787/v1/anime/anilist:21' | jq '{
  name: .data.title.display,
  studios: [.data.companies.studios[].name],
  genres: .data.classification.genres,
  episodes: (.data.episodes|length),
  sources: [.data.provenance.sources[].provider]
}'</pre>

<h2>Rules we hold ourselves to</h2>
<ul>
<li>No key, no signup, no per-user quota from MetaFlux itself.</li>
<li>A provider failure never empties a response if another provider answered; <code>meta.unavailable</code> says what failed.</li>
<li>Rate limits are respected per host, with cache, single-flight coalescing, retry-after and circuit breakers.</li>
<li>Attribution is data: <code>provenance.field_sources</code> maps each path to its upstream.</li>
<li>You can self-host behind a VPN or air-gap; <code>bun run ingest</code> seeds bulk snapshots.</li>
</ul>
<p class="muted">Data licences differ per provider; check <code>/v1/providers</code> and the provider dossier before redistribution. Streams are links, not hosted media.</p>
</main></body></html>`;
