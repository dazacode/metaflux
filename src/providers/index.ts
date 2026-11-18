import { register } from "./_types.ts";
import { anilist } from "./anilist.ts";
import { jikan } from "./jikan.ts";
import { kitsu } from "./kitsu.ts";
import { mangadex } from "./mangadex.ts";
import { mangaupdates } from "./mangaupdates.ts";
import { comick } from "./comick.ts";
import { cinemeta } from "./cinemeta.ts";
import { tvmaze } from "./tvmaze.ts";
import { wikidata } from "./wikidata.ts";
import { wikipedia } from "./wikipedia.ts";
import { mydramalist } from "./mydramalist.ts";
import { thesportsdb } from "./thesportsdb.ts";
import { espn } from "./espn.ts";
import { jolpica } from "./jolpica.ts";
import { openligadb } from "./openligadb.ts";
import { mlb } from "./mlb.ts";
import { nhl } from "./nhl.ts";
import { iptv } from "./iptv.ts";
import { radio } from "./radio.ts";
import { openlibrary } from "./openlibrary.ts";
import { gutendex } from "./gutendex.ts";
import { googlebooks } from "./googlebooks.ts";
import { crossref } from "./crossref.ts";
import { internetarchive } from "./internetarchive.ts";
import { musicbrainz } from "./musicbrainz.ts";
import { deezer } from "./deezer.ts";
import { itunes } from "./itunes.ts";
import { audiodb } from "./audiodb.ts";
import { lrclib } from "./lrclib.ts";
import { holodex } from "./holodex.ts";
import { youtubeRss } from "./youtube.ts";
import { vtuberWiki } from "./vtuberwiki.ts";
import { kprofiles } from "./kprofiles.ts";
import { gcd } from "./gcd.ts";
import { arm } from "./arm.ts";
import { tmdb } from "./tmdb.ts";

let loaded = false;

export function loadProviders() {
  if (loaded) return;
  loaded = true;
  const list = [
    anilist, jikan, kitsu, mangadex, mangaupdates, comick, cinemeta, tvmaze,
    wikidata, wikipedia, mydramalist, thesportsdb, espn, jolpica, openligadb, mlb, nhl,
    iptv, radio, openlibrary, gutendex, googlebooks, crossref, internetarchive,
    musicbrainz, deezer, itunes, audiodb, lrclib, holodex, youtubeRss, vtuberWiki,
    kprofiles, gcd, arm, tmdb,
  ];
  for (const p of list) if (p) register(p);
}

export { allProviders, chain, getProvider, providerPublic } from "./_types.ts";
