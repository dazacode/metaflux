import { describe, expect, test } from "bun:test";
import { effectiveKind, idScope, idsConflict, parseExternal } from "../src/core/identity.ts";
import { collapse, makeEntity } from "../src/core/merge.ts";
import { entityStore } from "../src/core/store.ts";
import type { Kind } from "../src/schema/entities.ts";

function work(kind: Kind, name: string, ids: Record<string, string[]>) {
  const e = makeEntity(kind, name, "test");
  e.external_ids = ids;
  return e;
}

describe("identity", () => {
  test("parses compound client ids", () => {
    expect(parseExternal("mal:52991")).toEqual({ provider: "mal", id: "52991", kindHint: undefined });
    expect(parseExternal("mal:manga:13")).toEqual({ provider: "mal", id: "13", kindHint: "manga" });
    expect(parseExternal("anilist:manga:30013")?.kindHint).toBe("manga");
    expect(parseExternal("tmdb:tv:1396")).toEqual({ provider: "tmdb", id: "1396", kindHint: "tv_show" });
    expect(parseExternal("tmdb:movie:550")?.kindHint).toBe("movie");
    expect(parseExternal("anilist:staff:95185")?.kindHint).toBe("person");
    expect(parseExternal("tt0903747")).toBeNull();
  });

  test("an id hint moves the request to the right scope", () => {
    expect(effectiveKind("anime", "manga")).toBe("manga");
    expect(effectiveKind("manhwa", "manga")).toBe("manhwa");
    expect(effectiveKind("tv_show", "movie")).toBe("movie");
    expect(idScope("anime_movie")).toBe("anime");
    expect(idScope("manhwa")).toBe("manga");
    expect(idScope("movie")).not.toBe(idScope("tv_show"));
  });

  test("seasons that share coarse ids never collapse", () => {
    // ARM/ani.zip give every Frieren season the same IMDb/TVDB/TMDB ids.
    const s1 = work("anime", "Frieren", { mal: ["52991"], imdb: ["tt22248376"], tvdb: ["424536"], tmdb_season: ["1"] });
    const s2 = work("anime", "Frieren", { mal: ["59978"], imdb: ["tt22248376"], tvdb: ["424536"], tmdb_season: ["1"] });
    expect(idsConflict(s1, s2)).toBe(true);
    expect(collapse([s1, s2])).toHaveLength(2);
    const dup = work("anime", "Sousou no Frieren", { mal: ["52991"], anilist: ["154587"] });
    expect(collapse([s1, dup])).toHaveLength(1);
  });

  test("non-identity keys never merge records", () => {
    const a = work("anime", "A", { anilist: ["1"], tmdb_season: ["1"] });
    const b = work("anime", "B", { anilist: ["2"], tmdb_season: ["1"] });
    expect(collapse([a, b])).toHaveLength(2);
  });

  test("MAL anime 13 and MAL manga 13 are different index entries", () => {
    const anime = work("anime", "Anime Thirteen", { mal: ["13"] });
    const manga = work("manga", "Manga Thirteen", { mal: ["13"] });
    entityStore.put(anime as any);
    entityStore.put(manga as any);
    expect(entityStore.findId("mal", "13", "anime")).toBe(anime.id);
    expect(entityStore.findId("mal", "13", "manga")).toBe(manga.id);
    expect(entityStore.findId("mal", "13", "manhwa")).toBe(manga.id);
  });

  test("list rows can be stored without shadowing the index", () => {
    const detail = work("anime", "Detail", { mal: ["777"] });
    const row = work("anime", "Row", { mal: ["777"] });
    entityStore.put(detail as any);
    entityStore.put(row as any, { index: false });
    expect(entityStore.findId("mal", "777", "anime")).toBe(detail.id);
  });
});
