/** Atalhos globais. A área clicada por último (zona) decide o alvo de Del, Ctrl+D etc. */
import { useEffect } from "react";
import { host } from "./audio/host";
import {
  copyNotes,
  cutNotes,
  deleteSelectedNotes,
  duplicateNotes,
  nudgeSelected,
  pasteNotes,
  selectAllNotes,
  transposeSelected,
} from "./editor/commands";
import { getProject, redo, undo, useProject } from "./store/project";
import { useRouter } from "./store/router";
import { useUi } from "./store/ui";

function typing(e: KeyboardEvent): boolean {
  const t = e.target;
  return (
    t instanceof HTMLInputElement ||
    t instanceof HTMLTextAreaElement ||
    (t instanceof HTMLElement && t.isContentEditable)
  );
}

export function useShortcuts(): void {
  useEffect(() => {
    // O áudio só pode começar depois de um gesto: o primeiro clique já o liga.
    const unlock = () => void host.ensureStarted();
    window.addEventListener("pointerdown", unlock, { once: true });

    const onKey = (e: KeyboardEvent) => {
      if (typing(e)) return;
      const ui = useUi.getState();
      if (ui.picker || ui.kitBrowser || ui.confirm || ui.helpOpen) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      const editor = ui.zone === "editor" && ui.editorMode !== "closed" && ui.openPatternId;

      if (e.code === "Space") {
        e.preventDefault();
        void host.ensureStarted().then(() => host.togglePlay());
        return;
      }
      if (e.key === "Enter" && !mod) {
        e.preventDefault();
        host.stop();
        return;
      }
      if (mod && k === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && k === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === "?") {
        ui.setHelpOpen(true);
        return;
      }

      if (editor) {
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          deleteSelectedNotes();
          return;
        }
        if (mod && k === "d") {
          e.preventDefault();
          duplicateNotes();
          return;
        }
        if (mod && k === "c") {
          e.preventDefault();
          copyNotes();
          return;
        }
        if (mod && k === "x") {
          e.preventDefault();
          cutNotes();
          return;
        }
        if (mod && k === "v") {
          e.preventDefault();
          pasteNotes();
          return;
        }
        if (mod && k === "a") {
          e.preventDefault();
          selectAllNotes();
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          transposeSelected(e.shiftKey ? 12 : 1);
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          transposeSelected(e.shiftKey ? -12 : -1);
          return;
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          nudgeSelected(-1);
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          nudgeSelected(1);
          return;
        }
        if (e.key === "Escape") {
          if (ui.selectedNoteIds.length) ui.selectNotes([]);
          else ui.closeEditor();
          return;
        }
      } else {
        const ids = ui.selectedClipIds;
        if ((e.key === "Delete" || e.key === "Backspace") && ids.length) {
          e.preventDefault();
          useProject.getState().removeClips(ids);
          ui.selectClips([]);
          return;
        }
        if (mod && k === "d" && ids.length) {
          e.preventDefault();
          ui.selectClips(useProject.getState().duplicateClips(ids));
          return;
        }
        if (mod && k === "a") {
          e.preventDefault();
          ui.selectClips(getProject().clips.map((c) => c.id));
          return;
        }
        if (e.key === "Escape") {
          ui.selectClips([]);
          return;
        }
      }

      if (!mod && k === "b") ui.toggleLibrary();
      if (!mod && k === "e" && ui.openPatternId) {
        // Alterna entre a playlist e o editor do pattern aberto.
        if (useRouter.getState().screen.name === "pattern") ui.closeEditor();
        else
          ui.openPattern(
            ui.openPatternId,
            ui.editorTrackId ?? getProject().patterns[ui.openPatternId]?.homeTrackId ?? "",
          );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", unlock);
    };
  }, []);
}
