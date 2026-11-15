// Types for the data contract plus the core visibility maths. No dependencies.

export interface Series { az: number[]; el: number[] }
export interface Horizon { step_deg: number; el: number[]; source: string }
export interface SiteData {
  version: number; id: string; source: string;
  start_utc: string; step_min: number; n: number;
  sun: Series; earth: Series; horizon: Horizon;
}
export interface SiteInfo {
  id: string; name: string; group: string;
  lat: number; lon: number; alt_km: number; verified: boolean;
}
export type Body = "sun" | "earth";

const SUN_RADIUS_DEG = 0.266; // apparent solar radius seen from the Moon

export async function loadSite(id: string): Promise<SiteData> {
  const r = await fetch(`/data/${id}.json`);
  if (!r.ok) throw new Error(`No data for ${id}`);
  return r.json();
}

export function timeAt(d: SiteData, i: number): Date {
  return new Date(Date.parse(d.start_utc) + i * d.step_min * 60_000);
}

export function indexAt(d: SiteData, t: Date): number {
  const i = Math.round((t.getTime() - Date.parse(d.start_utc)) / (d.step_min * 60_000));
  return Math.max(0, Math.min(d.n - 1, i));
}

/** Terrain horizon elevation (deg) in a given azimuth, linearly interpolated. */
export function horizonAt(h: Horizon, az: number): number {
  const x = (((az % 360) + 360) % 360) / h.step_deg;
  const i = Math.floor(x) % h.el.length;
  const j = (i + 1) % h.el.length;
  return h.el[i] + (h.el[j] - h.el[i]) * (x - Math.floor(x));
}

/** Degrees above the local terrain horizon. Negative means hidden. */
export function clearance(d: SiteData, body: Body, i: number): number {
  return d[body].el[i] - horizonAt(d.horizon, d[body].az[i]);
}

/** Fraction of the solar disc above the horizon, 0..1 (linear approximation). */
export function sunFraction(d: SiteData, i: number): number {
  const f = (clearance(d, "sun", i) + SUN_RADIUS_DEG) / (2 * SUN_RADIUS_DEG);
  return Math.max(0, Math.min(1, f));
}

export function isVisible(d: SiteData, body: Body, i: number): boolean {
  return body === "sun" ? sunFraction(d, i) >= 0.5 : clearance(d, "earth", i) > 0;
}

/** Hours until the body next sets (if up) or rises (if down). null = not within the data. */
export function hoursToChange(d: SiteData, body: Body, i: number): { visible: boolean; hours: number | null } {
  const now = isVisible(d, body, i);
  for (let k = i + 1; k < d.n; k++) {
    if (isVisible(d, body, k) !== now) return { visible: now, hours: ((k - i) * d.step_min) / 60 };
  }
  return { visible: now, hours: null };
}

export interface Metrics {
  hours: number; sunPct: number; earthPct: number; bothPct: number;
  longestNightH: number; maxSunElDeg: number; meanSunElDeg: number;
}

/** Summary for a mission that starts at index i and lasts `hours`. */
export function metrics(d: SiteData, i: number, hours: number): Metrics {
  const steps = Math.min(d.n - i, Math.round((hours * 60) / d.step_min));
  let sun = 0, earth = 0, both = 0, night = 0, longest = 0, maxEl = -90, sumEl = 0;
  for (let k = i; k < i + steps; k++) {
    const s = isVisible(d, "sun", k), e = isVisible(d, "earth", k);
    if (s) { sun++; night = 0; } else { night++; longest = Math.max(longest, night); }
    if (e) earth++;
    if (s && e) both++;
    maxEl = Math.max(maxEl, d.sun.el[k]);
    sumEl += d.sun.el[k];
  }
  const pct = (x: number) => (steps ? (100 * x) / steps : 0);
  return {
    hours: (steps * d.step_min) / 60, sunPct: pct(sun), earthPct: pct(earth), bothPct: pct(both),
    longestNightH: (longest * d.step_min) / 60, maxSunElDeg: maxEl, meanSunElDeg: steps ? sumEl / steps : 0,
  };
}
