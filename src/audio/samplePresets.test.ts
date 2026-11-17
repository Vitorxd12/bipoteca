import { describe, expect, it } from "vitest";
import { migratePreset } from "./samplePresets";

const ref = (preset: string) => ({ engine: "samples", preset });

describe("migração das máquinas removidas para a TR-808", () => {
  it("leva cada som ao equivalente", () => {
    expect(migratePreset(ref("dm:lm2:kick")).preset).toBe("dm:tr808:kick/bd2550");
    expect(migratePreset(ref("dm:lm2:hhopen")).preset).toBe("dm:tr808:hihat-open/oh25");
    expect(migratePreset(ref("dm:rz1:tom-3")).preset).toBe("dm:tr808:tom-low/lt50");
    expect(migratePreset(ref("dm:cr8000:conga-high")).preset).toBe("dm:tr808:conga-hi/hc50");
    expect(migratePreset(ref("dm:lm2:cabasa")).preset).toBe("dm:tr808:maraca/ma");
  });
  it("não mexe no que continua existindo", () => {
    expect(migratePreset(ref("dm:tr808:clap/cp")).preset).toBe("dm:tr808:clap/cp");
    expect(migratePreset({ engine: "plaits", preset: "bass-sub" }).preset).toBe("bass-sub");
  });
});
