/**
 * Engine Plaits: o DSP do Mutable Instruments Plaits compilado para
 * WebAssembly (native/plaits) rodando num AudioWorklet, fora da thread
 * principal, com eventos agendados com precisão de 16 amostras.
 */
import { type IAudioContext, AudioWorkletNode as SacWorkletNode } from "standardized-audio-context";
import type { Instrument, InstrumentEngine } from "../engine";
import { PLAITS_PATCHES, PLAITS_PRESETS } from "../plaitsPresets";

const BASE = import.meta.env.BASE_URL;
const VOICES = 10;

let wasmBytes: Promise<ArrayBuffer> | null = null;
const modules = new WeakMap<object, Promise<void>>();

function loadWasm(): Promise<ArrayBuffer> {
  if (!wasmBytes) {
    wasmBytes = fetch(`${BASE}plaits/plaits.wasm`).then((r) => {
      if (!r.ok) throw new Error(`plaits.wasm: HTTP ${r.status}`);
      return r.arrayBuffer();
    });
    wasmBytes.catch(() => {
      wasmBytes = null;
    });
  }
  return wasmBytes;
}

function loadModule(ctx: BaseAudioContext): Promise<void> {
  let p = modules.get(ctx);
  if (!p) {
    p = ctx.audioWorklet.addModule(`${BASE}plaits/plaits-processor.js`);
    modules.set(ctx, p);
  }
  return p;
}

/** O Tone.js usa o standardized-audio-context; contexto nativo usa o construtor nativo. */
function makeNode(ctx: BaseAudioContext, wasm: ArrayBuffer): AudioWorkletNode {
  const options = {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [1],
    processorOptions: { wasm, voices: VOICES },
  };
  if (ctx instanceof BaseAudioContext) return new AudioWorkletNode(ctx, "plaits", options);
  if (!SacWorkletNode) throw new Error("AudioWorklet indisponível neste navegador");
  return new SacWorkletNode(ctx as unknown as IAudioContext, "plaits", options) as unknown as AudioWorkletNode;
}

export const plaitsEngine: InstrumentEngine = {
  id: "plaits",
  name: "Plaits",
  presets: PLAITS_PRESETS,
  async create(ctx, presetId) {
    const patch = PLAITS_PATCHES[presetId];
    const oneShot = !!PLAITS_PRESETS.find((p) => p.id === presetId)?.oneShot;
    if (!patch) throw new Error(`Preset desconhecido: ${presetId}`);
    const [wasm] = await Promise.all([loadWasm(), loadModule(ctx)]);
    // Cada instância recebe sua cópia dos bytes (o processor instancia o próprio WASM).
    const node = makeNode(ctx, wasm.slice(0));
    node.port.postMessage({ type: "patch", patch });
    let active = 0;
    node.port.onmessage = (e: MessageEvent<{ type: string; active: number }>) => {
      if (e.data.type === "active") active = e.data.active;
    };
    const instrument: Instrument = {
      output: node,
      noteOn: (note, velocity, time) => node.port.postMessage({ type: "on", note, velocity, time }),
      // Sons de bateria tocam até o fim; os melódicos cortam no soltar.
      noteOff: (note, time) => {
        if (!oneShot) node.port.postMessage({ type: "off", note, time });
      },
      releaseAll: (time) => node.port.postMessage({ type: "allOff", time }),
      activeVoices: () => active,
      dispose: () => {
        node.port.postMessage({ type: "dispose" });
        node.disconnect();
      },
    };
    return instrument;
  },
};
