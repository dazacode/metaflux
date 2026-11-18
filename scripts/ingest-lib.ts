/** Bulk snapshot ingest. Makes the API fast and resilient without upstream calls. */
import { getDb } from "../src/core/store.ts";
import { entityStore } from "../src/core/store.ts";
import { baseEntity } from "../src/providers/_util.ts";
import { addId } from "../src/providers/_util.ts";
import { sha256 } from "../src/core/id.ts";
import { fetchJson } from "../src/core/http.ts";

const SNAPSHOTS: Record<string, { description: string; run: () => Promise<number> }> = {
  iptv: {
    description: "iptv-org channels, streams and EPG guide index",
    async run() {
      const channels = await fetchJson<any>("https://iptv-org.github.io/api/channels.json", { provider: "ingest", ttlMs: 86_400_000 });
      const streams = await fetchJson<any>("https://iptv-org.github.io/api/streams.json", { provider: "ingest", ttlMs: 86_400_000 });
      const byChannel = new Map<string, any[]>();
      for (const s of streams.data ?? []) {
        const arr = byChannel.get(s.channel) ?? [];
        arr.push(s);
        byChannel.set(s.channel, arr);
      }
      let n = 0;
      for (const c of channels.data ?? []) {
        const e = baseEntity("iptv_channel", c.name, "iptv-org");
        addId(e, "iptv_org", c.id);
        e.iptv = { ...e.iptv, channel_id: c.id, channel_name: c.name, alt_names: c.alt_names ?? [], network: c.network ?? null, country: c.country ?? null, languages: c.languages ?? [], categories: c.categories ?? [], is_nsfw: c.is_nsfw ?? false, website: c.website ?? null, epg_ids: (c.guides ?? []).map((g: any) => g.site), streams: (byChannel.get(c.id) ?? []).map((s: any) => ({ provider: "iptv-org", url: s.url, kind: "iptv" as const, quality: s.quality ?? null, audio: [], subtitles: [], sources: [], region: c.country ? [c.country] : [] })) };
        e.classification.genres = c.categories ?? [];
        e.broadcast.country = c.country ?? null;
        e.images.logo = [c.logo].filter(Boolean);
        e.iptv.stream_count = e.iptv.streams.length;
        e.score = e.iptv.stream_count + (c.closed ? 0 : 5);
        entityStore.put(e as any);
        n++;
      }
      return n;
    },
  },
  radio: {
    description: "Radio Browser top stations",
    async run() {
      const res = await fetchJson<any>("https://de1.api.radio-browser.info/json/stations/topclick/500?hidebroken=true", { provider: "ingest", ttlMs: 86_400_000 });
      let n = 0;
      for (const s of res.data ?? []) {
        const e = baseEntity("radio_station", s.name, "radio-browser");
        addId(e, "radio", s.stationuuid);
        e.availability.radio = [{ provider: "radio-browser", url: s.url_resolved ?? s.url, kind: "radio" as const, quality: `${s.bitrate ?? "?"}kbps`, audio: [], subtitles: [], sources: [], region: s.countrycode ? [s.countrycode] : [] }];
        e.broadcast.country = s.countrycode ?? null;
        e.classification.genres = String(s.tags ?? "").split(",").filter(Boolean);
        e.images.logo = [s.favicon].filter(Boolean);
        entityStore.put(e as any);
        n++;
      }
      return n;
    },
  },
  openlibrary: {
    description: "Open Library subject seeds (classics)",
    async run() {
      const res = await fetchJson<any>("https://openlibrary.org/search.json?q=subject%3Aclassic+literature&limit=500&fields=key,title,author_name,first_publish_year,cover_i,edition_count,isbn,ia,has_fulltext,subject", { provider: "ingest", ttlMs: 86_400_000 });
      let n = 0;
      for (const d of res.data.docs ?? []) {
        const e = baseEntity("book", d.title, "openlibrary", `https://openlibrary.org${d.key}`);
        addId(e, "openlibrary", d.key);
        e.dates.start = d.first_publish_year ? { year: d.first_publish_year } : null;
        e.images.cover = d.cover_i ? [`https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`] : [];
        e.literature.subjects = d.subject ?? [];
        e.literature.isbn13 = (d.isbn ?? []).filter((x: string) => x.length === 13);
        e.literature.ia_identifier = d.ia?.[0] ?? null;
        for (const a of d.author_name ?? []) e.credits.push({ person: { name: a, kind: "person" }, role: "author", voice: false });
        e.score = d.edition_count ?? 0;
        entityStore.put(e as any);
        n++;
      }
      return n;
    },
  },
};

export async function ingest(name: string): Promise<string> {
  const snap = SNAPSHOTS[name];
  if (!snap) throw new Error(`unknown snapshot ${name}; options: ${Object.keys(SNAPSHOTS).join(", ")}`);
  const started = Date.now();
  const items = await snap.run();
  const db = getDb();
  db.query("INSERT INTO snapshots(name,fetched_at,bytes,items,sha256) VALUES(?,?,?,?,?) ON CONFLICT(name) DO UPDATE SET fetched_at=excluded.fetched_at,items=excluded.items,bytes=excluded.bytes")
    .run(name, Date.now(), 0, items, sha256(`${name}:${Date.now()}:${items}`));
  return `${name}: ${items} items in ${Date.now() - started}ms. total entities: ${entityStore.count()}`;
}

export function loadSnapshots() {
  return getDb().query("SELECT name,fetched_at,items,bytes FROM snapshots ORDER BY fetched_at DESC").all();
}

export const SNAPSHOT_NAMES = Object.keys(SNAPSHOTS);
