// 2D sky chart for the Details panel: terrain horizon (LOLA where available) with the Sun and Earth
// tracks over the surface stay, and where both are right now. Azimuth on x (N-E-S-W-N), elevation on y.
import { useEffect, useMemo, useState } from 'react';
import LunarSim from '../lib/sim.js';
import { siteSources } from '../lib/lunarData.js';

const W = 344, H = 176, PL = 30, PR = 8, PT = 10, PB = 22;
const GOLD = '#E8B95A', BLUE = '#6FA8F5', TXT = 'rgba(243,241,236,.62)';

function tracks(plan) {
  const S = LunarSim, n = 200, sun = [], earth = [];
  for (let i = 0; i <= n; i++) {
    const k = S.sky(plan.tLand + (plan.tEnd - plan.tLand) * i / n, plan.site);
    sun.push([k.sunAz, k.sunEl, k.lit > 0.5]); earth.push([k.earthAz, k.earthEl, k.link]);
  }
  return { sun, earth };
}

// Split a track where it wraps around azimuth 0/360 so the polyline doesn't jump across the chart.
function segments(pts, x, y) {
  const out = []; let cur = [];
  pts.forEach((p, i) => {
    const az = ((p[0] % 360) + 360) % 360;
    if (i && Math.abs(az - (((pts[i - 1][0] % 360) + 360) % 360)) > 180) { out.push(cur); cur = []; }
    cur.push([x(az), y(p[1]), p[2]]);
  });
  out.push(cur);
  return out;
}

export default function HorizonChart({ plan, getTime, lang }) {
  const [t, setT] = useState(getTime());
  useEffect(() => { const id = setInterval(() => setT(getTime()), 300); return () => clearInterval(id); }, [getTime]);
  const tr = useMemo(() => tracks(plan), [plan]);
  const ter = LunarSim.terrainOf(plan.site), now = LunarSim.sky(t, plan.site), src = siteSources(plan.site);

  const all = [...tr.sun.map(p => p[1]), ...tr.earth.map(p => p[1]), ...Array.from(ter.horizon)];
  const lo = Math.max(-10, Math.floor(Math.min(...all, -1))), hi = Math.min(90, Math.ceil(Math.max(...all, 2) + 0.5));
  const x = az => PL + (az / 360) * (W - PL - PR), y = el => PT + (1 - (el - lo) / (hi - lo)) * (H - PT - PB);
  let hz = `M${x(0)},${y(lo)}`; for (let a = 0; a <= 360; a += 2) hz += `L${x(a).toFixed(1)},${y(ter.hz(a)).toFixed(1)}`; hz += `L${x(360)},${y(lo)}Z`;
  const step = (hi - lo) > 30 ? 15 : (hi - lo) > 12 ? 5 : (hi - lo) > 5 ? 2 : 1, ticks = [];
  for (let e = Math.ceil(lo / step) * step; e <= hi; e += step) ticks.push(e);
  const fmt = v => (Math.abs(v) < 10 ? v.toFixed(1) : Math.round(v)) + '°';
  const az360 = a => Math.round(((a % 360) + 360) % 360) + '°';
  const site = plan.site, lonE = ((site.lon % 360) + 360) % 360;
  const trek = `https://trek.nasa.gov/moon/#v=0.1&x=${site.lon.toFixed(3)}&y=${site.lat.toFixed(3)}&z=9&p=urn%3Aogc%3Adef%3Acrs%3AEPSG%3A%3A104903&d=&locale=&b=moon`;
  const quickmap = 'https://quickmap.lroc.im-ldi.com/?prjExtent=-3670563.3802817%2C-1737400%2C3670563.3802817%2C1737400&earthShadowEnabled=true&proj=10&stack=3314';

  const dot = (az, el, c, vis) => <circle cx={x(((az % 360) + 360) % 360)} cy={y(Math.max(lo, Math.min(hi, el)))} r="5" fill={vis ? c : 'none'} stroke={c} strokeWidth="1.5" />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-lang={lang}>
      <div style={{ fontSize: 12, color: TXT }}>Sky from the landing site</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block', fontFamily: 'inherit' }} role="img" aria-label="Terrain horizon with Sun and Earth paths">
        {ticks.map(e => <g key={e}><line x1={PL} x2={W - PR} y1={y(e)} y2={y(e)} stroke="rgba(255,255,255,.08)" /><text x={PL - 5} y={y(e) + 3.5} fill={TXT} fontSize="9" textAnchor="end">{e}°</text></g>)}
        {[0, 90, 180, 270, 360].map((a, i) => <text key={a} x={x(a)} y={H - 6} fill={TXT} fontSize="10" textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}>{['N', 'E', 'S', 'W', 'N'][i]}</text>)}
        {lo < 0 && <line x1={PL} x2={W - PR} y1={y(0)} y2={y(0)} stroke="rgba(243,241,236,.35)" strokeDasharray="2 3" />}
        <path d={hz} fill="#2a2926" stroke="rgba(243,241,236,.55)" strokeWidth="1" />
        {segments(tr.earth, x, y).map((s, i) => <polyline key={'e' + i} points={s.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')} fill="none" stroke={BLUE} strokeWidth="1.5" strokeDasharray="1 3" strokeLinecap="round" />)}
        {segments(tr.sun, x, y).map((s, i) => <polyline key={'s' + i} points={s.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')} fill="none" stroke={GOLD} strokeWidth="1.5" strokeDasharray="1 3" strokeLinecap="round" />)}
        {dot(now.earthAz, now.earthEl, BLUE, now.link)}
        {dot(now.sunAz, now.sunEl, GOLD, now.lit > 0.5)}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ display: 'flex', gap: 8 }}><span style={{ color: GOLD, width: 52 }}>Sun</span><span>{fmt(now.sunEl)}</span><span style={{ color: TXT }}>az {az360(now.sunAz)} · horizon {fmt(now.sunHz)}</span></span>
        <span style={{ display: 'flex', gap: 8 }}><span style={{ color: BLUE, width: 52 }}>Earth</span><span>{fmt(now.earthEl)}</span><span style={{ color: TXT }}>az {az360(now.earthAz)} · horizon {fmt(now.earthHz)}</span></span>
      </div>
      <div style={{ fontSize: 12, color: TXT, lineHeight: 1.45 }}>
        <span>Dotted lines: paths during the surface stay. Filled dot: above the terrain.</span><br />
        <span>{`Sun and Earth: ${src.sky} · Horizon: ${src.horizon} · ${site.lat.toFixed(2)}°, ${lonE.toFixed(2)}°E`}</span>
      </div>
      <div style={{ display: 'flex', gap: '6px 14px', flexWrap: 'wrap', fontSize: 13 }}>
        <a href={trek} target="_blank" rel="noreferrer">Open in NASA Moon Trek</a>
        <a href={quickmap} target="_blank" rel="noreferrer">LROC QuickMap</a>
        <a href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noreferrer">JPL Horizons</a>
      </div>
    </div>
  );
}
