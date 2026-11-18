import { fetchJson } from "../core/http.ts";
import type { Entity, Kind } from "../schema/entities.ts";
import { addId, baseEntity, tag } from "./_util.ts";
import type { Provider } from "./_types.ts";

const BASE = "https://itunes.apple.com";

const KIND: Record<string, Kind> = {
  song: "music_track", album: "music_album", musicArtist: "music_artist", musicVideo: "music_video",
  movie: "movie", tvShow: "tv_show", tvSeason: "tv_season", tvEpisode: "tv_episode",
  ebook: "book", audiobook: "audiobook", podcast: "podcast", podcastEpisode: "tv_episode",
  software: "software", shortFilm: "movie",
};

function map(r: any): Entity {
  const kind = KIND[r.kind] ?? (r.wrapperType === "artist" ? "music_artist" : "music_track");
  const e = baseEntity(kind, r.trackName ?? r.collectionName ?? r.artistName ?? "Untitled", "itunes", r.trackViewUrl ?? r.collectionViewUrl ?? r.artistViewUrl);
  addId(e, "itunes", String(r.trackId ?? r.collectionId ?? r.artistId));
  if (r.artistId) addId(e, "itunes_artist", String(r.artistId));
  e.title.english = r.trackName ?? r.collectionName ?? r.artistName;
  e.title.short = r.trackCensoredName ?? null;
  e.description.long = { en: r.longDescription ?? r.description ?? "" };
  e.images.cover = [r.artworkUrl100?.replace("100x100", "1200x1200"), r.artworkUrl600, r.artworkUrl100].filter(Boolean);
  e.images.poster = e.images.cover;
  e.technical.runtime_minutes = r.trackTimeMillis ? Math.round(r.trackTimeMillis / 60000) : null;
  e.music.duration_ms = r.trackTimeMillis ?? null;
  e.music.explicit = r.collectionExplicitness === "explicit" || r.trackExplicitness === "explicit";
  e.music.preview_url = r.previewUrl ?? null;
  e.music.track_count = r.trackCount ?? null;
  e.music.artist = r.artistName ? [{ name: r.artistName, kind: "music_artist", external_ids: r.artistId ? { itunes: [String(r.artistId)] } : {} }] : [];
  e.music.album = r.collectionName ? { name: r.collectionName, kind: "music_album", external_ids: r.collectionId ? { itunes: [String(r.collectionId)] } : {} } : null;
  e.dates.release = r.releaseDate ? { date: r.releaseDate } : null;
  e.classification.genres = [r.primaryGenreName].filter(Boolean);
  e.metrics.score = r.averageUserRating ?? null;
  e.metrics.votes = r.userRatingCount ?? null;
  e.broadcast.country = r.country ?? null;
  e.literature.pages = r.pageCount ? Number(r.pageCount) : null;
  e.literature.copyright = { status: r.price != null ? "commercial" : null };
  e.availability.purchase = r.trackPrice != null ? [{ provider: "itunes", url: r.trackViewUrl, kind: "buy", price: { amount: r.trackPrice, currency: r.currency }, audio: [], subtitles: [], drm: "FairPlay" }] : [];
  e.raw.itunes = r;
  e.score = (r.userRatingCount ?? 0) / 1000 + (r.averageUserRating ?? 0);
  tag(e, `itunes:${r.kind}`);
  return e;
}

export const itunes: Provider = {
  id: "itunes", name: "Apple iTunes", domains: ["music", "screen", "reading", "people"], priority: 25,
  kinds: ["music_track", "music_album", "music_artist", "music_video", "movie", "tv_show", "book", "audiobook", "podcast", "software"],
  operations: ["search", "get", "discover"],
  auth: "none", base: BASE, license: "Apple iTunes Search API terms",
  freshness: "24h", homepage: "https://itunes.apple.com",
  notes: "Catalogue across music, film, TV, books, podcasts, apps. Artwork, previews, price, ratings, storefronts.",
  async search(ctx, q) {
    const res = await fetchJson<any>(`${BASE}/search?term=${encodeURIComponent(q)}&entity=song,album,musicArtist,movie,tvShow,ebook,audiobook,podcast&limit=${Math.min(ctx.limit, 25)}&country=${ctx.region || "us"}`, { provider: "itunes", ttlMs: 86_400_000 });
    return (res.data.results ?? []).map(map);
  },
  async get(ctx, ref) {
    const res = await fetchJson<any>(`${BASE}/lookup?id=${ref.id}&entity=${ref.kind ?? "song"}&country=${ctx.region || "us"}`, { provider: "itunes", ttlMs: 86_400_000, allowStatus: [404] });
    return res.data.results?.[0] ? map(res.data.results[0]) : null;
  },
  async discover(ctx, p) {
    const term = p.genre ?? "top";
    const res = await fetchJson<any>(`${BASE}/search?term=${encodeURIComponent(term)}&entity=${p.kind === "music_album" ? "album" : p.kind === "movie" ? "movie" : "song"}&limit=${ctx.limit}&country=${ctx.region || "us"}`, { provider: "itunes", ttlMs: 86_400_000 });
    return (res.data.results ?? []).map(map);
  },
};
export default itunes;
