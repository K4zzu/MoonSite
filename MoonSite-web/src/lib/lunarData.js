// Bridge to the lunar-data pipeline (../lunar-data). Reads public/data/<id>.json, the contract in lunar-data/README.md.
// Ephemerides are used only when the file comes from JPL Horizons; "MOCK - not valid" files are loaded and reported
// but never replace the analytic model. A terrain horizon is used only when it comes from LOLA (not "sphere").

const MOCK = /mock/i;
const BASE = import.meta.env.BASE_URL || '/';

export const isRealEphemeris = d => !!d && !MOCK.test(d.source || '');
export const isRealHorizon = d => !!d && !!d.horizon && d.horizon.source && d.horizon.source !== 'sphere';

/** Load every site file referenced by `sites[].dataId` and attach it as `site.data`. Never throws. */
export async function loadLunarData(sites, onEach) {
  const withData = sites.filter(s => s.dataId);
  let done = 0;
  // Coordinates come from lunar-data/sites.json (published landing sites, LOLA-snapped crests for candidates)
  try {
    const r = await fetch(`${BASE}data/sites.json`);
    if (r.ok) {
      const idx = (await r.json()).sites || [];
      for (const s of withData) {
        const m = idx.find(x => x.id === s.dataId);
        if (m) { s.lat = m.lat; s.lon = m.lon > 180 ? m.lon - 360 : m.lon; s.position = m.position; s.verified = m.verified; }
      }
    }
  } catch (e) { /* keep built-in coordinates */ }
  await Promise.all(withData.map(async s => {
    try {
      const r = await fetch(`${BASE}data/${s.dataId}.json`);
      if (r.ok) { s.data = await r.json(); delete s._ter; }
    } catch (e) { /* keep the analytic model for this site */ }
    onEach && onEach(++done / withData.length);
  }));
  return dataStatus(sites);
}

/** What the UI should say about the data in use. */
export function dataStatus(sites) {
  const loaded = sites.filter(s => s.data);
  return {
    files: loaded.length,
    ephemeris: loaded.filter(s => isRealEphemeris(s.data)).length,
    horizon: loaded.filter(s => isRealHorizon(s.data)).length,
    sources: [...new Set(loaded.map(s => s.data.source))],
  };
}

/** Terrain horizon (360 samples at 1°) from a LOLA product, or null. */
export function horizonFromData(site) {
  const d = site && site.data;
  if (!isRealHorizon(d)) return null;
  const h = d.horizon, out = new Float32Array(360);
  for (let i = 0; i < 360; i++) {
    const x = i / h.step_deg, a = Math.floor(x) % h.el.length, b = (a + 1) % h.el.length;
    out[i] = h.el[a] + (h.el[b] - h.el[a]) * (x - Math.floor(x));
  }
  return out;
}

/**
 * LOLA terrain around the site, from the polar grid written by make_horizons.py.
 * Returns height(azRad, dKm) in km relative to the site, or null.
 */
export function terrainFromData(site) {
  const g = site && site.data && site.data.terrain;
  if (!g || !g.h_m) return null;
  const { na, nr, d0_km: d0, d1_km: d1, h_m: h } = g, L = Math.log(d1 / d0);
  return (az, d) => {
    const x = (((az / (2 * Math.PI)) % 1 + 1) % 1) * na, i = Math.floor(x) % na, i2 = (i + 1) % na, fx = x - Math.floor(x);
    const y = Math.max(0, Math.min(nr - 1, Math.log(Math.max(d, d0) / d0) / L * (nr - 1))), j = Math.min(nr - 2, Math.floor(y)), fy = y - j;
    const a = h[i * nr + j], b = h[i2 * nr + j], c = h[i * nr + j + 1], e = h[i2 * nr + j + 1];
    return ((a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + e * fx) * fy) / 1000;
  };
}

/** One-line description of the data behind a site, for the Details panel. */
export function siteSources(site) {
  const d = site && site.data;
  return {
    sky: isRealEphemeris(d) ? 'JPL Horizons' : 'Analytic model',
    horizon: isRealHorizon(d) ? d.horizon.source : 'Procedural',
    terrain: d && d.terrain ? d.terrain.source : 'Procedural',
  };
}

const lerpAz =(a, b, k) => { const d = ((b - a + 540) % 360) - 180; return a + d * k; };

/** Sun / Earth azimuth and elevation (deg) from Horizons at time t (ms), linearly interpolated; null outside the data. */
export function skyFromData(site, t) {
  const d = site && site.data;
  if (!isRealEphemeris(d)) return null;
  const t0 = d._t0 || (d._t0 = Date.parse(d.start_utc)), x = (t - t0) / (d.step_min * 60000);
  if (!(x >= 0 && x <= d.n - 1)) return null;
  const i = Math.min(d.n - 2, Math.floor(x)), k = x - i;
  return {
    sunEl: d.sun.el[i] + (d.sun.el[i + 1] - d.sun.el[i]) * k,
    sunAz: lerpAz(d.sun.az[i], d.sun.az[i + 1], k),
    earthEl: d.earth.el[i] + (d.earth.el[i + 1] - d.earth.el[i]) * k,
    earthAz: lerpAz(d.earth.az[i], d.earth.az[i + 1], k),
  };
}
