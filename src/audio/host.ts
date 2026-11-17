/**
 * Host de áudio: um AudioContext, um relógio, um mixer.
 *
 * - Um relógio só: este sequenciador decide quando cada nota toca e chama
 *   noteOn/noteOff com horário exato. Nenhuma engine sequencia sozinha.
 * - Agendamento com antecedência (~200 ms) disparado pelo ticker do Tone.js,
 *   que roda num Worker e não é estrangulado quando a aba perde o foco.
 * - Lê o projeto direto do store a cada janela: edições durante a reprodução
 *   valem na hora, sem reconstruir nada.
 * - Polifonia contada aqui (RF-69), igual para qualquer engine.
 */
import type * as ToneNS from "tone";

/**
 * Tone.js é carregado sob demanda no primeiro gesto (ensureStarted): a tela
 * abre sem esperar a biblioteca de áudio. Só é usado depois de iniciado.
 */
let Tone: typeof ToneNS;

import { LIMITS } from "@/model/limits";
import { secondsPerTick } from "@/model/music";
import { type Note, PPQ, type PresetRef, type Project, TICKS_PER_BAR, type Track } from "@/model/types";
import { getProject, songEndTicks, useProject } from "@/store/project";
import { toast } from "@/store/toast";
import { useTransport } from "@/store/transport";
import { useUi } from "@/store/ui";
import type { Instrument } from "./engine";
import { loadEngine, presetInfo, presetKey } from "./registry";

/** Antecedência do agendamento: tolera engasgos de até ~150 ms na thread principal. */
const LOOKAHEAD = 0.2;
const INTERVAL = 0.025;

interface Slot {
  key: string;
  token: number;
  instrument: Instrument | null;
  ready: Promise<Instrument | null>;
}

interface ActiveVoice {
  pitch: number;
  end: number;
  play: number;
  slot: Slot;
}

interface RowNode {
  gain: ToneNS.Gain;
  slot: Slot;
}

interface TrackNode {
  kind: Track["kind"];
  channel: ToneNS.Channel;
  slot: Slot | null;
  rows: Map<string, RowNode>;
  voices: ActiveVoice[];
}

interface Anchor {
  time: number;
  tick: number;
  spt: number;
}

let slotToken = 0;

/**
 * Índice das notas de cada pattern, ordenadas pelo início. O array de notas é
 * imutável no store, então ele mesmo serve de chave: editou, o índice refaz.
 */
const sortedNotes = new WeakMap<Note[], Note[]>();

function notesStartingIn(notes: Note[], from: number, to: number): Note[] {
  if (to <= from || !notes.length) return [];
  let sorted = sortedNotes.get(notes);
  if (!sorted) {
    sorted = [...notes].sort((x, y) => x.start - y.start);
    sortedNotes.set(notes, sorted);
  }
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((sorted[mid]?.start ?? 0) < from) lo = mid + 1;
    else hi = mid;
  }
  const out: Note[] = [];
  for (let i = lo; i < sorted.length; i++) {
    const n = sorted[i];
    if (!n || n.start >= to) break;
    out.push(n);
  }
  return out;
}

class AudioHost {
  private started = false;
  private starting: Promise<void> | null = null;
  private master!: ToneNS.Volume;
  private tracks = new Map<string, TrackNode>();
  private metro: ToneNS.Synth | null = null;
  private previewDest: ToneNS.Gain | null = null;

  private playing = false;
  private timer: number | null = null;
  private generation = 0;
  private schedTime = 0;
  private schedTick = 0;
  private anchors: Anchor[] = [];

  /** Inicia o áudio. Precisa de um gesto do usuário (política dos navegadores). */
  ensureStarted(): Promise<void> {
    if (this.started) return Promise.resolve();
    if (!this.starting) {
      this.starting = (async () => {
        Tone = await import("tone");
        // "balanced": buffers um pouco maiores que "interactive" e bem menos estalos
        // quando a máquina aperta. Como tudo é agendado com antecedência, a latência
        // extra não atrasa a música; só a pré-escuta, e pouco.
        Tone.setContext(new Tone.Context({ latencyHint: "balanced", lookAhead: 0 }));
        await Tone.start();
        // Master: compressor leve de "cola" antes do limitador; deixa a mistura mais encorpada.
        const limiter = new Tone.Limiter(-1).toDestination();
        const glue = new Tone.Compressor({ threshold: -18, ratio: 2.5, attack: 0.012, release: 0.18, knee: 8 }).connect(
          limiter,
        );
        this.master = new Tone.Volume(-2).connect(glue);
        this.previewDest = new Tone.Gain(1).connect(this.master);
        this.metro = new Tone.Synth({
          oscillator: { type: "square" },
          envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
          volume: -14,
        }).connect(this.master);
        this.started = true;
        this.sync(getProject());
        useProject.subscribe((s, prev) => {
          if (s.project !== prev.project) this.sync(s.project);
        });
        useTransport.getState().setAudioReady();
      })();
    }
    return this.starting;
  }

  private get now(): number {
    return Tone.getContext().currentTime;
  }

  // ---------------------------------------------------------------- mixer

  private makeSlot(ref: PresetRef | null, dest: ToneNS.ToneAudioNode, prev?: Slot | null): Slot {
    const key = presetKey(ref);
    if (prev && prev.key === key) return prev;
    if (prev) this.retire(prev);
    const token = ++slotToken;
    const slot: Slot = { key, token, instrument: null, ready: Promise.resolve(null) };
    if (!ref) return slot;
    slot.ready = loadEngine(ref.engine)
      .then((engine) => engine.create(Tone.getContext().rawContext as unknown as BaseAudioContext, ref.preset))
      .then((inst) => {
        if (slot.token !== token) {
          inst.dispose();
          return null;
        }
        Tone.connect(inst.output, dest);
        slot.instrument = inst;
        return inst;
      })
      .catch((e: unknown) => {
        console.error(e);
        const info = presetInfo(ref);
        const why = e instanceof Error ? e.message : String(e);
        const net = info?.sampled ? " Sons sampleados são baixados na primeira vez." : "";
        toast(
          `Não foi possível carregar "${info?.name ?? ref.preset}" (${why}).${net} Tento de novo quando você tocar.`,
          "error",
        );
        // Marca para recriar na próxima reprodução ou pré-escuta.
        if (slot.token === token) {
          slot.key = "__falhou__";
          this.hasFailed = true;
          this.lastTracks = null;
        }
        return null;
      });
    return slot;
  }

  /** Solta as notas e descarta depois do release, para não cortar com clique. */
  private retire(slot: Slot): void {
    slot.token = -1;
    const inst = slot.instrument;
    slot.instrument = null;
    if (!inst) return;
    inst.releaseAll(this.now);
    setTimeout(() => inst.dispose(), 2500);
  }

  private lastTracks: Project["tracks"] | null = null;

  private sync(project: Project): void {
    if (!this.started) return;
    // Editar notas não mexe nas trilhas: nada para sincronizar no mixer.
    if (project.tracks === this.lastTracks) return;
    this.lastTracks = project.tracks;
    const anySolo = project.tracks.some((t) => t.solo);
    const seen = new Set<string>();
    for (const t of project.tracks) {
      seen.add(t.id);
      let node = this.tracks.get(t.id);
      if (!node) {
        node = {
          kind: t.kind,
          channel: new Tone.Channel().connect(this.master),
          slot: null,
          rows: new Map(),
          voices: [],
        };
        this.tracks.set(t.id, node);
      }
      node.channel.volume.value = t.volume <= 0 ? -Infinity : Tone.gainToDb(t.volume);
      node.channel.mute = anySolo ? !t.solo : t.muted;

      if (t.kind === "instrument") {
        node.slot = this.makeSlot(t.preset, node.channel, node.slot);
      } else {
        const rowSeen = new Set<string>();
        for (const r of t.kit) {
          rowSeen.add(r.id);
          let rn = node.rows.get(r.id);
          if (!rn) {
            const gain = new Tone.Gain(1).connect(node.channel);
            rn = { gain, slot: this.makeSlot(r.preset, gain) };
            node.rows.set(r.id, rn);
          } else {
            rn.slot = this.makeSlot(r.preset, rn.gain, rn.slot);
          }
          rn.gain.gain.value = r.muted ? 0 : r.volume;
        }
        for (const [rid, rn] of node.rows) {
          if (rowSeen.has(rid)) continue;
          this.retire(rn.slot);
          setTimeout(() => rn.gain.dispose(), 2600);
          node.rows.delete(rid);
        }
      }
    }
    for (const [id, node] of this.tracks) {
      if (seen.has(id)) continue;
      if (node.slot) this.retire(node.slot);
      for (const rn of node.rows.values()) this.retire(rn.slot);
      const ch = node.channel;
      setTimeout(() => ch.dispose(), 2600);
      this.tracks.delete(id);
    }
  }

  // ------------------------------------------------------------ transporte

  /** Soma das vozes ativas em todas as engines (diagnóstico). */
  activeVoices(): number {
    let n = 0;
    for (const node of this.tracks.values()) {
      n += node.slot?.instrument?.activeVoices?.() ?? 0;
      for (const rn of node.rows.values()) n += rn.slot.instrument?.activeVoices?.() ?? 0;
    }
    return n;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  /** Posição atual em ticks, compensando a latência de saída. */
  position(): number {
    if (!this.playing) return useTransport.getState().cursor;
    const ctx = Tone.getContext().rawContext as unknown as AudioContext;
    const now = this.now - (ctx.outputLatency || 0) - (ctx.baseLatency || 0);
    let a: Anchor | undefined;
    for (let i = this.anchors.length - 1; i >= 0; i--) {
      const x = this.anchors[i];
      if (x && x.time <= now) {
        a = x;
        break;
      }
    }
    if (!a) return this.anchors[0]?.tick ?? useTransport.getState().cursor;
    return a.tick + (now - a.time) / a.spt;
  }

  private hasFailed = false;

  /** Recria instrumentos que falharam ao carregar (rede instável). */
  private retryFailed(): void {
    if (!this.hasFailed) return;
    this.hasFailed = false;
    this.lastTracks = null;
    this.sync(getProject());
  }

  async play(fromTick?: number): Promise<void> {
    await this.ensureStarted();
    this.retryFailed();
    const start = fromTick ?? useTransport.getState().cursor;
    this.halt();
    const spt = secondsPerTick(getProject().bpm);
    this.schedTime = this.now + 0.06;
    this.schedTick = this.normalizeStart(start);
    this.anchors = [{ time: this.schedTime, tick: this.schedTick, spt }];
    this.playing = true;
    useTransport.getState().clearDrops();
    useTransport.getState().setPlaying(true);
    const gen = ++this.generation;
    // A geração descarta qualquer timer antigo que ainda dispare.
    this.timer = Tone.getContext().setInterval(() => {
      if (gen === this.generation) this.tick();
    }, INTERVAL);
    this.tick();
  }

  /** Pausa onde está. */
  pause(): void {
    if (!this.playing) return;
    const pos = this.position();
    this.halt();
    useTransport.getState().setCursor(this.normalizeStart(pos));
    useTransport.getState().setPlaying(false);
  }

  /** Para e volta ao início (ou ao começo do loop). */
  stop(): void {
    const wasPlaying = this.playing;
    this.halt();
    const p = getProject();
    const mode = useTransport.getState().mode;
    const home = mode === "song" && p.loop.enabled ? p.loop.start : 0;
    if (wasPlaying || useTransport.getState().cursor !== home) useTransport.getState().setCursor(home);
    useTransport.getState().setPlaying(false);
  }

  togglePlay(): void {
    if (this.playing) this.pause();
    else void this.play();
  }

  seek(tick: number): void {
    const t = Math.max(0, tick);
    useTransport.getState().setCursor(t);
    if (this.playing) void this.play(t);
  }

  private halt(): void {
    this.generation++;
    if (!this.started) {
      this.playing = false;
      return;
    }
    if (this.timer !== null) Tone.getContext().clearInterval(this.timer);
    this.timer = null;
    this.playing = false;
    const now = this.now;
    for (const node of this.tracks.values()) {
      node.voices = [];
      node.slot?.instrument?.releaseAll(now);
      for (const rn of node.rows.values()) rn.slot.instrument?.releaseAll(now);
    }
  }

  /** Região que se repete: pattern inteiro no modo pattern, ou o loop da playlist. */
  private loopRegion(): { start: number; end: number } | null {
    const p = getProject();
    if (useTransport.getState().mode === "pattern") {
      const pat = p.patterns[useUi.getState().openPatternId ?? ""];
      return pat ? { start: 0, end: pat.lengthBars * TICKS_PER_BAR } : null;
    }
    if (p.loop.enabled && p.loop.end > p.loop.start) return { start: p.loop.start, end: p.loop.end };
    return null;
  }

  private normalizeStart(tick: number): number {
    const loop = this.loopRegion();
    if (!loop) return Math.max(0, tick);
    if (tick >= loop.end || (useTransport.getState().mode === "pattern" && tick < loop.start)) return loop.start;
    return Math.max(0, tick);
  }

  private tick(): void {
    if (!this.playing) return;
    const p = getProject();
    const spt = secondsPerTick(p.bpm);
    const horizon = this.now + LOOKAHEAD;

    // Se a aba congelou e o relógio passou do agendado, pula para o presente.
    if (this.schedTime < this.now) {
      const lost = (this.now - this.schedTime) / spt;
      this.schedTime = this.now;
      this.schedTick += lost;
      this.anchors.push({ time: this.schedTime, tick: this.schedTick, spt });
    }

    let guard = 0;
    while (this.schedTime < horizon && guard++ < 64) {
      const loop = this.loopRegion();
      if (loop && this.schedTick >= loop.end) {
        this.schedTick = loop.start;
        this.anchors.push({ time: this.schedTime, tick: this.schedTick, spt });
      }
      let segEnd = this.schedTick + (horizon - this.schedTime) / spt;
      if (loop && this.schedTick < loop.end && segEnd > loop.end) segEnd = loop.end;
      this.scheduleRange(p, this.schedTick, segEnd, this.schedTime, spt);
      this.schedTime += (segEnd - this.schedTick) * spt;
      this.schedTick = segEnd;
      if (loop && this.schedTick >= loop.end - 1e-6) {
        this.schedTick = loop.start;
        this.anchors.push({ time: this.schedTime, tick: this.schedTick, spt });
      }
    }
    const last = this.anchors[this.anchors.length - 1];
    if (last && last.spt !== spt) this.anchors.push({ time: this.schedTime, tick: this.schedTick, spt });
    if (this.anchors.length > 64) this.anchors.splice(0, this.anchors.length - 32);

    // Fim da música sem loop: volta ao início.
    if (useTransport.getState().mode === "song" && !this.loopRegion()) {
      const end = songEndTicks(p);
      // Fora do callback: o clearInterval do Tone não cancela um intervalo de dentro dele mesmo.
      if (end > 0 && this.position() >= end) setTimeout(() => this.stop(), 0);
    }
  }

  private scheduleRange(p: Project, a: number, b: number, t0: number, spt: number): void {
    if (b <= a) return;
    const transport = useTransport.getState();
    const anySolo = p.tracks.some((t) => t.solo);
    const audible = (t: Track) => (anySolo ? t.solo : !t.muted);

    if (transport.metronome) {
      for (let beat = Math.ceil(a / PPQ) * PPQ; beat < b; beat += PPQ) {
        const time = t0 + (beat - a) * spt;
        const down = beat % TICKS_PER_BAR === 0;
        this.metro?.triggerAttackRelease(down ? 1760 : 1175, 0.03, time, down ? 1 : 0.6);
      }
    }

    if (transport.mode === "pattern") {
      const ui = useUi.getState();
      const pat = p.patterns[ui.openPatternId ?? ""];
      const track = p.tracks.find((t) => t.id === (ui.editorTrackId ?? pat?.homeTrackId));
      if (!pat || !track) return;
      for (const n of notesStartingIn(pat.notes, a, b))
        this.trigger(track, n.pitch, n.velocity, t0 + (n.start - a) * spt, n.duration * spt);
      return;
    }

    const trackById = new Map(p.tracks.map((t) => [t.id, t]));
    for (const clip of p.clips) {
      if (clip.start >= b) continue;
      const pat = p.patterns[clip.patternId];
      if (!pat) continue;
      const len = pat.lengthBars * TICKS_PER_BAR;
      if (clip.start + len <= a) continue;
      const track = trackById.get(clip.trackId);
      if (!track || !audible(track)) continue;
      // Só as notas que começam dentro da janela (busca binária no índice ordenado).
      const from = Math.max(0, a - clip.start);
      const to = Math.min(len, b - clip.start);
      for (const n of notesStartingIn(pat.notes, from, to)) {
        const at = clip.start + n.start;
        this.trigger(track, n.pitch, n.velocity, t0 + (at - a) * spt, Math.min(n.duration, len - n.start) * spt);
      }
    }
  }

  private totalVoices(time: number): number {
    let total = 0;
    for (const node of this.tracks.values()) {
      node.voices = node.voices.filter((v) => v.end > time);
      total += node.voices.length;
    }
    return total;
  }

  private trigger(track: Track, pitch: number, velocity: number, time: number, duration: number): void {
    const node = this.tracks.get(track.id);
    if (!node) return;
    let slot: Slot | null = null;
    let play = pitch;
    if (track.kind === "instrument") {
      slot = node.slot;
    } else {
      const row = track.kit.find((r) => r.note === pitch);
      if (!row || row.muted) return;
      slot = node.rows.get(row.id)?.slot ?? null;
      play = presetInfo(row.preset)?.defaultNote ?? 60;
    }
    const inst = slot?.instrument;
    if (!slot || !inst) return;

    // Roubo de voz: a mais antiga cai, e o cabeçalho da trilha avisa (RF-69).
    const total = this.totalVoices(time);
    let missing = 0;
    while (
      node.voices.length >= LIMITS.voicesPerTrack ||
      (total - missing >= LIMITS.voicesTotal && node.voices.length > 0)
    ) {
      node.voices.sort((x, y) => x.end - x.play - (y.end - y.play));
      const stolen = node.voices.shift();
      if (!stolen) break;
      stolen.slot.instrument?.noteOff(stolen.play, time);
      missing++;
    }
    if (missing > 0) {
      const id = track.id;
      Tone.getDraw().schedule(() => useTransport.getState().reportDrop(id, missing), time);
    }

    inst.noteOn(play, velocity, time);
    inst.noteOff(play, time + duration);
    node.voices.push({ pitch, play, end: time + duration, slot });
  }

  // -------------------------------------------------------------- pré-escuta

  private trackSlotFor(trackId: string, pitch: number): { slot: Slot | null; play: number } {
    const node = this.tracks.get(trackId);
    const track = getProject().tracks.find((t) => t.id === trackId);
    if (!node || !track) return { slot: null, play: pitch };
    if (track.kind === "instrument") return { slot: node.slot, play: pitch };
    const row = track.kit.find((r) => r.note === pitch);
    if (!row) return { slot: null, play: pitch };
    return { slot: node.rows.get(row.id)?.slot ?? null, play: presetInfo(row.preset)?.defaultNote ?? 60 };
  }

  /** Começa a soar (tecla do piano segurada). */
  async previewOn(trackId: string, pitch: number, velocity = 0.8): Promise<void> {
    await this.ensureStarted();
    const { slot, play } = this.trackSlotFor(trackId, pitch);
    const inst = await slot?.ready;
    inst?.noteOn(play, velocity, this.now);
  }

  async previewOff(trackId: string, pitch: number): Promise<void> {
    if (!this.started) return;
    const { slot, play } = this.trackSlotFor(trackId, pitch);
    const inst = await slot?.ready;
    inst?.noteOff(play, this.now);
  }

  /** Nota curta: ao criar, mover ou clicar. */
  async previewNote(trackId: string, pitch: number, velocity = 0.8, seconds = 0.22): Promise<void> {
    await this.ensureStarted();
    this.retryFailed();
    const { slot, play } = this.trackSlotFor(trackId, pitch);
    const inst = await slot?.ready;
    if (!inst) return;
    const t = this.now;
    inst.noteOn(play, velocity, t);
    inst.noteOff(play, t + seconds);
  }

  /** Pré-escuta de um preset no seletor, antes de confirmar (RF-64). */
  async previewPreset(ref: PresetRef): Promise<void> {
    const inst = await this.previewInstrument(ref);
    const info = presetInfo(ref);
    if (!inst || !info) return;
    const t = this.now + 0.01;
    inst.releaseAll(t);
    if (info.oneShot) {
      inst.noteOn(info.defaultNote, 0.9, t);
      return;
    }
    const chord = [0, 4, 7, 12];
    chord.forEach((iv, i) => {
      inst.noteOn(info.defaultNote + iv, 0.75, t + i * 0.07);
      inst.noteOff(info.defaultNote + iv, t + 0.9);
    });
  }

  /** Toca os sons de um kit em sequência e depois um compasso de batida (ouvir antes de carregar). */
  async previewKit(rows: PresetRef[]): Promise<void> {
    const insts = await Promise.all(rows.map((r) => this.previewInstrument(r)));
    const t0 = this.now + 0.03;
    const hit = (i: number, at: number, vel = 0.85) => {
      const inst = insts[i];
      const info = presetInfo(rows[i]);
      if (!inst || !info) return;
      inst.noteOn(info.defaultNote, vel, at);
      inst.noteOff(info.defaultNote, at + 0.2);
    };
    for (let i = 0; i < rows.length; i++) hit(i, t0 + i * 0.16);
    // Uma batida curta usando as três primeiras linhas, como as de qualquer kit.
    const start = t0 + rows.length * 0.16 + 0.15;
    const step = 0.125;
    for (let s = 0; s < 16; s++) {
      if (s % 8 === 0 || s === 11) hit(0, start + s * step);
      if (s % 8 === 4 && rows.length > 1) hit(1, start + s * step);
      if (s % 2 === 0 && rows.length > 2) hit(2, start + s * step, s % 4 ? 0.45 : 0.7);
    }
  }

  /** Instrumentos de pré-escuta ficam num cache pequeno, ligados direto no master. */
  private previewCache = new Map<string, Slot>();

  private async previewInstrument(ref: PresetRef | undefined): Promise<Instrument | null> {
    if (!ref) return null;
    await this.ensureStarted();
    if (!this.previewDest) return null;
    const key = presetKey(ref);
    let slot = this.previewCache.get(key);
    // Falhou antes (rede): tenta de novo.
    if (slot && slot.key !== key) {
      this.previewCache.delete(key);
      slot = undefined;
    }
    if (!slot) {
      slot = this.makeSlot(ref, this.previewDest);
      this.previewCache.set(key, slot);
      if (this.previewCache.size > 24) {
        const [oldKey, old] = this.previewCache.entries().next().value as [string, Slot];
        this.previewCache.delete(oldKey);
        this.retire(old);
      }
    }
    return slot.ready;
  }
}

export const host = new AudioHost();
