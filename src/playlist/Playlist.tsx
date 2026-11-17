import { Drum, Piano, Plus, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { localPoint, wheelDelta } from "@/canvas/useCanvas";
import { clamp, cn } from "@/lib/utils";
import { LIMITS } from "@/model/limits";
import { TICKS_PER_BAR } from "@/model/types";
import { songEndTicks, useProject } from "@/store/project";
import { type PlaylistSnap, useUi } from "@/store/ui";
import { HScrollbar } from "@/ui/HScrollbar";
import { Popover } from "@/ui/Popover";
import { GLASS, IconButton, LABEL } from "@/ui/primitives";
import { SnapMenu, type SnapOption } from "@/ui/SnapMenu";
import { useCompact } from "@/ui/useCompact";
import { PlaylistGrid } from "./PlaylistGrid";
import { PlaylistRuler } from "./PlaylistRuler";
import { TrackHeader } from "./TrackHeader";
import { PX_PER_TICK, usePlaylistView, zoomAt } from "./view";

const SNAP_OPTIONS: SnapOption<PlaylistSnap>[] = [
  { value: "bar", label: "Compasso", hint: "Clipes começam no início do compasso", perBar: 1 },
  { value: "beat", label: "Tempo", hint: "4 posições por compasso", perBar: 4 },
  { value: "1/8", label: "1/8", hint: "8 posições por compasso", perBar: 8 },
  { value: "1/16", label: "1/16", hint: "16 posições por compasso", perBar: 16 },
  { value: "off", label: "Livre", hint: "Sem encaixe", perBar: 0 },
];

/** Menu de nova trilha: instrumento, ou kit a partir de um kit pronto. */
function AddTrackButton() {
  const add = (kind: "instrument" | "kit", template?: string) => useProject.getState().addTrack(kind, template);
  return (
    <Popover
      width={320}
      trigger={({ toggle, ref, open }) => (
        <button
          ref={ref}
          type="button"
          onClick={toggle}
          className={cn(
            "m-2 flex h-10 w-[calc(100%-16px)] items-center justify-center gap-2 max-md:m-1 max-md:h-9 max-md:w-[calc(100%-8px)] rounded-xl border border-dashed text-xs font-medium transition",
            open
              ? "border-volt-500/60 bg-volt-500/10 text-volt-300"
              : "border-white/15 text-fg-muted hover:border-volt-500/50 hover:bg-white/[0.03] hover:text-fg",
          )}
        >
          <Plus className="size-3.5" /> <span className="max-md:hidden">Nova trilha</span>
        </button>
      )}
    >
      {(close) => (
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => {
              add("instrument");
              close();
            }}
            className="flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition hover:bg-uv-500/15"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-uv-500 text-ink-950">
              <Piano className="size-4" />
            </span>
            <span>
              <span className="block text-[13px] font-semibold">Instrumento</span>
              <span className="block text-[11px] text-fg-faint">
                Um sintetizador toca todas as notas, acordes incluídos
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              close();
              useUi.getState().openKitBrowser({ mode: "create" });
            }}
            className="flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition hover:bg-volt-500/12"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-volt-500 text-ink-950">
              <Drum className="size-4" />
            </span>
            <span>
              <span className="block text-[13px] font-semibold">Kit</span>
              <span className="block text-[11px] text-fg-faint">
                Um som por linha. Escolha entre máquinas clássicas, kits sintetizados ou os seus
              </span>
            </span>
          </button>
        </div>
      )}
    </Popover>
  );
}

const HEADER_W = 232;
const HEADER_W_MOBILE = 84;
const RULER_H = 34;

export function Playlist() {
  const tracks = useProject((s) => s.project.tracks);
  const { scrollY, rowH } = usePlaylistView();
  const snap = useUi((s) => s.playlistSnap);
  const compact = useCompact();
  const headersRef = useRef<HTMLDivElement>(null);
  const [reorder, setReorder] = useState<{ id: string; y: number; target: number } | null>(null);
  const reorderRef = useRef<{ id: string; y: number; target: number } | null>(null);

  // Roda sobre os cabeçalhos rola as trilhas; Alt+roda muda a altura.
  useEffect(() => {
    const el = headersRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest("[role=slider]")) return;
      e.preventDefault();
      const { dy } = wheelDelta(e);
      const v = usePlaylistView.getState();
      if (e.altKey) {
        v.set({ rowH: v.rowH * Math.exp(-dy * 0.0015) });
        return;
      }
      const maxY = Math.max(0, useProject.getState().project.tracks.length * v.rowH - el.clientHeight + 80);
      v.set({ scrollY: Math.min(maxY, v.scrollY + dy) });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Reordenar arrastando a alça.
  const onReorderStart = (e: React.PointerEvent, trackId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const el = headersRef.current;
    if (!el) return;
    const move = (ev: PointerEvent) => {
      const { y } = localPoint(ev, el);
      const v = usePlaylistView.getState();
      const target = Math.max(0, Math.min(tracks.length - 1, Math.round((y + v.scrollY - v.rowH / 2) / v.rowH)));
      reorderRef.current = { id: trackId, y, target };
      setReorder(reorderRef.current);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const r = reorderRef.current;
      reorderRef.current = null;
      setReorder(null);
      if (r) useProject.getState().moveTrack(r.id, r.target);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Largura da grade, para a barra de rolagem saber quanto cabe na tela.
  const gridBox = useRef<HTMLDivElement>(null);
  const [gridW, setGridW] = useState(800);
  useEffect(() => {
    const el = gridBox.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setGridW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { scrollX, pxPerTick } = usePlaylistView();
  // Só o número: assinar o projeto inteiro re-renderizava todas as trilhas a cada nota arrastada.
  const songEnd = useProject((st) => Math.max(songEndTicks(st.project), 16 * TICKS_PER_BAR));
  const fitSong = () => {
    const ppt = clamp((gridW - 30) / (songEnd + TICKS_PER_BAR), PX_PER_TICK.min, PX_PER_TICK.max);
    usePlaylistView.getState().set({ pxPerTick: ppt, scrollX: -TICKS_PER_BAR * 0.15 });
  };

  return (
    <section className={cn(GLASS, "flex h-full min-h-0 flex-col overflow-hidden")}>
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-white/[0.06] px-3">
        <span className={LABEL}>Playlist</span>
        <div className="flex-1" />
        <SnapMenu value={snap} options={SNAP_OPTIONS} onChange={(v) => useUi.getState().setPlaylistSnap(v)} />
        <div className="mx-1 h-5 w-px bg-white/[0.07]" />
        <IconButton label="Afastar (Ctrl+roda)" size="sm" onClick={() => zoomAt(200, 1 / 1.3)}>
          <ZoomOut />
        </IconButton>
        <IconButton label="Aproximar (Ctrl+roda)" size="sm" onClick={() => zoomAt(200, 1.3)}>
          <ZoomIn />
        </IconButton>
      </div>

      <div
        className="grid min-h-0 flex-1"
        style={{
          gridTemplateColumns: `${compact ? HEADER_W_MOBILE : HEADER_W}px 1fr`,
          gridTemplateRows: `${RULER_H}px 1fr`,
        }}
      >
        <div className="flex items-center justify-between border-r border-b border-white/[0.06] bg-ink-900 px-3 max-md:justify-center max-md:px-1">
          <span className={cn(LABEL, "max-md:hidden")}>Trilhas</span>
          <span className="font-mono text-[10px] text-fg-faint">
            {tracks.length}/{LIMITS.tracks}
          </span>
        </div>
        <div className="min-w-0 overflow-hidden">
          <PlaylistRuler />
        </div>

        <div ref={headersRef} className="relative min-h-0 overflow-hidden border-r border-white/[0.06] bg-ink-900/80">
          <div style={{ transform: `translateY(${-scrollY}px)` }}>
            {tracks.map((t, i) => (
              <div
                key={t.id}
                className={cn("transition-opacity", reorder?.id === t.id && "opacity-40")}
                style={{ height: rowH }}
              >
                <TrackHeader track={t} index={i} height={rowH} onReorderStart={onReorderStart} />
              </div>
            ))}
            {tracks.length < LIMITS.tracks && <AddTrackButton />}
          </div>
          {reorder && (
            <div
              className="pointer-events-none absolute right-0 left-0 h-0.5 bg-uv-400 shadow-[0_0_12px_var(--color-uv-400)]"
              style={{
                top:
                  reorder.target * rowH -
                  scrollY +
                  (reorder.target > tracks.findIndex((t) => t.id === reorder.id) ? rowH : 0),
              }}
            />
          )}
        </div>
        <div ref={gridBox} className="relative min-h-0 min-w-0">
          <PlaylistGrid />
          <div className="pointer-events-none absolute right-3 bottom-2.5 left-3">
            <HScrollbar
              className="pointer-events-auto"
              start={scrollX}
              visible={gridW / pxPerTick}
              total={songEnd + 4 * TICKS_PER_BAR}
              onScroll={(x) => usePlaylistView.getState().set({ scrollX: x })}
              onRange={(x, vis) =>
                usePlaylistView.getState().set({
                  pxPerTick: clamp(gridW / vis, PX_PER_TICK.min, PX_PER_TICK.max),
                  scrollX: x,
                })
              }
              onFit={fitSong}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
