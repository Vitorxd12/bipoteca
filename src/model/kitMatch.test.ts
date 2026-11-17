import { describe, expect, it } from "vitest";
import { matchKitRows } from "./kitMatch";
import type { KitRow } from "./types";

const row = (id: string, name: string, preset: string, note: number): KitRow => ({
  id,
  name,
  preset: { engine: "samples", preset },
  note,
  volume: 0.8,
  muted: false,
});
const lm2: KitRow[] = [
  row("a", "Bumbo", "dm:lm2:kick", 36),
  row("b", "Caixa", "dm:lm2:snare-m", 37),
  row("c", "Chimbal fechado", "dm:lm2:hhclosed", 38),
  row("d", "Chimbal aberto", "dm:lm2:hhopen", 39),
  row("e", "Palma", "dm:lm2:clap", 40),
  row("f", "Tom", "dm:lm2:tom-m", 41),
];
const r = (name: string, preset: string) => ({ name, preset: { engine: "samples", preset } });

describe("trocar de kit (casamento por papel)", () => {
  it("chimbal continua chimbal mesmo com ordem diferente", () => {
    const rz1 = [
      r("Bumbo", "dm:rz1:kick"),
      r("Caixa", "dm:rz1:snare"),
      r("Palma", "dm:rz1:clap"),
      r("Chimbal fechado", "dm:rz1:hihat-closed"),
      r("Chimbal aberto", "dm:rz1:hihat-open"),
      r("Tom médio", "dm:rz1:tom-2"),
    ];
    const { pairs, lost } = matchKitRows(lm2, rz1);
    expect(pairs.map((p) => p?.id)).toEqual(["a", "b", "e", "c", "d", "f"]);
    expect(lost).toEqual([]);
  });
  it("sinônimos casam (hihat, kick)", () => {
    const { pairs } = matchKitRows(lm2, [
      r("Kick", "dm:tr808:kick/bd2550"),
      r("Hihat closed", "dm:tr808:hihat-close/ch"),
    ]);
    expect(pairs.map((p) => p?.id)).toEqual(["a", "c"]);
  });
  it("linhas sem equivalente são listadas como perdidas", () => {
    const { lost } = matchKitRows(lm2, [r("Bumbo", "dm:tr808:kick/bd2550")]);
    expect(lost.map((l) => l.name)).toEqual(["Caixa", "Chimbal fechado", "Chimbal aberto", "Palma", "Tom"]);
  });
});
