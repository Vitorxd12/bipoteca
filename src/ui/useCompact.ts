import { useSyncExternalStore } from "react";

/** Tela estreita (celular): os componentes mostram uma versão enxuta. */
const QUERY = "(max-width: 767px)";

function subscribe(cb: () => void): () => void {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export function useCompact(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

/** Tela de toque (dedo, não mouse). */
export const isCoarse = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
