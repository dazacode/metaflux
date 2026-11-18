/**
 * Identity rules: how external ids are parsed, scoped and compared.
 *
 * Three facts drive this module:
 * 1. MyAnimeList numbers anime and manga in two separate spaces, so `mal:13`
 *    is a different work as an anime than as a manga. Every id lookup is
 *    therefore scoped by a kind group (`anime`, `manga`, `screen`, ...).
 * 2. Mapping services (ARM, ani.zip) give every season of a show the same
 *    IMDb/TVDB/TMDB id. Those are *coarse* ids for anime and must never make
 *    two seasons collapse into one record.
 * 3. Some keys are not identities at all (`tmdb_season: 1`). They are kept on
 *    the record but ignored for merging and indexing.
 */
import { DOMAIN_OF, type Entity, type Kind } from "../schema/entities.ts";

export type IdScope = string;

const MANGA_KINDS = new Set<Kind>(["manga", "manhwa", "manhua", "webtoon"]);

/** The id space a kind lives in. Lookups never cross scopes. */
export function idScope(kind: Kind): IdScope {
  if (MANGA_KINDS.has(kind)) return "manga";
  if (kind === "character") return "character";
  if (kind === "person" || kind === "idol" || kind === "vtuber") return "person";
  // TMDB numbers movies and TV separately, so the screen domain splits in two.
  if (kind === "movie") return "movie";
  if (kind === "tv_show" || kind === "tv_season" || kind === "tv_special" || kind === "award_show") return "tv";
  return DOMAIN_OF[kind] ?? "meta";
}

/** Keys that are labels or sub-addresses, not identities of the record. */
export function isIdentityKey(provider: string): boolean {
  return !/(_season|_episode|_episodes)$/.test(provider) && provider !== "tvrage";
}

/** Ids that name exactly one work; two different values mean two different works. */
const PRECISE = new Set(["mal", "anilist", "kitsu", "anidb", "mangadex", "mangaupdates", "tvmaze", "mdl", "imdb", "tmdb", "tvdb", "wikidata"]);
/** For anime/manga these are shared by every season of a franchise. */
const COARSE_IN_ANIME = new Set(["imdb", "tmdb", "tvdb", "wikidata", "animecountdown", "simkl"]);

function usable(kind: Kind, provider: string): boolean {
  if (!isIdentityKey(provider)) return false;
  const scope = idScope(kind);
  if ((scope === "anime" || scope === "manga") && COARSE_IN_ANIME.has(provider)) return false;
  return true;
}

/** True when both records carry a precise id for the same provider and the values are disjoint. */
export function idsConflict(a: Entity, b: Entity): boolean {
  for (const [provider, ids] of Object.entries(a.external_ids)) {
    if (!PRECISE.has(provider) || !usable(a.kind, provider)) continue;
    const other = b.external_ids[provider];
    if (!ids?.length || !other?.length) continue;
    if (!other.some((id) => ids.includes(id))) return true;
  }
  return false;
}

/** True when the records share an identity-grade id. */
export function idsShared(a: Entity, b: Entity): boolean {
  for (const [provider, ids] of Object.entries(a.external_ids)) {
    if (!usable(a.kind, provider)) continue;
    if ((b.external_ids[provider] ?? []).some((id) => ids.includes(id))) return true;
  }
  return false;
}

/** Ids that may be written to the lookup index for this record. */
export function indexableIds(e: { kind: Kind; external_ids?: Record<string, string[]> }): [string, string][] {
  if (e.kind === "anime_episode" || e.kind === "tv_episode" || e.kind === "schedule_entry") return [];
  const out: [string, string][] = [];
  for (const [provider, ids] of Object.entries(e.external_ids ?? {})) {
    if (!isIdentityKey(provider)) continue;
    for (const id of ids ?? []) out.push([provider, String(id)]);
  }
  return out;
}

export interface ExternalRef {
  provider: string;
  id: string;
  /** Kind implied by the id itself (`mal:manga:13`, `tmdb:tv:1396`). */
  kindHint?: Kind;
}

/**
 * Parse `provider:id`, including the compound forms clients use:
 * `mal:manga:13`, `anilist:manga:30013`, `tmdb:tv:1396`, `tmdb:movie:550`,
 * `tmdb:person:287`, `anilist:staff:95185`, `anilist:character:40`.
 */
export function parseExternal(raw: string): ExternalRef | null {
  const m = raw.match(/^([a-z0-9_.-]+):(.+)$/i);
  if (!m) return null;
  const provider = m[1].toLowerCase();
  let id = m[2];
  let kindHint: Kind | undefined;
  const sub = id.match(/^(manga|anime|tv|movie|person|staff|character):(.+)$/i);
  if (sub) {
    const tag = sub[1].toLowerCase();
    id = sub[2];
    kindHint = tag === "manga" ? "manga" : tag === "anime" ? "anime" : tag === "tv" ? "tv_show" : tag === "movie" ? "movie"
      : tag === "character" ? "character" : "person";
  }
  return { provider, id, kindHint };
}

/** Pick the kind to serve: an explicit hint in the id wins when it changes the scope. */
export function effectiveKind(requested: Kind, hint?: Kind): Kind {
  if (!hint) return requested;
  if (idScope(hint) === idScope(requested)) return requested;
  return hint;
}
