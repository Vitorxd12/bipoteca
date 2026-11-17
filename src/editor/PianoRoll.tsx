/**
 * Piano roll (T6): teclado vertical, grade de notas, faixa de velocity.
 * Teclado:
 *  clicar/segurar ...... toca a nota; arrastar faz glissando
 *  duplo clique ........ seleciona todas as notas daquela altura
 *  roda ................ rola; Alt/Ctrl+roda muda a altura das teclas
 */
import { memo, useEffect, useRef } from "react";
import { host } from "@/audio/host";
import { localPoint, useCanvas, wheelDelta } from "@/canvas/useCanvas";
import { LIMITS } from "@/model/limits";
import { isBlackKey, noteName } from "@/model/music";
import { useUi } from "@/store/ui";
import { alpha, C, FONT_MONO } from "@/theme";
import { EditorRuler } from "./EditorRuler";
import { EditorScrollbar } from "./EditorScrollbar";
import { PianoGrid } from "./PianoGrid";
import { VelocityLane } from "./VelocityLane";
import { centerPiano, EDITOR_RULER_H, KEYS_W, openPattern, useEditorView, VELOCITY_H } from "./view";

function PianoKeys({ trackId }: { trackId: string | null }) {
  const view = useEditorView();
  const held = useRef<number | null>(null);
  const hovered = useRef<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  const pitchAt = (y: number) => LIMITS.pitchMax - Math.floor((y + view.scrollY) / view.keyH);

  const { canvasRef, invalidate } = useCanvas((ctx, { width, height }) => {
    const { scrollY, keyH } = view;
    ctx.fillStyle = C.ink950;
    ctx.fillRect(0, 0, width, height);
    const top = pitchAt(0);
    const bottom = pitchAt(height);
    ctx.textBaseline = "middle";
    for (let p = top; p >= bottom; p--) {
      if (p < LIMITS.pitchMin || p > LIMITS.pitchMax) continue;
      const y = (LIMITS.pitchMax - p) * keyH - scrollY;
      const black = isBlackKey(p);
      const active = held.current === p;
      const hov = hovered.current === p;
      ctx.fillStyle = active ? C.uv500 : black ? C.ink850 : hov ? "#3a3352" : "#2b253b";
      ctx.fillRect(black ? 0 : 0, y + 0.5, black ? width * 0.62 : width - 1, keyH - 1);
      if (!black) {
        ctx.fillStyle = alpha(C.fg, 0.04);
        ctx.fillRect(0, y + 0.5, width - 1, 1);
      }
      if (p % 12 === 0 || hov || active) {
        ctx.font = `${p % 12 === 0 ? 600 : 500} ${Math.min(10, keyH - 3)}px ${FONT_MONO}`;
        ctx.fillStyle = active ? C.ink950 : p % 12 === 0 ? C.fg : C.fgMuted;
        ctx.textAlign = "right";
        if (keyH >= 9) ctx.fillText(noteName(p), width - 6, y + keyH / 2 + 0.5);
        ctx.textAlign = "left";
      }
    }
    ctx.fillStyle = C.ink700;
    ctx.fillRect(width - 1, 0, 1, height);
  });

  const release = () => {
    if (held.current !== null && trackId) void host.previewOff(trackId, held.current);
    held.current = null;
    invalidate();
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 || !trackId) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pitchAt(localPoint(e, e.currentTarget).y);
    held.current = p;
    void host.previewOn(trackId, p);
    invalidate();
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = pitchAt(localPoint(e, e.currentTarget).y);
    if (hovered.current !== p) {
      hovered.current = p;
      invalidate();
    }
    if (held.current !== null && held.current !== p && trackId) {
      void host.previewOff(trackId, held.current);
      held.current = p;
      void host.previewOn(trackId, p);
    }
  };
  const onDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const p = pitchAt(localPoint(e, e.currentTarget).y);
    const pat = openPattern();
    if (pat) useUi.getState().selectNotes(pat.notes.filter((n) => n.pitch === p).map((n) => n.id));
  };

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { dy } = wheelDelta(e);
      const v = useEditorView.getState();
      if (e.altKey || e.ctrlKey || e.metaKey) {
        const y = localPoint(e, el).y;
        const pos = (y + v.scrollY) / v.keyH;
        v.set({ keyH: v.keyH * Math.exp(-dy * 0.0015) });
        const nv = useEditorView.getState();
        v.set({ scrollY: pos * nv.keyH - y });
        return;
      }
      const maxY = Math.max(0, (LIMITS.pitchMax - LIMITS.pitchMin + 1) * v.keyH - el.clientHeight);
      v.set({ scrollY: Math.min(maxY, v.scrollY + dy) });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div ref={wrap} className="h-full w-full">
      <canvas
        ref={canvasRef}
        className="block h-full w-full cursor-pointer touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerLeave={() => {
          hovered.current = null;
          invalidate();
        }}
        onDoubleClick={onDoubleClick}
        title="Clique para ouvir · arraste para glissando · duplo clique seleciona as notas desta altura"
      />
    </div>
  );
}

export const PianoRoll = memo(function PianoRoll({ trackId }: { trackId: string | null }) {
  const body = useRef<HTMLDivElement>(null);
  const patternId = useUi((s) => s.openPatternId);

  // Ao abrir outro pattern, centraliza nas notas dele.
  useEffect(() => {
    if (patternId && body.current) centerPiano(body.current.clientHeight);
  }, [patternId]);

  return (
    <div
      className="grid min-h-0 flex-1"
      style={{ gridTemplateColumns: `${KEYS_W}px 1fr`, gridTemplateRows: `${EDITOR_RULER_H}px 1fr ${VELOCITY_H}px` }}
    >
      <div className="border-r border-b border-white/[0.06] bg-ink-900" />
      <div className="min-w-0 overflow-hidden">
        <EditorRuler accent={C.uv500} />
      </div>
      <div ref={body} className="min-h-0 overflow-hidden">
        <PianoKeys trackId={trackId} />
      </div>
      <div className="relative min-h-0 min-w-0">
        <PianoGrid trackId={trackId} />
        <EditorScrollbar tone="uv" />
      </div>
      <div className="flex items-start justify-end border-t border-r border-white/[0.06] bg-ink-900 p-2">
        <span className="font-mono text-[9px] tracking-widest text-fg-faint uppercase [writing-mode:vertical-rl] rotate-180">
          velocity
        </span>
      </div>
      <div className="min-w-0 overflow-hidden border-t border-white/[0.06]">
        <VelocityLane accent={C.uv400} />
      </div>
    </div>
  );
});
