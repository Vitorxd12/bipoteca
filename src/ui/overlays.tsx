/** Menu de contexto, diálogo de confirmação e avisos (toasts). */
import { AlertTriangle, Info, X, XCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useEffect, useRef } from "react";
import { create } from "zustand";
import { cn } from "@/lib/utils";
import { useToasts } from "@/store/toast";
import { useUi } from "@/store/ui";
import { GLASS_STRONG, Kbd } from "./primitives";

// ------------------------------------------------------------ menu de contexto

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

interface MenuState {
  x: number;
  y: number;
  items: (MenuItem | "sep")[];
  open: boolean;
  show: (x: number, y: number, items: (MenuItem | "sep")[]) => void;
  hide: () => void;
}

export const useContextMenu = create<MenuState>((set) => ({
  x: 0,
  y: 0,
  items: [],
  open: false,
  show: (x, y, items) => set({ x, y, items, open: true }),
  hide: () => set({ open: false }),
}));

export const showMenu = (e: { clientX: number; clientY: number }, items: (MenuItem | "sep")[]) =>
  useContextMenu.getState().show(e.clientX, e.clientY, items);

export function ContextMenu() {
  const { x, y, items, open, hide } = useContextMenu();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return;
      hide();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && hide();
    window.addEventListener("pointerdown", close, true);
    window.addEventListener("wheel", hide, { passive: true });
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", close, true);
      window.removeEventListener("wheel", hide);
      window.removeEventListener("keydown", esc);
    };
  }, [open, hide]);

  const left = Math.min(x, window.innerWidth - 230);
  const top = Math.min(y, window.innerHeight - items.length * 34 - 16);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, scale: 0.94, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.12 }}
          style={{ left, top }}
          className={cn(GLASS_STRONG, "fixed z-[60] min-w-52 origin-top-left rounded-2xl p-1.5")}
          onContextMenu={(e) => e.preventDefault()}
        >
          {items.map((it, i) =>
            it === "sep" ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: separadores não têm identidade
              <div key={`sep-${i}`} className="mx-2 my-1 h-px bg-white/[0.07]" />
            ) : (
              <button
                key={it.label}
                type="button"
                disabled={it.disabled}
                onClick={() => {
                  hide();
                  it.onSelect();
                }}
                className={cn(
                  "flex h-8 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-[13px] transition-colors disabled:opacity-30 [&_svg]:size-3.5",
                  it.danger ? "text-coral-400 hover:bg-coral-500/15" : "text-fg hover:bg-uv-500/20",
                )}
              >
                <span className="flex w-4 justify-center text-fg-muted">{it.icon}</span>
                <span className="flex-1">{it.label}</span>
                {it.hint && <span className="font-mono text-[10px] text-fg-faint">{it.hint}</span>}
              </button>
            ),
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ----------------------------------------------------------------- confirmação

export function ConfirmDialog() {
  const confirm = useUi((s) => s.confirm);
  const resolve = useUi((s) => s.resolveConfirm);

  useEffect(() => {
    if (!confirm) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") resolve(false);
      if (e.key === "Enter") resolve(true);
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [confirm, resolve]);

  return (
    <AnimatePresence>
      {confirm && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-ink-950/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onPointerDown={(e) => e.target === e.currentTarget && resolve(false)}
        >
          <motion.div
            initial={{ scale: 0.92, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            className={cn(GLASS_STRONG, "w-[380px] p-6")}
          >
            <div className="mb-1 flex items-center gap-2 font-display text-[15px] font-semibold">
              <AlertTriangle className="size-4 text-coral-400" />
              {confirm.title}
            </div>
            <p className="mb-6 text-sm leading-relaxed text-fg-muted">{confirm.message}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => resolve(false)}
                className="h-9 rounded-xl px-4 text-sm text-fg-muted ring-1 ring-white/10 transition hover:bg-white/5 hover:text-fg"
              >
                Cancelar <Kbd>Esc</Kbd>
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => resolve(true)}
                className="h-9 rounded-xl bg-coral-500 px-4 text-sm font-semibold text-ink-950 shadow-[0_0_24px_-6px_var(--color-coral-500)] transition hover:brightness-110 active:scale-95"
              >
                {confirm.confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------- toasts

export function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[80] flex w-[360px] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            className={cn(
              GLASS_STRONG,
              "pointer-events-auto flex items-start gap-3 rounded-2xl p-3.5 text-[13px] leading-snug",
              t.tone === "error" && "ring-1 ring-coral-500/50",
              t.tone === "warn" && "ring-1 ring-volt-500/40",
            )}
          >
            {t.tone === "error" ? (
              <XCircle className="mt-0.5 size-4 shrink-0 text-coral-400" />
            ) : t.tone === "warn" ? (
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-volt-400" />
            ) : (
              <Info className="mt-0.5 size-4 shrink-0 text-uv-400" />
            )}
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="text-fg-faint hover:text-fg"
              aria-label="Fechar aviso"
            >
              <X className="size-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
