/**
 * Cabeçalho de trilha. Gestos:
 *  arrastar a alça ......... reordena
 *  duplo clique no nome .... renomeia
 *  chip do som ............. abre o seletor de instrumento (RF-17)
 *  M / S ................... mute / solo (Ctrl+clique no S: solo exclusivo)
 *  volume .................. arrastar, roda do mouse; duplo clique volta a 80%
 *  botão direito ........... menu da trilha
 */
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Drum,
  GripVertical,
  Headphones,
  MoreHorizontal,
  Pencil,
  Piano,
  Trash2,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { memo, useEffect, useState } from "react";
import { presetInfo } from "@/audio/registry";
import ElasticSlider from "@/components/ElasticSlider";
import { cn } from "@/lib/utils";
import type { Track } from "@/model/types";
import { getProject, useProject } from "@/store/project";
import { useTransport } from "@/store/transport";
import { useUi } from "@/store/ui";
import { InlineEdit } from "@/ui/InlineEdit";
import { showMenu } from "@/ui/overlays";
import { useCompact } from "@/ui/useCompact";

export const TrackHeader = memo(function TrackHeader({
  track,
  index,
  height,
  onReorderStart,
}: {
  track: Track;
  index: number;
  height: number;
  onReorderStart: (e: React.PointerEvent, trackId: string) => void;
}) {
  const actions = useProject.getState();
  const drop = useTransport((s) => s.voiceDrops[track.id]);
  const anySolo = useProject((s) => s.project.tracks.some((t) => t.solo));
  const isOpen = useUi((s) => s.editorTrackId === track.id && s.editorMode !== "closed");
  const [renaming, setRenaming] = useState(false);
  const kit = track.kind === "kit";
  const preset = presetInfo(track.preset);
  const narrow = useCompact();
  const compact = height < 60 || narrow;
  const silenced = anySolo ? !track.solo : track.muted;

  // Aviso de polifonia acende e apaga sozinho (RF-69).
  const [warnVisible, setWarnVisible] = useState(false);
  useEffect(() => {
    if (!drop) return;
    setWarnVisible(true);
    const id = setTimeout(() => setWarnVisible(false), 2500);
    return () => clearTimeout(id);
  }, [drop]);

  const remove = async () => {
    const p = getProject();
    const clips = p.clips.filter((c) => c.trackId === track.id).length;
    if (clips > 0) {
      const ok = await useUi.getState().askConfirm({
        title: `Remover "${track.name}"?`,
        message: `A trilha tem ${clips} clipe${clips > 1 ? "s" : ""}. Eles somem junto; patterns sem outros clipes também.`,
        confirmLabel: "Remover trilha",
      });
      if (!ok) return;
    }
    actions.removeTrack(track.id);
  };

  const menu = (e: React.MouseEvent) => {
    e.preventDefault();
    const n = getProject().tracks.length;
    showMenu(e, [
      {
        label: kit ? "Abrir editor de kit" : "Trocar instrumento",
        icon: kit ? <Drum /> : <Piano />,
        onSelect: () => openSound(),
      },
      {
        label: track.muted ? "Tirar o mute" : "Mute (silenciar)",
        icon: track.muted ? <Volume2 /> : <VolumeX />,
        onSelect: () => actions.updateTrack(track.id, { muted: !track.muted }),
      },
      {
        label: track.solo ? "Tirar o solo" : "Solo (só esta trilha)",
        icon: <Headphones />,
        onSelect: () => actions.updateTrack(track.id, { solo: !track.solo }),
      },
      "sep",
      { label: "Renomear", icon: <Pencil />, hint: "2× clique", onSelect: () => setRenaming(true) },
      { label: "Volume 100%", icon: <Volume2 />, onSelect: () => actions.updateTrack(track.id, { volume: 1 }) },
      { label: "Volume 80%", icon: <Volume2 />, onSelect: () => actions.updateTrack(track.id, { volume: 0.8 }) },
      { label: "Volume 50%", icon: <Volume1 />, onSelect: () => actions.updateTrack(track.id, { volume: 0.5 }) },
      {
        label: "Mover para cima",
        icon: <ArrowUp />,
        disabled: index === 0,
        onSelect: () => actions.moveTrack(track.id, index - 1),
      },
      {
        label: "Mover para baixo",
        icon: <ArrowDown />,
        disabled: index === n - 1,
        onSelect: () => actions.moveTrack(track.id, index + 1),
      },
      ...(kit
        ? [
            "sep" as const,
            {
              label: "Trocar kit…",
              icon: <Drum />,
              onSelect: () => useUi.getState().openKitBrowser({ mode: "replace", trackId: track.id }),
            },
          ]
        : []),
      "sep",
      { label: "Remover trilha", icon: <Trash2 />, danger: true, onSelect: () => void remove() },
    ]);
  };

  const openSound = () => {
    if (!kit) {
      useUi.getState().openPicker({ type: "track", trackId: track.id });
      return;
    }
    // Kit: os sons ficam no editor de kit. Abre o primeiro pattern desta trilha.
    const p = getProject();
    const clip = p.clips.find((c) => c.trackId === track.id);
    const pid = clip?.patternId ?? p.patternOrder.find((id) => p.patterns[id]?.homeTrackId === track.id);
    if (pid) useUi.getState().openPattern(pid, track.id);
    else {
      const newId = actions.createPatternAt(track.id, 0);
      if (newId) useUi.getState().openPattern(newId, track.id);
    }
  };

  const accent = kit ? "volt" : "uv";

  if (narrow) {
    // Celular: coluna estreita. Tocar no nome abre o menu (som, renomear, volume…).
    return (
      <div
        className={cn(
          "relative flex h-full border-b border-white/[0.04] transition-colors",
          isOpen && "bg-white/[0.045]",
          silenced && "opacity-55",
        )}
        style={{ height }}
        onContextMenu={menu}
        onPointerDown={() => useUi.getState().setZone("playlist")}
      >
        <div className={cn("w-1 shrink-0 rounded-r-full", kit ? "bg-volt-500" : "bg-uv-500")} />
        <button
          type="button"
          onClick={(e) => menu(e)}
          className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 pr-1 pl-1.5 text-left active:bg-white/[0.05]"
          aria-label={`Trilha ${track.name}: opções`}
        >
          <InlineEdit
            value={track.name}
            onCommit={(name) => actions.updateTrack(track.id, { name })}
            editing={renaming}
            onEditingChange={setRenaming}
            className="block text-[11px] leading-tight font-semibold"
            inputClassName="text-[11px]"
          />
          <span className={cn("truncate text-[9px] leading-tight", kit ? "text-volt-300/80" : "text-uv-300/80")}>
            {kit ? `Kit · ${track.kit.length}` : (preset?.name ?? "—")}
          </span>
        </button>
        {(track.muted || track.solo) && (
          <div className="flex shrink-0 flex-col justify-center gap-1 pr-1">
            {track.muted && (
              <span className="rounded bg-coral-500 px-1 font-mono text-[8px] font-bold text-ink-950">M</span>
            )}
            {track.solo && (
              <span
                className={cn(
                  "rounded px-1 font-mono text-[8px] font-bold text-ink-950",
                  kit ? "bg-volt-500" : "bg-uv-500",
                )}
              >
                S
              </span>
            )}
          </div>
        )}
        {warnVisible && drop && (
          <span
            key={drop.at}
            className="absolute top-1 right-1 flex h-4 animate-pulse-warn items-center rounded-full bg-coral-500 px-1 font-mono text-[8px] font-bold text-ink-950"
          >
            -{drop.missing}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group/track relative flex h-full gap-2 border-b border-white/[0.04] py-2 pr-2 pl-0 transition-colors",
        isOpen ? "bg-white/[0.045]" : "hover:bg-white/[0.025]",
        silenced && "opacity-55",
      )}
      style={{ height }}
      onContextMenu={menu}
      onPointerDown={() => useUi.getState().setZone("playlist")}
    >
      <div
        className={cn(
          "w-1 shrink-0 rounded-r-full",
          kit
            ? "bg-volt-500 shadow-[0_0_14px_var(--color-volt-500)]"
            : "bg-uv-500 shadow-[0_0_14px_var(--color-uv-500)]",
        )}
      />
      <button
        type="button"
        className="-ml-1 flex w-4 shrink-0 cursor-grab items-start justify-center pt-1 text-fg-faint opacity-0 transition group-hover/track:opacity-100 active:cursor-grabbing max-md:hidden"
        onPointerDown={(e) => onReorderStart(e, track.id)}
        aria-label="Arrastar para reordenar"
        title="Arraste para reordenar"
      >
        <GripVertical className="size-3.5" />
      </button>

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-1">
        <div className="flex items-center gap-1.5">
          {kit ? (
            <Drum className="size-3.5 shrink-0 text-volt-500" />
          ) : (
            <Piano className="size-3.5 shrink-0 text-uv-400" />
          )}
          <InlineEdit
            value={track.name}
            onCommit={(name) => actions.updateTrack(track.id, { name })}
            editing={renaming}
            onEditingChange={setRenaming}
            className="min-w-0 flex-1 text-[13px] font-semibold tracking-tight"
            inputClassName="text-[13px]"
          />
          {warnVisible && drop && (
            <span
              key={drop.at}
              className="flex animate-pulse-warn items-center gap-1 rounded-full bg-coral-500/20 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-coral-400"
              title={`Polifonia estourou: ${drop.missing} voz(es) cortada(s). Limite: 16 por trilha.`}
            >
              <AlertTriangle className="size-3" />-{drop.missing}
            </span>
          )}
          <button
            type="button"
            onClick={(e) => menu(e)}
            className="text-fg-faint opacity-0 transition group-hover/track:opacity-100 hover:text-fg pointer-coarse:opacity-100"
            aria-label="Menu da trilha"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={openSound}
            title={kit ? "Abrir o editor de kit" : "Trocar instrumento"}
            className={cn(
              "flex h-6 min-w-0 flex-1 items-center gap-1.5 truncate rounded-lg px-2 text-left text-[11px] font-medium ring-1 transition ring-inset",
              kit
                ? "bg-volt-500/10 text-volt-300 ring-volt-500/20 hover:bg-volt-500/20"
                : "bg-uv-500/10 text-uv-300 ring-uv-500/25 hover:bg-uv-500/20",
            )}
          >
            <span className="truncate">
              {kit ? `Kit · ${track.kit.length} sons` : (preset?.name ?? "Sem instrumento")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => actions.updateTrack(track.id, { muted: !track.muted })}
            className={cn(
              "h-6 w-6 shrink-0 rounded-lg font-mono text-[10px] font-bold transition",
              track.muted ? "bg-coral-500 text-ink-950" : "bg-white/[0.05] text-fg-faint hover:text-fg",
            )}
            title="Mute"
            aria-pressed={track.muted}
          >
            M
          </button>
          <button
            type="button"
            onClick={(e) => {
              if (e.ctrlKey || e.metaKey) {
                for (const t of getProject().tracks)
                  actions.updateTrack(t.id, { solo: t.id === track.id && !track.solo });
                return;
              }
              actions.updateTrack(track.id, { solo: !track.solo });
            }}
            className={cn(
              "h-6 w-6 shrink-0 rounded-lg font-mono text-[10px] font-bold transition",
              track.solo
                ? accent === "volt"
                  ? "bg-volt-500 text-ink-950"
                  : "bg-uv-500 text-ink-950"
                : "bg-white/[0.05] text-fg-faint hover:text-fg",
            )}
            title="Solo (Ctrl+clique: só esta)"
            aria-pressed={track.solo}
          >
            S
          </button>
        </div>

        {!compact && (
          <div
            className="-mb-1 px-0.5"
            onDoubleClick={() => actions.updateTrack(track.id, { volume: 0.8 })}
            title="Volume · roda do mouse ajusta · duplo clique volta a 80%"
          >
            <ElasticSlider
              value={Math.round(track.volume * 100)}
              maxValue={100}
              onChange={(v) => actions.updateTrack(track.id, { volume: v / 100 })}
              leftIcon={null}
              rightIcon={null}
              valuePosition="bubble"
              formatValue={(v) => `${Math.round(v)}%`}
              thickness={3}
              activeThickness={7}
              maxStretch={18}
              wheel
              rangeColor={kit ? "var(--color-volt-500)" : "var(--color-uv-500)"}
              trackColor="rgb(255 255 255 / 0.08)"
              ariaLabel={`Volume de ${track.name}`}
              style={{ width: "100%", "--elastic-slider-hit": "16px" } as React.CSSProperties}
            />
          </div>
        )}
      </div>
    </div>
  );
});
