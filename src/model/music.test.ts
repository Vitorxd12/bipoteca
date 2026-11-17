import { describe, expect, it } from "vitest";
import { findOverflowNotes, formatPosition, isBlackKey, noteName, snapDown, snapRound, snapTicks } from "./music";
import { type Note, PPQ, TICKS_PER_BAR } from "./types";

const n = (id: string, start: number, duration: number, pitch = 60): Note => ({
  id,
  pitch,
  start,
  duration,
  velocity: 0.8,
});

describe("nomes e teclas", () => {
  it("C4 é o dó central (60)", () => {
    expect(noteName(60)).toBe("C4");
    expect(noteName(61)).toBe("C#4");
    expect(noteName(12)).toBe("C0");
    expect(noteName(108)).toBe("C8");
  });
  it("identifica teclas pretas", () => {
    expect([60, 61, 62, 63, 64, 65, 66].map(isBlackKey)).toEqual([false, true, false, true, false, false, true]);
  });
});

describe("tempo", () => {
  it("formata compasso.tempo.semicolcheia a partir de 1", () => {
    expect(formatPosition(0)).toBe("1.1.1");
    expect(formatPosition(TICKS_PER_BAR + PPQ + PPQ / 4)).toBe("2.2.2");
  });
  it("encaixe", () => {
    expect(snapTicks("1/16")).toBe(PPQ / 4);
    expect(snapTicks("1/4")).toBe(PPQ);
    expect(snapDown(50, 24)).toBe(48);
    expect(snapRound(37, 24)).toBe(48);
  });
});

describe("polifonia (RF-69)", () => {
  it("não marca nada dentro do limite", () => {
    const notes = Array.from({ length: 4 }, (_, i) => n(`a${i}`, 0, 96, 60 + i));
    expect(findOverflowNotes(notes, 4).size).toBe(0);
  });
  it("marca as mais antigas quando o acorde passa do limite", () => {
    const notes = Array.from({ length: 6 }, (_, i) => n(`a${i}`, 0, 96, 60 + i));
    expect(findOverflowNotes(notes, 4).size).toBe(2);
  });
  it("notas que já terminaram liberam voz", () => {
    const notes = [n("a", 0, 48), n("b", 0, 48, 62), n("c", 48, 48, 64), n("d", 48, 48, 65)];
    expect(findOverflowNotes(notes, 2).size).toBe(0);
  });
});
