# Architecture

```
                    ┌──────────────────────────────────────────────┐
 client / agent ───▶│ Hono app: routes, validation, CORS, envelope   │
                    └───────────────┬──────────────────────────────┘
                                    │ aggregate.ts
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
        provider chain        merge + rank          entity store
       (capability index)    (ids, title, kind)     (SQLite + FTS5)
              │                     │                     │
              ▼                     │                     ▼
        http.ts (cache,             │              provenance index
        limits, breaker)            │
              │                     │
   ┌──────────┴──────────┐          │
   ▼          ▼          ▼          ▼
AniList    MangaDex     ESPN ...  field_sources
```

## Modules

| Path | Responsibility |
| --- | --- |
| `src/schema/entities.ts` | Superset Zod schema, 57 kinds, per-domain blocks |
| `src/schema/kinds.ts` | Kind families, domain groups, parser |
| `src/providers/_types.ts` | Provider contract and capability registry |
| `src/providers/_util.ts` | Source refs, HTML stripping, JSON-LD, id helpers |
| `src/providers/*.ts` | One adapter per upstream |
| `src/core/http.ts` | Cache, single-flight, host bucket, retries, breaker |
| `src/core/aggregate.ts` | Fan-out, deadlines, merge, rank, hydration |
| `src/core/merge.ts` | Union merge, provenance, collapse, field index |
| `src/core/store.ts` | SQLite cache, entity store, FTS, ids, breaker state |
| `src/app.ts` | Routes and response envelope |
| `src/sdk/` | Typed client |
| `src/cli/` | `metaflux` binary |
| `src/mcp.ts` | MCP stdio server |
| `scripts/` | Dossiers, ingest, smoke, OpenAPI |

## Request lifecycle

1. Validate kind/id/query. Bare IMDb, QID and ISBN ids are detected; anything else needs `provider:id` or `?provider=`.
2. Check SQLite for the canonical id (`ids` table) and the entity doc. Fresh docs return immediately.
3. On miss, select providers by `(operation, kind)`, priority, allowlist and domain cap.
4. Fan out in parallel, each under a 5.5 s search / 8 s get deadline and a 4-example per-host concurrency cap.
5. Index every populated leaf path against the producing provider.
6. Collapse duplicates by shared external id, then normalized title+kind. Merge union-first.
7. Rank on title similarity, kind fit, id density, popularity, artwork and description.
8. Persist the merged entity, ids and FTS row.
9. Serialize, trimming `raw` payloads over 600 B unless `debug=true`.

## Cache keys and TTL

Keys are `sha256(method, url, sorted headers, body)`. TTL follows resource class (15 s live scores, 60 s AniList, 5 min MangaDex search, 24 h static, 30 d mappings). A stale window follows every TTL; stale entries revalidate in the background and are the outage fallback.

`Cache-Control: public, max-age=30` is sent to clients. There is no per-client quota; run one instance behind a CDN if you need edge caching.

## Concurrency and failure

- per-host token bucket: 6 rps / 4 concurrent (configurable)
- global cap: 24 concurrent upstream calls
- single-flight by cache key
- retry twice on `429`/`5xx`/network with exponential jitter, honouring `Retry-After`
- circuit opens after 5 consecutive failures, half-opens after 60 s
- provider deadline yields partial results instead of blocking the response

## Merging rules

Arrays union and de-duplicate by `id` (or JSON value). Scalars keep the first non-empty value from the highest-priority provider; empty values never overwrite. Nested objects merge recursively. External ids always union. Every write records its field path.

Collapse requires the same kind and either a shared external id or an exact normalized title. Kind families only affect provider selection, never collapse.

## Provenance

`provenance.field_sources["title.romaji"] = [{ provider, url, fetched_at, confidence }]`. `provenance.sources` is the deduplicated provider list. `partial` and `unavailable` mark incomplete coverage. `raw` holds provider payloads.

Confidence is `verified` for direct provider values, `probable` for merges, `possible`/`unverified` for inferred identity.

## Storage

WAL SQLite (`bun:sqlite`). Tables: `http_cache`, `entities`, `entities_fts`, `ids`, `provider_state`, `snapshots`. FTS5 uses `unicode61 remove_diacritics 2`. The DB is disposable; `bun run ingest` rebuilds durable seeds.

## Security

No inbound auth by default. Set `METAFLUX_CORS` to restrict origins. Secrets are only upstream optional keys and stay in env. The API never executes upstream content; HTML is stripped with a tag regex, JSON is parsed, no upstream script runs. See `SECURITY.md`.

## Scale path

1. CDN in front of read endpoints.
2. Separate ingest workers writing to a shared SQLite/Litestream replica.
3. Move entity search to a read replica/Postgres FTS if > 5M rows.
4. Shard the per-host limiter with Redis when running more than one writer.
5. Keep adapters stateless — they are the only code that needs to change when an upstream does.
