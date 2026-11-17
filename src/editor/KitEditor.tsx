/**
 * Editor de kit (T7): uma linha por som, cada linha com seu próprio
 * sintetizador (RF-50). Gestos na grade:
 *  clicar numa célula ........... liga/desliga o toque
 *  arrastar ..................... pinta (ou apaga, se começou num toque)
 *  botão direito arrastando ..... apaga
 *  Shift+clique num toque ....... soma/tira da seleção
 *  Ctrl+arrastar ................ seleção em retângulo
 *  Alt+roda sobre um toque ...... velocity ±5%
 *  roda / Shift+roda ............ rola vertical / horizontal; Ctrl+roda: zoom
 * Cabeçalho da linha:
 *  clicar no nome ... toca o som · duplo clique ... renomeia
 *  chip do som ...... troca o sintetizador da linha
 *  alça ............. arrasta para reordenar
 */
import { GripVertical, Package, Play, Plus, Trash2, Volume2, VolumeX } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { host } from "@/audio/host";
import { presetInfo } from "@/audio/registry";
import { localPoint, roundRect, useCanvas, wheelDelta } from "@/canvas/useCanvas";
import { usePlayhead } from "@/canvas/usePlayhead";
import ElasticSlider from "@/components/ElasticSlider";
import { clamp, cn, uid } from "@/lib/utils";
import { LIMIT_LABELS, LIMITS } from "@/model/limits";
import { snapDown, snapTicks } from "@/model/music";
import { type KitRow, type Note, PPQ, TICKS_PER_BAR, type Track } from "@/model/types";
import { beginGesture, endGesture, getProject, useProject } from "@/store/project";
import { toast } from "@/store/toast";
import { useTransport } from "@/store/transport";
import { useUi } from "@/store/ui";
import { alpha, C, FONT_SANS } from "@/theme";
import { InlineEdit } from "@/ui/InlineEdit";
import { EditorRuler } from "./EditorRuler";
import { EditorScrollbar } from "./EditorScrollbar";
import { VelocityLane } from "./VelocityLane";
import {
  EDITOR_RULER_H,
  editorZoomAt,
  KIT_HEADER_W,
  KIT_ROW_H,
  localPlayhead,
  openPattern,
  setOpenNotes,
  useEditorView,
  useOpenPattern,
  VELOCITY_H,
} from "./view";

type Drag =
  | { kind: "paint"; mode: "add" | "remove"; visited: Set<string> }
  | { kind: "marquee"; x0: number; y0: number; x1: number; y1: number }
  | { kind: "pan"; x0: number; y0: number; sx: number; sy: number };

function KitGrid({ track }: { track: Track }) {
  const view = useEditorView();
  const pattern = useOpenPattern();
  const selected = useUi((s) => s.selectedNoteIds);
  const snap = useUi((s) => s.editorSnap);
  const step = snapTicks(snap);
  const drag = useRef<Drag | null>(null);
  const hover = useRef<{ row: number; step: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const rows = track.kit;

  const { canvasRef, invalidate } = useCanvas((ctx, { width, height }) => {
    const { scrollX, kitScrollY, pxPerTick } = view;
    const xOf = (t: number) => (t - scrollX) * pxPerTick;
    ctx.fillStyle = C.ink950;
    ctx.fillRect(0, 0, width, height);
    if (!pattern) return;
    const len = pattern.lengthBars * TICKS_PER_BAR;
    const cellW = step * pxPerTick;
    const first = Math.max(0, Math.floor(scrollX / step));
    const last = Math.min(len / step - 1, Math.ceil((scrollX + width / pxPerTick) / step));
    const notesByCell = new Map<string, Note>();
    for (const n of pattern.notes) notesByCell.set(`${n.pitch}:${Math.floor(n.start / step)}`, n);
    const sel = new Set(selected);

    rows.forEach((row, ri) => {
      const y = ri * KIT_ROW_H - kitScrollY;
      if (y > height || y + KIT_ROW_H < 0) return;
      ctx.fillStyle = ri % 2 ? C.ink900 : C.ink950;
      ctx.fillRect(0, y, width, KIT_ROW_H);
      ctx.globalAlpha = row.muted ? 0.35 : 1;
      for (let s = first; s <= last; s++) {
        const t = s * step;
        const x = xOf(t);
        const beatIdx = Math.floor(t / PPQ);
        const pad = cellW > 14 ? 2.5 : 1;
        const n = notesByCell.get(`${row.note}:${s}`);
        roundRect(ctx, x + pad, y + 4, cellW - pad * 2, KIT_ROW_H - 8, Math.min(6, cellW / 4));
        if (n) {
          const isSel = sel.has(n.id);
          ctx.fillStyle = alpha(C.volt500, 0.35 + n.velocity * 0.65);
          if (isSel) {
            ctx.shadowColor = C.volt500;
            ctx.shadowBlur = 12;
          }
          ctx.fill();
          ctx.shadowBlur = 0;
          if (isSel) {
            ctx.strokeStyle = C.fg;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        } else {
          const hov = hover.current?.row === ri && hover.current.step === s;
          ctx.fillStyle = hov ? alpha(C.volt500, 0.18) : beatIdx % 2 ? C.ink800 : alpha(C.ink700, 0.8);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    });

    // Linhas de compasso
    for (let b = 0; b <= pattern.lengthBars; b++) {
      const x = Math.round(xOf(b * TICKS_PER_BAR));
      ctx.fillStyle = C.ink500;
      ctx.fillRect(x, 0, 1, Math.min(height, rows.length * KIT_ROW_H - kitScrollY));
    }
    const endX = xOf(len);
    ctx.fillStyle = alpha(C.ink950, 0.62);
    ctx.fillRect(endX, 0, width - endX, height);

    if (!rows.length) {
      ctx.fillStyle = C.fgFaint;
      ctx.font = `500 13px ${FONT_SANS}`;
      ctx.textAlign = "center";
      ctx.fillText("Kit vazio — adicione uma linha à esquerda", width / 2, 60);
      ctx.textAlign = "left";
    }

    const d = drag.current;
    if (d?.kind === "marquee") {
      const x = Math.min(d.x0, d.x1);
      const y = Math.min(d.y0, d.y1);
      ctx.fillStyle = alpha(C.volt500, 0.1);
      ctx.strokeStyle = alpha(C.volt400, 0.8);
      ctx.fillRect(x, y, Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0));
      ctx.strokeRect(x + 0.5, y + 0.5, Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0));
    }
  });

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

  const cellAt = (x: number, y: number): { row: KitRow; ri: number; s: number } | null => {
    const v = useEditorView.getState();
    const ri = Math.floor((y + v.kitScrollY) / KIT_ROW_H);
    const row = rows[ri];
    const pat = openPattern();
    if (!row || !pat) return null;
    const t = v.scrollX + x / v.pxPerTick;
    if (t < 0 || t >= pat.lengthBars * TICKS_PER_BAR) return null;
    return { row, ri, s: Math.floor(snapDown(t, step) / step) };
  };

  const noteIn = (row: KitRow, s: number): Note | undefined =>
    openPattern()?.notes.find((n) => n.pitch === row.note && Math.floor(n.start / step) === s);

  const paint = (x: number, y: number, mode: "add" | "remove", visited: Set<string>) => {
    const c = cellAt(x, y);
    const pat = openPattern();
    if (!c || !pat) return;
    const key = `${c.ri}:${c.s}`;
    if (visited.has(key)) return;
    visited.add(key);
    const existing = noteIn(c.row, c.s);
    if (mode === "add" && !existing) {
      if (pat.notes.length >= LIMITS.notesPerPattern) {
        toast(LIMIT_LABELS.notesPerPattern, "warn");
        return;
      }
      setOpenNotes([
        ...pat.notes,
        { id: uid("n"), pitch: c.row.note, start: c.s * step, duration: step, velocity: 0.8 },
      ]);
      if (!useTransport.getState().playing && !c.row.muted) void host.previewNote(track.id, c.row.note, 0.8);
    } else if (mode === "remove" && existing) {
      setOpenNotes(pat.notes.filter((n) => n.id !== existing.id));
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const el = e.currentTarget;
    const { x, y } = localPoint(e, el);
    useUi.getState().setZone("editor");
    if (e.button === 1) {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      const v = useEditorView.getState();
      drag.current = { kind: "pan", x0: x, y0: y, sx: v.scrollX, sy: v.kitScrollY };
      return;
    }
    if (e.button !== 0 && e.button !== 2) return;
    el.setPointerCapture(e.pointerId);
    const c = cellAt(x, y);
    if (e.button === 0 && (e.ctrlKey || e.metaKey)) {
      drag.current = { kind: "marquee", x0: x, y0: y, x1: x, y1: y };
      useUi.getState().selectNotes([]);
      return;
    }
    if (!c) return;
    const existing = noteIn(c.row, c.s);
    if (e.button === 0 && e.shiftKey && existing) {
      const sel = useUi.getState().selectedNoteIds;
      useUi
        .getState()
        .selectNotes(sel.includes(existing.id) ? sel.filter((i) => i !== existing.id) : [...sel, existing.id]);
      return;
    }
    beginGesture();
    const mode = e.button === 2 || existing ? "remove" : "add";
    const d: Drag = { kind: "paint", mode, visited: new Set() };
    drag.current = d;
    paint(x, y, mode, d.visited);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = localPoint(e, e.currentTarget);
    const d = drag.current;
    if (!d) {
      const c = cellAt(x, y);
      const next = c ? { row: c.ri, step: c.s } : null;
      if (next?.row !== hover.current?.row || next?.step !== hover.current?.step) {
        hover.current = next;
        invalidate();
      }
      return;
    }
    if (d.kind === "pan") {
      const v = useEditorView.getState();
      v.set({ scrollX: d.sx - (x - d.x0) / v.pxPerTick, kitScrollY: d.sy - (y - d.y0) });
    } else if (d.kind === "paint") paint(x, y, d.mode, d.visited);
    else if (d.kind === "marquee") {
      d.x1 = x;
      d.y1 = y;
      const v = useEditorView.getState();
      const pat = openPattern();
      if (!pat) return;
      const t0 = v.scrollX + Math.min(d.x0, x) / v.pxPerTick;
      const t1 = v.scrollX + Math.max(d.x0, x) / v.pxPerTick;
      const r0 = Math.floor((Math.min(d.y0, y) + v.kitScrollY) / KIT_ROW_H);
      const r1 = Math.floor((Math.max(d.y0, y) + v.kitScrollY) / KIT_ROW_H);
      const notesInRows = new Set(rows.slice(Math.max(0, r0), r1 + 1).map((r) => r.note));
      useUi
        .getState()
        .selectNotes(
          pat.notes
            .filter((n) => notesInRows.has(n.pitch) && n.start < t1 && n.start + n.duration > t0)
            .map((n) => n.id),
        );
      invalidate();
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.kind === "paint") endGesture();
    invalidate();
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: cellAt/noteIn leem o estado via getState
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { dx, dy } = wheelDelta(e);
      const v = useEditorView.getState();
      const { x, y } = localPoint(e, el);
      if (e.ctrlKey || e.metaKey) {
        editorZoomAt(x, Math.exp(-dy * 0.0018));
        return;
      }
      if (e.altKey) {
        const c = cellAt(x, y);
        const pat = openPattern();
        const n = c && noteIn(c.row, c.s);
        if (pat && n) {
          const d = dy < 0 ? 0.05 : -0.05;
          setOpenNotes(
            pat.notes.map((m) =>
              m.id === n.id ? { ...m, velocity: Math.round(clamp(m.velocity + d, 0.02, 1) * 100) / 100 } : m,
            ),
          );
        }
        return;
      }
      if (e.shiftKey) v.set({ scrollX: v.scrollX + (dy || dx) / v.pxPerTick });
      else {
        const maxY = Math.max(
          0,
          (getProject().tracks.find((t) => t.id === track.id)?.kit.length ?? 0) * KIT_ROW_H - el.clientHeight + 60,
        );
        v.set({ scrollX: v.scrollX + dx / v.pxPerTick, kitScrollY: Math.min(maxY, v.kitScrollY + dy) });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [track.id]);

  return (
    <div ref={wrap} className="relative h-full w-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full cursor-pointer touch-none"
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

const KitRowHeader = memo(function KitRowHeader({
  track,
  row,
  index,
  onReorderStart,
  dragging,
}: {
  track: Track;
  row: KitRow;
  index: number;
  onReorderStart: (e: React.PointerEvent, rowId: string) => void;
  dragging: boolean;
}) {
  const actions = useProject.getState();
  const preset = presetInfo(row.preset);

  const remove = async () => {
    const used = Object.values(getProject().patterns).some(
      (p) =>
        p.kind === "kit" &&
        p.notes.some((n) => n.pitch === row.note) &&
        (p.homeTrackId === track.id || getProject().clips.some((c) => c.trackId === track.id && c.patternId === p.id)),
    );
    if (used) {
      const ok = await useUi.getState().askConfirm({
        title: `Remover "${row.name}"?`,
        message: "Os toques desta linha somem de todos os patterns desta trilha.",
        confirmLabel: "Remover linha",
      });
      if (!ok) return;
    }
    actions.removeKitRow(track.id, row.id);
  };

  return (
    <div
      className={cn(
        "group/row flex items-center gap-1.5 border-b border-white/[0.03] pr-2 pl-1",
        index % 2 ? "bg-ink-900" : "bg-ink-950",
        dragging && "opacity-40",
        row.muted && "opacity-55",
      )}
      style={{ height: KIT_ROW_H }}
    >
      <button
        type="button"
        onPointerDown={(e) => onReorderStart(e, row.id)}
        className="flex w-4 shrink-0 cursor-grab justify-center text-fg-faint opacity-0 transition group-hover/row:opacity-100 active:cursor-grabbing"
        aria-label="Arrastar para reordenar"
      >
        <GripVertical className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => void host.previewNote(track.id, row.note, 0.9)}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-volt-500/10 text-volt-400 transition hover:bg-volt-500 hover:text-ink-950 active:scale-90"
        aria-label={`Tocar ${row.name}`}
        title="Tocar"
      >
        <Play className="size-3 fill-current" />
      </button>
      <div className="min-w-[64px] flex-1" onClick={() => void host.previewNote(track.id, row.note, 0.9)}>
        <InlineEdit
          value={row.name}
          onCommit={(name) => actions.updateKitRow(track.id, row.id, { name })}
          className="block cursor-pointer text-[12px] font-medium"
          inputClassName="text-[12px]"
          title="Clique para ouvir · duplo clique para renomear"
        />
      </div>
      <button
        type="button"
        onClick={() => useUi.getState().openPicker({ type: "row", trackId: track.id, rowId: row.id })}
        className="h-6 max-w-[96px] shrink truncate rounded-md bg-white/[0.05] px-1.5 text-[10px] text-fg-muted ring-1 ring-white/[0.06] transition ring-inset hover:bg-volt-500/15 hover:text-volt-300"
        title="Trocar o som desta linha"
      >
        {preset?.name ?? "—"}
      </button>
      <div className="w-11 shrink-0" onDoubleClick={() => actions.updateKitRow(track.id, row.id, { volume: 0.8 })}>
        <ElasticSlider
          value={Math.round(row.volume * 100)}
          maxValue={100}
          onChange={(v) => actions.updateKitRow(track.id, row.id, { volume: v / 100 })}
          leftIcon={null}
          rightIcon={null}
          valuePosition="none"
          thickness={3}
          activeThickness={6}
          maxStretch={10}
          wheel
          rangeColor="var(--color-volt-500)"
          trackColor="rgb(255 255 255 / 0.08)"
          ariaLabel={`Volume de ${row.name}`}
          style={{ width: "100%", "--elastic-slider-hit": "20px" } as React.CSSProperties}
        />
      </div>
      <button
        type="button"
        onClick={() => actions.updateKitRow(track.id, row.id, { muted: !row.muted })}
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition",
          row.muted ? "bg-coral-500 text-ink-950" : "text-fg-faint hover:bg-white/[0.06] hover:text-fg",
        )}
        title="Mute da linha"
        aria-pressed={row.muted}
      >
        {row.muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
      </button>
      <button
        type="button"
        onClick={() => void remove()}
        className="flex h-6 w-5 shrink-0 items-center justify-center text-fg-faint opacity-0 transition group-hover/row:opacity-100 hover:text-coral-400"
        title="Remover linha"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
});

export const KitEditor = memo(function KitEditor({ track }: { track: Track }) {
  const kitScrollY = useEditorView((s) => s.kitScrollY);
  const headers = useRef<HTMLDivElement>(null);
  const [reorder, setReorder] = useState<{ id: string; target: number } | null>(null);
  const reorderRef = useRef<{ id: string; target: number } | null>(null);

  useEffect(() => {
    const el = headers.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest("[role=slider]")) return;
      e.preventDefault();
      const v = useEditorView.getState();
      v.set({ kitScrollY: v.kitScrollY + wheelDelta(e).dy });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onReorderStart = (e: React.PointerEvent, rowId: string) => {
    e.preventDefault();
    const el = headers.current;
    if (!el) return;
    const move = (ev: PointerEvent) => {
      const { y } = localPoint(ev, el);
      const target = clamp(
        Math.round((y + useEditorView.getState().kitScrollY - KIT_ROW_H / 2) / KIT_ROW_H),
        0,
        track.kit.length - 1,
      );
      reorderRef.current = { id: rowId, target };
      setReorder(reorderRef.current);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const r = reorderRef.current;
      reorderRef.current = null;
      setReorder(null);
      if (r) useProject.getState().moveKitRow(track.id, r.id, r.target);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      className="grid min-h-0 flex-1"
      style={{
        gridTemplateColumns: `${KIT_HEADER_W}px 1fr`,
        gridTemplateRows: `${EDITOR_RULER_H}px 1fr ${VELOCITY_H}px`,
      }}
    >
      <div className="flex items-center gap-2 border-r border-b border-white/[0.06] bg-ink-900 px-2">
        <button
          type="button"
          onClick={() => useUi.getState().openKitBrowser({ mode: "replace", trackId: track.id })}
          className="flex h-6 items-center gap-1.5 rounded-lg bg-volt-500/12 px-2 text-[11px] font-semibold text-volt-300 transition hover:bg-volt-500 hover:text-ink-950"
          title="Trocar o kit inteiro: máquinas clássicas, sintetizados ou os seus"
        >
          <Package className="size-3.5" /> Kits
        </button>
        <div className="flex-1" />
        <span className="font-mono text-[10px] text-fg-faint">
          {track.kit.length}/{LIMITS.kitRows} sons
        </span>
        <button
          type="button"
          onClick={() => useProject.getState().addKitRow(track.id)}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-volt-400 transition hover:bg-volt-500/15"
        >
          <Plus className="size-3" /> Linha
        </button>
      </div>
      <div className="min-w-0 overflow-hidden">
        <EditorRuler accent={C.volt500} />
      </div>
      <div ref={headers} className="relative min-h-0 overflow-hidden border-r border-white/[0.06]">
        <div style={{ transform: `translateY(${-kitScrollY}px)` }}>
          {track.kit.map((row, i) => (
            <KitRowHeader
              key={row.id}
              track={track}
              row={row}
              index={i}
              onReorderStart={onReorderStart}
              dragging={reorder?.id === row.id}
            />
          ))}
          <button
            type="button"
            onClick={() => useProject.getState().addKitRow(track.id)}
            className="flex h-9 w-full items-center gap-2 px-3 text-xs text-fg-faint transition hover:bg-white/[0.03] hover:text-volt-400"
          >
            <Plus className="size-3.5" /> Adicionar som
          </button>
        </div>
        {reorder && (
          <div
            className="pointer-events-none absolute right-0 left-0 h-0.5 bg-volt-400 shadow-[0_0_12px_var(--color-volt-400)]"
            style={{
              top:
                reorder.target * KIT_ROW_H -
                kitScrollY +
                (reorder.target > track.kit.findIndex((r) => r.id === reorder.id) ? KIT_ROW_H : 0),
            }}
          />
        )}
      </div>
      <div className="relative min-h-0 min-w-0">
        <KitGrid track={track} />
        <EditorScrollbar tone="volt" />
      </div>
      <div className="flex items-start justify-end border-t border-r border-white/[0.06] bg-ink-900 p-2">
        <span className="font-mono text-[9px] tracking-widest text-fg-faint uppercase">velocity</span>
      </div>
      <div className="min-w-0 overflow-hidden border-t border-white/[0.06]">
        <VelocityLane accent={C.volt500} />
      </div>
    </div>
  );
});
