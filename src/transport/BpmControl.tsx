/**
 * BPM (RF-08). Gestos:
 *  arrastar para cima/baixo ... muda (Shift: fino, 0.1)
 *  roda ....................... ±1 (Shift: ±0.1)
 *  duplo clique ............... digitar o valor
 *  setas (com foco) ........... ±1
 */
import { useEffect, useRef, useState } from "react";
import Counter from "@/components/Counter";
import { beginGesture, endGesture, useProject } from "@/store/project";

export function BpmControl() {
  const bpm = useProject((s) => s.project.bpm);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(bpm));
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y0: number; v0: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cur = useProject.getState().project.bpm;
      const step = e.shiftKey ? 0.1 : 1;
      useProject.getState().setBpm(cur + (e.deltaY < 0 ? step : -step));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={() => {
          const v = Number(draft.replace(",", "."));
          if (Number.isFinite(v)) useProject.getState().setBpm(v);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setEditing(false);
        }}
        className="h-10 w-[92px] rounded-xl bg-black/40 text-center font-mono text-lg font-semibold outline-none ring-1 ring-uv-500"
      />
    );
  }

  const fine = bpm % 1 !== 0;
  return (
    <div
      ref={ref}
      role="spinbutton"
      tabIndex={0}
      aria-label="BPM"
      aria-valuenow={bpm}
      title="BPM · arraste ↕ ou use a roda (Shift: fino) · duplo clique para digitar"
      className="group flex h-10 cursor-ns-resize touch-none items-center gap-1.5 rounded-xl bg-black/55 px-3 max-md:px-2 ring-1 ring-white/[0.08] transition ring-inset hover:ring-uv-500/40"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { y0: e.clientY, v0: bpm };
        beginGesture();
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const k = e.shiftKey ? 0.05 : 0.4;
        const v = d.v0 + (d.y0 - e.clientY) * k;
        useProject.getState().setBpm(e.shiftKey ? Math.round(v * 10) / 10 : Math.round(v));
      }}
      onPointerUp={() => {
        drag.current = null;
        endGesture();
      }}
      onDoubleClick={() => {
        setDraft(String(bpm));
        setEditing(true);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp") useProject.getState().setBpm(bpm + 1);
        if (e.key === "ArrowDown") useProject.getState().setBpm(bpm - 1);
        if (e.key === "Enter") setEditing(true);
      }}
    >
      <Counter
        value={bpm}
        decimals={fine ? 1 : 0}
        fontSize={18}
        fontWeight={600}
        textColor="var(--color-fg)"
        duration={0.35}
        className="font-mono"
      />
      <span className="font-mono text-[10px] font-medium tracking-wider text-fg-muted group-hover:text-uv-300 max-md:hidden">
        BPM
      </span>
    </div>
  );
}
