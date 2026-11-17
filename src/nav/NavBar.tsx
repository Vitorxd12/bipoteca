/**
 * Navegação entre as telas principais. No celular é a barra de abas de baixo;
 * no desktop fica dentro da barra de cima.
 */
import { CircleHelp, Drum, Layers, ListMusic, Piano } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProject } from "@/store/project";
import { go, type Screen, useRouter } from "@/store/router";
import { useUi } from "@/store/ui";

export function NavBar({ variant }: { variant: "bottom" | "inline" }) {
  const screen = useRouter((s) => s.screen);
  const openPatternId = useUi((s) => s.openPatternId);
  const editorTrackId = useUi((s) => s.editorTrackId);
  const pattern = useProject((s) => (openPatternId ? s.project.patterns[openPatternId] : undefined));
  const kit = pattern?.kind === "kit";

  const items: { id: Screen["name"]; label: string; icon: React.ReactNode; to?: Screen; disabled?: boolean }[] = [
    { id: "playlist", label: "Playlist", icon: <ListMusic />, to: { name: "playlist" } },
    { id: "patterns", label: "Patterns", icon: <Layers />, to: { name: "patterns" } },
    {
      id: "pattern",
      label: pattern ? pattern.name : "Editor",
      icon: kit ? <Drum /> : <Piano />,
      to: pattern
        ? { name: "pattern", patternId: pattern.id, trackId: editorTrackId ?? pattern.homeTrackId }
        : undefined,
      disabled: !pattern,
    },
    { id: "help", label: "Ajuda", icon: <CircleHelp />, to: { name: "help" } },
  ];

  if (variant === "inline") {
    return (
      <nav className="flex items-center gap-0.5 rounded-xl bg-black/30 p-0.5 ring-1 ring-white/[0.07] ring-inset">
        {items.map((it) => {
          const on = screen.name === it.id;
          return (
            <button
              key={it.id}
              type="button"
              disabled={it.disabled}
              title={it.disabled ? "Abra um pattern para editar" : it.label}
              onClick={() => it.to && go(it.to)}
              className={cn(
                "flex h-8 max-w-40 items-center gap-1.5 rounded-[10px] px-2.5 text-[12px] font-medium transition disabled:opacity-30 [&_svg]:size-3.5 [&_svg]:shrink-0",
                on
                  ? it.id === "pattern" && kit
                    ? "bg-volt-500 text-ink-950"
                    : "bg-uv-500 text-ink-950"
                  : "text-fg-muted hover:bg-white/[0.06] hover:text-fg",
              )}
            >
              {it.icon}
              <span className={cn("truncate", it.id === "help" && "sr-only")}>{it.label}</span>
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="grid grid-cols-4 gap-1 rounded-2xl bg-ink-900/90 p-1 ring-1 ring-white/[0.07] backdrop-blur-xl ring-inset">
      {items.map((it) => {
        const on = screen.name === it.id;
        return (
          <button
            key={it.id}
            type="button"
            disabled={it.disabled}
            onClick={() => it.to && go(it.to)}
            className={cn(
              "flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition disabled:opacity-30 [&_svg]:size-5",
              on
                ? it.id === "pattern" && kit
                  ? "bg-volt-500 text-ink-950"
                  : "bg-uv-500 text-ink-950"
                : "text-fg-muted active:bg-white/10",
            )}
          >
            {it.icon}
            <span className="w-full truncate px-1 text-center">{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
