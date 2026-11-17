/**
 * Barra de transporte (T3). Liquid glass da React Bits (GlassSurface).
 *  Espaço ........ tocar/pausar      Enter ..... parar (volta ao início/loop)
 *  Ctrl+Z / Ctrl+Shift+Z ... desfazer / refazer
 */
import { Metronome, Pause, Play, Redo2, Repeat, Square, Undo2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { host } from "@/audio/host";
import GlassSurface from "@/components/GlassSurface";
import GradientText from "@/components/GradientText";
import { BorderBeam } from "@/components/ui/border-beam";
import { cn } from "@/lib/utils";
import { formatPosition } from "@/model/music";
import { NavBar } from "@/nav/NavBar";
import { redo, undo, useHistory, useProject } from "@/store/project";
import { useTransport } from "@/store/transport";
import { InlineEdit } from "@/ui/InlineEdit";
import { IconButton } from "@/ui/primitives";
import { BpmControl } from "./BpmControl";

function PositionDisplay() {
  const ref = useRef<HTMLSpanElement>(null);
  const playing = useTransport((s) => s.playing);
  const cursor = useTransport((s) => s.cursor);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!playing) {
      el.textContent = formatPosition(cursor);
      return;
    }
    let raf = 0;
    const loop = () => {
      el.textContent = formatPosition(host.position());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, cursor]);
  return (
    <div
      className="flex h-10 min-w-[124px] flex-col justify-center rounded-xl bg-black/55 px-3 max-md:min-w-[76px] max-md:px-2 ring-1 ring-white/[0.06] ring-inset"
      title="Posição: compasso.tempo.semicolcheia"
    >
      <span
        ref={ref}
        className={cn(
          "font-mono text-lg leading-none font-semibold tracking-tight",
          playing ? "text-volt-400" : "text-fg",
        )}
      />
      <span className="mt-0.5 font-mono text-[8px] tracking-[0.2em] text-fg-muted max-md:hidden">
        COMP . TEMPO . 1/16
      </span>
    </div>
  );
}

export function TransportBar() {
  const playing = useTransport((s) => s.playing);
  const metronome = useTransport((s) => s.metronome);
  const loop = useProject((s) => s.project.loop);
  const name = useProject((s) => s.project.name);
  const canUndo = useHistory((s) => s.pastStates.length > 0);
  const canRedo = useHistory((s) => s.futureStates.length > 0);

  return (
    <GlassSurface
      width="100%"
      height="auto"
      borderRadius={22}
      blur={16}
      brightness={22}
      opacity={0.94}
      backgroundOpacity={0.62}
      saturation={1.6}
      distortionScale={-90}
      className="shrink-0"
    >
      {/* Tinta escura própria: no modo fosco (Firefox/Safari) o GlassSurface clareia demais. */}
      <div className="pointer-events-none absolute inset-0 -z-10 rounded-[20px] bg-gradient-to-b from-ink-700/55 via-ink-850/50 to-ink-900/55 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.07)]" />
      <div className="flex w-full items-center gap-3 px-2 max-md:gap-1 max-md:px-0">
        {/* Marca e projeto (só no desktop; no celular a tela é curta) */}
        <div className="flex min-w-0 items-center gap-3 max-md:hidden">
          <GradientText
            colors={["#c8ff3d", "#8b6cff", "#c4b5ff", "#c8ff3d"]}
            animationSpeed={8}
            className="font-display text-[19px] font-bold tracking-tight"
          >
            bipoteca
          </GradientText>
          <div className="h-6 w-px bg-white/20" />
          <InlineEdit
            value={name}
            onCommit={(n) => useProject.getState().renameProject(n)}
            className="max-w-44 text-sm font-semibold text-fg hover:text-volt-300"
            inputClassName="w-40 text-sm"
            title="Nome do projeto · duplo clique para renomear"
          />
          <div className="flex">
            <IconButton label="Desfazer (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
              <Undo2 />
            </IconButton>
            <IconButton label="Refazer (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo}>
              <Redo2 />
            </IconButton>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center gap-2 max-md:justify-between max-md:gap-1">
          <IconButton
            label="Parar (Enter) — volta ao início ou ao começo do loop"
            size="lg"
            className="max-md:h-9 max-md:w-9"
            onClick={() => host.stop()}
          >
            <Square className="fill-current" />
          </IconButton>
          <button
            type="button"
            onClick={() => host.togglePlay()}
            aria-label={playing ? "Pausar (Espaço)" : "Tocar (Espaço)"}
            title={playing ? "Pausar (Espaço)" : "Tocar (Espaço)"}
            className={cn(
              "relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl transition-all duration-200 active:scale-90",
              playing
                ? "bg-volt-500 text-ink-950 shadow-[0_0_36px_-4px_var(--color-volt-500)]"
                : "bg-white/[0.08] text-fg ring-1 ring-white/10 ring-inset hover:bg-volt-500 hover:text-ink-950 hover:shadow-[0_0_30px_-6px_var(--color-volt-500)]",
            )}
          >
            {playing ? <Pause className="size-5 fill-current" /> : <Play className="ml-0.5 size-5 fill-current" />}
            {playing && <BorderBeam size={40} duration={2.4} colorFrom="#ffffff" colorTo="#8b6cff" borderWidth={2} />}
          </button>
          <PositionDisplay />
          <BpmControl />
          <IconButton
            label={loop.enabled ? "Loop ligado (duplo clique na régua alterna)" : "Loop desligado"}
            size="lg"
            tone="volt"
            className="max-md:h-9 max-md:w-9"
            active={loop.enabled}
            onClick={() => useProject.getState().setLoop({ enabled: !loop.enabled })}
          >
            <Repeat />
          </IconButton>
          <IconButton
            label="Metrônomo"
            size="lg"
            tone="uv"
            className="max-md:h-9 max-md:w-9"
            active={metronome}
            onClick={() => useTransport.getState().toggleMetronome()}
          >
            <Metronome />
          </IconButton>
        </div>

        <div className="flex items-center max-md:hidden">
          <NavBar variant="inline" />
        </div>
        {/* Desfazer fica à mão no celular. */}
        <div className="flex md:hidden">
          <IconButton label="Desfazer" onClick={undo} disabled={!canUndo}>
            <Undo2 />
          </IconButton>
        </div>
      </div>
    </GlassSurface>
  );
}
