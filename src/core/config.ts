/** Runtime configuration. Every value can be overridden by env. */
function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  return /^(1|true|yes|on)$/i.test(raw);
}

export const config = {
  version: "0.1.0",
  port: num("PORT", 8787),
  host: process.env.HOST ?? "127.0.0.1",
  env: process.env.NODE_ENV ?? "development",
  /** SQLite location. `:memory:` works but loses persistence. */
  dataDir: process.env.METAFLUX_DATA_DIR ?? ".data",
  dbPath: process.env.METAFLUX_DB ?? ".data/metaflux.sqlite",
  defaultTtlMs: num("METAFLUX_TTL_MS", 5 * 60_000),
  maxTtlMs: num("METAFLUX_MAX_TTL_MS", 30 * 24 * 3600_000),
  staleTtlMs: num("METAFLUX_STALE_TTL_MS", 30 * 24 * 3600_000),
  requestTimeoutMs: num("METAFLUX_TIMEOUT_MS", 5_000),
  maxRetries: num("METAFLUX_RETRIES", 1),
  userAgent: process.env.METAFLUX_UA ?? "MetaFlux/0.1 (+https://github.com/dazacode/metaflux; metadata aggregator)",
  /** Per-host request budget, requests per window. */
  hostRate: num("METAFLUX_HOST_RATE", 6),
  hostWindowMs: num("METAFLUX_HOST_WINDOW_MS", 1_000),
  hostConcurrency: num("METAFLUX_HOST_CONCURRENCY", 6),
  globalConcurrency: num("METAFLUX_CONCURRENCY", 48),
  breakerThreshold: num("METAFLUX_BREAKER_THRESHOLD", 5),
  breakerCooldownMs: num("METAFLUX_BREAKER_COOLDOWN_MS", 60_000),
  searchLimit: num("METAFLUX_SEARCH_LIMIT", 20),
  maxSearchLimit: num("METAFLUX_MAX_SEARCH_LIMIT", 100),
  maxMergeProviders: num("METAFLUX_MAX_PROVIDERS", 8),
  enableNetwork: !bool("METAFLUX_OFFLINE", false),
  enableDocs: bool("METAFLUX_DOCS", true),
  cors: process.env.METAFLUX_CORS ?? "*",
  logLevel: process.env.METAFLUX_LOG ?? "info",
  /** Optional keyed providers; all providers work without these. */
  keys: {
    tmdb: process.env.TMDB_API_KEY ?? "",
    comicvine: process.env.COMICVINE_API_KEY ?? "",
    trakt: process.env.TRAKT_CLIENT_ID ?? "",
    spotify: process.env.SPOTIFY_CLIENT_ID ?? "",
  },
  contact: process.env.METAFLUX_CONTACT ?? "https://github.com/dazacode/metaflux",
} as const;

export const DOMAIN_PROVIDER_LIMITS: Record<string, number> = {
  screen: 6,
  anime: 6,
  reading: 6,
  music: 5,
  sports: 6,
  live: 4,
  people: 4,
  meta: 3,
};
