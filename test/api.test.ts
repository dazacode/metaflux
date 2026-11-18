import { afterEach, beforeEach, describe, expect, test } from "bun:test";

const realFetch = globalThis.fetch;
let calls = 0;

function anilistMedia(id: number, title: string) {
  return {
    id, idMal: 1, type: "ANIME", format: "TV", status: "RELEASING", isAdult: false,
    countryOfOrigin: "JP", source: "MANGA", hashtag: "#frieren",
    title: { romaji: title, english: "Frieren: Beyond Journey's End", native: "葬送のフリーレン" },
    synonyms: ["Sousou no Frieren"], description: "<b>A mage walks</b>", startDate: { year: 2023, month: 9, day: 29 },
    episodes: 28, duration: 24, coverImage: { extraLarge: "https://img/xl.jpg", large: "https://img/l.jpg", color: "#112233" },
    bannerImage: "https://img/banner.jpg", genres: ["Adventure", "Drama"], tags: [{ id: 1, name: "Magic", category: "Theme", rank: 90 }],
    averageScore: 91, meanScore: 90, popularity: 300000, favourites: 40000, trending: 12,
    rankings: [{ rank: 1, type: "RANKED", allTime: true }], siteUrl: "https://anilist.co/anime/1",
    externalLinks: [{ id: 1, url: "https://crunchyroll.com/x", site: "Crunchyroll", type: "STREAMING", language: "en" }],
    streamingEpisodes: [{ title: "Episode 1", thumbnail: "https://t/1.jpg", url: "https://cr/1", site: "Crunchyroll" }],
    nextAiringEpisode: { airingAt: 1_700_000_000, timeUntilAiring: 100, episode: 2 },
    airingSchedule: { nodes: [{ id: 1, airingAt: 1_700_000_000, timeUntilAiring: 100, episode: 1 }] },
    relations: { edges: [{ id: 2, relationType: "SEQUEL" }], nodes: [{ id: 2, type: "ANIME", format: "TV", title: { romaji: "Frieren 2" }, status: "RELEASING" }] },
    characters: { edges: [{ id: 1, role: "MAIN", node: { id: 5, name: { full: "Frieren" }, image: { large: "https://c/1.jpg" }, favourites: 9 } }] },
    staff: { edges: [{ id: 2, role: "Director", node: { id: 6, name: { full: "Keiichiro Saito" }, image: { large: "https://s/1.jpg" } } }] },
    studios: { edges: [{ id: 3, isMain: true, node: { id: 3, name: "Madhouse", siteUrl: "https://madhouse.co.jp" } }] },
    stats: { scoreDistribution: [{ score: 100, amount: 5 }], statusDistribution: [{ status: "CURRENT", amount: 10 }] },
    reviews: { nodes: [] }, recommendations: { nodes: [] }, updatedAt: 1,
  };
}

beforeEach(() => {
  calls = 0;
  globalThis.fetch = (async (input: any, init?: any) => {
    calls++;
    const url = String(input?.url ?? input);
    if (url.includes("graphql.anilist.co")) {
      const body = JSON.parse(String(init?.body ?? input.init?.body ?? input.body ?? "{}"));
      const isManga = body.variables?.type === "MANGA";
      const media = isManga ? [] : [anilistMedia(1, "Sousou no Frieren")];
      if (/Media\((id|idMal):/.test(body.query ?? "")) {
        return new Response(JSON.stringify({ data: { Media: isManga ? null : media[0] } }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ data: { Page: { media, airingSchedules: [] } } }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("arm.haglund.dev")) {
      return new Response(JSON.stringify({ anilist: 1, myanimelist: 2, imdb: "tt22248376" }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ errors: [{ message: "offline" }] }), { status: 404, headers: { "content-type": "application/json" } });
  }) as any;
});

afterEach(() => { globalThis.fetch = realFetch; });

describe("HTTP API", () => {
  test("health and provider matrix", async () => {
    const { app } = await import("../src/app.ts");
    const health = await app.request("/health");
    expect(health.status).toBe(200);
    const body = await health.json() as any;
    expect(body.status).toBe("ok");
    expect(body.providers).toBeGreaterThan(20);
    const providers = await app.request("/v1/providers");
    expect(providers.status).toBe(200);
    const list = (await providers.json() as any).data;
    expect(list.some((p: any) => p.id === "anilist" && p.auth === "none")).toBe(true);
    expect(list.some((p: any) => p.id === "tmdb" && p.requires_key === true)).toBe(true);
  });

  test("search returns a dense, attributed entity", async () => {
    const { app } = await import("../src/app.ts");
    const res = await app.request("/v1/search?q=frieren&kind=anime&limit=3");
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.length).toBeGreaterThan(0);
    const e = body.data[0];
    expect(e.kind).toBe("anime");
    expect(e.title.romaji).toBe("Sousou no Frieren");
    expect(e.description.long.en).toBe("A mage walks");
    expect(e.images.poster.length).toBeGreaterThan(0);
    expect(e.classification.genres).toContain("Adventure");
    expect(e.episodes.length).toBeGreaterThan(0);
    expect(e.companies.studios[0].name).toBe("Madhouse");
    expect(e.credits.some((c: any) => c.person.name === "Frieren")).toBe(true);
    expect(e.provenance.field_sources["title.romaji"][0].provider).toBe("anilist");
    expect(body.meta.providers).toContain("anilist");
  });

  test("get by provider id merges and hydrates", async () => {
    const { app } = await import("../src/app.ts");
    const res = await app.request("/v1/anime/anilist:1");
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.name).toContain("Frieren");
    expect(body.data.provenance.sources.some((s: any) => s.provider === "anilist")).toBe(true);
  });

  test("resolve returns an id map", async () => {
    const { app } = await import("../src/app.ts");
    const res = await app.request("/v1/resolve?ids=anilist:1");
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.external_ids.imdb).toContain("tt22248376");
  });

  test("bad requests and unknown routes", async () => {
    const { app } = await import("../src/app.ts");
    expect((await app.request("/v1/search")).status).toBe(400);
    expect((await app.request("/v1/search?q=x&kind=bogus")).status).toBe(200);
    expect((await app.request("/nope")).status).toBe(404);
    expect((await app.request("/v1/anime/not-an-id")).status).toBe(400);
  });

  test("raw payloads are trimmed unless debug", async () => {
    const { app } = await import("../src/app.ts");
    const big = await app.request("/v1/search?q=frieren&kind=anime");
    const small = await app.request("/v1/search?q=frieren&kind=anime&debug=true");
    expect((await big.text()).length).toBeLessThan((await small.text()).length);
  });
});
