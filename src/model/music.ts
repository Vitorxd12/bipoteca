import { BEATS_PER_BAR, type Note, PPQ, TICKS_PER_BAR } from "./types";

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

/** 60 → "C4" (C4 = dó central). */
export function noteName(pitch: number): string {
  const octave = Math.floor(pitch / 12) - 1;
  return `${NAMES[pitch % 12]}${octave}`;
}

export function isBlackKey(pitch: number): boolean {
  const pc = pitch % 12;
  return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
}

export function midiToFreq(pitch: number): number {
  return 440 * 2 ** ((pitch - 69) / 12);
}

/** Posição em "compasso.tempo.tick" (base 1), como em qualquer DAW. */
export function formatPosition(ticks: number): string {
  const t = Math.max(0, Math.floor(ticks));
  const bar = Math.floor(t / TICKS_PER_BAR) + 1;
  const beat = Math.floor((t % TICKS_PER_BAR) / PPQ) + 1;
  const sub = Math.floor((t % PPQ) / (PPQ / 4)) + 1;
  return `${bar}.${beat}.${sub}`;
}

export type Snap = "1/4" | "1/8" | "1/16" | "1/32";
export const SNAPS: Snap[] = ["1/4", "1/8", "1/16", "1/32"];

export function snapTicks(snap: Snap): number {
  const div = Number(snap.split("/")[1]);
  return (PPQ * 4) / div;
}

export function snapDown(ticks: number, step: number): number {
  return Math.floor(ticks / step) * step;
}

export function snapRound(ticks: number, step: number): number {
  return Math.round(ticks / step) * step;
}

export function secondsPerTick(bpm: number): number {
  return 60 / (bpm * PPQ);
}

export const BAR = TICKS_PER_BAR;
export const BEAT = PPQ;
export { BEATS_PER_BAR };

/**
 * Notas que passam do limite de vozes (RF-69). Varre o pattern em ordem de
 * início e marca a nota mais antiga ainda soando quando o limite estoura,
 * imitando o roubo de voz do host.
 */
export function findOverflowNotes(notes: Note[], limit: number): Set<string> {
  const sorted = [...notes].sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  const active: Note[] = [];
  const overflow = new Set<string>();
  for (const n of sorted) {
    for (let i = active.length - 1; i >= 0; i--) {
      const a = active[i];
      if (a && a.start + a.duration <= n.start) active.splice(i, 1);
    }
    active.push(n);
    if (active.length > limit) {
      active.sort((a, b) => a.start - b.start);
      const stolen = active.shift();
      if (stolen) overflow.add(stolen.id);
    }
  }
  return overflow;
}
