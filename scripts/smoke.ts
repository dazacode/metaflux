#!/usr/bin/env bun
/** Live smoke test across every domain. Does not assert exact titles. */
import { searchEntities } from "../src/core/aggregate.ts";
import { allProviders, loadProviders } from "../src/providers/index.ts";
import type { Kind } from "../src/schema/entities.ts";

loadProviders();

const CASES: { q: string; kind: Kind; label: string }[] = [
  { q: "frieren", kind: "anime", label: "anime" },
  { q: "one piece", kind: "manga", label: "manga" },
  { q: "solo leveling", kind: "manhwa", label: "manhwa" },
  { q: "batman", kind: "comic", label: "comics" },
  { q: "dune", kind: "book", label: "books" },
  { q: "severance", kind: "tv_show", label: "tv" },
  { q: "inception", kind: "movie", label: "movie" },
  { q: "my mister", kind: "tv_show", label: "kdrama" },
  { q: "iu", kind: "music_artist", label: "kpop" },
  { q: "coldplay", kind: "music_artist", label: "music" },
  { q: "arsenal", kind: "sports_team", label: "sports" },
  { q: "nasa", kind: "iptv_channel", label: "iptv" },
  { q: "hololive", kind: "vtuber", label: "vtubers" },
  { q: "jazz", kind: "radio_station", label: "radio" },
];

let ok = 0;
for (const c of CASES) {
  const started = performance.now();
  try {
    const res = await searchEntities(c.q, [c.kind], { limit: 5 });
    const kinds = [...new Set(res.entities.map((e) => e.kind))].join(",");
    const hit = res.providers_hit.join(",");
    const status = res.entities.length ? "PASS" : "EMPTY";
    if (res.entities.length) ok++;
    console.log(`${status.padEnd(6)} ${c.label.padEnd(10)} ${String(Math.round(performance.now() - started)).padStart(5)}ms results=${res.entities.length} providers=${hit} kinds=${kinds}`);
  } catch (err) {
    console.log(`FAIL   ${c.label.padEnd(10)} ${err instanceof Error ? err.message : err}`);
  }
}
console.log(`\n${ok}/${CASES.length} domains returned data across ${allProviders().length} providers`);
process.exit(ok === CASES.length ? 0 : 1);
