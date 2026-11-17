/**
 * Régua da playlist: posição e loop na mesma faixa.
 *  clicar ......................... posiciona o cursor (RF-10)
 *  arrastar ....................... cria a região de loop (e liga o loop)
 *  arrastar a borda do loop ....... redimensiona
 *  arrastar dentro do loop ........ move a região
 *  duplo clique ................... liga/desliga o loop
 *  Shift + arrastar ............... arrasta o cursor (scrub)
 *  roda ........................... zoom no mouse · Shift+roda rola
 */
import { useCallback, useEffect, useRef } from "react";
import { host } from "@/audio/host";
import { localPoint, roundRect, useCanvas, wheelDelta } from "@/canvas/useCanvas";
import { usePlayhead } from "@/canvas/usePlayhead";
import { snapRound } from "@/model/music";
import { PPQ, TICKS_PER_BAR } from "@/model/types";
import { beginGesture, endGesture, useProject } from "@/store/project";
import { useTransport } from "@/store/transport";
import { playlistSnapTicks, useUi } from "@/store/ui";
import { alpha, C, FONT_MONO } from "@/theme";
import { usePlaylistView, zoomAt } from "./view";

const EDGE = 7;
const DRAG_START = 4;

type Drag =
  | { kind: "pending"; x0: number; t0: number; inLoop: boolean }
  | { kind: "scrub" }
  | { kind: "loop-new"; from: number }
  | { kind: "loop-move"; grab: number; start: number; end: number }
  | { kind: "loop-edge"; edge: "start" | "end" };

export function PlaylistRuler() {
  const view = usePlaylistView();
  const loop = useProject((s) => s.project.loop);
  const snap = useUi((s) => s.playlistSnap);
  const head = useRef(0);
  const drag = useRef<Drag | null>(null);
  const hover = useRef("default");

  const { canvasRef, invalidate } = useCanvas((ctx, { width, height }) => {
    const { scrollX, pxPerTick } = view;
    const xOf = (t: number) => (t - scrollX) * pxPerTick;
    ctx.fillStyle = C.ink900;
    ctx.fillRect(0, 0, width, height);

    // Região de loop: faixa da altura toda, com colchetes nas bordas.
    const lx0 = xOf(loop.start);
    const lx1 = xOf(loop.end);
    if (loop.end > loop.start) {
      ctx.fillStyle = loop.enabled ? alpha(C.volt500, 0.16) : alpha(C.fg, 0.04);
      ctx.fillRect(lx0, 0, lx1 - lx0, height);
      ctx.fillStyle = loop.enabled ? C.volt500 : alpha(C.fgFaint, 0.6);
      roundRect(ctx, lx0, 0, lx1 - lx0, 3, 1.5);
      ctx.fill();
      ctx.fillRect(lx0, 0, 2, height);
      ctx.fillRect(lx0, height - 2, 6, 2);
      ctx.fillRect(lx1 - 2, 0, 2, height);
      ctx.fillRect(lx1 - 6, height - 2, 6, 2);
    }

    // Compassos
    const barPx = TICKS_PER_BAR * pxPerTick;
    const every = barPx < 18 ? 8 : barPx < 36 ? 4 : barPx < 70 ? 2 : 1;
    const firstBar = Math.max(0, Math.floor(scrollX / TICKS_PER_BAR));
    const lastBar = Math.ceil((scrollX + width / pxPerTick) / TICKS_PER_BAR);
    ctx.font = `500 10px ${FONT_MONO}`;
    ctx.textBaseline = "middle";
    for (let b = firstBar; b <= lastBar; b++) {
      const x = Math.round(xOf(b * TICKS_PER_BAR)) + 0.5;
      const major = b % every === 0;
      ctx.fillStyle = major ? C.ink500 : C.ink700;
      ctx.fillRect(x - 0.5, major ? height * 0.45 : height - 7, 1, height);
      if (major) {
        const inLoop = loop.enabled && b * TICKS_PER_BAR >= loop.start && b * TICKS_PER_BAR < loop.end;
        ctx.fillStyle = inLoop ? C.volt300 : b % (every * 4) === 0 ? C.fg : C.fgMuted;
        ctx.fillText(String(b + 1), x + 4, height * 0.42);
      }
      if (barPx > 90) {
        ctx.fillStyle = C.ink700;
        for (let q = 1; q < 4; q++) ctx.fillRect(Math.round(xOf(b * TICKS_PER_BAR + q * PPQ)), height - 5, 1, 5);
      }
    }

    // Cursor
    const hx = xOf(head.current);
    ctx.fillStyle = C.volt500;
    ctx.beginPath();
    ctx.moveTo(hx - 6, 0);
    ctx.lineTo(hx + 6, 0);
    ctx.lineTo(hx, 9);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(hx - 0.75, 0, 1.5, height);

    ctx.fillStyle = C.ink700;
    ctx.fillRect(0, height - 1, width, 1);
  });

  usePlayhead(
    useCallback(
      (tick: number) => {
        head.current = tick;
        invalidate();
      },
      [invalidate],
    ),
  );

  const tickAt = (x: number) => view.scrollX + x / view.pxPerTick;
  const step = playlistSnapTicks(snap);
  const seekStep = (alt: boolean) => (alt ? 1 : PPQ / 4);

  const loopHit = (x: number): "start" | "end" | "body" | null => {
    if (!loop.enabled || loop.end <= loop.start) return null;
    const x0 = (loop.start - view.scrollX) * view.pxPerTick;
    const x1 = (loop.end - view.scrollX) * view.pxPerTick;
    if (Math.abs(x - x0) < EDGE) return "start";
    if (Math.abs(x - x1) < EDGE) return "end";
    if (x > x0 && x < x1) return "body";
    return null;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    useUi.getState().setZone("playlist");
    const { x } = localPoint(e, e.currentTarget);
    const t = tickAt(x);
    if (e.shiftKey) {
      drag.current = { kind: "scrub" };
      useTransport.getState().setCursor(Math.max(0, snapRound(t, seekStep(e.altKey))));
      return;
    }
    const hit = loopHit(x);
    if (hit === "start" || hit === "end") {
      beginGesture();
      drag.current = { kind: "loop-edge", edge: hit };
      return;
    }
    drag.current = { kind: "pending", x0: x, t0: t, inLoop: hit === "body" };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x } = localPoint(e, e.currentTarget);
    const t = tickAt(x);
    let d = drag.current;
    if (!d) {
      const hit = loopHit(x);
      const cur = hit === "start" || hit === "end" ? "ew-resize" : hit === "body" ? "grab" : "pointer";
      if (cur !== hover.current) {
        hover.current = cur;
        e.currentTarget.style.cursor = cur;
      }
      return;
    }
    // Clique só vira arraste depois de alguns pixels: assim um clique simples ainda posiciona.
    if (d.kind === "pending") {
      if (Math.abs(x - d.x0) < DRAG_START) return;
      beginGesture();
      d = d.inLoop
        ? { kind: "loop-move", grab: d.t0, start: loop.start, end: loop.end }
        : { kind: "loop-new", from: Math.max(0, snapRound(d.t0, step)) };
      drag.current = d;
      e.currentTarget.style.cursor = d.kind === "loop-move" ? "grabbing" : "ew-resize";
    }
    const { setLoop } = useProject.getState();
    if (d.kind === "scrub") {
      useTransport.getState().setCursor(Math.max(0, snapRound(t, seekStep(e.altKey))));
    } else if (d.kind === "loop-new") {
      const s = Math.max(0, snapRound(t, e.altKey ? 1 : step));
      if (s !== d.from) setLoop({ start: Math.min(s, d.from), end: Math.max(s, d.from), enabled: true });
    } else if (d.kind === "loop-move") {
      const delta = snapRound(t - d.grab, e.altKey ? 1 : step);
      const len = d.end - d.start;
      const start = Math.max(0, d.start + delta);
      setLoop({ start, end: start + len });
    } else if (d.kind === "loop-edge") {
      const s = Math.max(0, snapRound(t, e.altKey ? 1 : step));
      if (d.edge === "start" && s < loop.end) setLoop({ start: s });
      if (d.edge === "end" && s > loop.start) setLoop({ end: s });
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    drag.current = null;
    hover.current = "";
    if (!d) return;
    if (d.kind === "pending") {
      // Clique simples: posiciona o cursor.
      useTransport.getState().setCursor(Math.max(0, snapRound(d.t0, seekStep(e.altKey))));
      if (host.isPlaying()) host.seek(useTransport.getState().cursor);
      return;
    }
    if (d.kind === "scrub") {
      if (host.isPlaying()) host.seek(useTransport.getState().cursor);
      return;
    }
    endGesture();
  };

  const onDoubleClick = () => {
    const { project, setLoop } = useProject.getState();
    setLoop({ enabled: !project.loop.enabled });
  };

  // Roda: zoom (passive:false para poder impedir o scroll da página).
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { dx, dy } = wheelDelta(e);
      const v = usePlaylistView.getState();
      if (e.shiftKey || Math.abs(dx) > Math.abs(dy)) {
        v.set({ scrollX: v.scrollX + (e.shiftKey ? dy : dx) / v.pxPerTick });
        return;
      }
      zoomAt(localPoint(e, el).x, Math.exp(-dy * 0.0018));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div ref={wrap} className="h-full w-full">
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        title="Clique: posiciona · arraste: cria o loop · bordas ajustam · dentro move · 2×: liga/desliga · Shift+arrastar: scrub"
      />
    </div>
  );
}
