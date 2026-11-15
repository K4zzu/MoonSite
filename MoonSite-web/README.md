# MoonSite — Lunar Landing Site Navigator

React + Vite (JavaScript) port of the Claude Design screen `Lunar Navigator.dc.html`.

```
npm install
npm run dev      # http://localhost:5173
npm run build
```

## Structure

- `src/components/LunarNavigator.jsx` — the screen: the design's component logic plus its template converted to JSX.
- `src/components/LunarNavigator.hover.css` — the design's hover styles.
- `src/lib/sim.js` — ephemerides, transfer orbit, site illumination, mission verdict.
- `src/lib/scene.js` — Three.js scene (Earth, Moon, route, landing site).
- `src/lib/extras.js` — texture detail, EN/ES translations, story text, tutorial.
- `src/lib/lunarData.js` — reads `public/data/*.json` produced by `../lunar-data`.
- `public/data/` — copy of `../lunar-data/public/data`. Copy it again after you regenerate the data.

## Data (NASA resources)

| What | Source | Where |
|---|---|---|
| Sun and Earth azimuth / elevation, hourly, Dec 2026 - Dec 2028, 17 sites | NASA/JPL **Horizons** API (observer on the Moon, airless) | `public/data/<id>.json` |
| Terrain horizon + 3D terrain around 8 south-polar sites | LRO **LOLA** polar DEM `LDEM_75S_120M` | `horizon`, `terrain` in the same files |
| Moon globe colour and relief | NASA SVS CGI Moon Kit (LRO **LROC** WAC mosaic, LOLA elevation) | `public/textures/moon_*.jpg` |
| Earth globe | NASA **Blue Marble** Next Generation, December | `public/textures/earth_*.jpg` |

All of it is produced by `../lunar-data` (see its README) and copied here. To refresh:

```
cd ../lunar-data
python scripts/fetch_horizons.py
python scripts/make_horizons.py --download
python scripts/make_textures.py --download
cp public/data/*.json ../MoonSite-web/public/data/
cp public/textures/* ../MoonSite-web/public/textures/
```

How the app uses it:
- Files whose `source` is JPL Horizons replace the analytic ephemerides; MOCK files are ignored.
- A LOLA horizon decides when the Sun and Earth are above the terrain; a LOLA terrain grid builds the 3D surface.
- Sites without LOLA coverage (latitude north of about 77°S, and custom coordinates) use the procedural horizon. Custom coordinates also use the analytic ephemerides.
- Details shows a 2D sky chart (terrain horizon, Sun and Earth paths), the data source of each site and links to Moon Trek, LROC QuickMap and JPL Horizons.

The footer always says which data is in use.
