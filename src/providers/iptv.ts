import { fetchJson } from "../core/http.ts";
import type { Entity } from "../schema/entities.ts";
import { addId, baseEntity, list, str, tag } from "./_util.ts";
import type { Provider } from "./_types.ts";

const BASE = "https://iptv-org.github.io/api";
const TTL = 6 * 3600_000;

function mapChannel(c: any): Entity {
  const e = baseEntity("iptv_channel", c.name, "iptv-org", `https://iptv-org.github.io/iptv/`);
  addId(e, "iptv_org", c.id);
  e.title.aliases = list(c.alt_names);
  e.title.native = c.name;
  e.iptv.channel_id = c.id;
  e.iptv.channel_name = c.name;
  e.iptv.alt_names = list(c.alt_names);
  e.iptv.network = str(c.network);
  e.iptv.owners = list(c.owners);
  e.iptv.country = str(c.country);
  e.iptv.subdivision = str(c.subdivision);
  e.iptv.city = str(c.city);
  e.iptv.languages = list(c.languages);
  e.iptv.categories = list(c.categories);
  e.iptv.is_nsfw = c.is_nsfw ?? null;
  e.iptv.launched = c.launched ?? null;
  e.iptv.closed = c.closed ?? null;
  e.iptv.replaced_by = c.replaced_by ?? null;
  e.iptv.website = c.website ?? null;
  e.iptv.epg_ids = list(c.guides?.map?.((g: any) => g.site) ?? c.guides);
  e.iptv.geo_block = list(c.geo_block?.map?.((g: any) => g.country) ?? c.geo_block);
  e.images.logo = [c.logo].filter(Boolean);
  e.images.color = [];
  e.classification.genres = list(c.categories);
  e.classification.is_adult = c.is_nsfw ?? null;
  e.broadcast.country = str(c.country);
  e.technical.audio_languages = list(c.languages);
  e.urls.official = c.website ?? "";
  e.raw.iptv_org = c;
  tag(e, "source:iptv-org");
  e.score = (c.is_nsfw ? 1 : 5) + (c.closed ? 0 : 5);
  return e;
}

function mapStream(s: any, channel?: Entity): Entity {
  const e = baseEntity("iptv_stream", `${channel?.name ?? s.channel ?? "Stream"} ${s.quality ?? ""}`.trim(), "iptv-org", s.url);
  addId(e, "iptv_stream", `${s.channel}_${s.quality ?? ""}_${s.url}`);
  e.iptv.channel_id = s.channel ?? null;
  e.iptv.channel_name = channel?.name ?? null;
  e.availability.iptv = [{
    provider: "iptv-org", url: s.url, kind: "iptv", quality: s.quality ?? null,
    audio: [], subtitles: [], drm: null, is_official: false,
  }];
  e.technical.resolution = s.quality ?? null;
  e.technical.video_codec = s.codec ?? null;
  e.urls.stream = s.url;
  e.raw.iptv_org = s;
  if (channel) { e.title.display = channel.name; e.images.logo = channel.images.logo; e.iptv.country = channel.iptv.country; }
  return e;
}

export const iptv: Provider = {
  id: "iptv-org", name: "iptv-org", domains: ["live"], priority: 5,
  kinds: ["iptv_channel", "iptv_stream", "sports_event", "tv_show"],
  operations: ["search", "get", "streams", "discover", "epg", "calendar"],
  auth: "none", base: BASE, license: "CC0 index; stream rights vary",
  freshness: "6h snapshots", homepage: "https://iptv-org.github.io",
  notes: "Global channel + stream + EPG directory. 10k+ channels, 100+ countries.",
  async search(ctx, q) {
    const res = await fetchJson<any>(`${BASE}/channels.json`, { provider: "iptv-org", ttlMs: TTL, staleMs: 7 * 86_400_000 });
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    return (res.data ?? []).filter((c: any) => {
      const hay = `${c.name} ${(c.alt_names ?? []).join(" ")} ${c.country ?? ""} ${(c.categories ?? []).join(" ")}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    }).slice(0, ctx.limit).map(mapChannel);
  },
  async get(ctx, ref) {
    const res = await fetchJson<any>(`${BASE}/channels.json`, { provider: "iptv-org", ttlMs: TTL, staleMs: 7 * 86_400_000 });
    const c = (res.data ?? []).find((x: any) => x.id === (ref.externalIds?.iptv_org ?? ref.id) || x.name === ref.id);
    return c ? mapChannel(c) : null;
  },
  async streams(ctx, id) {
    const [channels, streams] = await Promise.all([
      fetchJson<any>(`${BASE}/channels.json`, { provider: "iptv-org", ttlMs: TTL, staleMs: 7 * 86_400_000 }),
      fetchJson<any>(`${BASE}/streams.json`, { provider: "iptv-org", ttlMs: TTL, staleMs: 7 * 86_400_000 }),
    ]);
    const channel = (channels.data ?? []).find((c: any) => c.id === id || c.name === id);
    return (streams.data ?? []).filter((s: any) => s.channel === id).map((s: any) => mapStream(s, channel ? mapChannel(channel) : undefined));
  },
  async discover(ctx, p) {
    const res = await fetchJson<any>(`${BASE}/channels.json`, { provider: "iptv-org", ttlMs: TTL, staleMs: 7 * 86_400_000 });
    return (res.data ?? []).filter((c: any) =>
      (!p.country || c.country === p.country) &&
      (!p.genre || (c.categories ?? []).includes(p.genre)) &&
      !c.closed,
    ).slice(0, ctx.limit).map(mapChannel);
  },
  async epg(ctx, params) {
    const res = await fetchJson<any>(`${BASE}/guides.json`, { provider: "iptv-org", ttlMs: TTL, staleMs: 30 * 86_400_000 });
    return (res.data ?? []).filter((g: any) => !params.country || g.country === params.country).slice(0, ctx.limit).map((g: any) => {
      const e = baseEntity("schedule_entry", `${g.site} EPG`, "iptv-org", g.url);
      e.iptv.country = g.country;
      e.iptv.epg_ids = [g.site];
      e.urls.epg = g.url ?? "";
      return e;
    });
  },
  async calendar(ctx, p) {
    const res = await fetchJson<any>(`${BASE}/channels.json`, { provider: "iptv-org", ttlMs: TTL, staleMs: 7 * 86_400_000 });
    return (res.data ?? []).filter((c: any) => (c.categories ?? []).includes("sports")).slice(0, ctx.limit).map(mapChannel);
  },
};
export default iptv;
