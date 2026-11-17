/** Kits salvos pelo usuário, reutilizáveis entre projetos (RF-62). Ficam no navegador. */
import { get, set } from "idb-keyval";
import { create } from "zustand";
import type { KitPreset } from "@/audio/presets";
import { migratePreset } from "@/audio/samplePresets";
import { uid } from "@/lib/utils";
import type { KitRow } from "@/model/types";
import { toast } from "./toast";

const KEY = "bipoteca:kits";

interface KitsState {
  userKits: KitPreset[];
  loaded: boolean;
  load: () => Promise<void>;
  saveKit: (name: string, rows: KitRow[]) => Promise<void>;
  deleteKit: (id: string) => Promise<void>;
}

async function persist(kits: KitPreset[]): Promise<void> {
  try {
    await set(KEY, kits);
  } catch (e) {
    console.error(e);
    toast("Não foi possível salvar o kit neste navegador", "error");
  }
}

export const useKits = create<KitsState>((setState, getState) => ({
  userKits: [],
  loaded: false,
  load: async () => {
    if (getState().loaded) return;
    try {
      const kits = ((await get<KitPreset[]>(KEY)) ?? []).map((k) => ({
        ...k,
        rows: k.rows.map((r) => ({ ...r, preset: migratePreset(r.preset) })),
      }));
      setState({ userKits: kits, loaded: true });
    } catch {
      setState({ loaded: true });
    }
  },
  saveKit: async (name, rows) => {
    const kit: KitPreset = {
      id: uid("uk"),
      name: name.trim() || "Meu kit",
      description: `${rows.length} sons`,
      rows: rows.map((r) => ({ name: r.name, preset: r.preset })),
    };
    const kits = [...getState().userKits, kit];
    setState({ userKits: kits });
    await persist(kits);
    toast(`Kit "${kit.name}" salvo. Ele aparece em todos os projetos.`, "info");
  },
  deleteKit: async (id) => {
    const kits = getState().userKits.filter((k) => k.id !== id);
    setState({ userKits: kits });
    await persist(kits);
  },
}));
