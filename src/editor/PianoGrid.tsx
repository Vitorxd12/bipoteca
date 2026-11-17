/**
 * Grade do piano roll (canvas). Gestos:
 *  clique no vazio ............. cria nota (duração da última editada) e já arrasta
 *  arrastar nota ............... move no tempo e na altura (pré-escuta ao mudar)
 *  arrastar a borda direita .... muda a duração (da seleção inteira)
 *  Shift+clique ................ soma/tira da seleção
 *  Ctrl+arrastar nota .......... copia
 *  Ctrl/Shift+arrastar vazio ... seleção em retângulo
 *  duplo clique na nota ........ apaga
 *  botão direito (arrastar) .... borracha
 *  botão do meio ............... navega
 *  Alt durante o arraste ....... sem encaixe
 *  roda / Shift+roda ........... rola vertical / horizontal
 *  Ctrl+roda / Alt+roda ........ zoom horizontal / vertical
 */
import { useCallback, useEffect, useRef } from "react";
import { host } from "@/audio/host";
import { localPoint, roundRect, useCanvas, wheelDelta } from "@/canvas/useCanvas";
import { usePlayhead } from "@/canvas/usePlayhead";
import { clamp, uid } from "@/lib/utils";
import { LIMIT_LABELS, LIMITS } from "@/model/limits";
import { findOverflowNotes, isBlackKey, noteName, snapDown, snapRound, snapTicks } from "@/model/music";
import { type Note, PPQ, TICKS_PER_BAR } from "@/model/types";
import { beginGesture, endGesture } from "@/store/project";
import { toast } from "@/store/toast";
import { useTransport } from "@/store/transport";
import { useUi } from "@/store/ui";
import { alpha, C, FONT_MONO } from "@/theme";
import { editorZoomAt, localPlayhead, openPattern, setOpenNotes, useEditorView, useOpenPattern } from "./view";

type Drag =
  | {
      kind: "move";
      x0: number;
      y0: number;
      anchor: Note;
      origin: Map<string, Note>;
      lastPitch: number;
      moved: boolean;
    }
  | { kind: "resize"; x0: number; anchor: Note; origin: Map<string, Note> }
  | { kind: "marquee"; x0: number; y0: number; x1: number; y1: number; base: string[] }
  | { kind: "erase" }
  | { kind: "pan"; x0: number; y0: number; sx: number; sy: number };

const EDGE = 7;

export function PianoGrid({ trackId }: { trackId: string | null }) {
  const view = useEditorView();
  const pattern = useOpenPattern();
  const selected = useUi((s) => s.selectedNoteIds);
  const snap = useUi((s) => s.editorSnap);
  const drag = useRef<Drag | null>(null);
  const hover = useRef<{ tick: number; pitch: number } | null>(null);
  const lastDown = useRef<{ id: string; t: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const step = snapTicks(snap);

  const pitchAt = (y: number) => {
    const v = useEditorView.getState();
    return LIMITS.pitchMax - Math.floor((y + v.scrollY) / v.keyH);
  };
  const tickAt = (x: number) => {
    const v = useEditorView.getState();
    return v.scrollX + x / v.pxPerTick;
  };

  // ------------------------------------------------------------ desenho

  const { canvasRef, invalidate } = useCanvas((ctx, { width, height }) => {
    const { scrollX, scrollY, pxPerTick, keyH } = view;
    const xOf = (t: number) => (t - scrollX) * pxPerTick;
    const yOf = (p: number) => (LIMITS.pitchMax - p) * keyH - scrollY;
    ctx.fillStyle = C.ink950;
    ctx.fillRect(0, 0, width, height);

    // Linhas de nota
    const top = pitchAt(0);
    const bottom = pitchAt(height);
    for (let p = top; p >= bottom; p--) {
      if (p < LIMITS.pitchMin || p > LIMITS.pitchMax) continue;
      const y = yOf(p);
      ctx.fillStyle = isBlackKey(p) ? C.ink950 : C.ink900;
      ctx.fillRect(0, y, width, keyH);
      if (p % 12 === 0) {
        ctx.fillStyle = C.ink600;
        ctx.fillRect(0, y + keyH - 1, width, 1);
      } else if (p % 12 === 5) {
        ctx.fillStyle = alpha(C.ink700, 0.7);
        ctx.fillRect(0, y + keyH - 1, width, 1);
      }
    }

    // Linhas de tempo
    const sub = step * pxPerTick >= 7 ? step : PPQ;
    const first = Math.max(0, Math.floor(scrollX / sub));
    const last = Math.ceil((scrollX + width / pxPerTick) / sub);
    for (let i = first; i <= last; i++) {
      const t = i * sub;
      const x = Math.round(xOf(t));
      ctx.fillStyle = t % TICKS_PER_BAR === 0 ? C.ink500 : t % PPQ === 0 ? C.ink700 : alpha(C.ink700, 0.45);
      ctx.fillRect(x, 0, 1, height);
    }

    if (!pattern) return;
    const len = pattern.lengthBars * TICKS_PER_BAR;
    const endX = xOf(len);
    ctx.fillStyle = alpha(C.ink950, 0.62);
    ctx.fillRect(endX, 0, width - endX, height);
    ctx.fillStyle = alpha(C.uv500, 0.6);
    ctx.fillRect(endX - 1, 0, 2, height);

    // Nota fantasma onde o clique criaria uma
    const h = hover.current;
    if (h && !drag.current) {
      const gx = xOf(h.tick);
      const gy = yOf(h.pitch);
      roundRect(ctx, gx + 0.5, gy + 1, useUi.getState().lastNoteLength * pxPerTick - 1, keyH - 2, 3);
      ctx.strokeStyle = alpha(C.uv400, 0.5);
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Notas
    const sel = new Set(selected);
    const overflow = findOverflowNotes(pattern.notes, LIMITS.voicesPerTrack);
    ctx.font = `600 ${Math.min(10, keyH - 4)}px ${FONT_MONO}`;
    ctx.textBaseline = "middle";
    for (const n of pattern.notes) {
      const x = xOf(n.start);
      const w = Math.max(3, n.duration * pxPerTick - 1);
      const y = yOf(n.pitch);
      if (x > width || x + w < 0 || y > height || y + keyH < 0) continue;
      const isSel = sel.has(n.id);
      const over = overflow.has(n.id);
      const base = over ? C.coral500 : C.uv500;
      ctx.save();
      if (isSel) {
        ctx.shadowColor = alpha(over ? C.coral500 : C.uv400, 0.9);
        ctx.shadowBlur = 12;
      }
      roundRect(ctx, x + 0.5, y + 1, w, keyH - 2, Math.min(4, keyH / 3));
      ctx.fillStyle = alpha(base, 0.45 + n.velocity * 0.55);
      ctx.fill();
      ctx.shadowBlur = 0;
      if (over) {
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = alpha(C.ink950, 0.45);
        ctx.lineWidth = 2;
        for (let sx = x - keyH; sx < x + w; sx += 6) {
          ctx.beginPath();
          ctx.moveTo(sx, y + keyH);
          ctx.lineTo(sx + keyH, y);
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.lineWidth = isSel ? 1.5 : 1;
      ctx.strokeStyle = isSel ? C.fg : alpha(over ? C.coral400 : C.uv300, 0.7);
      ctx.stroke();
      // Alça de duração
      ctx.fillStyle = alpha(C.fg, isSel ? 0.7 : 0.3);
      if (w > 12) ctx.fillRect(x + w - 4, y + keyH / 2 - Math.min(4, keyH / 4), 1.5, Math.min(8, keyH / 2));
      if (w > 30 && keyH >= 12) {
        ctx.fillStyle = alpha(C.ink950, 0.85);
        ctx.fillText(noteName(n.pitch), x + 4, y + keyH / 2 + 0.5, w - 10);
      }
      ctx.restore();
    }

    const d = drag.current;
    if (d?.kind === "marquee") {
      const x = Math.min(d.x0, d.x1);
      const y = Math.min(d.y0, d.y1);
      ctx.fillStyle = alpha(C.uv500, 0.12);
      ctx.strokeStyle = alpha(C.uv400, 0.8);
      ctx.fillRect(x, y, Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0));
      ctx.strokeRect(x + 0.5, y + 0.5, Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0));
    }
  });

  // Cursor de reprodução
  const headCanvas = useRef<HTMLCanvasElement | null>(null);
  const drawHead = useCallback((tick: number) => {
    const cv = headCanvas.current;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(rect.width * dpr)) cv.width = Math.round(rect.width * dpr);
    if (cv.height !== Math.round(rect.height * dpr)) cv.height = Math.round(rect.height * dpr);
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    const local = localPlayhead(tick);
    if (local === null) return;
    const v = useEditorView.getState();
    const x = (local - v.scrollX) * v.pxPerTick;
    ctx.fillStyle = alpha(C.volt500, 0.16);
    ctx.fillRect(x - 4, 0, 8, rect.height);
    ctx.fillStyle = C.volt500;
    ctx.fillRect(x - 0.75, 0, 1.5, rect.height);
  }, []);
  usePlayhead(drawHead);
  // biome-ignore lint/correctness/useExhaustiveDependencies: redesenha quando a câmera muda
  useEffect(() => {
    drawHead(host.position());
  }, [view.scrollX, view.pxPerTick, drawHead]);

  // -------------------------------------------------------- hit-testing

  const hitNote = (x: number, y: number): { note: Note; edge: boolean } | null => {
    const pat = openPattern();
    if (!pat) return null;
    const v = useEditorView.getState();
    const p = pitchAt(y);
    const t = tickAt(x);
    for (let i = pat.notes.length - 1; i >= 0; i--) {
      const n = pat.notes[i];
      if (!n || n.pitch !== p || t < n.start || t > n.start + n.duration) continue;
      const right = (n.start + n.duration - v.scrollX) * v.pxPerTick;
      return { note: n, edge: right - x <= EDGE && n.duration * v.pxPerTick > EDGE * 1.5 };
    }
    return null;
  };

  const preview = (pitch: number, velocity = 0.8) => {
    if (trackId && !useTransport.getState().playing) void host.previewNote(trackId, pitch, velocity);
  };

  // ------------------------------------------------------------ ponteiro

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const el = e.currentTarget;
    const { x, y } = localPoint(e, el);
    const ui = useUi.getState();
    ui.setZone("editor");
    const pat = openPattern();
    if (!pat) return;

    if (e.button === 1) {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      const v = useEditorView.getState();
      drag.current = { kind: "pan", x0: x, y0: y, sx: v.scrollX, sy: v.scrollY };
      el.style.cursor = "grabbing";
      return;
    }
    if (e.button === 2) {
      el.setPointerCapture(e.pointerId);
      beginGesture();
      drag.current = { kind: "erase" };
      eraseAt(x, y);
      return;
    }
    if (e.button !== 0) return;
    el.setPointerCapture(e.pointerId);
    const hit = hitNote(x, y);

    // Horário do evento (não do processamento): continua certo mesmo com a página ocupada.
    const now = e.timeStamp;
    const isDouble = !!hit && lastDown.current?.id === hit.note.id && now - lastDown.current.t < 350;
    lastDown.current = hit ? { id: hit.note.id, t: now } : null;
    if (hit && isDouble) {
      // Duplo clique: apaga
      setOpenNotes(pat.notes.filter((n) => n.id !== hit.note.id));
      ui.selectNotes(ui.selectedNoteIds.filter((id) => id !== hit.note.id));
      drag.current = null;
      return;
    }

    if (hit) {
      let sel = ui.selectedNoteIds;
      if (e.shiftKey) {
        sel = sel.includes(hit.note.id) ? sel.filter((id) => id !== hit.note.id) : [...sel, hit.note.id];
        ui.selectNotes(sel);
        return;
      }
      if (!sel.includes(hit.note.id)) {
        sel = [hit.note.id];
        ui.selectNotes(sel);
      }
      beginGesture();
      let notes = pat.notes;
      let anchor = hit.note;
      let ids = sel;
      if ((e.ctrlKey || e.metaKey) && !hit.edge) {
        // Copiar arrastando: as cópias é que se movem.
        const copies = notes.filter((n) => sel.includes(n.id)).map((n) => ({ ...n, id: uid("n") }));
        if (notes.length + copies.length > LIMITS.notesPerPattern) {
          toast(LIMIT_LABELS.notesPerPattern, "warn");
          endGesture();
          return;
        }
        const map = new Map(notes.filter((n) => sel.includes(n.id)).map((n, i) => [n.id, copies[i]]));
        anchor = map.get(hit.note.id) ?? anchor;
        notes = [...notes, ...copies];
        ids = copies.map((c) => c.id);
        setOpenNotes(notes);
        ui.selectNotes(ids);
      }
      const origin = new Map(notes.filter((n) => ids.includes(n.id)).map((n) => [n.id, { ...n }]));
      if (hit.edge) {
        drag.current = { kind: "resize", x0: x, anchor: { ...anchor }, origin };
      } else {
        drag.current = {
          kind: "move",
          x0: x,
          y0: y,
          anchor: { ...anchor },
          origin,
          lastPitch: anchor.pitch,
          moved: false,
        };
        preview(anchor.pitch, anchor.velocity);
      }
      return;
    }

    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      drag.current = { kind: "marquee", x0: x, y0: y, x1: x, y1: y, base: e.shiftKey ? ui.selectedNoteIds : [] };
      if (!e.shiftKey) ui.selectNotes([]);
      return;
    }

    // Vazio: cria nota e já entra em modo de mover.
    const pitch = pitchAt(y);
    const len = pat.lengthBars * TICKS_PER_BAR;
    const start = snapDown(tickAt(x), e.altKey ? 1 : step);
    if (pitch < LIMITS.pitchMin || pitch > LIMITS.pitchMax || start < 0 || start >= len) return;
    if (pat.notes.length >= LIMITS.notesPerPattern) {
      toast(LIMIT_LABELS.notesPerPattern, "warn");
      return;
    }
    beginGesture();
    const note: Note = {
      id: uid("n"),
      pitch,
      start,
      duration: Math.min(ui.lastNoteLength, len - start),
      velocity: 0.8,
    };
    setOpenNotes([...pat.notes, note]);
    ui.selectNotes([note.id]);
    preview(pitch);
    drag.current = {
      kind: "move",
      x0: x,
      y0: y,
      anchor: { ...note },
      origin: new Map([[note.id, { ...note }]]),
      lastPitch: pitch,
      moved: false,
    };
  };

  const eraseAt = (x: number, y: number) => {
    const hit = hitNote(x, y);
    const pat = openPattern();
    if (!hit || !pat) return;
    setOpenNotes(pat.notes.filter((n) => n.id !== hit.note.id));
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const el = e.currentTarget;
    const { x, y } = localPoint(e, el);
    const d = drag.current;
    const pat = openPattern();
    if (!d) {
      const hit = hitNote(x, y);
      el.style.cursor = hit ? (hit.edge ? "ew-resize" : "grab") : "crosshair";
      const p = pitchAt(y);
      const next = hit ? null : { tick: snapDown(tickAt(x), step), pitch: p };
      if (next?.tick !== hover.current?.tick || next?.pitch !== hover.current?.pitch) {
        hover.current = next;
        invalidate();
      }
      return;
    }
    if (!pat) return;
    const v = useEditorView.getState();
    const len = pat.lengthBars * TICKS_PER_BAR;

    if (d.kind === "pan") {
      v.set({ scrollX: d.sx - (x - d.x0) / v.pxPerTick, scrollY: d.sy - (y - d.y0) });
      return;
    }
    if (d.kind === "erase") {
      eraseAt(x, y);
      return;
    }
    if (d.kind === "marquee") {
      d.x1 = x;
      d.y1 = y;
      const t0 = tickAt(Math.min(d.x0, x));
      const t1 = tickAt(Math.max(d.x0, x));
      const pHi = pitchAt(Math.min(d.y0, y));
      const pLo = pitchAt(Math.max(d.y0, y));
      const hits = pat.notes
        .filter((n) => n.pitch >= pLo && n.pitch <= pHi && n.start < t1 && n.start + n.duration > t0)
        .map((n) => n.id);
      useUi.getState().selectNotes([...new Set([...d.base, ...hits])]);
      invalidate();
      return;
    }
    if (d.kind === "resize") {
      const s = e.altKey ? 1 : step;
      const target = snapRound(d.anchor.duration + (x - d.x0) / v.pxPerTick, s);
      const delta = Math.max(s, target) - d.anchor.duration;
      setOpenNotes(
        pat.notes.map((n) => {
          const o = d.origin.get(n.id);
          return o ? { ...n, duration: clamp(o.duration + delta, s, len - o.start) } : n;
        }),
      );
      el.style.cursor = "ew-resize";
      return;
    }
    if (d.kind === "move") {
      if (!d.moved && Math.hypot(x - d.x0, y - d.y0) < 3) return;
      d.moved = true;
      const s = e.altKey ? 1 : step;
      let dt = snapRound(d.anchor.start + (x - d.x0) / v.pxPerTick, s) - d.anchor.start;
      let dp = Math.round(-(y - d.y0) / v.keyH);
      const origins = [...d.origin.values()];
      const minStart = Math.min(...origins.map((o) => o.start));
      const maxStart = Math.max(...origins.map((o) => o.start));
      const minP = Math.min(...origins.map((o) => o.pitch));
      const maxP = Math.max(...origins.map((o) => o.pitch));
      dt = clamp(dt, -minStart, len - 1 - maxStart);
      dp = clamp(dp, LIMITS.pitchMin - minP, LIMITS.pitchMax - maxP);
      setOpenNotes(
        pat.notes.map((n) => {
          const o = d.origin.get(n.id);
          return o
            ? { ...n, start: o.start + dt, pitch: o.pitch + dp, duration: Math.min(o.duration, len - (o.start + dt)) }
            : n;
        }),
      );
      const newPitch = d.anchor.pitch + dp;
      if (newPitch !== d.lastPitch) {
        d.lastPitch = newPitch;
        preview(newPitch, d.anchor.velocity);
      }
      el.style.cursor = "grabbing";
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    drag.current = null;
    e.currentTarget.style.cursor = "crosshair";
    if (!d) return;
    if (d.kind === "resize") {
      const pat = openPattern();
      const n = pat?.notes.find((x) => x.id === d.anchor.id);
      if (n) useUi.getState().setLastNoteLength(n.duration);
    }
    if (d.kind === "move" && !d.moved && d.origin.size === 1) {
      const n = [...d.origin.values()][0];
      if (n) useUi.getState().setLastNoteLength(n.duration);
    }
    if (d.kind === "move" || d.kind === "resize" || d.kind === "erase") endGesture();
    invalidate();
  };

  // ---------------------------------------------------------------- roda

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { dx, dy } = wheelDelta(e);
      const v = useEditorView.getState();
      const { x, y } = localPoint(e, el);
      if (e.ctrlKey || e.metaKey) editorZoomAt(x, Math.exp(-dy * 0.0018));
      else if (e.altKey) {
        const pitchPos = (y + v.scrollY) / v.keyH;
        v.set({ keyH: v.keyH * Math.exp(-dy * 0.0015) });
        const nv = useEditorView.getState();
        v.set({ scrollY: pitchPos * nv.keyH - y });
      } else if (e.shiftKey) v.set({ scrollX: v.scrollX + (dy || dx) / v.pxPerTick });
      else {
        const maxY = Math.max(0, (LIMITS.pitchMax - LIMITS.pitchMin + 1) * v.keyH - el.clientHeight);
        v.set({ scrollX: v.scrollX + dx / v.pxPerTick, scrollY: Math.min(maxY, v.scrollY + dy) });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div ref={wrap} className="relative h-full w-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => {
          hover.current = null;
          invalidate();
        }}
        onContextMenu={(e) => e.preventDefault()}
        onAuxClick={(e) => e.preventDefault()}
      />
      <canvas ref={headCanvas} className="pointer-events-none absolute inset-0 block h-full w-full" />
    </div>
  );
}
