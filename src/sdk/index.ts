/**
 * Typed MetaFlux client. Works in Bun, Node 18+, Deno and browsers.
 *
 *   import { MetaFlux } from "metaflux/sdk";
 *   const mf = new MetaFlux({ baseUrl: "http://127.0.0.1:8787" });
 *   const results = await mf.search("frieren", { kind: "anime" });
 *   const anime = await mf.get("anime", "anilist:154587");
 */
import type { Entity, Kind } from "../schema/entities.ts";

export interface MetaFluxOptions {
  baseUrl?: string;
  /** Optional bearer token if you put MetaFlux behind your own gateway. */
  token?: string;
  region?: string;
  lang?: string;
  fetch?: typeof fetch;
}

export interface Envelope<T> {
  data: T;
  meta: {
    request_id: string;
    elapsed_ms: number;
    version: string;
    count?: number;
    partial?: boolean;
    providers?: string[];
    unavailable?: { provider: string; error: string }[];
    [key: string]: unknown;
  };
}

export class MetaFluxError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "MetaFluxError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class MetaFlux {
  private base: string;
  private token?: string;
  private region?: string;
  private lang?: string;
  private f: typeof fetch;

  constructor(opts: MetaFluxOptions = {}) {
    this.base = (opts.baseUrl ?? "http://127.0.0.1:8787").replace(/\/$/, "");
    this.token = opts.token;
    this.region = opts.region;
    this.lang = opts.lang;
    this.f = opts.fetch ?? fetch;
  }

  private async req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = { accept: "application/json", ...(init.headers as Record<string, string>) };
    if (this.token) headers.authorization = `Bearer ${this.token}`;
    if (init.body) headers["content-type"] = "application/json";
    const res = await this.f(`${this.base}${path}`, { ...init, headers });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = (body as any)?.error ?? {};
      throw new MetaFluxError(res.status, err.code ?? "http_error", err.message ?? res.statusText, err.details);
    }
    return body as T;
  }

  private q(params: Record<string, unknown>) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === "") continue;
      sp.set(k, Array.isArray(v) ? v.join(",") : String(v));
    }
    if (this.region) sp.set("region", this.region);
    if (this.lang) sp.set("lang", this.lang);
    return sp.toString();
  }

  search(q: string, opts: { kind?: Kind | string; kinds?: string; limit?: number; providers?: string[]; debug?: boolean } = {}) {
    return this.req<Envelope<Entity[]>>(`/v1/search?${this.q({ q, ...opts })}`);
  }

  get(kind: Kind, id: string, opts: { debug?: boolean; force?: boolean } = {}) {
    return this.req<Envelope<Entity>>(`/v1/${kind}/${encodeURIComponent(id)}?${this.q(opts)}`);
  }

  section<T = unknown>(kind: Kind, id: string, section: string) {
    return this.req<Envelope<T>>(`/v1/${kind}/${encodeURIComponent(id)}/${section}`);
  }

  trending(kind: Kind | string, opts: { limit?: number } = {}) {
    return this.req<Envelope<Entity[]>>(`/v1/trending?${this.q({ kind, ...opts })}`);
  }

  discover(kind: Kind, opts: { genre?: string; year?: number; country?: string; limit?: number } = {}) {
    return this.req<Envelope<Entity[]>>(`/v1/discover?${this.q({ kind, ...opts })}`);
  }

  calendar(opts: { from: string; to: string; kinds?: string; region?: string }) {
    return this.req<Envelope<Entity[]>>(`/v1/calendar?${this.q(opts)}`);
  }

  resolve(ids: Record<string, string>) {
    const value = Object.entries(ids).map(([k, v]) => `${k}:${v}`).join(",");
    return this.req<Envelope<Entity>>(`/v1/resolve?${this.q({ ids: value })}`);
  }

  lyrics(artist: string, track: string) {
    return this.req<Envelope<Entity>>(`/v1/music/lyrics?${this.q({ artist, track })}`);
  }

  scoreboard(league: string) {
    return this.req<Envelope<Entity[]>>(`/v1/sports/scoreboard?${this.q({ league })}`);
  }

  iptvChannels(q: string, country?: string) {
    return this.req<Envelope<Entity[]>>(`/v1/iptv/channels?${this.q({ q, country })}`);
  }

  streams(channelId: string) {
    return this.req<Envelope<Entity[]>>(`/v1/iptv/channels/${encodeURIComponent(channelId)}/streams`);
  }

  providers() {
    return this.req<{ data: unknown[]; meta: unknown }>("/v1/providers");
  }

  batch(requests: { kind: Kind; id: string; force?: boolean }[]) {
    return this.req<Envelope<(Entity | { error: string })[]>>("/v1/batch", { method: "POST", body: JSON.stringify({ requests }) });
  }

  health() {
    return this.req<any>("/health");
  }
}

export default MetaFlux;
