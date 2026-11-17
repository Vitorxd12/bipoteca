/**
 * Registro de engines. Cada engine é carregada sob demanda (import dinâmico):
 * adicionar ou remover uma engine é mexer na pasta dela e numa linha daqui.
 */
import type { PresetRef } from "@/model/types";
import type { InstrumentEngine, PresetInfo } from "./engine";
import { TONE_PRESETS } from "./presets";

interface EngineEntry {
  name: string;
  presets: PresetInfo[];
  load: () => Promise<InstrumentEngine>;
}

export const ENGINES: Record<string, EngineEntry> = {
  tone: { name: "Tone.js", presets: TONE_PRESETS, load: () => import("./engines/tone").then((m) => m.toneEngine) },
};

const loaded = new Map<string, Promise<InstrumentEngine>>();

export function loadEngine(id: string): Promise<InstrumentEngine> {
  const entry = ENGINES[id];
  if (!entry) return Promise.reject(new Error(`Engine desconhecida: ${id}`));
  let p = loaded.get(id);
  if (!p) {
    p = entry.load();
    loaded.set(id, p);
  }
  return p;
}

export function presetInfo(ref: PresetRef | null | undefined): PresetInfo | undefined {
  if (!ref) return undefined;
  return ENGINES[ref.engine]?.presets.find((p) => p.id === ref.preset);
}

export function allPresets(): { engine: string; preset: PresetInfo }[] {
  return Object.entries(ENGINES).flatMap(([engine, e]) => e.presets.map((preset) => ({ engine, preset })));
}

export const presetKey = (ref: PresetRef | null | undefined) => (ref ? `${ref.engine}:${ref.preset}` : "");
