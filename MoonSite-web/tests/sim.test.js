// Core simulation checks: run with `npm test` (Node's built-in test runner, no extra dependencies).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import S from '../src/lib/sim.js';

const H = S.HOUR, D = S.DAY;
const site = id => S.SITES.find(s => s.id === id);
const withData = id => { const s = { ...site(id) }; s.data = JSON.parse(fs.readFileSync(new URL(`../public/data/${s.dataId}.json`, import.meta.url))); delete s._ter; return s; };
const altMoon = (pl, t) => S.V.len(S.V.sub(S.shipPos(pl, t), S.moonPos(t))) - S.R_M;
const altEarth = (pl, t) => S.V.len(S.shipPos(pl, t)) - S.R_E;
const launch = Date.UTC(2027, 11, 31);

test('ascent starts on the ground and reaches the 185 km parking orbit', () => {
  const pl = S.computePlan(launch, site('shackleton'));
  assert.ok(Math.abs(altEarth(pl, pl.launch)) < 0.01);
  assert.ok(Math.abs(altEarth(pl, pl.launch + S.ASCENT) - 185) < 0.5);
  for (let t = pl.launch; t <= pl.launch + S.ASCENT; t += 5000) assert.ok(altEarth(pl, t) > -0.01, 'never below ground');
});

test('the lander never passes below the lunar surface, for every site', () => {
  for (const s of S.SITES) {
    const pl = S.computePlan(launch, s);
    for (let t = pl.tA; t <= pl.tLand; t += 5000) {
      const a = altMoon(pl, t);
      assert.ok(a > -0.01, `${s.id}: ${a.toFixed(2)} km at T-${((pl.tLand - t) / 1000).toFixed(0)} s`);
    }
  }
});

test('touchdown is exactly on the site and the path is continuous', () => {
  const pl = S.computePlan(launch, site('nobile'));
  const end = S.shipPos(pl, pl.tLand), want = S.V.add(S.moonPos(pl.tLand), S.V.mul(S.siteNormal(pl.tLand, pl.site), S.R_M));
  assert.ok(S.V.len(S.V.sub(end, want)) < 1e-6);
  // no jumps: one second of flight never moves the craft more than orbital speed allows (~2.5 km/s in lunar orbit)
  for (const t0 of [pl.tA, pl.tLand - S.DEORBIT_S * 1000, pl.tLand - S.PDI_S * 1000, pl.tLand]) {
    for (let t = t0 - 120e3; t < t0 + 120e3; t += 1000) {
      const rel = tt => S.V.sub(S.shipPos(pl, tt), S.moonPos(tt));
      const step = S.V.len(S.V.sub(rel(t + 1000), rel(t)));
      assert.ok(step < 3, `jump of ${step.toFixed(2)} km near ${(t0 - pl.tLand) / 1000} s`);
    }
  }
});

test('the final approach is slow and nearly vertical', () => {
  const pl = S.computePlan(launch, site('shackleton'));
  const vRel = t => S.V.len(S.V.sub(S.V.sub(S.shipPos(pl, t + 500), S.moonPos(t + 500)), S.V.sub(S.shipPos(pl, t - 500), S.moonPos(t - 500)))) * 1000; // m/s
  assert.ok(vRel(pl.tLand - 10e3) < 5, `touchdown speed ${vRel(pl.tLand - 10e3).toFixed(1)} m/s`);
  const ds = S.descentState(pl, pl.tLand - 30e3);
  assert.ok(ds.pitch > 80, 'thrust axis close to vertical in the last 30 s');
  assert.ok(Math.abs(S.descentAlt(S.PDI_S) - 15) < 1e-9 && S.descentAlt(S.DEORBIT_S) === 100);
});

test('engine: cut at MECO, relit for the second stage, on during powered descent, off after touchdown', () => {
  const pl = S.computePlan(launch, site('shackleton'));
  assert.equal(S.burn(pl, pl.launch + 300e3).level, 1);
  assert.equal(S.burn(pl, pl.launch + 508e3).level, 0);
  assert.ok(S.burn(pl, pl.launch + 520e3).level > 0.5);
  assert.equal(S.burn(pl, pl.tLand - 300e3).kind, 'descent');
  assert.equal(S.burn(pl, pl.tLand + 1000).level, 0);
});

test('far side has no direct Earth link; Apollo 11 always sees Earth', () => {
  const far = S.computePlan(Date.UTC(2027, 11, 25), withData('ce4'));
  assert.equal(far.linkPct, 0);
  assert.equal(far.verdict, 'not');
  const a11 = S.computePlan(Date.UTC(2027, 11, 25), withData('a11'));
  assert.ok(a11.linkPct > 99, `Apollo 11 link ${a11.linkPct}%`);
});

test('Horizons data and the analytic model agree on where the Sun is', () => {
  const real = withData('shackleton'), model = { ...site('shackleton') };
  for (let t = Date.UTC(2027, 0, 1); t < Date.UTC(2027, 1, 1); t += 37 * H) {
    const a = S.sky(t, real), b = S.sky(t, model);
    assert.ok(Math.abs(a.sunEl - b.sunEl) < 0.6, `sun elevation off by ${(a.sunEl - b.sunEl).toFixed(2)}°`);
  }
});

test('operational windows add up to the sunlight percentage', () => {
  const pl = S.computePlan(launch, withData('shackleton'));
  const w = S.windows(pl, 1), hours = w.sun.reduce((s, x) => s + x.hours, 0), total = (pl.tEnd - pl.tLand) / H;
  assert.ok(Math.abs(100 * hours / total - pl.sunPct) < 3, `${(100 * hours / total).toFixed(1)}% vs ${pl.sunPct.toFixed(1)}%`);
  assert.ok(w.powerW >= 0 && w.powerW <= 1361 * 0.3);
});

test('verdict follows the requirements', () => {
  const s = withData('shackleton'), easy = S.computePlan(launch, s, { maxDark: 400, minLink: 0 }), hard = S.computePlan(launch, s, { maxDark: 12, minLink: 100 });
  assert.equal(easy.verdict, 'viable');
  assert.equal(hard.verdict, 'not');
});

test('nextChange reports when sunlight flips', () => {
  const s = withData('shackleton'), t = launch + 5 * D, nc = S.nextChange(t, s, 'lit');
  if (nc.hours != null) assert.notEqual(S.sky(t + nc.hours * H, s).lit > 0.5, nc.now);
});
