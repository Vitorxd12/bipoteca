# Bipoteca

DAW simples e propositalmente limitada, no navegador. Dois atores: a **playlist**, onde a música é montada, e o **piano roll**, onde o MIDI é escrito. Assume que quem usa entende o mínimo de música: BPM, compasso, nome de nota, velocity.

Por enquanto é só o front: abre direto no Estúdio, sem login nem página de projetos. O projeto fica salvo no próprio navegador.

Requisitos, telas e decisões de arquitetura: [`docs/requisitos.md`](docs/requisitos.md).

## Rodar

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # checagem de tipos + build de produção
npm test           # testes unitários (Vitest)
npm run lint       # Biome
```

## O que tem

| Tela | O que faz |
|---|---|
| Barra de transporte | tocar/pausar/parar, posição, BPM (arrastar, roda, digitar), loop, metrônomo, música × só o pattern, desfazer/refazer |
| Playlist | trilhas de **instrumento** (um sintetizador, acordes) e de **kit** (um sintetizador por linha); clipes que apontam para patterns; loop na régua |
| Biblioteca de patterns | lista, renomeia, duplica, apaga; arraste para a playlist |
| Piano roll | teclado tocável, notas, velocity, encaixe 1/4–1/32, transposição, aviso de polifonia |
| Editor de kit | linhas nomeadas, cada uma com seu som; pintar toques arrastando |
| Seletor de som | presets por categoria com pré-escuta |

Os gestos são parte central da interface: clique, arraste, duplo clique, botão direito, botão do meio, roda, Ctrl/Shift/Alt + roda. A lista completa está no app (tecla `?`).

## Stack

Vite + React 19 + TypeScript estrito · Tailwind CSS v4 (só classes inline; o CSS global tem apenas tokens e base) · componentes da [React Bits](https://reactbits.dev), [Magic UI](https://magicui.design) e [Aceternity UI](https://ui.aceternity.com) copiados via registry do shadcn · Motion · Zustand + zundo (desfazer) · Tone.js · idb-keyval.

Paleta **Volt × Ultravioleta**: lima elétrico (`#c8ff3d`) e ultravioleta (`#8b6cff`) sobre tinta escura. Ultravioleta marca trilhas de instrumento e seleção; volt marca trilhas de kit e reprodução; coral fica só para avisos.

## Estrutura

```
src/
  audio/        engine.ts (interface InstrumentEngine), host.ts (relógio, mixer, vozes), engines/tone.ts, presets
  model/        tipos, limites técnicos, utilidades musicais, projeto de exemplo
  store/        projeto (com desfazer), UI, transporte, salvamento, avisos
  playlist/     régua, grade em canvas, cabeçalhos de trilha
  editor/       piano roll, editor de kit, régua, velocity, comandos de teclado
  library/      biblioteca de patterns
  picker/       seletor de som
  transport/    barra de transporte e BPM
  ui/           peças da moldura, menus, diálogos, ajuda de gestos
  components/   componentes copiados de React Bits / Magic UI / Aceternity (não editar à toa)
```

As grades (playlist, piano roll, kit, velocity) são desenhadas em canvas, fora do React, com uma camada separada só para o cursor de reprodução.
