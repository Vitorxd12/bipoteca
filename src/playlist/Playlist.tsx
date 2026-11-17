import { Drum, Magnet, Piano, Plus, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { localPoint, wheelDelta } from "@/canvas/useCanvas";
import StarBorder from "@/components/StarBorder";
import { cn } from "@/lib/utils";
import { LIMITS } from "@/model/limits";
import { useProject } from "@/store/project";
import { useUi } from "@/store/ui";
import { showMenu } from "@/ui/overlays";
import { GLASS, IconButton, LABEL, Segmented } from "@/ui/primitives";
import { PlaylistGrid } from "./PlaylistGrid";
import { PlaylistRuler } from "./PlaylistRuler";
import { TrackHeader } from "./TrackHeader";
import { usePlaylistView, zoomAt } from "./view";

const HEADER_W = 232;
const RULER_H = 34;

export function Playlist() {
  const tracks = useProject((s) => s.project.tracks);
  const { scrollY, rowH } = usePlaylistView();
  const snap = useUi((s) => s.playlistSnap);
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

  const addMenu = (e: React.MouseEvent) => {
    const add = useProject.getState().addTrack;
    showMenu(e, [
      { label: "Trilha de instrumento", icon: <Piano />, hint: "1 som, acordes", onSelect: () => add("instrument") },
      {
        label: "Trilha de kit · bateria básica",
        icon: <Drum />,
        hint: "1 som por linha",
        onSelect: () => add("kit", "drums"),
      },
      { label: "Trilha de kit · vazio", icon: <Drum />, onSelect: () => add("kit", "empty") },
    ]);
  };

  return (
    <section className={cn(GLASS, "flex h-full min-h-0 flex-col overflow-hidden")}>
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-white/[0.06] px-3">
        <span className={LABEL}>Playlist</span>
        <span className="font-mono text-[10px] text-fg-faint">
          {tracks.length}/{LIMITS.tracks} trilhas
        </span>
        <div className="flex-1" />
        <Magnet className="size-3.5 text-fg-faint" />
        <Segmented
          value={snap}
          onChange={(s) => useUi.getState().setPlaylistSnap(s)}
          options={[
            { value: "bar", label: "Compasso", title: "Encaixe por compasso (Alt durante o arraste: livre)" },
            { value: "beat", label: "Tempo", title: "Encaixe por tempo (Alt durante o arraste: livre)" },
          ]}
        />
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
        style={{ gridTemplateColumns: `${HEADER_W}px 1fr`, gridTemplateRows: `${RULER_H}px 1fr` }}
      >
        <div className="flex items-center border-r border-b border-white/[0.06] bg-ink-900 px-2">
          <StarBorder
            as="button"
            onClick={addMenu}
            color="var(--color-volt-500)"
            trailColor="var(--color-uv-500)"
            radius={10}
            thickness={1}
            duration={5}
            className="h-6 w-full"
            backgroundColor="rgb(14 12 22)"
            textColor="var(--color-fg)"
          >
            <span className="flex items-center justify-center gap-1 text-[11px] font-semibold">
              <Plus className="size-3" /> Trilha
            </span>
          </StarBorder>
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
            {tracks.length < LIMITS.tracks && (
              <button
                type="button"
                onClick={addMenu}
                className="flex h-12 w-full items-center gap-2 px-4 text-xs text-fg-faint transition hover:bg-white/[0.03] hover:text-fg"
              >
                <Plus className="size-3.5" /> Nova trilha
              </button>
            )}
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
        <div className="min-h-0 min-w-0">
          <PlaylistGrid />
        </div>
      </div>
    </section>
  );
}
