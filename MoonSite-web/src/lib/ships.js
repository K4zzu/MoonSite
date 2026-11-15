// Detailed spacecraft for the 3D scene: a two-booster launch vehicle that stages in flight (boosters, fairing,
// core) and the lunar lander it carries, plus engine light, exhaust particles and a smoke trail.
// Model units: the rocket is 1 tall, engine plane at y = 0, nose at y = 1. The scene scales it with camera distance.
import * as THREE from 'three';

const M = (color, o) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.55, metalness: 0.1 }, o));
const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
const lathe = (pts, mat, seg = 40) => new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), mat);
const ogive = (r, h, y0, n = 14) => { const p = []; for (let i = 0; i <= n; i++) { const k = i / n; p.push([r * Math.sqrt(1 - k * k * 0.98) * (1 - 0.15 * k * k), y0 + h * k]); } p.push([0, y0 + h]); return p; };

const WHITE = () => M(0xf1efe9, { roughness: 0.42, emissive: 0x3a3a3c }), DARK = () => M(0x1d1f22, { roughness: 0.6 }), METAL = () => M(0x8d8f93, { metalness: 0.75, roughness: 0.32 });
const FOIL = () => M(0xc9a35a, { metalness: 0.65, roughness: 0.35, emissive: 0x2a1e08 }), PANEL = () => M(0x1b2c55, { metalness: 0.4, roughness: 0.3, emissive: 0x050a18 });

function bell(r, h, mat) { return lathe([[r * 0.35, h], [r * 0.42, h * 0.8], [r * 0.7, h * 0.45], [r, 0]], mat, 24); }

function booster(side) {
  const g = new THREE.Group(), w = WHITE(), d = DARK();
  g.add(mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.36, 28), w, 0, 0.2, 0));
  g.add(lathe(ogive(0.028, 0.07, 0.38), w, 28));
  for (const y of [0.1, 0.3]) g.add(mesh(new THREE.CylinderGeometry(0.0285, 0.0285, 0.012, 28), d, 0, y, 0));
  const b = bell(0.024, 0.035, METAL()); b.position.y = -0.03; g.add(b);
  const fin = mesh(new THREE.BoxGeometry(0.003, 0.05, 0.03), d, side * 0.03, 0.04, 0); g.add(fin);
  // struts to the core
  g.add(mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.04, 6), METAL(), -side * 0.035, 0.33, 0).rotateZ(Math.PI / 2));
  g.position.x = side * 0.078;
  return g;
}

export function buildLander(scaleUp = 1) {
  const g = new THREE.Group(), foil = FOIL(), w = WHITE(), m = METAL();
  g.add(mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.034, 8), foil, 0, 0.02, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.016, 8), w, 0, 0.045, 0));
  const b = bell(0.014, 0.02, m); b.position.y = -0.016; g.add(b);
  g.add(mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.03, 6), w, 0.012, 0.066, 0));
  const dish = mesh(new THREE.SphereGeometry(0.011, 16, 8, 0, Math.PI * 2, 0, 1.1), w, 0.012, 0.086, 0); dish.rotation.x = Math.PI; g.add(dish);
  const legs = new THREE.Group(); g.add(legs);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4, leg = new THREE.Group();
    leg.add(mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 0.05, 6), w, 0, -0.025, 0));
    leg.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.002, 10), w, 0, -0.05, 0));
    leg.position.set(Math.cos(a) * 0.03, 0.01, Math.sin(a) * 0.03); leg.userData.a = a; legs.add(leg);
  }
  const wings = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(s * 0.034, 0.03, 0); pivot.rotation.order = 'XZY'; pivot.rotation.x = 1.15; // face the Sun/camera
    const p = mesh(new THREE.BoxGeometry(0.07, 0.0015, 0.03), PANEL(), s * 0.035, 0, 0); pivot.add(p);
    const frame = mesh(new THREE.BoxGeometry(0.072, 0.001, 0.032), m, s * 0.035, -0.001, 0); pivot.add(frame);
    pivot.userData.s = s; g.add(pivot); wings.push(pivot);
  }
  g.userData = { legs, wings };
  g.scale.setScalar(scaleUp);
  return g;
}

/** Deploy 0..1: solar wings unfold and legs swing out. */
export function deployLander(l, k) {
  const { legs, wings } = l.userData;
  for (const p of wings) p.rotation.z = p.userData.s * (1 - k) * 1.45;
  for (const leg of legs.children) { const a = leg.userData.a; leg.rotation.set(Math.sin(a) * (0.1 + 0.45 * k), 0, -Math.cos(a) * (0.1 + 0.45 * k)); }
}

export function buildRocket() {
  const g = new THREE.Group(), w = WHITE(), d = DARK(), parts = {};
  const core = new THREE.Group();
  core.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.56, 40), w, 0, 0.29, 0));
  for (const y of [0.04, 0.2, 0.52]) core.add(mesh(new THREE.CylinderGeometry(0.0455, 0.0455, y === 0.2 ? 0.05 : 0.018, 40), d, 0, y, 0));
  for (let i = 0; i < 3; i++) { const a = i * 2.094, b = bell(0.02, 0.04, METAL()); b.position.set(Math.cos(a) * 0.022, -0.035, Math.sin(a) * 0.022); core.add(b); }
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4, gf = mesh(new THREE.BoxGeometry(0.018, 0.002, 0.014), M(0x55575b, { metalness: 0.6 }), Math.cos(a) * 0.053, 0.545, Math.sin(a) * 0.053); gf.rotation.y = -a; core.add(gf); }
  g.add(core); parts.core = core;
  const upper = new THREE.Group();
  upper.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 40), d, 0, 0.585, 0));
  upper.add(mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.13, 40), w, 0, 0.665, 0));
  const ub = bell(0.022, 0.05, METAL()); ub.position.y = 0.535; upper.add(ub); upper.userData.engineY = 0.535;
  g.add(upper); parts.upper = upper;
  const lander = buildLander(1.05); lander.position.y = 0.76; deployLander(lander, 0); g.add(lander); parts.lander = lander;
  const fair = [];
  for (const s of [-1, 1]) {
    const half = new THREE.Mesh(new THREE.LatheGeometry(ogive(0.05, 0.27, 0.73, 18).map(([r, y]) => new THREE.Vector2(r, y)), 24, s < 0 ? 0 : Math.PI, Math.PI), M(0xf1efe9, { roughness: 0.42, side: THREE.DoubleSide, emissive: 0x3a3a3c }));
    const pivot = new THREE.Group(); pivot.add(half); pivot.userData.s = s; g.add(pivot); fair.push(pivot);
  }
  parts.fairing = fair;
  parts.boosters = [booster(-1), booster(1)]; parts.boosters.forEach(b => g.add(b));
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  g.userData.parts = parts;
  return g;
}

// Mission-time staging (ms after launch)
export const STAGING = { maxQ: 72e3, boosterSep: 150e3, fairingSep: 210e3, meco: 505e3, coreSep: 510e3, orbit: 540e3 };

/** Pose the stack parts for time tau (ms after launch). Returns the engine height (model y) of the active stage. */
export function stageRocket(rocket, tau, tSinceTLI) {
  const P = rocket.userData.parts, s = x => Math.max(0, x) / 1000;
  const db = s(tau - STAGING.boosterSep), df = s(tau - STAGING.fairingSep), dc = s(tau - STAGING.coreSep);
  P.boosters.forEach((b, i) => {
    const side = i ? 1 : -1; b.visible = db < 140;
    b.position.set(side * (0.078 + 0.0016 * db), -0.00009 * db * db, 0); b.rotation.z = side * -0.006 * db;
  });
  P.fairing.forEach(f => { const sd = f.userData.s; f.visible = df < 90; f.position.set(sd * 0.0025 * df, -0.00006 * df * df, 0); f.rotation.z = -sd * Math.min(1.2, 0.025 * df); });
  P.core.visible = dc < 150; P.core.position.y = -0.00016 * dc * dc; P.core.rotation.x = 0.002 * dc;
  // the lander wings unfold once the fairing is gone; legs stay stowed until the descent
  deployLander(P.lander, Math.min(1, Math.max(0, (df - 20) / 60)) * 0.999);
  const showUpper = tSinceTLI == null || tSinceTLI < 240e3;
  P.upper.visible = showUpper;
  return tau < STAGING.coreSep ? 0 : P.upper.userData.engineY;
}

// ---------- particles
const VERT = `attribute float aSize; attribute float aAlpha; uniform float uScale; uniform float uPx; varying float vA;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uScale * uPx / max(1e-9, -mv.z); vA = aAlpha; }`;
const FRAG = `uniform vec3 uColor; uniform float uSoft; uniform float uGlow; varying float vA;
void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c) * 2.0; if (d > 1.0) discard; float a = vA * pow(1.0 - d, uSoft); gl_FragColor = vec4(uColor * (1.0 + uGlow * (1.0 - d)), a); }`;

export class Particles {
  constructor(n, color, additive, soft) {
    this.n = n; this.i = 0; this.p = new Float32Array(n * 3); this.v = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n); this.s0 = new Float32Array(n); this.grow = new Float32Array(n);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.p, 3)); this.size = new Float32Array(n); this.alpha = new Float32Array(n);
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1)); g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: !additive, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uColor: { value: new THREE.Color(color) }, uScale: { value: 1 }, uPx: { value: 500 }, uSoft: { value: soft || 1.5 }, uGlow: { value: additive ? 0.6 : 0 } } });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = additive ? 7 : 4;
  }
  emit(x, y, z, vx, vy, vz, life, size, grow) {
    const i = this.i, o = i * 3; this.i = (i + 1) % this.n;
    this.p[o] = x; this.p[o + 1] = y; this.p[o + 2] = z; this.v[o] = vx; this.v[o + 1] = vy; this.v[o + 2] = vz;
    this.life[i] = this.max[i] = life; this.s0[i] = size; this.grow[i] = grow || 0;
  }
  update(dt, alpha0) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt; const o = i * 3, k = Math.max(0, this.life[i] / this.max[i]);
      this.p[o] += this.v[o] * dt; this.p[o + 1] += this.v[o + 1] * dt; this.p[o + 2] += this.v[o + 2] * dt;
      this.size[i] = this.s0[i] * (1 + this.grow[i] * (1 - k)); this.alpha[i] = alpha0 * k * Math.min(1, (1 - k) * 8);
    }
    const g = this.points.geometry; g.attributes.position.needsUpdate = g.attributes.aSize.needsUpdate = g.attributes.aAlpha.needsUpdate = true;
  }
  clear() { this.life.fill(0); this.alpha.fill(0); this.points.geometry.attributes.aAlpha.needsUpdate = true; }
}
