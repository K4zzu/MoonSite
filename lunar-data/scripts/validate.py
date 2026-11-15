#!/usr/bin/env python3
"""Accuracy checks for the data the app uses. Writes VALIDATION.md.

1. Interpolation: the app reads hourly Horizons samples and interpolates linearly. Here independent Horizons
   queries at the half hour (times the app never stored) are compared with that interpolation.
2. Horizon geometry: Sun elevation from Horizons is measured against a smooth sphere. The LOLA horizon decides
   visibility. For each polar site we report the share of time the Sun centre is above the LOLA horizon over a
   full year (the long-term illumination statistic used in the literature, e.g. Mazarico et al. 2011, Icarus 211).
Standard library + numpy. Usage: python scripts/validate.py
"""
import json
import math
from datetime import datetime, timedelta, timezone

import numpy as np

from common import ROOT, OUT_DIR, load_sites
from fetch_horizons import BODIES, parse, query

CHECK_SITES = ["shackleton-ridge", "nobile-rim", "apollo-11"]
CHECK_DAYS = 3


def load(site_id):
    return json.loads((OUT_DIR / f"{site_id}.json").read_text(encoding="utf-8"))


def interp(d, body, t):
    t0 = datetime.strptime(d["start_utc"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    x = (t - t0).total_seconds() / 60 / d["step_min"]
    i = int(math.floor(x)); k = x - i
    az0, az1 = d[body]["az"][i], d[body]["az"][i + 1]
    daz = (az1 - az0 + 540) % 360 - 180
    return (az0 + daz * k) % 360, d[body]["el"][i] + (d[body]["el"][i + 1] - d[body]["el"][i]) * k


def horizon_at(h, az):
    x = (az % 360) / h["step_deg"]; i = int(x) % len(h["el"]); j = (i + 1) % len(h["el"])
    return h["el"][i] + (h["el"][j] - h["el"][i]) * (x - int(x))


def main():
    sites = {s["id"]: s for s in load_sites()}
    lines = ["# Validation", "", f"Generated {datetime.now(timezone.utc):%Y-%m-%d %H:%M} UTC by `lunar-data/scripts/validate.py`.", ""]

    lines += ["## 1. Interpolation against independent Horizons queries", "",
              f"Half-hour samples over {CHECK_DAYS} days (times not stored in the app), compared with the app's linear interpolation of the hourly series.", "",
              "| Site | Body | Samples | Max elevation error | Max azimuth error |", "|---|---|---|---|---|"]
    start = datetime(2027, 12, 31, 0, 30, tzinfo=timezone.utc)
    for sid in CHECK_SITES:
        d = load(sid)
        for body in ("sun", "earth"):
            rows = parse(query(sites[sid], BODIES[body], start, start + timedelta(days=CHECK_DAYS), 60))
            de, da = [], []
            for n, (az, el) in enumerate(rows):
                iaz, iel = interp(d, body, start + timedelta(hours=n))
                de.append(abs(iel - el)); da.append(abs((iaz - az + 540) % 360 - 180) * math.cos(math.radians(el)))
            lines.append(f"| {sites[sid]['name']} | {body} | {len(rows)} | {max(de):.4f}° | {max(da):.4f}° |")
            print(sid, body, f"max dEl {max(de):.4f} deg, max dAz {max(da):.4f} deg")

    lines += ["", "Azimuth error is scaled by cos(elevation) (angular distance on the sky).", "",
              "## 2. Long-term illumination with the LOLA horizon", "",
              "Share of hours in 2027 with the Sun centre above the terrain horizon (2 m above ground), and with Earth above it.", "",
              "| Site | Horizon source | Sun above terrain | Earth above terrain | Longest night |", "|---|---|---|---|---|"]
    for sid, s in sites.items():
        d = load(sid)
        if d["horizon"]["source"] == "sphere":
            continue
        t0 = datetime.strptime(d["start_utc"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        a = int((datetime(2027, 1, 1, tzinfo=timezone.utc) - t0).total_seconds() // 3600)
        b = a + 365 * 24
        sun = [d["sun"]["el"][i] > horizon_at(d["horizon"], d["sun"]["az"][i]) for i in range(a, b)]
        earth = [d["earth"]["el"][i] > horizon_at(d["horizon"], d["earth"]["az"][i]) for i in range(a, b)]
        night = longest = 0
        for x in sun:
            night = 0 if x else night + 1; longest = max(longest, night)
        lines.append(f"| {s['name']} | {d['horizon']['source']} | {100 * np.mean(sun):.1f}% | {100 * np.mean(earth):.1f}% | {longest} h |")

    lines += ["", "For reference, published LOLA-based studies report that the most illuminated south-polar points near Shackleton reach",
              "roughly 80-90% average illumination (Mazarico et al. 2011; Bussey et al. 2010). Differences come",
              "from exact point location, observer height and DEM resolution (120 m here).", "",
              "## Known limits", "",
              "- The Sun is treated as lit when its centre is above the horizon (the app also models the partial disc, ±0.27°).",
              "- No atmosphere, so no refraction: the horizon is purely geometric (terrain plus the curvature of the Moon).",
              "- DEM resolution 120 m: obstacles smaller than that near the lander are not in the horizon.",
              "- Sites north of 75°S use a flat horizon (no LOLA polar coverage)."]
    (ROOT.parent / "VALIDATION.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("wrote", ROOT.parent / "VALIDATION.md")


if __name__ == "__main__":
    main()
