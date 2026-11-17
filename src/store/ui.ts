import { create } from "zustand";
import type { Snap } from "@/model/music";
import { PPQ, TICKS_PER_BAR } from "@/model/types";
import { back, go, type Screen, useRouter } from "./router";
import { useTransport } from "./transport";

export type EditorMode = "closed" | "split" | "full";
export type PlaylistSnap = "bar" | "beat" | "1/8" | "1/16" | "off";
/** Área que recebe os atalhos de teclado (Delete, Ctrl+D, setas...). */
export type FocusZone = "playlist" | "editor" | "library";

export type PickerTarget = { type: "track"; trackId: string } | { type: "row"; trackId: string; rowId: string };

/** Navegador de kits: criar trilha nova ou trocar o kit de uma trilha. */
export type KitBrowserTarget = { mode: "create" } | { mode: "replace"; trackId: string };

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
  kitBrowser: KitBrowserTarget | null;
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
  openKitBrowser: (t: KitBrowserTarget) => void;
  closeKitBrowser: () => void;
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
  libraryOpen: false,
  playlistSnap: "bar",
  editorSnap: "1/16",
  selectedClipIds: [],
  selectedNoteIds: [],
  lastNoteLength: PPQ / 2,
  picker: null,
  kitBrowser: null,
  confirm: null,
  zone: "playlist",
  helpOpen: false,

  // Navegação: cada uma destas ações leva a uma tela (store/router.ts).
  openPattern: (patternId, trackId) => {
    set((st) => ({
      openPatternId: patternId,
      editorTrackId: trackId,
      zone: "editor",
      selectedNoteIds: st.openPatternId === patternId ? st.selectedNoteIds : [],
    }));
    const cur = useRouter.getState().screen;
    // Trocar de pattern dentro do editor não empilha telas.
    go({ name: "pattern", patternId, trackId }, { replace: cur.name === "pattern" });
  },
  closeEditor: () => {
    if (useRouter.getState().screen.name === "pattern") back();
  },
  setEditorMode: (editorMode) => {
    if (editorMode === "closed") get().closeEditor();
  },
  setSplitRatio: () => {},
  toggleLibrary: () => {
    if (useRouter.getState().screen.name === "patterns") back();
    else go({ name: "patterns" });
  },
  setPlaylistSnap: (playlistSnap) => set({ playlistSnap }),
  setEditorSnap: (editorSnap) => set({ editorSnap }),
  selectClips: (selectedClipIds) => set({ selectedClipIds }),
  selectNotes: (selectedNoteIds) => set({ selectedNoteIds }),
  setLastNoteLength: (lastNoteLength) => set({ lastNoteLength }),
  openPicker: (t) => {
    const cur = useRouter.getState().screen;
    const next: Screen =
      t.type === "row" ? { name: "sound", trackId: t.trackId, rowId: t.rowId } : { name: "sound", trackId: t.trackId };
    // Trocar de linha dentro do seletor não empilha telas.
    go(next, { replace: cur.name === "sound" });
  },
  closePicker: () => {
    if (useRouter.getState().screen.name === "sound") back();
  },
  openKitBrowser: (t) => go(t.mode === "replace" ? { name: "kits", trackId: t.trackId } : { name: "kits" }),
  closeKitBrowser: () => {
    if (useRouter.getState().screen.name === "kits") back();
  },
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
  setHelpOpen: (open) => {
    const onHelp = useRouter.getState().screen.name === "help";
    if (open && !onHelp) go({ name: "help" });
    if (!open && onHelp) back();
  },
}));

export const ui = () => useUi.getState();

/** O estado da UI segue a tela atual (inclusive ao usar o "voltar" do navegador). */
function syncFromScreen(screen: Screen): void {
  const st = useUi.getState();
  const patch: Partial<UiState> = {
    picker:
      screen.name === "sound"
        ? screen.rowId
          ? { type: "row", trackId: screen.trackId, rowId: screen.rowId }
          : { type: "track", trackId: screen.trackId }
        : null,
    kitBrowser:
      screen.name === "kits"
        ? screen.trackId
          ? { mode: "replace", trackId: screen.trackId }
          : { mode: "create" }
        : null,
    helpOpen: screen.name === "help",
    libraryOpen: screen.name === "patterns",
    editorMode: screen.name === "pattern" ? "full" : "closed",
  };
  if (screen.name === "pattern") {
    patch.openPatternId = screen.patternId;
    patch.editorTrackId = screen.trackId;
    patch.zone = "editor";
  } else if (screen.name === "playlist") patch.zone = "playlist";
  useUi.setState(patch);
  // Fora do editor, o que toca é sempre a música.
  if (screen.name !== "pattern" && useTransport.getState().mode === "pattern") useTransport.getState().setMode("song");
  void st;
}
syncFromScreen(useRouter.getState().screen);
useRouter.subscribe((s, prev) => {
  if (s.screen !== prev.screen) syncFromScreen(s.screen);
});

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
