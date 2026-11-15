#!/usr/bin/env python3
"""Download Sun and Earth azimuth/elevation for every site from NASA/JPL Horizons.

Standard library only. Usage:
    python scripts/fetch_horizons.py --test                  # 6 hours, 1 site, prints the raw reply
    python scripts/fetch_horizons.py                         # all sites, default 2 years hourly
    python scripts/fetch_horizons.py --only shackleton-ridge --start 2026-12-01 --days 730
"""
import argparse
import json
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

from common import load_sites, write_site, write_index

API = "https://ssd.jpl.nasa.gov/api/horizons.api"
BODIES = {"sun": "10", "earth": "399"}
CHUNK_DAYS = 365  # one request per year keeps each reply small


def query(site, body_id, start, stop, step_min):
    """Return the raw Horizons result text for one body seen from one lunar site."""
    params = {
        "format": "json",
        "COMMAND": f"'{body_id}'",
        "OBJ_DATA": "'NO'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": "'coord@301'",            # user coordinates on the Moon (301)
        "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": f"'{site['lon']},{site['lat']},{site.get('alt_km', 0)}'",  # E-lon, lat, alt km
        "START_TIME": f"'{start:%Y-%m-%d %H:%M}'",
        "STOP_TIME": f"'{stop:%Y-%m-%d %H:%M}'",
        "STEP_SIZE": f"'{step_min} m'",
        "QUANTITIES": "'4'",                # apparent azimuth and elevation
        "CSV_FORMAT": "'YES'",
        "ANG_FORMAT": "'DEG'",
        "APPARENT": "'AIRLESS'",            # no atmosphere, no refraction
    }
    url = API + "?" + urllib.parse.urlencode(params)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                doc = json.loads(r.read().decode("utf-8"))
            break
        except Exception as exc:  # network hiccup or 503: wait and retry
            if attempt == 3:
                raise
            print(f"    retry after error: {exc}", file=sys.stderr)
            time.sleep(5 * (attempt + 1))
    if "error" in doc:
        raise RuntimeError(f"Horizons error: {doc['error']}")
    return doc["result"]


def parse(result):
    """Extract (az, el) pairs from the block between $$SOE and $$EOE."""
    if "$$SOE" not in result:
        raise RuntimeError("No data block in Horizons reply:\n" + result[-1500:])
    block = result.split("$$SOE", 1)[1].split("$$EOE", 1)[0]
    rows = []
    for line in block.strip().splitlines():
        nums = []
        for field in line.split(",")[1:]:   # field 0 is the date
            try:
                nums.append(float(field))
            except ValueError:
                pass                        # presence flags and blanks
        if len(nums) < 2:
            raise RuntimeError(f"Could not read az/el from line: {line!r}")
        az, el = nums[-2], nums[-1]
        if not (0 <= az <= 360 and -90 <= el <= 90):
            raise RuntimeError(f"Values out of range in line: {line!r}")
        rows.append((az, el))
    return rows


def fetch_series(site, body_id, start, days, step_min):
    out = []
    t = start
    end = start + timedelta(days=days)
    while t < end:
        t2 = min(t + timedelta(days=CHUNK_DAYS), end)
        stop = t2 - timedelta(minutes=step_min)   # Horizons includes the stop time
        rows = parse(query(site, body_id, t, stop, step_min))
        expected = int((t2 - t).total_seconds() // 60 // step_min)
        if len(rows) != expected:
            raise RuntimeError(f"Expected {expected} rows, got {len(rows)}")
        out.extend(rows)
        t = t2
        time.sleep(1)                             # be polite to the API
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", default="2026-12-01")
    ap.add_argument("--days", type=int, default=730)
    ap.add_argument("--step-min", type=int, default=60)
    ap.add_argument("--only", help="site id")
    ap.add_argument("--test", action="store_true")
    a = ap.parse_args()

    sites = load_sites()
    if a.only:
        sites = [s for s in sites if s["id"] == a.only] or sys.exit(f"unknown site {a.only}")
    start = datetime.strptime(a.start, "%Y-%m-%d").replace(tzinfo=timezone.utc)

    if a.test:
        s = sites[0]
        raw = query(s, BODIES["sun"], start, start + timedelta(hours=6), 60)
        print(raw)
        print("PARSED (az, el):", parse(raw))
        print("\nCheck in the header above that the center is the Moon (301) and the "
              "site coordinates match:", s["lon"], s["lat"])
        return

    start_iso = start.strftime("%Y-%m-%dT%H:%M:%SZ")
    n = 0
    for s in sites:
        print(f"{s['id']}: Sun...", flush=True)
        sun = fetch_series(s, BODIES["sun"], start, a.days, a.step_min)
        print(f"{s['id']}: Earth...", flush=True)
        earth = fetch_series(s, BODIES["earth"], start, a.days, a.step_min)
        path = write_site(s, start_iso, a.step_min, sun, earth, "JPL Horizons")
        n = len(sun)
        print(f"  wrote {path} ({n} steps)")
    if not a.only:
        write_index(sites, start_iso, a.step_min, n, "JPL Horizons")
    print("done")


if __name__ == "__main__":
    main()
