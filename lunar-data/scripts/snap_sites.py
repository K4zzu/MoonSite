#!/usr/bin/env python3
"""Check and fix site coordinates.

Landed missions keep the published landing coordinates (LROC / mission reports) and are marked verified.
South-pole candidate regions (rims, ridges, massifs) have no single official point. Their nominal coordinate
is snapped to the highest LOLA point within --radius-km, i.e. the local crest, which is where a lander
would go for sunlight and Earth view. The nominal coordinate is kept in `nominal`.

Needs numpy and the DEM used by make_horizons.py. Usage:
    python scripts/snap_sites.py            # report only
    python scripts/snap_sites.py --write    # update sites.json
Then re-run fetch_horizons.py --only <id> and make_horizons.py for the moved sites.
"""
import argparse
import json

import numpy as np

from common import ROOT
from make_horizons import DEFAULT_DEM, PolarDem, destination

# Published landing coordinates (deg N, deg E 0-360)
PUBLISHED = {
    "malapert-a": "IM-1 Odysseus landing site, LROC",
    "mons-mouton": "IM-2 Athena landing site, LROC",
    "blue-ghost-1": "Blue Ghost Mission 1 landing site, LROC",
    "chandrayaan-3": "Chandrayaan-3 Shiv Shakti point, ISRO / LROC",
    "change-4": "Chang'e-4 landing site, LROC",
    "change-6": "Chang'e-6 landing site, LROC",
    "slim": "SLIM landing site, JAXA / LROC",
    "apollo-11": "Apollo 11 LM, LROC",
    "apollo-15": "Apollo 15 LM, LROC",
    "apollo-17": "Apollo 17 LM, LROC",
}


def crest(dem, lat, lon, radius_m, step_m):
    """Highest DEM point within radius of (lat, lon)."""
    best = (float(dem.height(lat, lon)), lat, lon, 0.0, 0.0)
    for d in np.arange(step_m, radius_m + 1, step_m):
        az = np.arange(0, 360, max(2.0, np.degrees(step_m / d)))
        la, lo = destination(lat, lon, az, d)
        h = dem.height(la, lo)
        k = int(np.nanargmax(h))
        if h[k] > best[0]:
            best = (float(h[k]), float(la[k]), float(lo[k]), float(az[k]), float(d))
    return best


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--radius-km", type=float, default=1.5)
    ap.add_argument("--step-m", type=float, default=30)
    a = ap.parse_args()
    path = ROOT / "sites.json"
    doc = json.loads(path.read_text(encoding="utf-8"))
    dem = PolarDem(ROOT / "data_raw" / DEFAULT_DEM)
    moved = []
    for s in doc["sites"]:
        if s["id"] in PUBLISHED:
            s["verified"], s["position"] = True, PUBLISHED[s["id"]]
            continue
        if s["group"] != "South pole candidate":
            s["verified"], s["position"] = False, "planned target, nominal coordinate"
            continue
        nom = s.get("nominal", {"lat": s["lat"], "lon": s["lon"]})
        h0 = float(dem.height(nom["lat"], nom["lon"]))
        h, la, lo, az, d = crest(dem, nom["lat"], nom["lon"], a.radius_km * 1000, a.step_m)
        print(f"{s['id']:18s} nominal {nom['lat']:.3f},{nom['lon']:.2f} h={h0:6.0f} m -> crest {la:.4f},{lo:.3f} "
              f"h={h:6.0f} m (+{h - h0:.0f} m, {d / 1000:.2f} km at az {az:.0f})")
        s["nominal"] = nom
        s["lat"], s["lon"] = round(la, 4), round(lo, 3)
        s["verified"], s["position"] = True, f"LOLA crest within {a.radius_km:g} km of the nominal point"
        if d > 0:
            moved.append(s["id"])
    doc["note"] = ("lon is EAST longitude 0-360, lat is degrees north, alt_km is height above the 1737.4 km "
                   "reference sphere. `position` says where each coordinate comes from (scripts/snap_sites.py).")
    if a.write:
        path.write_text(json.dumps(doc, indent=1, ensure_ascii=False), encoding="utf-8")
        print("wrote", path)
    print("moved:", " ".join(moved))


if __name__ == "__main__":
    main()
