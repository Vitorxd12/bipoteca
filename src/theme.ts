/**
 * Cores para o canvas (que não lê classes Tailwind). Espelham os tokens do
 * @theme em styles.css.
 */
export const C = {
  ink950: "#08070d",
  ink900: "#0e0c16",
  ink850: "#13101d",
  ink800: "#191525",
  ink700: "#241f33",
  ink600: "#322b46",
  ink500: "#4a4263",
  fg: "#f4f1ff",
  fgMuted: "#a8a0c2",
  fgFaint: "#6e6787",
  uv300: "#c4b5ff",
  uv400: "#a891ff",
  uv500: "#8b6cff",
  uv600: "#6b4cf0",
  uv700: "#4b31b8",
  volt300: "#e2ff8a",
  volt400: "#d4ff5c",
  volt500: "#c8ff3d",
  volt600: "#a3d81c",
  volt700: "#6c9208",
  coral400: "#ff7a90",
  coral500: "#ff4f6d",
} as const;

export const FONT_SANS = '"Geist Variable", ui-sans-serif, system-ui, sans-serif';
export const FONT_MONO = '"Geist Mono Variable", ui-monospace, monospace';

/** Cor da trilha por tipo: ultravioleta para instrumento, volt para kit. */
export function kindColor(kind: "instrument" | "kit"): { base: string; bright: string; deep: string } {
  return kind === "kit"
    ? { base: C.volt500, bright: C.volt300, deep: C.volt700 }
    : { base: C.uv500, bright: C.uv300, deep: C.uv700 };
}

export function alpha(hex: string, a: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
