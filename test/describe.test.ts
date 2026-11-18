import { afterEach, describe, expect, test } from "bun:test";
import { makeEntity } from "../src/core/merge.ts";
import { describeFallback } from "../src/providers/wikipedia.ts";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const EXTRACT = "Reply 1988 is a 2015–2016 South Korean television series starring Lee Hye-ri, Ryu Jun-yeol and Go Kyung-pyo, set in Ssangmun-dong.";

function drama(title = "Reply 1988") {
  const e = makeEntity("tv_show", title, "test");
  e.title.english = title;
  e.broadcast.country = "KR";
  e.dates.start = { year: 2015 };
  return e;
}

describe("wikipedia description fallback (G5)", () => {
  test("fills an empty synopsis with a credited, licensed extract", async () => {
    globalThis.fetch = (async (input: any) => {
      const url = String(input?.url ?? input);
      if (url.startsWith("https://en.wikipedia.org/api/rest_v1/page/summary/Reply_1988")) {
        return json({ type: "standard", title: "Reply 1988", extract: EXTRACT, wikibase_item: "Q19657395", content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Reply_1988" } } });
      }
      if (url.startsWith("https://query.wikidata.org/sparql")) {
        return json({ results: { bindings: [{ inst: { value: "http://www.wikidata.org/entity/Q5398426" }, start: { value: "2015-11-06T00:00:00Z" } }] } });
      }
      return json({}, 404);
    }) as any;
    const e = drama();
    expect(await describeFallback(e)).toBe(true);
    expect(e.description.long.en).toBe(EXTRACT);
    const src = e.provenance.field_sources["description.long"][0];
    expect(src.provider).toBe("wikipedia");
    expect(src.url).toBe("https://en.wikipedia.org/wiki/Reply_1988");
    expect(src.license).toBe("CC BY-SA 4.0");
    expect(e.provenance.field_sources["description.long.en"][0].url).toBe(src.url);
  });

  test("rejects a page about something else", async () => {
    globalThis.fetch = (async (input: any) => {
      const url = String(input?.url ?? input);
      if (url.includes("wikipedia.org/api/rest_v1/page/summary/")) {
        return json({ type: "standard", title: "1988", extract: "1988 was a leap year starting on Friday of the Gregorian calendar, the 1988th year of the Common Era.", wikibase_item: "Q2484" });
      }
      if (url.startsWith("https://query.wikidata.org/sparql")) return json({ results: { bindings: [{ inst: { value: "http://www.wikidata.org/entity/Q577" } }] } });
      return json({}, 404);
    }) as any;
    // A distinct title: the HTTP cache is shared across tests.
    const e = drama("Answer Me 1988");
    expect(await describeFallback(e)).toBe(false);
    expect(e.description.long).toEqual({});
  });

  test("never replaces a provider's own synopsis", async () => {
    let calls = 0;
    globalThis.fetch = (async () => { calls++; return json({}, 404); }) as any;
    const e = drama();
    e.description.long = { en: "Own synopsis." };
    expect(await describeFallback(e)).toBe(false);
    expect(calls).toBe(0);
  });
});
