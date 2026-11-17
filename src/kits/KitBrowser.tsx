/**
 * Navegador de kits. Abre ao criar uma trilha de kit ou pelo botão "Kits" do
 * editor de kit. Gestos:
 *  clicar num pad ........ ouve aquele som
 *  ▶ Ouvir ............... toca os sons e um compasso de batida
 *  Usar este kit ......... cria a trilha / troca o kit (as batidas continuam)
 *  Esc / fora ............ fecha
 */
import { BookmarkPlus, Drum, Package, Play, Sparkles, Trash2, User, X } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import type { PercGroup } from "@/audio/engine";
import { host } from "@/audio/host";
import { KIT_PRESETS, type KitPreset } from "@/audio/presets";
import { presetInfo } from "@/audio/registry";
import { ShineBorder } from "@/components/ui/shine-border";
import { cn } from "@/lib/utils";
import { matchKitRows } from "@/model/kitMatch";
import type { Track } from "@/model/types";
import { useKits } from "@/store/kits";
import { getProject, useProject } from "@/store/project";
import { toast } from "@/store/toast";
import { useUi } from "@/store/ui";
import { GLASS, Kbd } from "@/ui/primitives";

type Filter = "todos" | "samples" | "synth" | "user";

/** Cor do pad pela família do som: dá para "ler" o kit de relance. */
const PAD: Record<PercGroup | "melodico", string> = {
  bumbo: "bg-volt-500 text-ink-950",
  caixa: "bg-volt-300 text-ink-950",
  prato: "bg-uv-300 text-ink-950",
  perc: "bg-uv-500 text-ink-950",
  fx: "bg-coral-400 text-ink-950",
  melodico: "bg-fg-muted text-ink-950",
};

/** Troca o kit de uma trilha; avisa se alguma linha com toques vai sumir. */
export async function loadKitInto(track: Track, kit: KitPreset): Promise<boolean> {
  const p = getProject();
  const { lost } = matchKitRows(track.kit, kit.rows);
  const lostNotes = new Set(lost.map((r) => r.note));
  const hasLostNotes = Object.values(p.patterns).some(
    (pat) =>
      (pat.homeTrackId === track.id || p.clips.some((c) => c.trackId === track.id && c.patternId === pat.id)) &&
      pat.notes.some((n) => lostNotes.has(n.pitch)),
  );
  if (hasLostNotes) {
    const ok = await useUi.getState().askConfirm({
      title: `Usar "${kit.name}"?`,
      message: `O kit novo não tem som equivalente para ${lost.map((r) => r.name).join(", ")}. Os toques dessas linhas serão apagados; o resto continua, com os sons novos.`,
      confirmLabel: "Usar kit",
    });
    if (!ok) return false;
  }
  useProject.getState().loadKit(track.id, kit.rows);
  toast(`Kit "${kit.name}" na trilha. As batidas continuam, agora com os sons novos.`);
  return true;
}

function KitCard({
  kit,
  onUse,
  onDelete,
  useLabel,
}: {
  kit: KitPreset;
  onUse: () => void;
  onDelete?: () => void;
  useLabel: string;
}) {
  const [flash, setFlash] = useState(-1);
  const badge =
    kit.kind === "samples"
      ? { label: "Samples", icon: <Package className="size-3" />, cls: "bg-volt-500/15 text-volt-300" }
      : kit.kind === "user"
        ? { label: "Meu kit", icon: <User className="size-3" />, cls: "bg-white/10 text-fg" }
        : { label: "Sintetizado", icon: <Sparkles className="size-3" />, cls: "bg-uv-500/20 text-uv-300" };

  const hit = (i: number) => {
    const row = kit.rows[i];
    if (!row) return;
    void host.previewPreset(row.preset);
    setFlash(i);
    setTimeout(() => setFlash((f) => (f === i ? -1 : f)), 160);
  };

  return (
    <div className="group/kit flex flex-col rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.07] transition-colors ring-inset hover:bg-white/[0.05] hover:ring-white/15">
      <div className="mb-3 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-display text-[15px] font-semibold tracking-tight">{kit.name}</h3>
            <span
              className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", badge.cls)}
            >
              {badge.icon}
              {badge.label}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-[12px] text-fg-muted">{kit.description}</p>
        </div>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            title="Apagar kit salvo"
            className="text-fg-faint opacity-0 transition group-hover/kit:opacity-100 hover:text-coral-400 pointer-coarse:opacity-100"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>

      {/* Pads: um por som, na cor da família. Clique para ouvir. */}
      <div className="grid grid-cols-5 gap-1.5">
        {kit.rows.map((r, i) => {
          const info = presetInfo(r.preset);
          const fam = info?.group ?? "melodico";
          return (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: pads são posicionais
              key={i}
              type="button"
              onPointerDown={() => hit(i)}
              title={`${r.name} · ${info?.name ?? "?"}`}
              className={cn(
                "flex h-11 items-end rounded-lg px-1.5 pb-1 text-left text-[9.5px] leading-tight font-semibold transition-all duration-100",
                PAD[fam],
                flash === i ? "scale-95 brightness-125" : "opacity-80 hover:opacity-100",
              )}
            >
              <span className="line-clamp-2">{r.name}</span>
            </button>
          );
        })}
        {!kit.rows.length && (
          <div className="col-span-5 flex h-11 items-center justify-center rounded-lg border border-dashed border-white/10 text-[11px] text-fg-faint">
            Nenhum som: você monta linha por linha
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={!kit.rows.length}
          onClick={() => void host.previewKit(kit.rows.map((r) => r.preset))}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 text-xs font-medium text-fg transition hover:bg-white/[0.12] active:scale-95 disabled:opacity-30"
        >
          <Play className="size-3 fill-current" /> Ouvir
        </button>
        <span className="font-mono text-[10px] text-fg-faint">{kit.rows.length} sons</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onUse}
          className="h-8 rounded-lg bg-volt-500 px-3.5 text-xs font-semibold text-ink-950 shadow-[0_0_20px_-8px_var(--color-volt-500)] transition hover:bg-volt-400 active:scale-95"
        >
          {useLabel}
        </button>
      </div>
    </div>
  );
}

export function KitBrowser() {
  const target = useUi((s) => s.kitBrowser);
  const close = useUi((s) => s.closeKitBrowser);
  const track = useProject((s) =>
    target?.mode === "replace" ? s.project.tracks.find((t) => t.id === target.trackId) : undefined,
  );
  const { userKits, load, saveKit, deleteKit } = useKits();
  const [filter, setFilter] = useState<Filter>("todos");
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!target) return;
    setNaming(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target instanceof HTMLInputElement)) {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [target, close]);

  const all: KitPreset[] = [...KIT_PRESETS, ...userKits.map((k) => ({ ...k, kind: "user" as const }))];
  const visible = all.filter((k) => filter === "todos" || (k.kind ?? "synth") === filter);
  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "todos", label: "Todos", count: all.length },
    { id: "samples", label: "Máquinas clássicas", count: all.filter((k) => k.kind === "samples").length },
    { id: "synth", label: "Sintetizados", count: all.filter((k) => k.kind === "synth").length },
    { id: "user", label: "Meus kits", count: userKits.length },
  ];

  const use = async (kit: KitPreset) => {
    if (!target) return;
    if (target.mode === "create") {
      const actions = useProject.getState();
      const id = actions.addTrack("kit", "empty");
      if (!id) return;
      actions.loadKit(id, kit.rows);
      if (kit.rows.length) actions.updateTrack(id, { name: kit.name });
      close();
      return;
    }
    if (track && (await loadKitInto(track, kit))) close();
  };

  return (
    <>
      {target && (target.mode === "create" || track) && (
        <div className="h-full min-h-0">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16 }}
            className={cn(GLASS, "relative flex h-full w-full flex-col overflow-hidden")}
          >
            <ShineBorder shineColor={["#c8ff3d", "#8b6cff", "#c8ff3d"]} borderWidth={1.5} duration={12} />
            <header className="flex items-start gap-3 px-4 pt-4 pb-3 md:gap-4 md:px-6 md:pt-6 md:pb-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-volt-500 text-ink-950">
                <Drum className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-lg font-semibold tracking-tight">
                  {target.mode === "create" ? "Nova trilha de kit" : `Trocar o kit de ${track?.name}`}
                </h2>
                <p className="text-[13px] text-fg-muted">
                  {target.mode === "create"
                    ? "Escolha os sons com que a trilha começa. Dá para trocar qualquer linha depois."
                    : "As batidas já escritas continuam, tocando com os sons do kit novo."}
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

            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
              <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/[0.06] px-3 pb-3 md:w-52 md:flex-col md:overflow-visible md:border-r md:border-b-0">
                {filters.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    className={cn(
                      "flex shrink-0 items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-medium whitespace-nowrap transition",
                      filter === f.id
                        ? "bg-volt-500 text-ink-950"
                        : "text-fg-muted hover:bg-white/[0.05] hover:text-fg",
                    )}
                  >
                    {f.label}
                    <span
                      className={cn("font-mono text-[10px]", filter === f.id ? "text-ink-950/70" : "text-fg-faint")}
                    >
                      {f.count}
                    </span>
                  </button>
                ))}
                <div className="mt-auto hidden space-y-2 px-1 text-[11px] leading-relaxed text-fg-faint md:block">
                  <p>
                    <b className="text-fg-muted">Máquinas clássicas</b>: samples de domínio público de baterias
                    eletrônicas reais. Baixam na primeira vez.
                  </p>
                  <p>Cor dos pads: bumbo, caixa, pratos, percussão, efeitos.</p>
                </div>
              </nav>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-6 [scrollbar-width:thin] md:px-6 md:pt-0">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {visible.map((k) => (
                    <KitCard
                      key={k.id}
                      kit={k}
                      useLabel={target.mode === "create" ? "Criar trilha" : "Usar este kit"}
                      onUse={() => void use(k)}
                      onDelete={k.kind === "user" ? () => void deleteKit(k.id) : undefined}
                    />
                  ))}
                </div>
                {!visible.length && (
                  <p className="py-16 text-center text-sm text-fg-faint">
                    Nenhum kit salvo ainda. Monte um kit numa trilha e salve por aqui.
                  </p>
                )}
              </div>
            </div>

            {target.mode === "replace" && track && (
              <footer className="flex flex-wrap items-center gap-3 border-t border-white/[0.06] px-4 py-3 md:px-6 md:py-3.5">
                {naming ? (
                  <form
                    className="flex flex-1 items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void saveKit(name || track.name, track.kit);
                      setNaming(false);
                    }}
                  >
                    <input
                      autoFocus
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder="Nome do kit"
                      className="h-9 w-64 rounded-xl bg-black/40 px-3 text-sm outline-none ring-1 ring-volt-500/50"
                    />
                    <button
                      type="submit"
                      className="h-9 rounded-xl bg-volt-500 px-4 text-sm font-semibold text-ink-950"
                    >
                      Salvar
                    </button>
                    <button type="button" onClick={() => setNaming(false)} className="h-9 px-2 text-sm text-fg-muted">
                      Cancelar
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    disabled={!track.kit.length}
                    onClick={() => {
                      setName(track.name);
                      setNaming(true);
                    }}
                    className="flex h-9 items-center gap-2 rounded-xl px-3 text-sm text-fg-muted ring-1 ring-white/10 transition hover:bg-white/5 hover:text-fg disabled:opacity-30"
                  >
                    <BookmarkPlus className="size-4" /> Salvar o kit de "{track.name}" em Meus kits
                  </button>
                )}
                <div className="flex-1" />
                <span className="flex items-center gap-1.5 text-[11px] text-fg-faint">
                  <Kbd>Esc</Kbd> fecha
                </span>
              </footer>
            )}
          </motion.div>
        </div>
      )}
    </>
  );
}
