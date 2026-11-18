import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * Offline parity for list surfaces the Yorozo client renders: fallback rows
 * stay keyable by MAL id (Shikimori, Kitsu mappings), ranked lists answer only
 * the requested kind, and the K-drama shelf is keyed by TMDB via Wikidata.
 */
const SHIKI = readFileSync("docs/research/evidence/shikimori_animes.json", "utf8");
const KITSU = readFileSync("docs/research/evidence/kitsu_mappings.json", "utf8");
const MDL_PAGE = `<div id="mdl-18452" class="box"><div class="box-body"><div class="row"><div class="col-xs-3 row-cell film-cover cover"><div class="item">
<a class="block" href="/18452-goblin"><img class="img-responsive cover lazy" data-src="https://i.mydramalist.com/JkD8Xs.jpg?v=1" alt="Guardian: The Lonely and Great God"/></a></div></div>
<div class="col-xs-9 row-cell content"><div class="ranking pull-right"><span>#178</span></div>
<span class="text-muted">Korean Drama - 2016, 16 episodes</span>
<p><span class="rating"><span class="fill" style="width:88%"></span></span> <span class="p-l-xs score">8.8</span></p>
<p>Kim Sin was once an unbeatable general.</p></div></div></div></div><li class="page-item next"></li>`;

const realFetch = globalThis.fetch;
const json = (body: unknown, status = 200) => new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeAll(() => {
  globalThis.fetch = (async (input: any) => {
    const url = String(input?.url ?? input);
    if (url.includes("graphql.anilist.co")) return json({ errors: [{ message: "Too Many Requests." }] }, 429);
    if (url.includes("api.jikan.moe")) return json({}, 504);
    if (url.startsWith("https://shikimori.io/api/animes")) return json(SHIKI);
    if (url.startsWith("https://kitsu.io/api/edge/anime")) return json(KITSU);
    if (url.startsWith("https://mydramalist.com/search?adv=titles&ty=68&co=3")) return new Response(MDL_PAGE, { status: 200, headers: { "content-type": "text/html" } });
    if (url.startsWith("https://query.wikidata.org/sparql")) {
      const q = decodeURIComponent(url);
      if (q.includes("P3868")) return json({ results: { bindings: [{ item: { value: "http://www.wikidata.org/entity/Q24859151" }, mdl: { value: "18452" }, imdb2: { value: "tt5994364" }, tmdbtv: { value: "67915" }, tvmaze: { value: "16150" } }] } });
      return json({ results: { bindings: [] } });
    }
    return json({ error: "offline" }, 404);
  }) as any;
});
afterAll(() => { globalThis.fetch = realFetch; });

describe("list parity", () => {
  test("fallback search rows are keyed by MAL id when AniList is saturated", async () => {
    const { app } = await import("../src/app.ts");
    const body = await (await app.request("/v1/search?q=frieren&kinds=anime,anime_movie&limit=10&providers=anilist,shikimori,kitsu")).json() as any;
    expect(body.data.length).toBeGreaterThan(0);
    for (const row of body.data) expect(["anime", "anime_movie"]).toContain(row.kind);
    expect(body.data.every((r: any) => (r.external_ids.mal?.length ?? 0) + (r.external_ids.anilist?.length ?? 0) > 0)).toBe(true);
    const s1 = body.data.find((r: any) => r.external_ids.mal?.[0] === "52991");
    expect(s1).toBeTruthy();
    expect(body.meta.unavailable.map((u: any) => u.provider)).toContain("anilist");
  });

  test("Kitsu rows carry MAL and AniList ids from include=mappings", async () => {
    const { kitsu } = await import("../src/providers/kitsu.ts");
    const rows = await kitsu.search!({ region: "us", lang: "en", now: new Date(), limit: 3, kinds: ["anime"] }, "frieren");
    expect(rows[0].external_ids.mal?.[0]).toMatch(/^\d+$/);
    expect(rows[0].external_ids.anilist?.[0]).toMatch(/^\d+$/);
  });

  test("Shikimori rows are MAL ids with Russian titles", async () => {
    const { shikimori } = await import("../src/providers/shikimori.ts");
    const rows = await shikimori.search!({ region: "us", lang: "en", now: new Date(), limit: 5, kinds: ["anime"] }, "frieren");
    const s2 = rows.find((r) => r.external_ids.mal?.[0] === "59978")!;
    expect(s2.title.localized.ru).toBeTruthy();
    expect(s2.format).toBe("TV");
    expect(s2.metrics.score_scale).toBe(100);
  });

  test("the K-drama shelf comes from MyDramaList and is keyed by TMDB via Wikidata", async () => {
    const { app } = await import("../src/app.ts");
    const body = await (await app.request("/v1/discover?kind=tv_show&country=KR&sort=popular&limit=5")).json() as any;
    expect(body.meta.providers).toEqual(["mydramalist"]);
    const goblin = body.data[0];
    expect(goblin.kind).toBe("tv_show");
    expect(goblin.external_ids.tmdb).toEqual(["67915"]);
    expect(goblin.external_ids.mdl).toEqual(["18452"]);
    expect(goblin.broadcast.country).toBe("KR");
    expect(goblin.technical.episode_count).toBe(16);
    expect(goblin.metrics.score).toBe(8.8);
    expect(goblin.provenance.field_sources["external_ids.tmdb"][0].provider).toBe("wikidata");
    expect(body.meta.has_next).toBe(true);
  });
});
