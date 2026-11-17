import { temporal } from "zundo";
import { create, useStore } from "zustand";
import { DEFAULT_PRESETS, KIT_TEMPLATES, type KitTemplateId } from "@/audio/presets";
import { clamp, uid } from "@/lib/utils";
import { matchKitRows } from "@/model/kitMatch";
import { LIMIT_LABELS, LIMITS } from "@/model/limits";
import {
  type Clip,
  type KitRow,
  type Note,
  type Pattern,
  type PresetRef,
  type Project,
  TICKS_PER_BAR,
  type Track,
  type TrackKind,
} from "@/model/types";
import { toast } from "./toast";

/** Primeira nota MIDI atribuída às linhas de kit; as próximas são sequenciais. */
const KIT_BASE_NOTE = 36;

function limitHit(key: keyof typeof LIMITS): void {
  toast(LIMIT_LABELS[key], "warn");
}

function nextKitNote(rows: KitRow[]): number {
  const used = new Set(rows.map((r) => r.note));
  let n = KIT_BASE_NOTE;
  while (used.has(n)) n++;
  return n;
}

function makeKitRows(template: KitTemplateId): KitRow[] {
  const rows: KitRow[] = [];
  for (const t of KIT_TEMPLATES[template]?.rows ?? []) {
    rows.push({
      id: uid("r"),
      name: t.name,
      preset: t.preset,
      note: nextKitNote(rows),
      volume: 0.8,
      muted: false,
    });
  }
  return rows;
}

function songEndTicks(p: Project): number {
  let end = 0;
  for (const c of p.clips) {
    const pat = p.patterns[c.patternId];
    if (pat) end = Math.max(end, c.start + pat.lengthBars * TICKS_PER_BAR);
  }
  return end;
}

export interface ProjectActions {
  replaceProject: (p: Project) => void;
  renameProject: (name: string) => void;
  setBpm: (bpm: number) => void;
  setLoop: (loop: Partial<Project["loop"]>) => void;

  addTrack: (kind: TrackKind, template?: KitTemplateId) => string | null;
  updateTrack: (id: string, patch: Partial<Pick<Track, "name" | "volume" | "muted" | "solo" | "preset">>) => void;
  moveTrack: (id: string, toIndex: number) => void;
  removeTrack: (id: string) => void;

  addKitRow: (trackId: string) => void;
  updateKitRow: (trackId: string, rowId: string, patch: Partial<Omit<KitRow, "id" | "note">>) => void;
  moveKitRow: (trackId: string, rowId: string, toIndex: number) => void;
  removeKitRow: (trackId: string, rowId: string) => void;

  createPatternAt: (trackId: string, start: number) => string | null;
  /** Pattern novo só na biblioteca, sem clipe (o usuário posiciona depois). */
  createPattern: (trackId: string) => string | null;
  /**
   * Troca os sons do kit mantendo as notas MIDI das linhas por posição:
   * as batidas já escritas continuam tocando, agora com os sons novos.
   */
  loadKit: (trackId: string, rows: { name: string; preset: PresetRef }[]) => void;
  renamePattern: (id: string, name: string) => void;
  duplicatePattern: (id: string) => string | null;
  removePattern: (id: string) => void;
  setPatternLength: (id: string, bars: number) => void;
  setNotes: (patternId: string, notes: Note[]) => void;

  addClip: (patternId: string, trackId: string, start: number) => string | null;
  /** Vários clipes numa entrada só do histórico (arrastar copiando). */
  addClips: (list: { patternId: string; trackId: string; start: number }[]) => string[];
  moveClips: (moves: { id: string; start: number; trackId: string }[]) => void;
  duplicateClips: (ids: string[]) => string[];
  removeClips: (ids: string[]) => void;
  makeClipUnique: (clipId: string) => string | null;
}

export type ProjectState = { project: Project } & ProjectActions;

function nextPatternName(p: Project, kind: TrackKind): string {
  const base = kind === "kit" ? "Batida" : "Pattern";
  let i = 1;
  const names = new Set(Object.values(p.patterns).map((x) => x.name));
  while (names.has(`${base} ${i}`)) i++;
  return `${base} ${i}`;
}

export const useProject = create<ProjectState>()(
  temporal(
    (set, get) => {
      const update = (fn: (p: Project) => Project) => set((s) => ({ project: fn(s.project) }));

      return {
        project: emptyProject(),

        replaceProject: (project) => set({ project }),
        renameProject: (name) => update((p) => ({ ...p, name: name.trim() || p.name })),
        setBpm: (bpm) => {
          if (bpm < LIMITS.bpmMin) limitHit("bpmMin");
          if (bpm > LIMITS.bpmMax) limitHit("bpmMax");
          update((p) => ({ ...p, bpm: Math.round(clamp(bpm, LIMITS.bpmMin, LIMITS.bpmMax) * 10) / 10 }));
        },
        setLoop: (loop) => update((p) => ({ ...p, loop: { ...p.loop, ...loop } })),

        addTrack: (kind, template = "empty") => {
          const p = get().project;
          if (p.tracks.length >= LIMITS.tracks) {
            limitHit("tracks");
            return null;
          }
          const count = p.tracks.filter((t) => t.kind === kind).length + 1;
          const track: Track = {
            id: uid("tr"),
            name: kind === "kit" ? `Kit ${count}` : `Instrumento ${count}`,
            kind,
            volume: 0.8,
            muted: false,
            solo: false,
            preset: kind === "instrument" ? DEFAULT_PRESETS.instrument : null,
            kit: kind === "kit" ? makeKitRows(template) : [],
          };
          update((pr) => ({ ...pr, tracks: [...pr.tracks, track] }));
          return track.id;
        },
        updateTrack: (id, patch) =>
          update((p) => ({ ...p, tracks: p.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
        moveTrack: (id, toIndex) =>
          update((p) => {
            const tracks = [...p.tracks];
            const from = tracks.findIndex((t) => t.id === id);
            if (from < 0) return p;
            const [t] = tracks.splice(from, 1);
            if (!t) return p;
            tracks.splice(clamp(toIndex, 0, tracks.length), 0, t);
            return { ...p, tracks };
          }),
        removeTrack: (id) =>
          update((p) => {
            const clips = p.clips.filter((c) => c.trackId !== id);
            // Patterns que nasceram nesta trilha e ficaram sem clipe somem junto.
            const patterns: Record<string, Pattern> = {};
            for (const [pid, pat] of Object.entries(p.patterns)) {
              const used = clips.some((c) => c.patternId === pid);
              if (pat.homeTrackId === id && !used) continue;
              if (pat.homeTrackId === id) {
                const other = clips.find((c) => c.patternId === pid);
                patterns[pid] = { ...pat, homeTrackId: other?.trackId ?? pat.homeTrackId };
              } else patterns[pid] = pat;
            }
            return {
              ...p,
              tracks: p.tracks.filter((t) => t.id !== id),
              clips,
              patterns,
              patternOrder: p.patternOrder.filter((pid) => patterns[pid]),
            };
          }),

        addKitRow: (trackId) => {
          const t = get().project.tracks.find((x) => x.id === trackId);
          if (!t) return;
          if (t.kit.length >= LIMITS.kitRows) {
            limitHit("kitRows");
            return;
          }
          const row: KitRow = {
            id: uid("r"),
            name: `Som ${t.kit.length + 1}`,
            preset: DEFAULT_PRESETS.kitRow,
            note: nextKitNote(t.kit),
            volume: 0.8,
            muted: false,
          };
          update((p) => ({
            ...p,
            tracks: p.tracks.map((x) => (x.id === trackId ? { ...x, kit: [...x.kit, row] } : x)),
          }));
        },
        updateKitRow: (trackId, rowId, patch) =>
          update((p) => ({
            ...p,
            tracks: p.tracks.map((t) =>
              t.id === trackId ? { ...t, kit: t.kit.map((r) => (r.id === rowId ? { ...r, ...patch } : r)) } : t,
            ),
          })),
        moveKitRow: (trackId, rowId, toIndex) =>
          update((p) => ({
            ...p,
            tracks: p.tracks.map((t) => {
              if (t.id !== trackId) return t;
              const kit = [...t.kit];
              const from = kit.findIndex((r) => r.id === rowId);
              const [r] = kit.splice(from, 1);
              if (!r) return t;
              kit.splice(clamp(toIndex, 0, kit.length), 0, r);
              return { ...t, kit };
            }),
          })),
        removeKitRow: (trackId, rowId) =>
          update((p) => {
            const track = p.tracks.find((t) => t.id === trackId);
            const row = track?.kit.find((r) => r.id === rowId);
            if (!track || !row) return p;
            // Remove as notas da linha nos patterns tocados por esta trilha.
            const patternIds = new Set(p.clips.filter((c) => c.trackId === trackId).map((c) => c.patternId));
            for (const pat of Object.values(p.patterns)) if (pat.homeTrackId === trackId) patternIds.add(pat.id);
            const patterns = { ...p.patterns };
            for (const pid of patternIds) {
              const pat = patterns[pid];
              if (pat) patterns[pid] = { ...pat, notes: pat.notes.filter((n) => n.pitch !== row.note) };
            }
            return {
              ...p,
              patterns,
              tracks: p.tracks.map((t) => (t.id === trackId ? { ...t, kit: t.kit.filter((r) => r.id !== rowId) } : t)),
            };
          }),

        createPatternAt: (trackId, start) => {
          const p = get().project;
          const track = p.tracks.find((t) => t.id === trackId);
          if (!track) return null;
          const lengthBars = 1;
          if (start + lengthBars * TICKS_PER_BAR > LIMITS.songBars * TICKS_PER_BAR) {
            limitHit("songBars");
            return null;
          }
          const pattern: Pattern = {
            id: uid("p"),
            name: nextPatternName(p, track.kind),
            kind: track.kind,
            lengthBars,
            notes: [],
            homeTrackId: trackId,
          };
          const clip: Clip = { id: uid("c"), patternId: pattern.id, trackId, start };
          update((pr) => ({
            ...pr,
            patterns: { ...pr.patterns, [pattern.id]: pattern },
            patternOrder: [...pr.patternOrder, pattern.id],
            clips: [...pr.clips, clip],
          }));
          return pattern.id;
        },
        createPattern: (trackId) => {
          const p = get().project;
          const track = p.tracks.find((t) => t.id === trackId);
          if (!track) return null;
          const pattern: Pattern = {
            id: uid("p"),
            name: nextPatternName(p, track.kind),
            kind: track.kind,
            lengthBars: track.kind === "kit" ? 1 : 2,
            notes: [],
            homeTrackId: trackId,
          };
          update((pr) => ({
            ...pr,
            patterns: { ...pr.patterns, [pattern.id]: pattern },
            patternOrder: [...pr.patternOrder, pattern.id],
          }));
          return pattern.id;
        },
        loadKit: (trackId, rows) => {
          const track = get().project.tracks.find((t) => t.id === trackId);
          if (!track) return;
          if (rows.length > LIMITS.kitRows) limitHit("kitRows");
          const wanted = rows.slice(0, LIMITS.kitRows);
          // Cada som novo herda a linha antiga que faz o mesmo papel (e as notas dela).
          const { pairs, lost } = matchKitRows(track.kit, wanted);
          const kit: KitRow[] = [];
          for (const [i, r] of wanted.entries()) {
            const old = pairs[i];
            kit.push({
              id: old?.id ?? uid("r"),
              name: r.name,
              preset: r.preset,
              note: old?.note ?? nextKitNote([...track.kit, ...kit]),
              volume: old?.volume ?? 0.8,
              muted: false,
            });
          }
          update((p) => {
            // Linhas antigas sem par somem junto com as notas delas.
            const removed = new Set(lost.map((r) => r.note));
            const patterns = { ...p.patterns };
            if (removed.size) {
              const ids = new Set(p.clips.filter((c) => c.trackId === trackId).map((c) => c.patternId));
              for (const pat of Object.values(p.patterns)) if (pat.homeTrackId === trackId) ids.add(pat.id);
              for (const id of ids) {
                const pat = patterns[id];
                if (pat) patterns[id] = { ...pat, notes: pat.notes.filter((n) => !removed.has(n.pitch)) };
              }
            }
            return { ...p, patterns, tracks: p.tracks.map((t) => (t.id === trackId ? { ...t, kit } : t)) };
          });
        },
        renamePattern: (id, name) =>
          update((p) => {
            const pat = p.patterns[id];
            if (!pat || !name.trim()) return p;
            return { ...p, patterns: { ...p.patterns, [id]: { ...pat, name: name.trim() } } };
          }),
        duplicatePattern: (id) => {
          const p = get().project;
          const pat = p.patterns[id];
          if (!pat) return null;
          const copy: Pattern = {
            ...pat,
            id: uid("p"),
            name: `${pat.name} (cópia)`,
            notes: pat.notes.map((n) => ({ ...n, id: uid("n") })),
          };
          update((pr) => {
            const order = [...pr.patternOrder];
            order.splice(order.indexOf(id) + 1, 0, copy.id);
            return { ...pr, patterns: { ...pr.patterns, [copy.id]: copy }, patternOrder: order };
          });
          return copy.id;
        },
        removePattern: (id) =>
          update((p) => {
            const patterns = { ...p.patterns };
            delete patterns[id];
            return {
              ...p,
              patterns,
              patternOrder: p.patternOrder.filter((x) => x !== id),
              clips: p.clips.filter((c) => c.patternId !== id),
            };
          }),
        setPatternLength: (id, bars) => {
          if (bars > LIMITS.patternBars) limitHit("patternBars");
          const lengthBars = clamp(Math.round(bars), 1, LIMITS.patternBars);
          update((p) => {
            const pat = p.patterns[id];
            if (!pat) return p;
            return { ...p, patterns: { ...p.patterns, [id]: { ...pat, lengthBars } } };
          });
        },
        setNotes: (patternId, notes) => {
          if (notes.length > LIMITS.notesPerPattern) {
            limitHit("notesPerPattern");
            return;
          }
          update((p) => {
            const pat = p.patterns[patternId];
            if (!pat) return p;
            return { ...p, patterns: { ...p.patterns, [patternId]: { ...pat, notes } } };
          });
        },

        addClip: (patternId, trackId, start) => {
          const p = get().project;
          const pat = p.patterns[patternId];
          const track = p.tracks.find((t) => t.id === trackId);
          if (!pat || !track) return null;
          if (pat.kind !== track.kind) {
            toast(
              pat.kind === "kit"
                ? "Pattern de kit só entra em trilha de kit"
                : "Pattern de instrumento só entra em trilha de instrumento",
              "warn",
            );
            return null;
          }
          if (start + pat.lengthBars * TICKS_PER_BAR > LIMITS.songBars * TICKS_PER_BAR) {
            limitHit("songBars");
            return null;
          }
          const clip: Clip = { id: uid("c"), patternId, trackId, start: Math.max(0, start) };
          update((pr) => ({ ...pr, clips: [...pr.clips, clip] }));
          return clip.id;
        },
        addClips: (list) => {
          const p = get().project;
          const ok = list.filter((c) => {
            const pat = p.patterns[c.patternId];
            const track = p.tracks.find((t) => t.id === c.trackId);
            return pat && track && pat.kind === track.kind;
          });
          if (
            ok.some(
              (c) =>
                c.start + (p.patterns[c.patternId]?.lengthBars ?? 1) * TICKS_PER_BAR > LIMITS.songBars * TICKS_PER_BAR,
            )
          ) {
            limitHit("songBars");
            return [];
          }
          const clips = ok.map((c) => ({ ...c, id: uid("c"), start: Math.max(0, c.start) }));
          update((pr) => ({ ...pr, clips: [...pr.clips, ...clips] }));
          return clips.map((c) => c.id);
        },
        moveClips: (moves) =>
          update((p) => {
            const byId = new Map(moves.map((m) => [m.id, m]));
            return {
              ...p,
              clips: p.clips.map((c) => {
                const m = byId.get(c.id);
                return m ? { ...c, start: Math.max(0, m.start), trackId: m.trackId } : c;
              }),
            };
          }),
        duplicateClips: (ids) => {
          const p = get().project;
          const sel = p.clips.filter((c) => ids.includes(c.id));
          if (!sel.length) return [];
          const minStart = Math.min(...sel.map((c) => c.start));
          const maxEnd = Math.max(
            ...sel.map((c) => c.start + (p.patterns[c.patternId]?.lengthBars ?? 1) * TICKS_PER_BAR),
          );
          const offset = maxEnd - minStart;
          if (maxEnd + offset > LIMITS.songBars * TICKS_PER_BAR) {
            limitHit("songBars");
            return [];
          }
          const copies = sel.map((c) => ({ ...c, id: uid("c"), start: c.start + offset }));
          update((pr) => ({ ...pr, clips: [...pr.clips, ...copies] }));
          return copies.map((c) => c.id);
        },
        removeClips: (ids) => update((p) => ({ ...p, clips: p.clips.filter((c) => !ids.includes(c.id)) })),
        makeClipUnique: (clipId) => {
          const p = get().project;
          const clip = p.clips.find((c) => c.id === clipId);
          const pat = clip && p.patterns[clip.patternId];
          if (!clip || !pat) return null;
          const copy: Pattern = {
            ...pat,
            id: uid("p"),
            name: `${pat.name} (única)`,
            notes: pat.notes.map((n) => ({ ...n, id: uid("n") })),
            homeTrackId: clip.trackId,
          };
          update((pr) => {
            const order = [...pr.patternOrder];
            order.splice(order.indexOf(pat.id) + 1, 0, copy.id);
            return {
              ...pr,
              patterns: { ...pr.patterns, [copy.id]: copy },
              patternOrder: order,
              clips: pr.clips.map((c) => (c.id === clipId ? { ...c, patternId: copy.id } : c)),
            };
          });
          return copy.id;
        },
      };
    },
    {
      limit: LIMITS.undoSteps,
      partialize: (s) => ({ project: s.project }),
      equality: (a, b) => a.project === b.project,
    },
  ),
);

type TemporalState = ReturnType<typeof useProject.temporal.getState>;

export function useHistory<T>(selector: (s: TemporalState) => T): T {
  return useStore(useProject.temporal, selector);
}

export const undo = () => useProject.temporal.getState().undo();
export const redo = () => useProject.temporal.getState().redo();

export function emptyProject(): Project {
  return {
    id: uid("prj"),
    name: "Sem título",
    bpm: 120,
    tracks: [],
    patterns: {},
    patternOrder: [],
    clips: [],
    loop: { enabled: false, start: 0, end: 4 * TICKS_PER_BAR },
  };
}

export { songEndTicks };

export const getProject = () => useProject.getState().project;
export const projectActions = (): ProjectActions => useProject.getState();

export type { PresetRef };

/**
 * Gestos contínuos (arrastar notas, clipes, loop...) atualizam o store ao vivo
 * mas viram uma única entrada no histórico de desfazer.
 */
let gestureBase: Project | null = null;

export function beginGesture(): void {
  if (gestureBase) return;
  gestureBase = useProject.getState().project;
  useProject.temporal.getState().pause();
}

export function endGesture(): void {
  const before = gestureBase;
  if (!before) return;
  gestureBase = null;
  const after = useProject.getState().project;
  if (after === before) {
    useProject.temporal.getState().resume();
    return;
  }
  useProject.setState({ project: before });
  useProject.temporal.getState().resume();
  useProject.setState({ project: after });
}
