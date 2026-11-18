/** SQLite-backed HTTP cache, entity store and FTS index. */
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "./config.ts";
import { idScope, indexableIds } from "./identity.ts";
import type { Kind } from "../schema/entities.ts";

let db: Database | null = null;

export function getDb(): Database {
  if (db) return db;
  if (config.dbPath !== ":memory:") mkdirSync(dirname(config.dbPath), { recursive: true });
  db = new Database(config.dbPath, { create: true });
  db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=5000;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS http_cache (
      key TEXT PRIMARY KEY,
      status INTEGER NOT NULL,
      body BLOB NOT NULL,
      headers TEXT NOT NULL DEFAULT '{}',
      provider TEXT,
      url TEXT,
      etag TEXT,
      last_modified TEXT,
      fetched_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      stale_until INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS http_cache_expiry ON http_cache(expires_at);
    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      domain TEXT NOT NULL,
      name TEXT NOT NULL,
      doc TEXT NOT NULL,
      score REAL NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS entities_kind ON entities(kind);
    CREATE INDEX IF NOT EXISTS entities_domain ON entities(domain);
    CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(
      id UNINDEXED, name, aliases, description, tags, tokenize='unicode61 remove_diacritics 2'
    );
    CREATE TABLE IF NOT EXISTS ids (
      provider TEXT NOT NULL,
      external_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      PRIMARY KEY (provider, external_id)
    );
    CREATE TABLE IF NOT EXISTS entity_ids (
      scope TEXT NOT NULL,
      provider TEXT NOT NULL,
      external_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      PRIMARY KEY (scope, provider, external_id)
    );
    CREATE TABLE IF NOT EXISTS provider_state (
      provider TEXT PRIMARY KEY,
      state TEXT NOT NULL,
      failures INTEGER NOT NULL DEFAULT 0,
      opened_at INTEGER,
      last_ok INTEGER,
      last_error TEXT
    );
    CREATE TABLE IF NOT EXISTS snapshots (
      name TEXT PRIMARY KEY,
      fetched_at INTEGER NOT NULL,
      bytes INTEGER NOT NULL,
      items INTEGER NOT NULL,
      sha256 TEXT
    );
  `);
  return db;
}

export interface CacheEntry {
  status: number;
  body: string;
  headers: Record<string, string>;
  fetchedAt: number;
  expiresAt: number;
  staleUntil: number;
  etag?: string | null;
  lastModified?: string | null;
}

export const cache = {
  get(key: string): CacheEntry | null {
    const row = getDb().query<any, [string]>("SELECT * FROM http_cache WHERE key = ?").get(key);
    if (!row) return null;
    return {
      status: row.status,
      body: row.body?.toString?.() ?? String(row.body),
      headers: JSON.parse(row.headers || "{}"),
      fetchedAt: row.fetched_at,
      expiresAt: row.expires_at,
      staleUntil: row.stale_until,
      etag: row.etag,
      lastModified: row.last_modified,
    };
  },
  set(key: string, entry: { status: number; body: string; headers?: Record<string, string>; etag?: string | null; lastModified?: string | null; ttlMs: number; staleMs?: number; provider?: string; url?: string }) {
    const now = Date.now();
    const expiresAt = now + Math.max(0, Math.min(entry.ttlMs, config.maxTtlMs));
    const staleUntil = expiresAt + Math.max(0, entry.staleMs ?? config.staleTtlMs);
    getDb().query(
      `INSERT INTO http_cache(key,status,body,headers,provider,url,etag,last_modified,fetched_at,expires_at,stale_until)
       VALUES(?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(key) DO UPDATE SET status=excluded.status,body=excluded.body,headers=excluded.headers,
         etag=excluded.etag,last_modified=excluded.last_modified,fetched_at=excluded.fetched_at,
         expires_at=excluded.expires_at,stale_until=excluded.stale_until`,
    ).run(key, entry.status, entry.body, JSON.stringify(entry.headers ?? {}), (entry as any).provider ?? null, (entry as any).url ?? null, entry.etag ?? null, entry.lastModified ?? null, now, expiresAt, staleUntil);
  },
  purge(expiredOnly = true) {
    if (expiredOnly) getDb().query("DELETE FROM http_cache WHERE stale_until < ?").run(Date.now());
    else getDb().exec("DELETE FROM http_cache");
  },
  stats() {
    const row = getDb().query<any, []>("SELECT COUNT(*) AS rows, COALESCE(SUM(LENGTH(body)),0) AS bytes FROM http_cache").get();
    return { rows: row?.rows ?? 0, bytes: row?.bytes ?? 0 };
  },
};

const inflight = new Map<string, Promise<unknown>>();
export async function singleflight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export const entityStore = {
  /** Persist a record. `index: false` keeps list rows out of the id index so they never shadow a detail record. */
  put(doc: { id: string; kind: string; domain: string; name: string; score?: number; title?: any; description?: any; classification?: any; external_ids?: Record<string, string[]> }, opts: { index?: boolean } = {}) {
    const now = Date.now();
    const tx = getDb().transaction(() => {
      getDb().query(
        `INSERT INTO entities(id,kind,domain,name,doc,score,updated_at) VALUES(?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name,doc=excluded.doc,score=excluded.score,updated_at=excluded.updated_at`,
      ).run(doc.id, doc.kind, doc.domain, doc.name, JSON.stringify(doc), doc.score ?? 0, now);
      getDb().query("DELETE FROM entities_fts WHERE id = ?").run(doc.id);
      const aliases = [doc.title?.romaji, doc.title?.english, doc.title?.native, ...(doc.title?.aliases ?? [])].filter(Boolean).join(" ");
      const description = Object.values(doc.description ?? {}).filter((v) => typeof v === "string").join(" ").slice(0, 8000);
      const tags = [...(doc.classification?.genres ?? []), ...(doc.classification?.themes ?? []), ...(doc.classification?.keywords ?? [])].join(" ");
      getDb().query("INSERT INTO entities_fts(id,name,aliases,description,tags) VALUES(?,?,?,?,?)")
        .run(doc.id, doc.name, aliases, description, tags);
      // Scoped by kind group: MAL anime 13 and MAL manga 13 are different works.
      const scope = idScope(doc.kind as Kind);
      for (const [provider, external] of opts.index === false ? [] : indexableIds(doc as any)) {
        getDb().query("INSERT INTO entity_ids(scope,provider,external_id,entity_id) VALUES(?,?,?,?) ON CONFLICT(scope,provider,external_id) DO UPDATE SET entity_id=excluded.entity_id")
          .run(scope, provider, external, doc.id);
      }
    });
    tx();
  },
  get(id: string): any | null {
    const row = getDb().query<any, [string]>("SELECT doc FROM entities WHERE id = ?").get(id);
    return row ? JSON.parse(row.doc) : null;
  },
  /** Entity id for `provider:externalId` within the kind's id scope (any scope when kind is omitted). */
  findId(provider: string, externalId: string, kind?: Kind): string | null {
    const row = kind
      ? getDb().query<any, [string, string, string]>("SELECT entity_id FROM entity_ids WHERE scope = ? AND provider = ? AND external_id = ?").get(idScope(kind), provider, externalId)
      : getDb().query<any, [string, string]>("SELECT entity_id FROM entity_ids WHERE provider = ? AND external_id = ?").get(provider, externalId);
    return row?.entity_id ?? null;
  },
  search(q: string, kinds: string[], limit: number, offset = 0): any[] {
    const kindClause = kinds.length ? ` AND e.kind IN (${kinds.map(() => "?").join(",")})` : "";
    const sql = `SELECT e.doc, bm25(entities_fts) AS rank FROM entities_fts f
      JOIN entities e ON e.id = f.id
      WHERE entities_fts MATCH ?${kindClause}
      GROUP BY e.id ORDER BY rank LIMIT ? OFFSET ?`;
    const safe = q.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).map((t) => `${t}*`).join(" ") || "*";
    try {
      return getDb().query<any, any[]>(sql).all(safe, ...kinds, limit, offset).map((r: any) => JSON.parse(r.doc));
    } catch {
      return [];
    }
  },
  count(kind?: string) {
    const row = kind
      ? getDb().query<any, [string]>("SELECT COUNT(*) AS n FROM entities WHERE kind = ?").get(kind)
      : getDb().query<any, []>("SELECT COUNT(*) AS n FROM entities").get();
    return row?.n ?? 0;
  },
};

export const providerState = {
  get(provider: string) {
    return getDb().query<any, [string]>("SELECT * FROM provider_state WHERE provider = ?").get(provider);
  },
  recordFailure(provider: string, error: string) {
    const now = Date.now();
    const row = this.get(provider);
    const failures = (row?.failures ?? 0) + 1;
    const openedAt = failures >= config.breakerThreshold ? now : row?.opened_at ?? null;
    getDb().query(
      `INSERT INTO provider_state(provider,state,failures,opened_at,last_ok,last_error) VALUES(?,?,?,?,?,?)
       ON CONFLICT(provider) DO UPDATE SET state=excluded.state,failures=excluded.failures,
         opened_at=excluded.opened_at,last_error=excluded.last_error`,
    ).run(provider, openedAt ? "open" : "closed", failures, openedAt, row?.last_ok ?? null, error.slice(0, 500));
  },
  recordSuccess(provider: string) {
    getDb().query(
      `INSERT INTO provider_state(provider,state,failures,opened_at,last_ok,last_error) VALUES(?,'closed',0,NULL,?,NULL)
       ON CONFLICT(provider) DO UPDATE SET state='closed',failures=0,opened_at=NULL,last_ok=excluded.last_ok,last_error=NULL`,
    ).run(provider, Date.now());
  },
  isOpen(provider: string) {
    const row = this.get(provider);
    if (!row || row.state !== "open") return false;
    if (Date.now() - (row.opened_at ?? 0) > config.breakerCooldownMs) {
      getDb().query("UPDATE provider_state SET state='half-open', failures=0 WHERE provider = ?").run(provider);
      return false;
    }
    return true;
  },
  all() {
    return getDb().query<any, []>("SELECT * FROM provider_state ORDER BY provider").all();
  },
};
