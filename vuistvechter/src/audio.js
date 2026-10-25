// Kleine Web Audio-laag: geluiden laden, willekeurige variant afspelen, en een gesynthetiseerde "zwiep".

const BASE = 'sounds/';   // relatief aan de pagina

export class Audio {
  constructor() {
    this.ctx = null;
    this.buffers = {};
    this.master = null;
    this.volume = 0.8;
  }

  // AudioContext mag pas starten na een klik van de speler
  async start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    // galm van de betonnen hal: gesynthetiseerde impulsrespons (ruis met exponentieel verval,
    // hoge tonen sterven sneller uit), als "send" naast het droge geluid
    const sr = this.ctx.sampleRate, len = Math.floor(sr * 1.9);
    const ir = this.ctx.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c); let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr, n = Math.random() * 2 - 1;
        lp += (n - lp) * Math.max(0.05, 0.9 * Math.exp(-t * 2.2));     // steeds doffer
        d[i] = lp * Math.exp(-t * 3.4) * (t < 0.012 ? t / 0.012 : 1);
      }
    }
    this.reverb = this.ctx.createConvolver(); this.reverb.buffer = ir;
    this.reverbGain = this.ctx.createGain(); this.reverbGain.gain.value = 0.9;
    this.reverb.connect(this.reverbGain).connect(this.master);

    const names = ['hit1', 'hit2', 'hit3', 'hit4', 'hit5', 'jump', 'land',
      'step1', 'step2', 'step3', 'step4', 'step5', 'step6', 'step7', 'step8',
      'shot1', 'shot2', 'shot3', 'shot4', 'shot5', 'magout', 'magin', 'slide', 'dry'];
    await Promise.all(names.map(async n => {
      try {
        const res = await fetch(BASE + n + '.mp3');
        const buf = await res.arrayBuffer();
        this.buffers[n] = await this.ctx.decodeAudioData(buf);
      } catch (_) {}
    }));
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  // pan: -1 links .. 1 rechts; lowpass: kantelfrequentie in Hz (verre geluiden klinken doffer)
  play(name, { gain = 1, rate = 1, jitter = 0.06, pan = 0, lowpass = 0, wet = 0 } = {}) {
    if (!this.ctx) return;
    // "hit" of "step" kiest een willekeurige variant
    const opts = Object.keys(this.buffers).filter(k => k === name || k.replace(/\d+$/, '') === name);
    if (!opts.length) return;
    const buf = this.buffers[opts[(Math.random() * opts.length) | 0]];
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * jitter);
    const g = this.ctx.createGain();
    g.gain.value = gain;
    let node = src;
    if (lowpass > 0) { const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass; node = node.connect(f); }
    if (pan && this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); node = node.connect(p); }
    node.connect(g).connect(this.master);
    if (wet > 0 && this.reverb) { const w = this.ctx.createGain(); w.gain.value = wet; g.connect(w).connect(this.reverb); }
    src.start();
  }

  noise(dur) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    return src;
  }

  // kogel die vlak langs je oor vliegt: korte, scherpe zweep met een dopplerval
  whiz(pan = 0, gain = 0.35) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, dur = 0.16;
    const src = this.noise(dur);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 4;
    bp.frequency.setValueAtTime(5200, t);
    bp.frequency.exponentialRampToValueAtTime(1500, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = src.connect(bp).connect(g);
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; node = node.connect(p); }
    node.connect(this.master);
    src.start(t);
  }

  // zelf geraakt: doffe klap
  hurt(gain = 0.6) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.26);
    const n = this.noise(0.08);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(gain * 0.7, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    n.connect(lp).connect(g2).connect(this.master); n.start(t);
  }

  // metalen "ping" als je een doelwit raakt
  ping(gain = 0.25) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (const [f, d] of [[1650, 0.5], [2480, 0.3], [3900, 0.18]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * (0.98 + Math.random() * 0.04);
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(this.master); o.start(t); o.stop(t + d);
    }
  }

  // korte luchtverplaatsing bij een stoot die niets raakt
  whoosh(gain = 0.25) {
    if (!this.ctx) return;
    const ctx = this.ctx, dur = 0.18;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
    const t = ctx.currentTime;
    bp.frequency.setValueAtTime(500, t);
    bp.frequency.exponentialRampToValueAtTime(2200, t + dur * 0.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
  }
}
