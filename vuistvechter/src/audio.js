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

    const names = ['hit1', 'hit2', 'hit3', 'hit4', 'hit5', 'jump', 'land',
      'step1', 'step2', 'step3', 'step4', 'step5', 'step6', 'step7', 'step8'];
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

  play(name, { gain = 1, rate = 1, jitter = 0.06 } = {}) {
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
    src.connect(g).connect(this.master);
    src.start();
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
