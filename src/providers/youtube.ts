import { fetchText } from "../core/http.ts";
import type { Entity } from "../schema/entities.ts";
import { addId, baseEntity, decodeEntities, stripHtml } from "./_util.ts";
import type { Provider } from "./_types.ts";

const BASE = "https://www.youtube.com/feeds/videos.xml";

function parse(xml: string): Entity[] {
  const out: Entity[] = [];
  const entries = xml.split("<entry>").slice(1);
  const channelName = decodeEntities(xml.match(/<title>([^<]*)<\/title>/)?.[1] ?? "Channel");
  const channelId = xml.match(/<yt:channelId>([^<]+)</)?.[1];
  for (const entry of entries) {
    const id = entry.match(/<yt:videoId>([^<]+)</)?.[1];
    if (!id) continue;
    const e = baseEntity("music_video", decodeEntities(entry.match(/<title>([^<]*)<\/title>/)?.[1] ?? "Video"), "youtube", `https://youtu.be/${id}`);
    addId(e, "youtube", id);
    if (channelId) addId(e, "youtube_channel", channelId);
    e.images.thumbnail = [entry.match(/<media:thumbnail url="([^"]+)"/)?.[1]].filter(Boolean) as string[];
    e.dates.start = entry.match(/<published>([^<]+)</)?.[1] ? { date: entry.match(/<published>([^<]+)</)![1], precision: "second" } : null;
    e.metrics.views = Number(entry.match(/<media:statistics views="(\d+)"/)?.[1]) || null;
    e.metrics.score = Number(entry.match(/<media:starRating average="([\d.]+)"/)?.[1]) || null;
    e.description.long = { en: stripHtml(entry.match(/<media:description>([\s\S]*?)<\/media:description>/)?.[1] ?? "") };
    e.credits.push({ person: { id: channelId, name: channelName, kind: "person", external_ids: channelId ? { youtube: [channelId] } : {} }, role: "channel", voice: true, department: "cast", sources: [] });
    e.links.push({ url: `https://youtu.be/${id}`, site: "YouTube", kind: "video" });
    out.push(e);
  }
  return out;
}

export const youtubeRss: Provider = {
  id: "youtube-rss", name: "YouTube channel RSS", domains: ["people", "live"], priority: 42,
  kinds: ["vtuber", "music_video", "tv_show", "podcast"],
  operations: ["people", "live"],
  auth: "none", base: BASE, license: "YouTube feed data",
  freshness: "15min", homepage: "https://www.youtube.com",
  notes: "Latest uploads for a channel without an API key. Requires a channel id.",
  async people(ctx, id) {
    const res = await fetchText(`${BASE}?channel_id=${encodeURIComponent(id)}`, { provider: "youtube-rss", ttlMs: 900_000 });
    return parse(res.data).slice(0, ctx.limit);
  },
  async live(ctx, kind) {
    return [];
  },
};
export default youtubeRss;
