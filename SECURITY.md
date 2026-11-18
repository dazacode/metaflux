# Security

## Model

MetaFlux is a read-only aggregator. It holds no accounts, sessions or user data by default. Its exposure is:

1. inbound HTTP to the API
2. outbound requests to fixed upstream hosts
3. the local SQLite file
4. optional upstream keys in the environment

## Defaults

- binds `127.0.0.1`; set `HOST=0.0.0.0` deliberately
- no inbound auth; add a reverse proxy or bearer gateway for public use
- CORS `*`; set `METAFLUX_CORS=https://app.example` to restrict
- body limit: batch accepts max 50 lookups
- query length capped at 200 chars
- upstream timeouts 12 s, retries 2
- no shell execution and no upstream JavaScript evaluation

## Untrusted upstream content

Titles, descriptions, HTML and XML are data. HTML is reduced with a tag-stripping regex before storage; JSON is parsed with `JSON.parse`. The API does not render HTML by default, so stored script fragments are inert. If a client renders descriptions as HTML, sanitise again.

YAML/Markdown-like prompt-injection text in descriptions is passed through verbatim; agents should treat record text as data.

## Secrets

Only optional upstream keys exist:

```
TMDB_API_KEY
COMICVINE_API_KEY
TRAKT_CLIENT_ID
SPOTIFY_CLIENT_ID
```

They are read from env and never echoed in responses. `/v1/providers` reports only whether a key is required, not its value. Cache rows may contain upstream payloads but never request credentials.

## SSRF and URL handling

Upstream hosts are hard-coded in adapters. There is no user-supplied URL fetch. Stream URLs are returned, not proxied; a client follows them. `iptv-org` streams can point at arbitrary hosts by design.

## Denial of service

- per-host token bucket and concurrency cap bound upstream fan-out
- global concurrency cap bounds file descriptors
- provider deadlines bound tail latency
- cache and circuit breakers shed load
- batch size is capped
- search provider allowlist caps fan-out

The API itself has no per-client quota. Put a CDN or proxy rate limit in front for public deployments.

## Database

WAL SQLite in `.data/`. It contains only public metadata. Back it up like any cache; it is disposable. File permissions follow the process user. Do not expose `.data/` through the web server.

## Known limitations

- HTML adapters (MyDramaList, Kprofiles) are sensitive to markup changes
- upstream terms can forbid commercial redistribution of some fields
- stream URLs are third-party and may be geo-blocked or dead
- no signature verification of upstream responses

## Reporting

Open a private advisory on GitHub or email the maintainer. Include the route, a reproducer and the affected version. Do not include keys.
