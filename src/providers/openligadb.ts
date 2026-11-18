import { fetchJson } from "../core/http.ts";
import type { Entity } from "../schema/entities.ts";
import { addId, baseEntity, tag } from "./_util.ts";
import type { Provider } from "./_types.ts";

const BASE = "https://api.openligadb.de";

function map(m: any): Entity {
  const e = baseEntity("sports_event", `${m.team1?.teamName} vs ${m.team2?.teamName}`, "openligadb");
  addId(e, "openligadb", String(m.matchID));
  e.dates.start = m.matchDateTimeUTC ? { date: m.matchDateTimeUTC, precision: "second" } : m.matchDateTime ? { date: m.matchDateTime } : null;
  e.status.state = m.matchIsFinished ? "finished" : m.matchDateTime && Date.parse(m.matchDateTime) < Date.now() ? "live" : "scheduled";
  e.status.is_live = e.status.state === "live";
  e.sports.sport = "soccer";
  e.sports.league = { id: String(m.leagueId), name: m.leagueName, kind: "company" };
  e.sports.season = m.leagueSeason;
  e.sports.round = m.group?.groupName ?? null;
  e.sports.home_team = m.team1 ? { id: String(m.team1.teamId), name: m.team1.teamName, kind: "sports_team", image: m.team1.teamIconUrl } : null;
  e.sports.away_team = m.team2 ? { id: String(m.team2.teamId), name: m.team2.teamName, kind: "sports_team", image: m.team2.teamIconUrl } : null;
  const last = m.matchResults?.filter((r: any) => r.resultTypeID === 2).at(-1) ?? m.matchResults?.at(-1);
  if (last) { e.sports.home_score = last.pointsTeam1; e.sports.away_score = last.pointsTeam2; }
  e.sports.venue = m.location ? { id: String(m.location.locationID), name: m.location.locationStadium, kind: "company" } : null;
  e.sports.city = m.location?.locationCity ?? null;
  e.sports.attendance = m.numberOfViewers ?? null;
  for (const g of m.goals ?? []) {
    e.sports.plays.push({
      id: String(g.goalID), clock: g.matchMinute ? `${g.matchMinute}'` : null,
      text: `${g.goalGetterName}${g.isPenalty ? " (pen)" : ""}${g.isOwnGoal ? " (OG)" : ""}`,
      team: g.scoringTeamId === m.team1?.teamId ? e.sports.home_team ?? null : e.sports.away_team ?? null,
      score: `${g.scoreTeam1}-${g.scoreTeam2}`, scoring: true,
    });
    if (g.goalGetterName) e.sports.statistics[`goal_${g.goalID}`] = g.goalGetterName;
  }
  e.images.thumbnail = [m.team1?.teamIconUrl, m.team2?.teamIconUrl].filter(Boolean);
  e.raw.openligadb = m;
  tag(e, `league:${m.leagueShortcut}`);
  e.score = e.status.is_live ? 100 : 0;
  return e;
}

export const openligadb: Provider = {
  id: "openligadb", name: "OpenLigaDB", domains: ["sports"], priority: 36,
  kinds: ["sports_event", "sports_team", "sports_league"],
  operations: ["search", "get", "schedule", "standings"],
  auth: "none", base: BASE, license: "OpenLigaDB community data",
  freshness: "1min", homepage: "https://www.openligadb.de",
  notes: "German football (Bundesliga, 2. Liga, cups) match data, goals, venue.",
  async search(ctx, q) {
    const res = await fetchJson<any>(`${BASE}/getmatchdata/bl1/2024`, { provider: "openligadb", ttlMs: 3_600_000 }).catch(() => null);
    const words = q.toLowerCase();
    return (res?.data ?? []).filter((m: any) => `${m.team1?.teamName} ${m.team2?.teamName}`.toLowerCase().includes(words)).slice(0, ctx.limit).map(map);
  },
  async get(ctx, ref) {
    const res = await fetchJson<any>(`${BASE}/getmatchdata/${ref.id}`, { provider: "openligadb", ttlMs: 3_600_000, allowStatus: [404] }).catch(() => null);
    return res?.data ? map(res.data) : null;
  },
  async schedule(ctx, p) {
    const res = await fetchJson<any>(`${BASE}/getmatchdata/bl1/${p.from.slice(0, 4)}`, { provider: "openligadb", ttlMs: 3_600_000 }).catch(() => null);
    return (res?.data ?? []).filter((m: any) => m.matchDateTimeUTC >= p.from && m.matchDateTimeUTC <= p.to).slice(0, ctx.limit).map(map);
  },
  async standings(ctx, league) {
    const res = await fetchJson<any>(`${BASE}/getbltable/${league}`, { provider: "openligadb", ttlMs: 3_600_000 }).catch(() => null);
    return (res?.data ?? []).map((t: any) => {
      const e = baseEntity("sports_team", t.teamName, "openligadb");
      addId(e, "openligadb", String(t.teamInfoId));
      e.images.logo = [t.teamIconUrl].filter(Boolean);
      e.sports.sport = "soccer";
      e.sports.standings = { rank: Number(t.rank), wins: Number(t.won), losses: Number(t.lost), ties: Number(t.draw), points: Number(t.points), pct: null, games_played: Number(t.matches), streak: null, form: null, home: {}, away: {} };
      if (t.teamShortName) e.title.short = t.teamShortName;
      return e;
    });
  },
};
export default openligadb;
