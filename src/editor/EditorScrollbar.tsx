/** Barra de rolagem horizontal do editor, sobreposta ao pé da grade. */
import { useEffect, useRef, useState } from "react";
import { clamp } from "@/lib/utils";
import { TICKS_PER_BAR } from "@/model/types";
import { HScrollbar } from "@/ui/HScrollbar";
import { EDITOR_PPT, fitPattern, useEditorView, useOpenPattern } from "./view";

export function EditorScrollbar({ tone }: { tone: "uv" | "volt" }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  const { scrollX, pxPerTick } = useEditorView();
  const pattern = useOpenPattern();
  useEffect(() => {
    const el = box.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (!pattern) return null;
  return (
    <div ref={box} className="pointer-events-none absolute right-3 bottom-2 left-3 z-10">
      <HScrollbar
        className="pointer-events-auto"
        tone={tone}
        start={scrollX}
        visible={w / pxPerTick}
        total={(pattern.lengthBars + 1) * TICKS_PER_BAR}
        onScroll={(x) => useEditorView.getState().set({ scrollX: x })}
        onRange={(x, vis) =>
          useEditorView.getState().set({ pxPerTick: clamp(w / vis, EDITOR_PPT.min, EDITOR_PPT.max), scrollX: x })
        }
        onFit={() => fitPattern(w)}
      />
    </div>
  );
}
