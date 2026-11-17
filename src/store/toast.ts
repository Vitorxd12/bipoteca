import { create } from "zustand";
import { uid } from "@/lib/utils";

export type ToastTone = "info" | "warn" | "error";

export interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, tone?: ToastTone) => void;
  dismiss: (id: string) => void;
}

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, tone = "info") => {
    // Evita empilhar a mesma mensagem várias vezes seguidas.
    if (get().toasts.some((t) => t.message === message)) return;
    const id = uid("t");
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, message, tone }] }));
    setTimeout(() => get().dismiss(id), tone === "error" ? 7000 : 3500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = (message: string, tone?: ToastTone) => useToasts.getState().push(message, tone);
