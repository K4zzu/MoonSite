// Mission report for planners: CSV of the operational windows and a printable page (Save as PDF).
import LunarSim from './sim.js';
import { siteSources } from './lunarData.js';

const iso = t => new Date(t).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
const h1 = x => (Math.round(x * 10) / 10).toFixed(1);
const lonE = lon => ((lon % 360) + 360) % 360;

export function missionSummary(plan) {
  const w = LunarSim.windows(plan), src = siteSources(plan.site);
  return { w, src };
}

export function reportCSV(plan) {
  const { w, src } = missionSummary(plan), s = plan.site, rows = [];
  rows.push(['MoonSite mission report']);
  rows.push(['Site', s.name], ['Latitude', s.lat.toFixed(4)], ['East longitude', lonE(s.lon).toFixed(3)], ['Position source', s.position || 'built-in']);
  rows.push(['Launch', iso(plan.launch)], ['Landing', iso(plan.tLand)], ['End of surface stay', iso(plan.tEnd)]);
  rows.push(['Verdict', plan.text], ['Sunlight %', h1(plan.sunPct)], ['Earth link %', h1(plan.linkPct)], ['Both %', h1(plan.bothPct)]);
  rows.push(['Longest night h', h1(plan.longestNight)], ['Max Sun elevation deg', h1(plan.maxSunEl)], ['Mean power W (1 m2 vertical panel, 30%)', h1(w.powerW)], ['Energy Wh/day', Math.round(w.energyWhDay)]);
  rows.push(['Requirements', `stay ${plan.req.duration} d; max night ${plan.req.maxDark} h; min link ${plan.req.minLink}%`]);
  rows.push(['Sun/Earth data', src.sky], ['Horizon data', src.horizon]);
  rows.push([]);
  rows.push(['Window', 'Start (UTC)', 'End (UTC)', 'Hours']);
  for (const [k, label] of [['sun', 'Sunlight'], ['link', 'Earth link'], ['both', 'Sunlight + link']]) for (const x of w[k]) rows.push([label, iso(x.start), iso(x.end), h1(x.hours)]);
  return rows.map(r => r.map(c => /[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c).join(',')).join('\n');
}

export function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function skySvg(plan) {
  const S = LunarSim, ter = S.terrainOf(plan.site), W = 640, H = 220, P = 34, n = 240, sun = [], earth = [];
  for (let i = 0; i <= n; i++) { const k = S.sky(plan.tLand + (plan.tEnd - plan.tLand) * i / n, plan.site); sun.push([k.sunAz, k.sunEl]); earth.push([k.earthAz, k.earthEl]); }
  const all = [...sun.map(p => p[1]), ...earth.map(p => p[1]), ...ter.horizon];
  const lo = Math.max(-10, Math.floor(Math.min(...all, -1))), hi = Math.min(90, Math.ceil(Math.max(...all, 2) + .5));
  const x = a => P + (((a % 360) + 360) % 360) / 360 * (W - P - 10), y = e => 10 + (1 - (e - lo) / (hi - lo)) * (H - 40);
  let hz = `M${x(0)},${y(lo)}`; for (let a = 0; a <= 360; a += 2) hz += `L${a === 360 ? W - 10 : x(a)},${y(ter.hz(a))}`; hz += `L${W - 10},${y(lo)}Z`;
  const pts = arr => { let d = '', prev = null; for (const p of arr) { const az = ((p[0] % 360) + 360) % 360; d += (prev == null || Math.abs(az - prev) > 180 ? 'M' : 'L') + x(az).toFixed(1) + ',' + y(p[1]).toFixed(1); prev = az; } return d; };
  const ticks = []; const st = hi - lo > 12 ? 5 : hi - lo > 5 ? 2 : 1; for (let e = Math.ceil(lo / st) * st; e <= hi; e += st) ticks.push(`<line x1="${P}" x2="${W - 10}" y1="${y(e)}" y2="${y(e)}" stroke="#ddd"/><text x="${P - 4}" y="${y(e) + 3}" font-size="9" text-anchor="end">${e}°</text>`);
  const lab = ['N', 'E', 'S', 'W', 'N'].map((c, i) => `<text x="${P + i * (W - P - 10) / 4}" y="${H - 8}" font-size="10" text-anchor="middle">${c}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%">${ticks.join('')}<path d="${hz}" fill="#cfcac0" stroke="#777"/><path d="${pts(earth)}" fill="none" stroke="#2f6fd0" stroke-width="1.5"/><path d="${pts(sun)}" fill="none" stroke="#d49a1c" stroke-width="1.5"/>${lab}</svg>`;
}

export function openPrintableReport(plan) {
  const { w, src } = missionSummary(plan), s = plan.site, col = { viable: '#1f8a4c', marginal: '#b07b00', not: '#c0392b' }[plan.verdict];
  const table = (rows, label) => rows.length ? rows.map(x => `<tr><td>${label}</td><td>${iso(x.start)}</td><td>${iso(x.end)}</td><td class="n">${h1(x.hours)}</td></tr>`).join('') : `<tr><td>${label}</td><td colspan="3">none</td></tr>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>MoonSite report — ${s.name}</title><style>
body{font:13px/1.45 system-ui,sans-serif;color:#111;max-width:760px;margin:28px auto;padding:0 20px}h1{font-size:22px;margin:0}h2{font-size:14px;margin:22px 0 6px;text-transform:uppercase;letter-spacing:.06em;color:#555}
table{border-collapse:collapse;width:100%}td,th{padding:4px 6px;border-bottom:1px solid #e3e3e3;text-align:left}.n{text-align:right;font-variant-numeric:tabular-nums}.v{font-size:18px;font-weight:600;color:${col}}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.k{border:1px solid #e3e3e3;border-radius:8px;padding:8px}.k b{display:block;font-size:18px}small{color:#666}@media print{button{display:none}}</style></head><body>
<button onclick="print()" style="float:right">Print / Save as PDF</button><h1>${s.name}</h1><small>${s.lat.toFixed(4)}°, ${lonE(s.lon).toFixed(3)}°E · ${s.position || ''}</small>
<p class="v">${plan.text}</p>
<table><tr><td>Launch</td><td>${iso(plan.launch)}</td></tr><tr><td>Landing</td><td>${iso(plan.tLand)}</td></tr><tr><td>End of stay</td><td>${iso(plan.tEnd)}</td></tr>
<tr><td>Requirements</td><td>stay ${plan.req.duration} d · longest night ≤ ${plan.req.maxDark} h · Earth link ≥ ${plan.req.minLink}%</td></tr></table>
<h2>Power and communication</h2><div class="grid"><div class="k">Sunlight<b>${h1(plan.sunPct)}%</b></div><div class="k">Earth link<b>${h1(plan.linkPct)}%</b></div><div class="k">Longest night<b>${h1(plan.longestNight)} h</b></div><div class="k">Max Sun elevation<b>${h1(plan.maxSunEl)}°</b></div>
<div class="k">Both<b>${h1(plan.bothPct)}%</b></div><div class="k">Mean power<b>${h1(w.powerW)} W</b><small>1 m² vertical panel, 30%</small></div><div class="k">Energy<b>${Math.round(w.energyWhDay)} Wh/day</b></div><div class="k">Δv total<b>${h1(plan.dv.tli + plan.dv.loi + plan.dv.descent)} km/s</b></div></div>
<h2>Sky from the site during the stay</h2>${skySvg(plan)}<small>Grey: terrain horizon. Gold: Sun path. Blue: Earth path.</small>
<h2>Operational windows</h2><table><tr><th>Window</th><th>Start</th><th>End</th><th class="n">Hours</th></tr>${table(w.sun, 'Sunlight')}${table(w.link, 'Earth link')}${table(w.both, 'Sunlight + link')}</table>
<h2>Data</h2><small>Sun and Earth: ${src.sky}. Horizon: ${src.horizon}. Terrain: ${src.terrain}. Transfer: two-body direct transfer model.<br>Generated by MoonSite ${new Date().toISOString().slice(0, 10)}. Not an official NASA product.</small>
</body></html>`;
  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); }
  else download(`moonsite-${s.id}.html`, html, 'text/html');
}
