import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  bleMidiMessages,
  chordOfChroma,
  chordOfNotes,
  chromaOf,
  type Heard,
} from "../../shared/music/chord-detect";
import type { Key } from "../../shared/music/chords";

/**
 * Where chords come from: a MIDI piano by cable (Web MIDI), a
 * Bluetooth MIDI piano Norless connects itself (Web Bluetooth), or a microphone or the
 * mixer's input. Chrome and Edge have MIDI and Bluetooth; Apple's browsers have neither.
 */

export type InputState =
  "off" | "unsupported" | "denied" | "waiting" | "ready" | "failed";

/** MIDI messages from every cable-connected MIDI input, while `on`. */
export function useMidi(on: boolean, onMessage: (data: number[]) => void) {
  const [state, setState] = useState<InputState>("off");
  const [inputs, setInputs] = useState<string[]>([]);
  const message = useEffectEvent(onMessage);
  useEffect(() => {
    if (!on) return;
    if (!navigator.requestMIDIAccess) {
      setState("unsupported");
      return;
    }
    let access: MIDIAccess | null = null;
    let gone = false;
    const attach = () => {
      if (!access) return;
      const names: string[] = [];
      for (const input of access.inputs.values()) {
        input.onmidimessage = (e) => e.data && message(Array.from(e.data));
        names.push(input.name ?? "MIDI");
      }
      setInputs(names);
      setState(names.length ? "ready" : "waiting");
    };
    navigator
      .requestMIDIAccess()
      .then((granted) => {
        if (gone) return;
        access = granted;
        access.onstatechange = attach;
        attach();
      })
      .catch(() => setState("denied"));
    return () => {
      gone = true;
      if (!access) return;
      access.onstatechange = null;
      for (const input of access.inputs.values()) input.onmidimessage = null;
    };
  }, [on]);
  return { state: on ? state : "off", inputs };
}

// Web Bluetooth, which TypeScript's DOM types don't have.
type Characteristic = EventTarget & {
  value?: DataView;
  startNotifications(): Promise<Characteristic>;
};
type BluetoothDevice = EventTarget & {
  name?: string;
  gatt?: {
    connected: boolean;
    connect(): Promise<{
      getPrimaryService(uuid: string): Promise<{
        getCharacteristic(uuid: string): Promise<Characteristic>;
      }>;
    }>;
    disconnect(): void;
  };
};
type Bluetooth = {
  requestDevice(options: object): Promise<BluetoothDevice>;
  getDevices?: () => Promise<BluetoothDevice[]>;
};
const bluetooth = () =>
  (navigator as Navigator & { bluetooth?: Bluetooth }).bluetooth;

/** The Bluetooth LE MIDI service and its characteristic. */
const MIDI_SERVICE = "03b80e5a-ede8-4b33-a751-6ce34ec4c700";
const MIDI_DATA = "7772e5db-3868-4112-a1a9-f2669d106bf3";

/**
 * A Bluetooth MIDI piano, connected by Norless while `on` and let go after. A piano chosen before reconnects by itself where the browser remembers it;
 * otherwise `connect` shows the browser's chooser, which needs a tap.
 */
export function useBluetoothMidi(
  on: boolean,
  onMessage: (data: number[]) => void,
) {
  const [state, setState] = useState<InputState>("off");
  const [name, setName] = useState<string | null>(null);
  const device = useRef<BluetoothDevice | null>(null);
  const message = useEffectEvent(onMessage);

  const open = async (chosen: BluetoothDevice) => {
    setState("waiting");
    try {
      const server = await chosen.gatt?.connect();
      const service = await server?.getPrimaryService(MIDI_SERVICE);
      const data = await service?.getCharacteristic(MIDI_DATA);
      if (!data) throw new Error("no MIDI");
      data.addEventListener("characteristicvaluechanged", () => {
        const value = data.value;
        if (!value) return;
        const bytes = new Uint8Array(
          value.buffer,
          value.byteOffset,
          value.byteLength,
        );
        for (const m of bleMidiMessages(bytes)) message(m);
      });
      await data.startNotifications();
      device.current = chosen;
      setName(chosen.name ?? null);
      setState("ready");
    } catch {
      setState("failed");
    }
  };

  useEffect(() => {
    if (!on) return;
    const api = bluetooth();
    if (!api) {
      setState("unsupported");
      return;
    }
    // A piano chosen before, where the browser remembers the permission.
    void api
      .getDevices?.()
      .then((known) => known[0] && open(known[0]))
      .catch(() => undefined);
    return () => {
      device.current?.gatt?.disconnect();
      device.current = null;
    };
  }, [on]);

  const connect = async () => {
    const api = bluetooth();
    if (!api) return;
    try {
      await open(
        await api.requestDevice({ filters: [{ services: [MIDI_SERVICE] }] }),
      );
    } catch {
      // The chooser was closed.
    }
  };
  return { state: on ? state : "off", name, connect };
}

/**
 * The notes held and the chord they make, from MIDI messages; `onPlayed` gets the chord
 * once every key is let go, the chord of the most notes held at once. `take` hands over
 * the chord held now instead, which then isn't played on letting go.
 */
export function useHeldChord(
  key: Key | null,
  onPlayed?: (chord: string) => void,
) {
  const held = useRef(new Set<number>());
  const best = useRef<{ chord: string; notes: number } | null>(null);
  const taken = useRef(false);
  const [chord, setChord] = useState<string | null>(null);
  const played = useEffectEvent((name: string) => onPlayed?.(name));
  const feed = (data: number[]) => {
    const [status = 0, note = 0, velocity = 0] = data;
    const type = status & 0xf0;
    if (type === 0x90 && velocity > 0) held.current.add(note);
    else if (type === 0x80 || (type === 0x90 && velocity === 0))
      held.current.delete(note);
    else return;
    const notes = [...held.current];
    const now = chordOfNotes(notes, key);
    if (now) {
      setChord(now);
      if (!best.current || notes.length >= best.current.notes)
        best.current = { chord: now, notes: notes.length };
    }
    if (notes.length === 0 && best.current) {
      if (!taken.current) played(best.current.chord);
      best.current = null;
      taken.current = false;
    }
  };
  const take = () => {
    if (held.current.size === 0 || !best.current) return null;
    taken.current = true;
    return best.current.chord;
  };
  return { chord, feed, take };
}

/**
 * The chord a microphone or the mixer hears, while `on`: the spectrum about seven times
 * a second, and a chord once the same one is heard three times out of the last four.
 */
export function useHeardChord(
  on: boolean,
  deviceId: string | null,
  key: Key | null,
) {
  const [heard, setHeard] = useState<Heard | null>(null);
  const [state, setState] = useState<InputState>("off");
  const recent = useRef<string[]>([]);
  const hear = useEffectEvent((decibels: Float32Array, sampleRate: number) => {
    const now = chordOfChroma(chromaOf(decibels, sampleRate), key);
    // Quiet: nothing heard, rather than a guess at the noise.
    const loudest = Math.max(...decibels);
    if (!now || loudest < -70) {
      recent.current = [];
      setHeard(null);
      return;
    }
    recent.current = [...recent.current, now.name].slice(-4);
    const same = recent.current.filter((n) => n === now.name).length;
    if (same >= 3) setHeard(now);
  });
  useEffect(() => {
    if (!on) return;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let gone = false;
    setState("waiting");
    void navigator.mediaDevices
      .getUserMedia({
        audio: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
      .then(async (s) => {
        if (gone) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        context = new AudioContext();
        await context.resume();
        const analyser = context.createAnalyser();
        // About 6 Hz a bin at 48 kHz: the bass's notes apart.
        analyser.fftSize = 16384;
        analyser.smoothingTimeConstant = 0.6;
        context.createMediaStreamSource(s).connect(analyser);
        const decibels = new Float32Array(analyser.frequencyBinCount);
        const rate = context.sampleRate;
        timer = setInterval(() => {
          analyser.getFloatFrequencyData(decibels);
          hear(decibels, rate);
        }, 150);
        setState("ready");
      })
      .catch(() => setState("denied"));
    return () => {
      gone = true;
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
      void context?.close();
      recent.current = [];
      setHeard(null);
    };
  }, [on, deviceId]);
  return { heard: on ? heard : null, state: on ? state : "off" };
}
