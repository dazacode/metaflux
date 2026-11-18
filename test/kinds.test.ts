import { describe, expect, test } from "bun:test";
import { parseKinds, kindFamily, DOMAIN_KINDS } from "../src/schema/kinds.ts";

describe("kinds", () => {
  test("expands domains", () => {
    expect(parseKinds("anime")).toContain("anime");
    expect(parseKinds("sports")).toContain("sports_event");
    expect(parseKinds("movie, book")).toEqual(expect.arrayContaining(["movie", "book"]));
    expect(parseKinds("nope")).toEqual([]);
  });
  test("families include related kinds and preserve self", () => {
    expect(kindFamily("anime")).toContain("anime_movie");
    expect(kindFamily("manhwa")).toContain("manhua");
    expect(kindFamily("sports_team")).toContain("sports_team");
  });
  test("every domain kind is a real kind", () => {
    for (const [domain, kinds] of Object.entries(DOMAIN_KINDS)) {
      expect(kinds.length).toBeGreaterThan(0);
      expect(domain.length).toBeGreaterThan(0);
    }
  });
});
