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

## Features

- Curated sites (south-pole candidates, CLPS, Apollo, international) and custom coordinates.
- Launch date picker, simulated delays and automatic alternatives (later date or nearby site).
- Three scales in one scene: Earth-to-Moon transfer, Moon globe, standing at the landing site.
- Mission timeline with sunlight and Earth-link bands, time to next sunset / link loss, Sun elevation.
- Verdict per mission against editable requirements (stay length, longest night, minimum link).
- Side-by-side comparison of up to four site/date combinations and a site × date grid.
- 2D sky chart: terrain horizon with Sun and Earth paths; links to Moon Trek, QuickMap and Horizons.
- English / Spanish, guided tutorial, reduce-motion option, works on mobile.

Not an official NASA product.
