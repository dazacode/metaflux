import { fetchJson } from "../core/http.ts";
import type { Entity } from "../schema/entities.ts";
import { addId, baseEntity, dateParts, list, str } from "./_util.ts";
import type { Provider } from "./_types.ts";

const BASE = "https://musicbrainz.org/ws/2";
const HEADERS = { "user-agent": "MetaFlux/0.1 (https://github.com/dazacode/metaflux)" };

function mapArtist(a: any): Entity {
  const e = baseEntity(a.type === "Group" ? "music_group" : "music_artist", a.name, "musicbrainz", a.id ? `https://musicbrainz.org/artist/${a.id}` : undefined);
  addId(e, "musicbrainz", a.id);
  e.title.aliases = (a.aliases ?? []).map((x: any) => x.name);
  e.title.sort = a["sort-name"] ?? null;
  e.person.gender = a.gender ?? null;
  e.person.nationality = a.country ? [a.country] : [];
  e.person.birthplace = a["begin-area"]?.name ?? null;
  e.person.birthday = a["life-span"]?.begin ?? null;
  e.person.deathday = a["life-span"]?.end ?? null;
  e.person.occupations = ["musician"];
  e.person.instruments = (a.relations ?? []).filter((r: any) => r.type === "instrument").map((r: any) => r.instrument?.name).filter(Boolean);
  e.person.is_group = a.type === "Group" || null;
  e.person.genres = a.genres?.map((g: any) => g.name) ?? [];
  e.person.member_count = (a.relations ?? []).filter((r: any) => r.type === "member of band" && r.direction === "backward").length || null;
  for (const r of a.relations ?? []) {
    if (r.type === "member of band") {
      const t = r.artist;
      if (!t) continue;
      const edge = { kind: "member" as const, target_id: `musicbrainz:${t.id}`, title: t.name, direction: r.direction === "backward" ? "incoming" as const : "outgoing" as const, sources: [] };
      if (r.ended) e.person.former_member_of.push(edge); else e.person.member_of.push(edge);
    }
    if (r.type === "label" && r.direction === "forward" && r.label) e.companies.labels.push({ id: r.label.id, name: r.label.name, kind: "label", external_ids: { musicbrainz: [r.label.id] } });
    if (r.type === "band" || r.type === "subgroup") e.person.subunit_of.push({ kind: "subgroup", target_id: `musicbrainz:${r.artist?.id}`, title: r.artist?.name, direction: "outgoing", sources: [] });
    if (r.url?.resource) e.links.push({ url: r.url.resource, site: r.type, kind: "social" });
  }
  for (const tag of a.tags ?? []) e.classification.tags.push({ name: tag.name, rank: tag.count });
  e.dates.start = dateParts(a["life-span"]?.begin) ?? null;
  e.person.years_active = a["life-span"]?.begin ? `${a["life-span"].begin.slice(0, 4)}–${a["life-span"]?.ended ? a["life-span"].end?.slice(0, 4) : ""}` : null;
  e.classification.genres = a.genres?.map((g: any) => g.name) ?? [];
  e.classification.themes = [];
  e.raw.musicbrainz = a;
  e.score = (a.score ?? 0) + (a.rating?.value ?? 0);
  return e;
}

function mapReleaseGroup(r: any): Entity {
  const e = baseEntity("music_album", r.title, "musicbrainz", `https://musicbrainz.org/release-group/${r.id}`);
  addId(e, "musicbrainz", r.id);
  e.music.release_type = r["primary-type"] ?? null;
  e.music.release_status = r["secondary-types"]?.join(", ") ?? null;
  e.dates.release = dateParts(r["first-release-date"]) ?? null;
  e.music.artist = (r["artist-credit"] ?? []).map((c: any) => ({ id: c.artist?.id, name: c.artist?.name, kind: "music_artist" as const, external_ids: c.artist?.id ? { musicbrainz: [c.artist.id] } : {} }));
  e.classification.genres = r.genres?.map((g: any) => g.name) ?? [];
  e.metrics.score = r.rating?.value ?? null;
  e.score = r.rating?.value ?? 0;
  return e;
}

export const musicbrainz: Provider = {
  id: "musicbrainz", name: "MusicBrainz", domains: ["music"], priority: 9,
  kinds: ["music_artist", "music_group", "music_album", "music_track", "music_video", "concert", "person"],
  operations: ["search", "get", "resolve", "related", "events", "people"],
  auth: "none-header", base: BASE, license: "CC0 core data; some CC BY-NC-SA",
  freshness: "24h", homepage: "https://musicbrainz.org",
  notes: "Artist/release/recording/event graph with relations, members, labels. 1 rps, descriptive UA required.",
  async search(ctx, q) {
    const [artists, groups] = await Promise.all([
      fetchJson<any>(`${BASE}/artist?query=${encodeURIComponent(q)}&fmt=json&limit=${Math.min(ctx.limit, 15)}`, { provider: "musicbrainz", headers: HEADERS, ttlMs: 86_400_000 }).catch(() => null),
      fetchJson<any>(`${BASE}/release-group?query=${encodeURIComponent(q)}&fmt=json&limit=${Math.min(ctx.limit, 15)}`, { provider: "musicbrainz", headers: HEADERS, ttlMs: 86_400_000 }).catch(() => null),
    ]);
    return [...(artists?.data?.artists ?? []).map(mapArtist), ...(groups?.data?.["release-groups"] ?? []).map(mapReleaseGroup)].slice(0, ctx.limit);
  },
  async get(ctx, ref) {
    const mbid = ref.externalIds?.musicbrainz ?? ref.id;
    const kind = ref.kind ?? "music_artist";
    const path = kind === "music_album" ? "release-group" : kind === "music_track" ? "recording" : kind === "concert" ? "event" : "artist";
    const inc = path === "artist" ? "aliases+tags+genres+url-rels+artist-rels+release-groups" : path === "release-group" ? "artist-credits+genres+ratings+url-rels" : "artist-credits+genres+ratings+url-rels";
    const res = await fetchJson<any>(`${BASE}/${path}/${mbid}?inc=${inc}&fmt=json`, { provider: "musicbrainz", headers: HEADERS, ttlMs: 86_400_000, allowStatus: [404] });
    if (!res.data?.id) return null;
    return path === "artist" ? mapArtist(res.data) : path === "release-group" ? mapReleaseGroup(res.data) : mapArtist(res.data);
  },
  async resolve(ctx, ids) {
    return ids.musicbrainz ? this.get!(ctx, { id: ids.musicbrainz }) : null;
  },
  async related(ctx, id) {
    const e = await this.get!(ctx, { id, kind: "music_artist" });
    return [];
  },
  async events(ctx, params) {
    const res = await fetchJson<any>(`${BASE}/event?query=${encodeURIComponent(params.q ?? "concert")}&fmt=json&limit=${Math.min(ctx.limit, 20)}`, { provider: "musicbrainz", headers: HEADERS, ttlMs: 86_400_000 });
    return (res.data?.events ?? []).map((ev: any) => {
      const e = baseEntity("concert", ev.name, "musicbrainz", `https://musicbrainz.org/event/${ev.id}`);
      addId(e, "musicbrainz", ev.id);
      e.dates.start = ev["life-span"]?.begin ? { date: ev["life-span"].begin } : null;
      e.event.event_type = ev.type;
      e.event.city = ev.venue?.city?.name ?? null;
      e.event.country = ev.venue?.city?.country ?? null;
      e.event.venue = ev.venue ? { id: ev.venue.id, name: ev.venue.name, kind: "company", external_ids: { musicbrainz: [ev.venue.id] } } : null;
      e.event.setlist = (ev["setlist"] ?? []).map((s: any, i: number) => ({ order: i + 1, title: s.name ?? "Untitled" }));
      e.raw.musicbrainz = ev;
      return e;
    });
  },
  async people(ctx, id) {
    const e = await this.get!(ctx, { id, kind: "music_artist" });
    return e ? [e] : [];
  },
};
export default musicbrainz;
void str;
