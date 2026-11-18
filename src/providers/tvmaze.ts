import { fetchJson } from "../core/http.ts";
import type { Entity, Kind } from "../schema/entities.ts";
import { addId, baseEntity, dateParts, list, src, stripHtml, tag } from "./_util.ts";
import type { Provider } from "./_types.ts";

const BASE = "https://api.tvmaze.com";
const KIND: Record<string, Kind> = {
  Scripted: "tv_show", Documentary: "tv_show", Reality: "tv_show", Talk: "tv_show",
  News: "tv_show", Sports: "sports_event", Children: "tv_show", Animation: "tv_show",
  Award: "award_show", Panel: "tv_show", Game: "tv_show",
};

function person(p: any) {
  if (!p) return null;
  return { id: `tvmaze_person_${p.id}`, name: p.name, kind: "person" as const, image: p.image?.medium ?? null,
    url: p.url ?? null, external_ids: p.externals ? Object.fromEntries(Object.entries(p.externals).filter(([, v]) => v).map(([k, v]) => [k, [String(v)]])) : {} };
}

function map(s: any): Entity {
  const e = baseEntity(KIND[s.type] ?? "tv_show", s.name, "tvmaze", s.url);
  addId(e, "tvmaze", String(s.id));
  if (s.externals?.imdb) addId(e, "imdb", s.externals.imdb);
  if (s.externals?.thetvdb) addId(e, "tvdb", String(s.externals.thetvdb));
  if (s.externals?.tvrage) addId(e, "tvrage", String(s.externals.tvrage));
  e.title.english = s.name;
  e.description.short = { en: stripHtml(s.summary) };
  e.description.long = { en: stripHtml(s.summary) };
  e.images.poster = [s.image?.original, s.image?.medium].filter(Boolean);
  e.dates.premiere = dateParts(s.premiered) ?? null;
  e.dates.end = dateParts(s.ended) ?? null;
  e.status.state = s.status === "Running" ? "airing" : s.status === "Ended" ? "ended" : s.status === "To Be Determined" ? "announced" : "unknown";
  e.classification.genres = s.genres ?? [];
  e.classification.content_rating = s.rating?.average ? `TV-${s.rating.average}` : null;
  e.metrics.score = s.rating?.average ?? null;
  e.metrics.score_scale = 10;
  e.metrics.popularity = s.weight ?? null;
  e.technical.runtime_minutes = s.runtime ?? s.averageRuntime ?? null;
  e.broadcast.network = s.network ? { name: s.network.name, kind: "network", country: s.network.country?.code ?? null, url: s.network.officialSite ?? null } : null;
  e.broadcast.web_channel = s.webChannel ? { name: s.webChannel.name, kind: "network", country: s.webChannel.country?.code ?? null } : null;
  e.broadcast.country = s.network?.country?.code ?? null;
  e.broadcast.timezone = s.network?.country?.timezone ?? null;
  e.broadcast.time = s.schedule?.time ?? null;
  e.broadcast.days = s.schedule?.days ?? [];
  e.broadcast.schedule = (s.schedule?.days ?? []).map((d: string) => ({ day: d, time: s.schedule?.time ?? null, timezone: s.network?.country?.timezone ?? null }));
  if (s.officialSite) e.urls.official = s.officialSite;
  for (const ep of s._embedded?.episodes ?? []) {
    e.episodes.push({
      id: String(ep.id), season: ep.season, number: ep.number, title: ep.name,
      description: ep.summary ? { en: stripHtml(ep.summary) } : {},
      air_date: ep.airdate, air_time: ep.airtime, runtime: ep.runtime,
      image: ep.image?.original ?? null, rating: ep.rating?.average ?? null, kind: "regular",
      sources: [src("tvmaze", ep.url)],
    });
  }
  for (const c of s._embedded?.cast ?? []) {
    e.credits.push({ person: person(c.person)!, character: c.character ? { name: c.character.name, kind: "character", image: c.character.image?.medium ?? null, url: c.character.url } : null, voice: c.voice ?? false, role: "cast", sources: [src("tvmaze", c.self)] });
  }
  for (const c of s._embedded?.crew ?? []) {
    e.credits.push({ person: person(c.person)!, role: c.type, job: c.type, department: "crew", voice: false, sources: [] });
  }
  for (const i of s._embedded?.images ?? []) {
    if (["poster", "background", "banner", "typography", "logo"].includes(i.type)) ((e.images as any)[i.type] ??= []).push(i.resolutions?.original?.url ?? i.url);
    else e.images.screenshots.push(i.resolutions?.original?.url ?? i.url);
  }
  for (const aka of s._embedded?.akas ?? []) e.title.aliases.push(aka.name);
  e.raw.tvmaze = s;
  tag(e, `type:${s.type}`);
  e.score = (s.weight ?? 0) / 10 + (s.rating?.average ?? 0);
  return e;
}

export const tvmaze: Provider = {
  id: "tvmaze", name: "TVmaze", domains: ["screen"], priority: 20,
  kinds: ["tv_show", "tv_episode", "tv_special", "award_show", "person"],
  operations: ["search", "get", "schedule", "episodes", "people", "related"],
  auth: "none", base: BASE, license: "TVmaze CC BY-SA 4.0",
  freshness: "1h; ETag aware", homepage: "https://www.tvmaze.com",
  notes: "Broadcast schedule, episode guide, cast/crew. 20 calls / 10 s.",
  async search(ctx, q) {
    const res = await fetchJson<any>(`${BASE}/search/shows?q=${encodeURIComponent(q)}`, { provider: "tvmaze", ttlMs: 3600_000 });
    return (res.data ?? []).map((r: any) => map(r.show));
  },
  async get(ctx, ref) {
    const ext = ref.externalIds?.tvmaze ?? (ref.externalIds?.imdb ? null : ref.id);
    if (ext) {
      const res = await fetchJson<any>(`${BASE}/shows/${ext}?embed[]=episodes&embed[]=cast&embed[]=crew&embed[]=images&embed[]=akas`, { provider: "tvmaze", ttlMs: 3600_000 });
      return map(res.data);
    }
    const imdb = ref.externalIds!.imdb;
    const look = await fetchJson<any>(`${BASE}/lookup/shows?imdb=${encodeURIComponent(imdb)}`, { provider: "tvmaze", ttlMs: 86_400_000 });
    return look.data?.id ? map(look.data) : null;
  },
  async schedule(ctx, p) {
    const out: Entity[] = [];
    let day = new Date(p.from);
    const end = new Date(p.to);
    while (day <= end && out.length < ctx.limit) {
      const date = day.toISOString().slice(0, 10);
      const res = await fetchJson<any>(`${BASE}/schedule?date=${date}${p.region ? `&country=${p.region}` : ""}`, { provider: "tvmaze", ttlMs: 3600_000 }).catch(() => null);
      for (const item of res?.data ?? []) {
        const e = map(item.show);
        e.kind = "tv_episode";
        e.name = `${item.show.name} ${item.name}`;
        e.episodes = [{ id: String(item.id), season: item.season, number: item.number, title: item.name, air_date: item.airdate, air_time: item.airtime, kind: "regular" }];
        out.push(e);
      }
      day = new Date(day.getTime() + 86_400_000);
    }
    return out.slice(0, ctx.limit);
  },
  async episodes(ctx, id) {
    const res = await fetchJson<any>(`${BASE}/shows/${id}/episodes`, { provider: "tvmaze", ttlMs: 3600_000 });
    return (res.data ?? []).map((ep: any) => {
      const e = baseEntity("tv_episode", ep.name, "tvmaze", ep.url);
      addId(e, "tvmaze", String(ep.id));
      e.episodes = [{ id: String(ep.id), season: ep.season, number: ep.number, title: ep.name, air_date: ep.airdate, air_time: ep.airtime, runtime: ep.runtime, sources: [src("tvmaze", ep.url)] }];
      return e;
    });
  },
  async people(ctx, id) {
    const res = await fetchJson<any>(`${BASE}/shows/${id}/cast`, { provider: "tvmaze", ttlMs: 3600_000 });
    return (res.data ?? []).map((c: any) => {
      const p = person(c.person)!;
      const e = baseEntity("person", p.name, "tvmaze", p.url ?? undefined);
      e.person.occupations = ["actor"];
      e.images.profile = p.image ? [p.image] : [];
      return e;
    });
  },
};

export default tvmaze;
void list;
