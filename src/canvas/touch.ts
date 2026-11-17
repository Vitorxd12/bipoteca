/**
 * Gestos de toque compartilhados pelas grades (playlist, piano roll, kit).
 *  - pinça com dois dedos: zoom horizontal no centro + rolagem
 *  - um dedo arrastando no vazio: rola (quem decide é a grade)
 *  - toque longo parado: abre menu (onLongPress)
 */
export interface PinchStep {
  /** Centro dos dedos, em px locais. */
  cx: number;
  cy: number;
  /** Fator de zoom desde o último passo (>1 aproxima). */
  scale: number;
  /** Quanto o centro andou desde o último passo, em px. */
  dx: number;
  dy: number;
}

export class TouchTracker {
  private pts = new Map<number, { x: number; y: number }>();
  private last: { cx: number; cy: number; dist: number } | null = null;

  get count(): number {
    return this.pts.size;
  }

  down(id: number, x: number, y: number): void {
    this.pts.set(id, { x, y });
    this.last = this.snapshot();
  }

  /** Atualiza um dedo; com dois ou mais, devolve o passo da pinça. */
  move(id: number, x: number, y: number): PinchStep | null {
    if (!this.pts.has(id)) return null;
    this.pts.set(id, { x, y });
    if (this.pts.size < 2) return null;
    const now = this.snapshot();
    const prev = this.last;
    this.last = now;
    if (!now || !prev) return null;
    return {
      cx: now.cx,
      cy: now.cy,
      scale: prev.dist > 0 ? now.dist / prev.dist : 1,
      dx: now.cx - prev.cx,
      dy: now.cy - prev.cy,
    };
  }

  up(id: number): void {
    this.pts.delete(id);
    this.last = this.snapshot();
  }

  private snapshot(): { cx: number; cy: number; dist: number } | null {
    const p = [...this.pts.values()];
    if (p.length < 2) return null;
    const [a, b] = p as [{ x: number; y: number }, { x: number; y: number }];
    return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, dist: Math.hypot(a.x - b.x, a.y - b.y) };
  }
}

/** Toque longo: chama `fire` se o dedo ficar parado `ms` milissegundos. */
export class LongPress {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private x0 = 0;
  private y0 = 0;

  start(x: number, y: number, fire: () => void, ms = 480): void {
    this.cancel();
    this.x0 = x;
    this.y0 = y;
    this.timer = setTimeout(() => {
      this.timer = null;
      fire();
    }, ms);
  }

  /** Cancela se o dedo andou mais que alguns pixels. */
  move(x: number, y: number): void {
    if (this.timer && Math.hypot(x - this.x0, y - this.y0) > 8) this.cancel();
  }

  cancel(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
