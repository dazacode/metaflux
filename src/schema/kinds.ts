import { KINDS, type Kind } from "./entities.ts";

export const KIND_SET = new Set<string>(KINDS);

/** Kinds that can satisfy one another during cross-provider search. */
export const KIND_FAMILY: Record<string, Kind[]> = {
  anime: ["anime", "anime_movie", "tv_show", "movie"],
  anime_movie: ["anime_movie", "anime", "movie"],
  manga: ["manga", "manhwa", "manhua", "comic", "webtoon"],
  manhwa: ["manhwa", "manhua", "manga", "webtoon", "comic"],
  manhua: ["manhua", "manhwa", "manga", "webtoon", "comic"],
  webtoon: ["webtoon", "manhwa", "manhua", "comic"],
  comic: ["comic", "comic_series", "manga", "webtoon"],
  comic_series: ["comic_series", "comic", "manga"],
  tv_show: ["tv_show", "tv_special", "anime", "movie"],
  tv_episode: ["tv_episode", "tv_show"],
  movie: ["movie", "anime_movie", "tv_show"],
  book: ["book", "book_edition", "audiobook", "comic", "short_story"],
  book_edition: ["book_edition", "book"],
  audiobook: ["audiobook", "book", "music_track"],
  music_artist: ["music_artist", "music_group", "person", "idol", "vtuber"],
  music_group: ["music_group", "music_artist", "idol_group"],
  music_album: ["music_album", "music_track"],
  music_track: ["music_track", "music_album", "music_video"],
  concert: ["concert", "festival", "sports_event", "music_video"],
  sports_event: ["sports_event", "tv_show", "concert"],
  sports_team: ["sports_team", "sports_player"],
  sports_player: ["sports_player", "person"],
  idol: ["idol", "person", "music_artist", "vtuber"],
  idol_group: ["idol_group", "music_group", "vtuber_group"],
  vtuber: ["vtuber", "person", "music_artist", "idol"],
  person: ["person", "music_artist", "sports_player", "idol", "vtuber", "character"],
  iptv_channel: ["iptv_channel", "iptv_stream", "tv_show"],
  radio_station: ["radio_station", "iptv_channel"],
  award_show: ["award_show", "tv_show", "tv_special"],
};

export function kindFamily(kind: Kind): Kind[] {
  return KIND_FAMILY[kind] ?? [kind];
}

export function kindsForDomain(domain: string): Kind[] {
  return KINDS.filter((k) => k.startsWith(domain));
}

export const DOMAIN_KINDS: Record<string, Kind[]> = {
  screen: ["movie", "tv_show", "tv_episode", "tv_season", "tv_special", "award_show"],
  anime: ["anime", "anime_episode", "anime_movie"],
  reading: ["manga", "manhwa", "manhua", "webtoon", "comic", "comic_series", "comic_issue", "book", "book_edition", "audiobook"],
  music: ["music_artist", "music_group", "music_album", "music_track", "music_video", "concert", "tour", "festival"],
  sports: ["sports_event", "sports_team", "sports_player", "sports_league", "sports_season", "sports_venue"],
  live: ["iptv_channel", "iptv_stream", "radio_station"],
  people: ["person", "character", "idol", "idol_group", "vtuber", "vtuber_group", "studio", "company"],
  meta: ["award", "genre", "country", "language", "schedule_entry", "collection"],
};

export function parseKinds(input?: string | string[]): Kind[] {
  if (!input) return [];
  const raw = (Array.isArray(input) ? input : input.split(",")).map((s) => s.trim().toLowerCase()).filter(Boolean);
  const out = new Set<Kind>();
  for (const item of raw) {
    if (DOMAIN_KINDS[item]) for (const k of DOMAIN_KINDS[item]) out.add(k);
    else if (KIND_SET.has(item)) out.add(item as Kind);
  }
  return [...out];
}
