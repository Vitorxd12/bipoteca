import { create } from "zustand";
import { clamp } from "@/lib/utils";
import { TICKS_PER_BAR } from "@/model/types";

/** Câmera da playlist, compartilhada entre régua, grade e cabeçalhos. */
interface PlaylistView {
  /** Tick na borda esquerda. */
  scrollX: number;
  /** Pixels rolados na vertical. */
  scrollY: number;
  pxPerTick: number;
  rowH: number;
  set: (p: Partial<Omit<PlaylistView, "set">>) => void;
}

export const PX_PER_TICK = { min: 0.02, max: 1.2 } as const;
export const ROW_H = { min: 40, max: 128 } as const;

export const usePlaylistView = create<PlaylistView>((set) => ({
  scrollX: -TICKS_PER_BAR * 0.25,
  scrollY: 0,
  // Celular começa mais afastado: cabe mais música na tela estreita.
  pxPerTick: typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches ? 0.08 : 0.17,
  rowH: 72,
  set: (p) =>
    set((s) => ({
      ...p,
      scrollX: p.scrollX !== undefined ? Math.max(-TICKS_PER_BAR * 0.5, p.scrollX) : s.scrollX,
      scrollY: p.scrollY !== undefined ? Math.max(0, p.scrollY) : s.scrollY,
      pxPerTick: p.pxPerTick !== undefined ? clamp(p.pxPerTick, PX_PER_TICK.min, PX_PER_TICK.max) : s.pxPerTick,
      rowH: p.rowH !== undefined ? clamp(p.rowH, ROW_H.min, ROW_H.max) : s.rowH,
    })),
}));

/** Zoom horizontal mantendo fixo o tick sob o cursor (x em px). */
export function zoomAt(x: number, factor: number): void {
  const v = usePlaylistView.getState();
  const tick = v.scrollX + x / v.pxPerTick;
  const ppt = clamp(v.pxPerTick * factor, PX_PER_TICK.min, PX_PER_TICK.max);
  v.set({ pxPerTick: ppt, scrollX: tick - x / ppt });
}

/** Pattern sendo arrastado da biblioteca (dataTransfer não é legível no dragover). */
export const libraryDrag: { patternId: string | null } = { patternId: null };
