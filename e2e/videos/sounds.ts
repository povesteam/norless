import { writeFileSync } from "node:fs";

// The training videos' sounds: clicks, taps and keys.

type Sound = "click" | "tap" | "key" | "space";
const tone = (t: number, hz: number, decay: number) =>
  Math.exp(-t * decay) * Math.sin(2 * Math.PI * hz * t);
const noise = (t: number, decay: number) =>
  Math.exp(-t * decay) * (2 * Math.random() - 1);
const around = (value: number, spread: number) =>
  value * (1 + (Math.random() * 2 - 1) * spread);
/**
 * How each sound is made, as a wave over `t` seconds: decaying tones and noise, so no
 * recording is needed. Each call is a new press, a little different, so typing doesn't
 * sound like a machine.
 */
const sounds: Record<Sound, () => (t: number) => number> = {
  // A mouse button's press and, 75 ms later, its release.
  click: () => (t) =>
    0.7 * tone(t, 3200, 900) +
    (t >= 0.075 ? 0.45 * tone(t - 0.075, 2500, 1100) : 0),
  tap: () => (t) => 0.4 * tone(t, 1100, 450),
  // A key: a low thock, a tick and a burst of noise, then its release.
  key: () => {
    const [low, high, decay, gain] = [
      around(190, 0.2),
      around(2600, 0.35),
      around(260, 0.25),
      around(0.85, 0.2),
    ];
    const release = around(0.085, 0.3);
    return (t) =>
      gain *
      (0.5 * tone(t, low, decay) +
        0.2 * tone(t, high, 1400) +
        0.3 * noise(t, 650) +
        (t >= release
          ? 0.12 * tone(t - release, high * 0.8, 1600) +
            0.1 * noise(t - release, 900)
          : 0));
  },
  // The space bar: deeper and longer.
  space: () => {
    const low = around(120, 0.1);
    return (t) =>
      0.6 * tone(t, low, 170) +
      0.3 * noise(t, 380) +
      (t >= 0.11 ? 0.15 * noise(t - 0.11, 700) : 0);
  },
};
// ponytail: one film at a time (the config's one worker), so its clock is global.
let started = 0;
let heard: { at: number; sound: Sound }[] = [];

/** A new film starts: nothing heard yet. */
export function listen() {
  heard = [];
  // Recording starts about 0.1 s after the pages are asked for (measured on a click's
  // ring and sound): the knob to turn if the sounds drift.
  started = Date.now() + 100;
}
/** A sound heard now in the film being made (`later` ms from now). */
export const sound = (s: Sound, later = 0) =>
  heard.push({ at: Date.now() + later - started, sound: s });

/** The sounds heard as a mono WAV file, each at its moment; false if none was. */
export function soundTrack(file: string) {
  if (heard.length === 0) return false;
  const rate = 48_000;
  const length = 0.15 * rate;
  const end = Math.max(...heard.map((h) => h.at)) / 1000 + 1;
  const samples = new Float32Array(Math.ceil(end * rate));
  heard.forEach(({ at, sound }) => {
    const start = Math.round((at / 1000) * rate);
    const wave = sounds[sound]();
    for (let n = 0; n < length && start + n < samples.length; n++)
      samples[start + n] = (samples[start + n] ?? 0) + wave(n / rate);
  });
  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + samples.length * 2, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); // PCM
  wav.writeUInt16LE(1, 22); // mono
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((sample, n) =>
    wav.writeInt16LE(
      Math.round(Math.max(-1, Math.min(1, sample)) * 32767),
      44 + n * 2,
    ),
  );
  writeFileSync(file, wav);
  return true;
}
