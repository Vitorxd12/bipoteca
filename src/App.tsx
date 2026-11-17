/**
 * Casca do app. Uma tela por vez, cada uma com uma responsabilidade
 * (store/router.ts). O transporte e a navegação ficam em volta: no desktop
 * em cima; no celular embaixo, perto do polegar.
 */
import { lazy, Suspense } from "react";
import Aurora from "./components/Aurora";
import { EditorPanel } from "./editor/EditorPanel";
import { PatternLibrary } from "./library/PatternLibrary";
import { NavBar } from "./nav/NavBar";
import { Playlist } from "./playlist/Playlist";
import { useShortcuts } from "./shortcuts";
import { type Screen, useRouter } from "./store/router";
import { TransportBar } from "./transport/TransportBar";
import { ConfirmDialog, ContextMenu, Toasts } from "./ui/overlays";

// Telas menos usadas: baixadas só quando abertas.
const InstrumentPicker = lazy(() => import("./picker/InstrumentPicker").then((m) => ({ default: m.InstrumentPicker })));
const KitBrowser = lazy(() => import("./kits/KitBrowser").then((m) => ({ default: m.KitBrowser })));
const GestureHelp = lazy(() => import("./ui/GestureHelp").then((m) => ({ default: m.GestureHelp })));

function ScreenView({ screen }: { screen: Screen }) {
  switch (screen.name) {
    case "playlist":
      return <Playlist />;
    case "patterns":
      return <PatternLibrary />;
    case "pattern":
      return <EditorPanel />;
    case "sound":
      return <InstrumentPicker />;
    case "kits":
      return <KitBrowser />;
    case "help":
      return <GestureHelp />;
  }
}

export function App() {
  useShortcuts();
  const screen = useRouter((s) => s.screen);

  return (
    <div className="relative h-full overflow-hidden bg-ink-950">
      {/* Fundo atrás do vidro (React Bits), desenhado uma vez e parado. Animado, ele obriga o
          navegador a redesfocar todos os painéis a cada quadro: era a maior fonte de lag. */}
      <div className="pointer-events-none absolute inset-0">
        <Aurora colorStops={["#6b4cf0", "#8b6cff", "#c8ff3d"]} amplitude={1.3} blend={0.55} dpr={0.5} paused />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_90%_at_50%_110%,transparent_10%,rgb(8_7_13/0.65)_70%)]" />

      <div className="relative flex h-full flex-col gap-2 p-2 max-md:gap-1.5 max-md:p-1.5 max-md:pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        <div className="max-md:order-2">
          <TransportBar />
        </div>
        <main className="min-h-0 flex-1 max-md:order-1">
          <Suspense fallback={null}>
            <ScreenView screen={screen} />
          </Suspense>
        </main>
        <div className="md:hidden max-md:order-3">
          <NavBar variant="bottom" />
        </div>
      </div>

      <ContextMenu />
      <ConfirmDialog />
      <Toasts />
    </div>
  );
}
