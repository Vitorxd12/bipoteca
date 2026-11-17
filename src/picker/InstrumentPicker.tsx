/**
 * Seletor de instrumento (T8): para a trilha de instrumento e para cada linha
 * do kit. Gestos:
 *  clicar num preset ........ ouve e marca (RF-64)
 *  duplo clique ............. usa na hora
 *  setas .................... navega e ouve · Enter usa · Esc fecha
 *  roda nas categorias ...... troca de categoria
 */
import { Check, Drum, Piano, Search, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { CATEGORY_LABELS, type PresetCategory } from "@/audio/engine";
import { host } from "@/audio/host";
import { allPresets, presetKey } from "@/audio/registry";
import SpotlightCard from "@/components/SpotlightCard";
import { ShineBorder } from "@/components/ui/shine-border";
import { cn } from "@/lib/utils";
import type { PresetRef } from "@/model/types";
import { useProject } from "@/store/project";
import { useUi } from "@/store/ui";
import { GLASS_STRONG, Kbd } from "@/ui/primitives";

type Filter = PresetCategory | "todos";

export function InstrumentPicker() {
  const target = useUi((s) => s.picker);
  const close = useUi((s) => s.closePicker);
  const project = useProject((s) => s.project);

  const track = target ? project.tracks.find((t) => t.id === target.trackId) : undefined;
  const row = target?.type === "row" ? track?.kit.find((r) => r.id === target.rowId) : undefined;
  const current: PresetRef | null = row ? row.preset : (track?.preset ?? null);
  const isKitRow = target?.type === "row";

  const [filter, setFilter] = useState<Filter>("todos");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string>("");

  // biome-ignore lint/correctness/useExhaustiveDependencies: reabre limpo a cada alvo
  useEffect(() => {
    if (!target) return;
    setPicked(presetKey(current));
    setQuery("");
    setFilter(isKitRow ? "percussao" : "todos");
  }, [target]);

  const presets = useMemo(() => allPresets(), []);
  const visible = presets.filter(
    ({ preset }) =>
      (filter === "todos" || preset.category === filter) &&
      (!query || `${preset.name} ${preset.description}`.toLowerCase().includes(query.toLowerCase())),
  );
  const categories: Filter[] = ["todos", ...(Object.keys(CATEGORY_LABELS) as PresetCategory[])];

  const choose = (key: string) => {
    const [engine, preset] = key.split(":");
    if (!engine || !preset || !target) return;
    const ref = { engine, preset };
    const actions = useProject.getState();
    if (target.type === "track") actions.updateTrack(target.trackId, { preset: ref });
    else actions.updateKitRow(target.trackId, target.rowId, { preset: ref });
    close();
  };

  const audition = (key: string) => {
    setPicked(key);
    const [engine, preset] = key.split(":");
    if (engine && preset) void host.previewPreset({ engine, preset });
  };

  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement && e.key !== "Escape" && e.key !== "Enter" && !e.key.startsWith("Arrow"))
        return;
      e.stopPropagation();
      if (e.key === "Escape") close();
      else if (e.key === "Enter" && picked) choose(picked);
      else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const keys = visible.map((v) => `${v.engine}:${v.preset.id}`);
        const i = keys.indexOf(picked);
        const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : e.key === "ArrowDown" ? 3 : -3;
        const next = keys[Math.max(0, Math.min(keys.length - 1, Math.max(i, 0) + delta))];
        if (next) audition(next);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  return (
    <AnimatePresence>
      {target && track && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/55 p-6 backdrop-blur-[3px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onPointerDown={(e) => e.target === e.currentTarget && close()}
        >
          <motion.div
            initial={{ y: 24, scale: 0.94, opacity: 0, filter: "blur(8px)" }}
            animate={{ y: 0, scale: 1, opacity: 1, filter: "blur(0px)" }}
            exit={{ y: 12, scale: 0.97, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className={cn(
              GLASS_STRONG,
              "relative flex max-h-[min(720px,90vh)] w-[min(860px,96vw)] flex-col overflow-hidden",
            )}
          >
            <ShineBorder shineColor={["#8b6cff", "#c8ff3d", "#8b6cff"]} borderWidth={1.5} duration={10} />
            <header className="flex items-start gap-4 px-6 pt-6 pb-4">
              <div
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                  isKitRow ? "bg-volt-500 text-ink-950" : "bg-uv-500 text-ink-950",
                )}
              >
                {isKitRow ? <Drum className="size-5" /> : <Piano className="size-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-lg font-semibold tracking-tight">Escolher som</h2>
                <p className="truncate text-[13px] text-fg-muted">
                  {track.name}
                  {row && <span className="text-fg-faint"> › {row.name}</span>}
                  <span className="text-fg-faint">
                    {" "}
                    ·{" "}
                    {isKitRow
                      ? "um sintetizador só para esta linha"
                      : "um sintetizador toca todas as notas, acordes incluídos"}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-xl p-2 text-fg-faint transition hover:bg-white/5 hover:text-fg"
                aria-label="Fechar"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="flex items-center gap-2 px-6 pb-4">
              <div className="flex flex-1 flex-wrap gap-1">
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFilter(c)}
                    className={cn(
                      "h-8 rounded-full px-3.5 text-xs font-medium transition",
                      filter === c
                        ? "bg-fg text-ink-950 shadow-[0_0_20px_-6px_white]"
                        : "bg-white/[0.04] text-fg-muted ring-1 ring-white/[0.06] ring-inset hover:text-fg",
                    )}
                  >
                    {c === "todos" ? "Todos" : CATEGORY_LABELS[c]}
                  </button>
                ))}
              </div>
              <label className="flex h-8 w-44 items-center gap-2 rounded-full bg-black/30 px-3 ring-1 ring-white/[0.07] ring-inset focus-within:ring-uv-500/60">
                <Search className="size-3.5 text-fg-faint" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar"
                  className="w-full bg-transparent text-xs outline-none placeholder:text-fg-faint"
                />
              </label>
            </div>

            <div className="grid min-h-0 flex-1 auto-rows-max grid-cols-3 content-start gap-2 overflow-y-auto px-6 pb-4 [scrollbar-width:thin]">
              {visible.map(({ engine, preset }) => {
                const key = `${engine}:${preset.id}`;
                const isPicked = key === picked;
                const isCurrent = key === presetKey(current);
                const perc = preset.category === "percussao" || preset.category === "efeitos";
                return (
                  <SpotlightCard
                    key={key}
                    spotlightColor={perc ? "rgba(200, 255, 61, 0.25)" : "rgba(139, 108, 255, 0.32)"}
                    spotlightSize={200}
                    className={cn(
                      "cursor-pointer rounded-2xl transition-transform active:scale-[0.98]",
                      isPicked && "ring-2 ring-inset",
                      isPicked && (perc ? "ring-volt-500" : "ring-uv-400"),
                    )}
                    style={{ padding: 0 }}
                    onClick={() => audition(key)}
                    onDoubleClick={() => choose(key)}
                  >
                    <div className="relative flex h-full flex-col gap-1 p-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            perc
                              ? "bg-volt-500 shadow-[0_0_8px_var(--color-volt-500)]"
                              : "bg-uv-500 shadow-[0_0_8px_var(--color-uv-500)]",
                          )}
                        />
                        <span className="font-mono text-[10px] tracking-wider text-fg-faint uppercase">
                          {CATEGORY_LABELS[preset.category]}
                        </span>
                        {isCurrent && (
                          <span className="ml-auto flex items-center gap-1 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold text-fg-muted">
                            <Check className="size-2.5" /> atual
                          </span>
                        )}
                      </div>
                      <div className="text-[15px] font-semibold tracking-tight">{preset.name}</div>
                      <div className="text-xs text-fg-muted">{preset.description}</div>
                    </div>
                  </SpotlightCard>
                );
              })}
              {!visible.length && (
                <p className="col-span-3 py-10 text-center text-sm text-fg-faint">Nada encontrado.</p>
              )}
            </div>

            <footer className="flex items-center gap-3 border-t border-white/[0.06] px-6 py-4">
              <span className="flex items-center gap-1.5 text-[11px] text-fg-faint">
                <Kbd>clique</Kbd> ouve <Kbd>2×</Kbd> usa <Kbd>←↑↓→</Kbd> navega <Kbd>Enter</Kbd> usa
              </span>
              <div className="flex-1" />
              <button
                type="button"
                onClick={close}
                className="h-10 rounded-xl px-4 text-sm text-fg-muted ring-1 ring-white/10 transition hover:bg-white/5 hover:text-fg"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!picked}
                onClick={() => choose(picked)}
                className={cn(
                  "h-10 rounded-xl px-5 text-sm font-semibold text-ink-950 transition active:scale-95 disabled:opacity-30",
                  isKitRow
                    ? "bg-volt-500 shadow-[0_0_28px_-6px_var(--color-volt-500)] hover:bg-volt-400"
                    : "bg-uv-500 shadow-[0_0_28px_-6px_var(--color-uv-500)] hover:bg-uv-400",
                )}
              >
                Usar este som
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
