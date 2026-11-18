import { fetchJson } from "../core/http.ts";
import type { Entity } from "../schema/entities.ts";
import { addId, baseEntity, tag } from "./_util.ts";
import type { Provider } from "./_types.ts";

const BASE = "https://api.deezer.com";

function mapTrack(d: any): Entity {
  const e = baseEntity("music_track", d.title, "deezer", d.link);
  addId(e, "deezer", String(d.id));
  if (d.isrc) addId(e, "isrc", d.isrc);
  e.title.short = d.title_short ?? null;
  e.title.aliases = d.title_version ? [d.title_version] : [];
  e.music.duration_ms = d.duration ? d.duration * 1000 : null;
  e.music.preview_url = d.preview ?? null;
  e.music.explicit = d.explicit_lyrics ?? null;
  e.music.track_count = null;
  e.music.bpm = d.bpm ?? null;
  e.metrics.rank = d.rank ?? null;
  e.images.cover = [d.album?.cover_xl, d.album?.cover_big].filter(Boolean);
  e.music.album = d.album ? { id: String(d.album.id), name: d.album.title, kind: "music_album", image: d.album.cover_xl ?? null, external_ids: { deezer: [String(d.album.id)] } } : null;
  e.music.artist = d.artist ? [{ id: String(d.artist.id), name: d.artist.name, kind: "music_artist", image: d.artist.picture_xl ?? null, external_ids: { deezer: [String(d.artist.id)] } }] : [];
  e.raw.deezer = d;
  e.score = (d.rank ?? 0) / 10_000;
  tag(e, "source:deezer");
  return e;
}

function mapArtist(d: any): Entity {
  const e = baseEntity("music_artist", d.name, "deezer", d.link);
  addId(e, "deezer", String(d.id));
  e.images.profile = [d.picture_xl, d.picture_big, d.picture_medium].filter(Boolean);
  e.metrics.followers = d.nb_fan ?? null;
  e.metrics.plays = d.nb_album ? null : null;
  e.person.occupations = ["musician"];
  e.person.aliases = undefined as any;
  e.title.aliases = [];
  e.raw.deezer = d;
  e.score = (d.nb_fan ?? 0) / 1000;
  return e;
}

export const deezer: Provider = {
  id: "deezer", name: "Deezer", domains: ["music"], priority: 17,
  kinds: ["music_artist", "music_album", "music_track", "music_group"],
  operations: ["search", "get", "trending", "related", "people"],
  auth: "none", base: BASE, license: "Deezer public API terms",
  freshness: "1h", homepage: "https://www.deezer.com",
  notes: "Track/album/artist search, ISRC, BPM, 30s previews, artwork, fan counts.",
  async search(ctx, q) {
    const [tracks, artists, albums] = await Promise.all([
      fetchJson<any>(`${BASE}/search/track?q=${encodeURIComponent(q)}&limit=${Math.min(ctx.limit, 15)}`, { provider: "deezer", ttlMs: 3_600_000 }).catch(() => null),
      fetchJson<any>(`${BASE}/search/artist?q=${encodeURIComponent(q)}&limit=${Math.min(ctx.limit, 8)}`, { provider: "deezer", ttlMs: 3_600_000 }).catch(() => null),
      fetchJson<any>(`${BASE}/search/album?q=${encodeURIComponent(q)}&limit=${Math.min(ctx.limit, 8)}`, { provider: "deezer", ttlMs: 3_600_000 }).catch(() => null),
    ]);
    return [...(artists?.data?.data ?? []).map(mapArtist), ...(tracks?.data?.data ?? []).map(mapTrack), ...(albums?.data?.data ?? []).map(mapAlbum)].slice(0, ctx.limit);
  },
  async get(ctx, ref) {
    const kind = ref.kind ?? "music_track";
    const path = kind === "music_artist" || kind === "music_group" ? "artist" : kind === "music_album" ? "album" : "track";
    const res = await fetchJson<any>(`${BASE}/${path}/${ref.id}`, { provider: "deezer", ttlMs: 3_600_000, allowStatus: [404] });
    if (res.data?.error) return null;
    return path === "artist" ? mapArtist(res.data) : path === "album" ? mapAlbum(res.data) : mapTrack(res.data);
  },
  async trending(ctx, kind) {
    const res = await fetchJson<any>(`${BASE}/chart/0/${kind === "music_artist" ? "artists" : kind === "music_album" ? "albums" : "tracks"}?limit=${ctx.limit}`, { provider: "deezer", ttlMs: 3_600_000 });
    return (res.data?.data ?? []).map((d: any) => kind === "music_artist" ? mapArtist(d) : kind === "music_album" ? mapAlbum(d) : mapTrack(d));
  },
  async related(ctx, id) {
    const res = await fetchJson<any>(`${BASE}/artist/${id}/related?limit=${ctx.limit}`, { provider: "deezer", ttlMs: 3_600_000 }).catch(() => null);
    return (res?.data?.data ?? []).map(mapArtist);
  },
  async people(ctx, id) {
    const e = await this.get!(ctx, { id, kind: "music_artist" });
    return e ? [e] : [];
  },
};

function mapAlbum(d: any): Entity {
  const e = baseEntity("music_album", d.title, "deezer", d.link);
  addId(e, "deezer", String(d.id));
  e.music.artist = d.artist ? [{ id: String(d.artist.id), name: d.artist.name, kind: "music_artist", external_ids: { deezer: [String(d.artist.id)] } }] : [];
  e.music.track_count = d.nb_tracks ?? null;
  e.music.release_type = d.record_type ?? null;
  e.dates.release = d.release_date ? { date: d.release_date } : null;
  e.images.cover = [d.cover_xl, d.cover_big].filter(Boolean);
  e.metrics.fans = undefined as any;
  e.metrics.followers = d.fans ?? null;
  e.raw.deezer = d;
  e.score = (d.fans ?? 0) / 1000;
  return e;
}
export default deezer;
