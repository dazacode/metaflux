/** Polite HTTP layer: cache, coalescing, per-host budgets, retries, circuit breakers. */
import { config } from "./config.ts";
import { MetaFluxError, providerError } from "./errors.ts";
import { cache, providerState, singleflight } from "./store.ts";
import { hostLimits } from "../providers/_types.ts";

interface Bucket { tokens: number; last: number; concurrency: number; pausedUntil: number; }
const buckets = new Map<string, Bucket>();
let globalActive = 0;
const globalQueue: (() => void)[] = [];

async function globalSlot() {
  if (globalActive < config.globalConcurrency) { globalActive++; return; }
  await new Promise<void>((resolve) => globalQueue.push(() => { globalActive++; resolve(); }));
}
function releaseGlobal() {
  globalActive = Math.max(0, globalActive - 1);
  const next = globalQueue.shift();
  if (next) next();
}

/** The budget for a host: the provider's documented limit, else the global default. */
export function hostBudget(host: string) {
  const l = hostLimits.get(host);
  const rate = l?.rate ?? config.hostRate;
  const windowMs = l?.windowMs ?? config.hostWindowMs;
  return { rate, windowMs, burst: l?.burst ?? rate, concurrency: l?.concurrency ?? config.hostConcurrency };
}

async function hostSlot(host: string) {
  const budget = hostBudget(host);
  let b = buckets.get(host);
  if (!b) { b = { tokens: budget.burst, last: Date.now(), concurrency: 0, pausedUntil: 0 }; buckets.set(host, b); }
  for (;;) {
    const now = Date.now();
    b.tokens = Math.min(budget.burst, b.tokens + ((now - b.last) / budget.windowMs) * budget.rate);
    b.last = now;
    if (now >= b.pausedUntil && b.tokens >= 1 && b.concurrency < budget.concurrency) { b.tokens -= 1; b.concurrency++; return; }
    const refill = (budget.windowMs / budget.rate) * (1 - Math.min(1, b.tokens));
    await Bun.sleep(Math.max(15, b.pausedUntil > now ? b.pausedUntil - now : refill));
  }
}

/** A 429 drains the host's bucket until the upstream says it is open again. */
function pauseHost(host: string, ms: number) {
  const b = buckets.get(host);
  if (b) { b.tokens = 0; b.pausedUntil = Math.max(b.pausedUntil, Date.now() + ms); }
}
function releaseHost(host: string) {
  const b = buckets.get(host);
  if (b) b.concurrency = Math.max(0, b.concurrency - 1);
}

export interface FetchOptions {
  provider: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  ttlMs?: number;
  staleMs?: number;
  timeoutMs?: number;
  retries?: number;
  /** Bypass fresh cache but still allow stale fallback. */
  force?: boolean;
  accept?: string;
  /** Treat these statuses as data (default: 2xx only). */
  allowStatus?: number[];
}

export interface FetchResult<T = unknown> {
  data: T;
  status: number;
  url: string;
  fromCache: boolean;
  stale: boolean;
  fetchedAt: number;
  provider: string;
}

function cacheKey(method: string, url: string, headers: Record<string, string>, body?: string) {
  const h = new Bun.CryptoHasher("sha256");
  h.update(method);
  h.update(url);
  for (const k of Object.keys(headers).sort()) h.update(`${k}:${headers[k]}\n`);
  if (body) h.update(body);
  return h.digest("hex");
}

function retryDelay(attempt: number, retryAfter?: string | null) {
  if (retryAfter) {
    const secs = Number(retryAfter);
    if (Number.isFinite(secs)) return Math.min(60_000, secs * 1000);
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.min(60_000, Math.max(0, date - Date.now()));
  }
  return Math.min(8_000, 350 * 2 ** attempt + Math.random() * 250);
}

export async function fetchRaw(url: string, opts: FetchOptions): Promise<FetchResult<string>> {
  const method = (opts.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = {
    "user-agent": config.userAgent,
    accept: opts.accept ?? "application/json, text/plain;q=0.9, */*;q=0.5",
    ...(opts.headers ?? {}),
  };
  const key = cacheKey(method, url, headers, opts.body);
  const ttl = opts.ttlMs ?? config.defaultTtlMs;

  const cached = cache.get(key);
  const now = Date.now();
  if (cached && !opts.force && now < cached.expiresAt) {
    return { data: cached.body, status: cached.status, url, fromCache: true, stale: false, fetchedAt: cached.fetchedAt, provider: opts.provider };
  }
  if (cached && now < cached.staleUntil) {
    if (!opts.force) {
      // Stale-while-revalidate. Failure keeps serving the stale copy.
      void revalidate(url, opts, key);
      return { data: cached.body, status: cached.status, url, fromCache: true, stale: true, fetchedAt: cached.fetchedAt, provider: opts.provider };
    }
  }
  if (!config.enableNetwork) {
    if (cached) return { data: cached.body, status: cached.status, url, fromCache: true, stale: true, fetchedAt: cached.fetchedAt, provider: opts.provider };
    throw new MetaFluxError("offline", "network disabled and no cached copy", 503);
  }
  if (providerState.isOpen(opts.provider)) {
    if (cached) return { data: cached.body, status: cached.status, url, fromCache: true, stale: true, fetchedAt: cached.fetchedAt, provider: opts.provider };
    throw new MetaFluxError("circuit_open", `${opts.provider} circuit is open`, 503);
  }

  return singleflight(key, async () => {
    const host = new URL(url).host;
    await globalSlot();
    await hostSlot(host);
    try {
      if (cached?.etag) headers["if-none-match"] = cached.etag;
      if (cached?.lastModified) headers["if-modified-since"] = cached.lastModified;
      const retries = opts.retries ?? config.maxRetries;
      let lastErr: unknown;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const res = await fetch(url, {
            method, headers, body: opts.body,
            signal: AbortSignal.timeout(opts.timeoutMs ?? config.requestTimeoutMs),
            redirect: "follow",
          });
          if (res.status === 429) pauseHost(host, retryDelay(attempt, res.headers.get("retry-after")));
          if (res.status === 429 || res.status >= 500) {
            if (attempt < retries) {
              await Bun.sleep(retryDelay(attempt, res.headers.get("retry-after")));
              continue;
            }
          }
          if (res.status === 304 && cached) {
            cache.set(key, { status: cached.status, body: cached.body, headers: cached.headers, etag: cached.etag, lastModified: cached.lastModified, ttlMs: ttl, staleMs: opts.staleMs });
            providerState.recordSuccess(opts.provider);
            return { data: cached.body, status: cached.status, url, fromCache: true, stale: false, fetchedAt: Date.now(), provider: opts.provider };
          }
          const text = await res.text();
          const allow = opts.allowStatus ?? [];
          if (!res.ok && !allow.includes(res.status)) {
            throw providerError(opts.provider, `HTTP ${res.status} ${res.statusText}`, { url, body: text.slice(0, 400) });
          }
          cache.set(key, {
            status: res.status, body: text,
            headers: { "content-type": res.headers.get("content-type") ?? "" },
            etag: res.headers.get("etag"), lastModified: res.headers.get("last-modified"),
            ttlMs: ttl, staleMs: opts.staleMs,
          });
          providerState.recordSuccess(opts.provider);
          return { data: text, status: res.status, url, fromCache: false, stale: false, fetchedAt: Date.now(), provider: opts.provider };
        } catch (err) {
          lastErr = err;
          if (err instanceof MetaFluxError && err.status === 502) break;
          if (attempt < retries) await Bun.sleep(retryDelay(attempt));
        }
      }
      providerState.recordFailure(opts.provider, lastErr instanceof Error ? lastErr.message : String(lastErr));
      if (cached) return { data: cached.body, status: cached.status, url, fromCache: true, stale: true, fetchedAt: cached.fetchedAt, provider: opts.provider };
      if (lastErr instanceof MetaFluxError) throw lastErr;
      const timedOut = lastErr instanceof Error && /timeout|abort/i.test(lastErr.name + lastErr.message);
      throw new MetaFluxError(timedOut ? "provider_timeout" : "provider_error", `${opts.provider}: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`, 502);
    } finally {
      releaseHost(host);
      releaseGlobal();
    }
  });
}

async function revalidate(url: string, opts: FetchOptions, key: string) {
  try {
    const res = await fetchRaw(url, { ...opts, force: true });
    void res;
  } catch {
    const c = cache.get(key);
    if (c) cache.set(key, { status: c.status, body: c.body, headers: c.headers, etag: c.etag, lastModified: c.lastModified, ttlMs: Math.min(120_000, opts.ttlMs ?? config.defaultTtlMs), staleMs: opts.staleMs });
  }
}

export async function fetchJson<T = any>(url: string, opts: FetchOptions): Promise<FetchResult<T>> {
  const res = await fetchRaw(url, { ...opts, accept: "application/json" });
  try {
    return { ...res, data: JSON.parse(res.data) as T };
  } catch {
    throw providerError(opts.provider, "invalid JSON", { url, body: res.data.slice(0, 300) });
  }
}

export async function fetchText(url: string, opts: FetchOptions): Promise<FetchResult<string>> {
  return fetchRaw(url, { ...opts, accept: opts.accept ?? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" });
}

export async function postJson<T = any>(url: string, body: unknown, opts: FetchOptions): Promise<FetchResult<T>> {
  return fetchJson<T>(url, {
    ...opts,
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json", ...(opts.headers ?? {}) },
  });
}
