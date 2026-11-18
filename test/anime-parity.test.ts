import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * Offline parity for the Yorozo client's anime detail page: a mal: lookup
 * merges AniList (identity, schedule, credits), ani.zip (episode titles,
 * stills, logos, localized titles) and Jikan (filler/recap flags).
 * ani.zip payload is recorded evidence; the AniList and Jikan payloads are
 * trimmed to the fields the adapters read.
 */
const ANIZIP = readFileSync("docs/research/evidence/anizip_mappings.json", "utf8");
const realFetch = globalThis.fetch;
const seen: string[] = [];

const media = {
  id: 154587, idMal: 52991, type: "ANIME", format: "TV", status: "FINISHED", isAdult: false, countryOfOrigin: "JP",
  title: { romaji: "Sousou no Frieren", english: "Frieren: Beyond Journey's End", native: "葬送のフリーレン" }, synonyms: [],
  description: "The adventure is over but life goes on.", startDate: { year: 2023, month: 9, day: 29 }, endDate: { year: 2024, month: 3, day: 22 },
  season: "FALL", seasonYear: 2023, episodes: 28, duration: 24, chapters: null, volumes: null,
  coverImage: { extraLarge: "https://img/xl.jpg" }, bannerImage: "https://img/banner.jpg", genres: ["Adventure"], tags: [],
  averageScore: 90, popularity: 500000, siteUrl: "https://anilist.co/anime/154587",
  nextAiringEpisode: null, airingSchedule: { nodes: [{ id: 1, airingAt: 1695996000, episode: 1 }, { id: 2, airingAt: 1695996000, episode: 2 }] },
  studios: { edges: [{ isMain: true, node: { id: 11, name: "MADHOUSE" } }, { isMain: false, node: { id: 99, name: "Committee" } }] },
  characters: { edges: [{ role: "MAIN", node: { id: 176754, name: { full: "Frieren", native: "フリーレン" }, image: { large: "https://c.jpg" } },
    voiceActors: [{ id: 95185, name: { full: "Atsumi Tanezaki", native: "種﨑敦美" }, image: { large: "https://va.jpg" }, languageV2: "Japanese" },
      { id: 1, name: { full: "Mallorie Rodak" }, image: { large: "https://va2.jpg" }, languageV2: "English" }] }] },
  staff: { edges: [{ role: "Director", node: { id: 7, name: { full: "Keiichirou Saitou", native: "斎藤圭一郎" }, image: { large: "https://s.jpg" }, primaryOccupations: ["Director"] } }] },
};

const jikanEpisodes = {
  pagination: { has_next_page: false },
  data: [
    { mal_id: 1, title: "The Journey's End", title_romanji: "Bouken no Owari", aired: "2023-09-29T00:00:00+00:00", filler: false, recap: false },
    { mal_id: 2, title: "It Didn't Have to Be Magic...", aired: "2023-09-29T00:00:00+00:00", filler: false, recap: true },
  ],
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeAll(() => {
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input?.url ?? input);
    seen.push(url);
    if (url.startsWith("https://api.ani.zip/mappings?mal_id=52991")) return new Response(ANIZIP, { status: 200 });
    if (url.includes("graphql.anilist.co")) {
      const body = JSON.parse(String(init?.body ?? "{}"));
      if (/Media\(idMal:/.test(body.query) && body.variables.id === 52991) return json({ data: { Media: media } });
      return json({ data: { Media: null } });
    }
    if (url.includes("arm.haglund.dev")) return json({ anilist: 154587, myanimelist: 52991, kitsu: 46474, thetvdb: 424536, imdb: "tt22248376" });
    if (url.startsWith("https://api.jikan.moe/v4/anime/52991/episodes")) return json(jikanEpisodes);
    return json({ error: "offline" }, 404);
  }) as any;
});
afterAll(() => { globalThis.fetch = realFetch; });

describe("anime detail parity", () => {
  test("mal: lookup merges ids, art, seasons and episode catalogue", async () => {
    const { app } = await import("../src/app.ts");
    const res = await app.request("/v1/anime/mal:52991");
    expect(res.status).toBe(200);
    const e = (await res.json() as any).data;
    expect(e.external_ids.mal).toEqual(["52991"]);
    expect(e.external_ids.anilist).toEqual(["154587"]);
    expect(e.external_ids.anidb[0]).toBe("17617");
    expect(e.format).toBe("TV");
    expect(e.season).toEqual({ name: "fall", year: 2023 });
    expect(e.dates.start.date).toBe("2023-09-29");
    expect(e.technical.episode_count).toBe(28);
    expect(e.companies.studios.map((s: any) => s.name)).toEqual(["MADHOUSE"]);
    expect(e.images.logo[0]).toContain("clearlogo");
    expect(e.images.backdrop[0]).toContain("backgrounds");
    expect(e.title.localized.ru).toBeTruthy();
    // 28 regular episodes and 31 specials, one row each although AniList and ani.zip both listed 1 and 2.
    expect(e.episodes.filter((x: any) => x.kind !== "special")).toHaveLength(28);
    const ep1 = e.episodes[0];
    expect(ep1.id).toBe("mal:52991:ep:1");
    expect(ep1.title).toBe("The Journey`s End");
    expect(ep1.image).toContain("screencap");
    expect(ep1.runtime).toBe(26);
    expect(ep1.absolute_number).toBe(1);
    expect(ep1.description.en.length).toBeGreaterThan(20);
    expect(e.provenance.field_sources["images.logo"][0].provider).toBe("anizip");
  });

  test("credits carry voice actors as rows and nested voices", async () => {
    const { app } = await import("../src/app.ts");
    const rows = (await (await app.request("/v1/anime/mal:52991/credits")).json() as any).data;
    const frieren = rows.find((r: any) => r.person.name === "Frieren");
    expect(frieren.role).toBe("MAIN");
    expect(frieren.person.native_name).toBe("フリーレン");
    expect(frieren.voices.map((v: any) => v.language)).toEqual(["Japanese", "English"]);
    const va = rows.find((r: any) => r.voice === true && r.language === "Japanese");
    expect(va.person.external_ids.anilist).toEqual(["95185"]);
    expect(va.character.id).toBe("anilist:character:176754");
    const director = rows.find((r: any) => r.role === "Director");
    expect(director.person.occupations).toEqual(["Director"]);
  });

  test("episodes section adds Jikan filler/recap flags", async () => {
    const { app } = await import("../src/app.ts");
    const body = await (await app.request("/v1/anime/mal:52991/episodes")).json() as any;
    expect(body.data.find((x: any) => x.number === 2 && x.kind !== "special").is_recap).toBe(true);
    expect(body.meta.providers).toContain("jikan");
  });
});
