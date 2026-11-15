#!/usr/bin/env python3
"""Turn NASA imagery into web textures for the 3D globe (public domain sources).

    Moon colour : NASA SVS CGI Moon Kit (svs.gsfc.nasa.gov/4720) - LRO LROC WAC colour mosaic, lroc_color_poles_8k.tif
    Moon relief : NASA SVS CGI Moon Kit - LRO LOLA elevation, ldem_16.tif (km relative to 1737.4 km)
    Earth       : NASA Blue Marble Next Generation, December 2004, topography + bathymetry, 5400x2700

Needs Pillow + numpy. Usage:
    python scripts/make_textures.py --download
    python scripts/make_textures.py            # files already in data_raw/
Output: public/textures/*.jpg (equirectangular, longitude -180 at the left edge, north up).
"""
import argparse
import urllib.request

import numpy as np
from PIL import Image

from common import ROOT

RAW = ROOT / "data_raw"
OUT = ROOT / "public" / "textures"
SVS = "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/"
SOURCES = {
    "lroc_color_poles_8k.tif": SVS + "lroc_color_poles_8k.tif",
    "ldem_16.tif": SVS + "ldem_16.tif",
    "bmng_200412_5400.jpg": "https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/"
                            "bmng-topography-bathymetry/december/world.topo.bathy.200412.3x5400x2700.jpg",
}
Image.MAX_IMAGE_PIXELS = None


def download():
    RAW.mkdir(parents=True, exist_ok=True)
    for name, url in SOURCES.items():
        if not (RAW / name).exists():
            print("downloading", url)
            urllib.request.urlretrieve(url, RAW / (name + ".part"))
            (RAW / (name + ".part")).rename(RAW / name)


def save(img, name, size, quality=86):
    OUT.mkdir(parents=True, exist_ok=True)
    img.resize(size, Image.LANCZOS).save(OUT / name, quality=quality, optimize=True, progressive=True)
    print("wrote", OUT / name, size)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--download", action="store_true")
    a = ap.parse_args()
    if a.download:
        download()

    save(Image.open(RAW / "lroc_color_poles_8k.tif").convert("RGB"), "moon_lroc_color_4k.jpg", (4096, 2048))

    # LOLA heights (km) -> 8-bit relief for the bump map. Clip the extremes so mid-range relief keeps contrast.
    h = np.asarray(Image.open(RAW / "ldem_16.tif"), dtype=np.float32)
    lo, hi = np.percentile(h, [0.5, 99.5])
    g = np.clip((h - lo) / (hi - lo) * 255, 0, 255).astype(np.uint8)
    print(f"LOLA relief: {h.min():.2f}..{h.max():.2f} km, mapped {lo:.2f}..{hi:.2f} km to 0..255")
    save(Image.fromarray(g, "L"), "moon_lola_relief_2k.jpg", (2048, 1024), quality=92)

    save(Image.open(RAW / "bmng_200412_5400.jpg").convert("RGB"), "earth_bluemarble_dec_4k.jpg", (4096, 2048))


if __name__ == "__main__":
    main()
