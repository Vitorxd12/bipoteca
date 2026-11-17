/** Popover ancorado num botão. Fecha com clique fora, Esc ou rolagem da página. */
import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { GLASS_STRONG } from "./primitives";

export function Popover({
  trigger,
  children,
  align = "start",
  width = 280,
  className,
  open: openProp,
  onOpenChange,
}: {
  trigger: (props: { open: boolean; toggle: () => void; ref: React.RefObject<HTMLButtonElement | null> }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "start" | "end";
  width?: number;
  className?: string;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (o: boolean) => {
    setOpenState(o);
    onOpenChange?.(o);
  };
  const anchor = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!open || !anchor.current) return;
    const r = anchor.current.getBoundingClientRect();
    const left = align === "end" ? r.right - width : r.left;
    setPos({ left: Math.max(8, Math.min(window.innerWidth - width - 8, left)), top: r.bottom + 8 });
  }, [open, align, width]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: setOpen é estável o bastante aqui
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panel.current?.contains(t) || anchor.current?.contains(t)) return;
      setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("keydown", key, true);
    };
  }, [open]);

  return (
    <>
      {trigger({ open, toggle: () => setOpen(!open), ref: anchor })}
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={panel}
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 520, damping: 34 }}
              style={{ left: pos.left, top: pos.top, width }}
              className={cn(GLASS_STRONG, "fixed z-[65] origin-top rounded-2xl p-1.5", className)}
              onContextMenu={(e) => e.preventDefault()}
            >
              {children(() => setOpen(false))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
