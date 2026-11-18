import { afterEach, describe, expect, test } from "bun:test";
import { chapterFeed, findByLinks } from "../src/providers/mangadex.ts";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

describe("manga chapters by MAL id", () => {
  test("a MangaDex title is accepted only when its links name the work", async () => {
    globalThis.fetch = (async () => json({ data: [
      { id: "fan-reupload", attributes: { links: {} } },
      { id: "other-work", attributes: { links: { mal: "999" } } },
      { id: "a1c7c817-4e59-43b7-9365-09675a149a6f", attributes: { links: { mal: "13", al: "30013" } } },
    ] })) as any;
    expect(await findByLinks(["One Piece Chapters Test"], { mal: "13" })).toBe("a1c7c817-4e59-43b7-9365-09675a149a6f");
    expect(await findByLinks(["One Piece Chapters Test"], { mal: "14" })).toBeNull();
  });

  test("feed rows map to chapters with scanlator and date", async () => {
    globalThis.fetch = (async () => json({ total: 1, data: [{ id: "c1", attributes: { chapter: "1", volume: "1", title: "Romance Dawn", translatedLanguage: "en", pages: 53, publishAt: "2025-05-21T01:02:20+00:00" }, relationships: [{ type: "scanlation_group", attributes: { name: "MangaPlus" } }] }] })) as any;
    const rows = await chapterFeed("feed-test-id");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "mangadex:chapter:c1", number: "1", volume: "1", title: "Romance Dawn", scanlation_group: "MangaPlus", pages: 53 });
  });
});
