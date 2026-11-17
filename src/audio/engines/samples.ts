/**
 * Engine de samples.
 *  - Baterias: tocador próprio e mínimo. Baixa e decodifica só o sample usado,
 *    uma vez por contexto, e guarda no Cache Storage do navegador (funciona
 *    offline depois da primeira vez).
 *  - Instrumentos melódicos: Soundfont do smplr (banco FluidR3_GM).
 */
import type { Instrument, InstrumentEngine } from "../engine";
import { DRUM_BASE, DRUM_MACHINES, SAMPLE_PRESETS, SOUNDFONTS } from "../samplePresets";

const CACHE = "bipoteca-samples-v1";
const dbToGain = (db: number) => 10 ** (db / 20);
/** Curva de velocity: toques fracos ficam bem mais baixos, como num instrumento real. */
const velGain = (v: number) => Math.max(0, Math.min(1, v)) ** 1.6;

const format = (() => {
  if (typeof Audio === "undefined") return "ogg";
  return new Audio().canPlayType('audio/ogg; codecs="vorbis"') ? "ogg" : "m4a";
})();

/** Busca com novas tentativas: o GitHub Pages limita rajadas de requisições. */
async function fetchWithRetry(url: string): Promise<Response> {
  let last: unknown;
  for (const wait of [0, 400, 1500]) {
    if (wait) await new Promise((r) => setTimeout(r, wait));
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      last = new Error(`o servidor respondeu ${res.status}`);
      if (res.status < 500 && res.status !== 429) break; // 404 etc.: tentar de novo não adianta
    } catch (e) {
      last = new Error(navigator.onLine ? "falha de rede" : "sem conexão");
      if (!e) break;
    }
  }
  throw last;
}

async function fetchBytes(url: string): Promise<ArrayBuffer> {
  const cache = typeof caches !== "undefined" ? await caches.open(CACHE).catch(() => null) : null;
  const hit = await cache?.match(url);
  if (hit) return await hit.arrayBuffer();
  const res = await fetchWithRetry(url);
  if (cache) void cache.put(url, res.clone()).catch(() => {});
  return await res.arrayBuffer();
}

const buffers = new WeakMap<BaseAudioContext, Map<string, Promise<AudioBuffer>>>();

function loadBuffer(ctx: BaseAudioContext, url: string): Promise<AudioBuffer> {
  let byUrl = buffers.get(ctx);
  if (!byUrl) {
    byUrl = new Map();
    buffers.set(ctx, byUrl);
  }
  let p = byUrl.get(url);
  if (!p) {
    p = fetchBytes(url).then((bytes) => ctx.decodeAudioData(bytes));
    p.catch(() => byUrl?.delete(url));
    byUrl.set(url, p);
  }
  return p;
}

async function drumHit(ctx: BaseAudioContext, machineId: string, hitId: string): Promise<Instrument> {
  const machine = DRUM_MACHINES.find((m) => m.id === machineId);
  const hit = machine?.hits.find((x) => x.id === hitId);
  if (!machine || !hit) throw new Error(`Sample desconhecido: ${machineId}/${hitId}`);
  const buffer = await loadBuffer(ctx, `${DRUM_BASE}/${machine.dir}/${hit.id}.${format}`);
  const out = ctx.createGain();
  out.gain.value = dbToGain(hit.gainDb ?? 0);
  const voices = new Set<AudioBufferSourceNode>();
  return {
    output: out,
    noteOn: (_note, velocity, time) => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const g = ctx.createGain();
      g.gain.value = velGain(velocity);
      src.connect(g);
      g.connect(out);
      src.onended = () => {
        src.disconnect();
        g.disconnect();
        voices.delete(src);
      };
      src.start(Math.max(time, ctx.currentTime));
      voices.add(src);
    },
    // Toques de bateria tocam até o fim do sample.
    noteOff: () => {},
    releaseAll: () => {},
    activeVoices: () => voices.size,
    dispose: () => {
      for (const v of voices) {
        try {
          v.stop();
        } catch {
          /* já parou */
        }
      }
      out.disconnect();
    },
  };
}

async function soundfont(ctx: BaseAudioContext, id: string): Promise<Instrument> {
  const def = SOUNDFONTS.find((s) => s.id === id);
  if (!def) throw new Error(`Soundfont desconhecido: ${id}`);
  const { Soundfont, CacheStorage } = await import("smplr");
  const out = ctx.createGain();
  // O banco FluidR3 sai bem mais baixo que os outros sons: +12 dB nivela.
  out.gain.value = dbToGain(12 + (def.gainDb ?? 0));
  const make = () =>
    Soundfont(ctx, {
      instrument: def.instrument,
      kit: "FluidR3_GM",
      destination: out,
      ...(typeof caches !== "undefined" ? { storage: new CacheStorage(CACHE) } : {}),
    });
  let sf = make();
  for (const wait of [400, 1500, 0]) {
    try {
      await sf.ready;
      break;
    } catch (e) {
      sf.dispose();
      if (!wait) throw new Error(navigator.onLine ? "falha ao baixar os samples" : "sem conexão");
      await new Promise((r) => setTimeout(r, wait));
      sf = make();
      void e;
    }
  }
  let active = 0;
  let seq = 0;
  /**
   * O smplr só cria a voz perto da hora dela (agendador próprio). Um stop
   * enviado antes disso não acha a voz e a nota fica presa. Por isso cada nota
   * tem um id único, e o soltar só é enviado depois que a nota começou.
   */
  const pending = new Map<number, { id: number; start: number }[]>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, atAudioTime: number) => {
    const ms = Math.max(0, (atAudioTime - ctx.currentTime) * 1000) + 40;
    const t = setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  };
  return {
    output: out,
    noteOn: (note, velocity, time) => {
      const id = ++seq;
      active++;
      const list = pending.get(note) ?? [];
      list.push({ id, start: time });
      pending.set(note, list);
      sf.start({
        note,
        velocity: Math.max(1, Math.round(velGain(velocity) * 127)),
        time,
        stopId: id,
        // Soltura curta: a nota para quando o MIDI manda parar.
        ampRelease: 0.12,
        onEnded: () => {
          active = Math.max(0, active - 1);
        },
      });
    },
    noteOff: (note, time) => {
      // Solta a nota mais antiga dessa altura que começou antes deste soltar.
      const list = pending.get(note);
      const i = list?.findIndex((v) => v.start <= time + 1e-6) ?? -1;
      const voice = i >= 0 ? list?.splice(i, 1)[0] : undefined;
      if (!voice) return;
      later(() => sf.stop({ stopId: voice.id, time: Math.max(time, ctx.currentTime) }), voice.start);
    },
    releaseAll: (time) => {
      // Inclui as notas ainda não criadas pelo smplr: soltar de novo depois que começarem.
      const last = Math.max(time, ...[...pending.values()].flat().map((v) => v.start));
      pending.clear();
      sf.stop({ time });
      later(() => sf.stop({ time: ctx.currentTime }), last);
    },
    activeVoices: () => active,
    dispose: () => {
      for (const t of timers) clearTimeout(t);
      timers.clear();
      sf.dispose();
    },
  };
}

export const samplesEngine: InstrumentEngine = {
  id: "samples",
  name: "Samples",
  presets: SAMPLE_PRESETS,
  async create(ctx, presetId) {
    const [kind, a, ...rest] = presetId.split(":");
    if (kind === "dm" && a) return drumHit(ctx, a, rest.join(":"));
    if (kind === "sf" && a) return soundfont(ctx, a);
    throw new Error(`Preset desconhecido: ${presetId}`);
  },
};
