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

async function fetchBytes(url: string): Promise<ArrayBuffer> {
  try {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(url);
    if (hit) return await hit.arrayBuffer();
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
    void cache.put(url, res.clone());
    return await res.arrayBuffer();
  } catch {
    // Sem Cache Storage (contexto inseguro) ou falha nele: busca direto.
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
    return await res.arrayBuffer();
  }
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
  const sf = Soundfont(ctx, {
    instrument: def.instrument,
    kit: "FluidR3_GM",
    destination: out,
    storage: new CacheStorage(CACHE),
  });
  await sf.ready;
  let active = 0;
  return {
    output: out,
    noteOn: (note, velocity, time) => {
      active++;
      sf.start({
        note,
        velocity: Math.max(1, Math.round(velGain(velocity) * 127)),
        time,
        stopId: note,
        onEnded: () => {
          active = Math.max(0, active - 1);
        },
      });
    },
    noteOff: (note, time) => sf.stop({ stopId: note, time }),
    releaseAll: (time) => sf.stop({ time }),
    activeVoices: () => active,
    dispose: () => sf.dispose(),
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
