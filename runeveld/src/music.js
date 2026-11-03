/* Eldoria – music and the sound of the world, synthesised live like the effects (audio.js), no files:
   - a theme per area, made up as it plays from a key, a chord progression and a few voices (a soft pad, a plucked
     arpeggio, bells, a low drone): warm and gentle in Runeveld, mysterious in Whisperwood, pastoral in Kingsvale,
     regal in Aurelia, wind-swept on the Northroad, a lilt by the sea, dark under the ground and over the Ember Isles,
     and wide and slow on the start screens; crossfading when the area changes, quieter and sparser at night;
   - the world round the hero: the roar of a waterfall growing as they come near, the wind over open land, birdsong
     by day, frogs by the ponds and crickets in the grass at night.
   The music has its own volume (`eldoria.music`), under the sound volume. */
import { audioOutput, isSoundOn } from "./audio.js";
import { daylight } from "./daylight.js";

const MUSIC_KEY = "eldoria.music";

let musicVolume = (() => {
  try {
    const stored = parseFloat(localStorage.getItem(MUSIC_KEY));
    return stored >= 0 && stored <= 1 ? stored : 0.6;
  } catch (e) {
    return 0.6;
  }
})();

export const getMusicVolume = () => musicVolume;

/** The music's volume, 0..1. */
export function setMusicVolume(value) {
  musicVolume = Math.max(0, Math.min(1, value));
  try {
    localStorage.setItem(MUSIC_KEY, String(musicVolume));
  } catch (e) {}
  if (musicBus) {
    musicBus.gain.setTargetAtTime(musicVolume * MUSIC_LEVEL, musicBus.context.currentTime, 0.1);
  }
}

/* how loud the music sits under the effects */
const MUSIC_LEVEL = 0.32;

/* ---------------------------------------------------------------- themes -------------------------------------- */

/* semitones of the scales, and chords as scale degrees (0-based) */
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];

/* root: the key's note as a frequency in the bass; beat: seconds per beat; voices: how loud each plays (0 = not) */
const THEMES = {
  login: {
    root: 73.42, // D
    scale: MINOR,
    chords: [0, 5, 2, 6],
    beat: 0.9,
    voices: { pad: 1, arp: 0.35, bell: 0.7, drone: 0.8 },
  },
  fields: {
    root: 65.41, // C
    scale: MAJOR,
    chords: [0, 4, 5, 3],
    beat: 0.6,
    voices: { pad: 0.7, arp: 0.8, bell: 0.3, drone: 0 },
  },
  forest: {
    root: 82.41, // E
    scale: DORIAN,
    chords: [0, 3, 0, 6],
    beat: 0.75,
    voices: { pad: 0.9, arp: 0.4, bell: 0.7, drone: 0.4 },
  },
  vale: {
    root: 98, // G
    scale: MAJOR,
    chords: [0, 3, 0, 4],
    beat: 0.55,
    voices: { pad: 0.6, arp: 0.9, bell: 0.25, drone: 0 },
  },
  capital: {
    root: 58.27, // Bb
    scale: MAJOR,
    chords: [0, 3, 4, 0],
    beat: 0.65,
    voices: { pad: 0.9, arp: 0.6, bell: 0.5, drone: 0.3 },
  },
  northroad: {
    root: 55, // A
    scale: MINOR,
    chords: [0, 6, 5, 6],
    beat: 0.7,
    voices: { pad: 0.8, arp: 0.45, bell: 0.2, drone: 0.7 },
  },
  saltmere: {
    root: 87.31, // F
    scale: MAJOR,
    chords: [0, 5, 3, 4],
    beat: 0.45,
    voices: { pad: 0.6, arp: 0.8, bell: 0.35, drone: 0 },
  },
  ember: {
    root: 65.41, // C
    scale: MINOR,
    chords: [0, 1, 0, 5],
    beat: 0.8,
    voices: { pad: 0.8, arp: 0.25, bell: 0.3, drone: 1 },
  },
  /* the Frostmarch: slow and high, bells over a cold drone, like breath in the air */
  frostmarch: {
    root: 82.41, // E
    scale: DORIAN,
    chords: [0, 5, 3, 0],
    beat: 1.05,
    voices: { pad: 0.6, arp: 0.2, bell: 0.9, drone: 0.7 },
  },
  deep: {
    root: 49, // G, low
    scale: MINOR,
    chords: [0, 0, 5, 1],
    beat: 1,
    voices: { pad: 0.7, arp: 0, bell: 0.45, drone: 1 },
  },
};
/* areas that share a theme */
const THEME_OF = {
  sea: "saltmere",
  crypt: "deep",
  forge: "ember",
  tidecrown: "deep",
  waste: "frostmarch",
};

/* a note of the theme's scale, `degree` steps up from the root, `octave` octaves up */
function noteOf(theme, degree, octave = 0) {
  const steps = theme.scale.length;
  const octaves = Math.floor(degree / steps) + octave;
  const semitone = theme.scale[((degree % steps) + steps) % steps];
  return theme.root * 2 ** (octaves + semitone / 12);
}

/* ---------------------------------------------------------------- voices -------------------------------------- */

let musicBus = null;

/* a soft pad: two detuned saws through a slow lowpass, swelling in and dying away */
function pad(context, out, frequency, start, length, level) {
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900;
  filter.Q.value = 0.4;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(level, start + length * 0.35);
  gain.gain.linearRampToValueAtTime(0, start + length);
  filter.connect(gain);
  gain.connect(out);
  for (const detune of [-7, 7]) {
    const oscillator = context.createOscillator();
    oscillator.type = "sawtooth";
    oscillator.frequency.value = frequency;
    oscillator.detune.value = detune;
    oscillator.connect(filter);
    oscillator.start(start);
    oscillator.stop(start + length + 0.05);
  }
}

/* a plucked string: a triangle with a quick fall */
function pluck(context, out, frequency, start, level) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(level, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.9);
  oscillator.connect(gain);
  gain.connect(out);
  oscillator.start(start);
  oscillator.stop(start + 0.95);
}

/* a bell: a sine and its inharmonic partial, ringing out */
function bell(context, out, frequency, start, level) {
  for (const [ratio, share] of [
    [1, 1],
    [2.76, 0.35],
  ]) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency * ratio;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(level * share, start + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0005, start + 2.6);
    oscillator.connect(gain);
    gain.connect(out);
    oscillator.start(start);
    oscillator.stop(start + 2.7);
  }
}

/* a low drone under a whole bar */
function drone(context, out, frequency, start, length, level) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(level, start + length * 0.3);
  gain.gain.linearRampToValueAtTime(0, start + length);
  oscillator.connect(gain);
  gain.connect(out);
  oscillator.start(start);
  oscillator.stop(start + length + 0.05);
}

/* ---------------------------------------------------------------- the player of the music --------------------- */

/* the theme playing now: {name, theme, gain, bar, nextBar} */
let playing = null;
let wanted = null;

function startTheme(context, name) {
  const theme = THEMES[name];
  const gain = context.createGain();
  gain.gain.setValueAtTime(0, context.currentTime);
  gain.gain.linearRampToValueAtTime(1, context.currentTime + 3);
  gain.connect(musicBus);
  return { name, theme, gain, bar: 0, nextBar: context.currentTime + 0.1 };
}

/* plays one bar of the theme from `start`: the chord as a pad, an arpeggio over it, now and then a bell */
function playBar(context, current, start) {
  const { theme, gain } = current;
  const { voices, beat } = theme;
  const night = 1 - daylight();
  const chord = theme.chords[current.bar % theme.chords.length];
  const length = beat * 4;
  const tones = [chord, chord + 2, chord + 4];
  if (voices.pad) {
    for (const degree of tones) {
      pad(context, gain, noteOf(theme, degree, 2), start, length + beat, 0.045 * voices.pad);
    }
  }
  if (voices.drone) {
    drone(context, gain, noteOf(theme, chord, 0), start, length + beat, 0.09 * voices.drone);
  }
  if (voices.arp) {
    /* eighth notes up and down the chord, with rests; fewer at night */
    const pattern = [0, 1, 2, 3, 2, 1, 2, 4];
    pattern.forEach((step, k) => {
      if (Math.random() < 0.25 + night * 0.35) {
        return;
      }
      const degree = tones[step % 3] + (step > 2 ? 7 : 0);
      pluck(context, gain, noteOf(theme, degree, 3), start + k * beat * 0.5, 0.05 * voices.arp);
    });
  }
  if (voices.bell && Math.random() < 0.5) {
    const degree = tones[Math.floor(Math.random() * 3)] + 7;
    bell(
      context,
      gain,
      noteOf(theme, degree, 3),
      start + beat * Math.floor(Math.random() * 4),
      0.04 * voices.bell,
    );
  }
  current.bar++;
}

/** Which area's music should play: an area key of main.js zoneAt, or "login". */
export function setMusicArea(area) {
  wanted = THEMES[area] ? area : THEME_OF[area] || "fields";
}

function updateMusic(context) {
  if (!musicBus) {
    musicBus = context.createGain();
    musicBus.gain.value = musicVolume * MUSIC_LEVEL;
    musicBus.connect(audioOutput().master);
  }
  if (!wanted) {
    return;
  }
  if (!playing || playing.name !== wanted) {
    /* the old theme fades out while the new one comes in */
    if (playing) {
      const old = playing.gain;
      old.gain.cancelScheduledValues(context.currentTime);
      old.gain.setValueAtTime(old.gain.value, context.currentTime);
      old.gain.linearRampToValueAtTime(0, context.currentTime + 3);
      setTimeout(() => old.disconnect(), 3500);
    }
    playing = startTheme(context, wanted);
  }
  /* after a silence (sound off, a hidden tab) it picks up from now instead of catching up */
  if (playing.nextBar < context.currentTime) {
    playing.nextBar = context.currentTime + 0.05;
  }
  /* bars are scheduled a little ahead, so a slow frame does not make them stumble */
  while (playing.nextBar < context.currentTime + 1.5) {
    playBar(context, playing, playing.nextBar);
    playing.nextBar += playing.theme.beat * 4;
  }
}

/* ---------------------------------------------------------------- the sound of the world -------------------- */

/* the falls and the pools that roar or croak: [x, z] */
const WATERFALLS = [
  [-110, -273],
  [10, -90],
];
const PONDS = [
  [28.1, 19.4],
  [10, -85],
];

/* looping noise through a filter, its loudness set every frame: the waterfall's roar, the wind */
function noiseLoop(context, noise, out, { type, frequency, q }) {
  const source = context.createBufferSource();
  source.buffer = noise;
  source.loop = true;
  const filter = context.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = q;
  const gain = context.createGain();
  gain.gain.value = 0;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  source.start();
  return { gain, filter };
}

let world = null;

function chirp(context, out, start) {
  /* a little run of falling and rising whistles */
  const notes = 2 + Math.floor(Math.random() * 4);
  const base = 2600 + Math.random() * 1600;
  const panner = context.createStereoPanner ? context.createStereoPanner() : null;
  if (panner) {
    panner.pan.value = Math.random() * 1.6 - 0.8;
    panner.connect(out);
  }
  for (let k = 0; k < notes; k++) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const t = start + k * (0.08 + Math.random() * 0.05);
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.3), t);
    oscillator.frequency.exponentialRampToValueAtTime(base * (0.7 + Math.random() * 0.6), t + 0.07);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.03, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0005, t + 0.08);
    oscillator.connect(gain);
    gain.connect(panner || out);
    oscillator.start(t);
    oscillator.stop(t + 0.1);
  }
}

function croak(context, out, start, level) {
  /* a frog: a low buzz with a few quick pulses */
  const oscillator = context.createOscillator();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(130 + Math.random() * 40, start);
  filter.type = "lowpass";
  filter.frequency.value = 700;
  gain.gain.setValueAtTime(0, start);
  for (let k = 0; k < 3; k++) {
    gain.gain.linearRampToValueAtTime(level, start + k * 0.06 + 0.01);
    gain.gain.linearRampToValueAtTime(0, start + k * 0.06 + 0.05);
  }
  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  oscillator.start(start);
  oscillator.stop(start + 0.25);
}

function cricket(context, out, start) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = 4300 + Math.random() * 600;
  gain.gain.setValueAtTime(0, start);
  for (let k = 0; k < 4; k++) {
    gain.gain.linearRampToValueAtTime(0.008, start + k * 0.035 + 0.005);
    gain.gain.linearRampToValueAtTime(0, start + k * 0.035 + 0.025);
  }
  oscillator.connect(gain);
  gain.connect(out);
  oscillator.start(start);
  oscillator.stop(start + 0.16);
}

function updateWorld(context, noise, { x, z, area, isOutside }) {
  if (!world) {
    const bus = context.createGain();
    bus.connect(audioOutput().master);
    world = {
      bus,
      falls: noiseLoop(context, noise, bus, { type: "lowpass", frequency: 900, q: 0.3 }),
      wind: noiseLoop(context, noise, bus, { type: "bandpass", frequency: 500, q: 0.6 }),
      nextBird: 0,
      nextFrog: 0,
      nextCricket: 0,
    };
  }
  const now = context.currentTime;
  const light = daylight();
  /* the roar of the nearest waterfall, from 28 units away and rising */
  const fallDistance = Math.min(...WATERFALLS.map(([fx, fz]) => Math.hypot(x - fx, z - fz)));
  const roar = Math.max(0, 1 - fallDistance / 28) ** 1.6;
  world.falls.gain.gain.setTargetAtTime(roar * 0.22, now, 0.3);
  /* the wind: stronger on the Northroad and over the open vale, a slow swell */
  const windiness = !isOutside
    ? 0
    : area === "northroad"
      ? 1
      : area === "vale" || area === "sea"
        ? 0.6
        : 0.3;
  const swell = 0.5 + 0.5 * Math.sin(now * 0.23) * Math.sin(now * 0.11 + 1);
  world.wind.gain.gain.setTargetAtTime(windiness * (0.015 + 0.03 * swell), now, 0.8);
  world.wind.filter.frequency.setTargetAtTime(380 + 420 * swell, now, 0.8);

  if (!isOutside) {
    return;
  }
  /* birds by day, outside the towns */
  if (light > 0.4 && area !== "capital" && area !== "saltmere" && now > world.nextBird) {
    world.nextBird = now + 1.5 + Math.random() * (area === "forest" ? 3 : 5);
    chirp(context, world.bus, now + 0.05);
  }
  /* frogs by the ponds, more at night */
  const pondDistance = Math.min(...PONDS.map(([px, pz]) => Math.hypot(x - px, z - pz)));
  if (pondDistance < 18 && now > world.nextFrog) {
    world.nextFrog = now + (light < 0.4 ? 0.8 : 3) + Math.random() * 3;
    croak(context, world.bus, now + 0.05, 0.05 * (1 - pondDistance / 18));
  }
  /* crickets in the grass at night */
  if (light < 0.3 && (area === "fields" || area === "vale") && now > world.nextCricket) {
    world.nextCricket = now + 0.4 + Math.random() * 0.9;
    cricket(context, world.bus, now + 0.02);
  }
}

/** Per frame: the music goes on, the world sounds round (x, z) in `area`; `isOutside` false in the crypt and the
    forge, where the birds and the wind keep quiet. */
export function updateSoundscape(x, z, area, isOutside) {
  const output = audioOutput();
  if (!output || output.context.state !== "running" || !isSoundOn()) {
    return;
  }
  updateMusic(output.context);
  updateWorld(output.context, output.noise, { x, z, area, isOutside });
}
