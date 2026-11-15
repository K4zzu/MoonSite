#!/usr/bin/env python3
"""Compute the terrain horizon around each south-polar site from a LOLA polar DEM.

For every azimuth it walks outward over the terrain and keeps the highest
elevation angle seen from the site. The result replaces `horizon` in
public/data/<id>.json (run make_mock.py or fetch_horizons.py first).

Needs numpy:  pip install numpy
Usage:
    python scripts/make_horizons.py --download     # fetch the DEM (about 111 MB) then run
    python scripts/make_horizons.py                # DEM already in data_raw/
    python scripts/make_horizons.py --dem data_raw/LDEM_80S_80M --only shackleton-ridge
Sites the DEM does not cover (with a margin) are skipped and keep the smooth-sphere horizon.
"""
import argparse
import json
import math
import re
import sys
import urllib.request
from pathlib import Path

import numpy as np

from common import ROOT, OUT_DIR, load_sites

BASE_URL = "https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/"
DEFAULT_DEM = "LDEM_75S_120M"
R_MOON = 1_737_400.0  # m, LOLA reference radius


# ---------- DEM reading ----------

def read_label(path):
    """Tiny PDS3 label reader: KEY = value pairs, units and quotes stripped."""
    out = {}
    for line in path.read_text(errors="replace").splitlines():
        m = re.match(r"\s*([A-Z_^:]+)\s*=\s*(.+?)\s*$", line)
        if m:
            out.setdefault(m.group(1), re.sub(r"<.*?>", "", m.group(2)).strip().strip('"'))
    return out


class PolarDem:
    """South-polar stereographic LOLA grid. Pole at the image centre, lon 0 up, 90E right."""

    def __init__(self, stem):
        lbl_path = next((p for p in (stem.with_suffix(".LBL"), stem.with_suffix(".lbl")) if p.exists()), None)
        img_path = next((p for p in (stem.with_suffix(".IMG"), stem.with_suffix(".img")) if p.exists()), None)
        if not lbl_path or not img_path:
            sys.exit(f"Missing {stem}.IMG / .LBL - run with --download")
        L = read_label(lbl_path)
        self.name = stem.name
        self.lines, self.samples = int(L["LINES"]), int(L["LINE_SAMPLES"])
        bits = int(L.get("SAMPLE_BITS", 16))
        stype = L.get("SAMPLE_TYPE", "LSB_INTEGER")
        if "REAL" in stype:
            dtype = "<f4" if "PC" in stype else ">f4"
        else:
            dtype = ("<" if "LSB" in stype or "PC" in stype else ">") + f"i{bits // 8}"
        self.scale = float(L["MAP_SCALE"])
        if "KM" in lbl_path.read_text(errors="replace").split("MAP_SCALE", 1)[1].split("\n", 1)[0].upper():
            self.scale *= 1000.0
        self.sf = float(L.get("SCALING_FACTOR", 0.5))
        unit = L.get("UNIT", "METER").upper()
        self.to_m = 1000.0 if unit.startswith("KILO") else 1.0
        if float(L.get("CENTER_LATITUDE", -90)) > 0:
            sys.exit("This script handles south-polar products only")
        expected = self.lines * self.samples * np.dtype(dtype).itemsize
        if img_path.stat().st_size != expected:
            sys.exit(f"{img_path.name}: size {img_path.stat().st_size} != expected {expected}. Incomplete download?")
        self.data = np.memmap(img_path, dtype=dtype, mode="r", shape=(self.lines, self.samples))
        self.c_row, self.c_col = (self.lines - 1) / 2, (self.samples - 1) / 2
        self.half_extent = self.scale * (min(self.lines, self.samples) - 1) / 2

    def xy(self, lat, lon):
        """Stereographic metres from the pole (x toward 90E, y toward lon 0)."""
        r = 2 * R_MOON * np.tan(np.radians(90 + lat) / 2)
        return r * np.sin(np.radians(lon)), r * np.cos(np.radians(lon))

    def height(self, lat, lon):
        """Bilinear terrain height in metres above the reference sphere. NaN off the map."""
        x, y = self.xy(np.asarray(lat, float), np.asarray(lon, float))
        col, row = self.c_col + x / self.scale, self.c_row - y / self.scale
        ok = (col >= 0) & (col <= self.samples - 1) & (row >= 0) & (row <= self.lines - 1)
        c0 = np.clip(np.floor(col).astype(int), 0, self.samples - 2)
        r0 = np.clip(np.floor(row).astype(int), 0, self.lines - 2)
        fc, fr = col - c0, row - r0
        d = self.data
        h = (d[r0, c0] * (1 - fc) * (1 - fr) + d[r0, c0 + 1] * fc * (1 - fr)
             + d[r0 + 1, c0] * (1 - fc) * fr + d[r0 + 1, c0 + 1] * fc * fr)
        return np.where(ok, h * self.sf * self.to_m, np.nan)

    def margin_m(self, lat, lon):
        """Distance from the site to the nearest map edge."""
        x, y = self.xy(lat, lon)
        return self.half_extent - max(abs(x), abs(y))


# ---------- geometry ----------

def unit(lat, lon):
    la, lo = np.radians(lat), np.radians(lon)
    return np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)], axis=-1)


def destination(lat, lon, az_deg, dist_m):
    """Point reached from (lat, lon) going dist_m along azimuth az (clockwise from north)."""
    p, l = math.radians(lat), math.radians(lon)
    a, d = np.radians(az_deg), dist_m / R_MOON
    lat2 = np.arcsin(np.sin(p) * np.cos(d) + np.cos(p) * np.sin(d) * np.cos(a))
    lon2 = l + np.arctan2(np.sin(a) * np.sin(d) * np.cos(p), np.cos(d) - np.sin(p) * np.sin(lat2))
    return np.degrees(lat2), np.degrees(lon2) % 360


def horizon(dem, lat, lon, step_deg, range_m, mast_m):
    h_site = float(dem.height(lat, lon))
    if math.isnan(h_site):
        raise ValueError("site is off the map")
    up = unit(lat, lon)
    eye = up * (R_MOON + h_site + mast_m)
    az = np.arange(0, 360, step_deg)
    fine = dem.scale / 2
    dist = np.concatenate([np.arange(fine, 5000, fine), np.arange(5000, range_m, dem.scale)])
    A, D = np.meshgrid(az, dist, indexing="ij")
    lat2, lon2 = destination(lat, lon, A, D)
    h = dem.height(lat2, lon2)
    P = unit(lat2, lon2) * (R_MOON + np.nan_to_num(h))[..., None]
    v = P - eye
    el = np.degrees(np.arcsin((v @ up) / np.linalg.norm(v, axis=-1)))
    el = np.where(np.isnan(h), -90.0, el)
    return az, el.max(axis=1), D[np.arange(len(az)), el.argmax(axis=1)], h_site


# Polar grid the front end turns into the 3D surface around the lander (same layout as its mesh):
# NA azimuths (clockwise from north) x NR distances, log-spaced from D0 to D1 km.
TERRAIN_NA, TERRAIN_NR, TERRAIN_D0_KM, TERRAIN_D1_KM = 240, 110, 0.002, 160.0


def terrain_grid(dem, lat, lon, h_site, max_km):
    az = np.arange(TERRAIN_NA) * 360.0 / TERRAIN_NA
    d1 = min(TERRAIN_D1_KM, max_km)
    dist = TERRAIN_D0_KM * (TERRAIN_D1_KM / TERRAIN_D0_KM) ** (np.arange(TERRAIN_NR) / (TERRAIN_NR - 1))
    A, D = np.meshgrid(az, np.minimum(dist, d1) * 1000.0, indexing="ij")
    lat2, lon2 = destination(lat, lon, A, D)
    h = dem.height(lat2, lon2) - h_site
    # off the map: hold the last value along each azimuth
    for i in range(h.shape[0]):
        row = h[i]
        for j in range(1, len(row)):
            if np.isnan(row[j]):
                row[j] = row[j - 1]
    h = np.nan_to_num(h)
    return {
        "na": TERRAIN_NA, "nr": TERRAIN_NR, "d0_km": TERRAIN_D0_KM, "d1_km": TERRAIN_D1_KM,
        "h_m": [int(round(float(x))) for x in h.ravel()],  # row-major: azimuth, then distance
        "source": f"LOLA {dem.name}",
    }


# ---------- main ----------

def download(stem):
    stem.parent.mkdir(parents=True, exist_ok=True)
    for ext in (".LBL", ".IMG"):
        dest = stem.with_suffix(ext)
        if dest.exists():
            continue
        url = BASE_URL + stem.name + ext
        print(f"downloading {url}")
        tmp = dest.with_suffix(ext + ".part")
        urllib.request.urlretrieve(url, tmp)
        tmp.rename(dest)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dem", default=str(ROOT / "data_raw" / DEFAULT_DEM), help="path without extension")
    ap.add_argument("--download", action="store_true")
    ap.add_argument("--only", help="site id")
    ap.add_argument("--step-deg", type=float, default=0.5)
    ap.add_argument("--range-km", type=float, default=150)
    ap.add_argument("--mast-m", type=float, default=2.0, help="height of the solar panel / antenna above ground")
    a = ap.parse_args()

    stem = Path(a.dem)
    if a.download:
        download(stem)
    dem = PolarDem(stem)
    print(f"{dem.name}: {dem.samples}x{dem.lines} px, {dem.scale:g} m/px, DN x {dem.sf} {'km' if dem.to_m > 1 else 'm'}")

    # Orientation check: Shackleton's floor is kilometres below the reference sphere.
    floor = float(dem.height(-89.67, 129.8))
    print(f"check: height at Shackleton crater centre = {floor:.0f} m "
          f"({'looks right' if floor < -1500 else 'WARNING: expected a deep negative value, map orientation may be wrong'})")

    for s in load_sites():
        if a.only and s["id"] != a.only:
            continue
        if s["lat"] > -60:
            continue
        margin = dem.margin_m(s["lat"], s["lon"])
        if margin < 50_000:
            print(f"{s['id']}: skipped, only {margin / 1000:.0f} km of map around it")
            continue
        rng = min(a.range_km * 1000, margin)
        path = OUT_DIR / f"{s['id']}.json"
        if not path.exists():
            print(f"{s['id']}: skipped, {path.name} not found (run fetch_horizons.py or make_mock.py first)")
            continue
        az, el, far, h_site = horizon(dem, s["lat"], s["lon"], a.step_deg, rng, a.mast_m)
        doc = json.loads(path.read_text(encoding="utf-8"))
        doc["horizon"] = {
            "step_deg": a.step_deg,
            "el": [round(float(e), 2) for e in el],
            "source": f"LOLA {dem.name}",
            "site_height_m": round(h_site, 1),
            "mast_m": a.mast_m,
            "range_km": round(rng / 1000, 1),
        }
        doc["terrain"] = terrain_grid(dem, s["lat"], s["lon"], h_site, rng / 1000)
        path.write_text(json.dumps(doc, separators=(",", ":")), encoding="utf-8")
        k = int(el.argmax())
        print(f"{s['id']}: site height {h_site:.0f} m, horizon {el.min():.2f}..{el.max():.2f} deg "
              f"(highest at az {az[k]:g}, {far[k] / 1000:.1f} km away), range {rng / 1000:.0f} km")
    print("done")


if __name__ == "__main__":
    main()
