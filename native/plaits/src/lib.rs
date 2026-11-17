//! Plaits polifônico para a Bipoteca.
//!
//! Várias vozes do Plaits (port em Rust de sourcebox/mi-plaits-dsp-rs, MIT)
//! dividindo o mesmo patch, com alocação e roubo de vozes, exportadas como
//! funções C simples para rodar dentro de um AudioWorklet.
//!
//! Dois modos de envelope:
//!  - sustentado: o "low pass gate" segue um envelope de nível (ataque/release)
//!    controlado pelo gate da nota, como um VCA + filtro;
//!  - percussivo: cada nota "golpeia" o LPG, que decai sozinho (parâmetro decay).

use mi_plaits_dsp::voice::{Modulations, Patch, Voice};

/// Tamanho do bloco de render. 128 (quantum do Web Audio) é múltiplo dele.
const BLOCK: usize = 16;
/// Blocos com o trigger em alto (> 8 amostras de atraso interno do Plaits).
const TRIGGER_BLOCKS: u32 = 2;
/// Blocos seguidos em silêncio para considerar a voz livre.
const SILENT_BLOCKS: u32 = 24;
/// Tempo mínimo (em blocos) antes de checar silêncio: alguns motores começam mudos.
const MIN_LIFE_BLOCKS: u32 = 120;

struct Slot {
    voice: Box<Voice<'static>>,
    note: f32,
    velocity: f32,
    gate: bool,
    level: f32,
    /// Soltar a nota faz um fade de saída (a duração da nota manda).
    cut: bool,
    fade: f32,
    active: bool,
    age: u64,
    blocks: u32,
    silent: u32,
    out: [f32; BLOCK],
    aux: [f32; BLOCK],
}

pub struct Synth {
    slots: Vec<Slot>,
    patch: Patch,
    sustained: bool,
    attack_step: f32,
    release_step: f32,
    gain: f32,
    clock: u64,
    sample_rate: f32,
    out: [f32; BLOCK],
}

impl Synth {
    fn new(voices: usize, sample_rate: f32) -> Self {
        let slots = (0..voices.max(1))
            .map(|_| {
                let mut voice = Box::new(Voice::new(BLOCK, sample_rate));
                voice.init();
                Slot {
                    voice,
                    note: 0.0,
                    velocity: 0.0,
                    gate: false,
                    level: 0.0,
                    cut: false,
                    fade: 1.0,
                    active: false,
                    age: 0,
                    blocks: 0,
                    silent: 0,
                    out: [0.0; BLOCK],
                    aux: [0.0; BLOCK],
                }
            })
            .collect();
        let mut s = Self {
            slots,
            patch: Patch::default(),
            sustained: true,
            attack_step: 1.0,
            release_step: 1.0,
            gain: 1.0,
            clock: 0,
            sample_rate,
            out: [0.0; BLOCK],
        };
        s.set_times(0.005, 0.3);
        s
    }

    fn set_times(&mut self, attack_s: f32, release_s: f32) {
        let blocks_per_s = self.sample_rate / BLOCK as f32;
        self.attack_step = 1.0 / (attack_s.max(0.001) * blocks_per_s);
        self.release_step = 1.0 / (release_s.max(0.005) * blocks_per_s);
    }

    fn note_on(&mut self, note: f32, velocity: f32) {
        self.clock += 1;
        // Mesma nota já soando: reaproveita a voz (sem empilhar).
        let idx = self
            .slots
            .iter()
            .position(|s| s.active && s.note == note)
            .or_else(|| self.slots.iter().position(|s| !s.active))
            // Sem voz livre: rouba a mais antiga, preferindo as já soltas.
            .unwrap_or_else(|| {
                let mut best = 0;
                let mut best_key = (true, u64::MAX);
                for (i, s) in self.slots.iter().enumerate() {
                    let key = (s.gate, s.age);
                    if key < best_key {
                        best_key = key;
                        best = i;
                    }
                }
                best
            });
        let s = &mut self.slots[idx];
        s.note = note;
        s.velocity = velocity.clamp(0.0, 1.0);
        s.gate = true;
        s.cut = false;
        s.fade = 1.0;
        s.active = true;
        s.age = self.clock;
        s.blocks = 0;
        s.silent = 0;
        if !self.sustained {
            s.level = 0.0;
        }
    }

    fn note_off(&mut self, note: f32) {
        for s in self.slots.iter_mut() {
            if s.active && !s.cut && s.note == note {
                s.gate = false;
                s.cut = true;
            }
        }
    }

    fn all_off(&mut self) {
        for s in self.slots.iter_mut() {
            s.gate = false;
            s.cut = true;
        }
    }

    fn render_block(&mut self) {
        self.out = [0.0; BLOCK];
        for s in self.slots.iter_mut() {
            if !s.active {
                continue;
            }
            // Envelope de nível (modo sustentado).
            if self.sustained {
                if s.gate {
                    s.level = (s.level + self.attack_step).min(1.0);
                } else {
                    s.level = (s.level - self.release_step).max(0.0);
                }
            }
            let mut patch = self.patch.clone();
            patch.note = s.note;
            let modulations = Modulations {
                trigger: if s.blocks < TRIGGER_BLOCKS { 1.0 } else { 0.0 },
                trigger_patched: true,
                level: s.level * (0.35 + 0.65 * s.velocity),
                level_patched: self.sustained,
                ..Default::default()
            };
            s.voice.render(&patch, &modulations, &mut s.out, &mut s.aux);
            // Soltar a nota faz um fade de saída nos dois modos: o low pass gate do
            // Plaits sozinho deixa ~300 ms de cauda; o fade garante o corte no tempo.
            if s.cut {
                s.fade = (s.fade - self.release_step).max(0.0);
            }
            let vel = if self.sustained { 1.0 } else { s.velocity * s.velocity };
            let amp = self.gain * vel * s.fade;
            let mut peak = 0.0f32;
            for (o, v) in self.out.iter_mut().zip(s.out.iter()) {
                let x = v * amp;
                *o += x;
                peak = peak.max(x.abs());
            }
            s.blocks = s.blocks.saturating_add(1);
            // Libera a voz quando solta e em silêncio.
            if s.cut && s.fade <= 0.0 {
                s.active = false;
            } else if !s.gate && s.blocks > MIN_LIFE_BLOCKS && peak < 1.0e-4 {
                s.silent += 1;
                if s.silent > SILENT_BLOCKS {
                    s.active = false;
                    s.level = 0.0;
                }
            } else {
                s.silent = 0;
            }
            // Percussivo: o gate não importa, a nota só decai.
            if !self.sustained && s.blocks > TRIGGER_BLOCKS {
                s.gate = false;
            }
        }
    }
}

// ----------------------------------------------------------------- C ABI

#[unsafe(no_mangle)]
pub extern "C" fn plaits_new(voices: u32, sample_rate: f32) -> *mut Synth {
    Box::into_raw(Box::new(Synth::new(voices as usize, sample_rate)))
}

/// # Safety
/// `s` precisa ter vindo de `plaits_new` e não pode ser usado depois.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn plaits_free(s: *mut Synth) {
    if !s.is_null() {
        drop(unsafe { Box::from_raw(s) });
    }
}

#[unsafe(no_mangle)]
#[allow(clippy::too_many_arguments)]
pub extern "C" fn plaits_set_patch(
    s: &mut Synth,
    engine: u32,
    harmonics: f32,
    timbre: f32,
    morph: f32,
    decay: f32,
    lpg_colour: f32,
    sustained: u32,
    attack_s: f32,
    release_s: f32,
    gain: f32,
) {
    s.patch.engine = engine as usize;
    s.patch.harmonics = harmonics;
    s.patch.timbre = timbre;
    s.patch.morph = morph;
    s.patch.decay = decay;
    s.patch.lpg_colour = lpg_colour;
    s.sustained = sustained != 0;
    s.gain = gain;
    s.set_times(attack_s, release_s);
}

#[unsafe(no_mangle)]
pub extern "C" fn plaits_note_on(s: &mut Synth, note: f32, velocity: f32) {
    s.note_on(note, velocity);
}

#[unsafe(no_mangle)]
pub extern "C" fn plaits_note_off(s: &mut Synth, note: f32) {
    s.note_off(note);
}

#[unsafe(no_mangle)]
pub extern "C" fn plaits_all_off(s: &mut Synth) {
    s.all_off();
}

/// Renderiza um bloco de `BLOCK` amostras e devolve o ponteiro para ele.
#[unsafe(no_mangle)]
pub extern "C" fn plaits_render(s: &mut Synth) -> *const f32 {
    s.render_block();
    s.out.as_ptr()
}

#[unsafe(no_mangle)]
pub extern "C" fn plaits_block_size() -> u32 {
    BLOCK as u32
}

#[unsafe(no_mangle)]
pub extern "C" fn plaits_active(s: &Synth) -> u32 {
    s.slots.iter().filter(|v| v.active).count() as u32
}
