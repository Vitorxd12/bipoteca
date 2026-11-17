/**
 * Biblioteca de patterns (T5). Gestos:
 *  clicar ............. abre no editor
 *  arrastar ........... solta na playlist (só em trilha do mesmo tipo)
 *  duplo clique ....... renomeia
 *  botão direito ...... duplicar / apagar
 */
import { Copy, Drum, Layers, PanelLeftClose, Pencil, Piano, Plus, Trash2 } from "lucide-react";

import { memo, useState } from "react";
import { cn } from "@/lib/utils";
import type { Pattern } from "@/model/types";
import { libraryDrag } from "@/playlist/view";
import { getProject, useProject } from "@/store/project";
import { useUi } from "@/store/ui";
import { InlineEdit } from "@/ui/InlineEdit";
import { showMenu } from "@/ui/overlays";
import { Popover } from "@/ui/Popover";
import { GLASS, IconButton, LABEL } from "@/ui/primitives";

function openById(id: string) {
  const p = getPattern(id);
  if (p) openInEditor(p);
}

async function removeById(id: string) {
  const p = getPattern(id);
  if (p) await removePattern(p);
}

function openInEditor(p: Pattern) {
  const project = getProject();
  const clip = project.clips.find((c) => c.patternId === p.id);
  useUi.getState().openPattern(p.id, clip?.trackId ?? p.homeTrackId);
}

async function removePattern(p: Pattern) {
  const uses = getProject().clips.filter((c) => c.patternId === p.id).length;
  if (uses > 0) {
    const ok = await useUi.getState().askConfirm({
      title: `Apagar "${p.name}"?`,
      message: `${uses} clipe${uses > 1 ? "s usam" : " usa"} este pattern e ${uses > 1 ? "serão removidos" : "será removido"} da playlist.`,
      confirmLabel: "Apagar pattern",
    });
    if (!ok) return;
  }
  useProject.getState().removePattern(p.id);
}

interface ItemProps {
  id: string;
  name: string;
  kind: Pattern["kind"];
  lengthBars: number;
  notes: number;
  uses: number;
  open: boolean;
}

const getPattern = (id: string) => getProject().patterns[id];

/** Só re-renderiza quando o que ele mostra muda (não a cada nota arrastada). */
const PatternItem = memo(function PatternItem({ id, name, kind, lengthBars, notes, uses, open }: ItemProps) {
  const [renaming, setRenaming] = useState(false);
  const kit = kind === "kit";
  const menu = (e: React.MouseEvent) => {
    e.preventDefault();
    showMenu(e, [
      { label: "Abrir no editor", icon: kit ? <Drum /> : <Piano />, onSelect: () => openById(id) },
      { label: "Renomear", icon: <Pencil />, hint: "2× clique", onSelect: () => setRenaming(true) },
      { label: "Duplicar", icon: <Copy />, onSelect: () => useProject.getState().duplicatePattern(id) },
      "sep",
      { label: "Apagar", icon: <Trash2 />, danger: true, onSelect: () => void removeById(id) },
    ]);
  };

  return (
    <div
      className={cn(
        "group/pat cursor-grab rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.06] transition-[background-color,box-shadow,transform] duration-150 ring-inset active:scale-[0.98] active:cursor-grabbing",
        kit
          ? "hover:bg-volt-500/[0.07] hover:shadow-[0_0_24px_-10px_var(--color-volt-500)] hover:ring-volt-500/30"
          : "hover:bg-uv-500/[0.09] hover:shadow-[0_0_24px_-10px_var(--color-uv-500)] hover:ring-uv-500/35",
        open && (kit ? "bg-volt-500/[0.08] ring-volt-500/60" : "bg-uv-500/[0.1] ring-uv-500/70"),
      )}
      draggable
      onDragStart={(e) => {
        libraryDrag.patternId = id;
        e.dataTransfer.setData("application/x-bipoteca-pattern", id);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onDragEnd={() => {
        libraryDrag.patternId = null;
      }}
      onClick={() => !renaming && openById(id)}
      onContextMenu={menu}
      title="Clique: abrir · arraste para a playlist · duplo clique: renomear"
    >
      <div className="relative flex items-center gap-2.5 px-3 py-2.5">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
            kit ? "bg-volt-500/15 text-volt-400" : "bg-uv-500/20 text-uv-300",
          )}
        >
          {kit ? <Drum className="size-4" /> : <Piano className="size-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <InlineEdit
            value={name}
            onCommit={(n) => useProject.getState().renamePattern(id, n)}
            editing={renaming}
            onEditingChange={setRenaming}
            className="block text-[13px] font-semibold"
            inputClassName="text-[12px]"
          />
          <div className="mt-0.5 flex gap-2 font-mono text-[10px] text-fg-faint">
            <span>{lengthBars} comp.</span>
            <span>{notes} notas</span>
            <span className={cn(uses === 0 && "text-coral-400/80")}>{uses === 0 ? "sem uso" : `×${uses}`}</span>
          </div>
        </div>
        <div className="flex opacity-0 transition group-hover/pat:opacity-100">
          <IconButton
            label="Duplicar"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              useProject.getState().duplicatePattern(id);
            }}
          >
            <Copy />
          </IconButton>
          <IconButton
            label="Apagar"
            size="sm"
            tone="coral"
            onClick={(e) => {
              e.stopPropagation();
              void removeById(id);
            }}
          >
            <Trash2 />
          </IconButton>
        </div>
      </div>
    </div>
  );
});

/** "+" da biblioteca: escolhe a trilha que vai dar o som ao pattern novo. */
function NewPatternButton() {
  const tracks = useProject((s) => s.project.tracks);
  return (
    <Popover
      width={260}
      align="end"
      trigger={({ toggle, ref, open }) => (
        <IconButton label="Novo pattern" size="sm" tone="volt" active={open} onClick={toggle} ref={ref}>
          <Plus />
        </IconButton>
      )}
    >
      {(close) => (
        <div>
          <div className="px-2.5 pt-1.5 pb-2 text-[10px] font-semibold tracking-[0.14em] text-fg-faint uppercase">
            Novo pattern para
          </div>
          {tracks.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                const id = useProject.getState().createPattern(t.id);
                if (id) useUi.getState().openPattern(id, t.id);
                close();
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] transition",
                t.kind === "kit" ? "hover:bg-volt-500/12" : "hover:bg-uv-500/15",
              )}
            >
              {t.kind === "kit" ? (
                <Drum className="size-3.5 text-volt-400" />
              ) : (
                <Piano className="size-3.5 text-uv-300" />
              )}
              <span className="flex-1 truncate font-medium">{t.name}</span>
              <span className="text-[10px] text-fg-faint">{t.kind === "kit" ? "kit" : "instrumento"}</span>
            </button>
          ))}
          {!tracks.length && <p className="px-2.5 py-3 text-xs text-fg-faint">Crie uma trilha primeiro.</p>}
          <p className="border-t border-white/[0.06] px-2.5 pt-2 pb-1 text-[10px] leading-snug text-fg-faint">
            O pattern fica na biblioteca. Arraste para a playlist quando quiser usar.
          </p>
        </div>
      )}
    </Popover>
  );
}

export function PatternLibrary() {
  // Assinatura em texto: só muda quando algo visível na lista muda.
  const sig = useProject((s) => {
    const p = s.project;
    const uses = new Map<string, number>();
    for (const c of p.clips) uses.set(c.patternId, (uses.get(c.patternId) ?? 0) + 1);
    return p.patternOrder
      .map((id) => {
        const pat = p.patterns[id];
        return pat ? [id, pat.name, pat.kind, pat.lengthBars, pat.notes.length, uses.get(id) ?? 0].join("\u0001") : "";
      })
      .filter(Boolean)
      .join("\u0002");
  });
  const openId = useUi((s) => s.openPatternId);
  const editorOpen = useUi((s) => s.editorMode !== "closed");
  const patterns = sig
    ? sig.split("\u0002").map((row) => {
        const [id = "", name = "", kind = "instrument", len = "1", notes = "0", uses = "0"] = row.split("\u0001");
        return {
          id,
          name,
          kind: kind as Pattern["kind"],
          lengthBars: Number(len),
          notes: Number(notes),
          uses: Number(uses),
        };
      })
    : [];

  return (
    <aside
      className={cn(GLASS, "flex h-full min-h-0 flex-col overflow-hidden")}
      onPointerDown={() => useUi.getState().setZone("library")}
    >
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-white/[0.06] px-3">
        <Layers className="size-3.5 text-fg-faint" />
        <span className={LABEL}>Patterns</span>
        <span className="font-mono text-[10px] text-fg-faint">{patterns.length}</span>
        <div className="flex-1" />
        <NewPatternButton />
        <IconButton label="Esconder patterns (B)" size="sm" onClick={() => useUi.getState().toggleLibrary()}>
          <PanelLeftClose />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2 [scrollbar-color:var(--color-ink-600)_transparent] [scrollbar-width:thin]">
        {patterns.map((p) => (
          <PatternItem key={p.id} {...p} open={editorOpen && openId === p.id} />
        ))}

        {!patterns.length && (
          <p className="px-2 py-6 text-center text-xs leading-relaxed text-fg-faint">
            Nenhum pattern ainda.
            <br />
            Dê <b className="text-fg-muted">duplo clique</b> numa trilha da playlist para criar um.
          </p>
        )}
      </div>
      <div className="border-t border-white/[0.06] p-3 text-[10px] leading-relaxed text-fg-faint">
        Arraste um pattern para uma trilha do mesmo tipo. Editar um pattern muda todos os clipes dele.
      </div>
    </aside>
  );
}
