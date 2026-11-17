/** Projeto de exemplo carregado na primeira abertura. */
import { KIT_TEMPLATES } from "@/audio/presets";
import { uid } from "@/lib/utils";
import { type Clip, type KitRow, type Note, type Pattern, PPQ, type Project, TICKS_PER_BAR, type Track } from "./types";

const S16 = PPQ / 4;
const note = (pitch: number, start: number, duration: number, velocity = 0.8): Note => ({
  id: uid("n"),
  pitch,
  start,
  duration,
  velocity,
});

export function demoProject(): Project {
  const kit: KitRow[] = KIT_TEMPLATES.drums.rows.map((r, i) => ({
    id: uid("r"),
    name: r.name,
    preset: r.preset,
    note: 36 + i,
    volume: 0.8,
    muted: false,
  }));
  const [kick, snare, hat, openHat, clap] = kit.map((r) => r.note) as [number, number, number, number, number];

  const drums: Track = {
    id: uid("tr"),
    name: "Bateria",
    kind: "kit",
    volume: 0.85,
    muted: false,
    solo: false,
    preset: null,
    kit,
  };
  const bass: Track = {
    id: uid("tr"),
    name: "Baixo",
    kind: "instrument",
    volume: 0.75,
    muted: false,
    solo: false,
    preset: { engine: "tone", preset: "acid" },
    kit: [],
  };
  const keys: Track = {
    id: uid("tr"),
    name: "Acordes",
    kind: "instrument",
    volume: 0.7,
    muted: false,
    solo: false,
    preset: { engine: "tone", preset: "epiano" },
    kit: [],
  };
  const lead: Track = {
    id: uid("tr"),
    name: "Melodia",
    kind: "instrument",
    volume: 0.6,
    muted: false,
    solo: false,
    preset: { engine: "tone", preset: "square-lead" },
    kit: [],
  };

  // Batida: bumbo nos tempos, caixa no 2 e 4, chimbal em colcheias.
  const beatNotes: Note[] = [];
  for (let i = 0; i < 16; i++) {
    const t = i * S16;
    if (i % 4 === 0) beatNotes.push(note(kick, t, S16, 0.95));
    if (i === 4 || i === 12) beatNotes.push(note(snare, t, S16, 0.9));
    if (i % 2 === 0) beatNotes.push(note(hat, t, S16, i % 4 === 0 ? 0.7 : 0.45));
    if (i === 14) beatNotes.push(note(openHat, t, S16, 0.6));
  }
  const fillNotes: Note[] = beatNotes.map((n) => ({ ...n, id: uid("n") }));
  for (const i of [12, 13, 14, 15]) fillNotes.push(note(clap, i * S16, S16, 0.5 + i * 0.03));

  // Am – F – C – G, uma por compasso.
  const prog = [
    [57, 60, 64],
    [53, 57, 60],
    [55, 60, 64],
    [55, 59, 62],
  ];
  const chordNotes = prog.flatMap((ch, bar) => ch.map((p) => note(p, bar * TICKS_PER_BAR, TICKS_PER_BAR - S16, 0.62)));
  const roots = [33, 29, 36, 31];
  const bassNotes = roots.flatMap((r, bar) =>
    [0, 3, 6, 8, 10, 14].map((s, i) =>
      note(i === 3 ? r + 12 : r, bar * TICKS_PER_BAR + s * S16, S16 * (i === 0 ? 2 : 1), i === 0 ? 0.95 : 0.7),
    ),
  );
  const melody = [76, 74, 72, 69, 72, 74, 76, 79, 77, 76, 74, 72, 71, 72, 74];
  const melodyNotes = melody.map((p, i) => note(p, i * PPQ, PPQ - S16 / 2, 0.75));

  const pat = (name: string, kind: Pattern["kind"], lengthBars: number, notes: Note[], home: Track): Pattern => ({
    id: uid("p"),
    name,
    kind,
    lengthBars,
    notes,
    homeTrackId: home.id,
  });

  const pBeat = pat("Batida", "kit", 1, beatNotes, drums);
  const pFill = pat("Virada", "kit", 1, fillNotes, drums);
  const pChords = pat("Progressão", "instrument", 4, chordNotes, keys);
  const pBass = pat("Linha de baixo", "instrument", 4, bassNotes, bass);
  const pMelody = pat("Tema", "instrument", 4, melodyNotes, lead);

  const clip = (p: Pattern, t: Track, bar: number): Clip => ({
    id: uid("c"),
    patternId: p.id,
    trackId: t.id,
    start: bar * TICKS_PER_BAR,
  });
  const clips: Clip[] = [
    clip(pChords, keys, 0),
    clip(pChords, keys, 4),
    clip(pChords, keys, 8),
    clip(pBass, bass, 4),
    clip(pBass, bass, 8),
    clip(pMelody, lead, 8),
  ];
  for (let bar = 4; bar < 12; bar++) clips.push(clip(bar % 4 === 3 ? pFill : pBeat, drums, bar));

  const patterns = [pBeat, pFill, pChords, pBass, pMelody];
  return {
    id: uid("prj"),
    name: "Primeira ideia",
    bpm: 112,
    tracks: [drums, bass, keys, lead],
    patterns: Object.fromEntries(patterns.map((p) => [p.id, p])),
    patternOrder: patterns.map((p) => p.id),
    clips,
    loop: { enabled: false, start: 4 * TICKS_PER_BAR, end: 8 * TICKS_PER_BAR },
  };
}
