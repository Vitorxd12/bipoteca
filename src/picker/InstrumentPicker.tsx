/**
 * Seletor de som (T8).
 *
 * Trilha de instrumento: clicar ouve e marca; "Usar" (ou 2×) aplica.
 *
 * Linha de kit: o seletor vira uma sessão para o kit inteiro.
 *  - à esquerda, todas as linhas do kit; clicar troca a linha que está sendo editada
 *  - clicar num som já aplica na linha e toca (dá para ir testando no contexto)
 *  - 2× num som aplica e passa para a próxima linha
 *  - linhas com nome genérico ("Som 3") ou com o nome do som antigo são renomeadas
 *  - "Desfazer tudo" volta como estava; "Pronto" vira um passo só no desfazer
 * Teclado: setas navegam e ouvem · Enter aplica · Tab/Shift+Tab troca de linha · Esc fecha
 */
import { Check, Drum, Piano, Play, Search, X } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_LABELS, GROUP_LABELS, type PercGroup, type PresetCategory, type PresetInfo } from "@/audio/engine";
import { host } from "@/audio/host";
import { allPresets, presetInfo, presetKey } from "@/audio/registry";
import SpotlightCard from "@/components/SpotlightCard";
import { ShineBorder } from "@/components/ui/shine-border";
import { cn } from "@/lib/utils";
import type { PresetRef, Project } from "@/model/types";
import { beginGesture, endGesture, useProject } from "@/store/project";
import { useUi } from "@/store/ui";
import { GLASS, Kbd } from "@/ui/primitives";

type Entry = { engine: string; preset: PresetInfo; key: string };
type Group = PercGroup | "melodico";

const GROUP_ORDER: Group[] = ["bumbo", "caixa", "prato", "perc", "fx", "melodico"];
const groupLabel = (g: Group) => (g === "melodico" ? "Sons melódicos" : GROUP_LABELS[g]);
const groupOf = (p: PresetInfo): Group => p.group ?? "melodico";

function SoundCard({
  entry,
  picked,
  current,
  kitMode,
  onClick,
  onDoubleClick,
}: {
  entry: Entry;
  picked: boolean;
  current: boolean;
  kitMode: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}) {
  const perc = !!entry.preset.group;
  return (
    <SpotlightCard
      spotlightColor={perc ? "rgba(200, 255, 61, 0.25)" : "rgba(139, 108, 255, 0.32)"}
      spotlightSize={180}
      className={cn(
        "cursor-pointer rounded-2xl transition-transform active:scale-[0.97]",
        picked && "ring-2 ring-inset",
        picked && (perc ? "ring-volt-500" : "ring-uv-400"),
      )}
      style={{ padding: 0 }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      data-key={entry.key}
    >
      <div className="relative flex h-full flex-col gap-0.5 p-3.5">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              perc
                ? "bg-volt-500 shadow-[0_0_8px_var(--color-volt-500)]"
                : "bg-uv-500 shadow-[0_0_8px_var(--color-uv-500)]",
            )}
          />
          <span className="truncate font-mono text-[9px] tracking-wider text-fg-faint uppercase">
            {kitMode ? groupLabel(groupOf(entry.preset)) : CATEGORY_LABELS[entry.preset.category]}
          </span>
          {entry.preset.source && (
            <span
              className={cn(
                "shrink-0 rounded px-1 font-mono text-[9px]",
                entry.preset.sampled ? "bg-volt-500/15 text-volt-300" : "bg-white/[0.06] text-fg-faint",
              )}
            >
              {entry.preset.source}
            </span>
          )}
          {current && (
            <span className="ml-auto flex items-center gap-1 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold text-fg-muted">
              <Check className="size-2.5" /> atual
            </span>
          )}
        </div>
        <div className="text-[14px] font-semibold tracking-tight">{entry.preset.name}</div>
        <div className="text-[11px] leading-snug text-fg-muted">{entry.preset.description}</div>
      </div>
    </SpotlightCard>
  );
}

export function InstrumentPicker() {
  const target = useUi((s) => s.picker);
  // Fechado, não assina o projeto (não re-renderiza a cada edição).
  const project = useProject((s) => (target ? s.project : null));
  const track = target && project ? project.tracks.find((t) => t.id === target.trackId) : undefined;
  const row = target?.type === "row" ? track?.kit.find((r) => r.id === target.rowId) : undefined;
  const kitMode = target?.type === "row";
  const current: PresetRef | null = row ? row.preset : (track?.preset ?? null);
  const targetKey = target ? (target.type === "row" ? target.rowId : target.trackId) : "";

  const [filter, setFilter] = useState<string>("todos");
  const [source, setSource] = useState<string>("todas");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState("");
  const session = useRef<Project | null>(null);
  const grid = useRef<HTMLDivElement>(null);

  // Abre a sessão (um passo só no desfazer) quando o seletor abre.
  const isOpen = !!target;
  useEffect(() => {
    if (isOpen && !session.current) {
      session.current = useProject.getState().project;
      beginGesture();
      setQuery("");
      setFilter("todos");
      setSource("todas");
    }
  }, [isOpen]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: atualiza a marca ao trocar de alvo
  useEffect(() => {
    setPicked(presetKey(current));
  }, [targetKey]);

  const finish = (keep: boolean) => {
    if (!keep && session.current) useProject.setState({ project: session.current });
    session.current = null;
    endGesture();
    useUi.getState().closePicker();
  };

  const entries: Entry[] = useMemo(
    () => allPresets().map(({ engine, preset }) => ({ engine, preset, key: `${engine}:${preset.id}` })),
    [],
  );

  const tabs: { id: string; label: string }[] = kitMode
    ? [{ id: "todos", label: "Todos" }, ...GROUP_ORDER.map((g) => ({ id: g, label: groupLabel(g) }))]
    : [
        { id: "todos", label: "Todos" },
        ...(Object.keys(CATEGORY_LABELS) as PresetCategory[]).map((c) => ({ id: c, label: CATEGORY_LABELS[c] })),
      ];

  // Agrupa: no kit por família (percussão primeiro); no instrumento por categoria.
  const sections = useMemo(() => {
    const q = query.toLowerCase();
    const visible = entries.filter(({ preset }) => {
      const inTab =
        filter === "todos" || (kitMode ? groupOf(preset) === filter : preset.category === (filter as PresetCategory));
      const fromSource = source === "todas" || preset.source === source;
      return inTab && fromSource && (!q || `${preset.name} ${preset.description}`.toLowerCase().includes(q));
    });
    const order: string[] = kitMode ? GROUP_ORDER : (Object.keys(CATEGORY_LABELS) as PresetCategory[]);
    const keyOf = (e: Entry): string => (kitMode ? groupOf(e.preset) : e.preset.category);
    return order
      .map((g) => ({
        id: g,
        label: kitMode ? groupLabel(g as Group) : CATEGORY_LABELS[g as PresetCategory],
        items: visible.filter((e) => keyOf(e) === g),
      }))
      .filter((s) => s.items.length);
  }, [entries, filter, query, kitMode, source]);
  // Origens disponíveis: no kit, cada máquina; no instrumento, sintetizado × sampleado.
  const sources = useMemo(() => {
    const list = entries
      .filter((e) => (kitMode ? !!e.preset.group : !e.preset.group))
      .map((e) => e.preset.source ?? "");
    return ["todas", ...new Set(list.filter(Boolean))];
  }, [entries, kitMode]);
  const flat = sections.flatMap((s) => s.items);

  const applyToRow = (key: string) => {
    if (!track || !row) return;
    const [engine, preset] = key.split(":");
    if (!engine || !preset) return;
    const ref = { engine, preset };
    const oldName = presetInfo(row.preset)?.name;
    const generic = /^Som \d+$/.test(row.name) || row.name === oldName;
    useProject.getState().updateKitRow(track.id, row.id, {
      preset: ref,
      ...(generic ? { name: presetInfo(ref)?.name ?? row.name } : {}),
    });
  };

  const goRow = (delta: number) => {
    if (!track || !row) return;
    const i = track.kit.findIndex((r) => r.id === row.id);
    const next = track.kit[(i + delta + track.kit.length) % track.kit.length];
    if (next) useUi.getState().openPicker({ type: "row", trackId: track.id, rowId: next.id });
  };

  const audition = (key: string) => {
    setPicked(key);
    const [engine, preset] = key.split(":");
    if (engine && preset) void host.previewPreset({ engine, preset });
    if (kitMode) applyToRow(key);
    grid.current?.querySelector(`[data-key="${key}"]`)?.scrollIntoView({ block: "nearest" });
  };

  const choose = (key: string) => {
    if (!target) return;
    if (kitMode) {
      applyToRow(key);
      goRow(1);
      return;
    }
    const [engine, preset] = key.split(":");
    if (!engine || !preset) return;
    useProject.getState().updateTrack(target.trackId, { preset: { engine, preset } });
    finish(true);
  };

  // Recria o atalho a cada render, com o estado atual.
  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement &&
        !["Escape", "Enter", "Tab"].includes(e.key) &&
        !e.key.startsWith("Arrow")
      )
        return;
      e.stopPropagation();
      if (e.key === "Escape") finish(kitMode);
      else if (e.key === "Enter" && picked) {
        e.preventDefault();
        if (kitMode) finish(true);
        else choose(picked);
      } else if (e.key === "Tab" && kitMode) {
        e.preventDefault();
        goRow(e.shiftKey ? -1 : 1);
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const keys = flat.map((v) => v.key);
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
    <>
      {target && track && (
        <div className="h-full min-h-0">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16 }}
            className={cn(GLASS, "relative flex h-full w-full flex-col overflow-hidden")}
          >
            <ShineBorder shineColor={["#8b6cff", "#c8ff3d", "#8b6cff"]} borderWidth={1.5} duration={10} />
            <header className="flex items-start gap-3 px-4 pt-4 pb-3 md:gap-4 md:px-6 md:pt-6 md:pb-4">
              <div
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-ink-950",
                  kitMode ? "bg-volt-500" : "bg-uv-500",
                )}
              >
                {kitMode ? <Drum className="size-5" /> : <Piano className="size-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-lg font-semibold tracking-tight">
                  {kitMode ? "Sons do kit" : "Escolher instrumento"}
                </h2>
                <p className="truncate text-[13px] text-fg-muted">
                  {track.name}
                  <span className="text-fg-faint">
                    {" · "}
                    {kitMode
                      ? "cada linha tem o próprio som; clique num som para aplicar na linha selecionada"
                      : "um sintetizador toca todas as notas, acordes incluídos"}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => finish(kitMode)}
                className="rounded-xl p-2 text-fg-faint transition hover:bg-white/5 hover:text-fg"
                aria-label="Fechar"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
              {kitMode && (
                <aside className="flex shrink-0 flex-col border-b border-white/[0.06] px-3 pb-3 md:w-60 md:border-r md:border-b-0">
                  <div className="hidden items-center gap-1.5 px-2 pb-2 text-[10px] font-semibold tracking-[0.14em] text-fg-faint uppercase md:flex">
                    Linhas <Kbd>Tab</Kbd>
                  </div>
                  <div className="flex min-h-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:thin] md:flex-col md:overflow-x-visible md:overflow-y-auto">
                    {track.kit.map((r) => {
                      const sel = r.id === row?.id;
                      return (
                        <div
                          key={r.id}
                          className={cn(
                            "group/r flex w-40 shrink-0 items-center gap-2 rounded-xl px-2.5 py-2 transition md:w-full",
                            sel ? "bg-volt-500 text-ink-950" : "hover:bg-white/[0.05]",
                          )}
                        >
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() => useUi.getState().openPicker({ type: "row", trackId: track.id, rowId: r.id })}
                          >
                            <span className="block truncate text-[13px] font-semibold">{r.name}</span>
                            <span
                              className={cn("block truncate text-[11px]", sel ? "text-ink-950/70" : "text-fg-faint")}
                            >
                              {presetInfo(r.preset)?.name}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void host.previewPreset(r.preset)}
                            className={cn(
                              "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition",
                              sel
                                ? "bg-ink-950/15 hover:bg-ink-950/30"
                                : "text-volt-400 opacity-0 group-hover/r:opacity-100 hover:bg-volt-500/20 pointer-coarse:opacity-100",
                            )}
                            title="Ouvir"
                          >
                            <Play className="size-3 fill-current" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </aside>
              )}

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-3 md:flex-nowrap md:px-6 md:pt-0">
                  <div className="flex flex-1 flex-wrap gap-1">
                    {tabs.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setFilter(t.id)}
                        className={cn(
                          "h-7 rounded-full px-3 text-[11px] font-medium transition",
                          filter === t.id
                            ? "bg-fg text-ink-950 shadow-[0_0_20px_-6px_white]"
                            : "bg-white/[0.04] text-fg-muted ring-1 ring-white/[0.06] ring-inset hover:text-fg",
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <label className="flex h-8 w-full items-center md:w-40 gap-2 rounded-full bg-black/30 px-3 ring-1 ring-white/[0.07] ring-inset focus-within:ring-uv-500/60">
                    <Search className="size-3.5 text-fg-faint" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Buscar"
                      className="w-full bg-transparent text-xs outline-none placeholder:text-fg-faint"
                    />
                  </label>
                </div>

                {sources.length > 2 && (
                  <div className="flex flex-wrap items-center gap-1 px-4 pb-3 md:px-6">
                    <span className="mr-1 text-[10px] font-semibold tracking-[0.14em] text-fg-faint uppercase">
                      Origem
                    </span>
                    {sources.map((src) => (
                      <button
                        key={src}
                        type="button"
                        onClick={() => setSource(src)}
                        className={cn(
                          "h-6 rounded-md px-2 font-mono text-[10px] font-medium transition",
                          source === src
                            ? kitMode
                              ? "bg-volt-500 text-ink-950"
                              : "bg-uv-500 text-ink-950"
                            : "bg-white/[0.04] text-fg-muted hover:text-fg",
                        )}
                      >
                        {src === "todas" ? "Todas" : src}
                      </button>
                    ))}
                  </div>
                )}
                <div ref={grid} className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 [scrollbar-width:thin] md:px-6">
                  {sections.map((sec) => (
                    <section key={sec.id} className="mb-4">
                      <h3 className="sticky top-0 z-10 -mx-1 mb-2 bg-ink-850/90 px-1 py-1 text-[10px] font-semibold tracking-[0.14em] text-fg-faint uppercase backdrop-blur">
                        {sec.label}
                      </h3>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {sec.items.map((e) => (
                          <SoundCard
                            key={e.key}
                            entry={e}
                            kitMode={kitMode}
                            picked={e.key === picked}
                            current={e.key === presetKey(current)}
                            onClick={() => audition(e.key)}
                            onDoubleClick={() => choose(e.key)}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                  {!sections.length && <p className="py-10 text-center text-sm text-fg-faint">Nada encontrado.</p>}
                </div>
              </div>
            </div>

            <footer className="flex items-center gap-3 border-t border-white/[0.06] px-4 py-3 md:px-6 md:py-4">
              <span className="hidden flex-wrap items-center gap-1.5 text-[11px] text-fg-faint md:flex">
                <Kbd>clique</Kbd> {kitMode ? "aplica e ouve" : "ouve"} <Kbd>2×</Kbd>
                {kitMode ? "aplica e vai para a próxima linha" : "usa"} <Kbd>←↑↓→</Kbd> navega
              </span>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => finish(false)}
                className="h-10 rounded-xl px-4 text-sm text-fg-muted ring-1 ring-white/10 transition hover:bg-white/5 hover:text-fg"
              >
                {kitMode ? "Desfazer tudo" : "Cancelar"}
              </button>
              <button
                type="button"
                disabled={!picked}
                onClick={() => (kitMode ? finish(true) : choose(picked))}
                className={cn(
                  "h-10 rounded-xl px-5 text-sm font-semibold text-ink-950 transition active:scale-95 disabled:opacity-30",
                  kitMode
                    ? "bg-volt-500 shadow-[0_0_28px_-6px_var(--color-volt-500)] hover:bg-volt-400"
                    : "bg-uv-500 shadow-[0_0_28px_-6px_var(--color-uv-500)] hover:bg-uv-400",
                )}
              >
                {kitMode ? "Pronto" : "Usar este som"}
              </button>
            </footer>
          </motion.div>
        </div>
      )}
    </>
  );
}
