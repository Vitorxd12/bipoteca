/**
 * Régua da playlist. Duas faixas:
 *  - superior (loop): arrastar cria a região; arrastar dentro move; arrastar
 *    a borda redimensiona; duplo clique liga/desliga o loop.
 *  - inferior (posição): clicar/arrastar posiciona o cursor (RF-10).
 * Roda: zoom horizontal no ponto do mouse. Shift+roda: rolagem.
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

const LOOP_H = 14;

type Drag =
  | { kind: "seek" }
  | { kind: "loop-new"; from: number }
  | { kind: "loop-move"; grab: number; start: number; end: number }
  | { kind: "loop-edge"; edge: "start" | "end" };

export function PlaylistRuler() {
  const view = usePlaylistView();
  const loop = useProject((s) => s.project.loop);
  const snap = useUi((s) => s.playlistSnap);
  const head = useRef(0);
  const drag = useRef<Drag | null>(null);
  const hover = useRef<string>("default");

  const { canvasRef, invalidate } = useCanvas((ctx, { width, height }) => {
    const { scrollX, pxPerTick } = view;
    const xOf = (t: number) => (t - scrollX) * pxPerTick;
    ctx.fillStyle = C.ink900;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = C.ink850;
    ctx.fillRect(0, 0, width, LOOP_H);

    // Região de loop
    const lx0 = xOf(loop.start);
    const lx1 = xOf(loop.end);
    const color = loop.enabled ? C.volt500 : C.fgFaint;
    ctx.fillStyle = alpha(color, loop.enabled ? 0.85 : 0.25);
    roundRect(ctx, lx0, 2, lx1 - lx0, LOOP_H - 4, 4);
    ctx.fill();
    if (loop.enabled) {
      ctx.fillStyle = alpha(C.volt500, 0.07);
      ctx.fillRect(lx0, LOOP_H, lx1 - lx0, height - LOOP_H);
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
      ctx.strokeStyle = major ? C.ink500 : C.ink700;
      ctx.beginPath();
      ctx.moveTo(x, major ? LOOP_H + 2 : height - 7);
      ctx.lineTo(x, height);
      ctx.stroke();
      if (major) {
        ctx.fillStyle = b % (every * 4) === 0 ? C.fg : C.fgMuted;
        ctx.fillText(String(b + 1), x + 4, LOOP_H + (height - LOOP_H) / 2);
      }
      if (barPx > 90) {
        for (let q = 1; q < 4; q++) {
          const bx = Math.round(xOf(b * TICKS_PER_BAR + q * PPQ)) + 0.5;
          ctx.strokeStyle = C.ink700;
          ctx.beginPath();
          ctx.moveTo(bx, height - 5);
          ctx.lineTo(bx, height);
          ctx.stroke();
        }
      }
    }

    // Cursor
    const hx = xOf(head.current);
    ctx.fillStyle = C.volt500;
    ctx.beginPath();
    ctx.moveTo(hx - 6, LOOP_H);
    ctx.lineTo(hx + 6, LOOP_H);
    ctx.lineTo(hx, LOOP_H + 9);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(hx - 0.75, LOOP_H, 1.5, height - LOOP_H);

    ctx.strokeStyle = C.ink700;
    ctx.beginPath();
    ctx.moveTo(0, height - 0.5);
    ctx.lineTo(width, height - 0.5);
    ctx.stroke();
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

  const loopHit = (x: number): "start" | "end" | "body" | null => {
    // Loop desligado: a faixa só cria um loop novo.
    if (!loop.enabled) return null;
    const x0 = (loop.start - view.scrollX) * view.pxPerTick;
    const x1 = (loop.end - view.scrollX) * view.pxPerTick;
    if (Math.abs(x - x0) < 6) return "start";
    if (Math.abs(x - x1) < 6) return "end";
    if (x > x0 && x < x1) return "body";
    return null;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    useUi.getState().setZone("playlist");
    const { x, y } = localPoint(e, e.currentTarget);
    const t = tickAt(x);
    if (y < LOOP_H) {
      beginGesture();
      const hit = loopHit(x);
      if (hit === "start" || hit === "end") drag.current = { kind: "loop-edge", edge: hit };
      else if (hit === "body")
        drag.current = {
          kind: "loop-move",
          grab: t,
          start: loop.start,
          end: loop.end,
        };
      else
        drag.current = {
          kind: "loop-new",
          from: Math.max(0, snapRound(t, step)),
        };
      return;
    }
    drag.current = { kind: "seek" };
    useTransport.getState().setCursor(Math.max(0, snapRound(t, e.altKey ? 1 : PPQ / 4)));
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = localPoint(e, e.currentTarget);
    const t = tickAt(x);
    const d = drag.current;
    if (!d) {
      const hit = y < LOOP_H ? loopHit(x) : null;
      const cur =
        hit === "start" || hit === "end" ? "ew-resize" : hit === "body" ? "grab" : y < LOOP_H ? "crosshair" : "text";
      if (cur !== hover.current) {
        hover.current = cur;
        e.currentTarget.style.cursor = cur;
      }
      return;
    }
    const { setLoop } = useProject.getState();
    if (d.kind === "seek") {
      useTransport.getState().setCursor(Math.max(0, snapRound(t, e.altKey ? 1 : PPQ / 4)));
    } else if (d.kind === "loop-new") {
      const s = Math.max(0, snapRound(t, step));
      if (s !== d.from)
        setLoop({
          start: Math.min(s, d.from),
          end: Math.max(s, d.from),
          enabled: true,
        });
    } else if (d.kind === "loop-move") {
      const delta = snapRound(t - d.grab, step);
      const len = d.end - d.start;
      const start = Math.max(0, d.start + delta);
      setLoop({ start, end: start + len });
    } else if (d.kind === "loop-edge") {
      const s = Math.max(0, snapRound(t, step));
      if (d.edge === "start" && s < loop.end) setLoop({ start: s });
      if (d.edge === "end" && s > loop.start) setLoop({ end: s });
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    endGesture();
    if (d?.kind === "seek" && host.isPlaying()) host.seek(useTransport.getState().cursor);
  };

  const onDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { y } = localPoint(e, e.currentTarget);
    if (y < LOOP_H) {
      const { project, setLoop } = useProject.getState();
      setLoop({ enabled: !project.loop.enabled });
    }
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
        title="Faixa de cima: arraste para criar o loop, duplo clique liga/desliga. Faixa de baixo: clique para posicionar."
      />
    </div>
  );
}
