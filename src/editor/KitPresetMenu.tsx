/**
 * Kits prontos e kits salvos. Gestos:
 *  ▶ ................ ouve o kit (cada som, depois uma batida curta)
 *  clicar no kit .... carrega: as batidas já escritas continuam, com os sons novos
 *  Salvar ........... guarda o kit atual para usar em qualquer projeto
 */
import { BookmarkPlus, ChevronDown, Package, Play, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { host } from "@/audio/host";
import { KIT_PRESETS, type KitPreset } from "@/audio/presets";
import { presetInfo } from "@/audio/registry";
import { cn } from "@/lib/utils";
import type { Track } from "@/model/types";
import { useKits } from "@/store/kits";
import { getProject, useProject } from "@/store/project";
import { toast } from "@/store/toast";
import { useUi } from "@/store/ui";
import { Popover } from "@/ui/Popover";

async function loadInto(track: Track, kit: KitPreset) {
  const p = getProject();
  const lost = track.kit.slice(kit.rows.length);
  const lostNotes = new Set(lost.map((r) => r.note));
  const hasLostNotes = Object.values(p.patterns).some(
    (pat) =>
      (pat.homeTrackId === track.id || p.clips.some((c) => c.trackId === track.id && c.patternId === pat.id)) &&
      pat.notes.some((n) => lostNotes.has(n.pitch)),
  );
  if (hasLostNotes) {
    const ok = await useUi.getState().askConfirm({
      title: `Carregar "${kit.name}"?`,
      message: `O kit novo tem ${kit.rows.length} sons e o atual tem ${track.kit.length}. Os toques das linhas que sobram (${lost.map((r) => r.name).join(", ")}) serão apagados.`,
      confirmLabel: "Carregar kit",
    });
    if (!ok) return false;
  }
  useProject.getState().loadKit(track.id, kit.rows);
  toast(`Kit "${kit.name}" carregado. As batidas continuam, agora com os sons novos.`);
  return true;
}

function KitRowItem({
  kit,
  track,
  close,
  onDelete,
}: {
  kit: KitPreset;
  track: Track;
  close: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="group/kit flex items-start gap-2 rounded-xl p-2 transition hover:bg-volt-500/10">
      <button
        type="button"
        title="Ouvir o kit"
        disabled={!kit.rows.length}
        onClick={() => void host.previewKit(kit.rows.map((r) => r.preset))}
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-volt-500/15 text-volt-400 transition hover:bg-volt-500 hover:text-ink-950 active:scale-90 disabled:opacity-30"
      >
        <Play className="size-3 fill-current" />
      </button>
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={async () => {
          if (await loadInto(track, kit)) close();
        }}
      >
        <span className="block text-[13px] font-semibold">{kit.name}</span>
        <span className="block text-[11px] text-fg-faint">{kit.description}</span>
        {kit.rows.length > 0 && (
          <span className="mt-1.5 flex flex-wrap gap-1">
            {kit.rows.slice(0, 8).map((r, i) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: linhas podem repetir nome
                key={i}
                className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-fg-muted"
                title={presetInfo(r.preset)?.name}
              >
                {r.name}
              </span>
            ))}
          </span>
        )}
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          title="Apagar kit salvo"
          className="mt-1 text-fg-faint opacity-0 transition group-hover/kit:opacity-100 hover:text-coral-400"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function KitPresetMenu({ track }: { track: Track }) {
  const { userKits, load, saveKit, deleteKit } = useKits();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Popover
      width={380}
      onOpenChange={(o) => !o && setNaming(false)}
      trigger={({ toggle, ref, open }) => (
        <button
          ref={ref}
          type="button"
          onClick={toggle}
          className={cn(
            "flex h-6 items-center gap-1.5 rounded-lg px-2 text-[11px] font-semibold transition",
            open ? "bg-volt-500 text-ink-950" : "bg-volt-500/12 text-volt-300 hover:bg-volt-500/25",
          )}
          title="Kits prontos e kits salvos"
        >
          <Package className="size-3.5" /> Kits{" "}
          <ChevronDown className={cn("size-3 transition", open && "rotate-180")} />
        </button>
      )}
    >
      {(close) => (
        <div className="max-h-[70vh] overflow-y-auto [scrollbar-width:thin]">
          <div className="px-2.5 pt-1.5 pb-1 text-[10px] font-semibold tracking-[0.14em] text-fg-faint uppercase">
            Kits prontos
          </div>
          {KIT_PRESETS.filter((k) => k.rows.length).map((k) => (
            <KitRowItem key={k.id} kit={k} track={track} close={close} />
          ))}
          <div className="mt-1 border-t border-white/[0.06] px-2.5 pt-2.5 pb-1 text-[10px] font-semibold tracking-[0.14em] text-fg-faint uppercase">
            Meus kits
          </div>
          {userKits.map((k) => (
            <KitRowItem key={k.id} kit={k} track={track} close={close} onDelete={() => void deleteKit(k.id)} />
          ))}
          {!userKits.length && (
            <p className="px-2.5 pb-2 text-[11px] text-fg-faint">
              Nenhum ainda. Salve o kit desta trilha para reutilizar em outros projetos.
            </p>
          )}
          <div className="p-1.5">
            {naming ? (
              <form
                className="flex gap-1.5"
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
                  className="h-8 min-w-0 flex-1 rounded-lg bg-black/40 px-2.5 text-xs outline-none ring-1 ring-volt-500/50"
                />
                <button type="submit" className="h-8 rounded-lg bg-volt-500 px-3 text-xs font-semibold text-ink-950">
                  Salvar
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
                className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/15 text-xs text-fg-muted transition hover:border-volt-500/50 hover:text-volt-300 disabled:opacity-30"
              >
                <BookmarkPlus className="size-3.5" /> Salvar o kit desta trilha
              </button>
            )}
          </div>
        </div>
      )}
    </Popover>
  );
}
