import { KINDS } from "./schema/entities.ts";
import { DOMAIN_KINDS } from "./schema/kinds.ts";

const err = { type: "object", properties: { error: { type: "object", properties: { code: { type: "string" }, message: { type: "string" }, details: {} } } } };
const meta = {
  type: "object",
  properties: {
    request_id: { type: "string" }, elapsed_ms: { type: "number" }, version: { type: "string" },
    count: { type: "integer" }, partial: { type: "boolean" }, providers: { type: "array", items: { type: "string" } },
    unavailable: { type: "array", items: { type: "object" } },
  },
};
const entity = { $ref: "#/components/schemas/Entity" };
const list = (description: string) => ({
  description,
  content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: entity }, meta }, required: ["data", "meta"] } } },
});

const param = (name: string, description: string, required = false, schema: any = { type: "string" }) => ({ name, in: "query", description, required, schema });

export const OPENAPI = {
  openapi: "3.1.0",
  info: {
    title: "MetaFlux",
    version: "0.1.0",
    description: [
      "One keyless API for entertainment metadata across film, TV, anime, manga, manhwa, comics, webtoons, books, music, K-pop, vtubers, live IPTV, radio, sports and events.",
      "Every provider is free to call and needs no API key. Responses carry field-level provenance, provider ids and raw payloads.",
      "Self-host it, ingest the bulk snapshots, and the same API works offline.",
    ].join("\n\n"),
    license: { name: "MIT" },
  },
  servers: [{ url: "http://127.0.0.1:8787" }, { url: "https://metaflux.example" }],
  tags: [
    { name: "search", description: "Cross-provider discovery" },
    { name: "entities", description: "Lookup and sections" },
    { name: "screen" }, { name: "reading" }, { name: "music" }, { name: "sports" }, { name: "live" }, { name: "people" },
    { name: "system" },
  ],
  paths: {
    "/health": { get: { tags: ["system"], summary: "Health and cache stats", responses: { 200: { description: "ok" } } } },
    "/v1/providers": { get: { tags: ["system"], summary: "Provider capability matrix", responses: { 200: { description: "providers" } }, "x-cli": { hidden: true } } },
    "/v1/search": {
      get: {
        tags: ["search"], summary: "Search every capable provider and merge by canonical ids",
        parameters: [
          param("q", "Free-text query", true), param("kind", `One of ${KINDS.join(", ")}`), param("kinds", "Comma separated kinds or domains"),
          param("limit", "1-100", false, { type: "integer", minimum: 1, maximum: 100 }),
          param("region", "ISO 3166-1 alpha-2"), param("lang", "BCP-47"), param("providers", "Comma separated provider ids"),
          param("debug", "Keep full raw payloads", false, { type: "boolean" }),
        ],
        responses: { 200: list("Ranked, merged entities"), 400: { description: "bad request", content: { "application/json": { schema: err } } } },
      },
    },
    "/v1/trending": { get: { tags: ["search"], summary: "Trending across providers", parameters: [param("kind", "kind or domain"), param("region", "ISO country")], responses: { 200: list("trending") } } },
    "/v1/discover": {
      get: {
        tags: ["search"], summary: "Browse a catalogue",
        parameters: [param("kind", "kind", true), param("genre", "genre"), param("year", "year", false, { type: "integer" }), param("country", "ISO country"), param("sort", "provider sort")],
        responses: { 200: list("discover") },
      },
    },
    "/v1/calendar": {
      get: {
        tags: ["search"], summary: "Airings, matches, concerts, releases",
        parameters: [param("from", "ISO datetime", true), param("to", "ISO datetime", true), param("kinds", "comma separated"), param("region", "ISO country")],
        responses: { 200: list("calendar") },
      },
    },
    "/v1/resolve": {
      get: {
        tags: ["entities"], summary: "Resolve external ids to a canonical entity",
        parameters: [param("ids", "provider:id pairs, comma separated", true)],
        responses: { 200: { description: "entity", content: { "application/json": { schema: { type: "object", properties: { data: entity } } } } }, 404: { description: "not found" } },
      },
    },
    "/v1/batch": {
      post: {
        tags: ["entities"], summary: "Up to 50 lookups per call",
        requestBody: { content: { "application/json": { schema: { type: "object", properties: { requests: { type: "array", items: { type: "object", properties: { kind: { type: "string" }, id: { type: "string" }, force: { type: "boolean" } } } } } } } } },
        responses: { 200: list("results") },
      },
    },
    "/v1/sports/scoreboard": { get: { tags: ["sports"], summary: "Live scoreboard", parameters: [param("league", "e.g. football/nfl, soccer/eng.1, basketball/nba", true)], responses: { 200: list("events") } } },
    "/v1/sports/standings": { get: { tags: ["sports"], summary: "League table", parameters: [param("league", "league id", true), param("season", "season")], responses: { 200: list("standings") } } },
    "/v1/iptv/channels": { get: { tags: ["live"], summary: "Search IPTV channels", parameters: [param("q", "channel name"), param("country", "ISO country")], responses: { 200: list("channels") } } },
    "/v1/iptv/channels/{id}/streams": { get: { tags: ["live"], summary: "Stream URLs for a channel", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: list("streams") } } },
    "/v1/iptv/epg": { get: { tags: ["live"], summary: "XMLTV EPG endpoints", parameters: [param("country", "ISO country")], responses: { 200: list("guides") } } },
    "/v1/music/lyrics": { get: { tags: ["music"], summary: "Synced and plain lyrics", parameters: [param("artist", "artist name", true), param("track", "track title", true)], responses: { 200: { description: "track with lyrics" }, 404: { description: "not found" } } } },
    "/v1/{kind}/{id}": {
      get: {
        tags: ["entities"], summary: "Get one entity",
        parameters: [{ name: "kind", in: "path", required: true, schema: { enum: KINDS } }, { name: "id", in: "path", required: true, schema: { type: "string" }, description: "mf_* or provider:id" }, param("debug", "full raw payloads", false, { type: "boolean" }), param("force", "bypass cache", false, { type: "boolean" })],
        responses: { 200: { description: "entity", content: { "application/json": { schema: { type: "object", properties: { data: entity, meta } } } } }, 404: { description: "not found" } },
      },
    },
    "/v1/{kind}/{id}/{section}": {
      get: {
        tags: ["entities"], summary: "Entity sections",
        parameters: [{ name: "kind", in: "path", required: true, schema: { enum: KINDS } }, { name: "id", in: "path", required: true, schema: { type: "string" } }, { name: "section", in: "path", required: true, schema: { enum: ["related", "credits", "episodes", "chapters", "streams", "people", "availability", "lyrics", "seasons", "tracks"] } }],
        responses: { 200: { description: "section" } },
      },
    },
  },
  components: {
    schemas: {
      Entity: {
        type: "object",
        description: "Superset record. Fields missing from a provider are null/empty; `provenance.field_sources` attributes each populated path.",
        properties: {
          id: { type: "string" }, kind: { enum: KINDS }, domain: { enum: Object.keys(DOMAIN_KINDS) }, name: { type: "string" },
          title: { type: "object", properties: { display: { type: "string" }, romaji: { type: "string" }, english: { type: "string" }, native: { type: "string" }, aliases: { type: "array", items: { type: "string" } }, localized: { type: "object" } } },
          description: { type: "object", description: "tagline/short/long/synopsis/notes/trivia, keyed by language" },
          images: { type: "object", description: "poster/backdrop/banner/logo/fanart/screenshots/cover/profile/dominant_color arrays" },
          external_ids: { type: "object", additionalProperties: { type: "array", items: { type: "string" } } },
          urls: { type: "object" }, dates: { type: "object" }, status: { type: "object" }, classification: { type: "object" },
          metrics: { type: "object" }, credits: { type: "array", items: { type: "object" } }, companies: { type: "object" },
          relations: { type: "array", items: { type: "object" } }, seasons: { type: "array" }, episodes: { type: "array" }, chapters: { type: "array" }, tracks: { type: "array" }, members: { type: "array" },
          availability: { type: "object", description: "streaming/linear/iptv/radio/rental/purchase/free/downloads with region, quality, audio, subtitles, price, DRM" },
          technical: { type: "object" }, broadcast: { type: "object" }, manga: { type: "object" }, literature: { type: "object" },
          music: { type: "object" }, sports: { type: "object" }, live: { type: "object" }, event: { type: "object" }, iptv: { type: "object" },
          person: { type: "object" }, vtuber: { type: "object" }, media: { type: "object" }, links: { type: "array" },
          raw: { type: "object", description: "verbatim provider payloads" },
          provenance: { type: "object", properties: { generated_at: { type: "string" }, field_sources: { type: "object" }, sources: { type: "array" }, partial: { type: "boolean" }, unavailable: { type: "array" } } },
          score: { type: "number" },
        },
      },
    },
  },
};
