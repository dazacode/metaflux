import { fetchJson } from "../core/http.ts";
import type { Entity } from "../schema/entities.ts";
import { addId, baseEntity, dateParts, str, tag } from "./_util.ts";
import type { Provider } from "./_types.ts";

const BASE = "https://www.thesportsdb.com/api/v1/json/123";

function mapTeam(t: any): Entity {
  const e = baseEntity("sports_team", t.strTeam, "thesportsdb", t.strWebsite || undefined);
  addId(e, "thesportsdb", t.idTeam);
  if (t.idESPN) addId(e, "espn", t.idESPN);
  e.title.aliases = [t.strTeamAlternate, t.strTeamShort, t.strKeywords].filter(Boolean).flatMap((x: string) => x.split(","));
  e.description.long = { en: t.strDescriptionEN ?? "" };
  e.images.logo = [t.strBadge, t.strLogo].filter(Boolean);
  e.images.banner = [t.strBanner].filter(Boolean);
  e.images.fanart = [t.strFanart1, t.strFanart2, t.strFanart3, t.strFanart4].filter(Boolean);
  e.images.color = [t.strColour1, t.strColour2, t.strColour3].filter(Boolean);
  e.sports.sport = t.strSport;
  e.sports.league = t.idLeague ? { id: t.idLeague, name: t.strLeague, kind: "company" } : null;
  e.sports.venue = t.strStadium ? { name: t.strStadium, kind: "company" } : null;
  e.sports.city = t.strLocation;
  e.broadcast.country = t.strCountry;
  e.dates.founded = dateParts(t.intFormedYear) ?? null;
  e.urls.official = t.strWebsite || null;
  e.person.gender = t.strGender;
  e.links.push(...[["facebook", t.strFacebook], ["twitter", t.strTwitter], ["instagram", t.strInstagram], ["youtube", t.strYoutube]].filter(([, v]) => v).map(([k, v]) => ({ url: v as string, site: k as string, kind: "social" })));
  e.raw.thesportsdb = t;
  e.score = (Number(t.intLoved) || 0) / 10;
  return e;
}

function mapPlayer(p: any): Entity {
  const e = baseEntity("sports_player", p.strPlayer, "thesportsdb");
  addId(e, "thesportsdb", p.idPlayer);
  e.person.birthday = p.dateBorn ?? null;
  e.person.birthplace = p.strBirthLocation ?? null;
  e.person.height_cm = p.strHeight ? Math.round(parseFloat(p.strHeight) * 2.54) : null;
  e.person.weight_kg = p.strWeight ? Math.round(parseFloat(p.strWeight) * 0.4536) : null;
  e.person.gender = p.strGender;
  e.images.profile = [p.strThumb, p.strCutout, p.strRender].filter(Boolean);
  e.sports.sport = p.strSport;
  e.sports.league = p.idLeague ? { id: p.idLeague, name: p.strLeague, kind: "company" } : null;
  e.sports.home_team = p.strTeam ? { id: p.idTeam, name: p.strTeam, kind: "sports_team" } : null;
  e.description.long = { en: p.strDescriptionEN ?? "" };
  e.raw.thesportsdb = p;
  return e;
}

function mapEvent(ev: any): Entity {
  const e = baseEntity("sports_event", ev.strEvent, "thesportsdb");
  addId(e, "thesportsdb", ev.idEvent);
  e.dates.start = ev.strTimestamp ? { date: ev.strTimestamp, precision: "second" } : dateParts(ev.dateEvent) ?? null;
  e.status.state = ev.strStatus === "FT" || ev.strStatus === "Match Finished" ? "finished" : ev.strProgress ? "live" : "scheduled";
  e.sports.sport = ev.strSport;
  e.sports.league = ev.idLeague ? { id: ev.idLeague, name: ev.strLeague, kind: "company" } : null;
  e.sports.season = ev.strSeason ?? null;
  e.sports.round = ev.intRound ? String(ev.intRound) : null;
  e.sports.home_team = ev.idHomeTeam ? { id: ev.idHomeTeam, name: ev.strHomeTeam, kind: "sports_team" } : null;
  e.sports.away_team = ev.idAwayTeam ? { id: ev.idAwayTeam, name: ev.strAwayTeam, kind: "sports_team" } : null;
  e.sports.home_score = ev.intHomeScore != null ? Number(ev.intHomeScore) : null;
  e.sports.away_score = ev.intAwayScore != null ? Number(ev.intAwayScore) : null;
  e.sports.venue = ev.strVenue ? { name: ev.strVenue, kind: "company" } : null;
  e.sports.city = ev.strCity ?? null;
  e.sports.country = ev.strCountry ?? null;
  e.sports.attendance = Number(ev.intSpectators) || null;
  e.sports.officials = ev.strOfficial ? [{ name: ev.strOfficial, kind: "person" as const }] : [];
  e.images.thumbnail = [ev.strThumb, ev.strBanner].filter(Boolean);
  e.technical.audio_languages = ev.strTVStation ? [ev.strTVStation] : [];
  e.sports.broadcast = ev.strTVStation ? [ev.strTVStation] : [];
  e.links.push(...[["video", ev.strVideo], ["highlights", ev.strHighlights]].filter(([, v]) => v).map(([k, v]) => ({ url: v as string, site: k as string, kind: "media" })));
  e.raw.thesportsdb = ev;
  e.status.is_live = e.status.state === "live";
  e.score = e.status.is_live ? 100 : 0;
  return e;
}

export const thesportsdb: Provider = {
  id: "thesportsdb", name: "TheSportsDB", domains: ["sports"], priority: 24,
  kinds: ["sports_team", "sports_player", "sports_event", "sports_league", "sports_venue"],
  operations: ["search", "get", "schedule", "standings", "events"],
  auth: "none", base: "https://www.thesportsdb.com/api/v1/json/{key}", license: "TheSportsDB free tier",
  freshness: "5min events / 24h static", homepage: "https://www.thesportsdb.com",
  notes: "Multi-language team bios, badges, colours, players, league tables, TV broadcasts.",
  async search(ctx, q) {
    const [teams, players] = await Promise.all([
      fetchJson<any>(`${BASE}/searchteams.php?t=${encodeURIComponent(q)}`, { provider: "thesportsdb", ttlMs: 86_400_000 }).catch(() => null),
      fetchJson<any>(`${BASE}/searchplayers.php?p=${encodeURIComponent(q)}`, { provider: "thesportsdb", ttlMs: 86_400_000 }).catch(() => null),
    ]);
    return [...(teams?.data?.teams ?? []).map(mapTeam), ...(players?.data?.player ?? []).map(mapPlayer)].slice(0, ctx.limit);
  },
  async get(ctx, ref) {
    const id = ref.externalIds?.thesportsdb ?? ref.id;
    if (ref.kind === "sports_player") {
      const res = await fetchJson<any>(`${BASE}/lookupplayer.php?id=${id}`, { provider: "thesportsdb", ttlMs: 86_400_000, allowStatus: [404] });
      return res.data?.players?.[0] ? mapPlayer(res.data.players[0]) : null;
    }
    const res = await fetchJson<any>(`${BASE}/lookupteam.php?id=${id}`, { provider: "thesportsdb", ttlMs: 86_400_000, allowStatus: [404] });
    return res.data?.teams?.[0] ? mapTeam(res.data.teams[0]) : null;
  },
  async schedule(ctx, p) {
    const date = p.from.slice(0, 10);
    const leagues = ["English Premier League", "NBA", "NFL", "MLB", "NHL"];
    const out: Entity[] = [];
    for (const league of leagues) {
      const res = await fetchJson<any>(`${BASE}/eventsday.php?d=${date}&l=${encodeURIComponent(league)}`, { provider: "thesportsdb", ttlMs: 300_000 }).catch(() => null);
      for (const ev of res?.data?.events ?? []) out.push(mapEvent(ev));
    }
    return out.slice(0, ctx.limit);
  },
  async standings(ctx, league) {
    const res = await fetchJson<any>(`${BASE}/lookuptable.php?l=${encodeURIComponent(league)}&s=2025-2026`, { provider: "thesportsdb", ttlMs: 300_000 }).catch(() => null);
    return (res?.data?.table ?? []).map((row: any) => {
      const e = baseEntity("sports_team", row.strTeam, "thesportsdb");
      addId(e, "thesportsdb", row.idTeam);
      e.sports.league = { id: row.idLeague, name: row.strLeague, kind: "company" };
      e.sports.standings = { rank: Number(row.intRank), wins: Number(row.intWin), losses: Number(row.intLoss), ties: Number(row.intDraw), points: Number(row.intPoints), pct: null, games_played: Number(row.intPlayed), streak: row.strForm ?? null, form: row.strForm ?? null, home: {}, away: {} };
      e.images.logo = [row.strTeamBadge].filter(Boolean);
      return e;
    });
  },
  async events(ctx, params) {
    const res = await fetchJson<any>(`${BASE}/eventsday.php?d=${params.date}&s=${encodeURIComponent(params.sport ?? "Soccer")}`, { provider: "thesportsdb", ttlMs: 300_000 });
    return (res.data?.events ?? []).map(mapEvent);
  },
};
export default thesportsdb;
void str; void tag;
