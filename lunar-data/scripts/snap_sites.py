#!/usr/bin/env python3
"""Check and fix site coordinates.

Landed missions keep the published landing coordinates (LROC / mission reports) and are marked verified.
South-pole candidate regions (rims, ridges, massifs) have no single official point. Their nominal coordinate
is snapped to the highest LOLA point within --radius-km, i.e. the local crest, which is where a lander
would go for sunlight and Earth view. The nominal coordinate is kept in `nominal`.

Candidates with no crest near the nominal point (BEST_LIT below) use another rule instead: the point with the most
sunlight in 2027 among points within the given radius whose slope is landable, using the real LOLA horizon of each
point and the Horizons Sun/Earth directions of the site (public/data/<id>.json must exist).

Needs numpy and the DEM used by make_horizons.py. Usage:
    python scripts/snap_sites.py            # report only
    python scripts/snap_sites.py --write    # update sites.json
Then re-run fetch_horizons.py --only <id> and make_horizons.py for the moved sites.
"""
import argparse
import json

import numpy as np

import math
from datetime import datetime, timezone

from common import ROOT, OUT_DIR
from make_horizons import DEFAULT_DEM, PolarDem, destination, horizon, unit

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


# Sites whose crest search does not converge (the highest point keeps moving as the radius grows, or a much higher
# summit lies just beyond 1.5 km): search radius in km for the best-lit landable point instead.
BEST_LIT = {"haworth": 10.0, "malapert-massif": 10.0}
MAX_SLOPE_DEG = 8.0  # typical lander tolerance (CLPS / Artemis HLS ~8-10 deg)


def enu(lat, lon):
    la, lo = np.radians(lat), np.radians(lon)
    e = np.array([-np.sin(lo), np.cos(lo), 0.0])
    n = np.array([-np.sin(la) * np.cos(lo), -np.sin(la) * np.sin(lo), np.cos(la)])
    return e, n, unit(lat, lon)


def body_vectors(sid, lat, lon, body, year=2027, every_h=3):
    """Moon-fixed unit vectors to the Sun or Earth, from the site's Horizons az/el series (hourly).
    Both are so far away that the same vectors hold anywhere within a few km of the site."""
    doc = json.loads((OUT_DIR / f"{sid}.json").read_text(encoding="utf-8"))
    if "Horizons" not in doc["source"]:
        raise SystemExit(f"{sid}: needs real Horizons data first (fetch_horizons.py --only {sid})")
    t0 = datetime.fromisoformat(doc["start_utc"].replace("Z", "+00:00"))
    i0 = int((datetime(year, 1, 1, tzinfo=timezone.utc) - t0).total_seconds() // 3600)
    i1 = int((datetime(year + 1, 1, 1, tzinfo=timezone.utc) - t0).total_seconds() // 3600)
    az = np.radians(np.array(doc[body]["az"][i0:i1:every_h]))
    el = np.radians(np.array(doc[body]["el"][i0:i1:every_h]))
    e, n, u = enu(lat, lon)
    return (np.cos(el) * np.sin(az))[:, None] * e + (np.cos(el) * np.cos(az))[:, None] * n + np.sin(el)[:, None] * u


def visible_frac(dem, lat, lon, vecs, step_deg=1.0, range_m=100_000):
    """Share of samples with the body centre above the LOLA horizon (2 m mast) at (lat, lon)."""
    az_h, el_h, _, _ = horizon(dem, lat, lon, step_deg, range_m, 2.0)
    e, n, u = enu(lat, lon)
    el = np.degrees(np.arcsin(np.clip(vecs @ u, -1, 1)))
    az = np.degrees(np.arctan2(vecs @ e, vecs @ n)) % 360
    return float(np.mean(el > np.interp(az, np.append(az_h, 360), np.append(el_h, el_h[0]))))


def slope_deg(dem, lat, lon):
    s = dem.scale
    la, lo = destination(lat, lon, np.array([0.0, 90.0, 180.0, 270.0]), s)
    h = dem.height(la, lo)
    return float(np.degrees(np.arctan(math.hypot((h[0] - h[2]) / (2 * s), (h[1] - h[3]) / (2 * s)))))


def distance_az(lat1, lon1, lat2, lon2):
    p1, p2, dl = math.radians(lat1), math.radians(lat2), math.radians(lon2 - lon1)
    d = 1737400 * math.acos(min(1.0, math.sin(p1) * math.sin(p2) + math.cos(p1) * math.cos(p2) * math.cos(dl)))
    az = math.atan2(math.sin(dl) * math.cos(p2), math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl))
    return d, math.degrees(az) % 360


def best_lit(dem, sid, lat, lon, radius_m, data_ll, grid_m=750):
    """Coarse grid over the disc, then a finer grid around the best three.
    data_ll: (lat, lon) the Horizons series in public/data/<id>.json was computed for.
    Returns (sun, earth, slope, lat, lon) for the best point and for the nominal point."""
    sun, earth = body_vectors(sid, *data_ll, "sun"), body_vectors(sid, *data_ll, "earth")

    def evaluate(points, keep_steep=False):
        out = []
        for la, lo in points:
            sl = slope_deg(dem, la, lo)
            if keep_steep or sl <= MAX_SLOPE_DEG:
                out.append((visible_frac(dem, la, lo, sun), visible_frac(dem, la, lo, earth), sl, float(la), float(lo)))
        return out

    def disc(clat, clon, r, step):
        pts = [(clat, clon)]
        for d in np.arange(step, r + 1, step):
            la, lo = destination(clat, clon, np.arange(0, 360, math.degrees(step / d)), d)
            pts += list(zip(la.tolist(), lo.tolist()))
        return pts

    score = lambda c: c[0] + 0.25 * c[1]  # sunlight first, Earth view as a tie-breaker
    coarse = sorted(evaluate(disc(lat, lon, radius_m, grid_m)), key=score, reverse=True)
    print(f"  coarse grid: {len(coarse)} landable points, best sunlight {coarse[0][0]:.1%}", flush=True)
    fine = coarse[:5]
    for c in coarse[:3]:
        fine += evaluate(disc(c[3], c[4], grid_m, grid_m / 4))
    return max(fine, key=score), evaluate([(lat, lon)], keep_steep=True)[0]


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
    ap.add_argument("--only", help="comma-separated site ids to process")
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
        if a.only and s["id"] not in a.only.split(","):
            continue
        h0 = float(dem.height(nom["lat"], nom["lon"]))
        if s["id"] in BEST_LIT:
            r = BEST_LIT[s["id"]]
            print(f"{s['id']}: searching the best-lit landable point within {r:g} km ...", flush=True)
            (sun, earth, sl, la, lo), n0 = best_lit(dem, s["id"], nom["lat"], nom["lon"], r * 1000, (s["lat"], s["lon"]))
            d, az = distance_az(nom["lat"], nom["lon"], la, lo)
            print(f"{s['id']:18s} nominal {nom['lat']:.3f},{nom['lon']:.2f} h={h0:.0f} m sun {n0[0]:.1%} earth {n0[1]:.1%} "
                  f"slope {n0[2]:.1f} deg -> {la:.4f},{lo:.3f} h={float(dem.height(la, lo)):.0f} m sun {sun:.1%} "
                  f"earth {earth:.1%} slope {sl:.1f} deg ({d / 1000:.2f} km at az {az:.0f})")
            s["nominal"] = nom
            s["lat"], s["lon"] = round(la, 4), round(lo % 360, 3)
            s["verified"] = True
            s["position"] = (f"best-lit point in 2027 with slope under {MAX_SLOPE_DEG:g} deg, "
                             f"within {r:g} km of the nominal point (LOLA horizon)")
            moved.append(s["id"])
            continue
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
