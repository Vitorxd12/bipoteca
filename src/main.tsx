import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { App } from "./App";
import { loadProject } from "./store/persist";

const root = document.getElementById("root");
if (!root) throw new Error("#root não encontrado");

// Handle de depuração (só em dev): permite testes automatizados lerem o estado.
if (import.meta.env.DEV) {
  void Promise.all([
    import("./store/project"),
    import("./store/ui"),
    import("./store/transport"),
    import("./audio/host"),
    import("./editor/view"),
    import("tone"),
  ]).then(([project, ui, transport, audio, editor, Tone]) => {
    Object.assign(window, {
      __bipoteca: {
        useProject: project.useProject,
        useUi: ui.useUi,
        useTransport: transport.useTransport,
        host: audio.host,
        useEditorView: editor.useEditorView,
        Tone,
      },
    });
  });
}

void loadProject().then(() => {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
