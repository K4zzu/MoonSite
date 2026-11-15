# MoonSite — pitch kit

Material for the Space Apps submission: demo video script, slide outline and how each challenge
objective is covered. Numbers below come from the app and from `VALIDATION.md`.

## One-line pitch

Pick a landing site and a date, and in seconds see whether a lander gets enough sunlight for power and
enough direct contact with Earth, using NASA's own data (JPL Horizons, LRO LOLA, LROC), from launch to touchdown.

## 30-second video (the story judges should remember)

| Time | On screen | Voice-over / caption |
|---|---|---|
| 0-3 s | Intro card → **Start mission** | "Can a lander survive at the lunar south pole on this date?" |
| 3-8 s | Countdown T−10 … liftoff, rocket from the onboard camera | "Shackleton Rim, launch 31 Dec 2027." |
| 8-12 s | Booster and fairing separation call-outs, Earth (Blue Marble) below | (music, engine sound) |
| 12-16 s | Arrival at the Moon (LROC), touchdown, lander on the real LOLA terrain | "Touchdown. Sun and Earth both in view: viable." |
| 16-22 s | **Simulate delay** → route replans, red "Not viable — Earth link only 39%" | "The launch slips three days. Now Earth hides behind the terrain." |
| 22-27 s | Numbered alternatives → tap "Same date at Nobile Rim" → green | "One tap finds a viable alternative." |
| 27-30 s | Details: sky chart and operational windows, export report | "Real horizons, real ephemerides, ready for the planning team." |

Record at 1920×1080 in Chrome (`npm run dev`, sound on). Use Space to start and skip.

## 2-minute walkthrough (judging demo)

1. Problem: the south pole Sun stays within ~1.5° of the horizon; a hill can hide it for days (Explain → Earth vs Moon).
2. Site × date grid: viable / marginal / not viable at a glance; pick up to four and compare side by side.
3. One mission end to end (countdown, staging, transfer, landing) with the story line explaining each phase.
4. At the site: Sun and Earth over the LOLA horizon, time to sunset / link loss, Sun elevation.
5. Schedule change: Simulate delay → verdict changes → alternatives.
6. Details: windows table (tap a window to jump there), sky chart, power estimate, PDF/CSV report, links to Moon Trek, QuickMap, Horizons.
7. Real case: IM-2 Athena (March 2025). Its date was a good window but the Sun stood 2.5° high; it landed in a crater on
   its side and lost power in 13 h. The grey ghost route is the same mission one week late without replanning: 58%
   sunlight, not viable. Simulate delay, then pick an alternative.
8. Trust: validation numbers and data sources.

## Slides

1. **Title**: MoonSite: Lunar Landing Site Navigator.
2. **Problem**: tools exist (Horizons, QuickMap, Moon Trek) but comparing site/date scenarios takes many interfaces and raw tables.
3. **Solution**: one scene, three scales; viable or not in one colour and one sentence.
4. **Demo GIF** of the 30-second story.
5. **Data pipeline**: JPL Horizons (hourly az/el, 17 sites, 2 years) + LOLA polar DEM (horizons, 3D terrain) + LROC/Blue Marble textures → `lunar-data` → static files → web app.
6. **Accuracy**: interpolation error < 0.005° vs independent Horizons queries; Shackleton connecting ridge lit 86% of 2027, in line with published LOLA studies (~80-90%).
7. **For planners**: windows table, requirements, alternatives, PDF/CSV report.
8. **For educators and the public**: countdown and staging, story line, tutorial, EN/ES, mobile.
9. **Next steps**: global LOLA DEM for all latitudes, live Horizons queries for custom points, relay satellites.

## Challenge objectives → where they are in the app

| Objective | In MoonSite |
|---|---|
| Interactive site selection and comparison | Curated list (south-pole candidates, CLPS, Apollo, international), custom coordinates, site × date grid, side-by-side compare (up to 4) |
| Date and time flexibility | Date picker and slider (−10/+21 days), simulate delay, timeline scrubbing, 2 years of hourly data |
| Sun and Earth position visualization | 3D surface view with real LOLA terrain, Sun and Earth paths, 2D sky chart over the terrain horizon |
| Time before sunset / Earthset | "Night begins in", "Earth link lost in", windows table with exact UTC times |
| Power and communication assessment | Sun elevation, % sunlight, % link, longest night, mean panel power and kWh/day, verdict against requirements |
| Multiple visualization approaches | 3D globe and surface, 2D sky chart, timeline bands, grid heat map, printable report |
| Temporal dynamics | Animated mission, cinematic slow-downs at key events, scrubbable timeline |
| Accessibility across skill levels | Story line in plain words, Explain mode, tutorial, EN/ES, keyboard shortcuts, reduce motion, mobile layout |
| Ephemeris data (Horizons) | `lunar-data/scripts/fetch_horizons.py`, airless apparent az/el from a lunar observer |
| LOLA topography / horizon | `lunar-data/scripts/make_horizons.py` (horizon to 150 km, 2 m mast) and 3D terrain grid |
| No atmosphere | Purely geometric horizon (terrain + lunar curvature), no refraction; documented in VALIDATION.md |
| Respond to schedule changes | Simulate delay, automatic alternatives (later date or nearby site), original plan kept as a ghost route |
