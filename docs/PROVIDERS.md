# Provider policy

## The promise

Every provider in the default registry is free to call and works without an account. A fresh clone answers every domain with zero environment variables.

## Required shape

```ts
export const example: Provider = {
  id: "example",                 // stable, lowercase, matches the dossier file
  name: "Example",
  domains: ["anime"],
  kinds: ["anime"],
  operations: ["search", "get"], // only what you actually implement
  priority: 40,                  // 0 = best; ties broken by kind fit
  auth: "none",                  // none | none-header | optional-key
  base: "https://api.example",
  license: "CC0",
  freshness: "1h",
  homepage: "https://example",
  notes: "what it is good at, and its quirks",
  namespaces: ["example"],       // id namespaces get() can look up; see below
  scopes: ["anime"],             // id scopes those namespaces apply to
  limits: { "api.example": { rate: 60, windowMs: 60_000, burst: 4, concurrency: 2 } }, // documented budget
  async search(ctx, q) { /* Entity[] */ },
  async get(ctx, ref) { /* Entity | null */ },
};
```

## Rules

1. **No key in the default path.** If a source needs one, `auth: "optional-key"` and `keyEnv`, and return `[]` without it.
2. **Dense mapping.** Map every useful field the source has into the schema. Do not drop a value because no other provider has it.
3. **Provenance.** Use `src(provider, url)` on arrays that carry per-item truth. Aggregation also indexes leaves automatically.
4. **Ids.** Always `addId`. Use the same provider key as the dossier.
5. **Quirks in code.** Browser UA for Cloudflare/CDN targets, `Origin` for Holodex, `includes[]` for MangaDex. Keep them in the adapter, not in a global.
6. **TTL by freshness.** Live 15 s, search 5 min, static 24 h, mappings 30 d.
7. **Deadline-friendly.** Never block on more than one sequential call in `search`. Use `Promise.all` for fan-out inside an adapter.
8. **Fail soft.** Throw on transport trouble; return `[]` on a legitimately empty result.
9. **No HTML parser dependency.** Reuse `stripHtml`, `jsonLd`, `metaTags`.
10. **Fixture.** Add an evidence file, regenerate the dossier, and add a test.

## Namespaces and lookups

An adapter that declares `namespaces` is only asked to `get` when the request (or a resolver) supplies an id in one of them, and `ref.id` / `ref.namespace` are that id. `GET /v1/anime/mal:52991` therefore reaches AniList (`Media(idMal)`), ani.zip, Jikan and Shikimori directly; Kitsu joins in a second wave once ARM or ani.zip has supplied the Kitsu id. Adapters without `namespaces` keep the legacy behaviour, but only for namespaces no declared adapter owns, so `anilist:95185` is never handed to a music or book adapter as a bare number.

Resolvers (`operations: ["resolve"]`) run in the first wave: ARM for anime ids, Wikidata for TMDB/TVDB/TVmaze/IMDb (`haswbstatement:P4983=1396`). Their own records are not merged a second time.

## Rate limits

Each adapter declares the upstream's documented budget per host; `core/http.ts` builds a token bucket per host from it (capacity `burst`, refill `rate` per `windowMs`, `concurrency` in flight). A `429` empties the bucket until `Retry-After`. Current budgets: AniList 30/min burst 6 (the live `X-RateLimit-Limit`), Jikan 60/min burst 2, Shikimori 90/min burst 2, Kitsu 45/min, ani.zip 60/min, ARM 60/min, MangaDex 5/s, TVmaze 20/10 s, MyDramaList 20/min; everything else the global default (6/s).

MyDramaList answers an honest `User-Agent` and challenges a spoofed browser one; the adapter sends the MetaFlux UA.

## Priority bands

| Band | Meaning |
| --- | --- |
| 0–9 | primary, rich, keyless (AniList, Cinemeta, ESPN, Holodex, iptv-org) |
| 10–25 | strong secondary (MangaDex, TVmaze, MusicBrainz, TheSportsDB, Deezer) |
| 26–40 | enrichment / fallback (Jikan, ComicK, OpenLibrary, AudioDB) |
| 41–60 | descriptive only (Wikipedia, VTuber Wiki, Kprofiles) |
| 90+ | resolver-only (ARM) |

A low-priority adapter must still return a complete entity shape, never a bare `{name}`.

## Capability matrix

Run `GET /v1/providers` or `bun -e 'import("./src/providers/index.ts").then(m=>{m.loadProviders();console.log(m.providerPublic())})'`. The dossier for each provider lists its verified routes and complete observed field universe.

## Deliberate exclusions

| Source | Why not |
| --- | --- |
| TMDB, Comic Vine, Trakt, Spotify | keys; included as optional enrichment only |
| JustWatch GraphQL | unstable private token |
| unogs / Netflix | region and token churn |
| Bandsintown | `app_id` gate rejected unauthenticated probes |
| AnimeSchedule | DNS/endpoint churn during research; AniList covers schedules |
| fanart.tv | key required; ani.zip carries TVDB clearlogos and Cinemeta/metahub serves logos keylessly |
| TMDB person ids per cast row | no keyless source; cast carries TVmaze person ids |

## Review checklist

- [ ] bad JSON, empty body, `403` and `429` handled
- [ ] no key required
- [ ] TTL set and justified
- [ ] every field has a schema home
- [ ] `external_ids` populated
- [ ] test fixture committed
- [ ] licence and limits recorded
- [ ] smoke case passes live
