/**
 * Casca do editor (T6/T7). O tipo da trilha decide qual editor aparece:
 * o usuário não alterna "modo", abre o pattern e o editor certo vem junto.
 */
import { Drum, Minus, Piano, Plus, Repeat, Scan, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { presetInfo } from "@/audio/registry";
import { cn } from "@/lib/utils";
import { LIMITS } from "@/model/limits";
import type { Snap } from "@/model/music";
import { useProject } from "@/store/project";
import { useTransport } from "@/store/transport";
import { useUi } from "@/store/ui";
import { InlineEdit } from "@/ui/InlineEdit";
import { GLASS, IconButton, LABEL } from "@/ui/primitives";
import { SnapMenu, type SnapOption } from "@/ui/SnapMenu";
import { useCompact } from "@/ui/useCompact";
import { KitEditor } from "./KitEditor";
import { PianoRoll } from "./PianoRoll";
import { fitPattern, KEYS_W, KEYS_W_MOBILE, KIT_HEADER_W, KIT_HEADER_W_MOBILE, useOpenPatternMeta } from "./view";

const EDITOR_SNAPS: SnapOption<Snap>[] = [
  { value: "1/4", label: "1/4", hint: "Semínima · 4 por compasso", perBar: 4 },
  { value: "1/8", label: "1/8", hint: "Colcheia · 8 por compasso", perBar: 8 },
  { value: "1/16", label: "1/16", hint: "Semicolcheia · 16 por compasso", perBar: 16 },
  { value: "1/32", label: "1/32", hint: "Fusa · 32 por compasso", perBar: 32 },
];

function LengthStepper({ patternId, bars }: { patternId: string; bars: number }) {
  const set = (b: number) => useProject.getState().setPatternLength(patternId, b);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cur = useProject.getState().project.patterns[patternId]?.lengthBars ?? 1;
      set(cur + (e.deltaY < 0 ? 1 : -1));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });
  return (
    <div
      ref={ref}
      className="flex h-8 items-center rounded-xl bg-black/30 ring-1 ring-white/[0.06] ring-inset"
      title="Duração em compassos · roda do mouse ajusta · arraste o marcador na régua"
    >
      <IconButton label="Menos um compasso" size="sm" onClick={() => set(bars - 1)} disabled={bars <= 1}>
        <Minus />
      </IconButton>
      <span className="min-w-14 text-center font-mono text-[11px] text-fg">
        {bars} <span className="text-fg-faint">comp.</span>
      </span>
      <IconButton
        label="Mais um compasso"
        size="sm"
        onClick={() => set(bars + 1)}
        disabled={bars >= LIMITS.patternBars}
      >
        <Plus />
      </IconButton>
    </div>
  );
}

export function EditorPanel() {
  const meta = useOpenPatternMeta();
  const pattern = meta.id ? meta : null;
  const editorTrackId = useUi((s) => s.editorTrackId);
  const snap = useUi((s) => s.editorSnap);
  const playMode = useTransport((s) => s.mode);
  const track = useProject(
    (s) =>
      s.project.tracks.find((t) => t.id === (editorTrackId ?? pattern?.homeTrackId)) ??
      s.project.tracks.find((t) => t.id === pattern?.homeTrackId),
  );
  const body = useRef<HTMLDivElement>(null);
  const kit = pattern?.kind === "kit";
  const compact = useCompact();
  // Largura da coluna da esquerda (teclado ou linhas do kit), para enquadrar o pattern.
  const headerW = kit ? (compact ? KIT_HEADER_W_MOBILE : KIT_HEADER_W) : compact ? KEYS_W_MOBILE : KEYS_W;

  // Pattern apagado ou trilha removida: fecha o editor.
  useEffect(() => {
    if (!pattern) useUi.getState().closeEditor();
  }, [pattern]);

  // Ao abrir outro pattern, enquadra ele inteiro.
  // biome-ignore lint/correctness/useExhaustiveDependencies: só ao trocar de pattern
  useEffect(() => {
    if (body.current) fitPattern(body.current.clientWidth - headerW);
  }, [pattern?.id]);

  if (!pattern) return null;

  return (
    <section
      className={cn(GLASS, "flex h-full min-h-0 flex-col overflow-hidden")}
      onPointerDown={() => useUi.getState().setZone("editor")}
    >
      <div className="no-scrollbar flex h-11 shrink-0 items-center gap-2 overflow-x-auto border-b border-white/[0.06] px-3 [scrollbar-width:none]">
        <span className={cn(LABEL, "shrink-0 whitespace-nowrap max-md:hidden", kit ? "text-volt-600" : "text-uv-400")}>
          {kit ? "Editor de kit" : "Piano roll"}
        </span>
        <div className="flex min-w-0 items-center gap-1.5">
          <InlineEdit
            value={pattern.name}
            onCommit={(name) => useProject.getState().renamePattern(pattern.id, name)}
            className="max-w-48 font-display text-[13px] font-semibold whitespace-nowrap max-md:hidden"
            inputClassName="w-40 text-[13px]"
          />
          {track && (
            <span
              className={cn(
                "flex shrink-0 items-center gap-1 truncate rounded-full px-2 py-0.5 text-[11px] whitespace-nowrap ring-1 ring-inset",
                kit ? "bg-volt-500/10 text-volt-300 ring-volt-500/25" : "bg-uv-500/10 text-uv-300 ring-uv-500/25",
              )}
              title="Trilha que dá o som a este pattern"
            >
              {kit ? <Drum className="size-3" /> : <Piano className="size-3" />}
              {track.name}
              {!kit && <span className="text-fg-faint max-md:hidden">· {presetInfo(track.preset)?.name}</span>}
            </span>
          )}
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => useTransport.getState().setMode(playMode === "pattern" ? "song" : "pattern")}
          className={cn(
            "flex h-8 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-[11px] font-medium whitespace-nowrap transition",
            playMode === "pattern"
              ? "bg-volt-500 text-ink-950 shadow-[0_0_18px_-4px_var(--color-volt-500)]"
              : "bg-white/[0.04] text-fg-muted ring-1 ring-white/[0.06] ring-inset hover:text-fg",
          )}
          title="Tocar só este pattern, em loop (RF-12)"
        >
          <Repeat className="size-3.5" /> <span className="max-md:hidden">Só o pattern</span>
        </button>
        <SnapMenu
          value={snap}
          tone={kit ? "volt" : "uv"}
          onChange={(v) => useUi.getState().setEditorSnap(v)}
          options={EDITOR_SNAPS}
        />
        <LengthStepper patternId={pattern.id} bars={pattern.lengthBars} />
        <div className="mx-1 h-5 w-px bg-white/[0.07]" />
        <IconButton
          label="Enquadrar o pattern"
          onClick={() => body.current && fitPattern(body.current.clientWidth - headerW)}
        >
          <Scan />
        </IconButton>
        <IconButton label="Voltar (Esc)" onClick={() => useUi.getState().closeEditor()}>
          <X />
        </IconButton>
      </div>
      <div ref={body} className="flex min-h-0 flex-1">
        {kit && track ? <KitEditor track={track} /> : <PianoRoll trackId={track?.id ?? null} />}
      </div>
    </section>
  );
}
