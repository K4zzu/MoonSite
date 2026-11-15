// LunarScene — the 3D layer. No DOM besides the canvas; the UI layer talks to it through properties and callbacks.
// Units: 1 = 1000 km. Sim frame (x,y,z ecliptic) maps to three (x, z, -y). The camera is always at the origin (floating origin).
import * as THREE from 'three';
import LunarSim from './sim.js';
import { LunarExtras } from './extras.js';
import { buildRocket, buildLander, deployLander, stageRocket, Particles } from './ships.js';

const S = LunarSim, K = 1e-3, RM = S.R_M * K, RE = S.R_E * K, D2R = Math.PI / 180, NE = 400, NL = 360;
const V3 = () => new THREE.Vector3();
const v3 = a => new THREE.Vector3(a[0] * K, a[2] * K, -a[1] * K), d3 = a => new THREE.Vector3(a[0], a[2], -a[1]);
const GOLD = 0xE8B95A, BLUE = 0x6FA8F5, smooth = S.smooth, clamp = S.clamp;
const X = LunarExtras;
const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;

function hash3(x, y, z, s) { let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1440662683) + Math.imul(s, 2147483647) | 0; n = Math.imul(n ^ n >>> 13, 1274126177); return ((n ^ n >>> 16) >>> 0) / 4294967296; }
function n3(x, y, z, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z); let u = x - xi, v = y - yi, w = z - zi; u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v); w = w * w * (3 - 2 * w);
  const L = (a, b, k) => a + (b - a) * k;
  return L(L(L(hash3(xi, yi, zi, s), hash3(xi + 1, yi, zi, s), u), L(hash3(xi, yi + 1, zi, s), hash3(xi + 1, yi + 1, zi, s), u), v),
    L(L(hash3(xi, yi, zi + 1, s), hash3(xi + 1, yi, zi + 1, s), u), L(hash3(xi, yi + 1, zi + 1, s), hash3(xi + 1, yi + 1, zi + 1, s), u), v), w);
}
function fbm(x, y, z, s, oct) { let a = .5, f = 1, v = 0; for (let o = 0; o < oct; o++) { v += a * n3(x * f, y * f, z * f, s + o); a *= .5; f *= 2.03; } return v; }
function sphereImage(W, H, fn) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
  for (let y = 0; y < H; y++) { const lat = (0.5 - (y + .5) / H) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
    for (let x = 0; x < W; x++) { const lon = ((x + .5) / W - .5) * 2 * Math.PI, o = (y * W + x) * 4, c3 = fn(cl * Math.cos(lon), sl, -cl * Math.sin(lon), lat); d[o] = c3[0]; d[o + 1] = c3[1]; d[o + 2] = c3[2]; d[o + 3] = 255; } }
  ctx.putImageData(img, 0, 0); return c;
}
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
function earthCanvas() {
  return sphereImage(1024, 512, (x, y, z, lat) => {
    const n = fbm(x * 1.7 + 5, y * 1.7, z * 1.7, 1, 6), al = Math.abs(lat);
    let c = n > 0.53 ? mix(mix([46, 82, 40], [136, 112, 72], smooth(.2, .55, Math.cos(lat * 3.2) * .5 + (n - .53) * 3)), [90, 84, 70], smooth(.6, .72, n)) : mix([10, 34, 92], [20, 64, 130], smooth(.4, .53, n));
    if (al > 1.12 + (n - .5) * .7) c = [226, 232, 238];
    return mix(c, [245, 247, 250], 0.92 * smooth(.5, .7, fbm(x * 3 + 9, y * 4.2, z * 3, 9, 5)));
  });
}
function moonCanvas() {
  const base = sphereImage(1024, 512, (x, y, z) => {
    const n = fbm(x * 2.2, y * 2.2, z * 2.2, 21, 5), f = fbm(x * 15, y * 15, z * 15, 31, 4);
    const mare = smooth(.47, .58, fbm(x * 1.4 + 3, y * 1.4, z * 1.4, 41, 4)) * smooth(-.1, .55, x) * (1 - smooth(.45, .85, Math.abs(y)));
    let g = 158 + (n - .5) * 70 + (f - .5) * 60; g = g + (78 + (f - .5) * 36 - g) * mare * .9; return [g, g * .985, g * .96];
  });
  const W = 2048, H = 1024, c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d'); ctx.drawImage(base, 0, 0, W, H);
  let a = 12345; const r = () => { a = Math.imul(a, 1664525) + 1013904223 | 0; return (a >>> 0) / 4294967296; };
  for (let i = 0; i < 6000; i++) {
    const lat = Math.asin(r() * 2 - 1), lon = r() * 360 - 180, rd = 0.1 + 5 * Math.pow(r(), 9), cy = (.5 - lat / Math.PI) * H, ry = rd * H / 180, rx = Math.min(ry / Math.max(Math.cos(lat), .04), W / 3), al = 0.55 + 0.45 * r();
    for (const off of [0, W, -W]) { const cx = (lon / 360 + .5) * W + off; if (cx + rx * 1.5 < 0 || cx - rx * 1.5 > W) continue;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(rx / ry, 1); const g = ctx.createRadialGradient(0, 0, 0, 0, 0, ry * 1.5);
      g.addColorStop(0, `rgba(0,0,0,${.2 * al})`); g.addColorStop(.5, `rgba(0,0,0,${.17 * al})`); g.addColorStop(.62, `rgba(0,0,0,${.05 * al})`); g.addColorStop(.67, `rgba(255,255,255,${.28 * al})`); g.addColorStop(.74, `rgba(255,255,255,${.07 * al})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, ry * 1.5, 0, 6.2832); ctx.fill(); ctx.restore(); }
  }
  return c;
}
function spriteTex(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  if (kind === 'sun') { g.addColorStop(0, '#fff'); g.addColorStop(.12, '#fff'); g.addColorStop(.135, 'rgba(255,236,200,.55)'); g.addColorStop(.4, 'rgba(255,214,150,.12)'); g.addColorStop(1, 'rgba(255,200,120,0)'); }
  else if (kind === 'ship') { g.addColorStop(0, '#fff'); g.addColorStop(.1, '#fff'); g.addColorStop(.3, 'rgba(255,255,255,.25)'); g.addColorStop(1, 'rgba(255,255,255,0)'); }
  else if (kind === 'soft') { g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(.35, 'rgba(255,255,255,.4)'); g.addColorStop(1, 'rgba(255,255,255,0)'); }
  else if (kind === 'dot') { g.addColorStop(0, '#fff'); g.addColorStop(.3, '#fff'); g.addColorStop(.42, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); }
  else { g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.78, 'rgba(255,255,255,0)'); g.addColorStop(.86, '#fff'); g.addColorStop(.94, 'rgba(255,255,255,0)'); }
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}
const lookQ = (eye, target, up) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, target, up));
function slerpDir(a, b, k) { const th = Math.acos(clamp(a.dot(b), -1, 1)); if (th < 1e-4) return a.clone().lerp(b, k).normalize(); const s = Math.sin(th); return a.clone().multiplyScalar(Math.sin((1 - k) * th) / s).add(b.clone().multiplyScalar(Math.sin(k * th) / s)).normalize(); }
const localDir = (az, el) => new THREE.Vector3(Math.cos(el * D2R) * Math.sin(az * D2R), Math.sin(el * D2R), -Math.cos(el * D2R) * Math.cos(az * D2R));

class LunarScene {
  constructor(canvas) {
    this.canvas = canvas; this.time = Date.now(); this.scale = 'transit'; this.follow = true; this.reduceMotion = false;
    this.drawFrac = 1; this.ghostAlpha = 0; this.altAlpha = 0; this.selectedId = null; this.hover = null;
    this.surfaceView = { yaw: null, pitch: 4, fov: 46 }; this.compare = null; this.compareRects = []; this.compareView = { yawOff: 18, pitch: 4 };
    this.anchors = { sites: {}, alts: [] }; this.kits = new Map(); this.ready = false; this.sites = S.SITES.slice(); this.followMix = 1; this.alts = [];
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); r.outputEncoding = THREE.sRGBEncoding; r.shadowMap.enabled = true; r.setClearColor(0x000000); r.autoClear = false;
    this.cam = new THREE.PerspectiveCamera(42, 1, 1e-6, 2e6); this.scene = new THREE.Scene(); this.root = new THREE.Group(); this.scene.add(this.root);
    this.views = { transit: { dir: new THREE.Vector3(.45, .5, .74).normalize(), up: new THREE.Vector3(0, 1, 0), zoom: 1 }, moon: { dir: new THREE.Vector3(0, -1, .3).normalize(), up: new THREE.Vector3(0, .3, 1).normalize(), zoom: 1 } };
    this.pose = { pos: V3(), quat: new THREE.Quaternion(), fov: 42 };
    this._loop = this._loop.bind(this); this._bind();
  }
  async init() {
    const step = (p, l) => new Promise(res => { this.onProgress?.(p, l); setTimeout(res, 70); });
    await step(.08, 'Placing the stars'); this._stars();
    await step(.25, 'Painting the Earth'); await this._loadTextures(); this._earth();
    await step(.5, 'Sculpting the Moon'); this._moon();
    await step(.78, 'Plotting the route'); this._lines();
    await step(.92, 'Surveying the landing site'); if (this.site) this.kitFor(this.site);
    await step(1, 'Ready'); this.ready = true; this._resize(); this._last = performance.now(); this._raf = requestAnimationFrame(this._loop); this.onReady?.();
  }
  dispose() { cancelAnimationFrame(this._raf); this._ro?.disconnect(); this.renderer.dispose(); }

  _stars() {
    const n = 4500, p = new Float32Array(n * 3), c = new Float32Array(n * 3); let a = 99; const r = () => { a = Math.imul(a, 1664525) + 1013904223 | 0; return (a >>> 0) / 4294967296; };
    for (let i = 0; i < n; i++) { const z = r() * 2 - 1, t = r() * 6.2832, q = Math.sqrt(1 - z * z), b = 0.12 + 0.75 * Math.pow(r(), 5); p.set([q * Math.cos(t) * 9e5, z * 9e5, q * Math.sin(t) * 9e5], i * 3); c.set([b, b, b * (0.9 + r() * .2)], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.5, sizeAttenuation: false, vertexColors: true, depthWrite: false })); this.stars.frustumCulled = false; this.scene.add(this.stars);
    this.sunLight = new THREE.DirectionalLight(0xfff3e2, 2.3); this.sunLight.shadow.mapSize.set(2048, 2048);
    const sc = this.sunLight.shadow.camera; sc.left = sc.bottom = -0.0005; sc.right = sc.top = 0.0005; sc.near = 0.0004; sc.far = 0.009; sc.updateProjectionMatrix(); this.sunLight.shadow.bias = -0.0002;
    this.scene.add(this.sunLight, this.sunLight.target, new THREE.AmbientLight(0x1a2230, 0.05));
    this.sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTex('sun'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); this.sun.scale.setScalar(696 * 2 / 0.25); this.root.add(this.sun);
  }
  // Real NASA imagery (public/textures, built by lunar-data/scripts/make_textures.py). Procedural fallback if missing.
  async _loadTextures() {
    const L = new THREE.TextureLoader(), base = import.meta.env.BASE_URL + 'textures/', max = this.renderer.capabilities.getMaxAnisotropy();
    const get = n => L.loadAsync(base + n).catch(() => null);
    const [earth, moon, relief] = await Promise.all([get('earth_bluemarble_dec_4k.jpg'), get('moon_lroc_color_4k.jpg'), get('moon_lola_relief_2k.jpg')]);
    if (earth) { earth.encoding = THREE.sRGBEncoding; earth.anisotropy = Math.min(8, max); }
    if (moon) { moon.encoding = THREE.sRGBEncoding; moon.anisotropy = Math.min(8, max); moon.wrapS = THREE.RepeatWrapping; }
    if (relief) relief.wrapS = THREE.RepeatWrapping;
    this.tex = { earth, moon, relief };
  }
  _earth() {
    const real = this.tex && this.tex.earth, t = real || new THREE.CanvasTexture(earthCanvas()); if (!real) { t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; }
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(RE, 192, 128), new THREE.MeshLambertMaterial({ map: t, emissive: real ? 0x050c1a : 0x0d2244, emissiveIntensity: 1 }));
    this.earth.add(new THREE.Mesh(new THREE.SphereGeometry(RE * 1.005, 128, 96), new THREE.MeshBasicMaterial({ color: 0x4d8fe0, transparent: true, opacity: .4, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })));
    X.addDetail(this.earth.material, X.detailTex(false), 4.3, 37, real ? .12 : .3); this.root.add(this.earth);
    // Matte (Lambert) on purpose: a physically based material turns the ground into a grey mirror when seen at a grazing
    // angle with the Sun low, which is exactly the launch view. Full anisotropy keeps the Blue Marble sharp near the horizon.
    t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
  }
  _moon() {
    this._detail = X.detailTex(true); const real = this.tex && this.tex.moon, c = real ? null : moonCanvas(), t = real || new THREE.CanvasTexture(c), b = (this.tex && this.tex.relief) || new THREE.CanvasTexture(c || moonCanvas()); if (!real) { t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; }
    this.moon = new THREE.Group(); this.moonMesh = new THREE.Mesh(new THREE.SphereGeometry(RM, 256, 128), new THREE.MeshStandardMaterial({ map: t, bumpMap: b, bumpScale: real ? 0.004 : 0.014, roughness: 1, metalness: 0, color: real ? 0xffffff : 0xbdb8b0 }));
    this.moon.add(this.moonMesh); X.addDetail(this.moonMesh.material, this._detail, 7, 55, real ? .5 : .9); if (real) X.sphericalMapping(this.moonMesh.material, 'moon'); this.sitesG = new THREE.Group(); this.moon.add(this.sitesG); this.root.add(this.moon); this._dot = spriteTex('dot'); this.setSites(this.sites);
  }
  setSites(list) {
    this.sites = list; if (!this.sitesG) return; while (this.sitesG.children.length) this.sitesG.remove(this.sitesG.children[0]);
    for (const s of list) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this._dot, depthTest: false, depthWrite: false, transparent: true })); const cl = Math.cos(s.lat * D2R);
      sp.position.set(cl * Math.cos(s.lon * D2R), Math.sin(s.lat * D2R), -cl * Math.sin(s.lon * D2R)).multiplyScalar(RM * 1.003); sp.userData.site = s; sp.renderOrder = 5; this.sitesG.add(sp); }
  }
  _mkLine(n, color, op, parent, shared) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', shared || new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false })); l.frustumCulled = false; parent.add(l); return l;
  }
  _lines() {
    const R = this.root; this.transitG = new THREE.Group(); R.add(this.transitG); this.moonC = new THREE.Group(); R.add(this.moonC); const T = this.transitG;
    this.ringL = this._mkLine(240, 0xffffff, .13, T);
    this.ghostL = this._mkLine(NE, 0x8a8a8a, 0, T); this.altL = [0, 1, 2].map(() => this._mkLine(NE, 0xffffff, 0, T));
    this.todoE = this._mkLine(NE, 0xffffff, .26, T); this.doneE = this._mkLine(NE, 0xffffff, .95, T, this.todoE.geometry.attributes.position);
    this.todoL = this._mkLine(NL, 0xffffff, .26, this.moonC); this.doneL = this._mkLine(NL, 0xffffff, .95, this.moonC, this.todoL.geometry.attributes.position);
    this.ship = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTex('ship'), blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true })); this.ship.renderOrder = 6; R.add(this.ship);
    this.arrival = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTex('ring'), depthTest: false, depthWrite: false, transparent: true, opacity: .7 })); T.add(this.arrival);
    const tg = new THREE.BufferGeometry(), tc = new Float32Array(32 * 3); for (let i = 0; i < 32; i++) { const b = Math.pow(1 - i / 31, 1.6); tc.set([b, b, b], i * 3); }
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(32 * 3), 3)); tg.setAttribute('color', new THREE.BufferAttribute(tc, 3));
    this.trail = new THREE.Line(tg, new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); this.trail.frustumCulled = false; R.add(this.trail);
    const pg = new THREE.ConeGeometry(.5, 1, 14, 1, true); pg.translate(0, -.5, 0); this.plume = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide })); this.plume.visible = false; this.plume.renderOrder = 6; R.add(this.plume);
    this.tip = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.ship.material.map, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true })); this.tip.visible = false; T.add(this.tip);
    this.ghostArr = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.arrival.material.map, color: 0x9a9a9a, depthTest: false, depthWrite: false, transparent: true, opacity: 0 })); T.add(this.ghostArr);
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(40 * 6), 3));
    this.links = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x4f93ff, transparent: true, opacity: .4, depthWrite: false })); this.links.frustumCulled = false; R.add(this.links);
    this._buildCraft();
  }
  _fillE(plan, attr) { const a = attr.array, te = []; for (let i = 0; i < NE; i++) { let t; if (i < 100) t = plan.launch + (plan.tTLI - plan.launch) * i / 99; else { const k = (i - 100) / (NE - 101); t = plan.tTLI + (plan.tA - plan.tTLI) * (0.35 * k + 0.65 * k * k); } const p = S.shipPos(plan, t); a[i * 3] = p[0] * K; a[i * 3 + 1] = p[2] * K; a[i * 3 + 2] = -p[1] * K; te.push(t); } attr.needsUpdate = true; return te; }
  setPlan(plan) { this.plan = plan; this.site = plan.site; this._dirty = true; }
  setGhost(plan) { if (plan && this.ghostL) this._fillE(plan, this.ghostL.geometry.attributes.position); this.ghostArrP = plan ? v3(S.moonPos(plan.tA)) : null; }
  setAlts(plans) { this.alts = plans || []; if (!this.altL) return; this.alts.forEach((p, i) => { if (i < 3) this._fillE(p, this.altL[i].geometry.attributes.position); }); }
  _syncPlan() {
    const pl = this.plan; this._dirty = false; this.te = this._fillE(pl, this.todoE.geometry.attributes.position);
    const a = this.todoL.geometry.attributes.position.array; this.tl = [];
    for (let i = 0; i < NL; i++) { const t = pl.tA + (pl.tLand - pl.tA) * i / (NL - 1), p = S.V.sub(S.shipPos(pl, t), S.moonPos(t)); a[i * 3] = p[0] * K; a[i * 3 + 1] = p[2] * K; a[i * 3 + 2] = -p[1] * K; this.tl.push(t); }
    this.todoL.geometry.attributes.position.needsUpdate = true; this.arrivalP = v3(S.moonPos(pl.tA));
  }
  kitFor(site) {
    const key = site.id + site.lat + ',' + site.lon; if (this.kits.has(key)) return this.kits.get(key);
    const ter = S.terrainOf(site), NA = 240, NR = 110, nv = 1 + NA * NR, pos = new Float32Array(nv * 3), col = new Float32Array(nv * 3), idx = new Uint32Array(NA * 3 + NA * (NR - 1) * 6);
    col.set([.6, .6, .6], 0);
    for (let j = 0; j < NR; j++) { const d = 0.002 * Math.pow(80000, j / (NR - 1));
      for (let i = 0; i < NA; i++) { const az = i / NA * 6.2832, o = (1 + j * NA + i) * 3, h = ter.height(az, d) - d * d / (2 * S.R_M);
        pos[o] = d * Math.sin(az) * K; pos[o + 1] = h * K; pos[o + 2] = -d * Math.cos(az) * K;
        const cx = d * Math.sin(az), cy = d * Math.cos(az), g = 0.6 + 0.2 * (1 - smooth(.4, 1.1, d)) * (n3(cx * 9, cy * 9, 0, site.seed) - .5) + 0.16 * (1 - smooth(4, 11, d)) * (n3(cx * .9, cy * .9, 3, site.seed) - .5) + 0.12 * (n3(cx * .11, cy * .11, 7, site.seed) - .5); col[o] = g; col[o + 1] = g * .98; col[o + 2] = g * .95; } }
    let q = 0; for (let i = 0; i < NA; i++) { const i2 = (i + 1) % NA; idx[q++] = 0; idx[q++] = 1 + i2; idx[q++] = 1 + i; }
    for (let j = 0; j < NR - 1; j++) for (let i = 0; i < NA; i++) { const i2 = (i + 1) % NA, a = 1 + j * NA + i, b = 1 + j * NA + i2, c = a + NA, d = b + NA; idx[q++] = a; idx[q++] = b; idx[q++] = c; idx[q++] = b; idx[q++] = d; idx[q++] = c; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals(); const uv = new Float32Array(nv * 2); for (let i = 0; i < nv; i++) { uv[i * 2] = pos[i * 3] * 30000; uv[i * 2 + 1] = pos[i * 3 + 2] * 30000; } g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const kit = { site, group: new THREE.Group(), mats: [], pathT: -1e18 }, M = (color, o) => { const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 1, metalness: 0 }, o)); m.userData.base = new THREE.Color(color); kit.mats.push(m); return m; };
    kit.terrain = new THREE.Mesh(g, M(0xa9a59d, { vertexColors: true, map: this._detail, bumpMap: this._detail, bumpScale: 1e-7 })); kit.terrain.material.userData.base.multiplyScalar(2); kit.terrain.receiveShadow = true; kit.terrain.frustumCulled = false; kit.group.add(kit.terrain);
    const put = (obj, az, dkm, lift) => { obj.position.set(dkm * Math.sin(az) * K, (ter.height(az, dkm) - dkm * dkm / (2 * S.R_M)) * K + (lift || 0), -dkm * Math.cos(az) * K); kit.group.add(obj); };
    const rr = (() => { let a = site.seed * 77; return () => { a = Math.imul(a, 1664525) + 1013904223 | 0; return (a >>> 0) / 4294967296; }; })();
    const rockM = M(0x8d8982, { flatShading: true }), rg = new THREE.IcosahedronGeometry(1, 1);
    for (let i = 0; i < (site.noData ? 0 : 70); i++) { const m = new THREE.Mesh(rg, rockM), s = (0.15 + 0.7 * Math.pow(rr(), 3)) * 1e-6; m.scale.set(s * (0.7 + rr() * .6), s * (0.5 + rr() * .5), s * (0.7 + rr() * .6)); m.rotation.set(rr() * 6, rr() * 6, rr() * 6); m.castShadow = true; m.receiveShadow = true; put(m, rr() * 6.2832, 0.035 + 0.3 * Math.pow(rr(), 1.6), s * .2); }
    const ea = S.sky(this.time, site).earthAz, L = new THREE.Group(); L.scale.setScalar(1e-6); kit.landerAz = ea - 9;
    const foil = M(0xb9975a, { metalness: .55, roughness: .45 }), white = M(0xd8d8d4, { roughness: .6 }), add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; L.add(m); return m; };
    add(new THREE.CylinderGeometry(1.5, 1.8, 1.5, 8), foil, 0, 1.9, 0); add(new THREE.CylinderGeometry(.9, 1.4, 1, 8), white, 0, 3.1, 0);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .78, leg = add(new THREE.CylinderGeometry(.07, .07, 2.6, 5), white, Math.cos(a) * 2.1, .95, Math.sin(a) * 2.1); leg.rotation.set(Math.sin(a) * -.6, 0, Math.cos(a) * .6); add(new THREE.CylinderGeometry(.35, .35, .08, 8), white, Math.cos(a) * 2.75, .04, Math.sin(a) * 2.75); }
    add(new THREE.CylinderGeometry(.04, .04, 1.4, 4), white, .5, 4.2, 0); add(new THREE.SphereGeometry(.5, 12, 8, 0, 6.2832, 0, 1.1), white, .5, 4.9, 0).rotation.x = Math.PI;
    // same lander as in flight: two solar wings (turned to face the Sun at landing) and the descent engine
    const panel = M(0x0c1530, { metalness: .25, roughness: .45 }), frame = M(0x2c2e33, { metalness: .5, roughness: .55 });
    for (const sd of [-1, 1]) { add(new THREE.BoxGeometry(3.3, 1.5, .05), panel, sd * 3.35, 2.6, 0); add(new THREE.BoxGeometry(3.4, 1.6, .03), frame, sd * 3.35, 2.6, -.03); add(new THREE.CylinderGeometry(.05, .05, .9, 4), frame, sd * 1.6, 2.6, 0).rotation.z = Math.PI / 2; }
    add(new THREE.LatheGeometry([[.28, 1.15], [.34, 1.0], [.5, .78], [.62, .58]].map(([r, y]) => new THREE.Vector2(r, y)), 20), frame, 0, 0, 0);
    const sunAz = S.sky(this.time, site).sunAz; L.rotation.y = Math.PI - sunAz * D2R; // panel normal (local +z) towards the Sun
    put(L, kit.landerAz * D2R, 0.03); kit.lander = L; kit.landerHome = L.position.clone(); kit.landerYaw = L.rotation.y; kit.beamFrom = L.position.clone().add(new THREE.Vector3(0, 4.9e-6, 0));
    // descent engine: faint vacuum plume, a bright throat glow you can spot from kilometres away, and light on the ground
    const pg = new THREE.ConeGeometry(.9, 1, 16, 6, true); pg.translate(0, -.5, 0); const pc = new Float32Array(pg.attributes.position.count * 3);
    for (let i = 0; i < pg.attributes.position.count; i++) { const f = Math.pow(1 + pg.attributes.position.getY(i), 2.2); pc.set([f, f * .86, f * .7], i * 3); } pg.setAttribute('color', new THREE.BufferAttribute(pc, 3)); // bright at the nozzle, gone at the tip
    kit.plume = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); kit.plume.position.y = .6; L.add(kit.plume);
    kit.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.ship.material.map, color: 0xffe2bf, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 })); kit.glow.position.y = .5; L.add(kit.glow);
    kit.engLight = new THREE.PointLight(0xffc890, 0, 9e-5, 2); kit.engLight.position.y = -.5; L.add(kit.engLight);
    // lunar dust: no air, so it sprays out flat and fast in straight lines and is gone within seconds
    kit.dust = new Particles(700, 0xb5aea1, false, 1.4); kit.group.add(kit.dust.points);
    kit.beam = this._mkLine(2, BLUE, .9, kit.group); kit.sunPath = this._mkLine(140, GOLD, .4, kit.group); kit.earthPath = this._mkLine(140, BLUE, .45, kit.group);
    kit.group.visible = false; this.root.add(kit.group); this.kits.set(key, kit); return kit;
  }
  flyTo(scale, instant) {
    if (scale === this.scale && !instant) return; const from = this.scale; this.scale = scale;
    if (scale === 'surface') { this.surfaceView.yaw = null; this._userLook = false; this._settle = false; }
    if (scale === 'moon') this.aimMoon();
    if (instant || !this.ready) { this._fl = null; return; }
    const long = scale === 'surface' || from === 'surface';
    this._fl = { k: 0, dur: this.reduceMotion ? 0.35 : long ? 3.4 : 2.8, from, to: scale, d0: this.pose.pos.clone().sub(this._moonP || V3()), q0: this.pose.quat.clone(), fov0: this.pose.fov };
  }
  aimMoon() { this._aim = true; }
  lookAz(az) { this._yawGoal = az; }
  snap() { this._fl = null; this.followMix = this.follow ? 1 : 0; this._snapN = 4; }

  _place(t, site, lite) {
    const mp = S.moonPos(t), sp = S.sunPos(t), f = S.moonFrame(t), c = { t, site, moonP: v3(mp), sunP: v3(sp), f };
    this.moon.position.copy(c.moonP); this.moonC.position.copy(c.moonP);
    this.moon.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(d3(f.X), d3(f.Z), d3(f.Y).negate()));
    const eps = 23.44 * D2R; this.earth.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d3([0, Math.sin(eps), Math.cos(eps)])).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ((t / 86164090.5) % 1) * 6.2832));
    this.sun.position.copy(c.sunP); c.sunDir = c.sunP.clone().sub(c.moonP).normalize();
    if (site) { const sk = c.sk = S.sky(t, site); c.U = d3(sk.lf.U); c.E = d3(sk.lf.E); c.N = d3(sk.lf.N); c.siteP = c.moonP.clone().addScaledVector(c.U, RM); }
    const pl = this.plan;
    if (pl) { if (this._dirty) this._syncPlan(); c.shipP = v3(S.shipPos(pl, t)); this.ship.position.copy(c.shipP); }
    if (lite) return c;
    if (!this._ringT || Math.abs(t - this._ringT) > 2 * S.HOUR) { this._ringT = t; const a = this.ringL.geometry.attributes.position; for (let i = 0; i < 240; i++) { const p = S.moonPos(t + (i / 239 - .5) * 27.6 * S.DAY); a.setXYZ(i, p[0] * K, p[2] * K, -p[1] * K); } a.needsUpdate = true; }
    c.siteState = {}; const la = this.links.geometry.attributes.position; let n = 0;
    for (const sp2 of this.sitesG.children) { const s = sp2.userData.site, k = S.sky(t, s), w = c.moonP.clone().addScaledVector(d3(k.lf.U), RM * 1.003); c.siteState[s.id] = { lit: k.lit > .5, link: k.link, w, U: k.lf.U };
      sp2.material.color.setHex(k.lit > .5 ? GOLD : 0x6b6b6b); if (k.link && n < 40) { la.setXYZ(n * 2, w.x, w.y, w.z); la.setXYZ(n * 2 + 1, 0, 0, 0); n++; } }
    la.needsUpdate = true; this.links.geometry.setDrawRange(0, n * 2);
    if (pl) {
      const idx = (arr) => { let lo = 0, hi = arr.length - 1; if (t <= arr[0]) return 0; if (t >= arr[hi]) return hi; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (arr[m] <= t) lo = m; else hi = m; } return lo; };
      const lim = Math.max(2, Math.round(NE * this.drawFrac)), ke = Math.min(idx(this.te), lim - 1), kl = idx(this.tl), showL = this.drawFrac >= 1;
      this.doneE.geometry.setDrawRange(0, ke + 1); this.todoE.geometry.setDrawRange(ke, lim - ke); this.doneL.geometry.setDrawRange(0, kl + 1); this.todoL.geometry.setDrawRange(kl, NL - kl); this.doneL.visible = this.todoL.visible = showL;
      this.arrival.position.copy(this.arrivalP); this.arrival.visible = t < pl.tA - 2 * S.HOUR; // in the last hours the Moon itself is there
      const tr = this.trail.geometry.attributes.position, cd = c.shipP.distanceTo(this.pose.pos), sp3 = Math.max(S.shipSpeed(pl, t), .3), lunar0 = t > pl.tA, dt = Math.min(cd * 1000 * .35 / sp3 / 32 * 1000, lunar0 ? 60000 : 240000), lunar = t > pl.tA, m0 = lunar ? S.moonPos(t) : null;
      for (let i = 0; i < 32; i++) { const tt = Math.max(pl.launch, t - i * dt); let p = S.shipPos(pl, tt); if (lunar) p = S.V.add(S.V.sub(p, S.moonPos(tt)), m0); tr.setXYZ(i, p[0] * K, p[2] * K, -p[1] * K); }
      tr.needsUpdate = true; this.trail.visible = this.ship.visible = t < pl.tLand;
      const bn = S.burn(pl, t); c.burn = this.burnOverride != null ? bn.level * this.burnOverride : bn.level; if (bn.level > 0) {
        let vv = S.V.sub(S.shipPos(pl, t + 2000), S.shipPos(pl, t - 2000)); const moonRel = bn.kind === 'loi' || bn.kind === 'deorbit' || bn.kind === 'descent';
        if (moonRel) vv = S.V.sub(vv, S.V.sub(S.moonPos(t + 2000), S.moonPos(t - 2000)));
        const vd = d3(S.V.unit(vv));
        if (bn.kind === 'descent') { // braking with the engine forward, pitching up to vertical for the final approach
          const up = d3(S.V.unit(S.V.sub(S.shipPos(pl, t), S.moonPos(t)))), hor = vd.clone().addScaledVector(up, -vd.dot(up)), p = S.descentState(pl, t).pitch * D2R;
          if (hor.lengthSq() > 1e-12) hor.normalize(); c.plumeDir = up.multiplyScalar(-Math.sin(p)).addScaledVector(hor, Math.cos(p)).normalize();
        } else c.plumeDir = bn.kind === 'ascent' || bn.kind === 'tli' ? vd.negate() : vd;
      }
      this.tip.visible = this.drawFrac < 1 && this.drawFrac > 0; if (this.tip.visible) { const a2 = this.todoE.geometry.attributes.position, j = lim - 1; this.tip.position.set(a2.getX(j), a2.getY(j), a2.getZ(j)); }
    }
    return c;
  }
  _surfacePose(c, yaw, pitch, fov) {
    const y = yaw * D2R, p = pitch * D2R, fwd = c.E.clone().multiplyScalar(Math.sin(y) * Math.cos(p)).addScaledVector(c.N, Math.cos(y) * Math.cos(p)).addScaledVector(c.U, Math.sin(p));
    return { pos: c.siteP.clone().addScaledVector(c.U, 3e-6), quat: lookQ(V3(), fwd, c.U), fov };
  }
  _autoPose(c, pl) {
    const t = c.t, v = this.views.transit, sp = c.shipP, H = S.HOUR;
    const transit = () => { const dF = clamp(0.85 * Math.min(sp.length() - RE, sp.distanceTo(c.moonP) - RM) + 9, 9, 320) * v.zoom, pos = sp.clone().addScaledVector(v.dir, dF); return { pos, quat: lookQ(pos, sp, v.up), fov: 42 }; };
    const moon = () => { const g = c.U.clone().addScaledVector(c.sunDir, .28).addScaledVector(c.moonP.clone().negate().normalize(), .12).normalize(); let up = d3(c.f.Z); if (Math.abs(up.dot(g)) > .85) up = c.moonP.clone().negate().normalize(); up.addScaledVector(g, -up.dot(g)).normalize(); const pos = c.moonP.clone().addScaledVector(g, 5.6); return { pos, quat: lookQ(pos, c.moonP, up), fov: 42 }; };
    const surf = () => this._surfacePose(c, this.defaultYaw(c.sk) + this.compareView.yawOff - 18, this.compareView.pitch, 50);
    const mix = (a, b, k, toSurf) => { const e = ease(clamp(k, 0, 1)), d0 = a.pos.clone().sub(c.moonP), d1 = b.pos.clone().sub(c.moonP), a0 = Math.max(d0.length() - RM, 2e-6), a1 = Math.max(d1.length() - RM, 2e-6), alt = Math.exp(Math.log(a0) + (Math.log(a1) - Math.log(a0)) * e); return { pos: c.moonP.clone().addScaledVector(slerpDir(d0.normalize(), d1.normalize(), e), RM + alt), quat: a.quat.clone().slerp(b.quat, toSurf ? e * e * e : e), fov: a.fov + (b.fov - a.fov) * e }; };
    if (t < pl.tA - 3 * H) return transit();
    if (t < pl.tA) return mix(transit(), moon(), (t - (pl.tA - 3 * H)) / (3 * H));
    if (t < pl.tLand - .5 * H) return moon();
    if (t < pl.tLand) return mix(moon(), surf(), (t - (pl.tLand - .5 * H)) / (.5 * H), true);
    return surf();
  }
  defaultYaw(sk) { const hf = Math.atan(Math.tan(23 * D2R) * (this.w / this.h)) / D2R; return sk.earthAz - 9 - (hf > 25 ? 14 : -4.5); }
  /** Seconds before touchdown during which the ground camera shows the lander coming down. */
  static LAND_VIS = 260;
  /** Descending lander in the site kit's local frame (x east, y up, z south; scene units): offset from its landing spot and nose direction. */
  _landerLocal(c, t) {
    const pl = this.plan, lf = c.sk.lf, rel = tt => S.V.sub(S.V.sub(S.shipPos(pl, tt), S.moonPos(tt)), S.V.mul(S.siteNormal(tt, pl.site), S.R_M));
    const loc = r => new THREE.Vector3(S.V.dot(r, lf.E) * K, S.V.dot(r, lf.U) * K, -S.V.dot(r, lf.N) * K);
    const off = t < pl.tLand ? loc(rel(t)) : V3(), v = t < pl.tLand ? loc(rel(t + 500)).sub(loc(rel(t - 500))) : V3();
    const p = S.descentState(pl, t).pitch * D2R, hor = new THREE.Vector3(v.x, 0, v.z);
    const nose = hor.lengthSq() > 1e-18 && t < pl.tLand ? hor.normalize().multiplyScalar(-Math.cos(p)).add(new THREE.Vector3(0, Math.sin(p), 0)).normalize() : new THREE.Vector3(0, 1, 0);
    return { off, nose };
  }
  // Ground camera during the landing: a telephoto shot that finds the engine glow kilometres away, tracks the lander as
  // it pitches up and comes down, widens as it nears, holds on touchdown, then eases back to the usual framing.
  _landingCam(c, dt) {
    const pl = this.plan, sv = this.surfaceView, dtl = pl && c.site === pl.site ? (c.t - pl.tLand) / 1000 : 1e9;
    const on = !this.compare && !this._userLook && dtl > -LunarScene.LAND_VIS && dtl < 14;
    if (on) {
      const kit = this.kitFor(c.site), d = kit.landerHome.clone().add(this._landerLocal(c, c.t).off).add(new THREE.Vector3(0, 2.4e-6 - 3e-6, 0));
      const hd = Math.hypot(d.x, d.z), dist = d.length(), yaw = Math.atan2(d.x, -d.z) / D2R, pitch = Math.atan2(d.y, hd) / D2R;
      // telephoto while it is far; in the last minute the lens widens so the horizon and the dust come into the shot
      // the lens is as long as it can be while the horizon stays at the bottom of the frame; it widens as the lander nears
      const fovGoal = clamp(Math.max(5e-6 / dist / D2R / 0.07, pitch / 0.52 + 1), 9, 46), first = !this._landCam, g = first || this.reduceMotion || this._snapN > 0 ? 1 : 1 - Math.exp(-dt * 5);
      sv.yaw += ((((yaw - sv.yaw) % 360) + 540) % 360 - 180) * g; sv.fov += (fovGoal - sv.fov) * g;
      const pGoal = Math.max(pitch - 0.36 * sv.fov, Math.min(pitch - 0.2 * sv.fov, 0.32 * sv.fov)); // lander just above centre, horizon in frame when possible
      sv.pitch += (clamp(pGoal, -25, 80) - sv.pitch) * g;
      this._landCam = true; this._yawGoal = null;
    } else if (this._landCam) {
      this._landCam = false; this._settle = true;
      if (!this._userLook) this._yawGoal = this.w / this.h < .8 ? this.kitFor(c.site).landerAz : this.defaultYaw(c.sk);
    }
    if (this._settle && !on) {
      const g = this.reduceMotion ? 1 : 1 - Math.exp(-dt * 1.6), pg = this.w / this.h < .8 ? -7 : 4;
      sv.pitch += (pg - sv.pitch) * g; sv.fov += (46 - sv.fov) * g;
      if (Math.abs(sv.fov - 46) < .05 && Math.abs(sv.pitch - pg) < .05) this._settle = false;
    }
  }
  _target(c, dt) {
    const m = this.scale; if (m !== 'transit') this.povMix = 0;
    if (m === 'surface') { const sv = this.surfaceView; if (sv.yaw == null) { sv.yaw = this.defaultYaw(c.sk); if (this.w / this.h < .8) { sv.yaw = this.kitFor(c.site).landerAz; sv.pitch = -7; } }
      this._landingCam(c, dt);
      if (this._yawGoal != null) { const df = ((this._yawGoal - sv.yaw + 540) % 360) - 180; sv.yaw += df * (this.reduceMotion || this._snapN > 0 ? 1 : 1 - Math.exp(-dt * 4)); if (Math.abs(df) < .3) this._yawGoal = null; } return this._surfacePose(c, sv.yaw, sv.pitch, sv.fov); }
    if (m === 'moon') { const v = this.views.moon;
      if (this._aim && c.U) { this._aim = false; const g = c.U.clone().addScaledVector(c.sunDir, .28).addScaledVector(c.moonP.clone().negate().normalize(), .12).normalize(); let up = d3(c.f.Z); if (Math.abs(up.dot(g)) > .85) up = c.moonP.clone().negate().normalize(); this._goal = { dir: g, up: up.addScaledVector(g, -up.dot(g)).normalize() }; }
      if (this._goal) { const k = this._fl || this._snapN > 0 ? 1 : 1 - Math.exp(-dt * 3.5); v.dir.copy(slerpDir(v.dir, this._goal.dir, k)); v.up.lerp(this._goal.up, k).addScaledVector(v.dir, -v.up.dot(v.dir)).normalize(); if (v.dir.dot(this._goal.dir) > .99999) this._goal = null; }
      const pos = c.moonP.clone().addScaledVector(v.dir, 5.6 * v.zoom); return { pos, quat: lookQ(pos, c.moonP, v.up), fov: 42 }; }
    const v = this.views.transit, sp = c.shipP || V3(), arr = this.arrivalP || c.moonP;
    this.followMix += ((this.follow ? 1 : 0) - this.followMix) * (this.reduceMotion ? 1 : 1 - Math.exp(-dt * 3));
    const fm = ease(clamp(this.followMix, 0, 1)), target = arr.clone().multiplyScalar(.5).lerp(sp, fm);
    const dF = clamp(0.85 * Math.min(sp.length() - RE, sp.distanceTo(c.moonP) - RM) + 9, 9, 320), dist = Math.exp(Math.log(arr.length() * 1.5) * (1 - fm) + Math.log(dF) * fm) * v.zoom;
    const pos = target.clone().addScaledVector(v.dir, dist), pose = { pos, quat: lookQ(pos, target, v.up), fov: 42 }, pl = this.plan;
    this.povMix = (this.povMix || 0) + ((this.pov && pl && c.t < pl.tLand ? 1 : 0) - (this.povMix || 0)) * (this.reduceMotion || this._snapN > 0 ? 1 : 1 - Math.exp(-dt * 2.5));
    if (this.povMix > .002 && pl) {
      const nearE = sp.length() < sp.distanceTo(c.moonP), ctr = nearE ? V3() : c.moonP, up = sp.clone().sub(ctr).normalize(), alt = Math.max(sp.distanceTo(ctr) - (nearE ? RE : RM), 0);
      let vv = S.V.sub(S.shipPos(pl, c.t + 2000), S.shipPos(pl, c.t - 2000)); if (!nearE) vv = S.V.sub(vv, S.V.sub(S.moonPos(c.t + 2000), S.moonPos(c.t - 2000)));
      let fwd = d3(vv); fwd.addScaledVector(up, -fwd.dot(up)); if (fwd.length() < 1e-7) fwd = this._povF ? this._povF.clone() : V3().crossVectors(up, new THREE.Vector3(0, 1, 0)); fwd.normalize(); this._povF = fwd.clone();
      // near the lunar surface the chase camera closes in to a few tens of metres, so the lander is seen at its real size
      // against the LOLA terrain instead of the oversized marker used in deep space
      const near = this._povNear = nearE ? 0 : smooth(0.03, 0.002, alt);
      const back = (0.012 + alt * .9) * (1 - near) + (0.00003 + alt * 0.03) * near, h = (0.004 + alt * .35) * (1 - near) + (0.00001 + alt * 0.012) * near, pp = sp.clone().addScaledVector(up, h).addScaledVector(fwd, -back), look = sp.clone().addScaledVector(fwd, back * 1.6).addScaledVector(up, -h * .5), e = ease(clamp(this.povMix, 0, 1));
      pose.pos.lerp(pp, e); pose.quat.slerp(lookQ(pp, look, up), e); pose.fov = 42 + 12 * e;
    }
    return pose;
  }
  _draw(c, pose, mixS, rect, main) {
    const R = this.renderer, cam = this.cam; this.root.position.copy(pose.pos).negate(); cam.quaternion.copy(pose.quat); cam.fov = pose.fov; cam.aspect = rect.w / rect.h; cam.updateProjectionMatrix();
    const focus = (mixS > 0 ? c.siteP : c.moonP).clone().sub(pose.pos), sd = c.sunP.clone().sub(mixS > 0 ? c.siteP : c.moonP).normalize();
    this.sunLight.target.position.copy(focus); this.sunLight.position.copy(focus).addScaledVector(sd, mixS > .5 ? 0.004 : 100); this.sunLight.castShadow = mixS > .5; this.sunLight.target.updateMatrixWorld();
    this.moonMesh.scale.setScalar(1 - 0.004 * mixS); const altE = pose.pos.length() - RE; this.earth.children[0].material.opacity = .06 + .34 * smooth(.3, 4, altE); if (this.earth.material.userData.dAmt) this.earth.material.userData.dAmt.value = 1 - smooth(.5, 2, pose.pos.length() - RE);
    const camMoon = pose.pos.distanceTo(c.moonP), aMoon = (1 - smooth(14, 60, camMoon)) * (1 - mixS) * (1 - (this.povMix || 0)), far = mixS < .9 && !(this.compare && this.compareMode === 'surface');
    this.transitG.visible = far; this.moonC.visible = far; this.ship.visible = this.ship.visible && (far || (this.povMix || 0) > .5); this.trail.visible = this.trail.visible && far && (this.povMix || 0) < .5; // onboard, the craft stays in view down to the surface; its trail (seen edge-on) does not
    const nearK = smooth(20, 90, camMoon), arrived = this.plan && c.t > this.plan.tA ? nearK : 1; this.ringL.material.opacity = .13 * nearK * (1 - (this.povMix || 0)); /* hidden onboard: seen edge-on it is a stray line */ const pv = 1 - (this.povMix || 0); this.doneE.material.opacity = .95 * arrived * pv; this.doneL.material.opacity = .95 * pv; this.todoL.material.opacity = .26 * pv; this.todoE.material.opacity = .26 * arrived * pv; this.sitesG.visible = aMoon > .01; this.links.visible = aMoon > .01; this.links.material.opacity = .42 * aMoon;
    if (main) {
      for (const sp of this.sitesG.children) { const s = sp.userData.site, st = c.siteState[s.id], d = st.w.distanceTo(pose.pos), hot = s.id === this.selectedId || (this.hover && this.hover.site === s);
        const facing = d3(st.U).dot(pose.pos.clone().sub(st.w).normalize()); sp.scale.setScalar(d * (hot ? .034 : .02)); sp.material.opacity = aMoon * smooth(-.05, .12, facing) * (st.lit ? 1 : .75); }
      if (c.shipP) { const dd = c.shipP.distanceTo(pose.pos), b = c.burn || 0; this.ship.scale.setScalar(dd * (.03 + .035 * b)); this.ship.material.color.setHex(b > .1 ? 0xffd9a8 : 0xffffff); this.plume.visible = b > .02 && this.ship.visible; this.plume.position.copy(c.shipP); if (c.plumeDir) this.plume.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), c.plumeDir); this.plume.scale.set(dd * .016 * b + 1e-9, dd * .16 * b + 1e-9, dd * .016 * b + 1e-9); this.plume.material.opacity = .28 * b; this.arrival.material.opacity = .7 * (1 - (this.povMix || 0)); this.tip.scale.setScalar(this.tip.position.distanceTo(pose.pos) * .07); if (this.ghostArrP) { this.ghostArr.position.copy(this.ghostArrP); this.ghostArr.scale.setScalar(this.ghostArrP.distanceTo(pose.pos) * .035); this.ghostArr.material.opacity = .65 * this.ghostAlpha; } else this.ghostArr.material.opacity = 0; }
      if (this.arrivalP) this.arrival.scale.setScalar(this.arrivalP.distanceTo(pose.pos) * .035);
      this._updateCraft(c, pose);
      this.ghostL.material.opacity = .5 * this.ghostAlpha; this.altL.forEach((l, i) => { l.material.opacity = i < this.alts.length ? .3 * this.altAlpha : 0; });
    }
    for (const k of this.kits.values()) k.group.visible = false;
    if (mixS > 0 && c.site) {
      const k = this.kitFor(c.site), sk = c.sk; k.group.visible = true; k.group.position.copy(c.siteP); k.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(c.E, c.U, c.N.clone().negate()));
      const es = sk.link ? 0.016 : 0.006; const gain = clamp(0.1 / Math.max(Math.sin(Math.max(sk.sunEl, .3) * D2R), .01), 1, 2.6); for (const m of k.mats) { m.color.copy(m.userData.base).multiplyScalar(sk.lit * (mixS < .999 ? 1 : m === k.terrain.material ? gain : Math.min(gain, 1.4))); m.emissive.setRGB(es * .7, es * .85, es * 1.15); m.transparent = mixS < 1; m.opacity = mixS; }
      const mine = this.plan && this.plan.site === c.site, dtl = mine ? (c.t - this.plan.tLand) / 1000 : 1e9;
      const groundCam = (this.scale === 'surface' || this.compare) && (this.povMix || 0) < .5, descending = mine && groundCam && dtl < 0 && dtl > -LunarScene.LAND_VIS;
      k.lander.visible = mixS > .5 && (dtl >= 0 || descending); k.sunPath.visible = k.earthPath.visible = mixS > .999; k.beam.visible = mixS > .999 && dtl >= 0;
      this._updateLanding(k, c, pose, descending ? dtl : null, sk);
      const bf = k.beamNow || k.beamFrom, b = k.beam.geometry.attributes.position, e = localDir(sk.earthAz, sk.earthEl).multiplyScalar(380).add(bf);
      b.setXYZ(0, bf.x, bf.y, bf.z); b.setXYZ(1, e.x, e.y, e.z); b.needsUpdate = true; k.beam.material.color.setHex(sk.link ? BLUE : 0x777777); k.beam.material.opacity = (sk.link ? .95 : .45) * mixS;
      if (Math.abs(c.t - k.pathT) > S.HOUR / 2) { k.pathT = c.t; const a = k.sunPath.geometry.attributes.position, a2 = k.earthPath.geometry.attributes.position;
        for (let i = 0; i < 140; i++) { const s1 = S.sky(c.t + i / 139 * 12 * S.DAY, c.site), s2 = S.sky(c.t + i / 139 * 27.3 * S.DAY, c.site), p1 = localDir(s1.sunAz, s1.sunEl).multiplyScalar(900), p2 = localDir(s2.earthAz, s2.earthEl).multiplyScalar(300); a.setXYZ(i, p1.x, p1.y, p1.z); a2.setXYZ(i, p2.x, p2.y, p2.z); }
        a.needsUpdate = a2.needsUpdate = true; }
      k.sunPath.material.opacity = .4 * mixS; k.earthPath.material.opacity = .5 * mixS;
    }
    const H = this.h; R.setViewport(rect.x, H - rect.y - rect.h, rect.w, rect.h); R.setScissor(rect.x, H - rect.y - rect.h, rect.w, rect.h); R.setScissorTest(true); R.clear(); R.render(this.scene, cam);
  }
  project(p, pose, rect) {
    pose = pose || this.pose; rect = rect || { x: 0, y: 0, w: this.w, h: this.h };
    const v = p.clone().sub(pose.pos).applyQuaternion(pose.quat.clone().invert()), th = Math.tan(pose.fov * D2R / 2), d = -v.z;
    return { x: rect.x + rect.w / 2 * (1 + v.x / (d * th * rect.w / rect.h)), y: rect.y + rect.h / 2 * (1 - v.y / (d * th)), vis: d > 0, d: v.length(), pxPer: rect.h / 2 / (Math.abs(d) * th) };
  }
  _loop(now) {
    this._raf = requestAnimationFrame(this._loop); const dt = Math.min(.1, (now - this._last) / 1000); this._last = now; this.step(dt);
  }
  step(dt) {
    this._dt = dt;
    if (this.onTick) this.onTick(dt); if (!this.plan && !this.site) return; if (this._snapN > 0) this._snapN--;
    const full = { x: 0, y: 0, w: this.w, h: this.h }; this.renderer.setScissorTest(false); this.renderer.clear();
    if (this.compare && this.compare.length && this.compareRects.length) {
      if (this._skyOn) { this.renderer.setClearColor(0x000000); this.stars.material.opacity = 1; this._skyOn = false; }
      const mainPlan = this.plan; this.compare.forEach((pn, i) => { const rc = this.compareRects[i]; if (!rc || rc.w < 4) return; if (this.compareMode === 'auto' && pn.plan) { this.plan = pn.plan; this._dirty = true; const c3 = this._place(pn.t, pn.plan.site, false), ps = this._autoPose(c3, pn.plan), al = ps.pos.distanceTo(c3.moonP) - RM; this._draw(c3, ps, al < .07 && ps.pos.distanceTo(c3.siteP) < .3 ? 1 - smooth(0.004, 0.07, al) : 0, rc, true); return; } if (this.compareMode === 'route' && pn.plan) { this.plan = pn.plan; this._dirty = true; const c2 = this._place(pn.t, pn.plan.site, false), v = this.views.transit, tgt = this.arrivalP.clone().multiplyScalar(.5), pos = tgt.clone().addScaledVector(v.dir, this.arrivalP.length() * 1.5 * v.zoom * Math.max(1, 1.3 / (rc.w / rc.h))); this._draw(c2, { pos, quat: lookQ(pos, tgt, v.up), fov: 42 }, 0, rc, true); return; } const c = this._place(pn.t, pn.site, true);
        this._draw(c, this._surfacePose(c, c.sk.sunAz + this.compareView.yawOff, this.compareView.pitch, 50), 1, rc, false); }); if (mainPlan && this.plan !== mainPlan) { this.plan = mainPlan; this._dirty = true; }
      return;
    }
    const c = this._place(this.time, this.site, false); this._moonP = c.moonP; let pose = this._target(c, dt); const fl = this._fl;
    if (fl) { fl.k = Math.min(1, fl.k + dt / fl.dur); const e = ease(fl.k), d1 = pose.pos.clone().sub(c.moonP), a0 = Math.max(fl.d0.length() - RM, 2e-6), a1 = Math.max(d1.length() - RM, 2e-6);
      const alt = Math.exp(Math.log(a0) + (Math.log(a1) - Math.log(a0)) * e), dir = slerpDir(fl.d0.clone().normalize(), d1.clone().normalize(), e), er = fl.to === 'surface' ? e * e * e : fl.from === 'surface' ? 1 - Math.pow(1 - e, 3) : e;
      pose = { pos: c.moonP.clone().addScaledVector(dir, RM + alt), quat: fl.q0.clone().slerp(pose.quat, er), fov: fl.fov0 + (pose.fov - fl.fov0) * e }; if (fl.k >= 1) this._fl = null; }
    pose = this._shake(pose, c);
    this.pose = pose; this._sky(pose, c);
    // the site terrain (radius 160 km) fades in with height and, when flying in onboard, with distance to the site
    const alt = pose.pos.distanceTo(c.moonP) - RM, atSite = this.scale === 'surface' || (fl && fl.from === 'surface'), nearSite = c.siteP && this.plan && c.site === this.plan.site ? 1 - smooth(0.12, 0.2, pose.pos.distanceTo(c.siteP)) : 0;
    this.surfaceMix = (1 - smooth(0.004, 0.07, alt)) * (atSite ? 1 : nearSite); this._draw(c, pose, this.surfaceMix, full, true);
    const A = this.anchors, proj = (p, r) => { const q = this.project(p); q.r = r ? r * q.pxPer : 0; return q; };
    A.earth = proj(V3(), RE); A.moon = proj(c.moonP, RM); A.sun = proj(c.sunP, 696); if (c.shipP) A.ship = proj((this.povMix || 0) > .5 && this.craftG && this.craftG.visible ? c.shipP.clone().addScaledVector(new THREE.Vector3(1, 0, 0).applyQuaternion(pose.quat), (this._craftScale || 0) * 0.32) : c.shipP); A.arrival = this.arrivalP && this.plan && c.t < this.plan.tA - 2 * S.HOUR ? proj(this.arrivalP) : null; A.ghostArrival = this.ghostArrP && this.ghostAlpha > .08 ? proj(this.ghostArrP) : null;
    A.sites = {}; const aM = this.sitesG.visible; for (const id in c.siteState) { const st = c.siteState[id], q = proj(st.w); q.vis = q.vis && aM && d3(st.U).dot(pose.pos.clone().sub(st.w)) > 0; q.lit = st.lit; q.link = st.link; A.sites[id] = q; }
    A.alts = this.alts.map((p, i) => { const a = this.altL[i].geometry.attributes.position, j = 215 + i * 45; return proj(new THREE.Vector3(a.getX(j), a.getY(j), a.getZ(j))); });
    if (this.surfaceMix > .5) { const k = this.kitFor(this.site); A.lander = proj(k.beamFrom.clone().applyQuaternion(k.group.quaternion).add(k.group.position)); } else A.lander = null;
    A.sky = c.sk; A.flying = !!this._fl; A.surfaceMix = this.surfaceMix; A.camMoon = pose.pos.distanceTo(c.moonP); if (A.ship) A.ship.landed = !!this.plan && this.time >= this.plan.tLand;
    if (this.onFrame) this.onFrame(A, dt);
  }
  // ---------- the lander coming down at the site, seen from the ground: pose, engine, light on the terrain, dust
  _updateLanding(k, c, pose, dtl, sk) {
    const L = k.lander, dt = Math.min(this._dt || 0.016, 0.1), pl = this.plan;
    let level = 0;
    if (dtl != null) {
      const ll = this._landerLocal(c, c.t); L.position.copy(k.landerHome).add(ll.off);
      L.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ll.nose).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), k.landerYaw));
      level = this.burnOverride != null ? 0 : S.burn(pl, c.t).level;
    } else {
      const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), k.landerYaw);
      // real case (IM-2 Athena): a few seconds after contact the lander tips over onto its side, pivoting on two feet
      const since = pl && pl.site === c.site ? (c.t - pl.tLand) / 1000 : -1, tip = this.tipCase && since > 0 ? 1.4 * smooth(3, 9, since) * smooth(3, 9, since) : 0;
      if (tip > 0) {
        const q = qy.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), tip)), P = new THREE.Vector3(-1.95, 0, 0);
        L.quaternion.copy(q); L.position.copy(k.landerHome).add(P.clone().applyQuaternion(qy).multiplyScalar(1e-6)).sub(P.clone().applyQuaternion(q).multiplyScalar(1e-6));
        k.beamNow = new THREE.Vector3(0.5, 4.9, 0).applyQuaternion(q).multiplyScalar(1e-6).add(L.position); // the antenna went over with it
      } else { L.position.copy(k.landerHome); L.quaternion.copy(qy); k.beamNow = null; }
    }
    const flick = 0.85 + 0.15 * Math.random(), altM = (L.position.y - k.landerHome.y) / 1e-6;
    const camD = c.siteP.clone().add(L.position.clone().applyQuaternion(k.group.quaternion)).distanceTo(pose.pos) / 1e-6;
    k.plume.visible = level > 0.01; k.plume.scale.set(level * 1.3, level * 11 * flick, level * 1.3); k.plume.material.opacity = 0.55 * level;
    k.glow.visible = level > 0.01; k.glow.scale.setScalar(Math.max(5, camD * 0.018) * level * flick); k.glow.material.opacity = 0.95 * level;
    k.engLight.intensity = 3 * level * flick;
    // dust: sprays out flat and fast below ~40 m, stops the instant the engine cuts (no air to keep it up)
    const D = k.dust;
    if (level > 0.01 && altM < 40) {
      const n = Math.round(22 * (1 - altM / 40) * level);
      for (let i = 0; i < n; i++) { const a = Math.random() * 6.2832, r = Math.random() * 2.5e-6, v = (14 + 30 * Math.random()) * 1e-6;
        D.emit(L.position.x + Math.cos(a) * r, k.landerHome.y + 0.25e-6, L.position.z + Math.sin(a) * r, Math.cos(a) * v, (0.2 + 1.6 * Math.random()) * 1e-6, Math.sin(a) * v, 0.9 + 1.4 * Math.random(), (0.8 + 1.6 * Math.random()) * 1e-6, 5); }
    }
    D.mat.uniforms.uScale.value = 1; D.mat.uniforms.uPx.value = this.h * this.renderer.getPixelRatio() / (2 * Math.tan(pose.fov * D2R / 2));
    D.update(dt, 0.55 * (0.3 + 0.7 * sk.lit));
  }
  // Earth's sky during the climb: blue (or night navy) at the pad, fading to black by ~75 km while the stars come out
  _sky(pose, c) {
    const altE = pose.pos.length() - RE, atm = 1 - smooth(0.006, 0.075, altE);
    if (atm <= 0.001) { if (this._skyOn) { this.renderer.setClearColor(0x000000); this.stars.material.opacity = 1; this._skyOn = false; } return; }
    const up = pose.pos.clone().normalize(), day = smooth(-0.12, 0.08, c.sunP.clone().normalize().dot(up));
    const col = (this._skyN || (this._skyN = new THREE.Color(0x0a1a38))).clone().lerp(this._skyD || (this._skyD = new THREE.Color(0x4a86cf)), day).multiplyScalar(atm);
    this.renderer.setClearColor(col); this.stars.material.transparent = true; this.stars.material.opacity = 1 - atm * (0.35 + 0.65 * day); this._skyOn = true;
  }
  // ---------- detailed spacecraft (rocket that stages in flight, then the lander), engine light, exhaust, smoke
  _buildCraft() {
    this.craftG = new THREE.Group(); this.rocket = buildRocket(); this.landerM = buildLander(1); deployLander(this.landerM, 1);
    this.craftG.add(this.rocket, this.landerM); this.root.add(this.craftG);
    this.engineLight = new THREE.PointLight(0xffa64d, 0, 1e-9, 2); this.craftG.add(this.engineLight);
    this.exhaust = new Particles(260, 0xffb766, true, 1.2); this.craftG.add(this.exhaust.points);
    this.smoke = new Particles(400, 0x6f6c68, false, 2); this.root.add(this.smoke.points);
    this._axis = new THREE.Vector3(0, 1, 0); this._craftScale = 0; this.craftG.visible = false;
  }
  _updateCraft(c, pose) {
    const pl = this.plan, dt = Math.min(this._dt || 0.016, 0.1), G = this.craftG;
    if (!pl || !c.shipP || this.compare) { G.visible = false; return; }
    const t = c.t, tau = t - pl.launch, rocketOn = t < pl.tTLI + 240e3, pov = this.povMix || 0;
    G.visible = this.ship.visible && t >= pl.launch;
    if (!G.visible) { this.exhaust.update(dt, 0); this.smoke.update(dt, .55); return; }
    // orientation: engine opposite to thrust while burning, otherwise along the velocity
    const lunar = t > pl.tA, vel = S.V.sub(S.shipPos(pl, t + 2000), S.shipPos(pl, t - 2000)), rel = lunar ? S.V.sub(vel, S.V.sub(S.moonPos(t + 2000), S.moonPos(t - 2000))) : vel;
    let ax = d3(S.V.unit(rel)); if (c.burn > 0 && c.plumeDir) ax = c.plumeDir.clone().negate();
    if (tau < 20e3) ax = c.shipP.clone().normalize().lerp(ax, smooth(4e3, 20e3, tau)).normalize(); // lift off vertically
    this._axis.lerp(ax, this._snapN > 0 || this.reduceMotion ? 1 : 1 - Math.exp(-dt * 6)).normalize();
    G.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this._axis);
    const dd = c.shipP.distanceTo(pose.pos), s = dd * (0.05 + 0.17 * pov) * (rocketOn ? 1 : 5.2) * (1 - 0.74 * pov * (this._povNear || 0)); this._craftScale = s;
    G.scale.setScalar(s);
    this.rocket.visible = rocketOn; this.landerM.visible = !rocketOn;
    let engineY = 0;
    if (rocketOn) engineY = stageRocket(this.rocket, tau, t > pl.tTLI ? t - pl.tTLI : null);
    else { engineY = -0.026; deployLander(this.landerM, 1); }
    const centre = rocketOn ? (tau < 510e3 ? 0.5 : 0.7) : 0.03;
    G.position.copy(c.shipP).addScaledVector(this._axis, -centre * s);
    const b = c.burn || 0, eng = new THREE.Vector3(0, engineY, 0), engW = G.localToWorld(eng.clone()).sub(this.root.position);
    // the sprite glow becomes the engine glow; the plume starts at the engine
    this.ship.material.opacity = 1 - 0.9 * pov; this.ship.scale.multiplyScalar(0.6 - 0.25 * pov);
    if (this.plume.visible) { this.plume.position.copy(engW); const k = s * (rocketOn ? 1 : 0.3); this.plume.scale.set(k * .09 * b + 1e-9, k * (.8 + .5 * (tau < 150e3 ? 1 : 0)) * b + 1e-9, k * .09 * b + 1e-9); }
    this.engineLight.position.copy(eng).add(new THREE.Vector3(0, -0.04, 0)); this.engineLight.intensity = 3 * b; this.engineLight.distance = s * 0.9; this.engineLight.decay = 2; // lights the vehicle only
    // exhaust (moves with the ship, model units) and smoke trail (stays in the sky, world units) while low in the atmosphere
    const local = rocketOn ? 1 : 0.18;
    if (b > 0.05) for (let i = 0; i < 6; i++) this.exhaust.emit((Math.random() - .5) * .02 * local, engineY - 0.01 * local, (Math.random() - .5) * .02 * local, (Math.random() - .5) * .25 * local, -(1.6 + Math.random()) * local, (Math.random() - .5) * .25 * local, 0.18 + Math.random() * 0.15, (0.05 + Math.random() * 0.05) * local, 2);
    this.exhaust.mat.uniforms.uScale.value = s; this.exhaust.mat.uniforms.uPx.value = this.h * this.renderer.getPixelRatio() / (2 * Math.tan(pose.fov * D2R / 2));
    this.exhaust.update(dt, b > 0 ? 0.9 : 0.9);
    const alt = c.shipP.length() - RE;
    if (b > 0.05 && tau > 500 && tau < 160e3 && alt < 0.08) for (let i = 0; i < 1; i++) { const r = () => (Math.random() - .5) * s * 0.03; this.smoke.emit(engW.x + r(), engW.y + r(), engW.z + r(), r() * .4, r() * .4, r() * .4, 2.5 + Math.random() * 2, s * (0.025 + Math.random() * 0.02), 3); }
    this.smoke.mat.uniforms.uScale.value = 1; this.smoke.mat.uniforms.uPx.value = this.exhaust.mat.uniforms.uPx.value;
    this.smoke.update(dt, .2);
  }
  // camera shake at liftoff and touchdown (onboard / surface views only)
  _shake(pose, c) {
    const pl = this.plan; if (!pl || this.reduceMotion || this.compare) return pose;
    const tau = (c.t - pl.launch) / 1000, td = (c.t - pl.tLand) / 1000;
    let a = 0;
    if ((this.povMix || 0) > .3 && tau >= 0 && tau < 50) a = (this._craftScale || 0) * 0.02 * (1 - tau / 50) * (tau < 3 ? tau / 3 : 1);
    if (this.surfaceMix > .5 && td >= -5 && td < 12) a = Math.max(a, 2e-7 * (1 - Math.abs(td) / 12));
    if (a <= 0) return pose;
    const j = new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(a);
    return { pos: pose.pos.clone().add(j), quat: pose.quat, fov: pose.fov };
  }
  _resize() { const p = this.canvas.parentElement; this.w = p.clientWidth || 1; this.h = p.clientHeight || 1; this.renderer.setSize(this.w, this.h, false); this.canvas.style.width = this.w + 'px'; this.canvas.style.height = this.h + 'px'; }
  _pick(x, y) {
    const A = this.anchors; let best = null, bd = 18;
    if (!this.compare && this.scale !== 'surface') for (const s of this.sites) { const q = A.sites[s.id]; if (!q || !q.vis) continue; const d = Math.hypot(q.x - x, q.y - y); if (d < bd) { bd = d; best = { type: 'site', site: s, x: q.x, y: q.y, r: 10 }; } }
    if (best || this.compare) return best;
    for (const k of ['ship', 'earth', 'moon', 'sun']) { const q = A[k]; if (!q || !q.vis || (k === 'ship' && q.landed)) continue; const r = Math.max(q.r || 0, 16); if (r < 400 && Math.hypot(q.x - x, q.y - y) < r) return { type: k, x: q.x, y: q.y, r: Math.max(q.r || 0, 10) }; }
    return null;
  }
  _bind() {
    // one finger / mouse drags the camera; two fingers pinch to zoom (same zoom as the mouse wheel)
    const el = this.canvas, pts = new Map(); let drag = null, pinch = null;
    const spread = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
    this._ro = new ResizeObserver(() => this._resize()); this._ro.observe(el.parentElement);
    el.addEventListener('pointerdown', e => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); el.setPointerCapture(e.pointerId);
      if (pts.size >= 2) { pinch = { d: spread() }; drag = null; if (this.hover) { this.hover = null; this.onHover?.(null); } return; }
      drag = { x: e.clientX, y: e.clientY, moved: 0 };
    });
    el.addEventListener('pointermove', e => {
      if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pts.size >= 2) { const d = spread(); this._zoomBy(pinch.d / d); pinch.d = d; return; }
      const b = el.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
      if (!drag) { const h = this._pick(x, y); if ((h && h.type) !== (this.hover && this.hover.type) || (h && h.site) !== (this.hover && this.hover.site)) { this.hover = h; this.onHover?.(h); } el.style.cursor = h ? 'pointer' : 'grab'; return; }
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
      if (this.compare && this.compareMode !== 'route') { this.compareView.yawOff -= dx * .12; this.compareView.pitch = clamp(this.compareView.pitch + dy * .12, -20, 60); if (this.compareMode === 'auto') { const v = this.views.transit, right = V3().crossVectors(v.up, v.dir).normalize(); v.dir.applyAxisAngle(v.up, -dx * .005).applyAxisAngle(right, -dy * .005).normalize(); v.up.applyAxisAngle(right, -dy * .005); v.up.addScaledVector(v.dir, -v.up.dot(v.dir)).normalize(); } }
      else if (this.scale === 'surface' && !this.compare) { const sv = this.surfaceView, k = sv.fov / this.h; this._yawGoal = null; this._userLook = true; this._settle = false; sv.yaw -= dx * k; sv.pitch = clamp(sv.pitch + dy * k, -25, 80); }
      else { const v = this.views[this.compare ? 'transit' : this.scale], right = V3().crossVectors(v.up, v.dir).normalize(); this._goal = null; v.dir.applyAxisAngle(v.up, -dx * .005).applyAxisAngle(right, -dy * .005).normalize(); v.up.applyAxisAngle(right, -dy * .005); v.up.addScaledVector(v.dir, -v.up.dot(v.dir)).normalize(); }
      if (drag.moved > 4 && this.hover) { this.hover = null; this.onHover?.(null); }
    });
    const release = e => {
      pts.delete(e.pointerId);
      if (pinch) { if (pts.size < 2) { pinch = null; const p = [...pts.values()][0]; drag = p ? { x: p.x, y: p.y, moved: 99 } : null; } return; } // the remaining finger keeps dragging, never taps
      const b = el.getBoundingClientRect(); if (drag && drag.moved < 5 && e.type === 'pointerup') { const h = this._pick(e.clientX - b.left, e.clientY - b.top); this.onPick?.(h); } drag = null;
    };
    el.addEventListener('pointerup', release); el.addEventListener('pointercancel', release);
    el.addEventListener('wheel', e => { e.preventDefault(); this._zoomBy(Math.exp(e.deltaY * .0012)); }, { passive: false });
  }
  /** Zoom by factor f (>1 out, <1 in): field of view at the surface and in surface comparisons, distance elsewhere. */
  _zoomBy(f) {
    if (this.compare ? this.compareMode !== 'route' : this.scale === 'surface') { this.surfaceView.fov = clamp(this.surfaceView.fov * f, 14, 75); if (!this.compare) { this._userLook = true; this._settle = false; } }
    else { const v = this.views[this.compare ? 'transit' : this.scale]; v.zoom = clamp(v.zoom * f, .2, 5); }
  }
}
export { LunarScene };
export default LunarScene;
