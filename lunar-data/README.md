# Lunar data pipeline

Generates the static JSON files the front end reads. No backend, no database.

## Run

```
python scripts/make_mock.py              # placeholder data, lets the front end start now
python scripts/fetch_horizons.py --test  # one small real query; read the printed header
python scripts/fetch_horizons.py         # real data for every site (2 years, hourly)
pip install numpy pillow
python scripts/make_horizons.py --download   # LOLA terrain horizons + 3D terrain grid for the south-pole sites
python scripts/make_textures.py --download   # NASA Moon (LROC + LOLA) and Earth (Blue Marble) textures
python scripts/snap_sites.py --write         # landed sites: published coords; candidates: snap to the LOLA crest
python scripts/validate.py                   # writes ../VALIDATION.md (needs network for Horizons)
```

Then copy `public/data` and `public/textures` into `../MoonSite-web/public/`.

Python 3.9+. The first three scripts use the standard library only. Output goes to `public/data/`.

## Data contract

`public/data/sites.json` lists the sites (`id, name, group, lat, lon, alt_km, verified`).
`lon` is east longitude 0-360.

`public/data/<id>.json`:

| Field | Meaning |
|---|---|
| `source` | `"JPL Horizons"` or `"MOCK - not valid"`. Show it in the UI. |
| `start_utc`, `step_min`, `n` | Sample `i` is at `start_utc + i * step_min` minutes. |
| `sun.az[i]`, `sun.el[i]` | Sun azimuth and elevation in degrees, above a smooth sphere. |
| `earth.az[i]`, `earth.el[i]` | Same for Earth. |
| `horizon.el[k]` | Terrain horizon elevation in degrees at azimuth `k * step_deg`. |
| `horizon.source` | `"sphere"` (all zeros, placeholder) or `"LOLA <product>"`. |
| `horizon.site_height_m`, `mast_m`, `range_km` | Only with LOLA: terrain height at the site, observer height above ground, how far the search went. |
| `terrain` | Only with LOLA: polar grid for the 3D surface. `na` azimuths x `nr` distances (log-spaced `d0_km`..`d1_km`), `h_m` heights in metres relative to the site, row-major by azimuth. |

A body is visible when its elevation is above `horizon.el` in its azimuth.
`src/lunar.ts` implements this plus time-to-sunset and mission metrics.

## Sources

- Sun and Earth azimuth/elevation: NASA/JPL Horizons API, observer on the Moon (`coord@301`), airless apparent az/el, hourly, Dec 2026 - Dec 2028.
- Terrain horizon and 3D terrain: LRO LOLA polar DEM `LDEM_75S_120M` (PDS Geosciences node mirror at imbrium.mit.edu).
- Globe textures: NASA SVS CGI Moon Kit (LROC WAC colour, LOLA elevation) and NASA Blue Marble Next Generation (December).

## Status

- Horizons: real data for all 17 sites. Azimuth convention confirmed in the reply header: clockwise from north.
- LOLA: horizon and terrain grid for the 8 sites inside `LDEM_75S_120M` with enough margin. The orientation
  check passes (Shackleton crater centre at about -2790 m). Chandrayaan-3 and the non-polar sites keep `"sphere"`.

## Still to do

- Haworth and Malapert Massif reach the 1.5 km snap radius: the crest continues further. Check them in QuickMap.
  After moving a site run `fetch_horizons.py --only <id>` and `make_horizons.py` again.
- Terrain horizons for sites north of 75°S would need a global LOLA product (for example the 118 m/px global DEM).
