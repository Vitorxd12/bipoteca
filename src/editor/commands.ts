/** Comandos de teclado do editor de notas (piano roll e kit). */
import { uid } from "@/lib/utils";
import { LIMIT_LABELS, LIMITS } from "@/model/limits";
import { snapTicks } from "@/model/music";
import { type Note, TICKS_PER_BAR } from "@/model/types";
import { toast } from "@/store/toast";
import { useUi } from "@/store/ui";
import { openPattern, setOpenNotes } from "./view";

let clipboard: Note[] = [];

const selection = (): Set<string> => new Set(useUi.getState().selectedNoteIds);

export function selectAllNotes(): void {
  const pat = openPattern();
  if (pat) useUi.getState().selectNotes(pat.notes.map((n) => n.id));
}

export function deleteSelectedNotes(): void {
  const pat = openPattern();
  const sel = selection();
  if (!pat || !sel.size) return;
  setOpenNotes(pat.notes.filter((n) => !sel.has(n.id)));
  useUi.getState().selectNotes([]);
}

export function copyNotes(): void {
  const pat = openPattern();
  const sel = selection();
  if (!pat || !sel.size) return;
  clipboard = pat.notes.filter((n) => sel.has(n.id)).map((n) => ({ ...n }));
}

export function cutNotes(): void {
  copyNotes();
  deleteSelectedNotes();
}

/** Cola logo depois do fim da seleção atual (ou no começo do pattern). */
export function pasteNotes(): void {
  const pat = openPattern();
  if (!pat || !clipboard.length) return;
  const sel = selection();
  const minStart = Math.min(...clipboard.map((n) => n.start));
  const selected = pat.notes.filter((n) => sel.has(n.id));
  const at = selected.length ? Math.max(...selected.map((n) => n.start + n.duration)) : 0;
  const step = snapTicks(useUi.getState().editorSnap);
  const base = Math.ceil(at / step) * step;
  const pasted = clipboard.map((n) => ({ ...n, id: uid("n"), start: base + (n.start - minStart) }));
  insert(pat.notes, pasted);
}

/** Duplica a seleção logo depois dela mesma. */
export function duplicateNotes(): void {
  const pat = openPattern();
  const sel = selection();
  if (!pat || !sel.size) return;
  const chosen = pat.notes.filter((n) => sel.has(n.id));
  const start = Math.min(...chosen.map((n) => n.start));
  const end = Math.max(...chosen.map((n) => n.start + n.duration));
  const step = snapTicks(useUi.getState().editorSnap);
  const span = Math.max(step, Math.ceil((end - start) / step) * step);
  insert(
    pat.notes,
    chosen.map((n) => ({ ...n, id: uid("n"), start: n.start + span })),
  );
}

function insert(existing: Note[], added: Note[]): void {
  const pat = openPattern();
  if (!pat) return;
  const len = pat.lengthBars * TICKS_PER_BAR;
  const inside = added.filter((n) => n.start < len);
  if (inside.length < added.length) toast("Parte das notas caiu depois do fim do pattern e foi descartada", "warn");
  if (existing.length + inside.length > LIMITS.notesPerPattern) {
    toast(LIMIT_LABELS.notesPerPattern, "warn");
    return;
  }
  setOpenNotes([...existing, ...inside]);
  useUi.getState().selectNotes(inside.map((n) => n.id));
}

/** Transpõe a seleção (piano roll). Não passa dos limites C0–C8. */
export function transposeSelected(semitones: number): void {
  const pat = openPattern();
  const sel = selection();
  if (!pat || !sel.size || pat.kind === "kit") return;
  const chosen = pat.notes.filter((n) => sel.has(n.id));
  const lo = Math.min(...chosen.map((n) => n.pitch));
  const hi = Math.max(...chosen.map((n) => n.pitch));
  if (lo + semitones < LIMITS.pitchMin) {
    toast(LIMIT_LABELS.pitchMin, "warn");
    return;
  }
  if (hi + semitones > LIMITS.pitchMax) {
    toast(LIMIT_LABELS.pitchMax, "warn");
    return;
  }
  setOpenNotes(pat.notes.map((n) => (sel.has(n.id) ? { ...n, pitch: n.pitch + semitones } : n)));
}

/** Move a seleção no tempo pelo passo da grade. */
export function nudgeSelected(dir: -1 | 1): void {
  const pat = openPattern();
  const sel = selection();
  if (!pat || !sel.size) return;
  const step = snapTicks(useUi.getState().editorSnap) * dir;
  const len = pat.lengthBars * TICKS_PER_BAR;
  const chosen = pat.notes.filter((n) => sel.has(n.id));
  if (chosen.some((n) => n.start + step < 0 || n.start + step >= len)) return;
  setOpenNotes(pat.notes.map((n) => (sel.has(n.id) ? { ...n, start: n.start + step } : n)));
}
