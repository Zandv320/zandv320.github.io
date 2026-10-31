/* Eldoria – sound: short effects, synthesised live with WebAudio (no sound files needed).
   Everything runs through one master volume; 'eldoria.sound' = '0' in localStorage turns it off. */

const SOUND_KEY = "eldoria.sound";
const VOLUME_KEY = "eldoria.volume";
const MASTER_VOLUME = 0.5;

let audioContext = null;
let masterGain = null;
let noiseBuffer = null;

let soundOn = (() => {
  try {
    return localStorage.getItem(SOUND_KEY) !== "0";
  } catch (e) {
    return true;
  }
})();

/* the player's volume, 0..1, on top of MASTER_VOLUME */
let volume = (() => {
  try {
    const stored = parseFloat(localStorage.getItem(VOLUME_KEY));
    return stored >= 0 && stored <= 1 ? stored : 1;
  } catch (e) {
    return 1;
  }
})();

const masterLevel = () => (soundOn ? MASTER_VOLUME * volume : 0);

/* Browsers only allow audio after the first click or key press, so this is called from those handlers. */
export function unlockAudio() {
  if (audioContext) {
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }
    return;
  }
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }
  audioContext = new AudioContextClass();
  masterGain = audioContext.createGain();
  masterGain.gain.value = masterLevel();
  masterGain.connect(audioContext.destination);

  // Half a second of white noise, reused by every noise burst.
  noiseBuffer = audioContext.createBuffer(
    1,
    audioContext.sampleRate * 0.5,
    audioContext.sampleRate,
  );
  const samples = noiseBuffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.random() * 2 - 1;
  }
}

export const isSoundOn = () => soundOn;

export function setSoundOn(isOn) {
  soundOn = isOn;
  try {
    localStorage.setItem(SOUND_KEY, isOn ? "1" : "0");
  } catch (e) {}
  if (masterGain) {
    masterGain.gain.setTargetAtTime(masterLevel(), audioContext.currentTime, 0.02);
  }
}

export const getVolume = () => volume;

/** The player's volume, 0..1. */
export function setVolume(value) {
  volume = Math.max(0, Math.min(1, value));
  try {
    localStorage.setItem(VOLUME_KEY, String(volume));
  } catch (e) {}
  if (masterGain) {
    masterGain.gain.setTargetAtTime(masterLevel(), audioContext.currentTime, 0.02);
  }
}

const canPlay = () => audioContext && soundOn && audioContext.state === "running";

/**
 * One tone: oscillator type, frequency (start → end), duration and volume, with a short attack and decay.
 * @param {number} [delay] seconds from now
 */
function tone(type, startFrequency, endFrequency, duration, volume = 0.3, delay = 0) {
  const t = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(startFrequency, t);
  if (endFrequency !== startFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), t + duration);
  }
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  oscillator.connect(gain);
  gain.connect(masterGain);
  oscillator.start(t);
  oscillator.stop(t + duration + 0.02);
}

/* Noise through a filter: for swings, impacts and crunches. */
function noise(
  duration,
  volume = 0.3,
  { f0 = 1200, f1 = 300, type = "bandpass", q = 1, delay = 0 } = {},
) {
  const t = audioContext.currentTime + delay;
  const source = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();
  source.buffer = noiseBuffer;
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) {
    filter.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + duration);
  }
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  source.start(t);
  source.stop(t + duration + 0.02);
}

/** The game's sound effects. Each one is silent until audio is unlocked and sound is on. */
export const sfx = {
  swing() {
    if (!canPlay()) return;
    noise(0.12, 0.18, { f0: 1800, f1: 400, q: 0.8 });
  },
  hit(isCrit) {
    if (!canPlay()) return;
    tone("triangle", 180, 55, 0.14, 0.35);
    noise(0.06, 0.25, { f0: 2500, f1: 800, q: 0.6 });
    if (isCrit) {
      tone("square", 660, 330, 0.12, 0.12, 0.02);
      tone("sine", 1320, 1320, 0.18, 0.12, 0.04);
      noise(0.18, 0.2, { f0: 3000, f1: 600 });
    }
  },
  miss() {
    if (!canPlay()) return;
    noise(0.16, 0.1, { f0: 900, f1: 200, q: 1.5 });
  },
  hurt() {
    if (!canPlay()) return;
    tone("sawtooth", 140, 70, 0.16, 0.22);
    noise(0.08, 0.2, { f0: 600, f1: 150, type: "lowpass" });
  },
  death() {
    if (!canPlay()) return;
    tone("sawtooth", 220, 40, 0.6, 0.25);
    noise(0.4, 0.2, { f0: 800, f1: 100, type: "lowpass" });
  },
  /* a boss winds up: a low growl and a rising whistle, so you know to step aside */
  bossWarn() {
    if (!canPlay()) return;
    tone("sawtooth", 90, 70, 0.5, 0.22);
    tone("square", 300, 700, 0.45, 0.06, 0.1);
  },
  /* a boss rushes or slams: a heavy thud */
  bossSlam() {
    if (!canPlay()) return;
    tone("triangle", 120, 35, 0.35, 0.4);
    noise(0.3, 0.3, { f0: 900, f1: 120, type: "lowpass" });
  },
  /* a boss roars: enraged or calling for help */
  bossRoar() {
    if (!canPlay()) return;
    tone("sawtooth", 160, 60, 0.8, 0.25);
    tone("sawtooth", 240, 90, 0.7, 0.12, 0.05);
    noise(0.6, 0.15, { f0: 700, f1: 200, type: "lowpass" });
  },
  /* a boss shows itself: two deep drum beats under a swelling chord */
  bossIntro() {
    if (!canPlay()) return;
    tone("triangle", 90, 40, 0.45, 0.45);
    tone("triangle", 90, 40, 0.45, 0.45, 0.32);
    [110, 165, 220].forEach((frequency) =>
      tone("sawtooth", frequency, frequency * 1.01, 1.4, 0.05, 0.3),
    );
  },
  /* a boss falls: a fanfare */
  bossDefeat() {
    if (!canPlay()) return;
    [392, 523, 659, 784].forEach((frequency, i) =>
      tone("square", frequency, frequency, 0.2, 0.11, i * 0.11),
    );
    tone("triangle", 784, 784, 0.9, 0.14, 0.44);
    tone("triangle", 1047, 1047, 0.9, 0.1, 0.44);
  },
  monsterDeath() {
    if (!canPlay()) return;
    tone("square", 300, 90, 0.22, 0.14);
    noise(0.2, 0.18, { f0: 1500, f1: 200 });
  },
  loot() {
    if (!canPlay()) return;
    tone("square", 880, 880, 0.07, 0.12);
    tone("square", 1320, 1320, 0.12, 0.12, 0.07);
  },
  potion() {
    if (!canPlay()) return;
    tone("sine", 420, 900, 0.18, 0.18);
    tone("sine", 640, 1200, 0.16, 0.12, 0.08);
  },
  levelUp() {
    if (!canPlay()) return;
    // A rising C major arpeggio, then a sweep up an octave.
    [523, 659, 784, 1047].forEach((frequency, i) =>
      tone("square", frequency, frequency, 0.22, 0.12, i * 0.09),
    );
    tone("triangle", 1047, 2093, 0.5, 0.12, 0.36);
  },
  quest() {
    if (!canPlay()) return;
    [659, 880, 1319].forEach((frequency, i) =>
      tone("triangle", frequency, frequency, 0.25, 0.16, i * 0.11),
    );
  },
  skill() {
    if (!canPlay()) return;
    tone("sawtooth", 200, 900, 0.22, 0.14);
    noise(0.25, 0.22, { f0: 400, f1: 3000, q: 0.5 });
  },
  click() {
    if (!canPlay()) return;
    tone("square", 1200, 1200, 0.03, 0.06);
  },
  /* professions: one sound per tool, played on the frame the tool hits */
  pick() {
    if (!canPlay()) return;
    tone("square", 1760, 1500, 0.06, 0.08);
    tone("triangle", 2640, 2400, 0.12, 0.06, 0.01);
    noise(0.07, 0.2, { f0: 3500, f1: 1500, q: 1.2 });
  },
  chop() {
    if (!canPlay()) return;
    tone("triangle", 160, 90, 0.1, 0.3);
    noise(0.09, 0.25, { f0: 900, f1: 300, q: 1.4 });
  },
  snip() {
    if (!canPlay()) return;
    noise(0.05, 0.16, { f0: 5000, f1: 3000, q: 2 });
    noise(0.12, 0.08, { f0: 1200, f1: 600, q: 0.8, delay: 0.03 });
  },
  cast() {
    if (!canPlay()) return;
    noise(0.3, 0.12, { f0: 2500, f1: 700, q: 0.7 });
  },
  splash() {
    if (!canPlay()) return;
    noise(0.35, 0.22, { f0: 1400, f1: 250, q: 0.6 });
    tone("sine", 600, 200, 0.15, 0.08);
  },
  hammer() {
    if (!canPlay()) return;
    tone("square", 1180, 1180, 0.18, 0.1);
    tone("triangle", 2360, 2300, 0.3, 0.07, 0.005);
    noise(0.06, 0.25, { f0: 4000, f1: 2000, q: 1 });
  },
  bubble() {
    if (!canPlay()) return;
    tone("sine", 300, 900, 0.08, 0.12);
    tone("sine", 450, 1200, 0.07, 0.08, 0.1);
  },
  sizzle() {
    if (!canPlay()) return;
    noise(0.5, 0.1, { f0: 6000, f1: 4000, type: "highpass", q: 0.5 });
  },
  chime() {
    if (!canPlay()) return;
    [988, 1319, 1976].forEach((frequency, i) =>
      tone("sine", frequency, frequency, 0.4, 0.07, i * 0.06),
    );
  },
};
