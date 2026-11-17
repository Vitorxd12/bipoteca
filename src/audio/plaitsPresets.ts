/**
 * Presets do Plaits (Mutable Instruments, port em Rust, MIT). Só metadados.
 *
 * Motores (firmware 1.2): 0 VA+filtro · 1 distorção de fase · 2-4 FM 6-op ·
 * 5 wave terrain · 6 string machine · 7 chiptune · 8 VA clássico ·
 * 9 waveshaping · 10 FM 2-op · 11 formante · 12 aditivo · 13 wavetable ·
 * 14 acordes · 15 fala · 16 enxame · 17 ruído · 18 partículas ·
 * 19 corda · 20 modal · 21 bumbo · 22 caixa · 23 chimbal
 */
import type { PercGroup, PresetCategory, PresetInfo } from "./engine";

export interface PlaitsPatch {
  engine: number;
  harmonics: number;
  timbre: number;
  morph: number;
  decay: number;
  lpgColour: number;
  /** true: segura enquanto a nota dura (VCA). false: golpeia e decai. */
  sustained: boolean;
  attack: number;
  release: number;
  gain: number;
}

interface Def {
  id: string;
  name: string;
  category: PresetCategory;
  description: string;
  note: number;
  group?: PercGroup;
  patch: Partial<PlaitsPatch> & Pick<PlaitsPatch, "engine">;
}

const BASE: Omit<PlaitsPatch, "engine"> = {
  harmonics: 0.5,
  timbre: 0.5,
  morph: 0.5,
  // No modo sustentado, decay baixo faz o low pass gate fechar logo depois do soltar.
  decay: 0.15,
  lpgColour: 0.5,
  sustained: true,
  attack: 0.004,
  // Sustentados: soltura do envelope. Percussivos: fade ao soltar a nota.
  release: 0.08,
  gain: 0.8,
};

const DEFS: Def[] = [
  // ------------------------------------------------------------- baixos
  {
    id: "bass-sub",
    name: "Sub Profundo",
    category: "baixo",
    description: "Quase senoidal, grave que se sente",
    note: 36,
    patch: { engine: 0, harmonics: 0.0, timbre: 0.2, morph: 0.0, lpgColour: 0.0, release: 0.05, gain: 1 },
  },
  {
    id: "bass-analog",
    name: "Baixo Analógico",
    category: "baixo",
    description: "Serra com filtro e sub, gordo",
    note: 36,
    patch: { engine: 0, harmonics: 0.25, timbre: 0.32, morph: 0.65, lpgColour: 0.3, release: 0.05 },
  },
  {
    id: "bass-acid",
    name: "Baixo Ácido",
    category: "baixo",
    description: "Filtro ressonante que morde",
    note: 36,
    patch: { engine: 0, harmonics: 0.8, timbre: 0.42, morph: 0.4, lpgColour: 0.8, release: 0.05, gain: 0.7 },
  },
  {
    id: "bass-fm",
    name: "Baixo FM",
    category: "baixo",
    description: "Ataque metálico, corpo redondo",
    note: 36,
    patch: { engine: 10, harmonics: 0.25, timbre: 0.35, morph: 0.2, lpgColour: 0.5, release: 0.05 },
  },
  {
    id: "bass-pd",
    name: "Baixo Distorcido",
    category: "baixo",
    description: "Distorção de fase, áspero e moderno",
    note: 36,
    patch: { engine: 1, harmonics: 0.3, timbre: 0.55, morph: 0.35, lpgColour: 0.4, release: 0.05, gain: 0.7 },
  },
  {
    id: "bass-fold",
    name: "Baixo Dobrado",
    category: "baixo",
    description: "Wavefolder: grave com brilho de borracha",
    note: 36,
    patch: { engine: 9, harmonics: 0.15, timbre: 0.35, morph: 0.55, lpgColour: 0.3, release: 0.05, gain: 0.8 },
  },
  {
    id: "bass-pluck",
    name: "Baixo Dedilhado",
    category: "baixo",
    description: "Corda modelada, como um baixo tocado",
    note: 36,
    patch: {
      engine: 19,
      harmonics: 0.2,
      timbre: 0.35,
      morph: 0.6,
      decay: 0.55,
      lpgColour: 0.3,
      sustained: false,
      gain: 1,
    },
  },
  {
    id: "bass-808",
    name: "Baixo 808",
    category: "baixo",
    description: "Bumbo afinado e longo, de trap",
    note: 36,
    patch: {
      engine: 21,
      harmonics: 0.25,
      timbre: 0.25,
      morph: 0.85,
      decay: 0.75,
      lpgColour: 0.0,
      sustained: false,
      gain: 1,
    },
  },
  {
    id: "bass-chip",
    name: "Baixo 8-bit",
    category: "baixo",
    description: "Pulso de videogame",
    note: 36,
    patch: {
      engine: 7,
      harmonics: 0.0,
      timbre: 0.5,
      morph: 0.0,
      decay: 0.45,
      lpgColour: 0.2,
      sustained: false,
      release: 0.05,
      gain: 0.6,
    },
  },

  // -------------------------------------------------------------- leads
  {
    id: "lead-va",
    name: "Lead Analógico",
    category: "lead",
    description: "Duas serras desafinadas",
    note: 72,
    patch: { engine: 8, harmonics: 0.3, timbre: 0.6, morph: 0.75, lpgColour: 0.6, release: 0.2, gain: 0.55 },
  },
  {
    id: "lead-wt",
    name: "Lead Wavetable",
    category: "lead",
    description: "Timbre digital que muda de cor",
    note: 72,
    patch: { engine: 13, harmonics: 0.4, timbre: 0.45, morph: 0.55, lpgColour: 0.6, release: 0.2, gain: 0.55 },
  },
  {
    id: "lead-voice",
    name: "Lead Vocal",
    category: "lead",
    description: "Formantes, quase uma voz",
    note: 67,
    patch: {
      engine: 11,
      harmonics: 0.4,
      timbre: 0.5,
      morph: 0.5,
      lpgColour: 0.5,
      attack: 0.02,
      release: 0.25,
      gain: 0.6,
    },
  },

  // --------------------------------------------------------------- pads
  {
    id: "pad-strings",
    name: "Cordas Sintéticas",
    category: "pad",
    description: "String machine dos anos 70",
    note: 60,
    patch: {
      engine: 6,
      harmonics: 0.0,
      timbre: 0.55,
      morph: 0.5,
      lpgColour: 0.7,
      attack: 0.35,
      release: 0.18,
      gain: 0.5,
    },
  },
  {
    id: "pad-swarm",
    name: "Pad Enxame",
    category: "pad",
    description: "Muitas vozes desafinadas, largo",
    note: 60,
    patch: {
      engine: 16,
      harmonics: 0.4,
      timbre: 0.4,
      morph: 0.4,
      lpgColour: 0.7,
      attack: 0.5,
      release: 0.18,
      gain: 0.45,
    },
  },
  {
    id: "pad-chords",
    name: "Pad Acordes",
    category: "pad",
    description: "Cada nota vira um acorde menor",
    note: 60,
    patch: {
      engine: 14,
      harmonics: 0.3,
      timbre: 0.4,
      morph: 0.4,
      lpgColour: 0.7,
      attack: 0.3,
      release: 0.18,
      gain: 0.4,
    },
  },

  // ------------------------------------------------------------- teclas
  {
    id: "keys-bell",
    name: "Sino Modal",
    category: "teclas",
    description: "Ressonador de metal golpeado",
    note: 72,
    patch: { engine: 20, harmonics: 0.6, timbre: 0.6, morph: 0.6, decay: 0.6, sustained: false, gain: 0.9 },
  },
  {
    id: "keys-string",
    name: "Corda Dedilhada",
    category: "teclas",
    description: "Harpa / violão sintético",
    note: 60,
    patch: { engine: 19, harmonics: 0.15, timbre: 0.6, morph: 0.5, decay: 0.5, sustained: false, gain: 0.9 },
  },

  // ---------------------------------------------------------- percussão
  {
    id: "drum-kick",
    name: "Bumbo Plaits",
    category: "percussao",
    group: "bumbo",
    description: "Bumbo analógico modelado",
    note: 36,
    patch: { engine: 21, harmonics: 0.4, timbre: 0.4, morph: 0.4, decay: 0.4, sustained: false, gain: 1 },
  },
  {
    id: "drum-snare",
    name: "Caixa Plaits",
    category: "percussao",
    group: "caixa",
    description: "Caixa analógica modelada",
    note: 50,
    patch: { engine: 22, harmonics: 0.5, timbre: 0.5, morph: 0.5, decay: 0.4, sustained: false, gain: 0.9 },
  },
  {
    id: "drum-hat",
    name: "Chimbal Plaits",
    category: "percussao",
    group: "prato",
    description: "Metálico, curto",
    note: 72,
    patch: { engine: 23, harmonics: 0.5, timbre: 0.6, morph: 0.3, decay: 0.3, sustained: false, gain: 0.6 },
  },
  {
    id: "drum-hat-open",
    name: "Chimbal Aberto Plaits",
    category: "percussao",
    group: "prato",
    description: "Metálico, longo",
    note: 72,
    patch: { engine: 23, harmonics: 0.5, timbre: 0.6, morph: 0.6, decay: 0.6, sustained: false, gain: 0.5 },
  },
];

/**
 * Nível de saída de cada preset, medido renderizando o WASM no Node
 * (native/plaits/tools/normalize.mjs): sustentados em -15 dB RMS,
 * percussivos com pico 0,6 na velocity 0,8. Refazer ao mudar um patch.
 */
const LEVEL: Record<string, number> = {
  "bass-sub": 0.22,
  "bass-analog": 0.61,
  "bass-acid": 0.32,
  "bass-fm": 0.6,
  "bass-pd": 0.36,
  "bass-fold": 0.64,
  "bass-pluck": 6,
  "bass-808": 2.06,
  "bass-chip": 1.88,
  "lead-va": 0.46,
  "lead-wt": 0.88,
  "lead-voice": 0.34,
  "pad-strings": 1.48,
  "pad-swarm": 1.11,
  "pad-chords": 0.92,
  "keys-bell": 0.7,
  "keys-string": 3,
  "drum-kick": 1.94,
  "drum-snare": 1.6,
  "drum-hat": 1.21,
  "drum-hat-open": 1.18,
};

export const PLAITS_PATCHES: Record<string, PlaitsPatch> = Object.fromEntries(
  DEFS.map((d) => [d.id, { ...BASE, ...d.patch, gain: LEVEL[d.id] ?? d.patch.gain ?? BASE.gain }]),
);

export const PLAITS_PRESETS: PresetInfo[] = DEFS.map((d) => ({
  id: d.id,
  name: d.name,
  category: d.category,
  description: d.description,
  defaultNote: d.note,
  source: "Plaits",
  ...(d.group ? { group: d.group, oneShot: true } : {}),
}));
