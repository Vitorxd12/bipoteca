/**
 * Dropdown de encaixe (ímã). Cada opção mostra uma mini régua com a densidade
 * da divisão, para ver o tamanho do passo antes de escolher.
 */
import { Check, ChevronDown, Magnet } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover } from "./Popover";
import { Kbd } from "./primitives";

export interface SnapOption<T extends string> {
  value: T;
  label: string;
  hint: string;
  /** Divisões por compasso desenhadas na mini régua (0 = sem encaixe). */
  perBar: number;
}

function MiniRuler({ perBar, accent }: { perBar: number; accent: string }) {
  const w = 64;
  return (
    <svg width={w} height={14} viewBox={`0 0 ${w} 14`} aria-hidden="true" className="shrink-0">
      <rect x={0} y={6} width={w} height={2} rx={1} className="fill-white/10" />
      {perBar === 0 ? (
        <path d={`M2 7 Q ${w / 4} 0 ${w / 2} 7 T ${w - 2} 7`} className={cn("fill-none stroke-[1.5]", accent)} />
      ) : (
        Array.from({ length: perBar * 2 + 1 }, (_, i) => {
          const x = 1 + (i * (w - 2)) / (perBar * 2);
          const bar = i % perBar === 0;
          return (
            <rect
              key={`m${x.toFixed(2)}`}
              x={x - 0.75}
              y={bar ? 1 : 4}
              width={1.5}
              height={bar ? 12 : 6}
              rx={0.75}
              className={bar ? "fill-white/70" : accent.replace("stroke", "fill")}
            />
          );
        })
      )}
    </svg>
  );
}

export function SnapMenu<T extends string>({
  value,
  options,
  onChange,
  tone = "uv",
}: {
  value: T;
  options: SnapOption<T>[];
  onChange: (v: T) => void;
  tone?: "uv" | "volt";
}) {
  const current = options.find((o) => o.value === value) ?? options[0];
  const accent = tone === "volt" ? "stroke-volt-500" : "stroke-uv-400";
  const off = current?.perBar === 0;
  return (
    <Popover
      width={300}
      align="end"
      trigger={({ open, toggle, ref }) => (
        <button
          ref={ref}
          type="button"
          onClick={toggle}
          title="Encaixe na grade"
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-xl pr-2 pl-2.5 text-[11px] font-medium ring-1 transition ring-inset",
            open ? "bg-white/[0.1] ring-white/15" : "bg-black/30 ring-white/[0.07] hover:bg-white/[0.06]",
          )}
        >
          <Magnet
            className={cn("size-3.5", off ? "text-fg-faint" : tone === "volt" ? "text-volt-400" : "text-uv-300")}
          />
          <span className="font-mono text-fg">{current?.label}</span>
          <ChevronDown className={cn("size-3.5 text-fg-faint transition", open && "rotate-180")} />
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="px-2.5 pt-1.5 pb-2 text-[10px] font-semibold tracking-[0.14em] text-fg-faint uppercase">
            Encaixe na grade
          </div>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                close();
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition",
                o.value === value ? "bg-white/[0.08]" : "hover:bg-white/[0.05]",
              )}
            >
              <MiniRuler perBar={o.perBar} accent={accent} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-fg">{o.label}</span>
                <span className="block text-[11px] text-fg-faint">{o.hint}</span>
              </span>
              {o.value === value && (
                <Check className={cn("size-4", tone === "volt" ? "text-volt-400" : "text-uv-300")} />
              )}
            </button>
          ))}
          <div className="mt-1 flex items-center gap-1.5 border-t border-white/[0.06] px-2.5 pt-2 pb-1 text-[11px] text-fg-faint">
            Segure <Kbd>Alt</Kbd> durante o arraste para soltar livre
          </div>
        </div>
      )}
    </Popover>
  );
}
