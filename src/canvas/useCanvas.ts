import { useCallback, useEffect, useRef } from "react";

export interface CanvasSize {
  width: number;
  height: number;
}

/**
 * Canvas nítido em qualquer DPR, redesenhado só quando pedido (invalidate),
 * no máximo uma vez por quadro. A função de desenho é lida do ref a cada
 * quadro, então pode fechar sobre estado novo sem re-registrar nada.
 */
export function useCanvas(draw: (ctx: CanvasRenderingContext2D, size: CanvasSize) => void) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const frame = useRef<number | null>(null);
  const size = useRef<CanvasSize>({ width: 0, height: 0 });

  const render = useCallback(() => {
    frame.current = null;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.current.width, size.current.height);
    drawRef.current(ctx, size.current);
  }, []);

  const invalidate = useCallback(() => {
    if (frame.current === null) frame.current = requestAnimationFrame(render);
  }, [render]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      size.current = { width: rect.width, height: rect.height };
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      render();
    });
    ro.observe(canvas);
    return () => {
      ro.disconnect();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [render]);

  // Redesenha sempre que o componente renderiza (props/estado mudaram).
  useEffect(() => {
    invalidate();
  });

  return { canvasRef, invalidate, size };
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(0, w), Math.max(0, h), rr);
}

/** Converte coordenadas do evento para o espaço local do elemento. */
export function localPoint(e: { clientX: number; clientY: number }, el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

/** Wheel em "pixels", normalizando mouse de linha e trackpad. */
export function wheelDelta(e: WheelEvent): { dx: number; dy: number } {
  const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
  return { dx: e.deltaX * k, dy: e.deltaY * k };
}
