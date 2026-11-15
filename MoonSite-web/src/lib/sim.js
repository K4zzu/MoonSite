// LunarSim — ephemerides, two-body transfer, site illumination. Units: km, ms epoch. Frame: ecliptic, z = north.
// Ported from the Claude Design prototype (sim.js). When a site has real data from lunar-data
// (JPL Horizons vectors and/or a LOLA terrain horizon), sky() uses it instead of the analytic model.
import { horizonFromData, skyFromData, terrainFromData } from './lunarData.js';

const D2R = Math.PI / 180, MU_E = 398600.4418, MU_M = 4902.8, R_E = 6378.14, R_M = 1737.4, AU = 149597870.7;
const HOUR = 3600000, DAY = 86400000, J2000 = Date.UTC(2000, 0, 1, 12);
const sd = d => Math.sin(d * D2R), cd = d => Math.cos(d * D2R);
const V = {
  add: (a, b, c) => c ? [a[0] + b[0] + c[0], a[1] + b[1] + c[1], a[2] + b[2] + c[2]] : [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: a => Math.hypot(a[0], a[1], a[2]), unit: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k],
  rot: (v, ax, ang) => { const c = Math.cos(ang), s = Math.sin(ang), d = V.dot(ax, v), x = V.cross(ax, v); return [v[0] * c + x[0] * s + ax[0] * d * (1 - c), v[1] * c + x[1] * s + ax[1] * d * (1 - c), v[2] * c + x[2] * s + ax[2] * d * (1 - c)]; }
};
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };

function sunPos(t) {
  const d = (t - J2000) / DAY, g = 357.528 + 0.9856003 * d, L = 280.46 + 0.9856474 * d;
  const lam = L + 1.915 * sd(g) + 0.02 * sd(2 * g), r = (1.00014 - 0.01671 * cd(g) - 0.00014 * cd(2 * g)) * AU;
  return [r * cd(lam), r * sd(lam), 0];
}
function moonPos(t) {
  const T = (t - J2000) / DAY / 36525;
  const lam = 218.32 + 481267.881 * T + 6.29 * sd(135 + 477198.87 * T) - 1.27 * sd(259.3 - 413335.36 * T) + 0.66 * sd(235.7 + 890534.22 * T) + 0.21 * sd(269.9 + 954397.74 * T) - 0.19 * sd(357.5 + 35999.05 * T) - 0.11 * sd(186.5 + 966404.03 * T);
  const bet = 5.13 * sd(93.3 + 483202.02 * T) + 0.28 * sd(228.2 + 960400.89 * T) - 0.28 * sd(318.3 + 6003.15 * T) - 0.17 * sd(217.6 - 407332.21 * T);
  const par = 0.9508 + 0.0518 * cd(135 + 477198.87 * T) + 0.0095 * cd(259.3 - 413335.36 * T) + 0.0078 * cd(235.7 + 890534.22 * T) + 0.0028 * cd(269.9 + 954397.74 * T);
  const r = R_E / sd(par);
  return [r * cd(bet) * cd(lam), r * cd(bet) * sd(lam), r * sd(bet)];
}
const moonVel = t => V.mul(V.sub(moonPos(t + 30000), moonPos(t - 30000)), 1 / 60);
// Moon body frame: Z = spin pole (Cassini state, 1.543° from ecliptic pole), X = prime meridian (mean Earth direction)
function moonFrame(t) {
  const T = (t - J2000) / DAY / 36525, Om = 125.04 - 1934.136 * T, i = 1.543, Lm = 218.316 + 481267.881 * T;
  const Z = [-sd(i) * sd(Om), sd(i) * cd(Om), cd(i)];
  let X = [-cd(Lm), -sd(Lm), 0]; X = V.unit(V.sub(X, V.mul(Z, V.dot(X, Z))));
  return { X, Y: V.cross(Z, X), Z };
}
function siteNormal(t, site, f) {
  f = f || moonFrame(t); const cl = cd(site.lat);
  return V.add(V.add(V.mul(f.X, cl * cd(site.lon)), V.mul(f.Y, cl * sd(site.lon))), V.mul(f.Z, sd(site.lat)));
}
function localFrame(t, site) {
  const f = moonFrame(t), U = siteNormal(t, site, f), E = V.unit(V.cross(f.Z, U)), N = V.cross(U, E);
  return { U, E, N };
}

// `dataId` links a site to lunar-data/public/data/<dataId>.json
const SITES = [
  { id: 'shackleton', dataId: 'shackleton-rim', name: 'Shackleton Rim', group: 'South pole candidates', lat: -89.78, lon: -155.7, relief: 1.0, drop: 1.5, seed: 11 },
  { id: 'ridge', dataId: 'shackleton-ridge', name: 'Connecting Ridge', group: 'South pole candidates', lat: -89.45, lon: -137.3, relief: 1.1, drop: 1.3, seed: 23 },
  { id: 'nobile', dataId: 'nobile-rim', name: 'Nobile Rim', group: 'South pole candidates', lat: -85.43, lon: 31.6, relief: 0.8, drop: 1.6, seed: 37 },
  { id: 'malapert', dataId: 'malapert-massif', name: 'Malapert Massif', group: 'South pole candidates', lat: -85.9526, lon: -3.382, relief: 0.7, drop: 2.2, seed: 41 },
  { id: 'gerlache', dataId: 'de-gerlache-rim', name: 'de Gerlache Rim', group: 'South pole candidates', lat: -88.67, lon: -68.4, relief: 1.2, drop: 1.0, seed: 53 },
  { id: 'haworth', dataId: 'haworth', name: 'Haworth', group: 'South pole candidates', lat: -86.7725, lon: -20.566, relief: 1.6, drop: 0.2, seed: 67 },
  { id: 'im1', dataId: 'malapert-a', name: 'Malapert A (IM-1)', group: 'CLPS', lat: -80.13, lon: 1.44, relief: 0.6, drop: 0.3, seed: 71 },
  { id: 'im2', dataId: 'mons-mouton', dataExtra: ['mons-mouton-2025'], name: 'Mons Mouton (IM-2)', group: 'CLPS', lat: -84.79, lon: 29.20, relief: 0.9, drop: 0.4, seed: 79 },
  { id: 'crisium', dataId: 'blue-ghost-1', name: 'Mare Crisium (Blue Ghost)', group: 'CLPS', lat: 18.56, lon: 61.81, relief: 0.2, drop: 0, seed: 83 },
  { id: 'reiner', dataId: 'reiner-gamma', name: 'Reiner Gamma', group: 'CLPS', lat: 7.5, lon: -59.0, relief: 0.15, drop: 0, seed: 89 },
  { id: 'ch3', dataId: 'chandrayaan-3', name: 'Shiv Shakti (Chandrayaan-3)', group: 'International', lat: -69.37, lon: 32.32, relief: 0.4, drop: 0, seed: 97 },
  { id: 'ce4', dataId: 'change-4', name: 'Von Kármán (Chang’e 4)', group: 'International', lat: -45.44, lon: 177.6, relief: 0.4, drop: 0, seed: 101 },
  { id: 'ce6', dataId: 'change-6', name: 'Apollo basin (Chang’e 6)', group: 'International', lat: -41.64, lon: -153.99, relief: 0.4, drop: 0, seed: 105 },
  { id: 'slim', dataId: 'slim', name: 'Shioli (SLIM)', group: 'International', lat: -13.32, lon: 25.25, relief: 0.3, drop: 0, seed: 103 },
  { id: 'a11', dataId: 'apollo-11', name: 'Tranquility Base (Apollo 11)', group: 'Apollo', lat: 0.674, lon: 23.473, relief: 0.15, drop: 0, seed: 107 },
  { id: 'a15', dataId: 'apollo-15', name: 'Hadley Rille (Apollo 15)', group: 'Apollo', lat: 26.132, lon: 3.634, relief: 0.9, drop: 0, seed: 109 },
  { id: 'a17', dataId: 'apollo-17', name: 'Taurus–Littrow (Apollo 17)', group: 'Apollo', lat: 20.191, lon: 30.772, relief: 0.8, drop: 0, seed: 113 }
];
const customSite = (lat, lon) => ({ id: 'custom', name: `${Math.abs(lat).toFixed(2)}°${lat < 0 ? 'S' : 'N'}, ${Math.abs(lon).toFixed(2)}°${lon < 0 ? 'W' : 'E'}`, group: 'Custom', lat, lon, noData: true, relief: 0, drop: 0, seed: 1 });

// ---- procedural terrain (stand-in for LOLA): height in km at azimuth az (rad, from north toward east) and distance d (km)
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const h2 = (x, y, s) => { let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 2147483647) | 0; n = Math.imul(n ^ n >>> 13, 1274126177); return ((n ^ n >>> 16) >>> 0) / 4294967296; };
function noise2(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = h2(xi, yi, s), b = h2(xi + 1, yi, s), c = h2(xi, yi + 1, s), d = h2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v - 0.5;
}
function terrainOf(site) {
  if (site._ter) return site._ter;
  const r = rng(site.seed * 7919), masses = [];
  if (!site.noData) for (let i = 0; i < 8; i++) { const D = 7 + r() * 95; masses.push({ D, W: D * (0.16 + 0.2 * r()), A: site.relief * (0.5 + 2.8 * r()), az: r() * 6.2832, aw: 0.25 + r() * 0.8, p1: r() * 6.28, p2: r() * 6.28 }); }
  const cr = []; if (!site.noData) for (let i = 0; i < 70; i++) { const rad = 0.004 + 0.11 * Math.pow(r(), 3), aa = r() * 6.2832, dd = Math.max(0.03 + 2.5 * Math.pow(r(), 1.5), rad * 2.6 + 0.03); cr.push({ x: dd * Math.sin(aa), y: dd * Math.cos(aa), r: rad }); }
  if (!site.noData) for (let i = 0; i < 16; i++) { const rad = 0.3 + 2.2 * Math.pow(r(), 2), aa = r() * 6.2832, dd = Math.max(2 + 50 * r(), rad * 2.6 + 0.5); cr.push({ x: dd * Math.sin(aa), y: dd * Math.cos(aa), r: rad }); }
  const lola = terrainFromData(site), scales = lola ? [0.04, 0.25] : [0.04, 0.25, 1.4, 7];
  const height = (az, d, noCr) => {
    if (site.noData) return 0;
    let h = lola ? lola(az, d) : -site.drop * smooth(0.25, 9, d);
    if (!lola) for (const m of masses) {
      let da = Math.abs(az - m.az) % 6.2832; if (da > Math.PI) da = 6.2832 - da;
      const q = (d - m.D) / m.W, a = da / m.aw; if (q * q + a * a > 12) continue;
      h += m.A * Math.exp(-q * q - a * a) * (1 + 0.25 * Math.sin(5 * az + m.p1) + 0.15 * Math.sin(11 * az + m.p2));
    }
    const x = d * Math.sin(az), y = d * Math.cos(az);
    if (!noCr) for (const c of cr) { if (lola && c.r > 0.25) continue; if (Math.abs(x - c.x) > c.r * 1.6 || Math.abs(y - c.y) > c.r * 1.6) continue; const q = Math.hypot(x - c.x, y - c.y) / c.r; if (q < 1.6) h += c.r * (q < 1 ? -0.2 * (1 - q * q) + 0.02 * q * q : 0.02 * (1.6 - q) / 0.6); }
    for (let o = 0; o < scales.length; o++) { const s = scales[o]; h += 0.035 * s * (0.4 + site.relief) * smooth(0, 4 * s, d) * (1 - smooth(5 * s, 12 * s, d)) * 2 * noise2(x / s + 31, y / s + 17, site.seed + o); }
    return h;
  };
  const EYE = 0.003;
  // Real LOLA horizon from lunar-data when present; otherwise the procedural one
  let horizon = horizonFromData(site);
  if (!horizon) {
    horizon = new Float32Array(360);
    for (let i = 0; i < 360; i++) {
      let best = -0.03;
      if (!site.noData) { best = -90; for (let j = 0; j < 70; j++) { const d = 0.05 * Math.pow(3400, j / 69); best = Math.max(best, Math.atan2(height(i * D2R, d, true) - EYE - d * d / (2 * R_M), d) / D2R); } }
      horizon[i] = best;
    }
  }
  const hz = azDeg => { const a = ((azDeg % 360) + 360) % 360, i = Math.floor(a), k = a - i; return horizon[i] * (1 - k) + horizon[(i + 1) % 360] * k; };
  return site._ter = { height, horizon, hz, EYE };
}

// sky state at a site: Sun/Earth elevation & azimuth (deg), lit fraction, link
function sky(t, site) {
  const lf = localFrame(t, site), m = moonPos(t), p = V.add(m, V.mul(lf.U, R_M));
  const s = V.unit(V.sub(sunPos(t), p)), e = V.unit(V.mul(p, -1)), ter = terrainOf(site);
  const el = v => Math.asin(clamp(V.dot(v, lf.U), -1, 1)) / D2R, az = v => Math.atan2(V.dot(v, lf.E), V.dot(v, lf.N)) / D2R;
  let sunEl = el(s), sunAz = az(s), earthEl = el(e), earthAz = az(e);
  const real = skyFromData(site, t);
  if (real) ({ sunEl, sunAz, earthEl, earthAz } = real);
  const lit = clamp((sunEl - ter.hz(sunAz) + 0.266) / 0.533, 0, 1), link = earthEl - ter.hz(earthAz) > 0.3;
  return { sunEl, sunAz, earthEl, earthAz, lit, link, sunHz: ter.hz(sunAz), earthHz: ter.hz(earthAz), lf, sunDir: s, earthDir: e };
}
function nextChange(t, site, key) { // hours until lit / link flips (null if > 30 d)
  const cur = key === 'lit' ? sky(t, site).lit > 0.5 : sky(t, site).link;
  for (let h = 1; h <= 720; h++) { const k = sky(t + h * HOUR, site), v = key === 'lit' ? k.lit > 0.5 : k.link; if (v !== cur) return { now: cur, hours: h }; }
  return { now: cur, hours: null };
}

// ---- mission: direct transfer, two-body (Earth-centred conic, lunar arrival patched)
const R0 = R_E + 185, RLO = R_M + 100, PARK = 1.5 * HOUR, LOITER = 24 * HOUR, DESC = HOUR, ASCENT = 9 * 60000;
// Landing profile (seconds before touchdown), modelled on Apollo / CLPS: a deorbit burn half an orbit before landing
// lowers the perilune from 100 km to 15 km; powered descent starts there (PDI, ~450 km uprange), the lander pitches up
// at high gate and comes down almost vertically for the last few hundred metres.
const PDI_S = 720, DEORBIT_S = DESC / 1000, PDI_ALT = 15;
function descentAlt(s) { // km above the mean surface
  if (s <= 0) return 0;
  if (s >= DEORBIT_S) return RLO - R_M;
  if (s >= PDI_S) return PDI_ALT + (RLO - R_M - PDI_ALT) * (1 - Math.cos(Math.PI * (s - PDI_S) / (DEORBIT_S - PDI_S))) / 2;
  const x = s / PDI_S; return PDI_ALT * x * x * (3 - 2 * x);
}
// Orbit phase (rad) from the point above the site. Constant rate in orbit and while coasting down; during powered
// descent the ground speed falls as (s/PDI)^1.5, so the phase and its rate stay continuous all the way to zero.
function lunarPhase(nLO, s) {
  if (s <= 0) return 0;
  const p0 = nLO * PDI_S / 2.5;
  return s < PDI_S ? -p0 * Math.pow(s / PDI_S, 2.5) : -p0 - nLO * (s - PDI_S);
}
const DEFAULT_REQ = { duration: 14, maxDark: 48, minLink: 50 };
function computePlan(launch, site, req) {
  req = Object.assign({}, DEFAULT_REQ, req);
  const tTLI = launch + PARK; let tA = tTLI + 3.5 * DAY, a, e, nu, rM, n;
  for (let i = 0; i < 8; i++) {
    rM = V.len(moonPos(tA)); const ra = 1.22 * rM; a = (R0 + ra) / 2; e = (ra - R0) / (ra + R0);
    nu = Math.acos(clamp((a * (1 - e * e) / rM - 1) / e, -1, 1));
    const E = 2 * Math.atan(Math.sqrt((1 - e) / (1 + e)) * Math.tan(nu / 2)); n = Math.sqrt(MU_E / (a * a * a));
    tA = tTLI + (E - e * Math.sin(E)) / n * 1000;
  }
  const mA = moonPos(tA), vM = moonVel(tA), h = V.unit(V.cross(mA, vM)), P = V.rot(V.unit(mA), h, -nu), Q = V.cross(h, P), p = a * (1 - e * e);
  const vArr = V.mul(V.add(V.mul(P, -Math.sin(nu)), V.mul(Q, e + Math.cos(nu))), Math.sqrt(MU_E / p)), vInf = V.len(V.sub(vArr, vM));
  const at = (RLO + R_M) / 2, vLO = Math.sqrt(MU_M / RLO), nLO = Math.sqrt(MU_M / (RLO * RLO * RLO));
  // Lunar arrival as a patched conic: a hyperbola around the Moon whose periapsis (100 km) is the orbit insertion point.
  // The time spent in lunar orbit before descent (24 h plus a fraction of an orbit) sets where that point is; pick the
  // one whose inbound asymptote points back along the real approach, so the craft swings in from the Earth side.
  const eH = 1 + RLO * vInf * vInf / MU_M, nuInf = Math.acos(-1 / eH), AH = MU_M / (vInf * vInf);
  const conic0 = { tTLI, a, e, n, P, Q }, dIn = V.unit(V.sub(conicPos(conic0, tA - 8 * HOUR), moonPos(tA - 8 * HOUR)));
  const orbitT = 2 * Math.PI / nLO * 1000;
  let best = null;
  for (let i = 0; i < 24; i++) {
    const tL = tA + LOITER + i * orbitT / 24, nS1 = siteNormal(tL, site);
    let b1 = V.cross(h, nS1); if (V.len(b1) < 0.05) b1 = V.cross([1, 0, 0], nS1); b1 = V.unit(b1);
    const tmp = { tLand: tL, site, nS: nS1, b: b1, nLO }, r0 = lunarRel(tmp, tA), Ph = V.unit(r0);
    let Qh = V.sub(lunarRel(tmp, tA + 1000), r0); Qh = V.unit(V.sub(Qh, V.mul(Ph, V.dot(Qh, Ph))));
    const score = V.dot(V.add(V.mul(Ph, Math.cos(nuInf)), V.mul(Qh, -Math.sin(nuInf))), dIn);
    if (!best || score > best.score) best = { score, tL, nS: nS1, b: b1, hyp: { P: Ph, Q: Qh, A: AH, e: eH, n: Math.sqrt(MU_M / (AH * AH * AH)) } };
  }
  const tLand = best.tL, tEnd = tLand + req.duration * DAY, nS = best.nS, b = best.b;
  const plan = {
    launch, site, req, tTLI, tA, tLand, tEnd, a, e, n, P, Q, h, nS, b, nLO, hyp: best.hyp,
    dv: { tli: Math.sqrt(MU_E * (2 / R0 - 1 / a)) - Math.sqrt(MU_E / R0), loi: Math.sqrt(vInf * vInf + 2 * MU_M / RLO) - vLO, descent: vLO - Math.sqrt(MU_M * (2 / RLO - 1 / at)) + Math.sqrt(MU_M * (2 / R_M - 1 / at)) },
    tof: (tA - tTLI) / DAY
  };
  Object.assign(plan, evaluate(plan));
  return plan;
}
function shipPos(pl, t) {
  const n0 = Math.sqrt(MU_E / (R0 * R0 * R0));
  if (t <= pl.tTLI - BURN) {
    const tt = Math.max(t, pl.launch), tau = tt - pl.launch;
    let th = -n0 * (pl.tTLI - tt) / 1000, r = R0;
    if (tau < ASCENT) {
      // Gravity-turn ascent: horizontal speed grows as s² up to orbital speed, altitude follows 3s²-2s³ to 185 km,
      // so the rocket rises vertically, pitches over and enters the parking orbit horizontally at T+9 min.
      const s = tau / ASCENT, vo = Math.sqrt(MU_E / R0), T = ASCENT / 1000, D = x => vo * T / 3 * x * x * x;
      th = -n0 * (pl.tTLI - (pl.launch + ASCENT)) / 1000 - (D(1) - D(s)) / R0;
      r = R_E + 185 * s * s * (3 - 2 * s);
    }
    return V.add(V.mul(pl.P, r * Math.cos(th)), V.mul(pl.Q, r * Math.sin(th)));
  }
  // the translunar burn takes a few minutes: blend from the parking orbit onto the transfer ellipse instead of jumping
  if (t < pl.tTLI + BURN) return V.lerp(parkPos(pl, t), conicPos(pl, t), smooth(pl.tTLI - BURN, pl.tTLI + BURN, t));
  if (t >= pl.tA + BURN) return V.add(moonPos(t), lunarRel(pl, t));
  // lunar orbit insertion: brake from the hyperbola's periapsis speed (~2.4 km/s) to orbital speed (1.63 km/s)
  if (t >= pl.tA - BURN) return V.add(moonPos(t), V.lerp(hypRel(pl, t), lunarRel(pl, t), smooth(pl.tA - BURN, pl.tA + BURN, t)));
  const k = conicPos(pl, t);
  if (t < pl.tA - ARR0) return k;
  // entering the Moon's sphere of influence: hand over from the Earth-centred ellipse to the lunar hyperbola,
  // so the craft speeds up as it falls towards the Moon instead of slowing to a stop
  return V.lerp(k, V.add(moonPos(t), hypRel(pl, t)), smooth(pl.tA - ARR0, pl.tA - ARR1, t));
}
const BURN = 3 * 60000, ARR0 = 10 * HOUR, ARR1 = 3 * HOUR;
function parkPos(pl, t) { const n0 = Math.sqrt(MU_E / (R0 * R0 * R0)), th = n0 * (t - pl.tTLI) / 1000; return V.add(V.mul(pl.P, R0 * Math.cos(th)), V.mul(pl.Q, R0 * Math.sin(th))); }
/** Earth-centred transfer ellipse (perigee at the translunar burn). */
function conicPos(pl, t) {
  const M = pl.n * (t - pl.tTLI) / 1000, e = pl.e; let E = M + Math.sign(M || 1) * 0.85 * e;
  for (let i = 0; i < 80; i++) { const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); E -= clamp(dE, -1, 1); if (Math.abs(dE) < 1e-13) break; }
  return V.add(V.mul(pl.P, pl.a * (Math.cos(E) - e)), V.mul(pl.Q, pl.a * Math.sqrt(1 - e * e) * Math.sin(E)));
}
/** Moon-centred approach hyperbola, periapsis (100 km altitude) at the orbit insertion time. */
function hypRel(pl, t) {
  const hy = pl.hyp, M = hy.n * (t - pl.tA) / 1000; let H = Math.asinh(M / hy.e);
  for (let i = 0; i < 60; i++) { const dH = (hy.e * Math.sinh(H) - H - M) / (hy.e * Math.cosh(H) - 1); H -= dH; if (Math.abs(dH) < 1e-12) break; }
  return V.add(V.mul(hy.P, hy.A * (hy.e - Math.cosh(H))), V.mul(hy.Q, hy.A * Math.sqrt(hy.e * hy.e - 1) * Math.sinh(H)));
}
// Position relative to the Moon's centre once in lunar orbit: polar orbit over the site, deorbit coast, powered descent.
// The orbit plane is inertial; during the last hour it turns with the Moon so the track ends exactly on the site.
function lunarRel(pl, t) {
  const s = (pl.tLand - t) / 1000;
  if (s <= 0) return V.mul(siteNormal(t, pl.site), R_M);
  let ax = pl.nS, b = pl.b;
  if (s < DEORBIT_S) { ax = V.unit(V.lerp(pl.nS, siteNormal(t, pl.site), smooth(DEORBIT_S, 0, s))); b = V.unit(V.sub(pl.b, V.mul(ax, V.dot(pl.b, ax)))); }
  const ph = lunarPhase(pl.nLO, s), r = R_M + descentAlt(s);
  return V.add(V.mul(ax, r * Math.cos(ph)), V.mul(b, r * Math.sin(ph)));
}
/** Descent state for the cinematic: seconds to touchdown, altitude (km), pitch of the thrust axis above horizontal (deg). */
function descentState(pl, t) {
  const s = (pl.tLand - t) / 1000;
  return { s, alt: descentAlt(s), pitch: 18 + 72 * smooth(200, 45, s) };
}
// speed relative to Earth on the way out, relative to the Moon once it dominates (from 10 h before arrival)
const shipSpeed = (pl, t) => { if (t >= pl.tLand) return 0; const d = V.sub(shipPos(pl, t + 5000), shipPos(pl, t - 5000)); return V.len(t > pl.tA - ARR0 ? V.sub(d, V.sub(moonPos(t + 5000), moonPos(t - 5000))) : d) / 10; };
const NS = 168;
function evaluate(pl) {
  const sun = new Float32Array(NS), link = new Uint8Array(NS), dt = (pl.tEnd - pl.tLand) / NS;
  let s = 0, l = 0, both = 0, night = 0, longest = 0, maxEl = -90, firstSet = null;
  for (let i = 0; i < NS; i++) {
    const k = sky(pl.tLand + (i + 0.5) * dt, pl.site); sun[i] = k.lit; link[i] = k.link ? 1 : 0; maxEl = Math.max(maxEl, k.sunEl);
    const lit = k.lit > 0.5; if (lit) { s++; night = 0; } else { night += dt / HOUR; longest = Math.max(longest, night); if (firstSet === null) firstSet = i * dt / HOUR; }
    if (k.link) l++; if (lit && k.link) both++;
  }
  const sunPct = 100 * s / NS, linkPct = 100 * l / NS, bothPct = 100 * both / NS, rq = pl.req;
  let verdict, text;
  if (longest <= rq.maxDark && linkPct >= rq.minLink) { verdict = 'viable'; text = 'Viable'; }
  else if (longest <= rq.maxDark * 1.5 && linkPct >= rq.minLink * 0.8) { verdict = 'marginal'; text = 'Marginal'; }
  else {
    verdict = 'not';
    if (longest > rq.maxDark * 1.5) text = sun[0] < 0.5 ? 'Not viable — lands in darkness' : firstSet !== null && firstSet < 96 ? `Not viable — Sun sets ${Math.max(1, Math.round(firstSet))} h after landing` : `Not viable — ${Math.round(longest)} h without Sun`;
    else text = `Not viable — Earth link only ${Math.round(linkPct)}% of the time`;
  }
  return { sun, link, sunPct, linkPct, bothPct, longestNight: longest, maxSunEl: maxEl, firstSet, verdict, text };
}
// Operational windows during the surface stay, sampled every stepH hours (Horizons data is hourly).
// Also the mean electrical power of a 1 m² vertical, sun-tracking panel at 30 % efficiency (1361 W/m² at 1 AU):
// at high latitude the Sun stays near the horizon, so a vertical panel is the realistic choice.
const SOLAR = 1361, PANEL_EFF = 0.3;
function windows(pl, stepH = 1) {
  const n = Math.max(1, Math.round((pl.tEnd - pl.tLand) / (stepH * HOUR))), out = { sun: [], link: [], both: [] }, open = {};
  let pSum = 0;
  for (let i = 0; i <= n; i++) {
    const t = pl.tLand + i * stepH * HOUR, k = sky(t, pl.site), st = { sun: k.lit > 0.5, link: k.link };
    st.both = st.sun && st.link;
    if (i < n) pSum += k.lit * Math.cos(Math.max(0, k.sunEl) * D2R);
    for (const key of ['sun', 'link', 'both']) {
      if (st[key] && open[key] == null && i < n) open[key] = t;
      if ((!st[key] || i === n) && open[key] != null) { out[key].push({ start: open[key], end: t, hours: (t - open[key]) / HOUR }); open[key] = null; }
    }
  }
  const frac = pSum / n;
  out.powerW = SOLAR * PANEL_EFF * frac;
  out.energyWhDay = out.powerW * 24;
  return out;
}
const RANK = { viable: 2, marginal: 1, not: 0 };
const score = p => RANK[p.verdict] * 1000 + p.sunPct + 0.5 * p.linkPct;
function gain(alt, cur) {
  const ds = alt.sunPct - cur.sunPct, dl = alt.linkPct - cur.linkPct;
  if (ds >= dl) return `+${Math.round(ds)}% sunlight`;
  return alt.linkPct > 98 ? 'full Earth link' : `+${Math.round(dl)}% Earth link`;
}
function alternatives(cur, original) {
  const out = []; let best = null;
  for (let d = 1; d <= 21; d++) { const p = computePlan(cur.launch + d * DAY, cur.site, cur.req); p._d = d; if (!best || score(p) > score(best)) best = p; }
  if (best && RANK[best.verdict] > RANK[cur.verdict]) out.push({ plan: best, label: `Land ${best._d} day${best._d > 1 ? 's' : ''} later: ${gain(best, cur)}` });
  best = null;
  for (const s of SITES) { if (s.group !== cur.site.group || s.id === cur.site.id) continue; const p = computePlan(cur.launch, s, cur.req); if (!best || score(p) > score(best)) best = p; }
  if (best && RANK[best.verdict] > RANK[cur.verdict]) out.push({ plan: best, label: `Same date at ${best.site.name}: ${gain(best, cur)}` });
  if (original && (original.launch !== cur.launch || original.site.id !== cur.site.id)) out.push({ plan: original, label: 'Original plan', original: true });
  return out;
}
const loc = () => LunarSim.locale || 'en-US';
const fmtDur = h => h == null ? '30+ d' : h < 72 ? `${Math.round(h)} h` : `${Math.round(h / 24)} d`;
const fmtDate = t => new Date(t).toLocaleDateString(loc(), { month: 'short', day: 'numeric', timeZone: 'UTC' });
const fmtDateY = t => new Date(t).toLocaleDateString(loc(), { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
// Engine state: ascent (first stage to MECO, a short coast at stage separation, second stage to orbit), translunar
// injection, lunar orbit insertion, the deorbit burn and powered descent (throttled down after high gate, cut at contact).
const MECO = 505e3, IGN2 = 512e3;
function burn(pl, t) {
  const M = 60000, tau = t - pl.launch, s = (pl.tLand - t) / 1000;
  if (tau >= 0 && tau < ASCENT) return tau < MECO ? { level: 1, kind: 'ascent' } : tau < IGN2 ? { level: 0, kind: 'ascent' } : { level: 0.85 * (1 - smooth(ASCENT - 8e3, ASCENT, tau)), kind: 'ascent' };
  if (Math.abs(t - pl.tTLI) < 3 * M) return { level: 1, kind: 'tli' };
  if (Math.abs(t - pl.tA) < 3 * M) return { level: 1, kind: 'loi' };
  if (Math.abs(s - DEORBIT_S) < 25) return { level: 0.7, kind: 'deorbit' };
  if (s > 0 && s < PDI_S) return { level: s > 200 ? 1 : 0.55 + 0.45 * smooth(60, 200, s), kind: 'descent' };
  return { level: 0 };
}

export const LunarSim = { ASCENT, PDI_S, DEORBIT_S, burn, descentState, descentAlt, V, R_E, R_M, AU, HOUR, DAY, SITES, DEFAULT_REQ, RANK, customSite, sunPos, moonPos, moonFrame, siteNormal, localFrame, terrainOf, sky, nextChange, computePlan, windows, shipPos, shipSpeed, evaluate, alternatives, fmtDur, fmtDate, fmtDateY, clamp, smooth, locale: 'en-US' };
export default LunarSim;
