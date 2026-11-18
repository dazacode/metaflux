import { fetchJson } from "../core/http.ts";
import type { Entity } from "../schema/entities.ts";
import { addId, baseEntity } from "./_util.ts";
import type { Provider } from "./_types.ts";

const BASE = "https://api-web.nhle.com/v1";

export const nhl: Provider = {
  id: "nhl", name: "NHL API", domains: ["sports"], priority: 23,
  kinds: ["sports_team", "sports_player", "sports_event"],
  operations: ["search", "get", "schedule", "standings", "people"],
  auth: "none", base: BASE, license: "NHL public API",
  freshness: "30s live", homepage: "https://www.nhl.com",
  notes: "Standings, club schedules, rosters, player landing pages.",
  async search(ctx, q) {
    const res = await fetchJson<any>(`${BASE}/standings/now`, { provider: "nhl", ttlMs: 300_000 });
    return (res.data.standings ?? []).filter((s: any) => (s.teamName?.default ?? "").toLowerCase().includes(q.toLowerCase())).slice(0, ctx.limit).map(mapStanding);
  },
  async get(ctx, ref) {
    if (ref.kind === "sports_player") {
      const res = await fetchJson<any>(`${BASE}/player/${ref.id}/landing`, { provider: "nhl", ttlMs: 86_400_000, allowStatus: [404] });
      return res.data?.playerId ? mapPlayer(res.data) : null;
    }
    const res = await fetchJson<any>(`${BASE}/standings/now`, { provider: "nhl", ttlMs: 300_000 });
    const row = (res.data.standings ?? []).find((s: any) => String(s.teamAbbrev?.default) === ref.id || s.teamName?.default === ref.id);
    return row ? mapStanding(row) : null;
  },
  async schedule(ctx, p) {
    const teams = await fetchJson<any>(`${BASE}/standings/now`, { provider: "nhl", ttlMs: 300_000 }).catch(() => null);
    const out: Entity[] = [];
    for (const s of (teams?.data?.standings ?? []).slice(0, 8)) {
      const abbrev = s.teamAbbrev?.default;
      const res = await fetchJson<any>(`${BASE}/club-schedule/${abbrev}/week/now`, { provider: "nhl", ttlMs: 300_000 }).catch(() => null);
      for (const g of res?.data?.games ?? []) {
        const e = baseEntity("sports_event", `${g.awayTeam?.name?.default} vs ${g.homeTeam?.name?.default}`, "nhl");
        addId(e, "nhl", String(g.id));
        e.dates.start = { date: g.startTimeUTC, precision: "second" };
        e.status.state = g.gameState === "OFF" ? "finished" : g.gameState === "LIVE" ? "live" : "scheduled";
        e.sports.sport = "hockey";
        e.sports.home_team = g.homeTeam ? { id: String(g.homeTeam.id), name: g.homeTeam.name?.default, kind: "sports_team" } : null;
        e.sports.away_team = g.awayTeam ? { id: String(g.awayTeam.id), name: g.awayTeam.name?.default, kind: "sports_team" } : null;
        e.sports.home_score = g.homeTeam?.score ?? null;
        e.sports.away_score = g.awayTeam?.score ?? null;
        e.sports.venue = g.venue?.default ? { name: g.venue.default, kind: "company" } : null;
        out.push(e);
      }
    }
    return out.slice(0, ctx.limit);
  },
  async standings(ctx) {
    const res = await fetchJson<any>(`${BASE}/standings/now`, { provider: "nhl", ttlMs: 300_000 });
    return (res.data.standings ?? []).map(mapStanding);
  },
  async people(ctx, id) {
    const e = await this.get!(ctx, { id, kind: "sports_player" }).catch(() => null);
    return e ? [e] : [];
  },
};

function mapStanding(s: any): Entity {
  const e = baseEntity("sports_team", s.teamName?.default ?? s.teamAbbrev?.default ?? "Team", "nhl");
  addId(e, "nhl", s.teamAbbrev?.default ?? String(s.teamName?.default));
  e.title.short = s.teamAbbrev?.default ?? null;
  e.title.aliases = [s.teamCommonName?.default].filter(Boolean);
  e.images.logo = [s.teamLogo].filter(Boolean);
  e.sports.sport = "hockey";
  e.sports.league = { id: "nhl", name: "NHL", kind: "company" };
  e.sports.standings = {
    rank: s.leagueSequence ?? null, wins: s.wins, losses: s.losses, ties: s.ties, points: s.points,
    pct: s.pointPctg, games_played: s.gamesPlayed, streak: `${s.streakCode ?? ""}${s.streakCount ?? ""}`,
    form: null, home: { wins: s.homeWins, losses: s.homeLosses, points: s.homePoints }, away: { wins: s.roadWins, losses: s.roadLosses, points: s.roadPoints },
  };
  e.sports.statistics = { ot_losses: s.otLosses, regulation_wins: s.regulationWins, goal_for: s.goalFor, goal_against: s.goalAgainst, goal_differential: s.goalDifferential };
  return e;
}

function mapPlayer(p: any): Entity {
  const e = baseEntity("sports_player", `${p.firstName?.default ?? ""} ${p.lastName?.default ?? ""}`.trim(), "nhl");
  addId(e, "nhl", String(p.playerId));
  e.person.birthday = p.birthDate ?? null;
  e.person.birthplace = [p.birthCity?.default, p.birthCountry].filter(Boolean).join(", ") || null;
  e.person.height_cm = p.heightInCentimeters ?? null;
  e.person.weight_kg = p.weightInKilograms ?? null;
  e.images.profile = p.headshot ? [p.headshot] : [];
  e.person.occupations = ["hockey player"];
  e.sports.sport = "hockey";
  e.sports.home_team = p.currentTeamAbbrev ? { name: p.currentTeamAbbrev, kind: "sports_team" } : null;
  return e;
}
export default nhl;
