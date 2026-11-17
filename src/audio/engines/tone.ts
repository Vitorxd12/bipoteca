/**
 * Engine Tone.js: sintetizadores nativos do Web Audio, rodando na thread de
 * áudio do navegador. Fase 1 do plano de engines.
 */
import * as Tone from "tone";
import type { Instrument, InstrumentEngine } from "../engine";
import { TONE_PRESETS } from "../presets";

type Disposable = { dispose(): unknown };

interface Voice {
  out: Tone.Gain;
  parts: Disposable[];
  on(freq: number, velocity: number, time: number): void;
  off(freq: number, time: number): void;
  allOff(time: number): void;
}

/** Sintetizador polifônico com sustentação (teclas, pads, baixos, leads). */
function poly<V extends Tone.Synth | Tone.MonoSynth | Tone.FMSynth | Tone.AMSynth>(
  synth: Tone.PolySynth<V>,
  gainDb: number,
  chain: Tone.ToneAudioNode[] = [],
): Voice {
  const out = new Tone.Gain(Tone.dbToGain(gainDb));
  synth.maxPolyphony = 32;
  synth.chain(...chain, out);
  return {
    out,
    parts: [synth, ...chain],
    on: (f, v, t) => synth.triggerAttack(f, t, v),
    off: (f, t) => synth.triggerRelease(f, t),
    allOff: (t) => synth.releaseAll(t),
  };
}

/** Percussão: dispara e deixa decair; noteOff não faz nada. */
function oneShot(
  trigger: (freq: number, velocity: number, time: number) => void,
  out: Tone.Gain,
  parts: Disposable[],
): Voice {
  return { out, parts, on: trigger, off: () => {}, allOff: () => {} };
}

function build(presetId: string): Voice {
  switch (presetId) {
    case "sub":
      return poly(
        new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: "sine" },
          envelope: { attack: 0.005, decay: 0.2, sustain: 0.9, release: 0.15 },
        }),
        -4,
      );
    case "acid":
      return poly(
        new Tone.PolySynth(Tone.MonoSynth, {
          oscillator: { type: "sawtooth" },
          filter: { Q: 9, type: "lowpass", rolloff: -24 },
          envelope: { attack: 0.004, decay: 0.25, sustain: 0.5, release: 0.12 },
          filterEnvelope: { attack: 0.002, decay: 0.22, sustain: 0.15, release: 0.2, baseFrequency: 140, octaves: 4.2 },
        }),
        -10,
      );
    case "fm-bass":
      return poly(
        new Tone.PolySynth(Tone.FMSynth, {
          harmonicity: 1,
          modulationIndex: 6,
          oscillator: { type: "sine" },
          envelope: { attack: 0.003, decay: 0.3, sustain: 0.6, release: 0.15 },
          modulation: { type: "square" },
          modulationEnvelope: { attack: 0.002, decay: 0.15, sustain: 0.2, release: 0.1 },
        }),
        -10,
      );
    case "saw-lead":
      return poly(
        new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: "fatsawtooth", count: 3, spread: 24 },
          envelope: { attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.25 },
        }),
        -16,
        [new Tone.Filter(4200, "lowpass")],
      );
    case "square-lead":
      return poly(
        new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: "pulse", width: 0.35 } as Tone.OmniOscillatorOptions,
          envelope: { attack: 0.005, decay: 0.1, sustain: 0.6, release: 0.12 },
        }),
        -16,
      );
    case "glass-pad": {
      const chorus = new Tone.Chorus(0.6, 3.5, 0.6).start();
      return poly(
        new Tone.PolySynth(Tone.AMSynth, {
          harmonicity: 2.01,
          oscillator: { type: "fatsine", count: 3, spread: 18 } as Tone.OmniOscillatorOptions,
          envelope: { attack: 0.8, decay: 0.6, sustain: 0.8, release: 1.8 },
          modulation: { type: "triangle" },
          modulationEnvelope: { attack: 1.2, decay: 0.5, sustain: 1, release: 1.5 },
        }),
        -14,
        [chorus],
      );
    }
    case "warm-pad": {
      const chorus = new Tone.Chorus(1.2, 2.5, 0.5).start();
      return poly(
        new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: "fattriangle", count: 3, spread: 30 },
          envelope: { attack: 0.5, decay: 0.4, sustain: 0.85, release: 1.4 },
        }),
        -12,
        [new Tone.Filter(2400, "lowpass"), chorus],
      );
    }
    case "epiano":
      return poly(
        new Tone.PolySynth(Tone.FMSynth, {
          harmonicity: 3.01,
          modulationIndex: 12,
          oscillator: { type: "sine" },
          envelope: { attack: 0.002, decay: 1.4, sustain: 0.25, release: 0.9 },
          modulation: { type: "sine" },
          modulationEnvelope: { attack: 0.002, decay: 0.5, sustain: 0.1, release: 0.6 },
        }),
        -12,
      );
    case "organ":
      return poly(
        new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: "custom", partials: [1, 0.6, 0.45, 0, 0.25, 0, 0, 0.15] } as Tone.OmniOscillatorOptions,
          envelope: { attack: 0.01, decay: 0.05, sustain: 1, release: 0.08 },
        }),
        -14,
      );
    case "pluck":
      return poly(
        new Tone.PolySynth(Tone.MonoSynth, {
          oscillator: { type: "triangle" },
          filter: { Q: 2, type: "lowpass", rolloff: -12 },
          envelope: { attack: 0.002, decay: 0.35, sustain: 0, release: 0.3 },
          filterEnvelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.2, baseFrequency: 300, octaves: 4 },
        }),
        -8,
      );

    case "kick": {
      const out = new Tone.Gain(Tone.dbToGain(-2));
      const s = new Tone.MembraneSynth({
        pitchDecay: 0.045,
        octaves: 7,
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.42, sustain: 0, release: 0.1 },
      }).connect(out);
      return oneShot((_f, v, t) => s.triggerAttackRelease(48, 0.3, t, v), out, [s]);
    }
    case "tom": {
      const out = new Tone.Gain(Tone.dbToGain(-6));
      const s = new Tone.MembraneSynth({
        pitchDecay: 0.08,
        octaves: 3,
        envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.2 },
      }).connect(out);
      return oneShot((f, v, t) => s.triggerAttackRelease(Math.max(80, f), 0.4, t, v), out, [s]);
    }
    case "snare": {
      const out = new Tone.Gain(Tone.dbToGain(-6));
      const hp = new Tone.Filter(1800, "highpass").connect(out);
      const noise = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.05 },
      }).connect(hp);
      const body = new Tone.MembraneSynth({
        pitchDecay: 0.02,
        octaves: 2,
        envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 },
      }).connect(out);
      return oneShot(
        (_f, v, t) => {
          noise.triggerAttackRelease(0.15, t, v);
          body.triggerAttackRelease(190, 0.1, t, v * 0.7);
        },
        out,
        [noise, body, hp],
      );
    }
    case "hat-closed":
    case "hat-open": {
      const open = presetId === "hat-open";
      const out = new Tone.Gain(Tone.dbToGain(open ? -20 : -22));
      const hp = new Tone.Filter(7000, "highpass").connect(out);
      const s = new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: open ? 0.45 : 0.06, release: open ? 0.3 : 0.02 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 5000,
        octaves: 1.5,
      }).connect(hp);
      return oneShot((_f, v, t) => s.triggerAttackRelease(320, open ? 0.3 : 0.04, t, v), out, [s, hp]);
    }
    case "clap": {
      const out = new Tone.Gain(Tone.dbToGain(-4));
      const bp = new Tone.Filter({ frequency: 1300, type: "bandpass", Q: 1.2 }).connect(out);
      const s = new Tone.NoiseSynth({
        noise: { type: "pink" },
        envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.05 },
      }).connect(bp);
      return oneShot(
        (_f, v, t) => {
          // Três rajadas curtas antes da cauda: o "estalo" de palma.
          s.triggerAttackRelease(0.01, t, v * 0.8);
          s.triggerAttackRelease(0.01, t + 0.012, v * 0.8);
          s.triggerAttackRelease(0.16, t + 0.024, v);
        },
        out,
        [s, bp],
      );
    }
    case "zap": {
      const out = new Tone.Gain(Tone.dbToGain(-12));
      const s = new Tone.MembraneSynth({
        pitchDecay: 0.25,
        octaves: 6,
        oscillator: { type: "square" },
        envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 },
      }).connect(out);
      return oneShot((f, v, t) => s.triggerAttackRelease(f / 2, 0.25, t, v), out, [s]);
    }
    case "sweep": {
      const out = new Tone.Gain(Tone.dbToGain(-10));
      const filter = new Tone.AutoFilter({ frequency: 0.5, baseFrequency: 300, octaves: 5 }).start().connect(out);
      const s = new Tone.NoiseSynth({
        noise: { type: "pink" },
        envelope: { attack: 0.4, decay: 0.3, sustain: 0.4, release: 0.8 },
      }).connect(filter);
      return oneShot((_f, v, t) => s.triggerAttackRelease(0.9, t, v), out, [s, filter]);
    }
    default:
      throw new Error(`Preset desconhecido: ${presetId}`);
  }
}

export const toneEngine: InstrumentEngine = {
  id: "tone",
  name: "Tone.js",
  presets: TONE_PRESETS,
  // O Tone.js usa o próprio contexto global. Para exportação offline (RF-06),
  // a fábrica deve rodar dentro de Tone.Offline, que troca esse contexto.
  async create(_ctx, presetId) {
    const v = build(presetId);
    const toFreq = (n: number) => Tone.Frequency(n, "midi").toFrequency();
    const instrument: Instrument = {
      output: v.out.output as unknown as AudioNode,
      noteOn: (note, velocity, time) => v.on(toFreq(note), velocity, time),
      noteOff: (note, time) => v.off(toFreq(note), time),
      releaseAll: (time) => v.allOff(time),
      dispose: () => {
        for (const p of v.parts) p.dispose();
        v.out.dispose();
      },
    };
    return instrument;
  },
};
