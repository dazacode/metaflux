# Deploy

## Local

```sh
bun install && bun run dev
```

Defaults: `127.0.0.1:8787`, SQLite at `.data/metaflux.sqlite`.

## Environment

| Var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8787` | listen port |
| `HOST` | `127.0.0.1` | bind address (`0.0.0.0` in containers) |
| `METAFLUX_DATA_DIR` | `.data` | data directory |
| `METAFLUX_DB` | `.data/metaflux.sqlite` | SQLite path |
| `METAFLUX_CORS` | `*` | allowed origin |
| `METAFLUX_LOG` | `info` | `silent` to quiet request logs |
| `METAFLUX_OFFLINE` | `false` | serve cache/snapshots only |
| `METAFLUX_HOST_RATE` | `6` | requests per host window |
| `METAFLUX_HOST_WINDOW_MS` | `1000` | window length |
| `METAFLUX_HOST_CONCURRENCY` | `4` | per-host parallel calls |
| `METAFLUX_CONCURRENCY` | `24` | global parallel calls |
| `METAFLUX_TIMEOUT_MS` | `12000` | upstream timeout |
| `METAFLUX_RETRIES` | `2` | upstream retries |
| `METAFLUX_UA` | project UA | override the contact UA |
| `METAFLUX_CONTACT` | repo URL | contact for polite pools |
| `TMDB_API_KEY` etc. | empty | optional enrichment only |

## Docker

```sh
docker build -t metaflux .
docker run -p 8787:8787 -v metaflux-data:/data -e METAFLUX_DB=/data/metaflux.sqlite metaflux
```

The image runs as a non-root user, seeds nothing by default and persists `/data`.

## Snapshots

Run once and on a cron before peak:

```sh
bun run ingest iptv
bun run ingest radio
bun run ingest openlibrary
```

`METAFLUX_OFFLINE=true` disables upstream calls; only cache and snapshots are served. This is the air-gapped profile.

## Reverse proxy

Put nginx/Caddy in front for TLS and client rate limits:

```nginx
location /v1/ { proxy_pass http://127.0.0.1:8787; limit_req zone=api burst=40 nodelay; }
```

Set `METAFLUX_CORS` to the real origin and `HOST=127.0.0.1` so only the proxy reaches the app.

## Cloudflare Workers

Hono runs there, but `bun:sqlite` does not. For Workers:

1. swap `core/store.ts` for D1/KV or use a Bun host behind the Worker
2. keep the adapter layer unchanged
3. set a Worker rate-limit rule on `/v1/search`

A Bun VM (Fly, Railway, Hetzner) is the path of least resistance. Example `fly.toml`:

```toml
app = "metaflux"
[build]
  dockerfile = "Dockerfile"
[[vm]]
  memory = "512mb"
```

Mount a volume at `/data` and set `METAFLUX_DB=/data/metaflux.sqlite`.

## Health and metrics

`GET /health` returns cache rows/bytes, entity count, open breakers and uptime. Scrape it or use it as a container healthcheck. Never expose full `?debug=true` responses to the public; they are 10–30× larger.

## Scaling

Read replicas/CDN first. One writer is enough for personal and small-team use. Above ~5M entities, move entity search to Postgres FTS and shard the limiter with Redis; adapters stay untouched.
