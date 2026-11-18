#!/usr/bin/env bun
/**
 * Minimal MCP server over stdio so agents (Claude Desktop, Cursor, opencode)
 * can query MetaFlux without a key. Tools mirror the HTTP API.
 */
import { getEntity, listEntities, searchEntities } from "./core/aggregate.ts";
import { allProviders, loadProviders } from "./providers/index.ts";
import { parseKinds } from "./schema/kinds.ts";
import type { Kind } from "./schema/entities.ts";

loadProviders();

const TOOLS = [
  {
    name: "metaflux_search",
    description: "Search all entertainment metadata providers and merge results. Domains: screen, anime, reading, music, sports, live, people.",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string", description: "query" },
        kind: { type: "string", description: "kind or domain, e.g. anime, movie, music, sports_team" },
        limit: { type: "integer", minimum: 1, maximum: 50 },
        region: { type: "string", description: "ISO country" },
      },
      required: ["q"],
    },
  },
  {
    name: "metaflux_get",
    description: "Get one entity by mf_* id or provider:id (imdb:, anilist:, mangadex:, openlibrary:, espn:, iptv_org:).",
    inputSchema: { type: "object", properties: { kind: { type: "string" }, id: { type: "string" } }, required: ["kind", "id"] },
  },
  {
    name: "metaflux_trending",
    description: "Trending entities for a kind or domain.",
    inputSchema: { type: "object", properties: { kind: { type: "string" }, limit: { type: "integer" } }, required: ["kind"] },
  },
  {
    name: "metaflux_providers",
    description: "List upstream providers, capabilities, auth and licences.",
    inputSchema: { type: "object", properties: {} },
  },
] as const;

async function call(name: string, args: any) {
  switch (name) {
    case "metaflux_search":
      return (await searchEntities(String(args.q), parseKinds(args.kind), { limit: Number(args.limit ?? 10), region: args.region }));
    case "metaflux_get":
      return getEntity(args.kind as Kind, String(args.id), { debug: true });
    case "metaflux_trending":
      return (await listEntities("trending", args.kind as Kind, { kind: args.kind }, { limit: Number(args.limit ?? 10) })).entities;
    case "metaflux_providers":
      return allProviders().map((p) => ({ id: p.id, name: p.name, domains: p.domains, operations: p.operations, auth: p.auth, license: p.license }));
    default:
      throw new Error(`unknown tool ${name}`);
  }
}

function send(msg: unknown) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", async (chunk) => {
  buffer += chunk;
  let idx: number;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let req: any;
    try { req = JSON.parse(line); } catch { continue; }
    try {
      if (req.method === "initialize") {
        send({ jsonrpc: "2.0", id: req.id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "metaflux", version: "0.1.0" } } });
      } else if (req.method === "notifications/initialized") {
        /* no response */
      } else if (req.method === "tools/list") {
        send({ jsonrpc: "2.0", id: req.id, result: { tools: TOOLS } });
      } else if (req.method === "tools/call") {
        const data = await call(req.params?.name, req.params?.arguments ?? {});
        send({ jsonrpc: "2.0", id: req.id, result: { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] } });
      } else if (req.id) {
        send({ jsonrpc: "2.0", id: req.id, error: { code: -32601, message: `unknown method ${req.method}` } });
      }
    } catch (err) {
      send({ jsonrpc: "2.0", id: req.id ?? null, error: { code: -32000, message: err instanceof Error ? err.message : String(err) } });
    }
  }
});
console.error("metaflux mcp ready on stdio");
