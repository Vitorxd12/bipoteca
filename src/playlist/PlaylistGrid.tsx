/**
 * Grade da playlist (canvas). Gestos:
 *  clique no clipe ............ seleciona (Shift/Ctrl soma)
 *  arrastar clipe ............. move no tempo e entre trilhas do mesmo tipo
 *  Ctrl+arrastar clipe ........ copia
 *  Alt durante o arraste ...... sem encaixe (1/16)
 *  arrastar no vazio .......... seleção em retângulo (Shift soma)
 *  duplo clique no vazio ...... cria pattern e abre o editor
 *  duplo clique no clipe ...... abre no editor
 *  botão direito .............. menu do clipe / da trilha
 *  botão do meio arrastando ... navega
 *  roda / Shift+roda .......... rola vertical / horizontal
 *  Ctrl+roda .................. zoom horizontal no mouse
 *  Alt+roda ................... altura das trilhas
 *  soltar pattern da biblioteca posiciona (só em trilha do mesmo tipo)
 */
import { Copy, Fingerprint, FolderOpen, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { host } from "@/audio/host";
import { localPoint, roundRect, useCanvas, wheelDelta } from "@/canvas/useCanvas";
import { usePlayhead } from "@/canvas/usePlayhead";
import { snapDown, snapRound } from "@/model/music";
import { type Clip, type Pattern, PPQ, TICKS_PER_BAR } from "@/model/types";
import { beginGesture, endGesture, getProject, useProject } from "@/store/project";
import { useTransport } from "@/store/transport";
import { playlistSnapTicks, useUi } from "@/store/ui";
import { alpha, C, FONT_SANS, kindColor } from "@/theme";
import { showMenu } from "@/ui/overlays";
import { libraryDrag, usePlaylistView, zoomAt } from "./view";

type Drag =
  | { kind: "press"; clipId: string; x0: number; y0: number; toggled: boolean }
  | {
      kind: "move";
      x0: number;
      y0: number;
      anchor: Clip;
      origin: Map<string, { start: number; trackIndex: number }>;
      copy: boolean;
      dRow: number;
    }
  | {
      kind: "marquee";
      x0: number;
      y0: number;
      x1: number;
      y1: number;
      base: string[];
    }
  | { kind: "pan"; x0: number; y0: number; sx: number; sy: number };

interface DropHover {
  trackIndex: number;
  tick: number;
  ok: boolean;
  pattern: Pattern;
}

export function PlaylistGrid() {
  const view = usePlaylistView();
  const project = useProject((s) => s.project);
  const selected = useUi((s) => s.selectedClipIds);
  const openPatternId = useUi((s) => s.openPatternId);
  const snap = useUi((s) => s.playlistSnap);
  const drag = useRef<Drag | null>(null);
  const drop = useRef<DropHover | null>(null);
  const copyGhost = useRef<Clip[]>([]);
  const wrap = useRef<HTMLDivElement>(null);

  const step = playlistSnapTicks(snap);

  // ------------------------------------------------------------- desenho

  const { canvasRef, invalidate } = useCanvas((ctx, { width, height }) => {
    const { scrollX, scrollY, pxPerTick, rowH } = view;
    const xOf = (t: number) => (t - scrollX) * pxPerTick;
    const tracks = project.tracks;

    ctx.fillStyle = C.ink950;
    ctx.fillRect(0, 0, width, height);

    // Linhas das trilhas
    for (let i = 0; i < tracks.length; i++) {
      const y = i * rowH - scrollY;
      if (y > height || y + rowH < 0) continue;
      const tr = tracks[i];
      if (!tr) continue;
      ctx.fillStyle = i % 2 ? C.ink900 : alpha(C.ink850, 0.9);
      ctx.fillRect(0, y, width, rowH);
      const d = drop.current;
      if (d) {
        const ok = tr.kind === d.pattern.kind;
        ctx.fillStyle = ok ? alpha(kindColor(tr.kind).base, 0.06) : alpha(C.coral500, 0.05);
        ctx.fillRect(0, y, width, rowH);
        if (!ok) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, y, width, rowH);
          ctx.clip();
          ctx.strokeStyle = alpha(C.coral500, 0.12);
          ctx.lineWidth = 6;
          for (let sx = -rowH; sx < width; sx += 22) {
            ctx.beginPath();
            ctx.moveTo(sx, y + rowH);
            ctx.lineTo(sx + rowH, y);
            ctx.stroke();
          }
          ctx.restore();
        }
      }
      ctx.fillStyle = C.ink800;
      ctx.fillRect(0, y + rowH - 1, width, 1);
    }

    // Grade de tempo
    const barPx = TICKS_PER_BAR * pxPerTick;
    const firstBar = Math.max(0, Math.floor(scrollX / TICKS_PER_BAR));
    const lastBar = Math.ceil((scrollX + width / pxPerTick) / TICKS_PER_BAR);
    const gridBottom = Math.min(height, tracks.length * rowH - scrollY);
    for (let b = firstBar; b <= lastBar; b++) {
      const x = Math.round(xOf(b * TICKS_PER_BAR)) + 0.5;
      ctx.fillStyle = b % 4 === 0 ? C.ink600 : C.ink700;
      if (barPx < 14 && b % 4 !== 0) continue;
      ctx.fillRect(x - 0.5, 0, 1, gridBottom);
      if (barPx > 60) {
        ctx.fillStyle = alpha(C.ink700, 0.55);
        for (let q = 1; q < 4; q++) ctx.fillRect(Math.round(xOf(b * TICKS_PER_BAR + q * PPQ)), 0, 1, gridBottom);
      }
    }

    // Loop (sombras fora da região)
    const loop = project.loop;
    if (loop.enabled) {
      ctx.fillStyle = alpha(C.ink950, 0.35);
      const lx0 = xOf(loop.start);
      const lx1 = xOf(loop.end);
      if (lx0 > 0) ctx.fillRect(0, 0, lx0, gridBottom);
      if (lx1 < width) ctx.fillRect(lx1, 0, width - lx1, gridBottom);
    }

    // Clipes
    const d = drag.current;
    const moving = d?.kind === "move" ? d : null;
    const usage = new Map<string, number>();
    for (const c of project.clips) usage.set(c.patternId, (usage.get(c.patternId) ?? 0) + 1);
    const trackIndex = new Map(tracks.map((t, i) => [t.id, i]));
    const sel = new Set(selected);

    const drawClip = (c: Clip, ghost: boolean) => {
      const pat = project.patterns[c.patternId];
      const ti = trackIndex.get(c.trackId);
      if (!pat || ti === undefined) return;
      const tr = tracks[ti];
      if (!tr) return;
      const x = xOf(c.start);
      const w = pat.lengthBars * TICKS_PER_BAR * pxPerTick;
      const y = ti * rowH - scrollY + 3;
      const h = rowH - 7;
      if (x > width || x + w < 0 || y > height || y + h < 0) return;
      const col = kindColor(tr.kind);
      const isSel = sel.has(c.id) && !ghost;
      const isOpen = c.patternId === openPatternId;
      const band = Math.min(18, h * 0.32);

      ctx.save();
      ctx.globalAlpha = ghost ? 0.55 : 1;
      if (isSel) {
        ctx.shadowColor = alpha(col.base, 0.7);
        ctx.shadowBlur = 16;
      }
      roundRect(ctx, x + 1, y, w - 2, h, 7);
      ctx.fillStyle = alpha(col.base, isSel ? 0.26 : 0.15);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.save();
      ctx.clip();
      ctx.fillStyle = alpha(col.base, isSel ? 0.95 : 0.7);
      ctx.fillRect(x, y, w, band);

      // Miniatura das notas
      if (pat.notes.length) {
        let lo = 127;
        let hi = 0;
        for (const n of pat.notes) {
          lo = Math.min(lo, n.pitch);
          hi = Math.max(hi, n.pitch);
        }
        const span = Math.max(6, hi - lo + 1);
        const top = y + band + 4;
        const area = h - band - 8;
        const nh = Math.max(1.5, Math.min(5, area / span));
        const len = pat.lengthBars * TICKS_PER_BAR;
        ctx.fillStyle = alpha(col.bright, 0.85);
        for (const n of pat.notes) {
          if (n.start >= len) continue;
          const nx = x + n.start * pxPerTick;
          const nw = Math.max(1.5, Math.min(n.duration, len - n.start) * pxPerTick - 1);
          const ny = top + (1 - (n.pitch - lo + 0.5) / span) * (area - nh);
          ctx.fillRect(nx, ny, nw, nh);
        }
      }

      // Nome
      if (w > 28) {
        ctx.font = `600 11px ${FONT_SANS}`;
        ctx.textBaseline = "middle";
        ctx.fillStyle = tr.kind === "kit" ? C.ink950 : C.fg;
        const uses = usage.get(pat.id) ?? 1;
        const label = uses > 1 && w > 90 ? `${pat.name}  ·  ×${uses}` : pat.name;
        ctx.fillText(label, x + 7, y + band / 2 + 0.5, w - 12);
      }
      ctx.restore();

      roundRect(ctx, x + 1.5, y + 0.5, w - 3, h - 1, 7);
      ctx.lineWidth = isSel ? 2 : 1;
      ctx.strokeStyle = isSel ? C.fg : isOpen ? alpha(col.bright, 0.9) : alpha(col.base, 0.55);
      ctx.stroke();
      ctx.restore();
    };

    for (const c of project.clips) {
      if (moving && !moving.copy && moving.origin.has(c.id)) continue;
      drawClip(c, false);
    }
    if (moving) {
      if (moving.copy) for (const g of copyGhost.current) drawClip(g, true);
      else for (const c of project.clips) if (moving.origin.has(c.id)) drawClip(c, false);
    }

    // Pattern sendo arrastado da biblioteca
    const dh = drop.current;
    if (dh && dh.trackIndex >= 0 && dh.trackIndex < tracks.length) {
      const col = dh.ok ? kindColor(dh.pattern.kind).base : C.coral500;
      const x = xOf(dh.tick);
      const w = dh.pattern.lengthBars * TICKS_PER_BAR * pxPerTick;
      const y = dh.trackIndex * rowH - scrollY + 3;
      roundRect(ctx, x + 1, y, w - 2, rowH - 7, 7);
      ctx.fillStyle = alpha(col, 0.22);
      ctx.fill();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Retângulo de seleção
    if (d?.kind === "marquee") {
      const x = Math.min(d.x0, d.x1);
      const y = Math.min(d.y0, d.y1);
      ctx.fillStyle = alpha(C.uv500, 0.12);
      ctx.strokeStyle = alpha(C.uv400, 0.8);
      ctx.lineWidth = 1;
      ctx.fillRect(x, y, Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0));
      ctx.strokeRect(x + 0.5, y + 0.5, Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0));
    }

    // Área sem trilhas
    if (!tracks.length) {
      ctx.fillStyle = C.fgFaint;
      ctx.font = `500 13px ${FONT_SANS}`;
      ctx.textAlign = "center";
      ctx.fillText("Crie uma trilha para começar  ·  clique direito aqui", width / 2, height / 2);
      ctx.textAlign = "left";
    }
  });

  // Cursor de reprodução em canvas próprio: só ele redesenha a cada quadro.
  const headCanvas = useRef<HTMLCanvasElement | null>(null);
  const drawHead = useCallback((tick: number, playing: boolean) => {
    const cv = headCanvas.current;
    if (!cv) return;
    const v = usePlaylistView.getState();
    const rect = cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(rect.width * dpr) || cv.height !== Math.round(rect.height * dpr)) {
      cv.width = Math.round(rect.width * dpr);
      cv.height = Math.round(rect.height * dpr);
    }
    let x = (tick - v.scrollX) * v.pxPerTick;
    // Página acompanha o cursor durante a reprodução.
    if (playing && !drag.current && (x > rect.width * 0.92 || x < 0)) {
      v.set({ scrollX: tick - (rect.width * 0.08) / v.pxPerTick });
      x = rect.width * 0.08;
    }
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = alpha(C.volt500, 0.18);
    ctx.fillRect(x - 4, 0, 8, rect.height);
    ctx.fillStyle = C.volt500;
    ctx.fillRect(x - 0.75, 0, 1.5, rect.height);
  }, []);
  usePlayhead(drawHead);
  // Redesenha o cursor parado quando a câmera muda.
  // biome-ignore lint/correctness/useExhaustiveDependencies: depende da câmera de propósito
  useEffect(() => {
    if (!host.isPlaying()) drawHead(useTransport.getState().cursor, false);
  }, [view.scrollX, view.pxPerTick, drawHead]);
  useEffect(() => {
    const cv = headCanvas.current;
    if (!cv) return;
    const ro = new ResizeObserver(() => drawHead(host.position(), host.isPlaying()));
    ro.observe(cv);
    return () => ro.disconnect();
  }, [drawHead]);

  // ---------------------------------------------------------- hit-testing

  const hitClip = (x: number, y: number): Clip | null => {
    const v = usePlaylistView.getState();
    const p = getProject();
    const ti = Math.floor((y + v.scrollY) / v.rowH);
    const tr = p.tracks[ti];
    if (!tr) return null;
    const t = v.scrollX + x / v.pxPerTick;
    for (let i = p.clips.length - 1; i >= 0; i--) {
      const c = p.clips[i];
      if (!c || c.trackId !== tr.id) continue;
      const pat = p.patterns[c.patternId];
      if (pat && t >= c.start && t < c.start + pat.lengthBars * TICKS_PER_BAR) return c;
    }
    return null;
  };

  const trackAt = (y: number) => {
    const v = usePlaylistView.getState();
    return Math.floor((y + v.scrollY) / v.rowH);
  };
  const tickAt = (x: number) => {
    const v = usePlaylistView.getState();
    return v.scrollX + x / v.pxPerTick;
  };

  // -------------------------------------------------------------- ponteiro

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const el = e.currentTarget;
    const { x, y } = localPoint(e, el);
    const uiState = useUi.getState();
    uiState.setZone("playlist");
    if (e.button === 1) {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      const v = usePlaylistView.getState();
      drag.current = {
        kind: "pan",
        x0: x,
        y0: y,
        sx: v.scrollX,
        sy: v.scrollY,
      };
      el.style.cursor = "grabbing";
      return;
    }
    if (e.button !== 0) return;
    el.setPointerCapture(e.pointerId);
    const clip = hitClip(x, y);
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    if (clip) {
      const isSel = uiState.selectedClipIds.includes(clip.id);
      let toggled = false;
      if (e.shiftKey && isSel) {
        uiState.selectClips(uiState.selectedClipIds.filter((id) => id !== clip.id));
        toggled = true;
      } else if (!isSel) {
        uiState.selectClips(additive ? [...uiState.selectedClipIds, clip.id] : [clip.id]);
      }
      drag.current = { kind: "press", clipId: clip.id, x0: x, y0: y, toggled };
      return;
    }
    drag.current = {
      kind: "marquee",
      x0: x,
      y0: y,
      x1: x,
      y1: y,
      base: additive ? uiState.selectedClipIds : [],
    };
    if (!additive) uiState.selectClips([]);
  };

  const startMove = (d: Extract<Drag, { kind: "press" }>, copy: boolean): Drag | null => {
    const p = getProject();
    const anchor = p.clips.find((c) => c.id === d.clipId);
    if (!anchor) return null;
    const ids = useUi.getState().selectedClipIds;
    const origin = new Map<string, { start: number; trackIndex: number }>();
    for (const c of p.clips) {
      if (ids.includes(c.id))
        origin.set(c.id, {
          start: c.start,
          trackIndex: p.tracks.findIndex((t) => t.id === c.trackId),
        });
    }
    if (!copy) beginGesture();
    return {
      kind: "move",
      x0: d.x0,
      y0: d.y0,
      anchor: { ...anchor },
      origin,
      copy,
      dRow: 0,
    };
  };

  const applyMove = (d: Extract<Drag, { kind: "move" }>, x: number, y: number, alt: boolean) => {
    const v = usePlaylistView.getState();
    const p = getProject();
    const s = alt ? PPQ / 4 : step;
    let dTick = snapRound(d.anchor.start + (x - d.x0) / v.pxPerTick, s) - d.anchor.start;
    const minStart = Math.min(...[...d.origin.values()].map((o) => o.start));
    if (minStart + dTick < 0) dTick = -minStart;
    const wantRow = Math.round((y - d.y0) / v.rowH);
    // Só aceita o deslocamento vertical se todos caírem em trilhas do mesmo tipo.
    const valid = (dRow: number) =>
      [...d.origin.entries()].every(([id, o]) => {
        const clip = p.clips.find((c) => c.id === id) ?? copyGhost.current.find((c) => c.id === id);
        const pat = clip && p.patterns[clip.patternId];
        const target = p.tracks[o.trackIndex + dRow];
        return pat && target && target.kind === pat.kind;
      });
    if (valid(wantRow)) d.dRow = wantRow;
    const moves = [...d.origin.entries()].map(([id, o]) => ({
      id,
      start: o.start + dTick,
      trackId: p.tracks[o.trackIndex + d.dRow]?.id ?? "",
    }));
    if (d.copy) {
      copyGhost.current = moves.map((m) => {
        const src = p.clips.find((c) => c.id === m.id);
        return {
          id: `ghost-${m.id}`,
          patternId: src?.patternId ?? "",
          trackId: m.trackId,
          start: m.start,
        };
      });
      invalidate();
    } else {
      useProject.getState().moveClips(moves);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const el = e.currentTarget;
    const { x, y } = localPoint(e, el);
    const d = drag.current;
    if (!d) {
      el.style.cursor = hitClip(x, y) ? "grab" : "default";
      return;
    }
    if (d.kind === "pan") {
      const v = usePlaylistView.getState();
      v.set({
        scrollX: d.sx - (x - d.x0) / v.pxPerTick,
        scrollY: d.sy - (y - d.y0),
      });
      return;
    }
    if (d.kind === "press") {
      if (Math.hypot(x - d.x0, y - d.y0) < 4 || d.toggled) return;
      const next = startMove(d, e.ctrlKey || e.metaKey);
      drag.current = next;
      el.style.cursor = e.ctrlKey || e.metaKey ? "copy" : "grabbing";
      if (next?.kind === "move") applyMove(next, x, y, e.altKey);
      return;
    }
    if (d.kind === "move") {
      applyMove(d, x, y, e.altKey);
      return;
    }
    if (d.kind === "marquee") {
      d.x1 = x;
      d.y1 = y;
      const v = usePlaylistView.getState();
      const p = getProject();
      const t0 = tickAt(Math.min(d.x0, x));
      const t1 = tickAt(Math.max(d.x0, x));
      const r0 = Math.floor((Math.min(d.y0, y) + v.scrollY) / v.rowH);
      const r1 = Math.floor((Math.max(d.y0, y) + v.scrollY) / v.rowH);
      const hits = p.clips
        .filter((c) => {
          const ti = p.tracks.findIndex((t) => t.id === c.trackId);
          const pat = p.patterns[c.patternId];
          if (!pat || ti < r0 || ti > r1) return false;
          return c.start < t1 && c.start + pat.lengthBars * TICKS_PER_BAR > t0;
        })
        .map((c) => c.id);
      useUi.getState().selectClips([...new Set([...d.base, ...hits])]);
      invalidate();
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    drag.current = null;
    e.currentTarget.style.cursor = "default";
    if (!d) return;
    if (d.kind === "press" && !d.toggled && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      useUi.getState().selectClips([d.clipId]);
    }
    if (d.kind === "move") {
      if (d.copy) {
        const ids = useProject.getState().addClips(
          copyGhost.current.map((g) => ({
            patternId: g.patternId,
            trackId: g.trackId,
            start: g.start,
          })),
        );
        copyGhost.current = [];
        if (ids.length) useUi.getState().selectClips(ids);
      } else endGesture();
    }
    invalidate();
  };

  const onDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = localPoint(e, e.currentTarget);
    const clip = hitClip(x, y);
    const ui = useUi.getState();
    if (clip) {
      ui.openPattern(clip.patternId, clip.trackId);
      return;
    }
    const tr = getProject().tracks[trackAt(y)];
    if (!tr) return;
    const start = Math.max(0, snapDown(tickAt(x), step));
    const pid = useProject.getState().createPatternAt(tr.id, start);
    if (pid) ui.openPattern(pid, tr.id);
  };

  const onContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const { x, y } = localPoint(e, e.currentTarget);
    const clip = hitClip(x, y);
    const ui = useUi.getState();
    const actions = useProject.getState();
    if (clip) {
      if (!ui.selectedClipIds.includes(clip.id)) ui.selectClips([clip.id]);
      const ids = useUi.getState().selectedClipIds;
      showMenu(e, [
        {
          label: "Abrir no editor",
          icon: <FolderOpen />,
          hint: "2× clique",
          onSelect: () => ui.openPattern(clip.patternId, clip.trackId),
        },
        {
          label: "Duplicar",
          icon: <Copy />,
          hint: "Ctrl+D",
          onSelect: () => ui.selectClips(actions.duplicateClips(ids)),
        },
        {
          label: "Tornar único",
          icon: <Fingerprint />,
          disabled: getProject().clips.filter((c) => c.patternId === clip.patternId).length < 2,
          onSelect: () => {
            const pid = actions.makeClipUnique(clip.id);
            if (pid && ui.openPatternId === clip.patternId) ui.openPattern(pid, clip.trackId);
          },
        },
        "sep",
        {
          label: ids.length > 1 ? `Apagar ${ids.length} clipes` : "Apagar",
          icon: <Trash2 />,
          hint: "Del",
          danger: true,
          onSelect: () => {
            actions.removeClips(ids);
            ui.selectClips([]);
          },
        },
      ]);
      return;
    }
    const tr = getProject().tracks[trackAt(y)];
    const start = Math.max(0, snapDown(tickAt(x), step));
    showMenu(e, [
      ...(tr
        ? [
            {
              label: "Novo pattern aqui",
              icon: <Plus />,
              hint: "2× clique",
              onSelect: () => {
                const pid = actions.createPatternAt(tr.id, start);
                if (pid) ui.openPattern(pid, tr.id);
              },
            },
            "sep" as const,
          ]
        : []),
      {
        label: "Nova trilha de instrumento",
        icon: <Plus />,
        onSelect: () => actions.addTrack("instrument"),
      },
      {
        label: "Nova trilha de kit (bateria)",
        icon: <Plus />,
        onSelect: () => actions.addTrack("kit", "drums"),
      },
      {
        label: "Nova trilha de kit (vazio)",
        icon: <Plus />,
        onSelect: () => actions.addTrack("kit", "empty"),
      },
    ]);
  };

  // ----------------------------------------------------- arrastar e soltar

  const dropTarget = (e: React.DragEvent): DropHover | null => {
    const pid = libraryDrag.patternId;
    const pat = pid ? getProject().patterns[pid] : undefined;
    if (!pat || !canvasRef.current) return null;
    const { x, y } = localPoint(e, canvasRef.current);
    const ti = trackAt(y);
    const tr = getProject().tracks[ti];
    return {
      trackIndex: ti,
      tick: Math.max(0, snapDown(tickAt(x), step)),
      ok: !!tr && tr.kind === pat.kind,
      pattern: pat,
    };
  };

  const onDragOver = (e: React.DragEvent) => {
    const t = dropTarget(e);
    if (!t) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = t.ok ? "copy" : "none";
    drop.current = t;
    invalidate();
  };
  const onDragLeave = () => {
    drop.current = null;
    invalidate();
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const t = dropTarget(e);
    drop.current = null;
    libraryDrag.patternId = null;
    invalidate();
    const tr = t && getProject().tracks[t.trackIndex];
    if (!t || !tr) return;
    const id = useProject.getState().addClip(t.pattern.id, tr.id, t.tick);
    if (id) useUi.getState().selectClips([id]);
  };

  // ---------------------------------------------------------------- roda

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { dx, dy } = wheelDelta(e);
      const v = usePlaylistView.getState();
      const { x, y } = localPoint(e, el);
      if (e.ctrlKey || e.metaKey) {
        zoomAt(x, Math.exp(-dy * 0.0018));
      } else if (e.altKey) {
        const trackY = (y + v.scrollY) / v.rowH;
        const rowH = v.rowH * Math.exp(-dy * 0.0015);
        v.set({ rowH });
        const nv = usePlaylistView.getState();
        v.set({ scrollY: trackY * nv.rowH - y });
      } else if (e.shiftKey) {
        v.set({ scrollX: v.scrollX + (dy || dx) / v.pxPerTick });
      } else {
        const maxY = Math.max(0, getProject().tracks.length * v.rowH - el.clientHeight + 80);
        v.set({
          scrollX: v.scrollX + dx / v.pxPerTick,
          scrollY: Math.min(maxY, v.scrollY + dy),
        });
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
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onAuxClick={(e) => e.preventDefault()}
      />
      <canvas ref={headCanvas} className="pointer-events-none absolute inset-0 block h-full w-full" />
    </div>
  );
}
