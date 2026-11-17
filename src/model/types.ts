/** Ticks por semínima. Compasso fixo em 4/4. */
export const PPQ = 96;
export const BEATS_PER_BAR = 4;
export const TICKS_PER_BAR = PPQ * BEATS_PER_BAR;

export type TrackKind = "instrument" | "kit";

export interface PresetRef {
  engine: string;
  preset: string;
}

export interface Note {
  id: string;
  /** Nota MIDI. Em trilha de kit, é a nota da linha. */
  pitch: number;
  /** Início em ticks, relativo ao pattern. */
  start: number;
  /** Duração em ticks. */
  duration: number;
  /** 0–1 */
  velocity: number;
}

export interface Pattern {
  id: string;
  name: string;
  kind: TrackKind;
  lengthBars: number;
  notes: Note[];
  /** Trilha onde o pattern nasceu; define o kit/instrumento usado ao editar fora da playlist. */
  homeTrackId: string;
}

export interface Clip {
  id: string;
  patternId: string;
  trackId: string;
  /** Início em ticks. */
  start: number;
}

export interface KitRow {
  id: string;
  name: string;
  preset: PresetRef;
  /** Nota MIDI fixa, atribuída automaticamente e invisível na interface. */
  note: number;
  /** 0–1 */
  volume: number;
  muted: boolean;
}

export interface Track {
  id: string;
  name: string;
  kind: TrackKind;
  /** 0–1 */
  volume: number;
  muted: boolean;
  solo: boolean;
  /** Só em trilha de instrumento. */
  preset: PresetRef | null;
  /** Só em trilha de kit. */
  kit: KitRow[];
}

export interface LoopRegion {
  enabled: boolean;
  start: number;
  end: number;
}

export interface Project {
  id: string;
  name: string;
  bpm: number;
  tracks: Track[];
  patterns: Record<string, Pattern>;
  patternOrder: string[];
  clips: Clip[];
  loop: LoopRegion;
}

export const patternLengthTicks = (p: Pattern): number => p.lengthBars * TICKS_PER_BAR;
