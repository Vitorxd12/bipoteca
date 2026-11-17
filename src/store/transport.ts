import { create } from "zustand";

export type PlayMode = "song" | "pattern";

export interface VoiceDrop {
  /** Quantas vozes faltaram no último estouro. */
  missing: number;
  /** Carimbo para reanimar o aviso a cada estouro. */
  at: number;
}

interface TransportState {
  playing: boolean;
  mode: PlayMode;
  metronome: boolean;
  /** Posição de partida quando parado (ticks). Durante a reprodução, use host.position(). */
  cursor: number;
  voiceDrops: Record<string, VoiceDrop>;
  audioReady: boolean;

  setPlaying: (p: boolean) => void;
  setMode: (m: PlayMode) => void;
  toggleMetronome: () => void;
  setCursor: (t: number) => void;
  reportDrop: (trackId: string, missing: number) => void;
  clearDrops: () => void;
  setAudioReady: () => void;
}

export const useTransport = create<TransportState>((set) => ({
  playing: false,
  mode: "song",
  metronome: false,
  cursor: 0,
  voiceDrops: {},
  audioReady: false,

  setPlaying: (playing) => set({ playing }),
  setMode: (mode) => set({ mode }),
  toggleMetronome: () => set((s) => ({ metronome: !s.metronome })),
  setCursor: (cursor) => set({ cursor: Math.max(0, cursor) }),
  reportDrop: (trackId, missing) =>
    set((s) => {
      const prev = s.voiceDrops[trackId];
      return {
        voiceDrops: {
          ...s.voiceDrops,
          [trackId]: {
            // Cortes no mesmo instante (um acorde grande) somam num aviso só.
            missing: missing + (prev && performance.now() - prev.at < 120 ? prev.missing : 0),
            at: performance.now(),
          },
        },
      };
    }),
  clearDrops: () => set({ voiceDrops: {} }),
  setAudioReady: () => set({ audioReady: true }),
}));
