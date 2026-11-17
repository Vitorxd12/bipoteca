import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Texto que vira campo com duplo clique (renomear). Enter confirma, Esc
 * cancela, clicar fora confirma.
 */
export function InlineEdit({
  value,
  onCommit,
  className,
  inputClassName,
  editing: editingProp,
  onEditingChange,
  title = "Duplo clique para renomear",
}: {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
  inputClassName?: string;
  editing?: boolean;
  onEditingChange?: (e: boolean) => void;
  title?: string;
}) {
  const [editingState, setEditingState] = useState(false);
  const editing = editingProp ?? editingState;
  const setEditing = (e: boolean) => {
    setEditingState(e);
    onEditingChange?.(e);
  };
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      requestAnimationFrame(() => ref.current?.select());
    }
  }, [editing, value]);

  if (!editing) {
    return (
      <span
        className={cn("truncate", className)}
        title={title}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
      >
        {value}
      </span>
    );
  }
  return (
    <input
      ref={ref}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft.trim() && draft !== value) onCommit(draft.trim());
        setEditing(false);
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        "w-full min-w-0 rounded-md bg-black/40 px-1.5 py-0.5 outline-none ring-1 ring-uv-500/70",
        inputClassName,
      )}
    />
  );
}
