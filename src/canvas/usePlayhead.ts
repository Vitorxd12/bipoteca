import { useEffect } from "react";
import { host } from "@/audio/host";
import { useTransport } from "@/store/transport";

/**
 * Chama onFrame a cada quadro enquanto toca, e uma vez quando o cursor
 * parado muda. Usado pelas camadas de cursor (overlay) das grades.
 */
export function usePlayhead(onFrame: (tick: number, playing: boolean) => void): void {
  const playing = useTransport((s) => s.playing);
  const cursor = useTransport((s) => s.cursor);

  useEffect(() => {
    if (!playing) {
      onFrame(cursor, false);
      return;
    }
    let raf = 0;
    const loop = () => {
      onFrame(host.position(), true);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, cursor, onFrame]);
}
