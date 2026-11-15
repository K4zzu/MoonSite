# Validation

Generated 2026-11-15 15:37 UTC by `lunar-data/scripts/validate.py`.

## 1. Interpolation against independent Horizons queries

Half-hour samples over 3 days (times not stored in the app), compared with the app's linear interpolation of the hourly series.

| Site | Body | Samples | Max elevation error | Max azimuth error |
|---|---|---|---|---|
| Shackleton connecting ridge | sun | 73 | 0.0028° | 0.0037° |
| Shackleton connecting ridge | earth | 73 | 0.0038° | 0.0041° |
| Nobile rim | sun | 73 | 0.0047° | 0.0028° |
| Nobile rim | earth | 73 | 0.0048° | 0.0047° |
| Apollo 11 | sun | 73 | 0.0035° | 0.0029° |
| Apollo 11 | earth | 73 | 0.0038° | 0.0017° |

Azimuth error is scaled by cos(elevation) (angular distance on the sky).

## 2. Long-term illumination with the LOLA horizon

Share of hours in 2027 with the Sun centre above the terrain horizon (2 m above ground), and with Earth above it.

| Site | Horizon source | Sun above terrain | Earth above terrain | Longest night |
|---|---|---|---|---|
| Haworth | LOLA LDEM_75S_120M | 56.5% | 58.4% | 416 h |
| de Gerlache Rim | LOLA LDEM_75S_120M | 83.0% | 54.9% | 258 h |
| Malapert Massif | LOLA LDEM_75S_120M | 80.3% | 81.7% | 273 h |
| Shackleton Rim | LOLA LDEM_75S_120M | 83.3% | 49.6% | 226 h |
| Shackleton connecting ridge | LOLA LDEM_75S_120M | 86.0% | 50.7% | 308 h |
| Nobile rim | LOLA LDEM_75S_120M | 65.6% | 88.7% | 302 h |
| Mons Mouton (IM-2 Athena) | LOLA LDEM_75S_120M | 43.7% | 80.3% | 458 h |
| Malapert A (IM-1 Odysseus) | LOLA LDEM_75S_120M | 38.2% | 100.0% | 454 h |

For reference, published LOLA-based studies report that the most illuminated south-polar points near Shackleton reach
roughly 80-90% average illumination (Mazarico et al. 2011; Bussey et al. 2010). Differences come
from exact point location, observer height and DEM resolution (120 m here).

## Known limits

- The Sun is treated as lit when its centre is above the horizon (the app also models the partial disc, ±0.27°).
- No atmosphere, so no refraction: the horizon is purely geometric (terrain plus the curvature of the Moon).
- DEM resolution 120 m: obstacles smaller than that near the lander are not in the horizon.
- Sites north of 75°S use a flat horizon (no LOLA polar coverage).
