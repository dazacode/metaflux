import type { Entity, Kind } from "../schema/entities.ts";

export type Operation =
  | "search" | "get" | "trending" | "discover" | "schedule" | "episodes"
  | "chapters" | "streams" | "people" | "availability" | "related" | "live"
  | "standings" | "events" | "lyrics" | "resolve" | "calendar" | "epg";

export interface ProviderContext {
  region: string;
  lang: string;
  now: Date;
  limit: number;
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
}

export interface Provider extends ProviderMeta {
  search?(ctx: ProviderContext, query: string): Promise<Entity[]>;
  searchTeams?(ctx: ProviderContext, query: string): Promise<Entity[]>;
  get?(ctx: ProviderContext, ref: { kind?: Kind; id: string; externalIds?: Record<string, string> }): Promise<Entity | null>;
  trending?(ctx: ProviderContext, kind: Kind): Promise<Entity[]>;
  discover?(ctx: ProviderContext, params: { kind: Kind; genre?: string; year?: number; country?: string; sort?: string }): Promise<Entity[]>;
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
  resolve?(ctx: ProviderContext, ids: Record<string, string>): Promise<Entity | null>;
  calendar?(ctx: ProviderContext, params: { from: string; to: string; kinds: Kind[] }): Promise<Entity[]>;
  epg?(ctx: ProviderContext, params: Record<string, string>): Promise<Entity[]>;
}

const providers = new Map<string, Provider>();

export function register(provider: Provider) {
  if (providers.has(provider.id)) throw new Error(`duplicate provider ${provider.id}`);
  providers.set(provider.id, provider);
}

export function getProvider(id: string): Provider | undefined {
  return providers.get(id);
}

export function allProviders(): Provider[] {
  return [...providers.values()];
}

export function chain(op: Operation, kind?: Kind): Provider[] {
  return allProviders()
    .filter((p) => p.operations.includes(op))
    .filter((p) => !kind || p.kinds.includes(kind))
    .sort((a, b) => a.priority - b.priority);
}

export function providerPublic() {
  return allProviders().sort((a, b) => a.priority - b.priority).map((p) => ({
    id: p.id, name: p.name, domains: p.domains, kinds: p.kinds, operations: p.operations,
    auth: p.auth, base: p.base, license: p.license, freshness: p.freshness, priority: p.priority,
    notes: p.notes, homepage: p.homepage, key_env: p.keyEnv ?? null,
    requires_key: p.auth === "optional-key",
  }));
}
