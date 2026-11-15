#!/usr/bin/env python3
"""Write PLACEHOLDER data in the final format so the front end can start now.

Uses a simplified model (circular orbits, sinusoidal libration). The shapes are
realistic; the numbers are NOT valid. Replace with fetch_horizons.py output.
"""
import math
from datetime import datetime, timezone

from common import load_sites, write_site, write_index

START = datetime(2026, 12, 1, tzinfo=timezone.utc)
DAYS, STEP_MIN = 730, 60


def az_el(lat, lon, sub_lat, sub_lon):
    """Direction of a far body whose sub-point on the Moon is (sub_lat, sub_lon)."""
    p, l = math.radians(lat), math.radians(lon)
    sp, sl = math.radians(sub_lat), math.radians(sub_lon)
    d = sl - l
    el = math.asin(math.sin(p) * math.sin(sp) + math.cos(p) * math.cos(sp) * math.cos(d))
    az = math.atan2(math.sin(d) * math.cos(sp),
                    math.cos(p) * math.sin(sp) - math.sin(p) * math.cos(sp) * math.cos(d))
    return math.degrees(az) % 360, math.degrees(el)


def main():
    sites = load_sites()
    n = DAYS * 24 * 60 // STEP_MIN
    for s in sites:
        sun, earth = [], []
        for i in range(n):
            d = i * STEP_MIN / 1440
            sun_lon = (-360 * d / 29.5306) % 360                    # Sun drifts westward
            sun_lat = 1.54 * math.sin(2 * math.pi * d / 346.62)     # lunar "seasons"
            e_lon = 7.9 * math.sin(2 * math.pi * d / 27.555)        # libration in longitude
            e_lat = 6.7 * math.sin(2 * math.pi * d / 27.212)        # libration in latitude
            sun.append(az_el(s["lat"], s["lon"], sun_lat, sun_lon))
            earth.append(az_el(s["lat"], s["lon"], e_lat, e_lon))
        write_site(s, START.strftime("%Y-%m-%dT%H:%M:%SZ"), STEP_MIN, sun, earth, "MOCK - not valid")
    write_index(sites, START.strftime("%Y-%m-%dT%H:%M:%SZ"), STEP_MIN, n, "MOCK - not valid")
    print(f"wrote {len(sites)} mock sites, {n} steps each")


if __name__ == "__main__":
    main()
