# DAW simples — telas e requisitos funcionais

Escopo deste documento: front-end apenas. O áudio é feito por bibliotecas open source, cada uma atrás de um adaptador (`InstrumentEngine`), para que engines entrem e saiam sem mexer nas telas (seção 8).

Prioridade: **M** = mínimo para validar os RF básicos · **D** = depois · **G** = gravação, só quando todo o resto (M e D) estiver pronto.

## 1. Princípios

- **Limitada de propósito.** Cada recurso novo precisa justificar a entrada. Na dúvida, fica fora. A limitação criativa está nos recursos, não em tetos numéricos.
- **Tetos são técnicos, não criativos.** Roda em navegador, então há limites (seção 5), mas dimensionados para proteger o desempenho e ficar acima do que uma música normal usa. Ninguém deve esbarrar neles compondo.
- **Simples, não abstrata.** Usa o vocabulário real de música: BPM, compasso, oitava, nome de nota (C3, F#4), velocity, 1/16. Nada de metáforas que escondam o que está acontecendo.
- **Dois atores.** Playlist (onde a música é montada) e piano roll (onde o MIDI é escrito). Todo o resto é acessório deles.
- **Assume o mínimo de música.** Sem tutorial de teoria, sem assistente de acordes, sem "modo fácil".

## 2. Conceitos

| Conceito | Definição |
|---|---|
| Projeto | Um arranjo com BPM, trilhas e patterns. |
| Trilha | Uma linha da playlist. É **de instrumento** ou **de kit** (e, na fase G, **de áudio**). O tipo é escolhido na criação e não muda. |
| Trilha de instrumento | Um único sintetizador toca todas as notas. Polifônica: toca acordes. |
| Trilha de kit | Cada nota é um sintetizador diferente. |
| Kit | Conjunto de linhas, cada uma com nome e som próprios. Pode ser uma bateria, mas também um conjunto de efeitos, percussões, one-shots ou qualquer combinação de sons. |
| Pattern | Um trecho de MIDI com duração em compassos. Só guarda notas; quem define o som é a trilha. |
| Clipe | Uma instância de um pattern posicionada numa trilha. Vários clipes podem apontar para o mesmo pattern. |
| Instrumento | Um preset de sintetizador escolhido de uma lista curada. |

Um pattern herda o tipo da trilha onde foi criado e só pode ser posicionado em trilhas do mesmo tipo.

## 3. Telas

| ID | Tela / painel | Tipo | Conteúdo |
|---|---|---|---|
| T1 | Projetos | Página inicial | Lista de projetos locais, novo projeto, abrir, excluir. |
| T2 | Estúdio | Página principal | Casca que contém T3–T8. |
| T3 | Barra de transporte | Faixa fixa no topo | Play/stop, BPM, posição, loop, metrônomo, nome do projeto, undo/redo. |
| T4 | Playlist | Área central | Cabeçalhos de trilha à esquerda, régua de compassos, grade com clipes. |
| T5 | Biblioteca de patterns | Painel lateral recolhível | Lista de patterns do projeto, para arrastar à playlist. |
| T6 | Piano roll | Split com a playlist ou tela cheia | Teclado vertical, grade de notas, faixa de velocity. |
| T7 | Editor de kit | Mesmo lugar de T6, outra apresentação | Linhas nomeadas do kit, grade de steps, faixa de velocity. |
| T8 | Seletor de instrumento | Popover / gaveta | Lista de presets com pré-escuta. Usado pela trilha de instrumento e por cada linha do kit. |

O editor (T6/T7) tem dois modos de exibição, alternáveis a qualquer momento: **split**, dividindo a tela com a playlist, e **tela cheia**, ocupando o lugar dela. A barra de transporte permanece nos dois.

T6 e T7 ocupam o mesmo lugar: qual dos dois abre depende do tipo da trilha do pattern. O usuário não alterna um "modo"; ele abre um pattern de trilha de kit e o editor já é o de kit.

## 4. Requisitos funcionais

### 4.1 Projeto

| ID | Requisito | Prior. |
|---|---|---|
| RF-01 | Criar projeto novo com nome e BPM (padrão 120). Compasso fixo em 4/4. | M |
| RF-02 | Salvar automaticamente no navegador e reabrir pela tela de projetos. | M |
| RF-03 | Renomear e excluir projeto. | M |
| RF-04 | Desfazer e refazer qualquer edição de notas, clipes, trilhas e kits. | M |
| RF-05 | Exportar e importar o projeto como arquivo. | D |
| RF-06 | Exportar a música em áudio (WAV). | D |
| RF-67 | Ao atingir um limite técnico (seção 5), a ação fica indisponível e a interface diz qual limite foi atingido. Nada falha em silêncio. | M |
| RF-68 | Avisar quando o salvamento falhar por falta de espaço no navegador, sem perder o que está aberto. | M |

### 4.2 Transporte

| ID | Requisito | Prior. |
|---|---|---|
| RF-07 | Tocar, pausar e parar (parar volta ao início ou ao começo do loop). Barra de espaço alterna tocar/pausar. | M |
| RF-08 | Alterar o BPM, dentro da faixa da seção 5. | M |
| RF-09 | Mostrar a posição atual em compasso.tempo e um cursor de reprodução na playlist e no editor. | M |
| RF-10 | Posicionar o cursor clicando na régua. | M |
| RF-11 | Definir uma região de loop na régua da playlist e ligar/desligar o loop. | M |
| RF-12 | Escolher o que toca: a música (playlist) ou só o pattern aberto, em loop. | M |
| RF-13 | Ligar/desligar metrônomo. | D |

### 4.3 Playlist

| ID | Requisito | Prior. |
|---|---|---|
| RF-14 | Exibir grade de tempo × trilhas, com régua numerada em compassos. A música cresce conforme clipes são posicionados. | M |
| RF-15 | Adicionar trilha escolhendo o tipo (instrumento ou kit). | M |
| RF-16 | Renomear, reordenar e remover trilha. Remover pede confirmação se houver clipes. | M |
| RF-17 | Definir o instrumento de cada trilha de instrumento (um por trilha), via T8. | M |
| RF-18 | Volume, mute e solo por trilha. | M |
| RF-19 | Criar pattern vazio com duplo clique numa área livre da trilha; o editor abre em seguida. | M |
| RF-20 | Posicionar um pattern existente arrastando-o da biblioteca para uma trilha do mesmo tipo. Trilhas de tipo incompatível recusam o arraste de forma visível. | M |
| RF-21 | Mover clipe no tempo e entre trilhas do mesmo tipo, com encaixe em compasso ou tempo. | M |
| RF-22 | Duplicar e apagar clipe. Seleção múltipla. | M |
| RF-23 | Mostrar no clipe o nome do pattern e uma miniatura das notas. | M |
| RF-24 | Abrir o pattern de um clipe no editor com duplo clique. | M |
| RF-25 | Editar um pattern altera todos os clipes que apontam para ele. | M |
| RF-26 | "Tornar único": desvincular um clipe, criando uma cópia independente do pattern. | M |
| RF-27 | Zoom horizontal e rolagem horizontal e vertical. | M |
| RF-28 | Redimensionar clipe para cortar ou repetir o pattern. | D |
| RF-29 | Cor por trilha, herdada pelos clipes. | D |

### 4.4 Biblioteca de patterns

| ID | Requisito | Prior. |
|---|---|---|
| RF-30 | Listar os patterns do projeto com nome, tipo e duração. | M |
| RF-31 | Renomear, duplicar e excluir pattern. Excluir remove os clipes e pede confirmação. | M |
| RF-32 | Indicar quantos clipes usam cada pattern. | D |

### 4.5 Editor — comum ao piano roll e ao editor de kit

| ID | Requisito | Prior. |
|---|---|---|
| RF-33 | Alternar o editor entre split com a playlist e tela cheia. No split, a divisória é redimensionável. | M |
| RF-34 | Fechar o editor e voltar à playlist inteira. | M |
| RF-35 | Escolher o encaixe da grade: 1/4, 1/8, 1/16, 1/32. | M |
| RF-36 | Definir a duração do pattern em compassos, qualquer valor inteiro até o limite técnico. | M |
| RF-37 | Editar a velocity de cada nota numa faixa abaixo da grade. | M |
| RF-38 | Seleção múltipla (retângulo e shift+clique), copiar, colar, duplicar e apagar. | M |
| RF-39 | Zoom horizontal e rolagem. | M |
| RF-40 | Indicar qual pattern e qual trilha estão sendo editados. | M |
| RF-41 | Encaixe em tercinas. | D |

### 4.6 Piano roll (trilha de instrumento)

| ID | Requisito | Prior. |
|---|---|---|
| RF-42 | Exibir teclado vertical com nome das notas e oitavas; clicar numa tecla toca a nota. | M |
| RF-43 | Criar nota com clique, na duração da última nota editada. | M |
| RF-44 | Mover nota (tempo e altura) e redimensionar pela borda. | M |
| RF-45 | Notas simultâneas e sobrepostas permitidas: acordes são o caso normal. | M |
| RF-69 | Polifonia estourada nunca é silenciosa. No piano roll, as notas que passam do limite de vozes da trilha são marcadas visualmente já na edição. Na reprodução, o cabeçalho da trilha acende um aviso quando uma voz é cortada, e o aviso diz quantas vozes faltaram. | M |
| RF-46 | Tocar a nota ao criar ou mover (pré-escuta), com o instrumento da trilha. | M |
| RF-47 | Transpor a seleção por semitom e por oitava pelo teclado. | M |
| RF-48 | Rolagem vertical por toda a extensão de oitavas. | M |
| RF-49 | Destacar as notas de uma escala escolhida. | D |
| RF-50 | Ver as notas de outro pattern ao fundo, como referência. | D |

### 4.7 Editor de kit (trilha de kit)

| ID | Requisito | Prior. |
|---|---|---|
| RF-51 | Exibir uma linha por som do kit, com o nome do som no lugar do teclado. | M |
| RF-52 | Ao criar a trilha de kit, começar com o kit vazio ou a partir de um modelo. Bateria básica é um dos modelos, não o padrão implícito. | M |
| RF-53 | Definir o som de cada linha individualmente, via T8 — um sintetizador diferente por linha. Qualquer preset serve, não só percussão. | M |
| RF-54 | Adicionar, renomear, reordenar e remover linhas do kit. | M |
| RF-55 | Ligar/desligar um toque com clique na célula. | M |
| RF-56 | Clicar no nome da linha toca o som. | M |
| RF-57 | Volume e mute por linha. | M |
| RF-58 | O kit pertence à trilha: todos os patterns da trilha usam o mesmo kit. | M |
| RF-59 | Cada linha corresponde a uma nota MIDI fixa, atribuída automaticamente e invisível na interface. | M |
| RF-60 | Duração editável por toque, para sons sustentados. | D |
| RF-61 | Solo por linha. | D |
| RF-62 | Salvar e reutilizar kits entre projetos. | D |

### 4.8 Instrumentos

| ID | Requisito | Prior. |
|---|---|---|
| RF-63 | Listar presets curados, agrupados por categoria (baixo, lead, pad, teclas, percussão, efeitos). | M |
| RF-64 | Pré-escutar um preset antes de confirmar. | M |
| RF-65 | Trocar o preset a qualquer momento, inclusive durante a reprodução. | M |
| RF-66 | Alguns controles por preset (ex.: ataque, release, brilho). | D |

### 4.9 Gravação (fase G)

Só começa quando todo o resto estiver pronto. Primeiro MIDI, depois áudio.

**MIDI por teclado físico**

| ID | Requisito | Prior. |
|---|---|---|
| RF-70 | Conectar teclado MIDI (Web MIDI) e tocar o instrumento da trilha selecionada em tempo real. | G |
| RF-71 | Gravar o que é tocado como notas num pattern, com horário e velocity, opcionalmente encaixadas na grade. | G |
| RF-72 | Avisar quando o navegador não suporta Web MIDI (Safari). | G |

**Áudio**

| ID | Requisito | Prior. |
|---|---|---|
| RF-73 | Novo tipo de trilha: **de áudio**, com clipes de áudio na playlist exibindo a forma de onda. | G |
| RF-74 | Escolher a entrada de áudio e ver o medidor de nível antes de gravar. | G |
| RF-75 | Gravar com contagem de entrada (count-in) ou a partir do cursor, com a música tocando. | G |
| RF-76 | Calibração de latência: o app toca um clique, grava o próprio clique e mede o atraso. Feita uma vez por dispositivo, refazível a qualquer momento. | G |
| RF-77 | Compensar a latência medida: o clipe gravado cai alinhado com a música. | G |
| RF-78 | Gravar o áudio cru, sem cancelamento de eco, supressão de ruído nem controle automático de ganho. | G |
| RF-79 | Mover, cortar, duplicar e apagar clipes de áudio, com as mesmas regras de clipe da playlist. | G |
| RF-80 | Avisar quando a saída for Bluetooth: o atraso inviabiliza gravar no tempo. | G |
| RF-81 | Exportação em WAV (RF-06) inclui as trilhas de áudio. | G |

Notas técnicas:

- **Retorno sem atraso não é garantido.** Ouvir a si mesmo pelo app enquanto grava tem atraso perceptível, porque o navegador não acessa drivers de baixa latência (ASIO etc.). O app não oferece esse retorno; quem precisar usa o retorno direto da interface de áudio.
- **Captura por AudioWorklet**, não por `MediaRecorder` (que comprime e não tem início preciso).
- **Armazenamento:** áudio em qualidade de CD, estéreo, ocupa uns 10 MB por minuto. O limite de armazenamento (RF-68) passa a ser relevante; a seção 5 ganha limites de duração de gravação nessa fase.

## 5. Limites técnicos

Valores iniciais, a calibrar medindo o protótipo em máquina modesta. O critério é desempenho no navegador (CPU de áudio, quadros da interface, memória, armazenamento), nunca restrição criativa.

| Item | Limite inicial | Motivo |
|---|---|---|
| Trilhas por projeto | 32 | Cada trilha é um sintetizador vivo na thread de áudio. |
| Linhas por kit | 32 | Cada linha é um sintetizador próprio. |
| Polifonia por trilha de instrumento | 16 vozes | Custo de CPU por voz. A mais antiga é cortada, com aviso (RF-69). |
| Vozes simultâneas no projeto | 64 | Evita estalos e travamento do áudio. Corte também avisado (RF-69). |
| Duração do pattern | 64 compassos | Tamanho da grade do editor. |
| Duração da música | 4.000 compassos (mais de 2 h a 120 BPM) | Agendamento e memória; a grade é desenhada só no trecho visível, então o tamanho não pesa na interface. |
| Notas por pattern | 4.000 | Renderização e agendamento. |
| BPM | 20–300 | Precisão do agendamento nos extremos. |
| Extensão de notas | C0–C8 | Faixa útil dos sintetizadores. |
| Histórico de desfazer | 100 passos | Memória. |
| Armazenamento | Cota do navegador | Fora do nosso controle; ver RF-68. |

## 6. Fora de escopo, por decisão

Mixer com canais e sends, efeitos, automação, plugins externos, mudança de andamento ou de compasso no meio da música, colaboração, contas de usuário.

Gravação de MIDI e de áudio saiu desta lista: entra na fase G (seção 4.9), depois de todo o resto.

## 7. Stack sugerida (front)

| Camada | Escolha |
|---|---|
| Base | Vite + React 19 + TypeScript (modo estrito), SPA sem servidor |
| Estilo | Tailwind CSS v4, com tokens próprios de cor, raio, blur e tipografia em `@theme` |
| Componentes | shadcn/ui como base; Aceternity UI e Magic UI para os efeitos. Todos copiados para o repositório, não instalados como dependência |
| Animação | Motion |
| Grades (playlist e editor) | Canvas 2D próprio, fora do React |
| Estado | Zustand, com zundo para undo/redo |
| Áudio | Tone.js como base (relógio, mixer, sintetizadores); Plaits (WASM), smplr ou SpessaSynth e faustwasm como engines adicionais. Ver seção 8 |
| Persistência | IndexedDB via idb-keyval |
| Ícones | Lucide |
| Qualidade | Biome (lint e formatação) e Vitest |

Tema: escuro, liquid glass. O vidro (blur de fundo) vai na moldura — transporte, cabeçalhos, painéis, popovers. As grades da playlist e do editor ficam opacas: blur sobre centenas de células roláveis derruba a taxa de quadros. Com tetos altos de trilhas e compassos, as grades precisam renderizar só o que está visível (virtualização ou canvas).

## 8. Engine de áudio

O projeto não tem DSP próprio: o som vem de bibliotecas open source. O trabalho do projeto é o front, o sequenciador e a cola entre eles.

### 8.1 Por que roda no navegador

A síntese não acontece na thread do React. Os sintetizadores do Tone.js são nós nativos do navegador, e Faust roda em AudioWorklet; os dois ficam numa thread de áudio separada. Os riscos, em ordem de probabilidade:

| Risco | Mitigação |
|---|---|
| Travada da thread principal atrasar notas | O sequenciador agenda com antecedência (~100 ms) e horário exato. Grades em canvas, fora do React. |
| Vozes demais | Limites técnicos da seção 5 e aviso de polifonia (RF-69). |
| Memória de samples (smplr) | Carregar só as notas usadas (`notesToLoad`); liberar instrumentos com `dispose()`. |
| Muitos AudioWorklets separados | Um nó polifônico por trilha, nunca um nó por voz. |
| Celular e Safari | Menos folga. Decidir cedo se são alvo. |

### 8.2 Bibliotecas

Situação levantada no GitHub em 16/11/2026.

| Biblioteca | Papel | Atividade | Licença | Fase |
|---|---|---|---|---|
| Tone.js | Base: relógio (transporte), mixer, sintetizadores nativos | Muito ativa (v15.5.72, commit em 14/11/2026) | MIT | 1 |
| Plaits (Mutable Instruments), via `mi-plaits-dsp-rs` | Motor de síntese com identidade: 16+ modelos (analógico virtual, FM, wavetable, cordas, percussão, ruído) | Ativo (set/2026) | MIT no port em Rust; licença do original a confirmar | 2 |
| smplr ou SpessaSynth (um dos dois) | Instrumentos acústicos sampleados (pianos, cordas, metais, baterias reais) | Ambos ativos (nov/2026) | smplr: MIT no package.json, sem arquivo LICENSE. SpessaSynth: Apache-2.0 | 3 |
| Faust + faustwasm | Sintetizadores próprios; DX7 (`dx7.lib`) e modelos físicos prontos nas bibliotecas | Ativa (v0.21.0, 15/11/2026) | LGPL-2.1 na biblioteca; bibliotecas em geral permissivas; o código Faust escrito por nós é nosso | 4 |
| Elementary Audio | — | Parada (última release em 12/2024) | MIT | Descartada |
| BeepBox | — | Ativa | MIT | Descartada como engine |

Notas:

- **Tone.js.** Os sintetizadores não têm timbre próprio; a identidade sonora vem dos presets e das outras engines. Exige disciplina com `dispose()` para não vazar memória.
- **Plaits.** Melhor relação entre qualidade e esforço. Um único motor cobre baixo, lead, pad, percussão e efeitos, com poucos controles por modelo, o que combina com o RF-66. Caminho: compilar o port em Rust para WASM e rodar num AudioWorklet polifônico.
- **smplr ou SpessaSynth.** Cobrem o que síntese não faz bem. O smplr baixa samples por instrumento; o SpessaSynth toca um arquivo SoundFont único com todos os instrumentos (SoundFonts livres como o GeneralUser GS têm algumas dezenas de MB) e já roda em AudioWorklet. Escolher um só.
- **smplr.** Aceita o nosso AudioContext, recebe notas com horário exato (`start({ time })`), limita vozes e renderiza offline. Os samples vêm de repositórios de terceiros no GitHub Pages, com limite de requisições: em produção, hospedar os samples nós mesmos e verificar a licença de cada pacote.
- **Faust.** `keyOn` com precisão de amostra, vozes paradas não consomem CPU, e o sintetizador pode ser compilado para WASM antes, sem levar o compilador para o app. Custo: aprender a linguagem. Se o app for comercial, revisar como distribuir a parte LGPL.
- **Elementary.** Além de parado, redesenha o grafo de áudio a partir da thread principal e não documenta como agendar uma nota num instante exato. O Faust cobre o mesmo espaço.
- **BeepBox.** Não serve como engine: gera som com `ScriptProcessorNode` (obsoleto, roda na thread principal) e só toca a música inteira, sem nota avulsa. A interface dele não é referência para nós. O que se aproveita são os algoritmos de síntese (`SynthConfig.ts`: chip, FM, noise, PWM, supersaw etc.), que podem ser portados para Faust.

Avaliados e descartados como peça (servem só de inspiração para presets):

| Sintetizador | Motivo |
|---|---|
| Surge XT | GPL-3; sem build web oficial; grande demais para portar |
| Vital / Helm | GPL-3; sem versão web; Vital parado desde 2023 |
| Dexed (DX7) | GPL-3; port web parado desde 2018. O DX7 do Faust cobre o mesmo som |
| OB-Xd | GPL-3; port web parado desde 2018 |
| WebAudioFont | GPL-3; qualidade de General MIDI básico |
| DaisySP | Bons blocos de DSP em C++, mas mais trabalho que Plaits e Faust para o mesmo resultado |

Embutir código GPL obriga a abrir o app inteiro sob GPL. Se o projeto for aberto, isso deixa de impedir, mas portar esses sintetizadores continua sendo um projeto à parte.

### 8.3 Adaptador de engine

O app nunca fala com uma biblioteca diretamente. Cada engine implementa:

```ts
interface InstrumentEngine {
  id: string;                       // "tone", "smplr", "faust"
  presets: PresetInfo[];            // o que aparece no seletor (T8)
  create(ctx: BaseAudioContext, presetId: string): Promise<Instrument>;
}

interface Instrument {
  output: AudioNode;                // liga no canal da trilha
  noteOn(note: number, velocity: number, time: number): void;
  noteOff(note: number, time: number): void;
  setParam?(name: string, value: number, time: number): void;
  dispose(): void;
}
```

Regras:

- **Um relógio só.** O sequenciador do host decide quando cada nota toca e chama `noteOn` com horário exato. Nenhuma engine usa sequenciador próprio. Na implementação, o host não usa o `Tone.Transport`: tem um agendador próprio com antecedência de ~120 ms, disparado pelo ticker do Tone.js (que roda num Worker). Ele lê o projeto direto do store a cada janela, então edições durante a reprodução valem na hora, sem reconstruir partes.
- **Um AudioContext só.** Todas as engines recebem o mesmo; cada `output` entra no canal de mixer da trilha.
- **Exportação offline.** `create` recebe `BaseAudioContext`, então a mesma fábrica funciona num `OfflineAudioContext` para o RF-06.
- **Latência "balanced".** O AudioContext usa buffers um pouco maiores que o padrão "interactive": menos estalos sob carga. Como tudo é agendado com antecedência, isso não atrasa a música, só um pouco a pré-escuta.
- **Tone.js sob demanda.** A biblioteca é baixada no primeiro gesto do usuário; a tela abre sem esperar por ela.
- **Polifonia contada pelo host.** O sequenciador sabe quais notas estão soando, então o RF-69 funciona igual para qualquer engine.
- **Plugável.** Cada engine fica numa pasta própria e é carregada sob demanda com `import()` dinâmico. Adicionar ou remover é mexer na pasta e numa linha do registro.
- **Mínimo denominador comum.** Recurso exclusivo de uma engine só aparece na interface com trabalho explícito. Para uma DAW limitada de propósito, isso é desejável.

### 8.4 Fases

1. Tone.js e o adaptador, mesmo com uma engine só, para a fronteira nascer certa. Presets curados com cuidado: som genérico derruba o produto.
2. Plaits em WASM: o salto de qualidade mais barato.
3. smplr ou SpessaSynth, depois de resolver hospedagem e licença dos samples.
4. Faust, começando pelo `dx7.lib` e pelos modelos físicos antes de escrever DSP próprio (inclusive portando algoritmos do BeepBox).

Antes de fechar a fase 1: teste de carga com 32 trilhas × 16 vozes, canvas rolando e React re-renderizando, medido no Chrome e no Firefox numa máquina modesta.

## 9. Decisões tomadas

- Pattern preso ao tipo da trilha: de instrumento só entra em trilha de instrumento, de kit só em trilha de kit.
- Kit não é sinônimo de bateria: é qualquer conjunto de sons, um por linha.
- Sem limites criativos; só limites técnicos, altos o bastante para não aparecerem no uso normal.
- Editor em split ou tela cheia, à escolha do usuário.
- Áudio só com bibliotecas open source, atrás do adaptador `InstrumentEngine`. Tone.js é a base e o relógio único.
- Elementary Audio e BeepBox ficam fora como engine.

## 10. Decisões em aberto

- **Celular e Safari são alvo?** Afeta a folga de desempenho e os limites técnicos.
- **Hospedagem e licença dos samples**, antes da fase 3.
- **smplr ou SpessaSynth** para instrumentos acústicos.

- **Kit por trilha ou por pattern.** Proposto: o kit é da trilha (RF-58), então todos os patterns dela compartilham os mesmos sons. A alternativa, kit por pattern, é mais flexível e mais confusa.
