/**
 * Peças básicas da moldura. Só classes Tailwind inline: estilos repetidos
 * viram constantes de string, nunca regras CSS.
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Vidro escuro: moldura (painéis, cabeçalhos, popovers). Grades ficam opacas. */
export const GLASS =
  "rounded-[18px] border border-white/[0.07] bg-gradient-to-b from-ink-700/60 via-ink-850/55 to-ink-900/60 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.07),0_20px_50px_-20px_rgb(0_0_0/0.7)] backdrop-blur-xl backdrop-saturate-150";

export const GLASS_STRONG =
  "rounded-[22px] border border-white/[0.09] bg-gradient-to-b from-ink-700/90 to-ink-900/95 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.08),0_40px_80px_-30px_rgb(0_0_0/0.9)] backdrop-blur-2xl backdrop-saturate-150";

export const LABEL = "text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-faint";

type Tone = "default" | "uv" | "volt" | "coral";

const TONES: Record<Tone, { idle: string; on: string }> = {
  default: {
    idle: "text-fg/80 hover:text-fg hover:bg-white/[0.08]",
    on: "bg-white/[0.12] text-fg",
  },
  uv: {
    idle: "text-fg/80 hover:text-uv-300 hover:bg-uv-500/15",
    on: "bg-uv-500/25 text-uv-300 shadow-[0_0_18px_-6px_var(--color-uv-500)]",
  },
  volt: {
    idle: "text-fg/80 hover:text-volt-400 hover:bg-volt-500/15",
    on: "bg-volt-500 text-ink-950 shadow-[0_0_22px_-4px_var(--color-volt-500)]",
  },
  coral: {
    idle: "text-fg-muted hover:text-coral-400 hover:bg-coral-500/10",
    on: "bg-coral-500/25 text-coral-400",
  },
};

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
  label: string;
  children: ReactNode;
}

export function IconButton({
  active,
  tone = "default",
  size = "md",
  label,
  className,
  children,
  ...rest
}: IconButtonProps) {
  const t = TONES[tone];
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl transition-all duration-150 active:scale-90 disabled:pointer-events-none disabled:opacity-30",
        size === "sm" && "h-6 w-6 rounded-lg [&_svg]:size-3.5",
        size === "md" && "h-8 w-8 [&_svg]:size-4",
        size === "lg" && "h-10 w-10 [&_svg]:size-5",
        active ? t.on : t.idle,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function TextButton({
  className,
  tone = "default",
  active,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; active?: boolean }) {
  const t = TONES[tone];
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-medium transition-all duration-150 active:scale-95 disabled:pointer-events-none disabled:opacity-30 [&_svg]:size-3.5",
        active ? t.on : cn("bg-white/[0.04] ring-1 ring-white/[0.06] ring-inset", t.idle),
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  tone = "uv",
  className,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-xl bg-black/30 p-0.5 ring-1 ring-white/[0.06] ring-inset", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-7 rounded-[10px] px-2.5 font-mono text-[11px] font-medium transition-all duration-150",
            o.value === value ? TONES[tone].on : "text-fg-faint hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-white/[0.07] px-1.5 font-mono text-[10px] text-fg-muted ring-1 ring-white/10 ring-inset">
      {children}
    </kbd>
  );
}
