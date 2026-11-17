/**
 * Fronteira entre o app e qualquer biblioteca de áudio (requisitos, seção 8.3).
 * O app nunca fala com Tone.js, smplr, Faust etc. diretamente: só com isto.
 */

export type PresetCategory = "baixo" | "lead" | "pad" | "teclas" | "percussao" | "efeitos";

export const CATEGORY_LABELS: Record<PresetCategory, string> = {
  baixo: "Baixo",
  lead: "Lead",
  pad: "Pad",
  teclas: "Teclas",
  percussao: "Percussão",
  efeitos: "Efeitos",
};

export interface PresetInfo {
  id: string;
  name: string;
  category: PresetCategory;
  /** Frase curta para o seletor. */
  description: string;
  /** Nota tocada quando o preset é usado numa linha de kit ou na pré-escuta. */
  defaultNote: number;
  /** Percussivo: a nota dura o próprio decaimento, a duração escrita é ignorada. */
  oneShot?: boolean;
  /** Família dentro da percussão, para organizar o seletor dos kits. */
  group?: PercGroup;
}

export type PercGroup = "bumbo" | "caixa" | "prato" | "perc" | "fx";

export const GROUP_LABELS: Record<PercGroup, string> = {
  bumbo: "Bumbos",
  caixa: "Caixas e palmas",
  prato: "Chimbais e pratos",
  perc: "Percussão",
  fx: "Efeitos",
};

export interface Instrument {
  /** Saída ligada no canal da trilha (ou da linha do kit). */
  output: AudioNode;
  noteOn(note: number, velocity: number, time: number): void;
  noteOff(note: number, time: number): void;
  /** Solta todas as notas (stop, troca de preset). */
  releaseAll(time: number): void;
  /** Vozes soando agora (diagnóstico). Opcional: nem toda engine sabe. */
  activeVoices?(): number;
  dispose(): void;
}

export interface InstrumentEngine {
  id: string;
  name: string;
  presets: PresetInfo[];
  create(ctx: BaseAudioContext, presetId: string): Promise<Instrument>;
}
