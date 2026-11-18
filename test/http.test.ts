import { afterEach, describe, expect, test } from "bun:test";
import { cache } from "../src/core/store.ts";
import { fetchJson } from "../src/core/http.ts";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

describe("http layer", () => {
  test("caches a successful GET and serves it from cache", async () => {
    let n = 0;
    globalThis.fetch = (async () => {
      n++;
      return new Response(JSON.stringify({ n }), { status: 200, headers: { "content-type": "application/json" } });
    }) as any;
    const url = `https://cache.test/${crypto.randomUUID()}`;
    const first = await fetchJson(url, { provider: "test", ttlMs: 60_000 });
    const second = await fetchJson(url, { provider: "test", ttlMs: 60_000 });
    expect(first.fromCache).toBe(false);
    expect(second.fromCache).toBe(true);
    expect(n).toBe(1);
  });

  test("single-flight collapses concurrent misses", async () => {
    let n = 0;
    globalThis.fetch = (async () => {
      n++;
      await Bun.sleep(40);
      return new Response(JSON.stringify({ ok: 1 }), { status: 200 });
    }) as any;
    const url = `https://flight.test/${crypto.randomUUID()}`;
    const out = await Promise.all(Array.from({ length: 6 }, () => fetchJson(url, { provider: "test" })));
    expect(n).toBe(1);
    expect(out.every((r) => r.data.ok === 1)).toBe(true);
  });

  test("retries 500 then succeeds", async () => {
    let n = 0;
    globalThis.fetch = (async () => {
      n++;
      return n === 1
        ? new Response("boom", { status: 500 })
        : new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as any;
    const res = await fetchJson(`https://retry.test/${crypto.randomUUID()}`, { provider: "test", retries: 2 });
    expect(res.data.ok).toBe(true);
    expect(n).toBe(2);
  });

  test("stale copy survives a provider outage", async () => {
    const url = `https://stale.test/${crypto.randomUUID()}`;
    let n = 0;
    globalThis.fetch = (async () => {
      n++;
      if (n === 1) return new Response(JSON.stringify({ v: 1 }), { status: 200 });
      return new Response("down", { status: 503 });
    }) as any;
    await fetchJson(url, { provider: "test", ttlMs: 1, staleMs: 60_000, retries: 0 });
    await Bun.sleep(5);
    const res = await fetchJson(url, { provider: "test", ttlMs: 1, staleMs: 60_000, retries: 0, force: true });
    expect(res.stale).toBe(true);
    expect(res.data.v).toBe(1);
  });

  test("cache purge works", () => {
    expect(() => cache.purge(false)).not.toThrow();
  });
});
