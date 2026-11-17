// AudioWorklet do Plaits (WebAssembly). Carregado como arquivo estático.
// Recebe os bytes do .wasm em processorOptions e eventos com horário exato
// pela porta: { type: "on" | "off" | "allOff" | "patch", time, ... }.

class PlaitsProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const { wasm, voices } = options.processorOptions;
    const module = new WebAssembly.Module(wasm);
    this.ex = new WebAssembly.Instance(module, {}).exports;
    this.synth = this.ex.plaits_new(voices || 8, sampleRate);
    this.block = this.ex.plaits_block_size();
    this.queue = [];
    this.alive = true;
    this.lastActive = -1;
    this.port.onmessage = (e) => {
      const m = e.data;
      if (m.type === "dispose") {
        this.alive = false;
        this.ex.plaits_free(this.synth);
        return;
      }
      if (m.type === "patch") {
        const p = m.patch;
        this.ex.plaits_set_patch(
          this.synth,
          p.engine,
          p.harmonics,
          p.timbre,
          p.morph,
          p.decay,
          p.lpgColour,
          p.sustained ? 1 : 0,
          p.attack,
          p.release,
          p.gain,
        );
        return;
      }
      // Eventos ordenados por horário.
      const t = m.time ?? 0;
      let i = this.queue.length;
      while (i > 0 && this.queue[i - 1].time > t) i--;
      this.queue.splice(i, 0, m);
    };
  }

  apply(m) {
    if (m.type === "on") this.ex.plaits_note_on(this.synth, m.note, m.velocity);
    else if (m.type === "off") this.ex.plaits_note_off(this.synth, m.note);
    else if (m.type === "allOff") this.ex.plaits_all_off(this.synth);
  }

  process(_inputs, outputs) {
    if (!this.alive) return false;
    const out = outputs[0][0];
    if (!out) return true;
    const mem = this.ex.memory.buffer;
    for (let off = 0; off < out.length; off += this.block) {
      // Aplica os eventos que caem até o fim deste bloco (precisão de 16 amostras).
      const blockEnd = currentTime + (off + this.block) / sampleRate;
      while (this.queue.length && this.queue[0].time < blockEnd) this.apply(this.queue.shift());
      const ptr = this.ex.plaits_render(this.synth);
      out.set(new Float32Array(mem, ptr, this.block), off);
    }
    for (let c = 1; c < outputs[0].length; c++) outputs[0][c].set(out);
    // Informa as vozes ativas quando muda (diagnóstico / contador de polifonia).
    const active = this.ex.plaits_active(this.synth);
    if (active !== this.lastActive) {
      this.lastActive = active;
      this.port.postMessage({ type: "active", active });
    }
    return true;
  }
}

registerProcessor("plaits", PlaitsProcessor);
