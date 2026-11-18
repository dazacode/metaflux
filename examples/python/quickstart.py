"""MetaFlux without dependencies. Requires Python 3.11+."""
import json
import os
import urllib.parse
import urllib.request

BASE = os.environ.get("METAFLUX_URL", "http://127.0.0.1:8787")


def get(path: str, **params) -> dict:
    query = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
    req = urllib.request.Request(f"{BASE}{path}?{query}", headers={"accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.load(res)


def main() -> None:
    hits = get("/v1/search", q="frieren", kind="anime", limit=3)["data"]
    for hit in hits:
        print(hit["kind"], hit["title"]["display"], hit["external_ids"])

    detail = get(f"/v1/anime/{hits[0]['id']}")["data"]
    print("\n", detail["description"]["long"].get("en", "")[:400])
    print("studios:", [s["name"] for s in detail["companies"]["studios"]])
    print("provenance:", [s["provider"] for s in detail["provenance"]["sources"]])

    print("\nNBA:")
    for game in get("/v1/sports/scoreboard", league="basketball/nba")["data"][:3]:
        print(game["name"], game["sports"]["away_score"], "-", game["sports"]["home_score"])


if __name__ == "__main__":
    main()
