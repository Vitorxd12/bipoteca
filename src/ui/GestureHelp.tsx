/** Folha de gestos e atalhos. Abre com "?" ou pelo botão na barra. */
import { Hand, Keyboard, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { GLASS_STRONG, Kbd } from "./primitives";

const SECTIONS: { title: string; accent: string; rows: [string, string][] }[] = [
  {
    title: "Playlist",
    accent: "text-uv-300",
    rows: [
      ["2× clique no vazio", "cria pattern e abre o editor"],
      ["2× clique no clipe", "abre no editor"],
      ["arrastar clipe", "move (tempo e trilha do mesmo tipo)"],
      ["Ctrl + arrastar", "copia"],
      ["arrastar no vazio", "seleção em retângulo"],
      ["botão direito", "menu do clipe / trilha"],
      ["régua de cima", "arrastar cria loop · 2× liga/desliga"],
      ["régua de baixo", "posiciona o cursor"],
      ["arrastar da biblioteca", "posiciona o pattern"],
    ],
  },
  {
    title: "Piano roll",
    accent: "text-uv-300",
    rows: [
      ["clique no vazio", "cria nota (e já arrasta)"],
      ["arrastar nota", "move · pré-escuta"],
      ["borda direita", "muda a duração"],
      ["2× clique na nota", "apaga"],
      ["botão direito arrastando", "borracha"],
      ["Ctrl/Shift + arrastar", "seleção em retângulo"],
      ["teclado: segurar/arrastar", "toca · glissando"],
      ["teclado: 2× clique", "seleciona a altura inteira"],
      ["↑ ↓ / Shift + ↑ ↓", "transpõe semitom / oitava"],
    ],
  },
  {
    title: "Editor de kit",
    accent: "text-volt-400",
    rows: [
      ["clique", "liga/desliga o toque"],
      ["arrastar", "pinta (ou apaga, se começou num toque)"],
      ["botão direito arrastando", "apaga"],
      ["Alt + roda no toque", "velocity ±5%"],
      ["clique no nome da linha", "ouve o som"],
      ["chip do som", "troca o sintetizador da linha"],
    ],
  },
  {
    title: "Navegação",
    accent: "text-fg",
    rows: [
      ["roda", "rola vertical"],
      ["Shift + roda", "rola horizontal"],
      ["Ctrl + roda", "zoom horizontal no mouse"],
      ["Alt + roda", "zoom vertical (altura)"],
      ["botão do meio arrastando", "navega livre"],
      ["Alt durante arraste", "desliga o encaixe"],
      ["divisória do editor", "arrastar · 2× tela cheia"],
    ],
  },
];

const KEYS: [string, string][] = [
  ["Espaço", "tocar / pausar"],
  ["Enter", "parar e voltar"],
  ["Ctrl+Z / Ctrl+Shift+Z", "desfazer / refazer"],
  ["Del", "apagar seleção"],
  ["Ctrl+D", "duplicar"],
  ["Ctrl+C / Ctrl+V", "copiar / colar notas"],
  ["Ctrl+A", "selecionar tudo"],
  ["← →", "move notas pelo passo da grade"],
  ["B", "biblioteca"],
  ["E", "editor: split ↔ tela cheia"],
  ["Esc", "limpa seleção / fecha"],
];

export function GestureHelp() {
  const open = useUi((s) => s.helpOpen);
  const setOpen = useUi((s) => s.setHelpOpen);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "?") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, setOpen]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 p-6 backdrop-blur-[3px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onPointerDown={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <motion.div
            initial={{ y: 20, scale: 0.95, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className={cn(GLASS_STRONG, "max-h-[90vh] w-[min(1040px,96vw)] overflow-y-auto p-7")}
          >
            <div className="mb-5 flex items-center gap-3">
              <Hand className="size-5 text-volt-400" />
              <h2 className="font-display text-lg font-semibold">Gestos e atalhos</h2>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl p-2 text-fg-faint hover:bg-white/5 hover:text-fg"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-6 lg:grid-cols-4">
              {SECTIONS.map((s) => (
                <section key={s.title}>
                  <h3 className={cn("mb-2 text-xs font-semibold tracking-wider uppercase", s.accent)}>{s.title}</h3>
                  <dl className="space-y-1.5">
                    {s.rows.map(([g, a]) => (
                      <div key={g} className="text-[12px] leading-snug">
                        <dt className="font-medium text-fg">{g}</dt>
                        <dd className="text-fg-faint">{a}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
            <div className="mt-6 border-t border-white/[0.06] pt-5">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wider text-fg-muted uppercase">
                <Keyboard className="size-3.5" /> Teclado
              </h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-3">
                {KEYS.map(([k, a]) => (
                  <div key={k} className="flex items-center gap-2 text-[12px]">
                    <Kbd>{k}</Kbd>
                    <span className="text-fg-faint">{a}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
