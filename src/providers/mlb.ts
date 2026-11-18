import { fetchJson } from "../core/http.ts";
import type { Entity } from "../schema/entities.ts";
import { addId, baseEntity } from "./_util.ts";
import type { Provider } from "./_types.ts";

const BASE = "https://statsapi.mlb.com/api/v1";

function mapTeam(t: any): Entity {
  const e = baseEntity("sports_team", t.name, "mlb");
  addId(e, "mlb", String(t.id));
  e.title.short = t.teamCode ?? t.abbreviation ?? null;
  e.title.aliases = [t.shortName, t.franchiseName, t.clubName, t.locationName].filter(Boolean);
  e.sports.sport = "baseball";
  e.sports.league = t.league ? { id: String(t.league.id), name: t.league.name, kind: "company" } : null;
  e.sports.venue = t.venue ? { id: String(t.venue.id), name: t.venue.name, kind: "company" } : null;
  e.dates.founded = t.firstYearOfPlay ? { year: Number(t.firstYearOfPlay) } : null;
  e.broadcast.country = t.springLeague?.id === 123 ? null : "US";
  e.raw.mlb = t;
  return e;
}

export const mlb: Provider = {
  id: "mlb", name: "MLB Stats API", domains: ["sports"], priority: 22,
  kinds: ["sports_team", "sports_player", "sports_event"],
  operations: ["search", "get", "schedule", "standings", "people"],
  auth: "none", base: BASE, license: "MLB public stats API",
  freshness: "30s live", homepage: "https://www.mlb.com",
  notes: "Teams, schedule, rosters, player stats and live feeds.",
  async search(ctx, q) {
    const res = await fetchJson<any>(`${BASE}/teams?sportId=1`, { provider: "mlb", ttlMs: 86_400_000 });
    return (res.data.teams ?? []).filter((t: any) => t.name.toLowerCase().includes(q.toLowerCase())).slice(0, ctx.limit).map(mapTeam);
  },
  async get(ctx, ref) {
    const res = await fetchJson<any>(`${BASE}/teams/${ref.id}`, { provider: "mlb", ttlMs: 86_400_000, allowStatus: [404] });
    return res.data?.teams?.[0] ? mapTeam(res.data.teams[0]) : null;
  },
  async schedule(ctx, p) {
    const res = await fetchJson<any>(`${BASE}/schedule?sportId=1&startDate=${p.from.slice(0, 10)}&endDate=${p.to.slice(0, 10)}&hydrate=team,venue,linescore`, { provider: "mlb", ttlMs: 300_000 }).catch(() => null);
    return (res?.data?.dates ?? []).flatMap((d: any) => d.games ?? []).map((g: any) => {
      const e = baseEntity("sports_event", `${g.teams?.away?.team?.name} vs ${g.teams?.home?.team?.name}`, "mlb");
      addId(e, "mlb", String(g.gamePk));
      e.dates.start = { date: g.gameDate, precision: "second" };
      e.status.state = g.status?.abstractGameState === "Final" ? "finished" : g.status?.abstractGameState === "Live" ? "live" : "scheduled";
      e.sports.sport = "baseball";
      e.sports.home_team = g.teams?.home?.team ? { id: String(g.teams.home.team.id), name: g.teams.home.team.name, kind: "sports_team" } : null;
      e.sports.away_team = g.teams?.away?.team ? { id: String(g.teams.away.team.id), name: g.teams.away.team.name, kind: "sports_team" } : null;
      e.sports.home_score = g.teams?.home?.score ?? null;
      e.sports.away_score = g.teams?.away?.score ?? null;
      e.sports.venue = g.venue ? { id: String(g.venue.id), name: g.venue.name, kind: "company" } : null;
      return e;
    });
  },
  async standings(ctx, league, season) {
    const res = await fetchJson<any>(`${BASE}/standings?leagueId=${league ?? "103,104"}&season=${season ?? ctx.now.getFullYear()}`, { provider: "mlb", ttlMs: 300_000 }).catch(() => null);
    return (res?.data?.records ?? []).flatMap((r: any) => r.teamRecords ?? []).map((t: any) => {
      const e = baseEntity("sports_team", t.team?.name ?? "Team", "mlb");
      if (t.team?.id) addId(e, "mlb", String(t.team.id));
      e.sports.sport = "baseball";
      e.sports.standings = { rank: t.divisionRank ? Number(t.divisionRank) : null, wins: t.wins, losses: t.losses, ties: t.ties, points: null, pct: t.winningPercentage ? Number(t.winningPercentage) : null, games_played: t.gamesPlayed, streak: t.streak?.streakCode ?? null, form: null, home: {}, away: {} };
      return e;
    });
  },
  async people(ctx, id) {
    const res = await fetchJson<any>(`${BASE}/people/${id}?hydrate=currentTeam`, { provider: "mlb", ttlMs: 86_400_000, allowStatus: [404] }).catch(() => null);
    const p = res?.data?.people?.[0];
    if (!p) return [];
    const e = baseEntity("sports_player", p.fullName, "mlb");
    addId(e, "mlb", String(p.id));
    e.person.birthday = p.birthDate ?? null;
    e.person.birthplace = p.birthCity ?? null;
    e.person.height_cm = p.height ? Math.round(p.height.replace(/\D/g, "") * 2.54) : null;
    e.person.weight_kg = p.weight ? Math.round(p.weight * 0.4536) : null;
    e.person.occupations = ["baseball player"];
    e.images.profile = p.primaryNumber ? [] : [];
    e.sports.home_team = p.currentTeam ? { id: String(p.currentTeam.id), name: p.currentTeam.name, kind: "sports_team" } : null;
    return [e];
  },
};
export default mlb;
