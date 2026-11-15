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
python scripts/fetch_horizons.py --only mons-mouton --start 2025-02-01 --days 120 --suffix 2025   # IM-2 real case
```

The web app copies `public/data` and `public/textures` into `../MoonSite-web/public/` by itself (`npm run dev` / `build`).

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
The web app implements this in `MoonSite-web/src/lib/sim.js` (visibility, time to sunset, mission metrics) and reads the
files with `MoonSite-web/src/lib/lunarData.js`; `npm test` there checks it against these files.

## Sources

- Sun and Earth azimuth/elevation: NASA/JPL Horizons API, observer on the Moon (`coord@301`), airless apparent az/el, hourly, Dec 2026 - Dec 2028.
- Terrain horizon and 3D terrain: LRO LOLA polar DEM `LDEM_75S_120M` (PDS Geosciences node mirror at imbrium.mit.edu).
- Globe textures: NASA SVS CGI Moon Kit (LROC WAC colour, LOLA elevation) and NASA Blue Marble Next Generation (December).

## Status

- Horizons: real data for all 17 sites. Azimuth convention confirmed in the reply header: clockwise from north.
- LOLA: horizon and terrain grid for the 8 sites inside `LDEM_75S_120M` with enough margin. The orientation
  check passes (Shackleton crater centre at about -2790 m). Chandrayaan-3 and the non-polar sites keep `"sphere"`.

## Site placement

- Landed missions: published landing coordinates.
- Candidate regions with a clear crest near the nominal point: the highest LOLA point within 1.5 km.
- Haworth and Malapert Massif have no such crest (at Haworth the terrain keeps rising for 12 km; at Malapert the
  main summit is 6.7 km away), so `snap_sites.py` picks the best-lit point in 2027 with a slope under 8 deg within
  10 km of the nominal point, using each candidate's own LOLA horizon (`BEST_LIT` in the script). Result: Haworth
  3.9 km east (sunlight 34% -> 57%), Malapert 5.1 km west (41% -> 80%). Malapert gives up its 100% Earth view for
  82%, in exchange for twice the sunlight.
- After moving a site: `fetch_horizons.py --only <id>`, `make_horizons.py --only <id>`, update the entry in
  `public/data/sites.json` (`--only` does not rewrite the index) and run `validate.py`.
- If Python cannot verify the Horizons certificate (old CA bundle), point `SSL_CERT_FILE` at a current bundle;
  do not turn verification off.

## Still to do

- Terrain horizons for sites north of 75°S would need a global LOLA product (for example the 118 m/px global DEM).
