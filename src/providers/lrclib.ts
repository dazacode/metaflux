import { fetchJson } from "../core/http.ts";
import type { Entity } from "../schema/entities.ts";
import { addId, baseEntity } from "./_util.ts";
import type { Provider } from "./_types.ts";

const BASE = "https://lrclib.net/api";

function map(d: any): Entity {
  const e = baseEntity("music_track", d.trackName, "lrclib", `https://lrclib.net/`);
  addId(e, "lrclib", String(d.id));
  e.music.artist = [{ name: d.artistName, kind: "music_artist" }];
  e.music.album = d.albumName ? { name: d.albumName, kind: "music_album" } : null;
  e.music.duration_ms = d.duration ? d.duration * 1000 : null;
  e.music.lyrics = { plain: d.plainLyrics ?? null, synced: d.syncedLyrics ?? null, language: null, source: "lrclib" };
  e.music.is_instrumental = d.instrumental ?? null;
  e.literature.copyright = { license: "community lyrics; per-song rights" };
  e.raw.lrclib = d;
  e.score = d.syncedLyrics ? 10 : 5;
  return e;
}

export const lrclib: Provider = {
  id: "lrclib", name: "LRCLIB", domains: ["music"], priority: 40,
  kinds: ["music_track"],
  operations: ["search", "lyrics", "get"],
  auth: "none", base: BASE, license: "community lyrics",
  freshness: "30d", homepage: "https://lrclib.net",
  notes: "Synced (LRC) and plain lyrics by track.",
  async search(ctx, q) {
    const res = await fetchJson<any>(`${BASE}/search?q=${encodeURIComponent(q)}`, { provider: "lrclib", ttlMs: 2_592_000_000 });
    return (res.data ?? []).slice(0, ctx.limit).map(map);
  },
  async get(ctx, ref) {
    const res = await fetchJson<any>(`${BASE}/get/${ref.id}`, { provider: "lrclib", ttlMs: 2_592_000_000, allowStatus: [404] });
    return res.data?.id ? map(res.data) : null;
  },
  async lyrics(ctx, artist, track) {
    const res = await fetchJson<any>(`${BASE}/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(track)}`, { provider: "lrclib", ttlMs: 2_592_000_000, allowStatus: [404] }).catch(() => null);
    return res?.data?.id ? map(res.data) : null;
  },
};
export default lrclib;
