#!/usr/bin/env bun
/** MetaFlux CLI. No keys required. */
import { config } from "../core/config.ts";
import { getEntity, resolveIds, searchEntities } from "../core/aggregate.ts";
import { allProviders, loadProviders, providerPublic } from "../providers/index.ts";
import { loadSnapshots, ingest } from "../../scripts/ingest-lib.ts";
import { parseKinds } from "../schema/kinds.ts";
import type { Kind } from "../schema/entities.ts";

loadProviders();
const [cmd, ...args] = process.argv.slice(2);

function flag(name: string, fallback?: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  if (i >= 0) return args[i + 1];
  const eq = args.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.split("=").slice(1).join("=") : fallback;
}
function positional(): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) { if (!args[i].includes("=")) i++; continue; }
    out.push(args[i]);
  }
  return out;
}

function print(v: unknown, json: boolean) {
  if (json) return console.log(JSON.stringify(v, null, 2));
  const render = (e: any) => {
    const year = e.dates?.start?.year ?? e.dates?.release?.year ?? "";
    console.log(`${e.kind.padEnd(14)} ${e.title?.display ?? e.name}${year ? ` (${year})` : ""}  [${e.id}]`);
    const prov = e.provenance?.sources?.map((s: any) => s.provider).filter((x: string, i: number, a: string[]) => a.indexOf(x) === i) ?? [];
    if (prov.length) console.log(`  from: ${prov.join(", ")}`);
    for (const [label, value] of [["genres", e.classification?.genres?.slice(0, 6).join(", ")], ["score", e.metrics?.score], ["desc", (e.description?.short?.en ?? e.description?.long?.en)?.slice(0, 140)]]) {
      if (value) console.log(`  ${label}: ${value}`);
    }
  };
  Array.isArray(v) ? v.forEach(render) : v && typeof v === "object" && (v as any).kind ? render(v) : console.log(v);
}

const json = args.includes("--json");

switch (cmd) {
  case "serve": {
    await import("../index.ts");
    break;
  }
  case "search": {
    const q = positional().join(" ");
    if (!q) { console.error("usage: metaflux search <query> [--kind anime] [--limit 10] [--json]"); process.exit(1); }
    const res = await searchEntities(q, parseKinds(flag("kind")), { limit: Number(flag("limit", "10")), region: flag("region"), lang: flag("lang"), providers: flag("providers")?.split(",") });
    print(res.entities, json);
    if (!json) console.error(`\n${res.entities.length} results; providers: ${res.providers_hit.join(", ") || "none"}`);
    break;
  }
  case "get": {
    const [kind, id] = positional();
    if (!kind || !id) { console.error("usage: metaflux get <kind> <id> [--json]"); process.exit(1); }
    const e = await getEntity(kind as Kind, id, { debug: true });
    print(e, json);
    break;
  }
  case "resolve": {
    const pairs = positional();
    const ids = Object.fromEntries(pairs.map((p) => p.split(":")));
    if (!Object.keys(ids).length) { console.error("usage: metaflux resolve imdb:tt1375666"); process.exit(1); }
    print(await resolveIds(ids as Record<string, string>), json);
    break;
  }
  case "providers": {
    print(providerPublic(), json || true);
    break;
  }
  case "calendar": {
    const res = await searchEntities(flag("q") ?? "airing", parseKinds(flag("kinds", "anime,tv_show,sports_event")), { limit: 50 });
    print(res.entities, json);
    break;
  }
  case "lyrics": {
    const [artist, track] = positional();
    const p = allProviders().find((x) => x.id === "lrclib");
    const e = await p?.lyrics!({ region: "us", lang: "en", now: new Date(), limit: 1 }, artist ?? "", track ?? "");
    if (!e) { console.error("not found"); process.exit(1); }
    console.log(e.music.lyrics?.synced ?? e.music.lyrics?.plain ?? "");
    break;
  }
  case "ingest": {
    const name = positional()[0];
    if (!name) { console.error("usage: metaflux ingest <iptv|wikidata|openlibrary|radio>"); process.exit(1); }
    console.log(await ingest(name));
    break;
  }
  case "snapshots": {
    console.log(loadSnapshots());
    break;
  }
  case "openapi": {
    const { OPENAPI } = await import("../openapi.ts");
    console.log(JSON.stringify(OPENAPI, null, 2));
    break;
  }
  case "mcp": {
    await import("../mcp.ts");
    break;
  }
  case "health": {
    console.log(JSON.stringify({ ok: true, version: config.version, providers: allProviders().length, network: config.enableNetwork }, null, 2));
    break;
  }
  default:
    console.log(`MetaFlux ${config.version}

  metaflux serve                        start the API
  metaflux search <q> [--kind] [--json] cross-provider search
  metaflux get <kind> <id> [--json]     fetch an entity
  metaflux resolve <provider:id>        resolve ids
  metaflux providers                    provider matrix
  metaflux lyrics <artist> <track>      synced lyrics
  metaflux ingest <snapshot>            bulk ingest
  metaflux mcp                          MCP over stdio
  metaflux openapi                      print OpenAPI

No API keys. Upstreams: ${allProviders().length}.`);
}
