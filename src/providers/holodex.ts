import { fetchJson } from "../core/http.ts";
import type { Entity } from "../schema/entities.ts";
import { addId, baseEntity, list, tag } from "./_util.ts";
import type { Provider } from "./_types.ts";

const BASE = "https://holodex.net/api/v2";
const HEADERS = { origin: "https://holodex.net", referer: "https://holodex.net/" };

function mapChannel(c: any): Entity {
  const e = baseEntity("vtuber", c.english_name || c.name, "holodex", `https://holodex.net/channel/${c.id}`);
  addId(e, "holodex", c.id);
  addId(e, "youtube", c.id);
  e.title.native = c.name ?? null;
  e.title.english = c.english_name || null;
  e.images.profile = [c.photo].filter(Boolean);
  e.vtuber.org = c.org ?? null;
  e.vtuber.suborg = c.suborg ?? null;
  e.vtuber.group = c.group ?? null;
  e.vtuber.is_independent = !c.org || null;
  e.vtuber.is_graduated = c.inactive ?? null;
  e.vtuber.is_affiliated = !!c.org;
  e.vtuber.languages = list(c.language);
  e.vtuber.content_topics = list(c.top_topics);
  e.vtuber.youtube = { channel_id: c.id, subscribers: c.subscriber_count ?? null, videos: c.video_count ?? null, clips: c.clip_count ?? null };
  e.vtuber.twitter = c.twitter ?? null;
  e.vtuber.twitch = c.twitch ? { login: c.twitch } : null;
  e.person.socials = Object.fromEntries(Object.entries({ twitter: c.twitter, twitch: c.twitch }).filter(([, v]) => v) as [string, string][]);
  e.person.occupations = ["vtuber", "streamer"];
  e.classification.genres = ["vtuber"];
  e.raw.holodex = c;
  e.score = (c.subscriber_count ?? 0) / 100_000;
  tag(e, `org:${c.org ?? "independent"}`);
  return e;
}

function mapVideo(v: any): Entity {
  const e = baseEntity(v.status === "live" ? "vtuber" : "music_video", v.title, "holodex", `https://youtu.be/${v.id}`);
  addId(e, "holodex", v.id);
  addId(e, "youtube", v.id);
  e.images.thumbnail = [v.thumbnail ?? `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`];
  e.dates.start = v.available_at ? { date: v.available_at, precision: "second" } : v.start_scheduled ? { date: v.start_scheduled } : null;
  e.live.is_live = v.status === "live";
  e.live.viewers = v.live_viewers ?? null;
  e.live.started_at = v.start_actual ?? null;
  e.live.scheduled_start = v.start_scheduled ?? null;
  e.live.topic = v.topic_id ?? null;
  e.status.state = v.status === "live" ? "live" : v.status === "upcoming" ? "scheduled" : "finished";
  e.technical.runtime_minutes = v.duration ? Math.round(v.duration / 60) : null;
  if (v.channel) {
    e.vtuber.org = v.channel.org ?? null;
    e.credits.push({ person: { id: v.channel.id, name: v.channel.name, kind: "person", image: v.channel.photo ?? null, external_ids: { holodex: [v.channel.id], youtube: [v.channel.id] } }, role: "channel", voice: true, department: "cast", sources: [] });
    e.broadcast.network = v.channel.org ? { name: v.channel.org, kind: "company" } : null;
  }
  e.links.push({ url: `https://youtu.be/${v.id}`, site: "YouTube", kind: "video" });
  e.raw.holodex = v;
  e.score = (v.live_viewers ?? 0) / 100;
  return e;
}

export const holodex: Provider = {
  id: "holodex", name: "Holodex", domains: ["people", "live"], priority: 7,
  kinds: ["vtuber", "vtuber_group", "music_video", "person"],
  operations: ["search", "get", "live", "trending", "people", "schedule", "related"],
  auth: "none-header", base: BASE, license: "Holodex API; channel data from YouTube",
  freshness: "15s live / 5m channel", homepage: "https://holodex.net",
  notes: "VTuber orgs, live streams, channels, clips, collabs. Browser Origin/Referer unlocks keyless access.",
  async search(ctx, q) {
    const res = await fetchJson<any>(`${BASE}/channels?limit=100&sort=subscriber_count&order=desc`, { provider: "holodex", headers: HEADERS, ttlMs: 300_000 });
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    return (res.data ?? []).filter((c: any) => {
      const hay = `${c.name} ${c.english_name ?? ""} ${c.org ?? ""} ${c.group ?? ""}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    }).slice(0, ctx.limit).map(mapChannel);
  },
  async get(ctx, ref) {
    const id = ref.externalIds?.holodex ?? ref.externalIds?.youtube ?? ref.id;
    const res = await fetchJson<any>(`${BASE}/channels/${id}`, { provider: "holodex", headers: HEADERS, ttlMs: 300_000, allowStatus: [404] });
    return res.data?.id ? mapChannel(res.data) : null;
  },
  async live(ctx) {
    const res = await fetchJson<any>(`${BASE}/live?limit=${Math.min(ctx.limit, 50)}`, { provider: "holodex", headers: HEADERS, ttlMs: 15_000 });
    return (res.data ?? []).map(mapVideo);
  },
  async trending(ctx) {
    const res = await fetchJson<any>(`${BASE}/videos?limit=${Math.min(ctx.limit, 30)}&sort=live_viewers&order=desc`, { provider: "holodex", headers: HEADERS, ttlMs: 60_000 }).catch(() => null);
    return (res?.data ?? []).map(mapVideo);
  },
  async people(ctx, id) {
    const res = await fetchJson<any>(`${BASE}/channels/${id}/videos?limit=${Math.min(ctx.limit, 25)}`, { provider: "holodex", headers: HEADERS, ttlMs: 300_000 }).catch(() => null);
    return (res?.data ?? []).map(mapVideo);
  },
  async schedule(ctx, p) {
    const res = await fetchJson<any>(`${BASE}/videos?limit=${Math.min(ctx.limit, 50)}&sort=available_at&order=asc`, { provider: "holodex", headers: HEADERS, ttlMs: 60_000 }).catch(() => null);
    return (res?.data ?? []).filter((v: any) => v.available_at >= p.from && v.available_at <= p.to).map(mapVideo);
  },
  async related(ctx, id) {
    const res = await fetchJson<any>(`${BASE}/channels/${id}/clips?limit=${Math.min(ctx.limit, 20)}`, { provider: "holodex", headers: HEADERS, ttlMs: 300_000 }).catch(() => null);
    return (res?.data ?? []).map((c: any) => {
      const e = baseEntity("music_video", c.title, "holodex", `https://youtu.be/${c.id}`);
      addId(e, "youtube", c.id);
      e.images.thumbnail = [c.thumbnail ?? `https://i.ytimg.com/vi/${c.id}/hqdefault.jpg`];
      e.metrics.views = c.view_count ?? null;
      return e;
    });
  },
};
export default holodex;
