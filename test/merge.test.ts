import { describe, expect, test } from "bun:test";
import { emptyEntity } from "../src/schema/entities.ts";
import { collapse, mergeEntity, recordSource } from "../src/core/merge.ts";
import { titleSimilarity, normalizeTitle } from "../src/core/id.ts";

const source = { provider: "a", fetched_at: new Date().toISOString(), confidence: "verified" as const };

describe("merge", () => {
  test("first non-empty scalar wins and arrays union", () => {
    const base = emptyEntity("anime", "Frieren");
    base.title.display = "Frieren";
    base.classification.genres = ["Adventure"];

    const extra = emptyEntity("anime", "Sousou no Frieren");
    extra.title.romaji = "Sousou no Frieren";
    extra.title.display = "Other";
    extra.classification.genres = ["Fantasy", "Adventure"];
    extra.metrics.score = 90;

    mergeEntity(base, extra, source);
    expect(base.title.display).toBe("Frieren");
    expect(base.title.romaji).toBe("Sousou no Frieren");
    expect(base.classification.genres).toEqual(["Adventure", "Fantasy"]);
    expect(base.metrics.score).toBe(90);
    expect(base.provenance.field_sources["title.romaji"]?.[0].provider).toBe("a");
  });

  test("empty values never overwrite", () => {
    const base = emptyEntity("book", "Dune");
    base.description.long = { en: "A desert planet." };
    const other = emptyEntity("book", "Dune");
    mergeEntity(base, other, source);
    expect(base.description.long.en).toBe("A desert planet.");
  });

  test("collapse joins shared external ids and distinct titles stay separate", () => {
    const a = emptyEntity("movie", "Inception");
    a.external_ids = { imdb: ["tt1375666"] };
    const b = emptyEntity("movie", "Inception");
    b.external_ids = { tmdb: ["27205"] };
    const c = emptyEntity("movie", "Interstellar");
    c.external_ids = { imdb: ["tt0816692"] };
    const out = collapse([a, b, c]);
    expect(out).toHaveLength(2);
    expect(out[0].external_ids.tmdb).toEqual(["27205"]);
  });

  test("recordSource keeps both provider and url", () => {
    const e = emptyEntity("anime", "x");
    recordSource(e, "title.display", { ...source, url: "https://a/1" });
    expect(e.provenance.field_sources["title.display"]).toHaveLength(1);
    recordSource(e, "title.display", { ...source, url: "https://a/1" });
    expect(e.provenance.field_sources["title.display"]).toHaveLength(1);
  });
});

describe("ids", () => {
  test("normalizes diacritics and articles", () => {
    expect(normalizeTitle("The Café of Sōsō")).toBe("cafe of soso");
  });
  test("similarity is bounded", () => {
    expect(titleSimilarity("Frieren", "Frieren: Beyond Journey's End")).toBeGreaterThan(0.2);
    expect(titleSimilarity("Dune", "Dune")).toBe(1);
    expect(titleSimilarity("Dune", "Batman")).toBe(0);
  });
});
