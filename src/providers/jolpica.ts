import { fetchJson } from "../core/http.ts";
import type { Entity } from "../schema/entities.ts";
import { addId, baseEntity, str, tag } from "./_util.ts";
import type { Provider } from "./_types.ts";

const BASE = "https://api.jolpi.ca/ergast/f1";

function mapStanding(d: any): Entity {
  const driver = d.Driver ?? {};
  const e = baseEntity("sports_player", `${driver.givenName ?? ""} ${driver.familyName ?? ""}`.trim() || "Driver", "jolpica");
  addId(e, "jolpica", driver.driverId);
  addId(e, "f1", driver.permanentNumber ?? driver.code ?? driver.driverId);
  e.title.short = driver.code ?? null;
  e.person.birthday = driver.dateOfBirth ?? null;
  e.person.nationality = driver.nationality ? [driver.nationality] : [];
  e.sports.sport = "motorsport";
  e.sports.league = { id: "f1", name: "Formula 1", kind: "company" };
  e.sports.standings = { rank: Number(d.position), wins: Number(d.wins), losses: null, ties: null, points: Number(d.points), pct: null, games_played: null, streak: null, form: null, home: {}, away: {} };
  for (const c of d.Constructors ?? []) e.sports.home_team = { id: c.constructorId, name: c.name, kind: "sports_team" };
  e.raw.jolpica = d;
  return e;
}

export const jolpica: Provider = {
  id: "jolpica", name: "Jolpica F1", domains: ["sports"], priority: 16,
  kinds: ["sports_event", "sports_player", "sports_team", "sports_season"],
  operations: ["search", "get", "schedule", "standings"],
  auth: "none", base: "https://api.jolpi.ca/ergast/f1", license: "Ergast-compatible, CC BY-NC-SA",
  freshness: "1h", homepage: "https://api.jolpi.ca",
  notes: "Formula 1 schedule, results, driver and constructor standings.",
  async search(ctx, q) {
    const res = await fetchJson<any>(`${BASE}/drivers.json?limit=100`, { provider: "jolpica", ttlMs: 86_400_000 });
    return (res.data.MRData?.DriverTable?.Drivers ?? []).filter((d: any) => `${d.givenName} ${d.familyName}`.toLowerCase().includes(q.toLowerCase())).slice(0, ctx.limit).map(mapStanding);
  },
  async get(ctx, ref) {
    const id = ref.externalIds?.jolpica ?? ref.id;
    const res = await fetchJson<any>(`${BASE}/drivers/${id}.json`, { provider: "jolpica", ttlMs: 86_400_000, allowStatus: [404] });
    const d = res.data.MRData?.DriverTable?.Drivers?.[0];
    return d ? mapStanding(d) : null;
  },
  async schedule(ctx, p) {
    const season = p.from.slice(0, 4);
    const res = await fetchJson<any>(`${BASE}/${season}.json`, { provider: "jolpica", ttlMs: 3_600_000 }).catch(() => null);
    return (res?.data?.MRData?.RaceTable?.Races ?? []).map((r: any) => {
      const e = baseEntity("sports_event", r.raceName, "jolpica", r.url);
      addId(e, "jolpica", `${r.season}/${r.round}`);
      e.dates.start = r.date ? { date: `${r.date}T${r.time ?? "00:00:00Z"}` } : null;
      e.sports.sport = "motorsport";
      e.sports.league = { id: "f1", name: "Formula 1", kind: "company" };
      e.sports.venue = r.Circuit ? { id: r.Circuit.circuitId, name: r.Circuit.circuitName, kind: "company" } : null;
      e.sports.city = r.Circuit?.Location?.locality ?? null;
      e.sports.country = r.Circuit?.Location?.country ?? null;
      e.links.push({ url: r.url, site: "Ergast", kind: "reference" });
      e.raw.jolpica = r;
      return e;
    });
  },
  async standings(ctx, _league, season) {
    const year = season ?? String(ctx.now.getFullYear());
    const res = await fetchJson<any>(`${BASE}/${year}/driverstandings.json`, { provider: "jolpica", ttlMs: 3_600_000 });
    return (res.data.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? []).map(mapStanding);
  },
};
export default jolpica;
void str; void tag;
