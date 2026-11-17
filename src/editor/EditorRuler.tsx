/**
 * Régua do editor.
 *  clicar/arrastar ............ posiciona o cursor (no modo pattern) ou no clipe
 *  arrastar o marcador de fim .. muda a duração do pattern em compassos (RF-36)
 *  roda ....................... zoom; Shift+roda rola
 */
import { useCallback, useEffect, useRef } from "react";
import { host } from "@/audio/host";
import { localPoint, useCanvas, wheelDelta } from "@/canvas/useCanvas";
import { usePlayhead } from "@/canvas/usePlayhead";
import { snapRound } from "@/model/music";
import { PPQ, TICKS_PER_BAR } from "@/model/types";
import { beginGesture, endGesture, getProject, useProject } from "@/store/project";
import { useTransport } from "@/store/transport";
import { useUi } from "@/store/ui";
import { alpha, C, FONT_MONO } from "@/theme";
import { editorZoomAt, localPlayhead, openPattern, useEditorView, useOpenPattern } from "./view";

export function EditorRuler({ accent }: { accent: string }) {
  const view = useEditorView();
  const pattern = useOpenPattern();
  const head = useRef<number | null>(null);
  const drag = useRef<"seek" | "length" | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  const { canvasRef, invalidate } = useCanvas((ctx, { width, height }) => {
    const { scrollX, pxPerTick } = view;
    const xOf = (t: number) => (t - scrollX) * pxPerTick;
    ctx.fillStyle = C.ink900;
    ctx.fillRect(0, 0, width, height);
    if (!pattern) return;
    const len = pattern.lengthBars * TICKS_PER_BAR;
    const endX = xOf(len);
    ctx.fillStyle = alpha(C.ink950, 0.6);
    ctx.fillRect(endX, 0, width - endX, height);

    ctx.font = `500 10px ${FONT_MONO}`;
    ctx.textBaseline = "middle";
    const beatPx = PPQ * pxPerTick;
    const firstBeat = Math.max(0, Math.floor(scrollX / PPQ));
    const lastBeat = Math.ceil((scrollX + width / pxPerTick) / PPQ);
    for (let b = firstBeat; b <= lastBeat; b++) {
      const x = Math.round(xOf(b * PPQ)) + 0.5;
      const bar = b % 4 === 0;
      ctx.strokeStyle = bar ? C.ink500 : C.ink700;
      ctx.beginPath();
      ctx.moveTo(x, bar ? 4 : height - 7);
      ctx.lineTo(x, height);
      ctx.stroke();
      if (bar) {
        ctx.fillStyle = C.fgMuted;
        ctx.fillText(String(b / 4 + 1), x + 4, height / 2);
      } else if (beatPx > 44) {
        ctx.fillStyle = C.fgFaint;
        ctx.fillText(`${Math.floor(b / 4) + 1}.${(b % 4) + 1}`, x + 3, height / 2 + 1);
      }
    }

    // Marcador de fim (arrastável)
    ctx.fillStyle = accent;
    ctx.fillRect(endX - 1, 0, 2, height);
    ctx.beginPath();
    ctx.roundRect(endX - 7, 3, 14, height - 6, 4);
    ctx.fill();
    ctx.fillStyle = C.ink950;
    for (const dy of [-3, 0, 3]) ctx.fillRect(endX - 3, height / 2 + dy - 0.5, 6, 1);

    if (head.current !== null) {
      const hx = xOf(head.current);
      ctx.fillStyle = C.volt500;
      ctx.beginPath();
      ctx.moveTo(hx - 5, 0);
      ctx.lineTo(hx + 5, 0);
      ctx.lineTo(hx, 8);
      ctx.fill();
    }
    ctx.strokeStyle = C.ink700;
    ctx.beginPath();
    ctx.moveTo(0, height - 0.5);
    ctx.lineTo(width, height - 0.5);
    ctx.stroke();
  });

  usePlayhead(
    useCallback(
      (tick: number) => {
        head.current = localPlayhead(tick);
        invalidate();
      },
      [invalidate],
    ),
  );

  const tickAt = (x: number) => view.scrollX + x / view.pxPerTick;

  const seekTo = (local: number) => {
    const t = useTransport.getState();
    if (t.mode === "pattern") {
      t.setCursor(local);
      return;
    }
    const pat = openPattern();
    const trackId = useUi.getState().editorTrackId;
    const clip = getProject().clips.find((c) => c.patternId === pat?.id && (!trackId || c.trackId === trackId));
    if (clip) t.setCursor(clip.start + local);
    else {
      t.setMode("pattern");
      t.setCursor(local);
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 || !pattern) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x } = localPoint(e, e.currentTarget);
    const endX = (pattern.lengthBars * TICKS_PER_BAR - view.scrollX) * view.pxPerTick;
    if (Math.abs(x - endX) < 9) {
      drag.current = "length";
      beginGesture();
      return;
    }
    drag.current = "seek";
    seekTo(Math.max(0, snapRound(tickAt(x), PPQ / 4)));
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x } = localPoint(e, e.currentTarget);
    if (!drag.current) {
      const endX = pattern ? (pattern.lengthBars * TICKS_PER_BAR - view.scrollX) * view.pxPerTick : -99;
      e.currentTarget.style.cursor = Math.abs(x - endX) < 9 ? "ew-resize" : "text";
      return;
    }
    if (drag.current === "length" && pattern) {
      const bars = Math.max(1, Math.round(tickAt(x) / TICKS_PER_BAR));
      if (bars !== pattern.lengthBars) useProject.getState().setPatternLength(pattern.id, bars);
    } else if (drag.current === "seek") seekTo(Math.max(0, snapRound(tickAt(x), PPQ / 4)));
  };
  const onPointerUp = () => {
    if (drag.current === "length") endGesture();
    if (drag.current === "seek" && host.isPlaying()) host.seek(useTransport.getState().cursor);
    drag.current = null;
  };

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { dx, dy } = wheelDelta(e);
      const v = useEditorView.getState();
      if (e.shiftKey || Math.abs(dx) > Math.abs(dy))
        v.set({ scrollX: v.scrollX + (e.shiftKey ? dy : dx) / v.pxPerTick });
      else editorZoomAt(localPoint(e, el).x, Math.exp(-dy * 0.0018));
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
        title="Clique para posicionar · arraste o marcador para mudar a duração · roda: zoom"
      />
    </div>
  );
}
