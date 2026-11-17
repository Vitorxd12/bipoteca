/**
 * Faixa de velocity (RF-37), comum ao piano roll e ao kit.
 *  clicar/arrastar na vertical ... define a velocity das notas sob o mouse
 *  arrastar na horizontal ........ "pinta" a velocity nas notas cruzadas
 *  duplo clique .................. volta a 80%
 *  roda sobre uma nota ........... ajuste fino (±5%)
 * Se há seleção, só as notas selecionadas são afetadas.
 */
import { useEffect, useRef } from "react";
import { localPoint, useCanvas, wheelDelta } from "@/canvas/useCanvas";
import { clamp } from "@/lib/utils";
import type { Note } from "@/model/types";
import { beginGesture, endGesture } from "@/store/project";
import { useUi } from "@/store/ui";
import { alpha, C, FONT_MONO } from "@/theme";
import { openPattern, setOpenNotes, useEditorView, useOpenPattern } from "./view";

export function VelocityLane({ accent }: { accent: string }) {
  const view = useEditorView();
  const pattern = useOpenPattern();
  const selected = useUi((s) => s.selectedNoteIds);
  const painting = useRef(false);
  const wrap = useRef<HTMLDivElement>(null);

  const { canvasRef } = useCanvas((ctx, { width, height }) => {
    const { scrollX, pxPerTick } = view;
    ctx.fillStyle = C.ink900;
    ctx.fillRect(0, 0, width, height);
    for (const f of [0.25, 0.5, 0.75]) {
      ctx.fillStyle = alpha(C.ink700, 0.6);
      ctx.fillRect(0, Math.round(height - f * (height - 8)) - 0.5, width, 1);
    }
    if (!pattern) return;
    const sel = new Set(selected);
    const sorted = [...pattern.notes].sort((a, b) => a.velocity - b.velocity);
    for (const n of sorted) {
      const x = (n.start - scrollX) * pxPerTick;
      if (x < -10 || x > width + 10) continue;
      const h = n.velocity * (height - 8);
      const isSel = sel.has(n.id);
      const col = isSel ? C.fg : accent;
      ctx.fillStyle = alpha(col, isSel ? 0.9 : 0.55);
      ctx.fillRect(Math.round(x), height - h, 2, h);
      ctx.beginPath();
      ctx.arc(x + 1, height - h, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
    }
    ctx.fillStyle = C.fgFaint;
    ctx.font = `500 9px ${FONT_MONO}`;
    ctx.fillText("100", 4, 11);
  });

  const notesAt = (x: number, notes: Note[]): Note[] => {
    const v = useEditorView.getState();
    const t = v.scrollX + x / v.pxPerTick;
    const tol = 5 / v.pxPerTick;
    const sel = useUi.getState().selectedNoteIds;
    const pool = sel.length ? notes.filter((n) => sel.includes(n.id)) : notes;
    // Preferir notas cujo início está perto do mouse; senão, as que soam ali.
    const near = pool.filter((n) => Math.abs(n.start - t) <= tol);
    return near.length ? near : [];
  };

  const apply = (x: number, y: number, h: number) => {
    const pat = openPattern();
    if (!pat) return;
    const vel = clamp(1 - (y - 8) / (h - 8), 0.02, 1);
    const hits = new Set(notesAt(x, pat.notes).map((n) => n.id));
    if (!hits.size) return;
    setOpenNotes(pat.notes.map((n) => (hits.has(n.id) ? { ...n, velocity: Math.round(vel * 100) / 100 } : n)));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    useUi.getState().setZone("editor");
    painting.current = true;
    beginGesture();
    const { x, y } = localPoint(e, e.currentTarget);
    apply(x, y, e.currentTarget.clientHeight);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = localPoint(e, e.currentTarget);
    const pat = openPattern();
    e.currentTarget.style.cursor = pat && notesAt(x, pat.notes).length ? "ns-resize" : "default";
    if (painting.current) apply(x, y, e.currentTarget.clientHeight);
  };
  const onPointerUp = () => {
    if (painting.current) endGesture();
    painting.current = false;
  };
  const onDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pat = openPattern();
    if (!pat) return;
    const { x } = localPoint(e, e.currentTarget);
    const hits = new Set(notesAt(x, pat.notes).map((n) => n.id));
    setOpenNotes(pat.notes.map((n) => (hits.has(n.id) ? { ...n, velocity: 0.8 } : n)));
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: notesAt lê o estado via getState
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { dx, dy } = wheelDelta(e);
      const v = useEditorView.getState();
      if (e.shiftKey || Math.abs(dx) > Math.abs(dy)) {
        v.set({ scrollX: v.scrollX + (e.shiftKey ? dy : dx) / v.pxPerTick });
        return;
      }
      const pat = openPattern();
      if (!pat) return;
      const hits = new Set(notesAt(localPoint(e, el).x, pat.notes).map((n) => n.id));
      if (!hits.size) return;
      const d = dy < 0 ? 0.05 : -0.05;
      setOpenNotes(
        pat.notes.map((n) =>
          hits.has(n.id) ? { ...n, velocity: Math.round(clamp(n.velocity + d, 0.02, 1) * 100) / 100 } : n,
        ),
      );
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
      />
    </div>
  );
}
