import { create } from "zustand";
import { clamp } from "@/lib/utils";
import { LIMITS } from "@/model/limits";
import { type Note, type Pattern, TICKS_PER_BAR } from "@/model/types";
import { getProject, useProject } from "@/store/project";
import { useTransport } from "@/store/transport";
import { useUi } from "@/store/ui";

/** Câmera do editor (piano roll e kit), compartilhada com régua e velocity. */
interface EditorView {
  scrollX: number;
  /** Rolagem vertical do piano roll, em px a partir da nota mais aguda. */
  scrollY: number;
  /** Rolagem vertical do editor de kit. */
  kitScrollY: number;
  pxPerTick: number;
  keyH: number;
  set: (p: Partial<Omit<EditorView, "set">>) => void;
}

export const EDITOR_PPT = { min: 0.08, max: 3 } as const;
export const KEY_H = { min: 8, max: 30 } as const;
export const KIT_ROW_H = 34;
export const KEYS_W = 64;
export const KIT_HEADER_W = 320;
export const VELOCITY_H = 78;
export const EDITOR_RULER_H = 26;

export const PITCH_COUNT = LIMITS.pitchMax - LIMITS.pitchMin + 1;

export const useEditorView = create<EditorView>((set) => ({
  scrollX: -24,
  scrollY: 0,
  kitScrollY: 0,
  pxPerTick: 0.9,
  keyH: 15,
  set: (p) =>
    set((s) => ({
      ...p,
      scrollX: p.scrollX !== undefined ? Math.max(-96, p.scrollX) : s.scrollX,
      scrollY: p.scrollY !== undefined ? Math.max(0, p.scrollY) : s.scrollY,
      kitScrollY: p.kitScrollY !== undefined ? Math.max(0, p.kitScrollY) : s.kitScrollY,
      pxPerTick: p.pxPerTick !== undefined ? clamp(p.pxPerTick, EDITOR_PPT.min, EDITOR_PPT.max) : s.pxPerTick,
      keyH: p.keyH !== undefined ? clamp(p.keyH, KEY_H.min, KEY_H.max) : s.keyH,
    })),
}));

export function editorZoomAt(x: number, factor: number): void {
  const v = useEditorView.getState();
  const tick = v.scrollX + x / v.pxPerTick;
  const ppt = clamp(v.pxPerTick * factor, EDITOR_PPT.min, EDITOR_PPT.max);
  v.set({ pxPerTick: ppt, scrollX: tick - x / ppt });
}

/** Ajusta o zoom para o pattern inteiro caber na largura. */
export function fitPattern(width: number): void {
  const pat = openPattern();
  if (!pat || width <= 0) return;
  const len = pat.lengthBars * TICKS_PER_BAR;
  useEditorView.getState().set({ pxPerTick: clamp((width - 40) / len, EDITOR_PPT.min, EDITOR_PPT.max), scrollX: -12 });
}

/** Rola o piano roll para centralizar as notas (ou C4). */
export function centerPiano(height: number): void {
  const pat = openPattern();
  const v = useEditorView.getState();
  let mid = 60;
  if (pat?.notes.length) {
    const ps = pat.notes.map((n) => n.pitch);
    mid = (Math.min(...ps) + Math.max(...ps)) / 2;
  }
  v.set({ scrollY: (LIMITS.pitchMax - mid) * v.keyH - height / 2 });
}

export function openPattern(): Pattern | undefined {
  const id = useUi.getState().openPatternId;
  return id ? getProject().patterns[id] : undefined;
}

export function setOpenNotes(notes: Note[]): void {
  const id = useUi.getState().openPatternId;
  if (id) useProject.getState().setNotes(id, notes);
}

/** Posição do cursor dentro do pattern aberto, ou null se não estiver tocando nele. */
export function localPlayhead(tick: number): number | null {
  const pat = openPattern();
  if (!pat) return null;
  const len = pat.lengthBars * TICKS_PER_BAR;
  if (useTransport.getState().mode === "pattern") return ((tick % len) + len) % len;
  const trackId = useUi.getState().editorTrackId;
  const clip = getProject().clips.find(
    (c) => c.patternId === pat.id && (!trackId || c.trackId === trackId) && tick >= c.start && tick < c.start + len,
  );
  return clip ? tick - clip.start : null;
}

/** Pattern aberto, reativo à troca de pattern e às edições. */
export function useOpenPattern(): Pattern | undefined {
  const id = useUi((s) => s.openPatternId);
  return useProject((s) => (id ? s.project.patterns[id] : undefined));
}
