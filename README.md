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
npm run dev
```

## Data (NASA resources)

| Data | Source |
|---|---|
| Sun and Earth azimuth / elevation at each site, hourly, Dec 2026 – Dec 2028 | NASA/JPL Horizons |
| Terrain horizon and 3D terrain, south-polar sites | LRO LOLA polar DEM (`LDEM_75S_120M`) |
| Moon globe | NASA SVS CGI Moon Kit (LRO LROC WAC colour, LOLA elevation) |
| Earth globe | NASA Blue Marble Next Generation |

The generated files are committed (`lunar-data/public`, copied into `MoonSite-web/public`), so the app
runs without Python. Raw downloads (about 230 MB) go to `lunar-data/data_raw/` and are not committed.
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
- Launch countdown, a detailed rocket that stages in flight (boosters, fairing, core), the lander unfolding its
  panels, exhaust and smoke, milestone call-outs, camera shake, letterbox, synthesized sound.
- Operational windows table (sunlight, Earth link, both) with exact UTC times; tap one to jump there.
- Power estimate (1 m² vertical panel) and a mission report: printable PDF and CSV.
- English / Spanish, guided tutorial, keyboard shortcuts, reduce-motion option, works on mobile.

## Accuracy

See `VALIDATION.md`: the app's interpolated Sun/Earth positions differ from independent Horizons queries by less than
0.005°, and long-term illumination with the LOLA horizon matches published south-pole studies.
Site coordinates: published landing sites for flown missions, LOLA-snapped crests for candidate regions
(`lunar-data/scripts/snap_sites.py`).

`PITCH.md` has the demo video script, slide outline and the mapping to the challenge objectives.

Not an official NASA product.
