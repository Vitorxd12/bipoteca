import { create } from "zustand";
import type { Snap } from "@/model/music";
import { PPQ, TICKS_PER_BAR } from "@/model/types";
import { useTransport } from "./transport";

export type EditorMode = "closed" | "split" | "full";
export type PlaylistSnap = "bar" | "beat" | "1/8" | "1/16" | "off";
/** Área que recebe os atalhos de teclado (Delete, Ctrl+D, setas...). */
export type FocusZone = "playlist" | "editor" | "library";

export type PickerTarget = { type: "track"; trackId: string } | { type: "row"; trackId: string; rowId: string };

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  resolve: (ok: boolean) => void;
}

interface UiState {
  openPatternId: string | null;
  /** Trilha que dá o som ao pattern aberto (a do clipe clicado, ou a de origem). */
  editorTrackId: string | null;
  editorMode: EditorMode;
  /** Fração da altura dada ao editor no modo split. */
  splitRatio: number;
  libraryOpen: boolean;
  playlistSnap: PlaylistSnap;
  editorSnap: Snap;
  selectedClipIds: string[];
  selectedNoteIds: string[];
  lastNoteLength: number;
  picker: PickerTarget | null;
  confirm: ConfirmRequest | null;
  zone: FocusZone;
  helpOpen: boolean;

  openPattern: (patternId: string, trackId: string, mode?: EditorMode) => void;
  closeEditor: () => void;
  setEditorMode: (m: EditorMode) => void;
  setSplitRatio: (r: number) => void;
  toggleLibrary: () => void;
  setPlaylistSnap: (s: PlaylistSnap) => void;
  setEditorSnap: (s: Snap) => void;
  selectClips: (ids: string[]) => void;
  selectNotes: (ids: string[]) => void;
  setLastNoteLength: (t: number) => void;
  openPicker: (t: PickerTarget) => void;
  closePicker: () => void;
  askConfirm: (req: Omit<ConfirmRequest, "resolve">) => Promise<boolean>;
  resolveConfirm: (ok: boolean) => void;
  setZone: (z: FocusZone) => void;
  setHelpOpen: (o: boolean) => void;
}

export const useUi = create<UiState>((set, get) => ({
  openPatternId: null,
  editorTrackId: null,
  editorMode: "closed",
  splitRatio: 0.48,
  libraryOpen: true,
  playlistSnap: "bar",
  editorSnap: "1/16",
  selectedClipIds: [],
  selectedNoteIds: [],
  lastNoteLength: PPQ / 2,
  picker: null,
  confirm: null,
  zone: "playlist",
  helpOpen: false,

  openPattern: (patternId, trackId, mode) =>
    set((s) => ({
      openPatternId: patternId,
      editorTrackId: trackId,
      editorMode: mode ?? (s.editorMode === "closed" ? "split" : s.editorMode),
      zone: "editor",
      selectedNoteIds: s.openPatternId === patternId ? s.selectedNoteIds : [],
    })),
  // Editor fechado: o que toca é sempre a música.
  closeEditor: () => {
    useTransport.getState().setMode("song");
    set({ editorMode: "closed", zone: "playlist" });
  },
  setEditorMode: (editorMode) => {
    if (editorMode === "closed") get().closeEditor();
    else set({ editorMode });
  },
  setSplitRatio: (r) => set({ splitRatio: Math.min(0.85, Math.max(0.2, r)) }),
  toggleLibrary: () => set((s) => ({ libraryOpen: !s.libraryOpen })),
  setPlaylistSnap: (playlistSnap) => set({ playlistSnap }),
  setEditorSnap: (editorSnap) => set({ editorSnap }),
  selectClips: (selectedClipIds) => set({ selectedClipIds }),
  selectNotes: (selectedNoteIds) => set({ selectedNoteIds }),
  setLastNoteLength: (lastNoteLength) => set({ lastNoteLength }),
  openPicker: (picker) => set({ picker }),
  closePicker: () => set({ picker: null }),
  askConfirm: (req) =>
    new Promise<boolean>((resolve) => {
      get().confirm?.resolve(false);
      set({ confirm: { ...req, resolve } });
    }),
  resolveConfirm: (ok) => {
    get().confirm?.resolve(ok);
    set({ confirm: null });
  },
  setZone: (zone) => {
    if (get().zone !== zone) set({ zone });
  },
  setHelpOpen: (helpOpen) => set({ helpOpen }),
}));

export const ui = () => useUi.getState();

/** Passo de encaixe da playlist em ticks ("off" = livre, 1 tick). */
export function playlistSnapTicks(s: PlaylistSnap): number {
  switch (s) {
    case "bar":
      return TICKS_PER_BAR;
    case "beat":
      return PPQ;
    case "1/8":
      return PPQ / 2;
    case "1/16":
      return PPQ / 4;
    default:
      return 1;
  }
}
