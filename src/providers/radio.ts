import { fetchJson } from "../core/http.ts";
import type { Entity } from "../schema/entities.ts";
import { addId, baseEntity, list, str } from "./_util.ts";
import type { Provider } from "./_types.ts";

const BASE = "https://de1.api.radio-browser.info";

function map(s: any): Entity {
  const e = baseEntity("radio_station", s.name, "radio-browser", s.homepage);
  addId(e, "radio", s.stationuuid);
  e.title.aliases = list(s.tags);
  e.images.logo = [s.favicon].filter(Boolean);
  e.broadcast.country = str(s.countrycode);
  e.broadcast.timezone = str(s.timezone);
  e.classification.genres = list(s.tags);
  e.technical.audio_codec = str(s.codec);
  e.technical.bitrate_kbps = Number(s.bitrate) || null;
  e.technical.audio_languages = list(s.language);
  e.availability.radio = [{ provider: "radio-browser", url: s.url_resolved ?? s.url, kind: "radio", quality: `${s.bitrate ?? "?"}kbps`, audio: [], subtitles: [], drm: null, is_official: true }];
  e.metrics.votes = Number(s.votes) || null;
  e.metrics.plays = Number(s.clickcount) || null;
  e.urls.official = s.homepage ?? "";
  e.raw.radio_browser = s;
  e.score = (e.metrics.votes ?? 0) / 10;
  return e;
}

export const radio: Provider = {
  id: "radio-browser", name: "Radio Browser", domains: ["live"], priority: 26,
  kinds: ["radio_station"],
  operations: ["search", "get", "discover", "streams"],
  auth: "none", base: BASE, license: "Radio Browser community data",
  freshness: "1h", homepage: "https://www.radio-browser.info",
  notes: "Radio stations with codecs, bitrate, geo, favicon, tags.",
  async search(ctx, q) {
    const res = await fetchJson<any>(`${BASE}/json/stations/search?name=${encodeURIComponent(q)}&limit=${Math.min(ctx.limit, 30)}&hidebroken=true&order=clickcount&reverse=true`, { provider: "radio-browser", ttlMs: 3_600_000 });
    return (res.data ?? []).map(map);
  },
  async get(ctx, ref) {
    const res = await fetchJson<any>(`${BASE}/json/stations/byuuid/${ref.id}`, { provider: "radio-browser", ttlMs: 3_600_000, allowStatus: [404] });
    return res.data?.[0] ? map(res.data[0]) : null;
  },
  async discover(ctx, p) {
    const url = p.country ? `${BASE}/json/stations/bycountrycodeexact/${p.country}?limit=${ctx.limit}` : `${BASE}/json/stations/search?limit=${ctx.limit}&hidebroken=true&order=clickcount&reverse=true`;
    const res = await fetchJson<any>(url, { provider: "radio-browser", ttlMs: 3_600_000 });
    return (res.data ?? []).map(map);
  },
  async streams(ctx, id) {
    const e = await this.get!(ctx, { id });
    return e ? [e] : [];
  },
};
export default radio;
