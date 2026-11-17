/**
 * Estúdio (T2): a única tela de trabalho. Sem login e sem página de projetos
 * por enquanto: abre direto no projeto salvo (ou no exemplo).
 */
import { AnimatePresence, motion } from "motion/react";
import { lazy, Suspense, useRef } from "react";

// Modais carregados só na primeira vez que abrem: a tela inicial baixa menos código.
const InstrumentPicker = lazy(() => import("./picker/InstrumentPicker").then((m) => ({ default: m.InstrumentPicker })));
const GestureHelp = lazy(() => import("./ui/GestureHelp").then((m) => ({ default: m.GestureHelp })));

/** Monta um componente preguiçoso a partir da primeira vez que `when` fica verdadeiro. */
function MountOnce({ when, children }: { when: boolean; children: React.ReactNode }) {
  const seen = useRef(false);
  if (when) seen.current = true;
  return seen.current ? <Suspense fallback={null}>{children}</Suspense> : null;
}

import Aurora from "./components/Aurora";
import { EditorPanel } from "./editor/EditorPanel";
import { cn } from "./lib/utils";
import { PatternLibrary } from "./library/PatternLibrary";
import { Playlist } from "./playlist/Playlist";
import { useShortcuts } from "./shortcuts";
import { useUi } from "./store/ui";
import { TransportBar } from "./transport/TransportBar";
import { ConfirmDialog, ContextMenu, Toasts } from "./ui/overlays";

/** Divisória entre playlist e editor: arrastar redimensiona, duplo clique alterna tela cheia. */
function Splitter({ container }: { container: React.RefObject<HTMLDivElement | null> }) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: <hr> não recebe arraste
    <div
      role="separator"
      aria-orientation="horizontal"
      title="Arraste para redimensionar · duplo clique: tela cheia"
      className="group relative z-10 flex h-2.5 shrink-0 cursor-row-resize items-center justify-center"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        const el = container.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        useUi.getState().setSplitRatio(1 - (e.clientY - r.top) / r.height);
      }}
      onDoubleClick={() => useUi.getState().setEditorMode("full")}
    >
      <div className="h-1 w-16 rounded-full bg-white/15 transition-all group-hover:w-28 group-hover:bg-uv-400 group-active:bg-volt-500" />
    </div>
  );
}

export function App() {
  useShortcuts();
  const libraryOpen = useUi((s) => s.libraryOpen);
  const editorMode = useUi((s) => s.editorMode);
  const ratio = useUi((s) => s.splitRatio);
  const pickerOpen = useUi((s) => !!s.picker);
  const helpOpen = useUi((s) => s.helpOpen);
  const main = useRef<HTMLDivElement>(null);

  return (
    <div className="relative h-full overflow-hidden bg-ink-950">
      {/* Fundo atrás do vidro (React Bits), desenhado uma vez e parado. Animado, ele obriga o
          navegador a redesfocar todos os painéis a cada quadro: era a maior fonte de lag. */}
      <div className="pointer-events-none absolute inset-0">
        <Aurora colorStops={["#6b4cf0", "#8b6cff", "#c8ff3d"]} amplitude={1.3} blend={0.55} dpr={0.5} paused />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_90%_at_50%_110%,transparent_10%,rgb(8_7_13/0.65)_70%)]" />

      <div className="relative flex h-full flex-col gap-2 p-2">
        <TransportBar />
        <div className="flex min-h-0 flex-1 gap-2">
          <AnimatePresence initial={false}>
            {libraryOpen && (
              <motion.div
                key="library"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 268, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 40 }}
                className="shrink-0 overflow-hidden"
              >
                <div className="h-full w-[268px]">
                  <PatternLibrary />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={main} className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div
              className={cn("min-h-0", editorMode === "full" ? "hidden" : "flex-1")}
              style={editorMode === "split" ? { flex: `${1 - ratio} 1 0` } : undefined}
            >
              <Playlist />
            </div>
            {editorMode === "split" && <Splitter container={main} />}
            {editorMode !== "closed" && (
              <motion.div
                key="editor"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 34 }}
                className="min-h-0"
                style={{ flex: editorMode === "full" ? "1 1 0" : `${ratio} 1 0` }}
              >
                <EditorPanel />
              </motion.div>
            )}
          </div>
        </div>
      </div>

      <MountOnce when={pickerOpen}>
        <InstrumentPicker />
      </MountOnce>
      <MountOnce when={helpOpen}>
        <GestureHelp />
      </MountOnce>
      <ContextMenu />
      <ConfirmDialog />
      <Toasts />
    </div>
  );
}
