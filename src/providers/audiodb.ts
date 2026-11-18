import { fetchJson } from "../core/http.ts";
import type { Entity } from "../schema/entities.ts";
import { addId, baseEntity, dateParts, list } from "./_util.ts";
import type { Provider } from "./_types.ts";

const BASE = "https://www.theaudiodb.com/api/v1/json/123";

function mapArtist(a: any): Entity {
  const e = baseEntity("music_artist", a.strArtist, "audiodb", a.strWebsite || undefined);
  addId(e, "audiodb", a.idArtist);
  if (a.strMusicBrainzID) addId(e, "musicbrainz", a.strMusicBrainzID);
  e.title.aliases = list(a.strArtistAlternate);
  e.description.long = { en: a.strBiography ?? "" };
  e.description.short = { en: (a.strBiography ?? "").slice(0, 500) };
  e.images.profile = [a.strArtistThumb, a.strArtistCutout].filter(Boolean);
  e.images.logo = [a.strArtistLogo].filter(Boolean);
  e.images.clearart = [a.strArtistClearart].filter(Boolean);
  e.images.banner = [a.strArtistBanner].filter(Boolean);
  e.images.fanart = [a.strArtistFanart, a.strArtistFanart2, a.strArtistFanart3, a.strArtistFanart4].filter(Boolean);
  e.images.backdrop = [a.strArtistWideThumb].filter(Boolean);
  e.classification.genres = [a.strGenre].filter(Boolean);
  e.classification.themes = [a.strStyle, a.strMood].filter(Boolean);
  e.dates.start = dateParts(a.intFormedYear) ?? null;
  e.dates.born = dateParts(a.intBornYear) ?? null;
  e.dates.died = dateParts(a.intDiedYear) ?? null;
  e.person.birthday = a.intBornYear ? String(a.intBornYear) : null;
  e.person.deathday = a.intDiedYear ? String(a.intDiedYear) : null;
  e.person.gender = a.strGender;
  e.person.nationality = a.strCountry ? [a.strCountry] : [];
  e.person.member_count = Number(a.intMembers) || null;
  e.person.is_group = Number(a.intMembers) > 1 ? true : null;
  e.person.occupations = ["musician"];
  e.metrics.popularity = Number(a.intPopularity) || null;
  e.metrics.followers = Number(a.intFollowers) || null;
  e.companies.labels = a.strLabel ? [{ name: a.strLabel, kind: "label" }] : [];
  e.links.push(...[["website", a.strWebsite], ["facebook", a.strFacebook], ["twitter", a.strTwitter], ["lastfm", a.strLastFMChart]].filter(([, v]) => v).map(([k, v]) => ({ url: v as string, site: k as string, kind: "social" })));
  e.raw.audiodb = a;
  e.score = (e.metrics.popularity ?? 0) / 10;
  return e;
}

export const audiodb: Provider = {
  id: "audiodb", name: "TheAudioDB", domains: ["music"], priority: 29,
  kinds: ["music_artist", "music_album", "music_track"],
  operations: ["search", "get", "people", "related"],
  auth: "none", base: "https://www.theaudiodb.com/api/v1/json/{key}", license: "TheAudioDB free tier",
  freshness: "7d", homepage: "https://www.theaudiodb.com",
  notes: "15-language artist bios, art, MusicBrainz ids, discography.",
  async search(ctx, q) {
    const res = await fetchJson<any>(`${BASE}/search.php?s=${encodeURIComponent(q)}`, { provider: "audiodb", ttlMs: 604_800_000 });
    return (res.data.artists ?? []).slice(0, ctx.limit).map(mapArtist);
  },
  async get(ctx, ref) {
    const res = await fetchJson<any>(`${BASE}/artist.php?i=${ref.id}`, { provider: "audiodb", ttlMs: 604_800_000, allowStatus: [404] });
    return res.data.artists?.[0] ? mapArtist(res.data.artists[0]) : null;
  },
  async people(ctx, id) {
    const e = await this.get!(ctx, { id }).catch(() => null);
    return e ? [e] : [];
  },
};
export default audiodb;
