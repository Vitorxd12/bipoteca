/**
 * Sons sampleados. Só metadados (o seletor lista sem baixar nada).
 *
 * Baterias: samples de domínio público de máquinas clássicas
 * (github.com/smpldsnds/drum-machines). Instrumentos: banco FluidR3_GM (MIT),
 * tocado pelo smplr.
 */
import type { PresetRef } from "@/model/types";
import type { PercGroup, PresetCategory, PresetInfo } from "./engine";

export const DRUM_BASE = "https://smpldsnds.github.io/drum-machines";

export interface DrumMachineDef {
  id: string;
  dir: string;
  label: string;
  description: string;
  hits: { id: string; name: string; group: PercGroup; note: number; gainDb?: number }[];
}

const h = (id: string, name: string, group: PercGroup, note: number, gainDb = 0) => ({ id, name, group, note, gainDb });

export const DRUM_MACHINES: DrumMachineDef[] = [
  {
    id: "tr808",
    dir: "TR-808",
    label: "TR-808",
    description: "Roland, 1980: o grave e a palma do hip-hop e do eletrônico",
    hits: [
      h("kick/bd2550", "Bumbo", "bumbo", 36),
      h("kick/bd5075", "Bumbo longo", "bumbo", 35),
      h("snare/sd2550", "Caixa", "caixa", 38),
      h("snare/sd5075", "Caixa aberta", "caixa", 40),
      h("clap/cp", "Palma", "caixa", 39),
      h("rimshot/rs", "Aro", "caixa", 37),
      h("hihat-close/ch", "Chimbal fechado", "prato", 42, -3),
      h("hihat-open/oh25", "Chimbal aberto", "prato", 46, -3),
      h("cymbal/cy5050", "Prato", "prato", 49, -4),
      h("tom-low/lt50", "Tom grave", "perc", 41),
      h("mid-tom/mt50", "Tom médio", "perc", 45),
      h("tom-hi/ht50", "Tom agudo", "perc", 48),
      h("conga-low/lc50", "Conga grave", "perc", 64),
      h("conga-hi/hc50", "Conga aguda", "perc", 63),
      h("cowbell/cb", "Cowbell", "perc", 56, -3),
      h("clave/cl", "Clave", "perc", 75, -3),
      h("maraca/ma", "Maraca", "perc", 70, -3),
    ],
  },
  {
    id: "lm2",
    dir: "LM-2",
    label: "LM-2",
    description: "Linn LM-2, 1982: bateria acústica sampleada dos anos 80",
    hits: [
      h("kick", "Bumbo", "bumbo", 36),
      h("kick-alt", "Bumbo 2", "bumbo", 35),
      h("snare-m", "Caixa", "caixa", 38),
      h("snare-h", "Caixa aguda", "caixa", 40),
      h("stick-m", "Aro", "caixa", 37),
      h("clap", "Palma", "caixa", 39),
      h("hhclosed", "Chimbal fechado", "prato", 42, -3),
      h("hhopen", "Chimbal aberto", "prato", 46, -3),
      h("crash", "Prato de ataque", "prato", 49, -5),
      h("ride", "Condução", "prato", 51, -5),
      h("tom-l", "Tom grave", "perc", 41),
      h("tom-m", "Tom médio", "perc", 45),
      h("tom-h", "Tom agudo", "perc", 48),
      h("conga-l", "Conga grave", "perc", 64),
      h("conga-h", "Conga aguda", "perc", 63),
      h("cowbell", "Cowbell", "perc", 56, -3),
      h("tambourine", "Pandeirola", "perc", 54, -3),
      h("cabasa", "Cabasa", "perc", 69, -3),
    ],
  },
  {
    id: "rz1",
    dir: "Casio-RZ1",
    label: "RZ-1",
    description: "Casio RZ-1, 1986: crocante, de 12 bits",
    hits: [
      h("kick", "Bumbo", "bumbo", 36),
      h("snare", "Caixa", "caixa", 38),
      h("clap", "Palma", "caixa", 39),
      h("hihat-closed", "Chimbal fechado", "prato", 42, -3),
      h("hihat-open", "Chimbal aberto", "prato", 46, -3),
      h("crash", "Prato de ataque", "prato", 49, -5),
      h("ride", "Condução", "prato", 51, -5),
      h("tom-3", "Tom grave", "perc", 41),
      h("tom-2", "Tom médio", "perc", 45),
      h("tom-1", "Tom agudo", "perc", 48),
      h("cowbell", "Cowbell", "perc", 56, -3),
      h("clave", "Clave", "perc", 75, -3),
    ],
  },
  {
    id: "mfb512",
    dir: "MFB-512",
    label: "MFB-512",
    description: "MFB-512: analógico seco e duro",
    hits: [
      h("kick", "Bumbo", "bumbo", 36),
      h("snare", "Caixa", "caixa", 38),
      h("clap", "Palma", "caixa", 39),
      h("hihat-closed", "Chimbal fechado", "prato", 42, -3),
      h("hihat-open", "Chimbal aberto", "prato", 46, -3),
      h("cymbal", "Prato", "prato", 49, -5),
      h("tom-low", "Tom grave", "perc", 41),
      h("tom-mid", "Tom médio", "perc", 45),
      h("tom-hi", "Tom agudo", "perc", 48),
    ],
  },
  {
    id: "cr8000",
    dir: "Roland-CR-8000",
    label: "CR-8000",
    description: "Roland CR-8000, 1981: suave, de caixinha de ritmos",
    hits: [
      h("kick", "Bumbo", "bumbo", 36),
      h("snare", "Caixa", "caixa", 38),
      h("rimshot", "Aro", "caixa", 37),
      h("clap", "Palma", "caixa", 39),
      h("hihat-closed", "Chimbal fechado", "prato", 42, -3),
      h("hihat-open", "Chimbal aberto", "prato", 46, -3),
      h("cymball", "Prato", "prato", 49, -5),
      h("tom-low", "Tom grave", "perc", 41),
      h("tom-high", "Tom agudo", "perc", 48),
      h("conga-low", "Conga grave", "perc", 64),
      h("conga-high", "Conga aguda", "perc", 63),
      h("cowbell", "Cowbell", "perc", 56, -3),
      h("clave", "Clave", "perc", 75, -3),
    ],
  },
];

export interface SoundfontDef {
  id: string;
  instrument: string;
  name: string;
  category: PresetCategory;
  description: string;
  defaultNote: number;
  gainDb?: number;
}

export const SOUNDFONTS: SoundfontDef[] = [
  {
    id: "piano",
    instrument: "acoustic_grand_piano",
    name: "Piano de Cauda",
    category: "teclas",
    description: "Piano acústico",
    defaultNote: 60,
  },
  {
    id: "epiano-sf",
    instrument: "electric_piano_1",
    name: "Piano Rhodes",
    category: "teclas",
    description: "Elétrico, macio",
    defaultNote: 60,
  },
  {
    id: "organ-sf",
    instrument: "church_organ",
    name: "Órgão de Tubos",
    category: "teclas",
    description: "Igreja, cheio",
    defaultNote: 60,
    gainDb: -4,
  },
  {
    id: "marimba",
    instrument: "marimba",
    name: "Marimba",
    category: "teclas",
    description: "Madeira percutida",
    defaultNote: 72,
  },
  {
    id: "vibraphone",
    instrument: "vibraphone",
    name: "Vibrafone",
    category: "teclas",
    description: "Metal com vibrato",
    defaultNote: 72,
  },
  {
    id: "guitar",
    instrument: "acoustic_guitar_nylon",
    name: "Violão",
    category: "teclas",
    description: "Nylon dedilhado",
    defaultNote: 60,
  },
  {
    id: "strings",
    instrument: "string_ensemble_1",
    name: "Cordas",
    category: "pad",
    description: "Naipe de cordas",
    defaultNote: 60,
  },
  {
    id: "synth-strings",
    instrument: "synth_strings_1",
    name: "Cordas Sintéticas",
    category: "pad",
    description: "Anos 80, largas",
    defaultNote: 60,
  },
  {
    id: "choir",
    instrument: "choir_aahs",
    name: "Coro",
    category: "pad",
    description: 'Vozes em "aah"',
    defaultNote: 60,
  },
  {
    id: "warm-pad-sf",
    instrument: "pad_2_warm",
    name: "Pad Analógico",
    category: "pad",
    description: "Quente e lento",
    defaultNote: 60,
  },
  {
    id: "upright",
    instrument: "acoustic_bass",
    name: "Baixo Acústico",
    category: "baixo",
    description: "Contrabaixo de jazz",
    defaultNote: 36,
  },
  {
    id: "finger-bass",
    instrument: "electric_bass_finger",
    name: "Baixo Elétrico",
    category: "baixo",
    description: "Tocado com os dedos",
    defaultNote: 36,
  },
  { id: "flute", instrument: "flute", name: "Flauta", category: "lead", description: "Sopro leve", defaultNote: 72 },
  {
    id: "trumpet",
    instrument: "trumpet",
    name: "Trompete",
    category: "lead",
    description: "Metal brilhante",
    defaultNote: 67,
  },
  {
    id: "sax",
    instrument: "alto_sax",
    name: "Sax Alto",
    category: "lead",
    description: "Sopro com corpo",
    defaultNote: 67,
  },
];

export const SAMPLE_PRESETS: PresetInfo[] = [
  ...SOUNDFONTS.map((s) => ({
    id: `sf:${s.id}`,
    name: s.name,
    category: s.category,
    description: s.description,
    defaultNote: s.defaultNote,
    source: "Sampleado",
    sampled: true,
  })),
  ...DRUM_MACHINES.flatMap((m) =>
    m.hits.map((hit) => ({
      id: `dm:${m.id}:${hit.id}`,
      name: `${hit.name} ${m.label}`,
      category: "percussao" as const,
      description: m.description.split(":")[0] ?? m.label,
      defaultNote: hit.note,
      group: hit.group,
      oneShot: true,
      source: m.label,
      sampled: true,
    })),
  ),
];

/** Kit pronto com todos os sons de uma máquina, na ordem de uso mais comum. */
export function machineKit(m: DrumMachineDef): { name: string; preset: PresetRef }[] {
  return m.hits.map((hit) => ({ name: hit.name, preset: { engine: "samples", preset: `dm:${m.id}:${hit.id}` } }));
}
