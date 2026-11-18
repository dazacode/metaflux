/**
 * Build a "watch/read/listen tonight" list from every domain.
 * Run: bun examples/tonight.ts
 */
import { MetaFlux } from "../src/sdk/index.ts";

const mf = new MetaFlux({ baseUrl: process.env.METAFLUX_URL ?? "http://127.0.0.1:8787", region: "PH" });

const [anime, tv, films, matches, channels, gigs] = await Promise.all([
  mf.trending("anime", { limit: 3 }),
  mf.trending("tv_show", { limit: 3 }),
  mf.discover("movie", { genre: "science fiction", limit: 3 }),
  mf.scoreboard("soccer/eng.1"),
  mf.iptvChannels("news", "PH"),
  mf.search("concert", { kind: "concert", limit: 3 }),
]);

const row = (label: string, items: any[]) => {
  console.log(`\n${label}`);
  for (const e of items.slice(0, 3)) {
    const year = e.dates?.start?.year ?? "";
    console.log(`  ${e.title?.display} ${year}  ${e.availability?.official_site ?? ""}`);
    console.log(`    sources: ${[...new Set(e.provenance?.sources?.map((s: any) => s.provider))].join(", ")}`);
  }
};

row("Anime", anime.data);
row("TV", tv.data);
row("Films", films.data);
row("Football", matches.data);
row("Live TV", channels.data);
row("Gigs", gigs.data);
