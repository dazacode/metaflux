import { fetchJson } from "../core/http.ts";
import type { Entity, Kind } from "../schema/entities.ts";
import { addId, baseEntity, str, tag } from "./_util.ts";
import type { Provider } from "./_types.ts";

const SITE = "https://site.api.espn.com/apis/site/v2/sports";
const CORE = "https://sports.core.api.espn.com/v2/sports";
const H = { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36", accept: "application/json" };

/** Curated league table. `local` leagues make the API useful for "my city" queries. */
export const ESPN_LEAGUES: Record<string, { sport: string; name: string; country?: string }> = {
  "football/nfl": { sport: "football", name: "NFL", country: "US" },
  "football/college-football": { sport: "football", name: "NCAA Football", country: "US" },
  "basketball/nba": { sport: "basketball", name: "NBA", country: "US" },
  "basketball/wnba": { sport: "basketball", name: "WNBA", country: "US" },
  "basketball/mens-college-basketball": { sport: "basketball", name: "NCAA Men's Basketball", country: "US" },
  "baseball/mlb": { sport: "baseball", name: "MLB", country: "US" },
  "baseball/college-baseball": { sport: "baseball", name: "NCAA Baseball", country: "US" },
  "hockey/nhl": { sport: "hockey", name: "NHL", country: "US" },
  "soccer/eng.1": { sport: "soccer", name: "Premier League", country: "GB" },
  "soccer/esp.1": { sport: "soccer", name: "LaLiga", country: "ES" },
  "soccer/ita.1": { sport: "soccer", name: "Serie A", country: "IT" },
  "soccer/ger.1": { sport: "soccer", name: "Bundesliga", country: "DE" },
  "soccer/fra.1": { sport: "soccer", name: "Ligue 1", country: "FR" },
  "soccer/usa.1": { sport: "soccer", name: "MLS", country: "US" },
  "soccer/mex.1": { sport: "soccer", name: "Liga MX", country: "MX" },
  "soccer/bra.1": { sport: "soccer", name: "Brasileirão", country: "BR" },
  "soccer/jpn.1": { sport: "soccer", name: "J1 League", country: "JP" },
  "soccer/kor.1": { sport: "soccer", name: "K League 1", country: "KR" },
  "soccer/uefa.champions": { sport: "soccer", name: "UEFA Champions League", country: "EU" },
  "soccer/uefa.europa": { sport: "soccer", name: "UEFA Europa League", country: "EU" },
  "soccer/fifa.world": { sport: "soccer", name: "FIFA World Cup", country: "INT" },
  "racing/f1": { sport: "racing", name: "Formula 1", country: "INT" },
  "mma/ufc": { sport: "mma", name: "UFC", country: "INT" },
  "tennis/atp": { sport: "tennis", name: "ATP", country: "INT" },
  "tennis/wta": { sport: "tennis", name: "WTA", country: "INT" },
  "golf/pga": { sport: "golf", name: "PGA Tour", country: "US" },
  "cricket/8044": { sport: "cricket", name: "Cricket", country: "INT" },
};

function competitor(c: any) {
  const t = c.team ?? c.athlete ?? {};
  return {
    id: `espn_${t.id}`, name: t.displayName ?? t.fullName ?? t.shortDisplayName ?? "Unknown",
    kind: (c.athlete ? "person" : "sports_team"),
    image: t.logo ?? t.headshot?.href ?? null, url: t.links?.[0]?.href ?? null,
    country: t.country ?? null,
    external_ids: (t.id ? { espn: [String(t.id)] } : {}) as Record<string, string[]>,
  };
}

export function mapEvent(ev: any, leagueKey: string): Entity {
  const meta = ESPN_LEAGUES[leagueKey] ?? { sport: "unknown", name: leagueKey };
  const comp = ev.competitions?.[0] ?? {};
  const home = comp.competitors?.find((c: any) => c.homeAway === "home");
  const away = comp.competitors?.find((c: any) => c.homeAway === "away");
  const e = baseEntity("sports_event", ev.name ?? ev.shortName ?? "Event", "espn", ev.links?.[0]?.href);
  addId(e, "espn", String(ev.id));
  e.title.english = ev.shortName ?? ev.name;
  e.description.short = { en: ev.note ?? "" };
  e.dates.start = ev.date ? { date: ev.date, precision: "second" } : null;
  e.status.state = ev.status?.type?.state === "in" ? "live" : ev.status?.type?.completed ? "finished" : ev.status?.type?.state === "pre" ? "scheduled" : "unknown";
  e.status.is_live = e.status.state === "live";
  e.sports.sport = meta.sport;
  e.sports.league = { id: `espn_league_${leagueKey}`, name: meta.name, kind: "company", country: meta.country ?? null, external_ids: { espn_league: [leagueKey] } };
  e.sports.home_team = home ? competitor(home) : null;
  e.sports.away_team = away ? competitor(away) : null;
  e.sports.home_score = home?.score != null ? Number(home.score) : null;
  e.sports.away_score = away?.score != null ? Number(away.score) : null;
  e.sports.clock = ev.status?.displayClock ?? null;
  e.sports.period = ev.status?.period ?? null;
  e.sports.status_detail = ev.status?.type?.detail ?? null;
  e.sports.venue = comp.venue ? { id: `espn_venue_${comp.venue.id}`, name: comp.venue.fullName ?? "", kind: "company", url: null, country: comp.venue.address?.country ?? null, external_ids: { espn: [String(comp.venue.id)] } } : null;
  e.sports.attendance = comp.attendance ?? null;
  e.sports.broadcast = (comp.broadcasts ?? []).flatMap((b: any) => b.names ?? []);
  e.sports.tickets = (ev.links ?? []).filter((l: any) => /ticket/i.test(l.rel?.[0] ?? "")).map((l: any) => l.href);
  e.sports.odds = comp.odds?.[0] ? {
    provider: comp.odds[0].provider?.name, details: comp.odds[0].details,
    spread: comp.odds[0].spread, over_under: comp.odds[0].overUnder,
    home_moneyline: comp.odds[0].homeTeamOdds?.moneyLine, away_moneyline: comp.odds[0].awayTeamOdds?.moneyLine,
    home_favorite: comp.odds[0].homeTeamOdds?.favorite, last_updated: comp.odds[0].lastUpdated,
  } : null;
  for (const team of comp.competitors ?? []) {
    for (const rec of team.records ?? []) {
      if (rec.type === "total") { e.sports.statistics = { ...e.sports.statistics, [`${team.homeAway}_record`]: rec.summary }; }
    }
  }
  e.links.push(...(ev.links ?? []).map((l: any) => ({ url: l.href, site: "ESPN", kind: l.rel?.[0] })));
  e.images.thumbnail = [home?.team?.logo, away?.team?.logo].filter(Boolean);
  e.raw.espn = ev;
  tag(e, `league:${leagueKey}`);
  e.score = (e.status.is_live ? 100 : 0) + (e.sports.attendance ?? 0) / 10_000;
  return e;
}

function mapTeam(t: any, leagueKey: string): Entity {
  const meta = ESPN_LEAGUES[leagueKey];
  const e = baseEntity("sports_team", t.displayName ?? t.name, "espn", t.links?.[0]?.href);
  addId(e, "espn", String(t.id));
  e.title.display = t.displayName ?? t.name; e.title.short = t.shortDisplayName ?? t.abbreviation ?? null;
  e.title.aliases = [t.nickname, t.location, t.abbreviation].filter(Boolean);
  e.images.logo = [t.logo].filter(Boolean);
  e.images.color = [t.color].filter(Boolean);
  e.broadcast.country = meta?.country ?? t.country ?? null;
  e.sports.sport = meta?.sport ?? null;
  e.sports.league = meta ? { id: `espn_league_${leagueKey}`, name: meta.name, kind: "company", country: meta.country ?? null, external_ids: { espn_league: [leagueKey] } } : null;
  e.sports.venue = t.venue ? { id: `espn_venue_${t.venue.id}`, name: t.venue.fullName, kind: "company", url: null, country: t.venue.address?.country ?? null, external_ids: { espn: [String(t.venue.id)] } } : null;
  e.urls.official = t.links?.find((l: any) => l.rel?.includes("clubhouse"))?.href ?? null;
  for (const rec of t.record?.items ?? []) e.sports.standings = { wins: rec.stats?.find((s: any) => s.name === "wins")?.value, losses: rec.stats?.find((s: any) => s.name === "losses")?.value, ties: null, points: null, pct: rec.stats?.find((s: any) => s.name === "winPercent")?.value, games_played: rec.stats?.find((s: any) => s.name === "gamesPlayed")?.value, rank: null, streak: rec.stats?.find((s: any) => s.name === "streak")?.displayValue, form: null, home: {}, away: {} };
  e.raw.espn = t;
  return e;
}

function mapPlayer(a: any, leagueKey: string): Entity {
  const e = baseEntity("sports_player", a.fullName ?? a.displayName, "espn", a.links?.[0]?.href);
  addId(e, "espn", String(a.id));
  e.images.profile = [a.headshot?.href].filter(Boolean);
  e.person.birthday = a.dateOfBirth?.slice(0, 10) ?? null;
  e.person.birthplace = a.birthPlace?.city ?? null;
  e.person.height_cm = a.displayHeight ? Math.round(parseFloat(a.displayHeight) * 2.54) : null;
  e.person.weight_kg = a.displayWeight ? Math.round(parseFloat(a.displayWeight) * 0.4536) : null;
  e.person.gender = a.gender ?? null;
  e.person.occupations = ["athlete"];
  e.sports.sport = ESPN_LEAGUES[leagueKey]?.sport ?? null;
  e.sports.league = ESPN_LEAGUES[leagueKey] ? { id: `espn_league_${leagueKey}`, name: ESPN_LEAGUES[leagueKey].name, kind: "company", external_ids: { espn_league: [leagueKey] } } : null;
  e.sports.home_team = a.team ? { id: `espn_${a.team.id}`, name: a.team.displayName, kind: "sports_team", external_ids: { espn: [String(a.team.id)] } } : null;
  e.raw.espn = a;
  return e;
}

export const espn: Provider = {
  id: "espn", name: "ESPN", domains: ["sports"], priority: 6,
  kinds: ["sports_event", "sports_team", "sports_player", "sports_league", "person"],
  operations: ["search", "get", "trending", "schedule", "standings", "people", "streams"],
  auth: "none", base: SITE, license: "ESPN public APIs; editorial content ESPN",
  freshness: "15s live / 5min static", homepage: "https://www.espn.com",
  notes: "Live scoreboards, teams, odds, injuries, plays, standings for 25+ leagues incl. local leagues.",
  async search(ctx, q) {
    const teams = await this.searchTeams!(ctx, q);
    return teams;
  },
  async searchTeams(ctx: any, q: string) {
    const out: Entity[] = [];
    await Promise.all(Object.keys(ESPN_LEAGUES).slice(0, 12).map(async (key) => {
      const res = await fetchJson<any>(`${SITE}/${key}/teams`, { provider: "espn", headers: H, ttlMs: 86_400_000 }).catch(() => null);
      for (const wrap of res?.data?.sports ?? []) {
        for (const league of wrap.leagues ?? []) {
          for (const t of league.teams ?? []) {
            const name = t.team?.displayName ?? "";
            if (name.toLowerCase().includes(q.toLowerCase())) out.push(mapTeam(t.team, key));
          }
        }
      }
    }));
    return out.slice(0, ctx.limit);
  },
  async get(ctx, ref) {
    const id = ref.externalIds?.espn ?? ref.id;
    const leagueKey = Object.keys(ESPN_LEAGUES).find((k) => ref.externalIds?.espn_league?.includes(k)) ?? "football/nfl";
    if (ref.kind === "sports_team") {
      const res = await fetchJson<any>(`${SITE}/${leagueKey}/teams/${id}`, { provider: "espn", headers: H, ttlMs: 86_400_000, allowStatus: [404] });
      return res.data?.team ? mapTeam(res.data.team, leagueKey) : null;
    }
    if (ref.kind === "sports_player") {
      const res = await fetchJson<any>(`${SITE}/${leagueKey}/players/${id}`, { provider: "espn", headers: H, ttlMs: 86_400_000, allowStatus: [404] });
      return res.data?.athlete ? mapPlayer(res.data.athlete, leagueKey) : null;
    }
    const res = await fetchJson<any>(`${SITE}/${leagueKey}/summary?event=${id}`, { provider: "espn", headers: H, ttlMs: 15_000, allowStatus: [404] });
    if (!res.data?.header) return null;
    const e = mapEvent(res.data.header.competitions?.[0] ? { ...res.data.header.competitions[0], name: res.data.header.competitions[0].name ?? res.data.header.league?.name, id } : { id }, leagueKey);
    const sum = res.data;
    e.sports.venue = sum.gameInfo?.venue ? { id: `espn_venue_${sum.gameInfo.venue.id}`, name: sum.gameInfo.venue.fullName, kind: "company", url: null, country: sum.gameInfo.venue.address?.country ?? null, external_ids: { espn: [String(sum.gameInfo.venue.id)] } } : e.sports.venue;
    e.sports.attendance = sum.gameInfo?.attendance ?? null;
    e.sports.officials = (sum.gameInfo?.officials ?? []).map((o: any) => ({ id: `espn_official_${o.displayName}`, name: o.displayName, kind: "person" as const }));
    e.sports.weather = sum.gameInfo?.weather ? { condition: sum.gameInfo.weather.conditionId, temperature_f: sum.gameInfo.weather.temperature, wind_mph: sum.gameInfo.weather.windSpeed, humidity: sum.gameInfo.weather.humidity } : null;
    for (const team of sum.boxscore?.teams ?? []) {
      const side = team.homeAway;
      for (const stat of team.statistics ?? []) e.sports.statistics[`${side}_${stat.name}`] = stat.displayValue;
    }
    for (const injury of sum.injuries ?? []) {
      for (const i of injury.injuries ?? []) e.sports.injuries.push({ team: injury.team ? { id: injury.team.id, name: injury.team.displayName, kind: "sports_team" } : null, player: { id: i.athlete?.id, name: i.athlete?.displayName, kind: "person" }, status: i.status, detail: i.details?.detail, date: i.date });
    }
    for (const drive of sum.drives?.previous ?? []) for (const p of drive.plays ?? []) e.sports.plays.push({ id: p.id, sequence: p.sequenceNumber, clock: p.clock?.displayValue, text: p.text, team: p.team ? { id: p.team.id, name: p.team.displayName, kind: "sports_team" } : null, scoring: p.scoringPlay });
    for (const l of sum.leaders ?? []) for (const leader of l.leaders ?? []) e.sports.statistics[`leader_${leader.name}`] = leader.displayValue;
    for (const pick of sum.pickcenter ?? []) e.sports.odds = e.sports.odds ?? { provider: pick.provider?.name, details: pick.details, spread: pick.spread, over_under: pick.overUnder };
    return e;
  },
  async trending(ctx, kind) {
    const out: Entity[] = [];
    for (const key of ["football/nfl", "basketball/nba", "soccer/eng.1", "baseball/mlb", "hockey/nhl"]) {
      const res = await fetchJson<any>(`${SITE}/${key}/scoreboard`, { provider: "espn", headers: H, ttlMs: 30_000 }).catch(() => null);
      for (const ev of res?.data?.events ?? []) out.push(mapEvent(ev, key));
    }
    return out.slice(0, ctx.limit);
  },
  async schedule(ctx, p) {
    const out: Entity[] = [];
    const leagues = p.region ? Object.keys(ESPN_LEAGUES).filter((k) => ESPN_LEAGUES[k].country === p.region) : Object.keys(ESPN_LEAGUES).slice(0, 8);
    for (const key of leagues) {
      const res = await fetchJson<any>(`${SITE}/${key}/scoreboard?dates=${p.from.slice(0, 10).replace(/-/g, "")}-${p.to.slice(0, 10).replace(/-/g, "")}`, { provider: "espn", headers: H, ttlMs: 300_000 }).catch(() => null);
      for (const ev of res?.data?.events ?? []) out.push(mapEvent(ev, key));
    }
    return out.slice(0, ctx.limit);
  },
  async standings(ctx, league) {
    const res = await fetchJson<any>(`${SITE}/${league}/standings`, { provider: "espn", headers: H, ttlMs: 300_000 }).catch(() => null);
    const out: Entity[] = [];
    for (const group of res?.data?.standings?.entries ?? []) {
      for (const entry of group.entries ?? []) {
        const e = baseEntity("sports_team", entry.team?.displayName ?? "Team", "espn");
        addId(e, "espn", String(entry.team?.id));
        e.sports.league = { id: `espn_league_${league}`, name: ESPN_LEAGUES[league]?.name ?? league, kind: "company" };
        e.sports.standings = {
          rank: entry.stats?.find((s: any) => s.name === "rank")?.value,
          wins: entry.stats?.find((s: any) => s.name === "wins")?.value,
          losses: entry.stats?.find((s: any) => s.name === "losses")?.value,
          ties: entry.stats?.find((s: any) => s.name === "ties")?.value,
          points: entry.stats?.find((s: any) => s.name === "points")?.value,
          pct: entry.stats?.find((s: any) => s.name === "winPercent")?.value,
          games_played: entry.stats?.find((s: any) => s.name === "gamesPlayed")?.value,
          streak: entry.stats?.find((s: any) => s.name === "streak")?.displayValue,
          form: entry.stats?.find((s: any) => s.name === "form")?.displayValue ?? null, home: {}, away: {},
        };
        out.push(e);
      }
    }
    return out;
  },
  async people(ctx, id) {
    const e = await this.get!(ctx, { id, kind: "sports_player" }).catch(() => null);
    return e ? [e] : [];
  },
};

export default espn;
void str;
