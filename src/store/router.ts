/**
 * Telas do app. Cada tela tem uma responsabilidade e um endereço próprio
 * (hash), então o "voltar" do navegador e do celular funciona.
 *
 *  #/                         playlist: organizar clipes e trilhas
 *  #/patterns                 biblioteca de patterns
 *  #/pattern/<id>/<trilha>    editar um pattern (piano roll ou kit)
 *  #/som/trilha/<id>          escolher o instrumento de uma trilha
 *  #/som/linha/<trilha>/<id>  escolher os sons das linhas de um kit
 *  #/kits/nova                escolher o kit de uma trilha nova
 *  #/kits/<trilha>            trocar o kit de uma trilha
 *  #/ajuda                    gestos e atalhos
 */
import { create } from "zustand";

export type Screen =
  | { name: "playlist" }
  | { name: "patterns" }
  | { name: "pattern"; patternId: string; trackId: string }
  | { name: "sound"; trackId: string; rowId?: string }
  | { name: "kits"; trackId?: string }
  | { name: "help" };

export function toHash(s: Screen): string {
  switch (s.name) {
    case "playlist":
      return "#/";
    case "patterns":
      return "#/patterns";
    case "pattern":
      return `#/pattern/${s.patternId}/${s.trackId}`;
    case "sound":
      return s.rowId ? `#/som/linha/${s.trackId}/${s.rowId}` : `#/som/trilha/${s.trackId}`;
    case "kits":
      return s.trackId ? `#/kits/${s.trackId}` : "#/kits/nova";
    case "help":
      return "#/ajuda";
  }
}

export function fromHash(hash: string): Screen {
  const [, a, b, c, d] = hash.replace(/^#/, "").split("/");
  if (a === "patterns") return { name: "patterns" };
  if (a === "pattern" && b && c) return { name: "pattern", patternId: b, trackId: c };
  if (a === "som" && b === "trilha" && c) return { name: "sound", trackId: c };
  if (a === "som" && b === "linha" && c && d) return { name: "sound", trackId: c, rowId: d };
  if (a === "kits") return b && b !== "nova" ? { name: "kits", trackId: b } : { name: "kits" };
  if (a === "ajuda") return { name: "help" };
  return { name: "playlist" };
}

interface RouterState {
  screen: Screen;
  /** Quantas telas o app empilhou (para saber se "voltar" fica dentro do app). */
  depth: number;
  go: (s: Screen, opts?: { replace?: boolean }) => void;
  back: (fallback?: Screen) => void;
}

export const useRouter = create<RouterState>((set, get) => ({
  screen: fromHash(typeof location === "undefined" ? "" : location.hash),
  depth: 0,
  go: (screen, opts) => {
    const hash = toHash(screen);
    if (hash === toHash(get().screen)) return;
    if (opts?.replace) history.replaceState(null, "", hash);
    else {
      history.pushState(null, "", hash);
      set((st) => ({ depth: st.depth + 1 }));
    }
    set({ screen });
  },
  back: (fallback = { name: "playlist" }) => {
    if (get().depth > 0) {
      set((st) => ({ depth: st.depth - 1 }));
      history.back();
    } else get().go(fallback, { replace: true });
  },
}));

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    useRouter.setState({ screen: fromHash(location.hash) });
  });
}

export const go = (s: Screen, opts?: { replace?: boolean }) => useRouter.getState().go(s, opts);
export const back = (fallback?: Screen) => useRouter.getState().back(fallback);
