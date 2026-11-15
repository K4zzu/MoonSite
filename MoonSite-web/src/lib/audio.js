// Small synthesized soundscape (no audio files): countdown beeps, liftoff rumble, engine noise during burns,
// soft chime for milestones. WebAudio starts only after a user gesture (Start mission / Play).
let ctx = null, master = null, engine = null, on = true;

function init() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
  return ctx;
}
function noiseBuffer(sec) {
  const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0);
  let last = 0; for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; } // brown noise
  return b;
}

export const Sound = {
  get on() { return on; },
  set(v) { on = v; if (master) master.gain.value = v ? 0.5 : 0; if (!v) this.engine(0); },
  unlock() { if (!init()) return; if (ctx.state === 'suspended') ctx.resume(); },
  beep(freq = 880, dur = 0.12, vol = 0.25) {
    if (!on || !init()) return; const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
    o.type = 'sine'; o.frequency.value = freq; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
  },
  chime() { this.beep(660, 0.25, 0.12); setTimeout(() => this.beep(990, 0.35, 0.1), 90); },
  rumble(dur = 4) {
    if (!on || !init()) return; const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), t = ctx.currentTime;
    s.buffer = noiseBuffer(dur); f.type = 'lowpass'; f.frequency.value = 180; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.9, t + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(master); s.start(t);
  },
  /** Continuous engine noise, level 0..1. */
  engine(level) {
    if (!ctx) { if (level <= 0) return; if (!init()) return; }
    if (!engine) {
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noiseBuffer(3); s.loop = true; f.type = 'lowpass'; f.frequency.value = 320; g.gain.value = 0;
      s.connect(f).connect(g).connect(master); s.start(); engine = { g, f };
    }
    const v = on ? Math.max(0, Math.min(1, level)) * 0.35 : 0;
    engine.g.gain.setTargetAtTime(v, ctx.currentTime, 0.15); engine.f.frequency.setTargetAtTime(220 + 260 * level, ctx.currentTime, 0.2);
  },
};
