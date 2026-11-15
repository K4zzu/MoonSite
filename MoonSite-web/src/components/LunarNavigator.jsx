// Lunar Navigator — port of the Claude Design screen "Lunar Navigator.dc.html" to React.
// The logic class is the design's own component logic; render() is its template converted to JSX.
import React, { Fragment } from 'react';
import LunarSim from '../lib/sim.js';
import { LunarUI } from '../lib/extras.js';
import { LunarScene } from '../lib/scene.js';
import { loadLunarData } from '../lib/lunarData.js';
import { css, asset } from '../lib/css.js';
import HorizonChart from './HorizonChart.jsx';
import WindowsPanel from './WindowsPanel.jsx';
import Cinematic from './Cinematic.jsx';
import { Sound } from '../lib/audio.js';
import { STAGING } from '../lib/ships.js';
import './LunarNavigator.hover.css';

export default class LunarNavigator extends React.Component {
  state = { ready: false, loadP: 0, loadLabel: 'Starting', scale: 'transit', follow: true, playing: false, speedIdx: 1, pop: null, details: false, compare: false, explain: null, evm: false, reduce: null, cardId: null, hoverText: '', replanning: false, diffs: [], alts: [], replanned: false, pov: false, lang: null, flash: false, intro: true, pre: false, menu: false, mobile: typeof window !== 'undefined' && window.innerWidth < 720, sel: ['0,4', '0,3'], tut: -1, hoverMs: -1, dOff: 0, cLat: '', cLon: '', cErr: '', panes: [{ siteId: 'shackleton', dt: 0 }, { siteId: 'nobile', dt: 0 }], v: 0 };
  root = React.createRef(); canvas = React.createRef(); track = React.createRef();
  KF = [0, .09, .38, .5, 1];
  SPEEDS = [[3600, '1 h/s'], [21600, '6 h/s'], [86400, '1 d/s']];
  componentDidMount() { this.boot(); window.addEventListener('keydown', this.onKey); }
  componentWillUnmount() { this._unmounted = true; window.removeEventListener('keydown', this.onKey); Sound.engine(0); this._mro && this._mro.disconnect(); clearTimeout(this._bt); clearTimeout(this._gt); this.scene && this.scene.dispose(); }
  componentDidUpdate() { this._els = null; this.applyLang(); this.posTut(); this._pst = null; }
  reduce() { return this.state.reduce ?? this.props.reduceMotion ?? false; }
  explainOn() { return this.state.explain ?? this.props.explain ?? false; }
  seenTut() { try { return !!localStorage.getItem('lunarnav.tutorial'); } catch (e) { return true; } }
  endTut() { try { localStorage.setItem('lunarnav.tutorial', '1'); } catch (e) {} const play = this._playAfterTut, cmp = this._cmpAfter; this._playAfterTut = this._cmpAfter = false; if (cmp) { this.scene.pov = false; this.scene.flyTo('transit', true); this.scene.snap(); } if (this._siteAfter) { this._siteAfter = false; this.setState({ tut: -1, pre: false, pop: 'site' }); return; } this.setState(Object.assign({ tut: -1, pre: false, playing: play && cmp ? true : this.state.playing }, cmp ? { compare: true, pov: false, scale: 'auto' } : {})); if (play && !cmp) this.beginPlay(); }
  posTut() {
    const root = this.root.current, i = this.state.tut, hl = root && root.querySelector('[data-tut-hl]'), card = root && root.querySelector('[data-tut-card]'); if (!hl || i < 0) return;
    const step = LunarUI.TUTORIAL[i], el = step.sel && root.querySelector(step.sel), rb = root.getBoundingClientRect(), z = rb.width / root.offsetWidth || 1, W = root.offsetWidth, H = root.offsetHeight, r = el ? el.getBoundingClientRect() : null, ok = r && r.width > 2;
    const x = ok ? (r.left - rb.left) / z - 10 : W / 2, y = ok ? (r.top - rb.top) / z - 8 : H / 2, w = ok ? r.width / z + 20 : 0, h = ok ? r.height / z + 16 : 0, cw = Math.min(380, W - 48), ch = card.offsetHeight || 220;
    Object.assign(hl.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px', borderColor: ok ? 'rgba(243,241,236,.85)' : 'transparent' });
    card.style.left = Math.min(W - cw - 24, Math.max(24, x + w / 2 - cw / 2)) + 'px';
    card.style.top = Math.max(16, Math.min(H - ch - 16, !ok ? H / 2 - ch / 2 : y + h / 2 < H / 2 ? y + h + 16 : y - ch - 16)) + 'px';
  }
  startMissions(selArg, tut) {
    const S = this.S, ms = (selArg || this.state.sel).map(k => { const q = k.split(','); return this.grid[q[0]] && this.grid[q[0]].cells[q[1]]; }).filter(Boolean); if (!ms.length) return; const m0 = ms[0], sc = this.scene, first = tut == null ? !this.seenTut() : tut, many = ms.length > 1, cmp = many && !first; this._cmpAfter = many && first;
    this.rp = null; this.tw = null; this.hold = null; clearTimeout(this._gt); this.plan = this.original = m0.plan; sc.setPlan(m0.plan); sc.setAlts([]); sc.ghostAlpha = this.ghostTarget = 0; sc.altAlpha = this.altTarget = 0; sc.drawFrac = 1; this.syncPlanRolls(m0.plan, true);
    this.t = sc.time = m0.plan.launch; sc.follow = true; sc.pov = !cmp; sc.selectedId = null; sc.flyTo('transit', true); sc.snap(); this._force = true; this._started = true; this._playAfterTut = first;
    this.setState({ pre: false, intro: false, menu: false, scale: cmp ? 'auto' : 'transit', compare: cmp, panes: many ? ms.map(m => ({ siteId: m.plan.site.id, dt: Math.round((m.plan.launch - m0.plan.launch) / S.DAY) })) : this.state.panes, follow: true, pov: !cmp, playing: false, alts: [], diffs: [], replanned: false, replanning: false, cardId: null, pop: null, details: false, tut: first ? 0 : -1 }); if (!first) this.beginPlay(cmp);
  }
  lang() { return this.state.lang ?? this.props.language ?? 'en'; }
  tr(s) { return LunarUI ? LunarUI.tr(this.lang(), s) : s; }
  applyLang() { LunarUI && LunarUI.applyLang(this); }
  ping(x, y, color) { LunarUI && LunarUI.ping(this, x, y, color); }
  setCam(follow, pov) { this.scene.follow = follow; this.scene.pov = pov; this.setState({ follow, pov }); }
  panePlan(p) { const S = this.S, pl = this.plan, s = this.siteById(p.siteId), key = s.id + s.lat + s.lon + '|' + p.dt + '|' + pl.launch + '|' + JSON.stringify(this.req); if (!this._pc || Object.keys(this._pc).length > 60) this._pc = {}; return this._pc[key] || (this._pc[key] = S.computePlan(pl.launch + p.dt * S.DAY, s, this.req)); }
  boot() {
    if (!this.canvas.current) { this._bt = setTimeout(() => this.boot(), 60); return; }
    if (!this._dataReady) { this.setState({ loadLabel: 'Loading lunar data' }); loadLunarData(LunarSim.SITES, p => this.setState({ loadP: 0.06 * p })).then(st => { this.dataStatus = st; this._dataReady = true; if (!this._unmounted) this.boot(); }); return; }
    const S = this.S = LunarSim; this.sites = S.SITES.slice(); this.req = Object.assign({}, S.DEFAULT_REQ); this.rolls = {}; this.txts = {}; this.dots = {};
    this.plan = this.original = S.computePlan(Date.UTC(2027, 11, 31), this.sites[0], this.req); const D0 = Date.UTC(2027, 11, 19); this.grid = ['shackleton', 'ridge', 'nobile', 'malapert', 'a11', 'ce4'].map(id => { const site = this.sites.find(x => x.id === id); return { site, cells: [0, 1, 2, 3, 4, 5, 6].map(j => ({ plan: id === 'shackleton' && j === 4 ? this.plan : S.computePlan(D0 + j * 3 * S.DAY, site, this.req) })) }; }); this.missions = LunarUI.MISSIONS.map(m => Object.assign({}, m, { plan: m.site === 'shackleton' && m.date === this.plan.launch ? this.plan : S.computePlan(m.date, this.sites.find(s => s.id === m.site), this.req) })); this.t = this.plan.launch + 25 * 60000; this.ghostTarget = 0; this.altTarget = 0;
    const sc = this.scene = new LunarScene(this.canvas.current); sc.setPlan(this.plan); sc.time = this.t; sc.reduceMotion = this.reduce();
    sc.onProgress = (p, l) => this.setState({ loadP: p, loadLabel: l }); sc.onReady = () => this.setState({ ready: true });
    sc.onTick = dt => this.tick(dt); sc.onFrame = (A, dt) => this.frame(A, dt); sc.onHover = h => this.onHover(h); sc.onPick = h => this.onPick(h);
    this._mro = new ResizeObserver(() => { const r = this.root.current; if (!r) return; const m = r.offsetWidth < 720, mid = r.offsetWidth < 1100, short = r.offsetHeight < 640; if (m !== this.state.mobile) this.setState({ mobile: m, menu: false }); if (mid !== this.state.mid || short !== this.state.short) this.setState({ mid, short }); }); this._mro.observe(this.root.current);
    this.syncPlanRolls(this.plan, true); sc.init(); if (import.meta.env.DEV) window.__lunar = this; window.lunarDemo = n => this.demo(n); window.lunarRun = (n, dt) => { for (let i = 0; i < n; i++) sc.step(dt || .05); };
    window.lunarStage = (w, h) => { const r = this.root.current, k = Math.min(window.innerWidth / w, window.innerHeight / h); Object.assign(r.style, { inset: 'auto', left: '0', top: '0', width: w + 'px', height: h + 'px', transform: `scale(${k})`, transformOrigin: '0 0' }); sc._resize(); };
    this.forceUpdate();
  }
  fracOf(pl, t) { const k = [pl.launch, pl.tTLI, pl.tA, pl.tLand, pl.tEnd], F = this.KF; if (t <= k[0]) return 0; for (let i = 0; i < 4; i++) if (t <= k[i + 1]) return F[i] + (F[i + 1] - F[i]) * (t - k[i]) / (k[i + 1] - k[i]); return 1; }
  timeOf(pl, f) { const k = [pl.launch, pl.tTLI, pl.tA, pl.tLand, pl.tEnd], F = this.KF; f = Math.min(1, Math.max(0, f)); for (let i = 0; i < 4; i++) if (f <= F[i + 1]) return k[i] + (k[i + 1] - k[i]) * (f - F[i]) / (F[i + 1] - F[i]); return k[4]; }
  roll(key, to, fmt, from) { const r = this.rolls[key] || (this.rolls[key] = { v: from ?? to }); if (from != null) r.v = from; r.to = to; r.fmt = fmt; }
  syncPlanRolls(pl, snap) {
    const S = this.S, pct = v => Math.round(v) + '%', R = (k, v, f) => this.roll(k, v, f, snap ? v : undefined);
    R('launch', pl.launch, S.fmtDateY); R('arrive', pl.tA, S.fmtDate); R('sunPct', pl.sunPct, pct); R('linkPct', pl.linkPct, pct); R('bothPct', pl.bothPct, pct);
    R('nightMax', pl.longestNight, v => Math.round(v) + ' h'); R('maxEl', pl.maxSunEl, v => v.toFixed(1) + '°');
    const kms = v => v.toFixed(2) + ' km/s'; R('dvTli', pl.dv.tli, kms); R('dvLoi', pl.dv.loi, kms); R('dvDesc', pl.dv.descent, kms); R('dvTot', pl.dv.tli + pl.dv.loi + pl.dv.descent, kms); R('tof', pl.tof, v => v.toFixed(1) + ' d');
  }
  setTxt(k, s) { if (this.txts[k] !== s) { this.txts[k] = s; this._dirtyTxt = true; } }
  setDot(k, on) { if (this.dots[k] !== on) { this.dots[k] = on; this._dirtyTxt = true; } }

  // ---------- replanning
  replan(ch, opts) {
    opts = opts || {}; const S = this.S, old = opts.from || this.plan, f = this.fracOf(this.plan, this.t);
    if (ch.req) this.req = ch.req;
    const next = S.computePlan(ch.launch ?? this.plan.launch, ch.site || this.plan.site, this.req);
    this.scene.setGhost(old); this.ghostTarget = 1; this.scene.setAlts([]); this.altTarget = 0; this.scene.altAlpha = 0; clearTimeout(this._gt);
    this.rp = { old, next, k: 0, f, dur: this.reduce() ? .45 : 2, slide: !opts.quick && old.launch !== next.launch, freeze: opts.freeze };
    const pct = v => Math.round(v) + '%', diffs = [], dd = Math.round((next.tLand - old.tLand) / S.DAY);
    if (old.site.id !== next.site.id || old.site.name !== next.site.name) diffs.push({ label: 'Site', from: old.site.name.split(' (')[0], key: 'dSite', color: '#F3F1EC', delta: '' }), this.roll('dSite', 0, () => next.site.name.split(' (')[0], 0);
    if (dd !== 0) diffs.push({ label: 'Arrival', from: S.fmtDate(old.tLand), key: 'dArr', color: '#F3F1EC', delta: `(${dd > 0 ? '+' : ''}${dd} d)` }), this.roll('dArr', next.tLand, S.fmtDate, old.tLand);
    diffs.push({ label: 'Sunlight', from: pct(old.sunPct), key: 'dSun', color: '#E8B95A', delta: '' }); this.roll('dSun', next.sunPct, pct, old.sunPct);
    diffs.push({ label: 'Earth link', from: pct(old.linkPct), key: 'dLink', color: '#6FA8F5', delta: '' }); this.roll('dLink', next.linkPct, pct, old.linkPct);
    const sa = this.scene.anchors.ship; if (sa && sa.vis && !this.state.compare) this.ping(sa.x, sa.y, '#E8B95A'); this.hold = null; this._force = true; this.syncPlanRolls(next); this.setState({ replanning: true, alts: [], diffs, pop: null, playing: false });
  }
  tickReplan(dt) {
    const r = this.rp, S = this.S, sc = this.scene, ez = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    r.k = Math.min(1, r.k + dt / r.dur); if (r.freeze != null) r.k = Math.min(r.k, r.freeze);
    const kk = r.slide ? ez(S.clamp((r.k - .1) / .45, 0, 1)) : 1;
    const live = r.slide && kk < 1 ? S.computePlan(r.old.launch + (r.next.launch - r.old.launch) * kk, r.next.site, this.req) : r.next;
    if (live !== this.plan) { this.plan = live; sc.setPlan(live); }
    this.t = this.timeOf(live, r.f); sc.drawFrac = ez(S.clamp((r.k - .5) / .42, 0, 1));
    if (r.k >= 1) {
      this.rp = null; sc.drawFrac = 1; const worse = S.RANK[r.next.verdict] < S.RANK[r.old.verdict] || r.next.verdict === 'not';
      const alts = worse ? S.alternatives(r.next, this.original) : []; sc.setAlts(alts.map(a => a.plan)); this.altTarget = alts.length ? 1 : 0;
      this.ghostTarget = .55; this._gt = setTimeout(() => { this.ghostTarget = 0; }, 7000);
      this.hold = { until: performance.now() + 8000, ch: 'Plan updated', tx: r.next.verdict === 'viable' ? 'The new plan works: enough sunlight for power and enough contact with Earth.' : r.next.verdict === 'marginal' ? 'The new plan is on the edge. It works only with little margin for night or lost contact.' : alts.length ? 'The new plan fails. Tap one of the numbered routes to try an alternative.' : 'The new plan fails at this site and date.' }; this._force = true; clearTimeout(this._fl); this._fl = setTimeout(() => this.setState({ flash: false }), 900);
      this.setState({ replanning: false, alts, replanned: r.next !== this.original, flash: true, v: this.state.v + 1 });
    }
  }
  // ---------- per-frame
  tick(dt) {
    if (this.cd != null) { this.tickCountdown(dt); return; }
    const S = this.S, sc = this.scene, pl = this.plan; sc.reduceMotion = this.reduce(); if (!this.state.compare && this.state.scale === 'auto') { const to = this.t >= pl.tLand ? 'surface' : 'transit'; sc.flyTo(to, true); sc.snap(); this.setState({ scale: to }); }
    if (this.rp) this.tickReplan(dt);
    else if (this.tw) { const w = this.tw; w.k = Math.min(1, w.k + dt / w.dur); const e = w.k < .5 ? 2 * w.k * w.k : 1 - Math.pow(-2 * w.k + 2, 2) / 2; this.t = w.a + (w.b - w.a) * e; if (w.k >= 1) this.tw = null; }
    else if (this.state.playing) {
      const prev = this.t; const rate = Math.min(this.SPEEDS[this.state.speedIdx][0], LunarUI.eventRate(pl, this.t)); this.slow = rate < this.SPEEDS[this.state.speedIdx][0]; this.t = Math.min(pl.tEnd, this.t + dt * rate * 1000); for (const ev of [pl.tTLI - 240000, pl.tA - 240000, pl.tLand - 840000]) if (prev < ev && this.t > ev) this.t = ev + 1;
      if (!this.state.compare) { const MN = 60000, x = e2 => prev < e2 && this.t >= e2; if (x(pl.launch + 10 * MN) && this.state.pov) this.setCam(true, false); if (x(pl.tLand - 13 * MN)) { if (this.state.scale !== 'transit') this.goScale('transit', true); this.setCam(true, true); } if (prev < pl.tA && this.t >= pl.tA && this.state.scale === 'transit') this.goScale('moon', true); if (prev < pl.tLand && this.t >= pl.tLand && this.state.scale !== 'surface') this.goScale('surface', true); }
      if (this.t >= pl.tEnd) this.setState({ playing: false });
    }
    sc.time = this.t; const k = this.reduce() ? 1 : 1 - Math.exp(-dt * 5);
    sc.ghostAlpha += (this.ghostTarget - sc.ghostAlpha) * k; sc.altAlpha += (this.altTarget - sc.altAlpha) * k;
    if (this.state.compare && this.root.current) {
      const cb = this.canvas.current.getBoundingClientRect(), z = cb.width / this.canvas.current.clientWidth || 1; sc.compareRects = Array.from(this.root.current.querySelectorAll('[data-pane-view]')).map(el => { const b = el.getBoundingClientRect(); return { x: Math.round((b.left - cb.left) / z) + 1, y: Math.round((b.top - cb.top) / z) + 1, w: Math.round(b.width / z) - 2, h: Math.round(b.height / z) - 1 }; });
      const fr = this.fracOf(pl, this.t); sc.compareMode = this.state.scale === 'auto' ? 'auto' : this.state.scale === 'transit' ? 'route' : 'surface'; sc.compare = this.state.panes.map(p => { const pp = this.panePlan(p); return { site: pp.site, plan: pp, t: this.timeOf(pp, fr) }; });
      this.state.panes.forEach((p, i) => { const pp = sc.compare[i].plan, pt = sc.compare[i].t, k2 = S.sky(pt, pp.site), landed = pt >= pp.tLand, ps = this._pst || (this._pst = this.root.current.querySelectorAll('[data-pstat]')); if (ps[i]) ps[i].style.opacity = landed || sc.compareMode === 'surface' ? 1 : 0; const mh = Math.max(0, (pt - pp.launch) / S.HOUR); this.setTxt('p' + i + 'ph', (pt < pp.launch + 600000 ? 'Launch' : pt < pp.tTLI ? 'Parking orbit' : pt < pp.tA ? 'Coast' : pt < pp.tLand - S.HOUR ? 'Lunar orbit' : pt < pp.tLand ? 'Descent' : 'Surface operations') + ' · T+ ' + Math.floor(mh / 24) + ' d ' + String(Math.floor(mh % 24)).padStart(2, '0') + ' h'); this.setTxt('p' + i + 's', k2.lit > .5 ? 'Sunlight' : 'In shadow'); this.setDot('p' + i + 's', k2.lit > .5); this.setTxt('p' + i + 'l', k2.link ? 'Link to Earth' : 'No link'); this.setDot('p' + i + 'l', k2.link); });
      this.frame(sc.anchors, dt);
    } else sc.compare = null;
  }
  frame(A, dt) {
    this.checkMilestones();
    const S = this.S, pl = this.plan, root = this.root.current; if (!root || !pl) return; const t = this.t, scale = this.state.scale;
    this._acc = (this._acc || 0) + dt;
    if (this._acc > .2 || this._force) {
      this._acc = 0; this._force = false;
      const met = Math.max(0, (t - pl.launch) / S.HOUR); this.roll('met', met, v => `T+ ${Math.floor(v / 24)} d ${String(Math.floor(v % 24)).padStart(2, '0')} h`);
      const sp = S.shipPos(pl, t), dm = Math.max(0, S.V.len(S.V.sub(sp, S.moonPos(t))) - S.R_M); this.roll('dist', dm, v => (v > 1000 ? Math.round(v / 100) * 100 : Math.round(v)).toLocaleString('en-US') + ' km'); this.roll('speed', S.shipSpeed(pl, t), v => v.toFixed(2) + ' km/s');
      const sk = S.sky(t, pl.site), nc = S.nextChange(t, pl.site, 'lit'), lc = S.nextChange(t, pl.site, 'link'), dur = v => v > 720 ? '30+ d' : S.fmtDur(v);
      this.roll('night', nc.hours ?? 9999, dur); this.roll('link', lc.hours ?? 9999, dur); this.roll('sunEl', sk.sunEl, v => v.toFixed(1) + '°');
      this.setTxt('nightLabel', nc.now ? 'Night begins in' : 'Sunrise in'); this.setTxt('linkLabel', lc.now ? 'Earth link lost in' : 'Earth link back in');
      this.setTxt('sunState', sk.lit > .5 ? 'Sunlight' : sk.sunEl > -0.3 ? 'Sun behind terrain' : 'Night'); this.setDot('sun', sk.lit > .5);
      this.setTxt('linkState', sk.link ? 'Link to Earth' : sk.earthEl > 0 ? 'Earth behind terrain' : 'No link to Earth'); this.setDot('link', sk.link);
      const ph = t < pl.launch + 600000 ? 'Launch' : t < pl.tTLI ? 'Parking orbit' : t < pl.tA ? 'Coast' : t < pl.tLand - S.HOUR ? 'Lunar orbit' : t < pl.tLand ? 'Descent' : 'Surface operations';
      LunarUI.updateStory(this, pl, t, sk); this.setTxt('phase', ph); const d = new Date(t); this.setTxt('clock', S.fmtDate(t) + ' · ' + String(d.getUTCHours()).padStart(2, '0') + ':00 UTC');
      if (this.state.cardId) { const s = this.siteById(this.state.cardId), k2 = s && S.sky(t, s); if (k2) { this.setTxt('cardSun', k2.lit > .5 ? 'Yes, now' : 'In shadow'); this.setDot('cardSun', k2.lit > .5); this.setTxt('cardLink', k2.link ? 'Yes, now' : 'Not visible'); this.setDot('cardLink', k2.link); } }
    }
    if (!this._els) { this._els = { a: Array.from(root.querySelectorAll('[data-anchor]')), r: Array.from(root.querySelectorAll('[data-roll]')), t: Array.from(root.querySelectorAll('[data-txt]')), d: Array.from(root.querySelectorAll('[data-dot]')), e: Array.from(root.querySelectorAll('[data-edge]')), fill: root.querySelector('[data-tl=fill]'), handle: root.querySelector('[data-tl=handle]') }; this._dirtyTxt = true; for (const k in this.rolls) this.rolls[k].s = null; }
    const E = this._els, kr = this.reduce() || this._snapRolls ? 1 : 1 - Math.exp(-dt * 4.5);
    for (const k in this.rolls) { const r = this.rolls[k]; r.v += (r.to - r.v) * kr; if (Math.abs(r.to - r.v) < Math.abs(r.to) * 1e-4 + 1e-3) r.v = r.to; const s = r.fmt(r.v); if (s !== r.s) { r.s = s; r.dirty = true; } }
    for (const el of E.r) { const r = this.rolls[el.dataset.roll]; if (r && (r.dirty || el.textContent !== r.s)) el.textContent = r.s; }
    for (const k in this.rolls) this.rolls[k].dirty = false;
    if (this._dirtyTxt) { this._dirtyTxt = false; for (const el of E.t) { const s0 = this.txts[el.dataset.txt], s = s0 == null ? null : this.tr(s0); if (s != null && el.textContent !== s) el.textContent = s; } for (const el of E.d) { const on = this.dots[el.dataset.dot]; if (on != null) el.style.opacity = on ? 1 : .22; } }
    const f = this.fracOf(pl, t) * 100; if (E.fill) E.fill.style.width = f + '%'; if (E.handle) E.handle.style.left = f + '%';
    const W = root.clientWidth, H = root.clientHeight, hov = this.hov, vcEl = this._vcEl || (this._vcEl = root.querySelector('[data-verdict]')); if (vcEl) this._vcTop = vcEl.offsetTop;
    for (const el of E.e) { const k = el.dataset.edge, q = A[k], sk = A.sky, onScr = q && q.vis && q.x > 0 && q.x < W, show = scale === 'surface' && !A.flying && !this.state.compare && sk && !onScr && this.scene.surfaceView.yaw != null;
      if (show) { const side = (((k === 'sun' ? sk.sunAz : sk.earthAz) - this.scene.surfaceView.yaw + 540) % 360) - 180, name = this.tr(k === 'sun' ? 'Sun' : 'Earth'), s = side < 0 ? '‹ ' + name : name + ' ›'; if (el.textContent !== s) el.textContent = s; el.style.left = side < 0 ? '24px' : 'auto'; el.style.right = side < 0 ? 'auto' : '24px'; }
      el.style.opacity = show ? 1 : 0; el.style.pointerEvents = show ? 'auto' : 'none'; }
    for (const el of E.a) {
      const ds = el.dataset, key = ds.anchor; let q = null;
      if (key === 'hover') q = hov ? (hov.type === 'site' ? A.sites[hov.site.id] : A[hov.type]) : null;
      else if (key === 'card') q = this.state.cardId ? A.sites[this.state.cardId] : null;
      else if (key.startsWith('alt')) { const i = +key.slice(3); const a = A.alts[i], inView = a && a.vis && a.x > 20 && a.x < W - 300 && a.y > 90 && a.y < H - 190, n = this.state.alts.length; if (this._vcTop == null || this._acc === 0) { const vc = root.querySelector('[data-verdict]'); this._vcTop = vc ? vc.offsetTop : H - 300; } const ab = root.querySelector('[data-actions]'), mob = this.state.mobile, base = mob ? H - 262 : this._vcTop - 12, minY = mob ? 196 : ab ? ab.getBoundingClientRect().bottom - root.getBoundingClientRect().top + 10 : 80, top0 = Math.max(base - n * 46, minY), side = !mob && top0 + n * 46 > base + 8; this._sideStack = side && n > 0 && !this.state.compare; q = scale === 'transit' && inView && !A.flying ? { x: a.x + 14, y: a.y - 16, vis: true } : { x: side ? Math.max(12, W - 372 - 360) : Math.max(12, W - 372), y: (side ? this._vcTop : top0) + i * 46, vis: true }; if (this.state.compare || !this.state.alts.length) q.vis = false; }
      else q = A[key];
      let show = !!q && q.vis && (!ds.scales || ds.scales.indexOf(scale) >= 0) && !(ds.scales && A.flying);
      if (ds.ship && ((A.ship && A.ship.landed) || this.state.alts.length)) show = false;
      if (ds.below && this.state.alts.length && scale === 'transit') show = false;
      if (key === 'ghostArrival' && q && q.x < 460 && q.y > H - 210) show = false;
      if (ds.below && scale === 'surface' && q && q.x < 560 && q.y + (q.r || 0) > H - 300) show = false;
      if (ds.below && this.state.pov && scale === 'transit') show = false;
      if (ds.ship && q) { el._flip = !this.state.pov && !this.state.mobile && q.x > W - 720 && q.y > H - 360; }
      if (this.state.mobile && q && key !== 'card' && !key.startsWith('alt') && q.y + (+ds.dy || 0) > (this._vcTop || H) - 26 && q.y < (this._vcTop || H) + 80) show = false;
      if (q && (q.x < -200 || q.x > W + 200 || q.y < -200 || q.y > H + 200)) show = false;
      if (q) { let x = q.x + (el._flip ? -(el.offsetWidth + 22) : (+ds.dx || 0)), y = q.y + (+ds.dy || 0); if (ds.below) y += Math.min(q.r || 0, H) + 12;
        if (ds.ship && this.state.pov) { x = q.x - el.offsetWidth / 2; y = q.y - 124; }
        if (ds.ship) { if (this.state.mobile && !this.state.pov) { x = q.x - el.offsetWidth / 2; y = q.y - 92; } x = Math.max(12, Math.min(W - el.offsetWidth - 12, x)); }
        if (key === 'card') { const cw = el.offsetWidth, chh = el.offsetHeight, vt = this._vcTop || H - 300; if (x + cw > W - 384 && y + chh > vt && W > 720) x = q.x - cw - 4; x = Math.max(12, Math.min(W - cw - 12, x)); y = Math.max(this.state.mobile ? 120 : 84, Math.min((W > 720 ? H - 150 : vt - 8) - chh, y)); }
        if (ds.glide && el._x != null && !this.reduce()) { const g = 1 - Math.exp(-dt * 9); x = el._x + (x - el._x) * g; y = el._y + (y - el._y) * g; } el._x = x; el._y = y;
        el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
        if (ds.ring && hov) { const b = el.firstChild, s = 2 * ((q.r || hov.r || 10) + 7); b.style.width = b.style.height = Math.min(s, 2000) + 'px'; } }
      el.style.opacity = show ? 1 : 0;
    }
  }
  // ---------- interactions
  siteById(id) { return this.sites.find(s => s.id === id) || this.sites[0]; }
  goScale(s, keepTime) {
    if (s === 'auto') { this._force = true; this.setState({ scale: 'auto' }); return; } const pl = this.plan, S = this.S, cmp = this.state.compare && s !== 'moon'; this.scene.flyTo(s, cmp); if (cmp) this.scene.snap(); if (s !== 'transit') this.scene.pov = false; this._force = true;
    if (s === 'surface' && !keepTime && this.t < pl.tLand) this.tw = { a: this.t, b: pl.tLand + S.HOUR, k: 0, dur: this.reduce() ? .3 : 3 };
    this.setState({ scale: s, pop: null, compare: cmp, pov: s === 'transit' ? this.state.pov : false, cardId: s === 'moon' ? this.state.cardId : null });
  }
  onHover(h) {
    this.hov = h; if (!h) return; const S = this.S, t = this.t; let txt = '';
    if (h.type === 'site') { const k = S.sky(t, h.site); txt = `${h.site.name} · ${k.lit > .5 ? 'Sunlight' : 'In shadow'} · ${k.link ? 'Link to Earth' : 'No link'}`; }
    else if (h.type === 'earth') txt = `Earth · ${Math.round(S.V.len(S.moonPos(t)) / 1000).toLocaleString('en-US')},000 km from the Moon`;
    else if (h.type === 'moon') txt = this.state.scale === 'transit' ? 'Moon · click to choose a site' : 'Moon';
    else if (h.type === 'sun') txt = this.state.scale === 'surface' ? `Sun · ${S.sky(t, this.plan.site).sunEl.toFixed(1)}° above the horizon` : `Sun · ${(S.V.len(S.sunPos(t)) / 1e6).toFixed(1)} million km away`;
    else if (h.type === 'ship') txt = 'Spacecraft · click to follow';
    this.setState({ hoverText: txt });
  }
  onPick(h) {
    if (this.state.pop) this.setState({ pop: null });
    if (!h) { if (this.state.cardId) this.setState({ cardId: null }); return; }
    if (h.type === 'site') { this.ping(h.x, h.y, '#F3F1EC'); this.scene.selectedId = h.site.id; this._force = true; this.setState({ cardId: h.site.id }); }
    else if (h.type === 'moon' && this.state.scale === 'transit') this.goScale('moon');
    else if (h.type === 'earth' && this.state.scale !== 'transit') this.goScale('transit');
    else if (h.type === 'ship') { this.scene.follow = true; this.setState({ follow: true }); }
  }
  pickSite(site) { this.scene.selectedId = site.id; if (site.id !== this.plan.site.id || site.lat !== this.plan.site.lat || site.lon !== this.plan.site.lon) { this.replan({ site }); if (this.state.scale === 'moon') this.scene.aimMoon(); } this.setState({ pop: null }); }
  scrubTo(e) { const b = this.track.current.getBoundingClientRect(); this.tw = null; this.t = this.timeOf(this.plan, (e.clientX - b.left) / b.width); this._force = true; }
  jump(t, scale) { this.tw = { a: this.t, b: t, k: 0, dur: this.reduce() ? .25 : 1.4 }; if (scale !== this.state.scale && !this.state.compare) { this.scene.flyTo(scale); this.setState({ scale, cardId: null, playing: false }); } else this.setState({ playing: false }); }
  strip(arr, color, test) { let out = [], n = arr.length, cur = null, start = 0; const c = on => on ? color : 'rgba(255,255,255,.09)'; for (let i = 0; i <= n; i++) { const on = i < n ? test(arr[i]) : null; if (on !== cur) { if (cur !== null) out.push(`${c(cur)} ${(start / n * 100).toFixed(2)}% ${(i / n * 100).toFixed(2)}%`); cur = on; start = i; } } return `linear-gradient(90deg, ${out.join(', ')})`; }
  vColor(v) { return v === 'viable' ? '#74D19A' : v === 'not' ? '#EE8E82' : '#F3F1EC'; }
  demo(n) {
    const S = this.S, sc = this.scene, H = S.HOUR, D = S.DAY, o = this.original;
    this.rp = null; this.tw = null; sc.compare = null; this.plan = o; sc.setPlan(o); sc.setAlts([]); sc.ghostAlpha = this.ghostTarget = 0; sc.altAlpha = this.altTarget = 0; sc.drawFrac = 1; clearTimeout(this._gt); this.syncPlanRolls(o, true); this.hov = null; this._snapRolls = true; setTimeout(() => { this._snapRolls = false; }, 600);
    const base = { ready: true, playing: false, pop: null, details: false, compare: false, explain: false, evm: false, cardId: null, alts: [], diffs: [], replanning: false, replanned: false, follow: true, pov: false, pre: false, intro: false, menu: false, tut: -1 };
    const go = (scale, t, extra) => { this.t = sc.time = t; sc.follow = !(extra && extra.follow === false); sc.pov = !!(extra && extra.pov); this.hold = null; sc.selectedId = (extra && extra.cardId) || null; sc.views.transit.zoom = 1; sc.surfaceView.fov = 46; sc.surfaceView.pitch = 4; sc.flyTo(scale, true); sc.snap(); this._force = true; this.setState(Object.assign({}, base, { scale }, extra)); };
    const coast = o.tTLI + 1.5 * D;
    if (n === 'launch') go('transit', o.launch + 55 * 60000);
    else if (n === 'pov-launch') go('transit', o.launch + 5 * 60000, { pov: true });
    else if (n === 'pov-landing') go('transit', o.tLand - 4 * 60000, { pov: true });
    else if (n === 'intro') { go('transit', o.launch + 55 * 60000); this.setState({ intro: true }); }
    else if (n === 'pre') { go('transit', o.launch + 55 * 60000); this.setState({ pre: true, sel: ['0,4', '0,3'] }); }
    else if (n === 'tutorial') { go('transit', coast, { follow: false }); this.setState({ tut: 4 }); }
    else if (n === 'compare-route') go('transit', coast, { follow: false, compare: true });
    else if (n === 'coast' || n === 'replan-before') go('transit', coast, { follow: false });
    else if (n === 'moon') go('moon', o.tA + 5 * H, { cardId: 'shackleton' });
    else if (n === 'surface') go('surface', o.tLand + 246 * H);
    else if (n === 'sun-blocked') go('surface', o.tLand + 270 * H);
    else if (n === 'earth-blocked') { go('surface', o.tLand + 4 * H); sc.surfaceView.yaw = S.sky(this.t, o.site).earthAz - 14; }
    else if (n === 'explain') go('surface', o.tLand + 246 * H, { explain: true, evm: true });
    else if (n === 'details') go('surface', o.tLand + 246 * H, { details: true });
    else if (n === 'compare') go('surface', o.tLand + 246 * H, { compare: true });
    else if (n === 'loading') { go('transit', coast, { follow: false }); this.setState({ ready: false, loadP: .5, loadLabel: 'Sculpting the Moon' }); }
    else if (n === 'nodata') { const s = S.customSite(-87.2, 40); this.sites = S.SITES.concat([s]); sc.setSites(this.sites); this.plan = S.computePlan(o.launch, s, this.req); sc.setPlan(this.plan); this.syncPlanRolls(this.plan, true); this.t = sc.time = this.plan.tLand + 72 * H; this._force = true; sc.flyTo('surface', true); sc.snap(); this.setState(Object.assign({}, base, { scale: 'surface' })); }
    else if (n === 'replan-during') { go('transit', coast, { follow: false }); setTimeout(() => this.replan({ launch: o.launch + 3 * D }, { freeze: .7 }), 100); }
    else if (n === 'replan-not') { go('transit', coast, { follow: false }); setTimeout(() => this.replan({ launch: o.launch + 3 * D }), 100); }
    else if (n === 'replan-viable') { go('transit', coast, { follow: false }); setTimeout(() => this.replan({ launch: o.launch - 1 * D }), 100); }
  }
  renderVals() {
    const st = this.state, S = this.S, pl = this.plan, on = b => b ? 1 : 0, pe = b => b ? 'auto' : 'none', self = this, mb = st.mobile, seen = this.seenTut(); if (S) S.locale = LunarSim.locale = this.lang() === 'es' ? 'es-ES' : 'en-US';
    const scales = (st.compare ? [['auto', 'Full mission']] : []).concat([['transit', 'Earth to Moon'], ['moon', 'Moon'], ['surface', 'Surface']]).map(([id, label]) => ({ label, color: st.scale === id ? '#F3F1EC' : 'rgba(243,241,236,.6)', bar: on(st.scale === id), go: () => this.goScale(id) }));
    const out = {
      rootRef: this.root, canvasRef: this.canvas, trackRef: this.track, scales, hoverText: st.hoverText,
      pad: mb ? '16px' : '32px', topTop: mb ? '12px' : '22px', topCols: mb ? 'minmax(0,1fr) auto' : 'minmax(0,1fr) auto minmax(0,1fr)', tabsCol: mb ? '1 / -1' : '2', tabsRow: mb ? '2' : '1', actCol: mb ? '2' : '3', menuBtnDisp: mb ? 'block' : 'none', actDisp: !mb || st.menu ? 'flex' : 'none', actDir: mb ? 'column' : 'row', actPosn: mb ? 'absolute' : 'static', actAlign: mb ? 'stretch' : 'center', actBg: mb ? 'rgba(12,13,15,.95)' : 'transparent', actPad: mb ? '12px' : '0px', toggleMenu: () => this.setState({ menu: !st.menu }),
      storyTop: mb ? '128px' : '92px', storyFs: mb ? '14px' : '17px', blBottom: mb ? '204px' : '150px', figFs: mb ? '32px' : '60px', figGap: mb ? '22px' : '52px', deskInline: mb ? 'none' : 'inline', deskBlock: mb ? 'none' : 'block', vLeft: mb ? '16px' : 'auto', vBottom: mb ? '138px' : '150px', vW: mb ? 'auto' : '340px', tlBottom: mb ? '64px' : '38px', tlGap: mb ? '10px' : '16px', footBottom: mb ? '8px' : '10px', footDir: mb ? 'column-reverse' : 'row', footGap: mb ? '4px' : '16px', cmpTop: mb ? '126px' : '100px', cmpBottom: mb ? '134px' : '128px', cmpDir: mb ? 'column' : 'row', evmTop: mb ? '170px' : '84px',
      introOp: on(st.ready && st.intro), introPE: pe(st.ready && st.intro), introPrimary: seen ? 'Start mission' : 'Start with a short tutorial', introSecondary: seen ? 'Replay tutorial' : 'Skip tutorial', introGo: () => this.startMissions(['0,4'], !seen), introAlt: () => this.startMissions(['0,4'], seen), closePre: () => this.setState({ pre: false }),
      loadDash: (414.7 * (1 - st.loadP)).toFixed(1), loadPct: Math.round(st.loadP * 100) + '%', loaderOrbit: this._orbit || (this._orbit = React.createElement('div', { style: { position: 'absolute', inset: '14px', animation: 'lnspin 3.4s linear infinite' } }, React.createElement('div', { style: { position: 'absolute', left: '50%', top: '-3px', width: '6px', height: '6px', marginLeft: '-3px', borderRadius: '50%', background: '#F3F1EC', boxShadow: '0 0 10px 2px rgba(243,241,236,.55)' } }))),
      loadSteps: [['Placing the stars', .08], ['Painting the Earth', .25], ['Sculpting the Moon', .5], ['Plotting the route', .78], ['Surveying the landing site', .92]].map((x, i, a) => { const done = st.loadP >= (a[i + 1] ? a[i + 1][1] : 1), act = !done && st.loadP >= x[1]; return { label: x[0], op: done ? .75 : act ? 1 : .32, fill: done ? '#F3F1EC' : 'transparent' }; }), storyOp: on(!st.compare && (this.props.story ?? true) && st.ready && !st.pre && !st.intro),
      preOp: on(st.ready && st.pre), prePE: pe(st.ready && st.pre), startOp: st.sel.length ? 1 : .35, startLabel: st.sel.length > 1 ? 'Compare ' + st.sel.length + ' missions' : 'Start mission', startMissions: () => this.startMissions(),
      preCustom: () => { this._started = true; if (!this.seenTut()) { this._siteAfter = true; this.setState({ pre: false, compare: false, tut: 0 }); } else this.setState({ pre: false, compare: false, pop: 'site' }); }, openPre: () => this.setState({ pre: true, playing: false, pop: null, sel: st.sel.length ? st.sel : ['0,4'] }), openTut: () => this.setState({ tut: 0, pre: false, playing: false, pop: null, details: false, compare: false }),
      missions: (this.missions || []).map((m, i) => { const p = m.plan, k = st.sel.indexOf(i), c = this.vColor(p.verdict); return { title: m.title, desc: m.desc, sub: p.site.name.split(' (')[0] + ' · ' + S.fmtDateY(p.launch), verdict: p.text, color: c, dot: p.verdict === 'marginal' ? 'transparent' : c, sun: 'Sunlight ' + Math.round(p.sunPct) + '%', link: 'Earth link ' + Math.round(p.linkPct) + '%', stripSun: this.strip(p.sun, '#E8B95A', v => v > .5), stripLink: this.strip(p.link, '#6FA8F5', v => v > 0), bg: k >= 0 ? 'rgba(243,241,236,.1)' : 'rgba(18,19,22,.7)', border: k >= 0 ? '#F3F1EC' : 'rgba(255,255,255,.14)', badge: k + 1, badgeOp: on(k >= 0), pick: () => this.setState({ sel: k >= 0 ? st.sel.filter(x => x !== i) : st.sel.length < 4 ? st.sel.concat([i]) : st.sel }) }; }),
      gridDates: this.grid ? this.grid[0].cells.map(c => ({ label: S.fmtDate(c.plan.launch) })) : [],
      gridRows: (this.grid || []).map((r, ri) => ({ name: r.site.name.split(' (')[0], sub: r.site.group, cells: r.cells.map((c, ci) => { const p = c.plan, key = ri + ',' + ci, k = st.sel.indexOf(key), col = this.vColor(p.verdict); return { word: p.verdict === 'viable' ? 'Viable' : p.verdict === 'marginal' ? 'Marginal' : 'Not viable', color: col, dot: p.verdict === 'marginal' ? 'transparent' : col, night: p.longestNight < 1 ? 'No night' : 'Night ' + Math.round(p.longestNight) + ' h', stripSun: this.strip(p.sun, '#E8B95A', v => v > .5), stripLink: this.strip(p.link, '#6FA8F5', v => v > 0), bg: k >= 0 ? 'rgba(243,241,236,.14)' : p.verdict === 'viable' ? 'rgba(116,209,154,.09)' : p.verdict === 'not' ? 'rgba(238,142,130,.09)' : 'rgba(255,255,255,.04)', border: k >= 0 ? '#F3F1EC' : 'rgba(255,255,255,.12)', badge: k >= 0 ? k + 1 : '', badgeOp: on(k >= 0), pick: () => this.setState({ sel: k >= 0 ? st.sel.filter(x => x !== key) : st.sel.length < 4 ? st.sel.concat([key]) : st.sel }) }; }) })),
      selChips: this.grid ? st.sel.map((key, i) => { const q = key.split(','), p = this.grid[q[0]].cells[q[1]].plan; return { text: (i + 1) + ' — ' + p.site.name.split(' (')[0] + ' · ' + S.fmtDate(p.launch) + ' · ' + p.text, color: this.vColor(p.verdict) }; }) : [],
      tutOp: on(st.tut >= 0), tutPE: pe(st.tut >= 0), tutCount: st.tut >= 0 ? (st.tut + 1) + ' / ' + LunarUI.TUTORIAL.length : '', tutTitle: st.tut >= 0 ? LunarUI.TUTORIAL[st.tut].title : '', tutText: st.tut >= 0 ? LunarUI.TUTORIAL[st.tut].text : '', tutNextLabel: st.tut === (LunarUI ? LunarUI.TUTORIAL.length - 1 : 0) ? 'Done' : 'Next', tutBackOp: on(st.tut > 0), tutBackPE: pe(st.tut > 0),
      tutSkip: () => this.endTut(), tutBack: () => this.setState({ tut: Math.max(0, st.tut - 1) }), tutNext: () => st.tut >= LunarUI.TUTORIAL.length - 1 ? this.endTut() : this.setState({ tut: st.tut + 1 }), enBg: this.lang() === 'en' ? 'rgba(243,241,236,.2)' : 'transparent', esBg: this.lang() === 'es' ? 'rgba(243,241,236,.2)' : 'transparent', setEn: () => this.setState({ lang: 'en' }), setEs: () => this.setState({ lang: 'es' }), coverW: st.replanning ? '100%' : '0%', coverT: st.replanning ? '.25s' : '1.1s', verdictGlow: st.flash && pl ? '0 0 0 7px ' + this.vColor(pl.verdict) + '44' : '0 0 0 0 rgba(0,0,0,0)',
      loadOp: on(!st.ready), loadPE: pe(!st.ready), loadW: Math.round(st.loadP * 100) + '%', loadLabel: st.loadLabel,
      sceneUiOp: on(!st.compare && !st.intro && !st.pre), topOp: on(!st.intro && !st.pre), phBottom: mb ? '36px' : '12px', mobBlock: mb ? 'block' : 'none', ctaDir: mb ? 'row-reverse' : 'row', deskFlex: mb ? 'none' : 'flex', navSz: mb ? '44px' : '28px', paneFootPad: mb ? '6px 16px 8px' : '12px 16px 14px', paneFootGap: mb ? '5px' : '10px', replanOp: on(st.replanning), explainOp: on(this.explainOn() && !st.compare), explainPE: pe(this.explainOn() && !st.compare), explainBg: this.explainOn() ? 'rgba(243,241,236,.3)' : 'transparent', explainKnob: this.explainOn() ? '14px' : '0px',
      evmOp: on(st.evm), evmY: st.evm ? '0px' : '-8px', evmPE: pe(st.evm && this.explainOn()),
      compareOp: on(st.compare), comparePE: pe(st.compare), compareBg: st.compare ? 'rgba(243,241,236,.16)' : 'transparent', detailsBg: st.details ? 'rgba(243,241,236,.16)' : 'transparent',
      detailsX: st.details ? '0%' : '104%', detailsOp: on(st.details),
      sitePopOp: on(st.pop === 'site'), sitePopY: st.pop === 'site' ? '0px' : '-8px', sitePopPE: pe(st.pop === 'site'), datePopOp: on(st.pop === 'date'), datePopY: st.pop === 'date' ? '0px' : '-8px', datePopPE: pe(st.pop === 'date'),
      surfOp: on(st.scale === 'surface'), transitOp: on(st.scale === 'transit'), transitPE: pe(st.scale === 'transit' && !st.compare), moonOp: on(st.scale === 'moon'),
      playIcon: st.playing ? 'none' : 'block', pauseIcon: st.playing ? 'flex' : 'none', speedLabel: this.SPEEDS[st.speedIdx][1], followLabel: st.pov ? 'Onboard view' : st.follow ? 'Following spacecraft' : 'Free camera', reduceLabel: this.reduce() ? 'on' : 'off',
      cLat: st.cLat, cLon: st.cLon, cErr: st.cErr, dOff: st.dOff, dOffLabel: st.dOff === 0 ? 'Current date' : `${st.dOff > 0 ? '+' : ''}${st.dOff} d`,
      stop: e => e.stopPropagation(), lookSun: () => this.scene.lookAz(S.sky(this.t, this.plan.site).sunAz), lookEarth: () => this.scene.lookAz(S.sky(this.t, this.plan.site).earthAz - 6),
      toggleSite: () => this.setState({ pop: st.pop === 'site' ? null : 'site' }),
      toggleDate: () => { this.dateBase = this.plan; this.setState({ pop: st.pop === 'date' ? null : 'date', dOff: 0 }); },
      toggleExplain: () => this.setState({ explain: !this.explainOn(), evm: !this.explainOn() }), toggleEvm: () => this.setState({ evm: !st.evm }),
      toggleDetails: () => this.setState({ details: !st.details }), toggleReduce: () => this.setState({ reduce: !this.reduce() }),
      toggleCompare: () => { if (!st.compare) { this.setState({ pre: true, menu: false, playing: false, pop: null, sel: st.sel.length > 1 ? st.sel : ['0,4', '0,3'] }); return; } const c = !st.compare, sc2 = st.scale === 'moon' ? 'surface' : st.scale; if (c) { this.scene.pov = false; this.scene.flyTo(sc2, true); this.scene.snap(); } this._force = true; this.setState({ compare: c, pov: false, scale: c ? 'auto' : st.scale === 'auto' ? (this.t >= this.plan.tLand ? 'surface' : 'transit') : st.scale, pop: null, cardId: null, panes: c ? [{ siteId: this.plan.site.id, dt: 0 }].concat(st.panes.slice(1)) : st.panes }); },
      simulateDelay: () => { if (!this.rp) this.replan({ launch: this.plan.launch + 3 * S.DAY }); },
      togglePlay: () => { Sound.unlock(); if (!st.playing && !st.compare && st.countdown == null && this.t <= this.plan.launch + 1000) { this.startCountdown(); return; } if (!st.playing && this.t >= this.plan.tEnd - 1000) this.t = this.plan.launch; if (!st.playing && !st.compare && st.scale === 'transit' && this.t < this.plan.launch + 9 * 60000) { this.t = Math.min(this.t, this.plan.launch + 1000); this.setCam(true, true); } this.setState({ playing: !st.playing }); },
      cycleSpeed: () => this.setState({ speedIdx: (st.speedIdx + 1) % 3 }),
      toggleFollow: () => { if (st.pov) this.setCam(false, false); else if (st.follow) this.setCam(true, true); else this.setCam(true, false); },
      scrubDown: e => { if (this.rp) return; this.scrubbing = true; e.currentTarget.setPointerCapture(e.pointerId); this.setState({ playing: false }); this.scrubTo(e); },
      scrubMove: e => { if (this.scrubbing) this.scrubTo(e); }, scrubUp: () => { this.scrubbing = false; },
      closeCard: () => { this.scene.selectedId = null; this.setState({ cardId: null }); },
      setLat: e => this.setState({ cLat: e.target.value }), setLon: e => this.setState({ cLon: e.target.value }),
      goCustom: () => { const la = parseFloat(String(st.cLat).replace('−', '-')), lo = parseFloat(String(st.cLon).replace('−', '-')); if (!(la >= -90 && la <= 90 && lo >= -180 && lo <= 180)) return this.setState({ cErr: 'Latitude −90 to 90, longitude −180 to 180' }); const s = S.customSite(la, lo); this.sites = S.SITES.concat([s]); this.scene.setSites(this.sites); this.setState({ cErr: '' }); this.pickSite(s); },
      dayMinus: () => this.replan({ launch: this.plan.launch - S.DAY }), dayPlus: () => this.replan({ launch: this.plan.launch + S.DAY }),
      slideDate: e => { const off = +e.target.value; if (off === st.dOff || !this.dateBase || this.rp) return; const f = this.fracOf(this.plan, this.t), live = S.computePlan(this.dateBase.launch + off * S.DAY, this.plan.site, this.req); this.plan = live; this.scene.setPlan(live); this.scene.setGhost(this.dateBase); this.ghostTarget = off ? 1 : 0; this.t = this.timeOf(live, f); this.syncPlanRolls(live); this._force = true; this.setState({ dOff: off }); },
      commitDate: () => { if (st.dOff !== 0 && this.dateBase && !this.rp) { const b = this.dateBase; this.dateBase = null; this.replan({ launch: this.plan.launch }, { from: b, quick: true }); } },
      addPane: () => { if (st.panes.length < 4) this.setState({ panes: st.panes.concat([{ siteId: ['malapert', 'gerlache', 'a11'][st.panes.length - 2] || 'a11', dt: 0 }]) }); },
      exportPlan: () => { const p = this.plan, data = { site: { name: p.site.name, lat: p.site.lat, lon: p.site.lon }, launch: new Date(p.launch).toISOString(), translunarBurn: new Date(p.tTLI).toISOString(), lunarOrbit: new Date(p.tA).toISOString(), landing: new Date(p.tLand).toISOString(), requirements: p.req, sunlightPct: p.sunPct, earthLinkPct: p.linkPct, bothPct: p.bothPct, longestNightHours: p.longestNight, maxSunElevationDeg: p.maxSunEl, deltaV_kms: p.dv, verdict: p.text, model: 'Direct transfer, two-body model' }; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); a.download = 'lunar-plan.json'; a.click(); }
    };
    const empty = { siteName: '', dateLabel: '', groups: [], alts: [], diffs: [], hasDiffs: false, panes: [], milestones: [], ticks: [], statRows: [], burnRows: [], reqRows: [], card: { name: '', sub: '', actLabel: '', noData: false }, cardPE: 'none', verdictOp: 0, verdictPE: 'none', verdictText: '', verdictColor: '#F3F1EC', verdictDot: 'transparent', verdictBorder: 'rgba(255,255,255,.12)', stripSun: 'none', stripLink: 'none', surfLeft: '50%', noDataOp: 0, addPaneOp: 0, addPanePE: 'none' };
    if (!pl) return Object.assign(out, empty);
    const narrow = (this.track.current ? this.track.current.clientWidth : 1000) < 760; const t = this.t, vc = this.vColor(pl.verdict), F = this.KF, P = f => (f * 100) + '%';
    const groups = []; for (const s of this.sites) { let g = groups.find(x => x.name === s.group); if (!g) groups.push(g = { name: s.group, items: [] }); const k = st.pop === 'site' ? S.sky(t, s) : { lit: 0, link: false }; g.items.push({ name: s.name, sunOp: k.lit > .5 ? 1 : .18, linkOp: k.link ? 1 : .18, bg: s.id === pl.site.id ? 'rgba(255,255,255,.08)' : 'transparent', pick: () => this.pickSite(s) }); }
    const ms = [['Launch', F[0], '0%', pl.launch, pl.launch + 25 * 60000, 'transit'], ['Translunar burn', F[1], '0%', pl.tTLI, pl.tTLI, 'transit'], ['Coast', (F[1] + F[2]) / 2 + .03, '-50%', (pl.tTLI + pl.tA) / 2, (pl.tTLI + pl.tA) / 2, 'transit'], ['Lunar orbit', F[2], '0%', pl.tA, pl.tA + 2 * S.HOUR, 'moon'], ['Landing', F[3], '0%', pl.tLand, pl.tLand, 'surface'], ['Surface operations', (F[3] + F[4]) / 2 + .06, '-50%', pl.tLand, pl.tLand + 30 * S.HOUR, 'surface']]
      .map(([label, f, tx, dateT, goT, scale], i) => ({ z: narrow && (i === 1 || i === 2 || i === 3 || (st.mobile && i === 4)) && st.hoverMs !== i ? 1 : 2, maxW: narrow && (i === 1 || i === 2 || i === 3 || (st.mobile && i === 4)) && st.hoverMs !== i ? '26px' : 'none', labelOp: narrow && (i === 1 || i === 2 || i === 3 || (st.mobile && i === 4)) && st.hoverMs !== i ? 0 : narrow && st.hoverMs >= 1 && st.hoverMs <= 3 && st.hoverMs !== i && i !== 0 ? 0 : 1, minW: narrow && i >= 1 && i <= 3 ? '26px' : '0px', label: narrow && i === 5 ? 'Surface' : label, left: P(f), tx, date: i === 5 ? `${S.fmtDate(pl.tLand)} – ${S.fmtDate(pl.tEnd)}` : S.fmtDate(dateT), color: st.hoverMs === i ? '#F3F1EC' : 'rgba(243,241,236,.66)', dateOp: on(st.hoverMs === i), go: e => { e.stopPropagation(); this.jump(goT, scale); }, enter: () => this.setState({ hoverMs: i }), leave: () => this.setState({ hoverMs: -1 }) }));
    const cs = st.cardId ? this.siteById(st.cardId) : null, isCur = cs && cs.id === pl.site.id;
    const card = cs ? { name: cs.name, sub: `${cs.group} · ${Math.abs(cs.lat).toFixed(2)}°${cs.lat < 0 ? 'S' : 'N'}, ${Math.abs(cs.lon).toFixed(2)}°${cs.lon < 0 ? 'W' : 'E'}`, noData: !!cs.noData, actLabel: isCur ? 'Stand here' : 'Land here', act: () => isCur ? this.goScale('surface') : this.pickSite(cs) } : { name: '', sub: '', noData: false, actLabel: '', act: () => {} };
    const text = this.rp ? 'Replanning…' : pl.verdict === 'viable' && st.replanned ? 'Still viable' : pl.text, busy = !!this.rp;
    const list = this.sites, panes = st.panes.map((p, i) => {
      const s = this.siteById(p.siteId), key = s.id + s.lat + s.lon + '|' + p.dt + '|' + pl.launch + '|' + JSON.stringify(this.req); this._pc = this._pc || {}; const pp = this._pc[key] || (this._pc[key] = S.computePlan(pl.launch + p.dt * S.DAY, s, this.req));
      const upd = ch => this.setState({ panes: st.panes.map((x, j) => j === i ? Object.assign({}, x, ch) : x) }), ix = list.indexOf(s);
      return { name: s.name, dateLabel: `Launch ${S.fmtDate(pp.launch)}${p.dt ? ` (${p.dt > 0 ? '+' : ''}${p.dt} d)` : ''}`, phKey: 'p' + i + 'ph', sunKey: 'p' + i + 's', linkKey: 'p' + i + 'l', stripSun: this.strip(pp.sun, '#E8B95A', v => v > .5), stripLink: this.strip(pp.link, '#6FA8F5', v => v > 0), text: pp.text, color: this.vColor(pp.verdict), dot: pp.verdict === 'marginal' ? 'transparent' : this.vColor(pp.verdict),
        meta: 'Arrives ' + S.fmtDate(pp.tLand) + ' · ' + (pp.dv.tli + pp.dv.loi + pp.dv.descent).toFixed(2) + ' km/s', statOp: on(st.scale !== 'transit'), prev: () => upd({ siteId: list[(ix + list.length - 1) % list.length].id }), next: () => upd({ siteId: list[(ix + 1) % list.length].id }), earlier: () => upd({ dt: p.dt - 1 }), later: () => upd({ dt: p.dt + 1 }), removeOp: on(st.panes.length > 2), remove: () => { if (st.panes.length > 2) this.setState({ panes: st.panes.filter((x, j) => j !== i) }); } };
    });
    const rq = this.req, step = (k, d, lo, hi) => () => { if (this.rp) return; const v = Math.min(hi, Math.max(lo, rq[k] + d)); if (v !== rq[k]) this.replan({ req: Object.assign({}, rq, { [k]: v }) }); };
    return Object.assign(out, {
      siteName: pl.site.name, dateLabel: S.fmtDateY(pl.launch), groups, milestones: ms, ticks: [F[1], F[2], F[3]].map(f => ({ left: P(f) })), surfLeft: P(F[3]),
      stripSun: this.strip(pl.sun, '#E8B95A', v => v > .5), stripLink: this.strip(pl.link, '#6FA8F5', v => v > 0), noDataOp: on(!!pl.site.noData),
      card, cardPE: pe(!!cs && st.scale === 'moon' && !st.compare),
      alts: st.alts.map((a, i) => ({ anchor: 'alt' + i, n: i + 1, label: a.label, pick: () => { if (!this.rp) this.replan({ launch: a.plan.launch, site: a.plan.site }); } })),
      diffs: st.diffs, hasDiffs: st.diffs.length > 0 && !st.mobile,
      verdictOp: on(!st.compare), verdictPE: pe(!st.compare), verdictText: text, verdictColor: busy ? 'rgba(243,241,236,.8)' : vc, verdictDot: busy || pl.verdict === 'marginal' ? 'transparent' : vc, verdictBorder: busy ? 'rgba(255,255,255,.12)' : pl.verdict === 'viable' ? 'rgba(116,209,154,.45)' : pl.verdict === 'not' ? 'rgba(238,142,130,.5)' : 'rgba(255,255,255,.25)',
      panes, addPaneOp: on(st.compare && st.panes.length < 4 && !st.mobile), addPanePE: pe(st.compare && st.panes.length < 4 && !st.mobile),
      statRows: [{ label: 'Hours with sunlight', key: 'sunPct', color: '#E8B95A' }, { label: 'Hours with Earth link', key: 'linkPct', color: '#6FA8F5' }, { label: 'Hours with both', key: 'bothPct', color: '#F3F1EC' }, { label: 'Longest night', key: 'nightMax', color: '#F3F1EC' }, { label: 'Highest Sun elevation', key: 'maxEl', color: '#F3F1EC' }],
      burnRows: [{ label: 'Translunar burn', key: 'dvTli' }, { label: 'Lunar orbit insertion', key: 'dvLoi' }, { label: 'Descent and landing', key: 'dvDesc' }, { label: 'Total', key: 'dvTot' }, { label: 'Coast time', key: 'tof' }],
      reqRows: [{ label: 'Surface stay', value: rq.duration + ' d', dec: step('duration', -1, 3, 28), inc: step('duration', 1, 3, 28) }, { label: 'Longest time without Sun', value: rq.maxDark + ' h', dec: step('maxDark', -12, 12, 336), inc: step('maxDark', 12, 12, 336) }, { label: 'Minimum Earth link', value: rq.minLink + '%', dec: step('minLink', -10, 0, 100), inc: step('minLink', 10, 0, 100) }]
    });
  }


  getTime = () => this.t;

  // ---------- cinematic launch: countdown, milestones, sound, keyboard
  beginPlay(cmp) { if (cmp || this.state.compare) this.setState({ playing: true }); else this.startCountdown(); }
  startCountdown() {
    Sound.unlock(); this.cd = 10; this.t = this.scene.time = this.plan.launch; this.setCam(true, true); this.scene.flyTo('transit', true); this.scene.snap();
    this.setState({ countdown: 10, playing: false, scale: 'transit', letterbox: true, toast: null }); Sound.beep(660); this.scene.burnOverride = 0; this.scene.smoke && this.scene.smoke.clear();
  }
  skipCountdown = () => { if (this.cd != null) { this.cd = 0.0001; } };
  tickCountdown(dt) {
    const prev = Math.ceil(this.cd); this.cd -= dt; const now = Math.max(0, Math.ceil(this.cd));
    this.scene.burnOverride = this.cd < 2.2 ? Math.min(1, (2.2 - this.cd) / 1.6) : 0; // ignition at T-2
    if (now !== prev && this.cd > 0) { this.setState({ countdown: now }); Sound.beep(now <= 3 ? 990 : 660, now <= 3 ? 0.18 : 0.1); if (now === 2) Sound.engine(0.4); }
    if (this.cd <= 0) {
      this.cd = null; this.scene.burnOverride = null; this._lastT = this.t = this.scene.time = this.plan.launch;
      this.setState({ countdown: null, playing: true, flash: Date.now() }); Sound.rumble(5); this.showToast({ t: this.plan.launch, label: 'Liftoff' });
    }
  }
  milestones() {
    const p = this.plan, L = p.launch, M = 60000;
    return [
      { t: L + STAGING.maxQ, label: 'Max-Q', sub: 'Maximum aerodynamic pressure' },
      { t: L + STAGING.boosterSep, label: 'Booster separation' },
      { t: L + STAGING.fairingSep, label: 'Fairing separation', sub: 'The lander unfolds its solar panels' },
      { t: L + STAGING.meco, label: 'Main engine cut-off' },
      { t: L + STAGING.coreSep, label: 'Stage separation' },
      { t: L + STAGING.orbit, label: 'Orbit insertion', sub: '185 km parking orbit' },
      { t: p.tTLI - 3 * M, label: 'Translunar injection', sub: 'Leaving Earth orbit' },
      { t: p.tTLI + 4 * M, label: 'Upper stage separation' },
      { t: p.tA - 3 * M, label: 'Lunar orbit insertion' },
      { t: p.tLand - 12 * M, label: 'Powered descent' },
      { t: p.tLand, label: 'Touchdown', sub: p.text },
    ];
  }
  showToast(ev) {
    const d = ev.t - this.plan.launch, h = Math.floor(d / 3600000), m = Math.floor(d / 60000) % 60, sec = Math.floor(d / 1000) % 60;
    const time = 'T+' + (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(sec).padStart(2, '0');
    this.setState({ toast: { id: ev.t + ':' + Date.now(), label: this.tr(ev.label), sub: ev.sub ? this.tr(ev.sub) : '', time } });
    if (ev.label !== 'Liftoff') Sound.chime();
  }
  checkMilestones() {
    const pl = this.plan; if (!pl) return; const last = this._lastT ?? this.t; this._lastT = this.t;
    const playing = this.state.playing && !this.state.compare;
    if (playing && this.t > last && this.t - last < 6 * 3600000) for (const ev of this.milestones()) if (last < ev.t && this.t >= ev.t) this.showToast(ev);
    Sound.engine(playing ? (this.S.burn(pl, this.t).level || 0) : 0);
    const tau = this.t - pl.launch, td = this.t - pl.tLand, lb = playing && ((tau >= 0 && tau < 25000) || (td > -120000 && td < 15000));
    if (lb !== !!this.state.letterbox && this.cd == null) this.setState({ letterbox: lb });
  }
  onKey = e => {
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return; const st = this.state; if (!this.plan || st.intro || st.pre || st.tut >= 0) return;
    const v = this._v || {};
    if (e.code === 'Space') { e.preventDefault(); if (this.cd != null) this.skipCountdown(); else v.togglePlay && v.togglePlay(); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); this.jumpTo(this.t + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 6 : 1) * 3600000); }
    else if (e.key === '1') this.goScale('transit'); else if (e.key === '2') this.goScale('moon'); else if (e.key === '3') this.goScale('surface');
    else if (e.key === 'd' || e.key === 'D') v.toggleDetails && v.toggleDetails();
    else if (e.key === 'e' || e.key === 'E') v.toggleExplain && v.toggleExplain();
    else if (e.key === 'm' || e.key === 'M') this.toggleSound();
  };
  toggleSound = () => { Sound.unlock(); Sound.set(!Sound.on); this.setState({ sound: Sound.on }); };
  jumpTo = t => { this.t = this.scene.time = Math.max(this.plan.launch, Math.min(this.plan.tEnd, t)); this._force = true; this.setState({ playing: false }); };

  /** Footer line: what data is actually driving the simulation. */
  dataNote() {
    const s = this.dataStatus;
    if (!s) return ['Prototype: analytic ephemerides, procedural terrain.', ''];
    return [s.ephemeris ? 'Ephemerides: JPL Horizons.' : 'Ephemerides: analytic model (lunar-data files are mock).', s.horizon ? 'Terrain: LOLA horizons.' : 'Terrain: procedural.'];
  }

  render() {
    const v = { ...this.renderVals(), dataNote: this.dataNote() }, st = this.state; this._v = v;
    // Medium widths (720-1100 px): scale tabs move to a second row so the action buttons fit on one line.
    if (st.mid && !st.mobile) Object.assign(v, { topCols: 'minmax(0,1fr) auto', tabsCol: '1 / -1', tabsRow: '2', actCol: '2', storyTop: '150px', cmpTop: '134px', evmTop: '140px' });
    // Short windows (< 640 px tall): smaller figures and a compact verdict so they don't cover the lander.
    if (st.countdown != null) Object.assign(v, { sceneUiOp: 0, storyOp: 0, verdictOp: 0 });
    if (st.short) Object.assign(v, { figFs: st.mobile ? '28px' : '40px', figGap: st.mobile ? '18px' : '34px', hasDiffs: false, storyFs: '15px', blBottom: st.mobile ? '170px' : '128px', vBottom: st.mobile ? '120px' : '128px', vW: st.mobile ? 'auto' : '290px' });
    return (
    <div ref={v.rootRef} style={css("position:fixed;inset:0;background:#000;color:#F3F1EC;font-family:'Hanken Grotesk',Helvetica,sans-serif;font-size:15px;line-height:1.35;overflow:hidden;user-select:none")}>
      <div style={css("position:absolute;inset:0")}>
        <canvas ref={v.canvasRef} style={css("display:block;cursor:grab;touch-action:none")}></canvas>
      </div>
      <div style={css("position:absolute;left:0;right:0;top:0;height:190px;background:linear-gradient(rgba(0,0,0,.62),rgba(0,0,0,0));pointer-events:none")}></div>
      <div style={css("position:absolute;left:0;right:0;bottom:0;height:210px;background:linear-gradient(rgba(0,0,0,0),rgba(0,0,0,.7));pointer-events:none")}></div>
      <div style={css(`position:absolute;inset:0;pointer-events:none;opacity:${v.sceneUiOp};transition:opacity .5s`)}>
        <div data-anchor="earth" data-below="1" style={css("position:absolute;left:0;top:0;opacity:0;transition:opacity .4s;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6FA8F5;text-shadow:0 0 10px #000,0 0 4px #000")}>
          <span style={css("display:block;transform:translateX(-50%)")}>
            {"Earth"}
          </span>
        </div>
        <div data-anchor="moon" data-below="1" data-scales="transit" style={css("position:absolute;left:0;top:0;opacity:0;transition:opacity .4s;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#F3F1EC;text-shadow:0 0 10px #000,0 0 4px #000")}>
          <span style={css("display:block;transform:translateX(-50%)")}>
            {"Moon"}
          </span>
        </div>
        <div data-anchor="sun" data-below="1" style={css("position:absolute;left:0;top:0;opacity:0;transition:opacity .4s;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#E8B95A;text-shadow:0 0 10px #000,0 0 4px #000")}>
          <span style={css("display:block;transform:translateX(-50%)")}>
            {"Sun"}
          </span>
        </div>
        <div data-anchor="arrival" data-scales="transit" data-dx="16" data-dy="-8" style={css("position:absolute;left:0;top:0;opacity:0;transition:opacity .4s;font-size:12px;color:rgba(243,241,236,.7);text-shadow:0 0 10px #000,0 0 4px #000;white-space:nowrap")}>
          {"Moon at arrival · "}
          <span data-roll="arrive"></span>
        </div>
        <div data-anchor="ghostArrival" data-scales="transit" data-dx="16" data-dy="-8" style={css("position:absolute;left:0;top:0;opacity:0;transition:opacity .4s;font-size:12px;color:rgba(243,241,236,.62);text-shadow:0 0 10px #000,0 0 4px #000;white-space:nowrap")}>
          {"Old arrival"}
        </div>
        <div data-anchor="ship" data-scales="transit" data-ship="1" data-dx="22" data-dy="-30" style={css("position:absolute;left:0;top:0;opacity:0;transition:opacity .4s;display:flex;flex-direction:column;gap:6px;text-shadow:0 0 10px #000,0 0 4px #000;white-space:nowrap")}>
          <div style={css(`font-size:12px;color:#E8B95A;opacity:${v.replanOp};transition:opacity .3s;height:16px`)}>
            {"Replanning…"}
          </div>
          <div style={css("display:flex;gap:22px")}>
            <div>
              <div style={css("font-size:11px;color:rgba(243,241,236,.62)")}>
                {"Mission time"}
              </div>
              <div data-roll="met" style={css("font-size:16px;font-variant-numeric:tabular-nums")}></div>
            </div>
            <div>
              <div style={css("font-size:11px;color:rgba(243,241,236,.62)")}>
                {"To the Moon"}
              </div>
              <div data-roll="dist" style={css("font-size:16px;font-variant-numeric:tabular-nums")}></div>
            </div>
            <div>
              <div style={css("font-size:11px;color:rgba(243,241,236,.62)")}>
                {"Speed"}
              </div>
              <div data-roll="speed" style={css("font-size:16px;font-variant-numeric:tabular-nums")}></div>
            </div>
          </div>
        </div>
        <div data-anchor="hover" data-ring="1" style={css("position:absolute;left:0;top:0;opacity:0;transition:opacity .25s")}>
          <div data-ringbox="1" style={css("position:absolute;border:1px solid rgba(243,241,236,.8);border-radius:50%;transform:translate(-50%,-50%);width:28px;height:28px")}></div>
        </div>
        <div data-anchor="hover" data-dx="20" data-dy="14" style={css("position:absolute;left:0;top:0;opacity:0;transition:opacity .25s;background:rgba(12,13,15,.82);border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:6px 10px;font-size:13px;white-space:nowrap")}>
          {v.hoverText}
        </div>
        <div data-anchor="card" data-scales="moon" data-dx="18" data-dy="-24" style={css(`position:absolute;left:0;top:0;opacity:0;transition:opacity .35s;pointer-events:${v.cardPE};box-sizing:border-box;width:262px;background:rgba(12,13,15,.8);backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:16px 18px;display:flex;flex-direction:column;gap:12px`)}>
          <div style={css("display:flex;justify-content:space-between;gap:12px;align-items:flex-start")}>
            <div>
              <div style={css("font-size:17px;font-weight:500")}>
                {v.card.name}
              </div>
              <div style={css("font-size:12px;color:rgba(243,241,236,.62)")}>
                {v.card.sub}
              </div>
            </div>
            <button onClick={v.closeCard} aria-label="Close" style={css("background:none;border:none;color:rgba(243,241,236,.62);font-size:18px;line-height:1;cursor:pointer;padding:0 2px")} className="hv1">
              {"×"}
            </button>
          </div>
          <div style={css("display:flex;flex-direction:column;gap:8px")}>
            <div style={css("display:flex;align-items:center;gap:10px")}>
              <span data-dot="cardSun" style={css("width:9px;height:9px;border-radius:50%;background:#E8B95A;transition:opacity .4s")}></span>
              <span style={css("flex:1")}>
                {"Sunlight"}
              </span>
              <span data-txt="cardSun" style={css("color:rgba(243,241,236,.75)")}></span>
            </div>
            <div style={css("display:flex;align-items:center;gap:10px")}>
              <span data-dot="cardLink" style={css("width:9px;height:9px;border-radius:50%;background:#6FA8F5;transition:opacity .4s")}></span>
              <span style={css("flex:1")}>
                {"Link to Earth"}
              </span>
              <span data-txt="cardLink" style={css("color:rgba(243,241,236,.75)")}></span>
            </div>
          </div>
          {v.card.noData ? (
            <>
              <div style={css("font-size:12px;color:rgba(243,241,236,.62)")}>
              {"Smooth horizon — no terrain data"}
            </div>
            </>
          ) : null}
          <button onClick={v.card.act} style={css("background:#F3F1EC;color:#0b0b0c;border:none;border-radius:999px;padding:9px 14px;font-size:14px;font-weight:500;cursor:pointer")} className="hv2">
            {v.card.actLabel}
          </button>
        </div>
        {(v.alts || []).map((alt, _i0) => (
          <Fragment key={_i0}>
            <button data-anchor={alt.anchor} data-glide="1" onClick={alt.pick} style={css("position:absolute;left:0;top:0;opacity:0;transition:opacity .5s;pointer-events:auto;display:flex;align-items:center;gap:10px;background:rgba(12,13,15,.8);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.2);color:#F3F1EC;border-radius:999px;padding:8px 14px 8px 10px;font-size:14px;cursor:pointer;white-space:nowrap")} className="hv3">
              <span style={css("width:18px;height:18px;border-radius:50%;border:1px solid rgba(243,241,236,.6);display:flex;align-items:center;justify-content:center;font-size:11px")}>
                {alt.n}
              </span>
              <span>
                {alt.label}
              </span>
            </button>
          </Fragment>
        ))}
        <div style={css(`opacity:${v.explainOp};transition:opacity .5s`)}>
          <div data-anchor="arrival" data-scales="transit" data-dx="16" data-dy="14" style={css("position:absolute;left:0;top:0;opacity:0;transition:opacity .4s;width:230px;font-size:13px;color:rgba(243,241,236,.82);text-shadow:0 0 10px #000,0 0 4px #000")}>
            {"The Moon keeps moving. We aim at where it will be in 3 days, not where it is now."}
          </div>
          <div data-anchor="moon" data-scales="moon" data-dx="-420" data-dy="-200" style={css("position:absolute;left:0;top:0;opacity:0;transition:opacity .4s;width:230px;font-size:13px;color:rgba(243,241,236,.82);text-shadow:0 0 10px #000,0 0 4px #000")}>
            {"The edge between day and night is called the terminator. At the south pole sunlight always arrives sideways, so crater floors stay dark."}
          </div>
          <div data-anchor="sun" data-scales="surface" data-dx="-115" data-dy="-96" style={css("position:absolute;left:0;top:0;opacity:0;transition:opacity .4s;width:230px;font-size:13px;color:rgba(243,241,236,.82);text-shadow:0 0 10px #000,0 0 4px #000")}>
            {"Here the Sun never climbs. It circles the horizon once a month, so one ridge is enough to block it."}
          </div>
          <div data-anchor="earth" data-scales="surface" data-dx="24" data-dy="-70" style={css("position:absolute;left:0;top:0;opacity:0;transition:opacity .4s;width:210px;font-size:13px;color:rgba(243,241,236,.82);text-shadow:0 0 10px #000,0 0 4px #000")}>
            {"Earth stays almost still in the sky. The blue beam is the radio link home."}
          </div>
        </div>
      </div>
      <button data-edge="sun" onClick={v.lookSun} style={css("position:absolute;top:24%;opacity:0;pointer-events:none;transition:opacity .4s;background:rgba(12,13,15,.7);border:1px solid rgba(232,185,90,.6);color:#E8B95A;border-radius:999px;padding:7px 13px;font-size:13px;cursor:pointer;white-space:nowrap")}></button>
      <button data-edge="earth" onClick={v.lookEarth} style={css("position:absolute;top:32%;opacity:0;pointer-events:none;transition:opacity .4s;background:rgba(12,13,15,.7);border:1px solid rgba(111,168,245,.6);color:#6FA8F5;border-radius:999px;padding:7px 13px;font-size:13px;cursor:pointer;white-space:nowrap")}></button>
      <div style={css(`position:absolute;left:${v.pad};right:${v.pad};top:${v.topTop};display:grid;grid-template-columns:${v.topCols};align-items:start;gap:12px 20px;pointer-events:none;z-index:6;opacity:${v.topOp};transition:opacity .6s`)}>
        <div data-tut="where" style={css("display:flex;flex-direction:column;gap:2px;align-items:flex-start;pointer-events:auto;min-width:0;grid-column:1;grid-row:1")}>
          <button onClick={v.toggleSite} style={css("background:none;border:none;color:#F3F1EC;padding:4px 0;cursor:pointer;display:flex;align-items:baseline;gap:8px;font-size:clamp(19px,2vw,26px);font-weight:400;letter-spacing:-.01em;text-shadow:0 0 14px #000;text-align:left;max-width:100%")} className="hv4">
            <span>
              {v.siteName}
            </span>
            <span style={css("font-size:13px;color:rgba(243,241,236,.62)")}>
              {"change"}
            </span>
          </button>
          <div style={css("display:flex;align-items:center;gap:14px;flex-wrap:nowrap;white-space:nowrap")}>
            <button onClick={v.toggleDate} style={css("background:none;border:none;color:rgba(243,241,236,.8);padding:4px 0;cursor:pointer;display:flex;align-items:baseline;gap:8px;font-size:15px;text-shadow:0 0 14px #000")} className="hv5">
              <span>
                {"Launch"}
              </span>
              <span data-roll="launch" style={css("color:#F3F1EC;font-variant-numeric:tabular-nums")}></span>
            </button>
          </div>
        </div>
        <div style={css(`position:absolute;left:0;top:76px;width:340px;max-width:calc(100vw - 32px);box-sizing:border-box;max-height:520px;overflow:auto;background:rgba(12,13,15,.86);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:14px;opacity:${v.sitePopOp};transform:translateY(${v.sitePopY});pointer-events:${v.sitePopPE};transition:opacity .3s,transform .3s;z-index:5`)}>
          {(v.groups || []).map((g, _i0) => (
            <Fragment key={_i0}>
              <div style={css("display:flex;flex-direction:column;gap:2px")}>
                <div style={css("font-size:12px;color:rgba(243,241,236,.62);padding:0 8px 4px")}>
                  {g.name}
                </div>
                {(g.items || []).map((it, _i1) => (
                  <Fragment key={_i1}>
                    <button onClick={it.pick} style={css(`display:flex;align-items:center;gap:10px;background:${it.bg};border:none;color:#F3F1EC;text-align:left;font-size:15px;padding:7px 8px;border-radius:8px;cursor:pointer`)} className="hv6">
                      <span style={css(`width:8px;height:8px;border-radius:50%;background:#E8B95A;opacity:${it.sunOp}`)}></span>
                      <span style={css(`width:8px;height:8px;border-radius:50%;background:#6FA8F5;opacity:${it.linkOp}`)}></span>
                      <span style={css("flex:1")}>
                        {it.name}
                      </span>
                    </button>
                  </Fragment>
                ))}
              </div>
            </Fragment>
          ))}
          <div style={css("border-top:1px solid rgba(255,255,255,.1);padding-top:14px;display:flex;flex-direction:column;gap:8px")}>
            <div style={css("font-size:12px;color:rgba(243,241,236,.62);padding:0 8px")}>
              {"Your own coordinates"}
            </div>
            <div style={css("display:flex;gap:8px;padding:0 8px")}>
              <input value={v.cLat} onChange={v.setLat} placeholder="Lat −87.2" style={css("flex:1;min-width:0;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:8px;color:#F3F1EC;font:inherit;padding:8px 10px")} />
              <input value={v.cLon} onChange={v.setLon} placeholder="Lon 40.0" style={css("flex:1;min-width:0;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:8px;color:#F3F1EC;font:inherit;padding:8px 10px")} />
              <button onClick={v.goCustom} style={css("background:#F3F1EC;color:#0b0b0c;border:none;border-radius:8px;padding:0 14px;font-size:14px;font-weight:500;cursor:pointer")}>
                {"Go"}
              </button>
            </div>
            <div style={css("font-size:12px;color:#EE8E82;padding:0 8px;min-height:16px")}>
              {v.cErr}
            </div>
          </div>
        </div>
        <div style={css(`position:absolute;left:0;top:76px;width:340px;max-width:calc(100vw - 32px);box-sizing:border-box;background:rgba(12,13,15,.86);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:16px;opacity:${v.datePopOp};transform:translateY(${v.datePopY});pointer-events:${v.datePopPE};transition:opacity .3s,transform .3s;z-index:5`)}>
          <div style={css("display:flex;align-items:center;justify-content:space-between;gap:12px")}>
            <button onClick={v.dayMinus} style={css("background:none;border:1px solid rgba(255,255,255,.18);color:#F3F1EC;border-radius:999px;padding:7px 14px;font-size:14px;cursor:pointer")} className="hv7">
              {"− 1 day"}
            </button>
            <div style={css("font-size:20px;font-variant-numeric:tabular-nums")}>
              {v.dateLabel}
            </div>
            <button onClick={v.dayPlus} style={css("background:none;border:1px solid rgba(255,255,255,.18);color:#F3F1EC;border-radius:999px;padding:7px 14px;font-size:14px;cursor:pointer")} className="hv8">
              {"+ 1 day"}
            </button>
          </div>
          <div style={css("display:flex;flex-direction:column;gap:6px")}>
            <input type="range" min="-10" max="21" step="1" value={v.dOff} onInput={v.slideDate} onChange={v.slideDate} onPointerUp={v.commitDate} onKeyUp={v.commitDate} style={css("width:100%")} />
            <div style={css("display:flex;justify-content:space-between;font-size:12px;color:rgba(243,241,236,.62)")}>
              <span>
                {"10 days earlier"}
              </span>
              <span>
                {v.dOffLabel}
              </span>
              <span>
                {"21 days later"}
              </span>
            </div>
          </div>
          <div style={css("font-size:13px;color:rgba(243,241,236,.62)")}>
            {"Drag to watch the route change. Release to replan."}
          </div>
        </div>
        <div data-tut="scales" style={css(`display:flex;justify-content:center;gap:clamp(12px,2vw,28px);pointer-events:auto;padding-top:4px;grid-column:${v.tabsCol};grid-row:${v.tabsRow}`)}>
          {(v.scales || []).map((s, _i0) => (
            <Fragment key={_i0}>
              <button onClick={s.go} style={css(`background:none;border:none;padding:6px 0 8px;color:${s.color};font-size:15px;cursor:pointer;position:relative;transition:color .3s;text-shadow:0 0 14px #000;white-space:nowrap`)} className="hv9">
                {s.label}
                <span style={css(`position:absolute;left:0;right:0;bottom:0;height:1px;background:#F3F1EC;opacity:${s.bar};transition:opacity .3s`)}></span>
              </button>
            </Fragment>
          ))}
        </div>
        <div style={css(`grid-column:${v.actCol};grid-row:1;justify-self:end;position:relative;pointer-events:auto;display:flex;flex-direction:column;align-items:flex-end`)}>
          <button onClick={v.toggleMenu} style={css(`display:${v.menuBtnDisp};background:rgba(12,13,15,.6);border:1px solid rgba(255,255,255,.25);color:#F3F1EC;border-radius:999px;padding:9px 16px;font-size:14px;cursor:pointer;min-height:44px`)}>
            {"Menu"}
          </button>
          <div data-actions="1" style={css(`display:${v.actDisp};flex-direction:${v.actDir};position:${v.actPosn};right:0;top:52px;z-index:8;gap:8px clamp(4px,.7vw,10px);align-items:${v.actAlign};white-space:nowrap;justify-content:flex-end;flex-wrap:wrap;background:${v.actBg};padding:${v.actPad};border-radius:14px`)}>
            <button onClick={v.toggleExplain} style={css("display:flex;align-items:center;gap:9px;background:none;border:none;color:rgba(243,241,236,.8);font-size:14px;cursor:pointer;padding:9px 8px")} className="hv10">
              <span style={css(`width:30px;height:16px;border-radius:999px;border:1px solid rgba(243,241,236,.5);position:relative;background:${v.explainBg};transition:background .3s`)}>
                <span style={css(`position:absolute;top:2px;left:2px;width:10px;height:10px;border-radius:50%;background:#F3F1EC;transform:translateX(${v.explainKnob});transition:transform .3s`)}></span>
              </span>
              {"Explain"}
            </button>
            <button onClick={v.toggleCompare} style={css(`background:${v.compareBg};border:1px solid rgba(255,255,255,.18);color:#F3F1EC;border-radius:999px;padding:9px 16px;font-size:14px;cursor:pointer;transition:background .3s`)} className="hv11">
              {"Compare"}
            </button>
            <button onClick={v.toggleDetails} style={css(`background:${v.detailsBg};border:1px solid rgba(255,255,255,.18);color:#F3F1EC;border-radius:999px;padding:9px 16px;font-size:14px;cursor:pointer;transition:background .3s`)} className="hv12">
              {"Details"}
            </button>
            <button onClick={v.cycleSpeed} style={css(`display:${v.mobBlock};background:none;border:1px solid rgba(255,255,255,.18);color:#F3F1EC;border-radius:999px;padding:9px 16px;font-size:14px;cursor:pointer;font-variant-numeric:tabular-nums`)}>
              {v.speedLabel}
            </button>
            <button onClick={v.simulateDelay} style={css("background:none;border:1px solid rgba(255,255,255,.18);color:#F3F1EC;border-radius:999px;padding:9px 16px;font-size:14px;cursor:pointer")} className="hv13">
              {"Simulate delay"}
            </button>
          </div>
        </div>
      </div>
      <div style={css(`position:absolute;left:${v.pad};bottom:${v.blBottom};pointer-events:none;opacity:${v.sceneUiOp};transition:opacity .5s`)}>
        <div style={css(`opacity:${v.surfOp};transition:opacity .6s;display:flex;flex-direction:column;gap:18px;position:absolute;left:0;bottom:0;white-space:nowrap;text-shadow:0 0 16px #000,0 0 6px #000`)}>
          <div style={css("display:flex;gap:22px;font-size:15px")}>
            <div style={css("display:flex;align-items:center;gap:8px")}>
              <span data-dot="sun" style={css("width:9px;height:9px;border-radius:50%;background:#E8B95A;transition:opacity .4s")}></span>
              <span data-txt="sunState"></span>
            </div>
            <div style={css("display:flex;align-items:center;gap:8px")}>
              <span data-dot="link" style={css("width:9px;height:9px;border-radius:50%;background:#6FA8F5;transition:opacity .4s")}></span>
              <span data-txt="linkState"></span>
            </div>
            <div style={css(`color:rgba(243,241,236,.62);opacity:${v.noDataOp}`)}>
              {"Smooth horizon — no terrain data"}
            </div>
          </div>
          <div style={css(`display:flex;gap:${v.figGap};align-items:flex-end`)}>
            <div>
              <div data-txt="nightLabel" style={css("font-size:14px;color:rgba(243,241,236,.75);margin-bottom:4px")}></div>
              <div data-roll="night" style={css(`font-size:${v.figFs};font-weight:300;letter-spacing:-.02em;line-height:1;color:#E8B95A;font-variant-numeric:tabular-nums`)}></div>
            </div>
            <div>
              <div data-txt="linkLabel" style={css("font-size:14px;color:rgba(243,241,236,.75);margin-bottom:4px")}></div>
              <div data-roll="link" style={css(`font-size:${v.figFs};font-weight:300;letter-spacing:-.02em;line-height:1;color:#6FA8F5;font-variant-numeric:tabular-nums`)}></div>
            </div>
            <div>
              <div style={css("font-size:14px;color:rgba(243,241,236,.75);margin-bottom:4px")}>
                {"Sun height"}
              </div>
              <div data-roll="sunEl" style={css(`font-size:${v.figFs};font-weight:300;letter-spacing:-.02em;line-height:1;color:#F3F1EC;font-variant-numeric:tabular-nums`)}></div>
            </div>
          </div>
        </div>
        <div data-tut="camera" style={css(`opacity:${v.transitOp};transition:opacity .6s;position:absolute;left:0;bottom:0;display:flex;align-items:center;gap:14px;white-space:nowrap;pointer-events:${v.transitPE}`)}>
          <button onClick={v.toggleFollow} style={css("background:none;border:1px solid rgba(255,255,255,.18);color:#F3F1EC;border-radius:999px;padding:8px 14px;font-size:14px;cursor:pointer")} className="hv14">
            {v.followLabel}
          </button>
          <span style={css(`font-size:13px;color:rgba(243,241,236,.62);display:${v.deskInline}`)}>
            {"Direct transfer, two-body model"}
          </span>
        </div>
        <div style={css(`opacity:${v.moonOp};transition:opacity .6s;position:absolute;left:0;bottom:0;display:flex;gap:20px;font-size:13px;color:rgba(243,241,236,.75);white-space:nowrap;text-shadow:0 0 10px #000`)}>
          <span style={css("display:flex;align-items:center;gap:7px")}>
            <span style={css("width:8px;height:8px;border-radius:50%;background:#E8B95A")}></span>
            {"In sunlight now"}
          </span>
          <span style={css("display:flex;align-items:center;gap:7px")}>
            <span style={css("width:8px;height:8px;border-radius:50%;background:#6b6b6b")}></span>
            {"In shadow"}
          </span>
          <span style={css("display:flex;align-items:center;gap:7px")}>
            <span style={css("width:18px;height:1px;background:#6FA8F5")}></span>
            {"Can see Earth"}
          </span>
          <span style={css(`display:${v.deskInline}`)}>
            {"Tap a site"}
          </span>
        </div>
      </div>
      <div style={css(`position:absolute;right:${v.pad};top:${v.evmTop};width:300px;max-width:calc(100vw - 32px);opacity:${v.explainOp};pointer-events:${v.explainPE};transition:opacity .5s;display:flex;flex-direction:column;gap:12px`)}>
        <button onClick={v.toggleEvm} style={css("align-self:flex-end;white-space:nowrap;background:rgba(12,13,15,.7);border:1px solid rgba(255,255,255,.18);color:#F3F1EC;border-radius:999px;padding:8px 14px;font-size:14px;cursor:pointer")} className="hv15">
          {"Earth vs Moon"}
        </button>
        <div style={css(`background:rgba(12,13,15,.82);backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:16px;opacity:${v.evmOp};transform:translateY(${v.evmY});pointer-events:${v.evmPE};transition:opacity .4s,transform .4s`)}>
          <div style={css("display:flex;flex-direction:column;gap:6px")}>
            <svg viewBox="0 0 264 86" style={css("width:100%;display:block")}>
              <line x1="0" y1="78" x2="264" y2="78" stroke="rgba(243,241,236,.4)" strokeWidth="1"></line>
              <path d="M14 78 Q132 -52 250 78" fill="none" stroke="#E8B95A" strokeWidth="1.5" strokeDasharray="2 4"></path>
              <circle cx="132" cy="13" r="5" fill="#E8B95A"></circle>
            </svg>
            <div style={css("font-size:14px")}>
              <span style={css("font-weight:500")}>
                {"On Earth, in one day"}
              </span>
              <br />
              <span style={css("color:rgba(243,241,236,.72)")}>
                {"The Sun rises, climbs high and sets within hours."}
              </span>
            </div>
          </div>
          <div style={css("display:flex;flex-direction:column;gap:6px")}>
            <svg viewBox="0 0 264 46" style={css("width:100%;display:block")}>
              <line x1="0" y1="38" x2="264" y2="38" stroke="rgba(243,241,236,.4)" strokeWidth="1"></line>
              <path d="M0 34 Q66 28 132 34 T264 34" fill="none" stroke="#E8B95A" strokeWidth="1.5" strokeDasharray="2 4"></path>
              <circle cx="84" cy="31" r="5" fill="#E8B95A"></circle>
            </svg>
            <div style={css("font-size:14px")}>
              <span style={css("font-weight:500")}>
                {"At the lunar south pole, in one month"}
              </span>
              <br />
              <span style={css("color:rgba(243,241,236,.72)")}>
                {"The Sun slides along the horizon, never more than about 1.5° up. Any hill can hide it for days."}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div data-verdict="1" style={css(`position:absolute;right:${v.pad};left:${v.vLeft};bottom:${v.vBottom};width:${v.vW};max-width:calc(100vw - 32px);box-sizing:border-box;background:rgba(12,13,15,.78);backdrop-filter:blur(14px);border:1px solid ${v.verdictBorder};border-radius:16px;padding:16px 18px;display:flex;flex-direction:column;gap:12px;opacity:${v.verdictOp};transition:opacity .5s,border-color .6s,box-shadow .8s;box-shadow:${v.verdictGlow};pointer-events:${v.verdictPE}`)}>
        <div style={css("display:flex;align-items:center;gap:12px")}>
          <span style={css(`width:12px;height:12px;border-radius:50%;flex:none;background:${v.verdictDot};border:1.5px solid ${v.verdictColor};transition:background .6s,border-color .6s`)}></span>
          <span style={css(`font-size:19px;font-weight:500;color:${v.verdictColor};transition:color .6s;text-wrap:pretty`)}>
            {v.verdictText}
          </span>
        </div>
        {v.hasDiffs ? (
          <>
            <div style={css("display:flex;flex-direction:column;gap:6px;border-top:1px solid rgba(255,255,255,.1);padding-top:12px;font-size:14px;font-variant-numeric:tabular-nums")}>
            {(v.diffs || []).map((d, _i0) => (
              <Fragment key={_i0}>
                <div style={css("display:flex;gap:8px")}>
                  <span style={css("width:76px;color:rgba(243,241,236,.62)")}>
                    {d.label}
                  </span>
                  <span style={css("color:rgba(243,241,236,.62)")}>
                    {d.from}
                  </span>
                  <span style={css("color:rgba(243,241,236,.62)")}>
                    {"→"}
                  </span>
                  <span data-roll={d.key} style={css(`color:${d.color}`)}></span>
                  <span style={css("color:rgba(243,241,236,.62)")}>
                    {d.delta}
                  </span>
                </div>
              </Fragment>
            ))}
          </div>
          </>
        ) : null}
      </div>
      <div style={css(`position:absolute;left:0;right:0;top:${v.cmpTop};bottom:${v.cmpBottom};display:flex;flex-direction:${v.cmpDir};gap:2px;opacity:${v.compareOp};pointer-events:none;transition:opacity .5s`)}>
        {(v.panes || []).map((p, _i0) => (
          <Fragment key={_i0}>
            <div style={css("flex:1;min-width:0;min-height:0;display:flex;flex-direction:column")}>
              <div data-pane-view="1" style={css("flex:1;position:relative;border:1px solid rgba(255,255,255,.1);border-bottom:none")}>
                <div style={css(`position:absolute;left:16px;top:14px;right:16px;display:flex;flex-direction:column;gap:8px;pointer-events:${v.comparePE};text-shadow:0 0 12px #000,0 0 4px #000`)}>
                  <div style={css("display:flex;align-items:center;gap:8px")}>
                    <button onClick={p.prev} aria-label="Previous site" style={css(`background:rgba(12,13,15,.6);border:1px solid rgba(255,255,255,.18);color:#F3F1EC;border-radius:50%;flex:none;width:${v.navSz};height:${v.navSz};cursor:pointer;font-size:14px`)} className="hv16">
                      {"‹"}
                    </button>
                    <span style={css("font-size:18px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>
                      {p.name}
                    </span>
                    <button onClick={p.next} aria-label="Next site" style={css(`background:rgba(12,13,15,.6);border:1px solid rgba(255,255,255,.18);color:#F3F1EC;border-radius:50%;flex:none;width:${v.navSz};height:${v.navSz};cursor:pointer;font-size:14px`)} className="hv17">
                      {"›"}
                    </button>
                    <span style={css("flex:1")}></span>
                    <button onClick={p.remove} aria-label="Remove view" style={css(`background:none;border:none;color:rgba(243,241,236,.62);font-size:18px;cursor:pointer;min-width:${v.navSz};min-height:${v.navSz};opacity:${p.removeOp}`)} className="hv18">
                      {"×"}
                    </button>
                  </div>
                  <div style={css(`display:${v.deskFlex};align-items:center;gap:8px;font-size:13px;color:rgba(243,241,236,.8)`)}>
                    <button onClick={p.earlier} style={css("background:none;border:1px solid rgba(255,255,255,.18);color:#F3F1EC;border-radius:999px;padding:2px 9px;cursor:pointer;font-size:13px")}>
                      {"−"}
                    </button>
                    <span style={css("font-variant-numeric:tabular-nums")}>
                      {p.dateLabel}
                    </span>
                    <button onClick={p.later} style={css("background:none;border:1px solid rgba(255,255,255,.18);color:#F3F1EC;border-radius:999px;padding:2px 9px;cursor:pointer;font-size:13px")}>
                      {"+"}
                    </button>
                  </div>
                </div>
                <div data-txt={p.phKey} style={css(`position:absolute;right:16px;bottom:${v.phBottom};font-size:13px;color:rgba(243,241,236,.88);text-shadow:0 0 12px #000,0 0 4px #000;font-variant-numeric:tabular-nums;white-space:nowrap`)}></div>
                <div data-pstat="1" style={css("position:absolute;left:16px;bottom:12px;display:flex;gap:18px;font-size:14px;text-shadow:0 0 12px #000,0 0 4px #000;opacity:0;transition:opacity .4s")}>
                  <span style={css("display:flex;align-items:center;gap:7px")}>
                    <span data-dot={p.sunKey} style={css("width:9px;height:9px;border-radius:50%;background:#E8B95A;transition:opacity .4s")}></span>
                    <span data-txt={p.sunKey}></span>
                  </span>
                  <span style={css("display:flex;align-items:center;gap:7px")}>
                    <span data-dot={p.linkKey} style={css("width:9px;height:9px;border-radius:50%;background:#6FA8F5;transition:opacity .4s")}></span>
                    <span data-txt={p.linkKey}></span>
                  </span>
                </div>
              </div>
              <div style={css(`background:#000;border:1px solid rgba(255,255,255,.1);padding:${v.paneFootPad};display:flex;flex-direction:column;gap:${v.paneFootGap}`)}>
                <div style={css("display:flex;flex-direction:column;gap:3px")}>
                  <div style={css(`height:5px;border-radius:3px;background:${p.stripSun}`)}></div>
                  <div style={css(`height:5px;border-radius:3px;background:${p.stripLink}`)}></div>
                </div>
                <div style={css(`display:${v.deskBlock};font-size:12px;color:rgba(243,241,236,.62);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>
                  {p.meta}
                </div>
                <div style={css("display:flex;align-items:center;gap:10px")}>
                  <span style={css(`width:10px;height:10px;border-radius:50%;flex:none;background:${p.dot};border:1.5px solid ${p.color}`)}></span>
                  <span style={css(`font-size:15px;font-weight:500;color:${p.color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>
                    {p.text}
                  </span>
                </div>
              </div>
            </div>
          </Fragment>
        ))}
        <button onClick={v.addPane} style={css(`pointer-events:${v.addPanePE};opacity:${v.addPaneOp};align-self:center;margin:0 16px;background:none;border:1px dashed rgba(255,255,255,.3);color:#F3F1EC;border-radius:999px;padding:9px 14px;font-size:14px;cursor:pointer;white-space:nowrap`)} className="hv19">
          {"+ Add view"}
        </button>
      </div>
      <div style={css(`position:absolute;left:50%;top:${v.storyTop};transform:translateX(-50%);width:560px;max-width:calc(100% - 32px);text-align:center;pointer-events:none;opacity:${v.storyOp};transition:opacity .5s;text-shadow:0 0 14px #000,0 0 5px #000`)}>
        <div data-story="box" style={css("transition:opacity .28s,transform .28s;display:flex;flex-direction:column;gap:5px")}>
          <div data-story="ch" style={css("font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:rgba(243,241,236,.72)")}></div>
          <div data-story="tx" style={css(`font-size:${v.storyFs};line-height:1.35;text-wrap:pretty`)}></div>
        </div>
      </div>
      <div data-ping="1" style={css("position:absolute;left:0;top:0;width:28px;height:28px;border-radius:50%;border:1.5px solid #F3F1EC;opacity:0;pointer-events:none")}></div>
      <div data-tut="timeline" style={css(`position:absolute;left:${v.pad};right:${v.pad};bottom:${v.tlBottom};display:flex;align-items:flex-end;gap:${v.tlGap}`)}>
        <button onClick={v.togglePlay} aria-label="Play or pause" style={css("width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.3);background:rgba(12,13,15,.6);color:#F3F1EC;cursor:pointer;display:flex;align-items:center;justify-content:center;flex:none;margin-bottom:3px")} className="hv20">
          <span style={css(`display:${v.playIcon};width:0;height:0;border-left:11px solid #F3F1EC;border-top:7px solid transparent;border-bottom:7px solid transparent;margin-left:3px`)}></span>
          <span style={css(`display:${v.pauseIcon};gap:4px`)}>
            <span style={css("width:3px;height:13px;background:#F3F1EC")}></span>
            <span style={css("width:3px;height:13px;background:#F3F1EC")}></span>
          </span>
        </button>
        <button onClick={v.cycleSpeed} style={css(`display:${v.deskBlock};background:none;border:1px solid rgba(255,255,255,.18);color:#F3F1EC;border-radius:999px;padding:6px 12px;font-size:13px;cursor:pointer;flex:none;margin-bottom:10px;min-width:62px;font-variant-numeric:tabular-nums`)} className="hv21">
          {v.speedLabel}
        </button>
        <div ref={v.trackRef} onPointerDown={v.scrubDown} onPointerMove={v.scrubMove} onPointerUp={v.scrubUp} style={css("position:relative;flex:1;min-width:0;height:64px;cursor:pointer;touch-action:none")}>
          {(v.milestones || []).map((m, _i0) => (
            <Fragment key={_i0}>
              <button onClick={m.go} onMouseEnter={m.enter} onMouseLeave={m.leave} onPointerDown={v.stop} style={css(`position:absolute;left:${m.left};top:0;z-index:${m.z};min-width:${m.minW};max-width:${m.maxW};overflow:hidden;transform:translateX(${m.tx});background:none;border:none;padding:0 0 6px;color:${m.color};font-size:13px;cursor:pointer;white-space:nowrap;text-align:left;transition:color .25s;text-shadow:0 0 10px #000`)}>
                <span style={css(`opacity:${m.labelOp};transition:opacity .25s`)}>
                  {m.label}
                </span>
                <span style={css(`display:block;font-size:11px;color:rgba(243,241,236,.7);opacity:${m.dateOp};transition:opacity .25s;font-variant-numeric:tabular-nums`)}>
                  {m.date}
                </span>
              </button>
            </Fragment>
          ))}
          <div style={css("position:absolute;left:0;right:0;top:50px;height:2px;background:rgba(255,255,255,.2)")}></div>
          <div style={css(`position:absolute;left:${v.surfLeft};right:0;top:42px;height:5px;border-radius:3px;background:${v.stripSun};transition:opacity .4s`)}></div>
          <div style={css(`position:absolute;left:${v.surfLeft};right:0;top:55px;height:5px;border-radius:3px;background:${v.stripLink}`)}></div>
          <div style={css(`position:absolute;left:${v.surfLeft};right:0;top:40px;height:22px;pointer-events:none`)}>
            <div style={css(`position:absolute;right:0;top:0;bottom:0;background:#000;opacity:.9;width:${v.coverW};transition:width ${v.coverT} ease-in-out`)}></div>
          </div>
          <div data-tl="fill" style={css("position:absolute;left:0;top:50px;height:2px;background:#F3F1EC;width:0")}></div>
          {(v.ticks || []).map((k, _i0) => (
            <Fragment key={_i0}>
              <div style={css(`position:absolute;left:${k.left};top:47px;width:2px;height:8px;margin-left:-1px;background:rgba(243,241,236,.7)`)}></div>
            </Fragment>
          ))}
          <div data-tl="handle" style={css("position:absolute;left:0;top:44px;width:14px;height:14px;margin-left:-7px;border-radius:50%;background:#F3F1EC;box-shadow:0 0 0 4px rgba(0,0,0,.5)")}></div>
        </div>
        <div style={css(`display:${v.deskBlock};flex:none;width:150px;text-align:right;margin-bottom:4px;text-shadow:0 0 10px #000`)}>
          <div data-txt="phase" style={css("font-size:13px;color:rgba(243,241,236,.7)")}></div>
          <div data-txt="clock" style={css("font-size:14px;font-variant-numeric:tabular-nums")}></div>
        </div>
      </div>
      <div style={css(`position:absolute;left:${v.pad};right:${v.pad};bottom:${v.footBottom};display:flex;flex-direction:${v.footDir};justify-content:space-between;gap:${v.footGap};font-size:11px;line-height:1.3;color:rgba(243,241,236,.55)`)}>
        <span>
          {"Data: NASA/JPL Horizons, LRO LOLA. Not an official NASA product. "}
          <span style={css("opacity:.8")}>
            <span>{v.dataNote[0]}</span>{" "}<span>{v.dataNote[1]}</span>
          </span>
        </span>
        <span data-tut="footer" style={css("display:flex;gap:16px;align-items:center;white-space:nowrap")}>
          <button onClick={v.openTut} style={css("background:none;border:none;color:rgba(243,241,236,.8);font-size:11px;cursor:pointer;padding:0")} className="hv22">
            {"Tutorial"}
          </button>
          <span style={css("display:flex;border:1px solid rgba(255,255,255,.25);border-radius:999px;overflow:hidden")}>
            <button onClick={v.setEn} aria-label="English" style={css(`background:${v.enBg};border:none;color:#F3F1EC;font-size:11px;padding:2px 8px 2px 9px;cursor:pointer;transition:background .3s`)}>
              {"EN"}
            </button>
            <button onClick={v.setEs} aria-label="Español" style={css(`background:${v.esBg};border:none;color:#F3F1EC;font-size:11px;padding:2px 9px 2px 8px;cursor:pointer;transition:background .3s`)}>
              {"ES"}
            </button>
          </span>
          <button onClick={v.toggleReduce} style={css("background:none;border:none;color:rgba(243,241,236,.62);font-size:11px;cursor:pointer;padding:0;white-space:nowrap")} className="hv23">
            {"Reduce motion: "}{v.reduceLabel}
          </button>
          <button onClick={this.toggleSound} className="hv-snd" title="Keyboard: M" style={css("background:none;border:none;color:rgba(243,241,236,.62);font-size:11px;cursor:pointer;padding:0;white-space:nowrap")}>
            {"Sound: "}{Sound.on ? "on" : "off"}
          </button>
        </span>
      </div>
      <div style={css(`position:absolute;right:0;top:0;bottom:0;width:400px;max-width:100vw;background:rgba(10,11,13,.9);backdrop-filter:blur(18px);border-left:1px solid rgba(255,255,255,.1);padding:84px 28px 28px;box-sizing:border-box;overflow:auto;transform:translateX(${v.detailsX});opacity:${v.detailsOp};transition:transform .5s cubic-bezier(.2,.7,.2,1),opacity .4s;display:flex;flex-direction:column;gap:26px;z-index:4;user-select:text`)}>
        <div style={css("display:flex;justify-content:space-between;align-items:baseline")}>
          <span style={css("font-size:22px")}>
            {"Details"}
          </span>
          <button onClick={v.toggleDetails} style={css("background:none;border:none;color:rgba(243,241,236,.62);font-size:14px;cursor:pointer")} className="hv24">
            {"Close"}
          </button>
        </div>
        <div style={css("display:flex;flex-direction:column")}>
          <div style={css("font-size:12px;color:rgba(243,241,236,.62);padding-bottom:8px")}>
            {"Surface operations"}
          </div>
          {(v.statRows || []).map((r, _i0) => (
            <Fragment key={_i0}>
              <div style={css("display:flex;justify-content:space-between;padding:9px 0;border-top:1px solid rgba(255,255,255,.08)")}>
                <span>
                  {r.label}
                </span>
                <span data-roll={r.key} style={css(`font-variant-numeric:tabular-nums;color:${r.color}`)}></span>
              </div>
            </Fragment>
          ))}
        </div>
        <div style={css("display:flex;flex-direction:column")}>
          <div style={css("font-size:12px;color:rgba(243,241,236,.62);padding-bottom:8px")}>
            {"Burns, change in velocity"}
          </div>
          {(v.burnRows || []).map((r, _i0) => (
            <Fragment key={_i0}>
              <div style={css("display:flex;justify-content:space-between;padding:9px 0;border-top:1px solid rgba(255,255,255,.08)")}>
                <span>
                  {r.label}
                </span>
                <span data-roll={r.key} style={css("font-variant-numeric:tabular-nums")}></span>
              </div>
            </Fragment>
          ))}
        </div>
        <div style={css("display:flex;flex-direction:column")}>
          <div style={css("font-size:12px;color:rgba(243,241,236,.62);padding-bottom:8px")}>
            {"Mission requirements"}
          </div>
          {(v.reqRows || []).map((r, _i0) => (
            <Fragment key={_i0}>
              <div style={css("display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-top:1px solid rgba(255,255,255,.08)")}>
                <span>
                  {r.label}
                </span>
                <span style={css("display:flex;align-items:center;gap:10px")}>
                  <button onClick={r.dec} style={css("width:26px;height:26px;border-radius:50%;background:none;border:1px solid rgba(255,255,255,.2);color:#F3F1EC;cursor:pointer")} className="hv25">
                    {"−"}
                  </button>
                  <span style={css("min-width:58px;text-align:center;font-variant-numeric:tabular-nums")}>
                    {r.value}
                  </span>
                  <button onClick={r.inc} style={css("width:26px;height:26px;border-radius:50%;background:none;border:1px solid rgba(255,255,255,.2);color:#F3F1EC;cursor:pointer")} className="hv26">
                    {"+"}
                  </button>
                </span>
              </div>
            </Fragment>
          ))}
        </div>
        {this.plan && this.state.details ? <WindowsPanel plan={this.plan} getTime={this.getTime} onJump={this.jumpTo} lang={this.lang()} /> : null}
        {this.plan && this.state.details ? <HorizonChart plan={this.plan} getTime={this.getTime} lang={this.lang()} /> : null}
        <button onClick={v.exportPlan} style={css("align-self:flex-start;white-space:nowrap;flex:none;background:none;border:1px solid rgba(255,255,255,.25);color:#F3F1EC;border-radius:999px;padding:9px 16px;font-size:14px;cursor:pointer")} className="hv27">
          {"Export plan (JSON)"}
        </button>
      </div>
      <div style={css(`position:absolute;inset:0;background:rgba(0,0,0,.74);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:32px;box-sizing:border-box;overflow:auto;opacity:${v.preOp};pointer-events:${v.prePE};transition:opacity .6s;z-index:9`)}>
        <div style={css("width:100%;max-width:1100px;display:flex;flex-direction:column;gap:18px;margin:auto")}>
          <div style={css("display:flex;justify-content:flex-end;gap:12px;align-items:center")}>
            <button onClick={v.closePre} style={css("order:2;background:none;border:1px solid rgba(255,255,255,.25);color:#F3F1EC;border-radius:999px;padding:7px 14px;font-size:13px;cursor:pointer")} className="hv28">
              {"Close"}
            </button>
            <span style={css("display:flex;flex:none;border:1px solid rgba(255,255,255,.25);border-radius:999px;overflow:hidden")}>
              <button onClick={v.setEn} aria-label="English" style={css(`background:${v.enBg};border:none;color:#F3F1EC;font-size:13px;padding:7px 12px;cursor:pointer;transition:background .3s`)}>
                {"EN"}
              </button>
              <button onClick={v.setEs} aria-label="Español" style={css(`background:${v.esBg};border:none;color:#F3F1EC;font-size:13px;padding:7px 12px;cursor:pointer;transition:background .3s`)}>
                {"ES"}
              </button>
            </span>
          </div>
          <div style={css("display:flex;flex-direction:column;gap:10px;max-width:760px;margin-top:-20px")}>
            <div style={css("font-size:34px;font-weight:300;letter-spacing:-.015em;line-height:1.1")}>
              {"When and where can a lander survive?"}
            </div>
            <div style={css("font-size:16px;color:rgba(243,241,236,.78);text-wrap:pretty")}>
              {"Each cell is one mission: a landing site and a launch date. It is viable only if the lander gets enough sunlight for power and enough contact with Earth. Pick one to fly it, or up to four to compare them from launch to landing."}
            </div>
          </div>
          <div style={css("overflow-x:auto")}>
            <div style={css("display:grid;grid-template-columns:minmax(128px,1.2fr) repeat(7,minmax(88px,1fr));gap:6px;min-width:780px")}>
              <div style={css("font-size:12px;color:rgba(243,241,236,.62);align-self:end;padding-bottom:4px;white-space:pre")}>
                {"Landing site ↓  Launch date →"}
              </div>
              {(v.gridDates || []).map((g, _i0) => (
                <Fragment key={_i0}>
                  <div style={css("font-size:13px;text-align:center;align-self:end;padding-bottom:4px;font-variant-numeric:tabular-nums")}>
                    {g.label}
                  </div>
                </Fragment>
              ))}
              {(v.gridRows || []).map((r, _i0) => (
                <Fragment key={_i0}>
                  <div style={css("display:flex;flex-direction:column;justify-content:center;padding-right:8px;min-width:0")}>
                    <span style={css("font-size:15px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>
                      {r.name}
                    </span>
                    <span style={css("font-size:12px;color:rgba(243,241,236,.62)")}>
                      {r.sub}
                    </span>
                  </div>
                  {(r.cells || []).map((c, _i1) => (
                    <Fragment key={_i1}>
                      <button onClick={c.pick} style={css(`position:relative;background:${c.bg};border:1px solid ${c.border};border-radius:10px;padding:8px 9px;cursor:pointer;color:#F3F1EC;display:flex;flex-direction:column;gap:6px;text-align:left;min-height:66px;transition:border-color .2s,background .2s`)} className="hv29">
                        <span style={css(`display:flex;align-items:center;gap:6px;font-size:12px;font-weight:500;color:${c.color};white-space:nowrap`)}>
                          <span style={css(`width:8px;height:8px;border-radius:50%;flex:none;background:${c.dot};border:1.5px solid ${c.color};box-sizing:border-box`)}></span>
                          {c.word}
                        </span>
                        <span style={css("display:flex;flex-direction:column;gap:2px")}>
                          <span style={css(`height:3px;border-radius:2px;background:${c.stripSun}`)}></span>
                          <span style={css(`height:3px;border-radius:2px;background:${c.stripLink}`)}></span>
                        </span>
                        <span style={css("font-size:11px;color:rgba(243,241,236,.7);white-space:nowrap;font-variant-numeric:tabular-nums")}>
                          {c.night}
                        </span>
                        <span style={css(`position:absolute;right:-5px;top:-5px;width:18px;height:18px;border-radius:50%;background:#F3F1EC;color:#0b0b0c;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;opacity:${c.badgeOp};transition:opacity .2s`)}>
                          {c.badge}
                        </span>
                      </button>
                    </Fragment>
                  ))}
                </Fragment>
              ))}
            </div>
          </div>
          <div style={css("display:flex;gap:8px 22px;flex-wrap:wrap;font-size:12px;color:rgba(243,241,236,.75)")}>
            <span style={css("display:flex;align-items:center;gap:7px")}>
              <span style={css("width:22px;height:3px;border-radius:2px;background:#E8B95A")}></span>
              {"Hours with Sun"}
            </span>
            <span style={css("display:flex;align-items:center;gap:7px")}>
              <span style={css("width:22px;height:3px;border-radius:2px;background:#6FA8F5")}></span>
              {"Hours with Earth link"}
            </span>
            <span style={css("display:flex;align-items:center;gap:7px")}>
              <span style={css("font-variant-numeric:tabular-nums;color:#F3F1EC")}>
                {"h"}
              </span>
              {"Longest stretch without Sun"}
            </span>
          </div>
          <div style={css("display:flex;align-items:center;justify-content:space-between;gap:10px 16px;flex-wrap:wrap;position:sticky;bottom:0;background:rgba(6,6,7,.94);padding:12px 0;z-index:1")}>
            <div style={css("display:flex;flex-direction:column;gap:3px;font-size:13px;min-width:0;flex:1")}>
              {(v.selChips || []).map((c, _i0) => (
                <Fragment key={_i0}>
                  <span style={css(`color:${c.color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>
                    {c.text}
                  </span>
                </Fragment>
              ))}
            </div>
            <div style={css(`display:flex;gap:8px 10px;align-items:center;flex-wrap:wrap;justify-content:flex-end;flex-direction:${v.ctaDir}`)}>
              <button onClick={v.preCustom} style={css("background:none;border:none;color:rgba(243,241,236,.8);padding:11px 6px;font-size:14px;cursor:pointer;white-space:nowrap")} className="hv30">
                {"Your own site and date"}
              </button>
              <button onClick={v.openTut} style={css("background:none;border:1px solid rgba(255,255,255,.25);color:#F3F1EC;border-radius:999px;padding:11px 18px;font-size:15px;cursor:pointer;white-space:nowrap")} className="hv31">
                {"How it works"}
              </button>
              <button onClick={v.startMissions} style={css(`background:#F3F1EC;color:#0b0b0c;border:none;border-radius:999px;padding:12px 22px;font-size:15px;font-weight:500;cursor:pointer;white-space:nowrap;opacity:${v.startOp};transition:opacity .25s`)} className="hv32">
                {v.startLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div style={css(`position:absolute;inset:0;overflow:hidden;opacity:${v.tutOp};pointer-events:${v.tutPE};transition:opacity .4s;z-index:20`)}>
        <div data-tut-hl="1" style={css("position:absolute;left:50%;top:50%;width:0;height:0;border:1px solid rgba(243,241,236,.85);border-radius:14px;box-shadow:0 0 0 4000px rgba(0,0,0,.68);transition:left .45s cubic-bezier(.2,.7,.2,1),top .45s cubic-bezier(.2,.7,.2,1),width .45s cubic-bezier(.2,.7,.2,1),height .45s cubic-bezier(.2,.7,.2,1);pointer-events:none")}></div>
        <div data-tut-card="1" style={css("position:absolute;left:24px;top:24px;width:380px;max-width:calc(100% - 48px);box-sizing:border-box;background:rgba(18,19,22,.96);border:1px solid rgba(255,255,255,.16);border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:12px;transition:left .45s cubic-bezier(.2,.7,.2,1),top .45s cubic-bezier(.2,.7,.2,1)")}>
          <div style={css("display:flex;align-items:center;justify-content:space-between;gap:12px")}>
            <span style={css("font-size:12px;color:rgba(243,241,236,.62);font-variant-numeric:tabular-nums")}>
              {v.tutCount}
            </span>
            <span style={css("display:flex;flex:none;border:1px solid rgba(255,255,255,.25);border-radius:999px;overflow:hidden")}>
              <button onClick={v.setEn} aria-label="English" style={css(`background:${v.enBg};border:none;color:#F3F1EC;font-size:11px;padding:3px 9px;cursor:pointer;transition:background .3s`)}>
                {"EN"}
              </button>
              <button onClick={v.setEs} aria-label="Español" style={css(`background:${v.esBg};border:none;color:#F3F1EC;font-size:11px;padding:3px 9px;cursor:pointer;transition:background .3s`)}>
                {"ES"}
              </button>
            </span>
          </div>
          <div style={css("font-size:21px;font-weight:500")}>
            {v.tutTitle}
          </div>
          <div style={css("font-size:15px;color:rgba(243,241,236,.85);text-wrap:pretty")}>
            {v.tutText}
          </div>
          <div style={css("display:flex;align-items:center;gap:10px;margin-top:4px")}>
            <button onClick={v.tutSkip} style={css("background:none;border:none;color:rgba(243,241,236,.62);font-size:14px;cursor:pointer;padding:0")} className="hv33">
              {"Skip"}
            </button>
            <span style={css("flex:1")}></span>
            <button onClick={v.tutBack} style={css(`background:none;border:1px solid rgba(255,255,255,.25);color:#F3F1EC;border-radius:999px;padding:8px 16px;font-size:14px;cursor:pointer;opacity:${v.tutBackOp};pointer-events:${v.tutBackPE}`)} className="hv34">
              {"Back"}
            </button>
            <button onClick={v.tutNext} style={css("background:#F3F1EC;color:#0b0b0c;border:none;border-radius:999px;padding:9px 18px;font-size:14px;font-weight:500;cursor:pointer")} className="hv35">
              {v.tutNextLabel}
            </button>
          </div>
        </div>
      </div>
      <div style={css(`position:absolute;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(8px);display:flex;padding:24px;box-sizing:border-box;overflow:auto;opacity:${v.introOp};pointer-events:${v.introPE};transition:opacity .7s;z-index:9`)}>
        <div style={css("position:absolute;right:24px;top:20px")}>
          <span style={css("display:flex;flex:none;border:1px solid rgba(255,255,255,.25);border-radius:999px;overflow:hidden")}>
            <button onClick={v.setEn} aria-label="English" style={css(`background:${v.enBg};border:none;color:#F3F1EC;font-size:13px;padding:7px 12px;cursor:pointer;transition:background .3s`)}>
              {"EN"}
            </button>
            <button onClick={v.setEs} aria-label="Español" style={css(`background:${v.esBg};border:none;color:#F3F1EC;font-size:13px;padding:7px 12px;cursor:pointer;transition:background .3s`)}>
              {"ES"}
            </button>
          </span>
        </div>
        <div style={css("margin:auto;width:100%;max-width:560px;display:flex;flex-direction:column;gap:22px;align-items:flex-start")}>
          <div style={css("display:flex;align-items:center;gap:14px")}>
            <img src={asset("logo.svg")} alt="" style={css("width:76px;height:76px;flex:none")} />
            <span style={css("display:flex;flex-direction:column;gap:2px")}>
              <span style={css("font-size:28px;letter-spacing:-.01em;line-height:1")}>
                <span style={css("font-weight:600")}>
                  {"Moon"}
                </span>
                <span style={css("font-weight:300")}>
                  {"Site"}
                </span>
              </span>
              <span style={css("font-size:13px;color:rgba(243,241,236,.7)")}>
                {"Lunar Landing Site Navigator"}
              </span>
            </span>
          </div>
          <div style={css("font-size:clamp(30px,5.2vw,44px);font-weight:300;letter-spacing:-.02em;line-height:1.08;text-wrap:balance")}>
            {"Can a lander survive at this site, on this date?"}
          </div>
          <div style={css("font-size:16px;color:rgba(243,241,236,.82);text-wrap:pretty")}>
            {"A lander on the Moon needs sunlight for power and a clear view of Earth to communicate. Near the south pole both come and go. Fly a mission from launch to landing and see whether it gets both."}
          </div>
          <div style={css("display:flex;gap:10px 26px;flex-wrap:wrap;font-size:15px")}>
            <span style={css("display:flex;align-items:center;gap:9px")}>
              <span style={css("width:10px;height:10px;border-radius:50%;background:#E8B95A")}></span>
              {"Sunlight for power"}
            </span>
            <span style={css("display:flex;align-items:center;gap:9px")}>
              <span style={css("width:10px;height:10px;border-radius:50%;background:#6FA8F5")}></span>
              {"A link to Earth to communicate"}
            </span>
          </div>
          <div style={css("display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-top:6px")}>
            <button onClick={v.introGo} style={css("background:#F3F1EC;color:#0b0b0c;border:none;border-radius:999px;padding:14px 24px;font-size:16px;font-weight:500;cursor:pointer;min-height:48px")} className="hv36">
              {v.introPrimary}
            </button>
            <button onClick={v.introAlt} style={css("background:none;border:1px solid rgba(255,255,255,.28);color:#F3F1EC;border-radius:999px;padding:13px 20px;font-size:15px;cursor:pointer;min-height:48px;white-space:nowrap")} className="hv37">
              {v.introSecondary}
            </button>
          </div>
        </div>
      </div>
      <div style={css(`position:absolute;inset:0;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;padding:24px;box-sizing:border-box;opacity:${v.loadOp};pointer-events:${v.loadPE};transition:opacity 1.2s;z-index:30`)}>
        <div style={css("position:relative;width:140px;height:140px;flex:none")}>
          <svg viewBox="0 0 140 140" style={css("position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)")}>
            <circle cx="70" cy="70" r="66" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="1.5"></circle>
            <circle cx="70" cy="70" r="66" fill="none" stroke="#F3F1EC" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="414.7" strokeDashoffset={v.loadDash} style={css("transition:stroke-dashoffset .5s ease-out")}></circle>
          </svg>
          <img src={asset("logo.svg")} alt="" style={css("position:absolute;left:24px;top:24px;width:92px;height:92px")} />
        </div>
        <div style={css("display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center")}>
          <div style={css("font-size:30px;letter-spacing:-.01em;line-height:1")}>
            <span style={css("font-weight:600")}>
              {"Moon"}
            </span>
            <span style={css("font-weight:300")}>
              {"Site"}
            </span>
          </div>
          <div style={css("font-size:13px;color:rgba(243,241,236,.7)")}>
            {"Lunar Landing Site Navigator"}
          </div>
          <div style={css("font-size:13px;color:rgba(243,241,236,.62);font-variant-numeric:tabular-nums")}>
            {v.loadPct}
          </div>
        </div>
        <div style={css("display:flex;flex-direction:column;gap:9px;min-width:230px")}>
          {(v.loadSteps || []).map((s, _i0) => (
            <Fragment key={_i0}>
              <div style={css(`display:flex;align-items:center;gap:12px;font-size:14px;opacity:${s.op};transition:opacity .5s`)}>
                <span style={css(`width:9px;height:9px;border-radius:50%;flex:none;box-sizing:border-box;border:1.5px solid #F3F1EC;background:${s.fill};transition:background .4s`)}></span>
                <span>
                  {s.label}
                </span>
              </div>
            </Fragment>
          ))}
        </div>
      </div>
      <Cinematic countdown={this.state.countdown} toast={this.state.toast} flashKey={this.state.flash} letterbox={!!this.state.letterbox} onSkip={this.skipCountdown} reduce={this.reduce()} />
    </div>
    );
  }
}
