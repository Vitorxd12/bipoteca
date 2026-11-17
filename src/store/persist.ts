/** Salvamento automático no navegador (RF-02) com aviso de falha (RF-68). */
import { get, set } from "idb-keyval";
import { migratePreset } from "@/audio/samplePresets";
import { demoProject } from "@/model/demo";
import type { Project } from "@/model/types";
import { useProject } from "./project";
import { toast } from "./toast";

const KEY = "bipoteca:project:current";

export async function loadProject(): Promise<void> {
  let project: Project | undefined;
  try {
    project = await get<Project>(KEY);
  } catch (e) {
    console.error(e);
    toast("Não foi possível ler o projeto salvo neste navegador", "error");
  }
  useProject.getState().replaceProject(project ? migrateProject(project) : demoProject());
  useProject.temporal.getState().clear();
  startAutosave();
}

/** Projetos salvos antes de uma mudança de catálogo continuam tocando. */
function migrateProject(p: Project): Project {
  return {
    ...p,
    tracks: p.tracks.map((t) => ({
      ...t,
      preset: t.preset ? migratePreset(t.preset) : t.preset,
      kit: t.kit.map((r) => ({ ...r, preset: migratePreset(r.preset) })),
    })),
  };
}

let timer: ReturnType<typeof setTimeout> | null = null;
let failing = false;

function startAutosave(): void {
  useProject.subscribe((s, prev) => {
    if (s.project === prev.project) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void save(s.project), 600);
  });
  window.addEventListener("beforeunload", () => {
    if (timer) void save(useProject.getState().project);
  });
}

async function save(project: Project): Promise<void> {
  try {
    await set(KEY, project);
    if (failing) toast("Salvamento voltou a funcionar", "info");
    failing = false;
  } catch (e) {
    console.error(e);
    const quota =
      e instanceof DOMException && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED");
    failing = true;
    // O projeto aberto continua intacto na memória; só o disco falhou.
    toast(
      quota
        ? "Sem espaço no navegador: o projeto não foi salvo. Ele continua aberto; libere espaço para voltar a salvar."
        : "Falha ao salvar o projeto. Ele continua aberto; tentaremos de novo na próxima edição.",
      "error",
    );
  }
}
