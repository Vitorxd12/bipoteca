/**
 * Limites técnicos (requisitos, seção 5). Existem para proteger o desempenho
 * no navegador, não para restringir a criação. Valores iniciais, a calibrar.
 */
export const LIMITS = {
  tracks: 32,
  kitRows: 32,
  voicesPerTrack: 16,
  voicesTotal: 64,
  patternBars: 64,
  songBars: 4000,
  notesPerPattern: 4000,
  bpmMin: 20,
  bpmMax: 300,
  pitchMin: 12, // C0
  pitchMax: 108, // C8
  undoSteps: 100,
} as const;

export type LimitKey = keyof typeof LIMITS;

export const LIMIT_LABELS: Record<LimitKey, string> = {
  tracks: `Limite de ${LIMITS.tracks} trilhas por projeto`,
  kitRows: `Limite de ${LIMITS.kitRows} linhas por kit`,
  voicesPerTrack: `Limite de ${LIMITS.voicesPerTrack} vozes por trilha`,
  voicesTotal: `Limite de ${LIMITS.voicesTotal} vozes no projeto`,
  patternBars: `Limite de ${LIMITS.patternBars} compassos por pattern`,
  songBars: `Limite de ${LIMITS.songBars} compassos na música`,
  notesPerPattern: `Limite de ${LIMITS.notesPerPattern} notas por pattern`,
  bpmMin: `BPM mínimo é ${LIMITS.bpmMin}`,
  bpmMax: `BPM máximo é ${LIMITS.bpmMax}`,
  pitchMin: "Nota mais grave é C0",
  pitchMax: "Nota mais aguda é C8",
  undoSteps: `Histórico guarda ${LIMITS.undoSteps} passos`,
};
