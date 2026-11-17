/**
 * Biblioteca de patterns (T5). Gestos:
 *  clicar ............. abre no editor
 *  arrastar ........... solta na playlist (só em trilha do mesmo tipo)
 *  duplo clique ....... renomeia
 *  botão direito ...... duplicar / apagar
 */
import { Copy, Drum, Layers, Pencil, Piano, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import SpotlightCard from "@/components/SpotlightCard";
import { cn } from "@/lib/utils";
import type { Pattern } from "@/model/types";
import { libraryDrag } from "@/playlist/view";
import { getProject, useProject } from "@/store/project";
import { useUi } from "@/store/ui";
import { InlineEdit } from "@/ui/InlineEdit";
import { showMenu } from "@/ui/overlays";
import { GLASS, IconButton, LABEL } from "@/ui/primitives";

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

function PatternItem({ p, uses, open }: { p: Pattern; uses: number; open: boolean }) {
  const [renaming, setRenaming] = useState(false);
  const kit = p.kind === "kit";
  const menu = (e: React.MouseEvent) => {
    e.preventDefault();
    showMenu(e, [
      { label: "Abrir no editor", icon: kit ? <Drum /> : <Piano />, onSelect: () => openInEditor(p) },
      { label: "Renomear", icon: <Pencil />, hint: "2× clique", onSelect: () => setRenaming(true) },
      { label: "Duplicar", icon: <Copy />, onSelect: () => useProject.getState().duplicatePattern(p.id) },
      "sep",
      { label: "Apagar", icon: <Trash2 />, danger: true, onSelect: () => void removePattern(p) },
    ]);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 500, damping: 36 }}
    >
      <SpotlightCard
        spotlightColor={kit ? "rgba(200, 255, 61, 0.22)" : "rgba(139, 108, 255, 0.28)"}
        spotlightSize={160}
        borderGlow={0.8}
        className={cn(
          "group/pat cursor-grab rounded-2xl active:cursor-grabbing",
          open && "ring-1 ring-inset",
          open && (kit ? "ring-volt-500/60" : "ring-uv-500/70"),
        )}
        style={{ padding: 0 }}
        draggable
        onDragStart={(e) => {
          libraryDrag.patternId = p.id;
          e.dataTransfer.setData("application/x-bipoteca-pattern", p.id);
          e.dataTransfer.effectAllowed = "copy";
        }}
        onDragEnd={() => {
          libraryDrag.patternId = null;
        }}
        onClick={() => !renaming && openInEditor(p)}
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
              value={p.name}
              onCommit={(name) => useProject.getState().renamePattern(p.id, name)}
              editing={renaming}
              onEditingChange={setRenaming}
              className="block text-[13px] font-semibold"
              inputClassName="text-[12px]"
            />
            <div className="mt-0.5 flex gap-2 font-mono text-[10px] text-fg-faint">
              <span>{p.lengthBars} comp.</span>
              <span>{p.notes.length} notas</span>
              <span className={cn(uses === 0 && "text-coral-400/80")}>{uses === 0 ? "sem uso" : `×${uses}`}</span>
            </div>
          </div>
          <div className="flex opacity-0 transition group-hover/pat:opacity-100">
            <IconButton
              label="Duplicar"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                useProject.getState().duplicatePattern(p.id);
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
                void removePattern(p);
              }}
            >
              <Trash2 />
            </IconButton>
          </div>
        </div>
      </SpotlightCard>
    </motion.div>
  );
}

export function PatternLibrary() {
  const project = useProject((s) => s.project);
  const openId = useUi((s) => s.openPatternId);
  const editorOpen = useUi((s) => s.editorMode !== "closed");
  const uses = new Map<string, number>();
  for (const c of project.clips) uses.set(c.patternId, (uses.get(c.patternId) ?? 0) + 1);
  const patterns = project.patternOrder.map((id) => project.patterns[id]).filter((p): p is Pattern => !!p);

  return (
    <aside
      className={cn(GLASS, "flex h-full min-h-0 flex-col overflow-hidden")}
      onPointerDown={() => useUi.getState().setZone("library")}
    >
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-white/[0.06] px-3">
        <Layers className="size-3.5 text-fg-faint" />
        <span className={LABEL}>Patterns</span>
        <span className="font-mono text-[10px] text-fg-faint">{patterns.length}</span>
      </div>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2 [scrollbar-color:var(--color-ink-600)_transparent] [scrollbar-width:thin]">
        <AnimatePresence initial={false}>
          {patterns.map((p) => (
            <PatternItem key={p.id} p={p} uses={uses.get(p.id) ?? 0} open={editorOpen && openId === p.id} />
          ))}
        </AnimatePresence>
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
