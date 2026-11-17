/**
 * Catálogo de presets e de kits prontos. Só metadados: o store e as telas
 * importam isto sem carregar nenhuma biblioteca de áudio.
 */
import type { PresetRef } from "@/model/types";
import type { PercGroup, PresetCategory, PresetInfo } from "./engine";

const p = (
  id: string,
  name: string,
  category: PresetCategory,
  description: string,
  defaultNote: number,
  group?: PercGroup,
): PresetInfo => ({ id, name, category, description, defaultNote, ...(group ? { group, oneShot: true } : {}) });

export const TONE_PRESETS: PresetInfo[] = [
  p("sub", "Sub Redondo", "baixo", "Seno grave e limpo", 36),
  p("acid", "Baixo Ácido", "baixo", "Serra com filtro ressonante", 36),
  p("fm-bass", "Baixo FM", "baixo", "Ataque metálico, corpo gordo", 36),

  p("saw-lead", "Lead Serra", "lead", "Serras desafinadas, brilhante", 72),
  p("square-lead", "Lead Quadrado", "lead", "Oco, cara de videogame", 72),

  p("glass-pad", "Pad Vidro", "pad", "Entrada lenta, larga", 60),
  p("warm-pad", "Pad Quente", "pad", "Triângulo macio com chorus", 60),

  p("epiano", "Piano Elétrico", "teclas", "FM estilo anos 80", 60),
  p("organ", "Órgão", "teclas", "Harmônicos somados", 60),
  p("pluck", "Pluck", "teclas", "Curto e percussivo", 60),

  p("kick", "Bumbo", "percussao", "Membrana grave, equilibrado", 36, "bumbo"),
  p("kick-808", "Bumbo 808", "percussao", "Grave longo que desce", 36, "bumbo"),
  p("kick-punch", "Bumbo Seco", "percussao", "Curto, com estalo", 36, "bumbo"),

  p("snare", "Caixa", "percussao", "Corpo + ruído", 38, "caixa"),
  p("snare-tight", "Caixa Seca", "percussao", "Curta e aguda", 38, "caixa"),
  p("rim", "Aro", "percussao", "Rimshot estalado", 37, "caixa"),
  p("clap", "Palma", "percussao", "Ruído filtrado em rajadas", 39, "caixa"),

  p("hat-closed", "Chimbal Fechado", "percussao", "Metálico curto", 42, "prato"),
  p("hat-open", "Chimbal Aberto", "percussao", "Metálico longo", 46, "prato"),
  p("crash", "Prato de Ataque", "percussao", "Explosão metálica longa", 49, "prato"),
  p("ride", "Condução", "percussao", "Sino metálico contínuo", 51, "prato"),

  p("tom", "Tom", "percussao", "Membrana média", 45, "perc"),
  p("tom-low", "Tom Grave", "percussao", "Membrana grave", 41, "perc"),
  p("conga", "Conga", "percussao", "Pele aguda e curta", 63, "perc"),
  p("cowbell", "Cowbell", "percussao", "Sino de vaca, clássico 808", 56, "perc"),
  p("shaker", "Chocalho", "percussao", "Ruído curto e aerado", 70, "perc"),
  p("clave", "Clave", "percussao", "Madeira, toque seco", 75, "perc"),

  p("zap", "Zap", "efeitos", "Laser descendente", 72, "fx"),
  p("sweep", "Varredura", "efeitos", "Ruído que abre e fecha", 60, "fx"),
  p("riser", "Subida", "efeitos", "Ruído que sobe, para viradas", 60, "fx"),
  p("impact", "Impacto", "efeitos", "Pancada grave com cauda", 36, "fx"),
  p("blip", "Blip", "efeitos", "Bipe curto e agudo", 84, "fx"),
];

export const DEFAULT_PRESETS = {
  instrument: { engine: "tone", preset: "epiano" } satisfies PresetRef,
  kitRow: { engine: "tone", preset: "kick" } satisfies PresetRef,
};

export interface KitPreset {
  id: string;
  name: string;
  description: string;
  rows: { name: string; preset: PresetRef }[];
}

const r = (name: string, preset: string) => ({ name, preset: { engine: "tone", preset } });

/** Kits prontos: um kit é qualquer conjunto de sons, não só bateria. */
export const KIT_PRESETS: KitPreset[] = [
  {
    id: "drums",
    name: "Bateria básica",
    description: "O essencial para qualquer batida",
    rows: [
      r("Bumbo", "kick"),
      r("Caixa", "snare"),
      r("Chimbal fechado", "hat-closed"),
      r("Chimbal aberto", "hat-open"),
      r("Palma", "clap"),
      r("Tom", "tom"),
    ],
  },
  {
    id: "808",
    name: "Eletrônica 808",
    description: "Grave comprido, palma e cowbell",
    rows: [
      r("Bumbo 808", "kick-808"),
      r("Palma", "clap"),
      r("Chimbal fechado", "hat-closed"),
      r("Chimbal aberto", "hat-open"),
      r("Aro", "rim"),
      r("Cowbell", "cowbell"),
      r("Tom grave", "tom-low"),
      r("Prato", "crash"),
    ],
  },
  {
    id: "seco",
    name: "Seco",
    description: "Curto e próximo, bom para lo-fi",
    rows: [
      r("Bumbo", "kick-punch"),
      r("Caixa", "snare-tight"),
      r("Chimbal", "hat-closed"),
      r("Chocalho", "shaker"),
      r("Aro", "rim"),
      r("Condução", "ride"),
    ],
  },
  {
    id: "perc",
    name: "Percussão",
    description: "Peles e madeiras, sem bumbo nem caixa",
    rows: [
      r("Conga", "conga"),
      r("Tom", "tom"),
      r("Tom grave", "tom-low"),
      r("Cowbell", "cowbell"),
      r("Clave", "clave"),
      r("Chocalho", "shaker"),
    ],
  },
  {
    id: "fx",
    name: "Efeitos",
    description: "Para transições e acentos",
    rows: [r("Subida", "riser"), r("Impacto", "impact"), r("Varredura", "sweep"), r("Zap", "zap"), r("Blip", "blip")],
  },
  { id: "empty", name: "Vazio", description: "Comece do zero", rows: [] },
];

export type KitTemplateId = string;

export const KIT_TEMPLATES: Record<string, KitPreset> = Object.fromEntries(KIT_PRESETS.map((k) => [k.id, k]));
