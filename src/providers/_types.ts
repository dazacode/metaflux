import type { Entity, Kind } from "../schema/entities.ts";

export type Operation =
  | "search" | "get" | "trending" | "discover" | "schedule" | "episodes"
  | "chapters" | "streams" | "people" | "availability" | "related" | "live"
  | "standings" | "events" | "lyrics" | "resolve" | "calendar" | "epg" | "genres";

export interface DiscoverParams {
  kind: Kind;
  /** One genre (legacy) or several, AND-ed. */
  genre?: string;
  genres?: string[];
  year?: number;
  season?: "winter" | "spring" | "summer" | "fall";
  /** TV, TV_SHORT, MOVIE, SPECIAL, OVA, ONA, MUSIC, MANGA, NOVEL, ONE_SHOT. */
  format?: string;
  /** releasing, finished, upcoming, cancelled, hiatus. */
  status?: string;
  /** ISO-3166 alpha-2, comma list allowed. */
  country?: string;
  /** popular, trending, score, newest, title, episodes. */
  sort?: string;
  query?: string;
  page?: number;
}

/** A list result may carry the upstream total for pagination. */
export type ListResult = Entity[] & { total?: number | null; hasNext?: boolean };

export interface ProviderContext {
  region: string;
  lang: string;
  now: Date;
  limit: number;
  /** 1-based page for list operations. */
  page?: number;
  /** Kinds the caller asked for, so an adapter can skip half its fan-out. */
  kinds?: Kind[];
}

export interface ProviderMeta {
  id: string;
  name: string;
  domains: string[];
  kinds: Kind[];
  operations: Operation[];
  priority: number;
  auth: "none" | "none-header" | "optional-key";
  base: string;
  license: string;
  freshness: string;
  notes?: string;
  homepage?: string;
  /** Provider needs an env key when not free. */
  keyEnv?: string;
  /**
   * External-id namespaces this provider can look up (`mal`, `imdb`, ...).
   * When declared, `get` is only called if the request (or the resolver) has
   * an id in one of them, and `ref.id` is that id. Undeclared providers keep
   * the legacy behaviour for namespaces no declared provider owns.
   */
  namespaces?: string[];
  /** Id scopes (see core/identity.ts) the declared namespaces apply to. */
  scopes?: string[];
  /** Per-host request budget for this provider's upstream(s). */
  limits?: Record<string, HostLimit>;
}

export interface HostLimit {
  /** Requests allowed per `windowMs`. */
  rate: number;
  windowMs: number;
  /** Bucket capacity; defaults to `rate`. */
  burst?: number;
  /** Concurrent requests in flight. */
  concurrency?: number;
}

export interface Provider extends ProviderMeta {
  search?(ctx: ProviderContext, query: string): Promise<Entity[]>;
  searchTeams?(ctx: ProviderContext, query: string): Promise<Entity[]>;
  get?(ctx: ProviderContext, ref: { kind?: Kind; id: string; namespace?: string; externalIds?: Record<string, string> }): Promise<Entity | null>;
  trending?(ctx: ProviderContext, kind: Kind): Promise<Entity[]>;
  discover?(ctx: ProviderContext, params: DiscoverParams): Promise<Entity[]>;
  genres?(ctx: ProviderContext, kind: Kind): Promise<string[]>;
  schedule?(ctx: ProviderContext, params: { kind: Kind; from: string; to: string; region?: string }): Promise<Entity[]>;
  episodes?(ctx: ProviderContext, id: string): Promise<Entity[]>;
  chapters?(ctx: ProviderContext, id: string): Promise<Entity[]>;
  streams?(ctx: ProviderContext, id: string): Promise<Entity[]>;
  people?(ctx: ProviderContext, id: string): Promise<Entity[]>;
  availability?(ctx: ProviderContext, id: string): Promise<Entity | null>;
  related?(ctx: ProviderContext, id: string): Promise<Entity[]>;
  live?(ctx: ProviderContext, kind?: Kind): Promise<Entity[]>;
  standings?(ctx: ProviderContext, league: string, season?: string): Promise<Entity[]>;
  events?(ctx: ProviderContext, params: Record<string, string>): Promise<Entity[]>;
  lyrics?(ctx: ProviderContext, artist: string, track: string): Promise<Entity | null>;
  resolve?(ctx: ProviderContext, ids: Record<string, string>, kind?: Kind): Promise<Entity | null>;
  calendar?(ctx: ProviderContext, params: { from: string; to: string; kinds: Kind[] }): Promise<Entity[]>;
  epg?(ctx: ProviderContext, params: Record<string, string>): Promise<Entity[]>;
}

const providers = new Map<string, Provider>();

export function register(provider: Provider) {
  if (providers.has(provider.id)) throw new Error(`duplicate provider ${provider.id}`);
  providers.set(provider.id, provider);
  for (const [host, limit] of Object.entries(provider.limits ?? {})) hostLimits.set(host, limit);
}

/** Documented upstream budgets, keyed by host. Read by core/http.ts. */
export const hostLimits = new Map<string, HostLimit>();

/** Every namespace some provider has declared it can look up. */
export function ownedNamespaces(): Set<string> {
  return new Set(allProviders().flatMap((p) => p.namespaces ?? []));
}

export function getProvider(id: string): Provider | undefined {
  return providers.get(id);
}

export function allProviders(): Provider[] {
  return [...providers.values()];
}

/** Optional-key adapters without their key are not in any chain: they would only return []. */
function usable(p: Provider): boolean {
  return p.auth !== "optional-key" || !p.keyEnv || Boolean(process.env[p.keyEnv]);
}

export function chain(op: Operation, kind?: Kind): Provider[] {
  return allProviders()
    .filter((p) => p.operations.includes(op) && typeof (p as any)[op] === "function" && usable(p))
    .filter((p) => !kind || p.kinds.includes(kind))
    .sort((a, b) => a.priority - b.priority);
}

export function providerPublic() {
  return allProviders().sort((a, b) => a.priority - b.priority).map((p) => ({
    id: p.id, name: p.name, domains: p.domains, kinds: p.kinds, operations: p.operations,
    auth: p.auth, base: p.base, license: p.license, freshness: p.freshness, priority: p.priority,
    notes: p.notes, homepage: p.homepage, key_env: p.keyEnv ?? null,
    namespaces: p.namespaces ?? null, limits: p.limits ?? null,
    requires_key: p.auth === "optional-key",
  }));
}
