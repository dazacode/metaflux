# Contributing

## Setup

```sh
bun install
bun run typecheck
bun test
bun run dev
```

Node 20+/Bun 1.2+ is expected. No keys are needed.

## Add a provider

1. Pick a source without a key. Probe it with a desktop UA and a contact UA where required.
2. Save a maximal response in `docs/research/evidence/<id>_<route>.json`.
3. Add the source and route to `scripts/dossier.ts`, run `bun scripts/dossier.ts`, read the field universe.
4. Implement `src/providers/<id>.ts` following `_types.ts` and `docs/PROVIDERS.md`.
5. Register it in `src/providers/index.ts`.
6. Add a fixture test in `test/` and a domain case in `scripts/smoke.ts`.
7. Run `bun run typecheck && bun test && bun run smoke`.
8. Open a PR with the dossier diff and one sample response.

## Add a field

1. Add it to the correct block in `src/schema/entities.ts` with a default.
2. Expand defaults in `emptyEntity` if it is an object.
3. Map it in at least one adapter and document it in the OpenAPI entity description.
4. Add a merge assertion if the field has ordering rules.

Fields must be useful to a consumer. Do not add provider-internal noise that `raw` already carries.

## Add a kind

1. Add to `KINDS`, `DOMAIN_OF`, `DOMAIN_KINDS` and `KIND_FAMILY`.
2. Add a provider that can search and get it.
3. Add it to the smoke matrix.

## Style

- TypeScript, no `any` in public signatures.
- One adapter per file; no adapter imports another.
- `snake_case` in the wire schema, `camelCase` in code.
- Return `[]` for empty, throw for transport faults.
- Comments explain upstream quirks, not syntax.

## Tests

Offline tests stub `globalThis.fetch`. A PR that only tests against the live network will flake. Use fixtures. Keep the suite under five seconds.

## Commits

`area: imperative summary` — `anime: add AniList staff pagination`, `core: cap per-host concurrency`.

## Licensing

Code is MIT. By contributing you agree to licence your code under MIT. Provider data keeps its own licence; update `/v1/providers` metadata with the correct terms.

## What gets rejected

- a required key in the default path
- a provider that returns partial shapes
- unbounded sequential calls in `search`
- a scraper without a stable selector test
- dropped fields
- a schema break without a migration note
