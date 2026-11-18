import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { z } from "zod";
import { config } from "./core/config.ts";
import { MetaFluxError, badRequest, errorResponse, json, notFound, unsupported } from "./core/errors.ts";
import { getEntity, getSection, listEntities, resolveIds, searchEntities, type QueryOptions } from "./core/aggregate.ts";
import { parseExternal } from "./core/identity.ts";
import { parseExactKinds, parseKinds, DOMAIN_KINDS } from "./schema/kinds.ts";
import { KINDS, type Kind } from "./schema/entities.ts";
import { allProviders, loadProviders, providerPublic } from "./providers/index.ts";
import { cache, entityStore, providerState } from "./core/store.ts";
import { OPENAPI } from "./openapi.ts";
import { DOCS_HTML } from "./docs.ts";

loadProviders();

const SearchQ = z.object({
  q: z.string().min(1).max(200),
  kind: z.string().optional(),
  kinds: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(config.maxSearchLimit).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  region: z.string().length(2).optional(),
  lang: z.string().min(2).max(12).optional(),
  providers: z.string().optional(),
  debug: z.coerce.boolean().optional(),
  force: z.coerce.boolean().optional(),
});

function opts(c: any, extra: Partial<QueryOptions> = {}): QueryOptions {
  const p = c.req.query();
  return {
    region: p.region?.toLowerCase(),
    lang: p.lang?.toLowerCase(),
    limit: p.limit ? Number(p.limit) : p.per_page ? Number(p.per_page) : undefined,
    page: p.page ? Number(p.page) : undefined,
    providers: p.providers ? p.providers.split(",") : undefined,
    provider: p.provider,
    debug: p.debug === "true" || p.debug === "1",
    force: p.force === "true" || p.force === "1",
    ...extra,
  };
}

function elapsed(start: number) { return Math.round((performance.now() - start) * 10) / 10; }

function slim(value: unknown, debug: boolean): unknown {
  if (debug || value === null || typeof value !== "object") return value;
  const copy = structuredClone(value);
  const walk = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (node.raw && typeof node.raw === "object") {
      for (const [k, raw] of Object.entries(node.raw)) {
        const size = JSON.stringify(raw).length;
        if (size > 600) node.raw[k] = { truncated: true, bytes: size, hint: "use ?debug=true for full provider payloads" };
      }
    }
    for (const v of Object.values(node)) if (v && typeof v === "object") walk(v);
  };
  walk(copy);
  return copy;
}

function envelope(data: unknown, meta: Record<string, unknown>, start: number, status = 200) {
  const debug = meta.debug === true;
  return json({ data: slim(data, debug), meta: { request_id: crypto.randomUUID(), elapsed_ms: elapsed(start), version: config.version, ...meta } }, status, {
    "cache-control": "public, max-age=30",
  });
}

export const app = new Hono();
app.use("*", async (c, next) => { await next(); });

app.use("*", cors({ origin: config.cors, allowMethods: ["GET", "POST", "OPTIONS"], allowHeaders: ["content-type", "authorization"], maxAge: 86400 }));
if (config.logLevel !== "silent") app.use("*", logger());
app.onError((err) => errorResponse(err));

app.get("/", (c) => c.html(DOCS_HTML));
app.get("/v1", (c) => c.json({
  name: "MetaFlux",
  version: config.version,
  tagline: "All entertainment metadata in one place. No keys required.",
  domains: Object.keys(DOMAIN_KINDS),
  kinds: KINDS,
  endpoints: ["/v1/search", "/v1/discover", "/v1/trending", "/v1/calendar", "/v1/genres", "/v1/resolve", "/v1/{kind}/{id}", "/v1/providers", "/v1/sports/scoreboard", "/v1/iptv/channels", "/v1/music/lyrics"],
  docs: "/docs",
  openapi: "/openapi.json",
}));

app.get("/health", (c) => c.json({
  status: "ok",
  version: config.version,
  network: config.enableNetwork,
  providers: allProviders().length,
  cache: cache.stats(),
  entities: entityStore.count(),
  breakers_open: providerState.all().filter((p: any) => p.state === "open").length,
  uptime_s: Math.round(process.uptime()),
}));

app.get("/v1/health", (c) => c.redirect("/health"));
app.get("/v1/providers", (c) => c.json({ data: providerPublic(), meta: { count: allProviders().length } }));
app.get("/v1/kinds", (c) => c.json({ data: KINDS, meta: { domains: DOMAIN_KINDS } }));
app.get("/openapi.json", (c) => c.json(OPENAPI));
app.get("/docs", (c) => c.html(DOCS_HTML));

app.get("/v1/search", async (c) => {
  const start = performance.now();
  const parsed = SearchQ.safeParse(c.req.query());
  if (!parsed.success) throw badRequest("invalid query", parsed.error.flatten());
  const v = parsed.data;
  const kinds = parseKinds(v.kind ?? v.kinds);
  const result = await searchEntities(v.q, kinds, opts(c));
  return envelope(result.entities, {
    count: result.entities.length, providers: result.providers_hit,
    partial: result.partial, unavailable: result.unavailable, kinds: kinds.map((k) => k), debug: opts(c).debug === true,
  }, start);
});

app.get("/v1/discover", async (c) => {
  const start = performance.now();
  const kind = (c.req.query("kind") ?? "movie") as Kind;
  if (!KINDS.includes(kind)) throw badRequest(`unknown kind ${kind}`);
  const q = c.req.query();
  const season = q.season?.toLowerCase();
  if (season && !["winter", "spring", "summer", "fall"].includes(season)) throw badRequest("season must be winter|spring|summer|fall");
  const result = await listEntities("discover", kind, {
    kind, genre: q.genre, genres: q.genres ? q.genres.split(",").map((g) => g.trim()).filter(Boolean) : undefined,
    year: q.year ? Number(q.year) : undefined, season: season as any, format: q.format, status: q.status,
    country: q.country, sort: q.sort, query: q.q, page: q.page ? Number(q.page) : undefined,
  }, opts(c));
  return envelope(result.entities, {
    count: result.entities.length, page: Number(q.page ?? 1), total: result.total ?? null, has_next: result.has_next ?? null,
    providers: result.providers_hit, partial: result.partial, unavailable: result.unavailable,
  }, start);
});

app.get("/v1/trending", async (c) => {
  const start = performance.now();
  const kinds = parseExactKinds(c.req.query("kind") ?? c.req.query("kinds") ?? "movie");
  const results = await Promise.all(kinds.slice(0, 4).map((k) => listEntities("trending", k, { kind: k }, opts(c))));
  // One kind keeps the upstream's trending order; several kinds interleave round-robin.
  const lists = results.map((r) => r.entities);
  const rows: any[] = [];
  for (let i = 0; rows.length < Number(c.req.query("limit") ?? config.searchLimit) && lists.some((l) => i < l.length); i++) {
    for (const l of lists) if (l[i]) rows.push(l[i]);
  }
  const unavailable = results.flatMap((r) => r.unavailable);
  return envelope(rows, { count: rows.length, page: Number(c.req.query("page") ?? 1), has_next: results.some((r) => r.has_next), providers: [...new Set(results.flatMap((r) => r.providers_hit))], partial: unavailable.length > 0, unavailable }, start);
});

app.get("/v1/calendar", async (c) => {
  const start = performance.now();
  const from = c.req.query("from") ?? new Date().toISOString();
  const to = c.req.query("to") ?? new Date(Date.now() + 7 * 86_400_000).toISOString();
  const kinds = parseExactKinds(c.req.query("kinds") ?? c.req.query("kind") ?? "anime,tv_show,sports_event,concert");
  if (!Number.isFinite(Date.parse(from)) || !Number.isFinite(Date.parse(to))) throw badRequest("from/to must be ISO dates");
  if (Date.parse(to) - Date.parse(from) > 31 * 86_400_000) throw badRequest("calendar window is at most 31 days");
  const limit = Math.min(Number(c.req.query("limit") ?? 200), 1000);
  const results = await Promise.all(kinds.slice(0, 4).map((k) => listEntities("schedule", k, { kind: k, from, to, region: c.req.query("region"), limit }, opts(c))));
  const at = (e: any) => e.broadcast?.next_episode?.airing_at ?? e.dates.airing?.date ?? e.dates.start?.date ?? "";
  const rows = results.flatMap((r) => r.entities).sort((a, b) => at(a).localeCompare(at(b))).slice(0, limit);
  const unavailable = results.flatMap((r) => r.unavailable);
  return envelope(rows, { count: rows.length, from, to, providers: [...new Set(results.flatMap((r) => r.providers_hit))], partial: unavailable.length > 0, unavailable }, start);
});

app.get("/v1/genres", async (c) => {
  const start = performance.now();
  const kind = (c.req.query("kind") ?? "anime") as Kind;
  if (!KINDS.includes(kind)) throw badRequest(`unknown kind ${kind}`);
  const o = opts(c);
  const ctxv = { region: o.region ?? "us", lang: o.lang ?? "en", now: new Date(), limit: 100 };
  const providers = allProviders().filter((p) => p.genres && p.kinds.includes(kind)).sort((a, b) => a.priority - b.priority);
  for (const p of providers) {
    try {
      const genres = await p.genres!(ctxv, kind);
      if (genres.length) return envelope(genres, { kind, count: genres.length, providers: [p.id] }, start);
    } catch { /* next provider */ }
  }
  return envelope([], { kind, count: 0, providers: [] }, start);
});

app.get("/v1/resolve", async (c) => {
  const start = performance.now();
  const raw = c.req.query("ids");
  if (!raw) throw badRequest("ids=imdb:tt...,tmdb:123");
  const refs = raw.split(",").map((s) => parseExternal(s.trim())).filter(Boolean) as NonNullable<ReturnType<typeof parseExternal>>[];
  if (!refs.length) throw badRequest("ids must be provider:id pairs");
  const kindParam = c.req.query("kind") as Kind | undefined;
  const kind = refs[0].kindHint ?? (kindParam && KINDS.includes(kindParam) ? kindParam : undefined);
  const ids = Object.fromEntries(refs.map((r) => [r.provider, r.id]));
  // With a kind, resolution is a scoped lookup; without, ask the resolvers which kind it is.
  const e = kind ? await getEntity(kind, raw.split(",")[0].trim(), opts(c)) : await resolveIds(ids, opts(c));
  return envelope(e, { resolved_from: ids, providers: e.provenance.sources.map((s) => s.provider) }, start);
});

app.get("/v1/sports/scoreboard", async (c) => {
  const start = performance.now();
  const league = c.req.query("league");
  if (!league) throw badRequest("league=football/nfl (see /v1/providers espn)");
  const { ESPN_LEAGUES } = await import("./providers/espn.ts");
  const meta = (ESPN_LEAGUES as any)[league];
  if (!meta) throw badRequest(`unknown league ${league}`, { leagues: Object.keys(ESPN_LEAGUES) });
  const provider = allProviders().find((p) => p.id === "espn")!;
  const { mapEvent } = await import("./providers/espn.ts");
  const { BROWSER_UA } = await import("./providers/_util.ts");
  const res: any = await (await fetch(`https://site.api.espn.com/apis/site/v2/sports/${league}/scoreboard`, { headers: { "user-agent": BROWSER_UA, accept: "application/json" } })).json().catch(() => null);
  const events = (res?.events ?? []).map((ev: any) => mapEvent(ev, league));
  return envelope(events, { league, sport: meta.sport, count: events.length, providers: ["espn"] }, start);
});

app.get("/v1/sports/standings", async (c) => {
  const start = performance.now();
  const league = c.req.query("league");
  if (!league) throw badRequest("league is required");
  const result = await listEntities("standings", "sports_team", { league, season: c.req.query("season") }, opts(c));
  return envelope(result.entities, { league, count: result.entities.length, providers: result.providers_hit, partial: result.partial }, start);
});

app.get("/v1/iptv/channels", async (c) => {
  const start = performance.now();
  const q = c.req.query("q") ?? c.req.query("country") ?? "news";
  const provider = allProviders().find((p) => p.id === "iptv-org")!;
  const rows = await provider.search!({ region: "us", lang: "en", now: new Date(), limit: Number(c.req.query("limit") ?? 20) }, q);
  const result = { entities: rows, providers_hit: ["iptv-org"], partial: false };
  return envelope(result.entities, { count: result.entities.length, providers: result.providers_hit }, start);
});

app.get("/v1/iptv/channels/:id/streams", async (c) => {
  const start = performance.now();
  const provider = allProviders().find((p) => p.id === "iptv-org")!;
  const id = c.req.param("id");
  let rows = await provider.streams!({ region: "us", lang: "en", now: new Date(), limit: 50 }, id).catch(() => []);
  if (!rows.length) {
    const doc = entityStore.get(entityStore.findId("iptv_org", id) ?? "");
    if (doc?.iptv?.streams?.length) {
      rows = doc.iptv.streams.map((s: any) => ({ ...doc, id: `mf_iptv_stream_${doc.id}`, kind: "iptv_stream", availability: { iptv: [s] } }));
    }
  }
  return envelope(rows, { count: rows.length, channel: id }, start);
});

app.get("/v1/iptv/epg", async (c) => {
  const start = performance.now();
  const provider = allProviders().find((p) => p.id === "iptv-org")!;
  const rows = await provider.epg!({ region: "us", lang: "en", now: new Date(), limit: 100 }, { country: c.req.query("country") ?? "" });
  return envelope(rows, { count: rows.length }, start);
});

app.get("/v1/music/lyrics", async (c) => {
  const start = performance.now();
  const artist = c.req.query("artist");
  const track = c.req.query("track");
  if (!artist || !track) throw badRequest("artist and track are required");
  const provider = allProviders().find((p) => p.id === "lrclib");
  const row = await provider?.lyrics!({ region: "us", lang: "en", now: new Date(), limit: 1 }, artist, track);
  if (!row) throw notFound("lyrics not found");
  return envelope(row, { providers: ["lrclib"] }, start);
});

app.post("/v1/batch", async (c) => {
  const start = performance.now();
  const body = await c.req.json().catch(() => null);
  if (!body?.requests?.length) throw badRequest("body {requests:[{kind,id}]}");
  if (body.requests.length > 50) throw badRequest("max 50 requests per batch");
  const rows = await Promise.allSettled(body.requests.map((r: any) => getEntity(r.kind, r.id, opts(c, { force: r.force }))));
  return envelope(rows.map((r) => r.status === "fulfilled" ? r.value : { error: r.reason instanceof Error ? r.reason.message : String(r.reason) }), { count: rows.length }, start);
});

const SECTIONS = new Set(["related", "credits", "episodes", "chapters", "streams", "people", "availability", "lyrics", "seasons", "tracks"]);

app.get("/v1/:kind/:id", async (c) => {
  const start = performance.now();
  const kind = c.req.param("kind") as Kind;
  if (!KINDS.includes(kind)) throw notFound(`unknown kind ${kind}`);
  const e = await getEntity(kind, c.req.param("id"), opts(c));
  return envelope(e, { kind, providers: e.provenance.sources.map((s) => s.provider), partial: e.provenance.partial, unavailable: e.provenance.unavailable, debug: opts(c).debug === true }, start);
});

app.get("/v1/:kind/:id/:section", async (c) => {
  const start = performance.now();
  const kind = c.req.param("kind") as Kind;
  const section = c.req.param("section");
  if (!KINDS.includes(kind)) throw notFound(`unknown kind ${kind}`);
  if (!SECTIONS.has(section)) throw notFound(`unknown section ${section}`);
  const result = await getSection(kind, c.req.param("id"), section, opts(c));
  return envelope(result.rows, { kind, section, count: result.rows.length, providers: result.providers, partial: result.unavailable.length > 0, unavailable: result.unavailable }, start);
});

app.notFound((c) => json({ error: { code: "not_found", message: `no route ${c.req.method} ${c.req.path}`, docs: "/docs" } }, 404));

export default app;
void unsupported; void MetaFluxError;
