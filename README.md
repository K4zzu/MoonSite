# MoonSite — Lunar Landing Site Navigator

A web tool to compare lunar landing sites and dates quickly: where the Sun and Earth sit relative to the
real terrain horizon, how long until sunset or Earthset, and whether a mission gets enough sunlight for
power and enough direct-to-Earth link time. Built for the NASA Space Apps lunar south-pole challenge.

```
MoonSite/
├── MoonSite-web/   React + Vite (JavaScript) app — the 3D navigator
└── lunar-data/     Python pipeline that turns NASA data into static files for the app
```

## Run the app

```
cd MoonSite-web
npm install
npm run dev        # copies the NASA data from lunar-data/public, then starts Vite
npm test           # simulation checks (Node test runner, no extra dependencies)
npm run lint
```

## Data (NASA resources)

| Data | Source |
|---|---|
| Sun and Earth azimuth / elevation at each site, hourly, Dec 2026 – Dec 2028 | NASA/JPL Horizons |
| Terrain horizon and 3D terrain, south-polar sites | LRO LOLA polar DEM (`LDEM_75S_120M`) |
| Moon globe | NASA SVS CGI Moon Kit (LRO LROC WAC colour, LOLA elevation) |
| Earth globe | NASA Blue Marble Next Generation |

The generated files are committed once, in `lunar-data/public`; `MoonSite-web/scripts/sync-data.mjs` copies them into
`MoonSite-web/public` before dev, build and test, so the app runs without Python. Raw downloads (about 230 MB) go to `lunar-data/data_raw/` and are not committed.
See `lunar-data/README.md` to regenerate them.

## Publish

Deployed with **AWS Amplify Hosting** using `amplify.yml` at the repo root (monorepo, app root `MoonSite-web`).
One-time setup in the Amplify console: **Create new app → GitHub → this repo, branch `main`**, tick
**My app is a monorepo** and enter `MoonSite-web`. Every push to `main` then rebuilds and redeploys.
The build uses relative paths, so `MoonSite-web/dist` also works on any other static host.

## Features

- Curated sites (south-pole candidates, CLPS, Apollo, international) and custom coordinates.
- Launch date picker, simulated delays and automatic alternatives (later date or nearby site).
- Three scales in one scene: Earth-to-Moon transfer, Moon globe, standing at the landing site.
- Mission timeline with sunlight and Earth-link bands, time to next sunset / link loss, Sun elevation.
- Verdict per mission against editable requirements (stay length, longest night, minimum link).
- Side-by-side comparison of up to four site/date combinations and a site × date grid.
- 2D sky chart: terrain horizon with Sun and Earth paths; links to Moon Trek, QuickMap and Horizons.
- Launch countdown, a detailed rocket that stages in flight (boosters, fairing, MECO and second-stage ignition), the
  lander unfolding its panels, a blue sky that fades to black on the climb, milestone call-outs, letterbox, sound.
- A realistic landing: deorbit burn, coast down to 15 km, powered descent from ~450 km uprange, pitch-up at high gate,
  then a cut to a camera on the ground that tracks the lander in, its engine lighting the terrain and dust spraying
  out flat (no air), touchdown and a hold before surface operations.
- Operational windows table (sunlight, Earth link, both) with exact UTC times; tap one to jump there.
- Power estimate (1 m² vertical panel) and a mission report: printable PDF and CSV.
- English / Spanish, guided tutorial, keyboard shortcuts, reduce-motion option, works on mobile.

## Accuracy

See `VALIDATION.md`: the app's interpolated Sun/Earth positions differ from independent Horizons queries by less than
0.005°, and long-term illumination with the LOLA horizon matches published south-pole studies.
Site coordinates: published landing sites for flown missions, LOLA-snapped crests for candidate regions (best-lit landable point for Haworth and Malapert Massif)
(`lunar-data/scripts/snap_sites.py`).

`PITCH.md` has the demo video script, slide outline and the mapping to the challenge objectives.

## Credits

- Ephemerides: [NASA/JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) (Solar System Dynamics Group, JPL/Caltech).
- Terrain: LRO Lunar Orbiter Laser Altimeter (LOLA), polar DEM `LDEM_75S_120M`, NASA PDS Geosciences Node.
  Smith, D. E. et al. (2010), *The Lunar Orbiter Laser Altimeter investigation on LRO*, Space Sci. Rev. 150.
- Moon globe: [NASA Scientific Visualization Studio, CGI Moon Kit](https://svs.gsfc.nasa.gov/4720) (LROC WAC colour mosaic,
  LOLA elevation). LROC: NASA/GSFC/Arizona State University.
- Earth globe: [NASA Earth Observatory, Blue Marble Next Generation](https://earthobservatory.nasa.gov/features/BlueMarble) (Stöckli et al.).
- Illumination references: Mazarico, E. et al. (2011), *Illumination conditions of the lunar polar regions using LOLA
  topography*, Icarus 211; Bussey, D. B. J. et al. (2010), Icarus 208.

NASA imagery and data are generally not subject to copyright in the United States; NASA's
[media usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/) apply. The NASA name and logos are
not used to imply endorsement.

## License

Code: MIT (see `LICENSE`). Data and imagery: see Credits.

Not an official NASA product.
