/**
 * Catálogo de presets. Só metadados: o store e as telas importam isto sem
 * carregar nenhuma biblioteca de áudio.
 */
import type { PresetRef } from "@/model/types";
import type { PresetInfo } from "./engine";

export const TONE_PRESETS: PresetInfo[] = [
  { id: "sub", name: "Sub Redondo", category: "baixo", description: "Seno grave e limpo", defaultNote: 36 },
  { id: "acid", name: "Baixo Ácido", category: "baixo", description: "Serra com filtro ressonante", defaultNote: 36 },
  { id: "fm-bass", name: "Baixo FM", category: "baixo", description: "Ataque metálico, corpo gordo", defaultNote: 36 },

  {
    id: "saw-lead",
    name: "Lead Serra",
    category: "lead",
    description: "Serras desafinadas, brilhante",
    defaultNote: 72,
  },
  {
    id: "square-lead",
    name: "Lead Quadrado",
    category: "lead",
    description: "Oco, cara de videogame",
    defaultNote: 72,
  },

  { id: "glass-pad", name: "Pad Vidro", category: "pad", description: "Entrada lenta, larga", defaultNote: 60 },
  { id: "warm-pad", name: "Pad Quente", category: "pad", description: "Triângulo macio com chorus", defaultNote: 60 },

  { id: "epiano", name: "Piano Elétrico", category: "teclas", description: "FM estilo anos 80", defaultNote: 60 },
  { id: "organ", name: "Órgão", category: "teclas", description: "Harmônicos somados", defaultNote: 60 },
  { id: "pluck", name: "Pluck", category: "teclas", description: "Curto e percussivo", defaultNote: 60 },

  { id: "kick", name: "Bumbo", category: "percussao", description: "Membrana grave", defaultNote: 36, oneShot: true },
  { id: "snare", name: "Caixa", category: "percussao", description: "Corpo + ruído", defaultNote: 38, oneShot: true },
  {
    id: "hat-closed",
    name: "Chimbal Fechado",
    category: "percussao",
    description: "Metálico curto",
    defaultNote: 42,
    oneShot: true,
  },
  {
    id: "hat-open",
    name: "Chimbal Aberto",
    category: "percussao",
    description: "Metálico longo",
    defaultNote: 46,
    oneShot: true,
  },
  { id: "clap", name: "Palma", category: "percussao", description: "Ruído filtrado", defaultNote: 39, oneShot: true },
  { id: "tom", name: "Tom", category: "percussao", description: "Membrana média", defaultNote: 45, oneShot: true },

  { id: "zap", name: "Zap", category: "efeitos", description: "Laser descendente", defaultNote: 72, oneShot: true },
  {
    id: "sweep",
    name: "Varredura",
    category: "efeitos",
    description: "Ruído que abre e fecha",
    defaultNote: 60,
    oneShot: true,
  },
];

export const DEFAULT_PRESETS = {
  instrument: { engine: "tone", preset: "epiano" } satisfies PresetRef,
  kitRow: { engine: "tone", preset: "kick" } satisfies PresetRef,
};

export type KitTemplateId = "empty" | "drums";

export const KIT_TEMPLATES: Record<KitTemplateId, { name: string; rows: { name: string; preset: PresetRef }[] }> = {
  empty: { name: "Vazio", rows: [] },
  drums: {
    name: "Bateria básica",
    rows: [
      { name: "Bumbo", preset: { engine: "tone", preset: "kick" } },
      { name: "Caixa", preset: { engine: "tone", preset: "snare" } },
      { name: "Chimbal fechado", preset: { engine: "tone", preset: "hat-closed" } },
      { name: "Chimbal aberto", preset: { engine: "tone", preset: "hat-open" } },
      { name: "Palma", preset: { engine: "tone", preset: "clap" } },
      { name: "Tom", preset: { engine: "tone", preset: "tom" } },
    ],
  },
};
