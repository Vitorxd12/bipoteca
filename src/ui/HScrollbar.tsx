/**
 * Barra de rolagem horizontal das grades. Gestos:
 *  arrastar a alça ........ rola
 *  arrastar as pontas ..... zoom (estica/encolhe a janela visível)
 *  clicar na trilha ....... pula para lá
 *  roda ................... rola
 *  duplo clique ........... enquadra tudo
 */
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export function HScrollbar({
  start,
  visible,
  total,
  onScroll,
  onRange,
  onFit,
  tone = "uv",
  className,
}: {
  /** Início visível, em ticks. */
  start: number;
  /** Quantos ticks cabem na tela. */
  visible: number;
  /** Extensão total navegável, em ticks. */
  total: number;
  onScroll: (start: number) => void;
  /** Novo intervalo visível (zoom pelas pontas). */
  onRange?: (start: number, visible: number) => void;
  onFit?: () => void;
  tone?: "uv" | "volt";
  className?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const span = Math.max(total, start + visible, visible);
  const left = Math.max(0, start / span);
  const width = Math.min(1, visible / span);
  const drag = useRef<{ kind: "move" | "left" | "right"; x0: number; s0: number; v0: number } | null>(null);

  const pxToTicks = (px: number) => (px / (track.current?.clientWidth || 1)) * span;

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      onScroll(start + d * (visible / 600));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [start, visible, onScroll]);

  const begin = (kind: "move" | "left" | "right") => (e: React.PointerEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { kind, x0: e.clientX, s0: start, v0: visible };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dt = pxToTicks(e.clientX - d.x0);
    if (d.kind === "move") onScroll(d.s0 + dt);
    else if (d.kind === "left" && onRange) {
      const v = Math.max(d.v0 * 0.05, d.v0 - dt);
      onRange(d.s0 + d.v0 - v, v);
    } else if (d.kind === "right" && onRange) onRange(d.s0, Math.max(d.v0 * 0.05, d.v0 + dt));
  };
  const end = () => {
    drag.current = null;
  };

  const thumb = tone === "volt" ? "bg-volt-500/45 hover:bg-volt-500/70" : "bg-uv-500/45 hover:bg-uv-400/70";

  return (
    <div
      ref={track}
      className={cn(
        "group/sb relative h-3 cursor-pointer rounded-full bg-black/40 ring-1 ring-white/[0.06] ring-inset",
        className,
      )}
      title="Arraste para rolar · pontas: zoom · duplo clique: enquadrar tudo"
      onPointerDown={(e) => {
        if (e.button !== 0 || !track.current) return;
        const r = track.current.getBoundingClientRect();
        const at = ((e.clientX - r.left) / r.width) * span;
        onScroll(at - visible / 2);
      }}
      onDoubleClick={onFit}
    >
      <div
        className={cn(
          "absolute top-0.5 bottom-0.5 min-w-6 cursor-grab rounded-full transition-colors active:cursor-grabbing",
          thumb,
        )}
        style={{ left: `${left * 100}%`, width: `${width * 100}%` }}
        onPointerDown={begin("move")}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        {onRange && (
          <>
            <span
              className="absolute top-0 bottom-0 left-0 w-2 cursor-ew-resize rounded-l-full bg-white/0 group-hover/sb:bg-white/30"
              onPointerDown={begin("left")}
              onPointerMove={move}
              onPointerUp={end}
            />
            <span
              className="absolute top-0 right-0 bottom-0 w-2 cursor-ew-resize rounded-r-full bg-white/0 group-hover/sb:bg-white/30"
              onPointerDown={begin("right")}
              onPointerMove={move}
              onPointerUp={end}
            />
          </>
        )}
      </div>
    </div>
  );
}
