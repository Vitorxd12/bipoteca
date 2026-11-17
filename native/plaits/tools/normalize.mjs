// Uso: node --experimental-strip-types native/plaits/tools/normalize.mjs
// Calcula o ganho de cada preset para nivelar: sustentados em -15 dB RMS,
// percussivos com pico 0,6 (velocity 0,8).
import { readFileSync } from "node:fs";
const root = process.argv[2] ?? new URL("../../..", import.meta.url).pathname;
const { PLAITS_PATCHES, PLAITS_PRESETS } = await import(`${root}/src/audio/plaitsPresets.ts`);
const mod = new WebAssembly.Module(readFileSync(`${root}/public/plaits/plaits.wasm`));
const SR = 48000;
const out = {};
for (const info of PLAITS_PRESETS) {
  const p = PLAITS_PATCHES[info.id];
  const ex = new WebAssembly.Instance(mod, {}).exports;
  const s = ex.plaits_new(2, SR); const B = ex.plaits_block_size();
  ex.plaits_set_patch(s, p.engine, p.harmonics, p.timbre, p.morph, p.decay, p.lpgColour, p.sustained ? 1 : 0, p.attack, p.release, 1); // ganho 1: mede o patch cru
  ex.plaits_note_on(s, info.defaultNote, 0.8);
  const n = Math.floor(0.8 * SR / B) * B; const x = new Float32Array(n);
  for (let i = 0; i < n; i += B) x.set(new Float32Array(ex.memory.buffer, ex.plaits_render(s), B), i);
  let pk = 0, sum = 0; const a = 0.1 * SR, b = 0.6 * SR;
  for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(x[i]));
  for (let i = a; i < b; i++) sum += x[i] * x[i];
  const rms = Math.sqrt(sum / (b - a));
  let g = p.sustained ? 10 ** (-15 / 20) / rms : 0.6 / pk;
  g = Math.min(g, 0.95 / pk, 6); // nunca estourar
  out[info.id] = Math.round(g * 100) / 100;
}
console.log(JSON.stringify(out));
