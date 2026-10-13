# Guinomo → Metaverso: Roadmap

> Documento vivo que guia a evolução do Guinomo de "experiência WebGL multiplayer"
> para um **metaverso web** no espírito de *Ready Player One* (OASIS), mas realista
> para a web — persistente, social, com identidade e papel para cada pessoa.
>
> **Nota honesta de âmbito:** um OASIS literal (VR full-dive, mundo contínuo, NPCs
> com IA) é ficção. O que é realista é o caminho Second Life / Minecraft / Roblox:
> mundos persistentes no browser, avatares, socialização em tempo real, UGC e uma
> economia soft. Tudo abaixo assume essa fronteira.

## Pilares e estado atual

Um metaverso não é uma tecnologia única — é a soma de **4 pilares**. O Guinomo já
tem pedaços de cada um; o roadmap é sobre fechar as lacunas, uma fase de cada vez.

| Pilar | Estado atual | Lacuna principal |
|---|---|---|
| **Identidade** (avatar, nome, papel) | Avatar com cores/roupa/chapéu/nome persis­tido (PHP + `localStorage`); papel/título escolhível (v1) | Mais customização (acessórios, física/idade já existe), papéis com significado social |
| **Mundo persistente** | 6 mundos procedurais + `room` P2P (iroh-gossip); sky/secrets por mundo | Estado do mundo em DB (spawn, objetos colocados), mais biomas, noite/dia por mundo |
| **Social** | Presença em tempo real, painel de amigos, notificações, chat PHP; **chat P2P no mundo (v1)** | Emojis ligados ao chat, voz, grupos/festas, moderação |
| **Economia / UGC** | — (vazio) | Moeda soft, colecionáveis/segredos como troféus, criar/colocar itens, marketplace moderado |

## Engagement: hooks e retenção (entregue e planeado)

Loops de hábito e colecionismo — viciantes, mas **saudáveis**: streaks só dão
cosméticos (nunca punem), sem energia comprável nem notificações de culpa.

| Entregue | Descrição |
|---|---|
| **Streak de visitas** 🔥 | Dias consecutivos no HUD (badge de chama, `localStorage`); aos **7 dias** o cartaz fica com moldura dourada + contador |
| **Álbum de selos** 🏅 | 5 cromos por segredo (raridade Comum/Raro/Lendário), ligado aos segredos já persistidos; atualiza ao vivo |
| **Hora dourada** ☀️ | Janela diária de 10 min a hora variável e anunciada (determinística: mesma janela em todos os dispositivos); segredos dão pontos a dobrar e selos dourados |
| **Grande Segredo** 👑 | Finale ao encontrar os 5 segredos: overlay dourado bilingue, +200 XP (×2 na golden hour) e selo-mestre "Mestre dos Segredos" no álbum (6.ª carta); marca retroativa para jogadores que já tinham 5/5 |
| **Troféus persistidos** 🏅→🌐 | Selos sincronizados para o servidor (`api/guinomo/seals.php`): POST autenticado por sessão (HMAC aditivo) + GET público por `uid` para o perfil; store file/PDO (`guinomo_seals`) |
| **Celebração ao encontrar** 🎉 | Saltos de alegria ao achar um segredo + toast de progresso/guia ("Encontraste 2/5 — viaja para X"); a bússola entra em **modo quest** e aponta para o botão do Mapa de Mundos |
| **Bússola sussurrante** 🗣️ | Pistas que ficam mais precisas à medida que te aproximas do segredo (lógica pura, coberta por vitest); no modo quest aponta para o botão do Mapa de Mundos quando o segredo local já foi encontrado |
| **Cartaz com legenda** 📸 | Moldura polaroid + legenda por mundo (ou livre), esquema dourado no streak máximo |
| **Par Extraordinário** 👥 | Vínculo ao vivo entre 2 jogadores que ficam juntos no mesmo mundo (linha dourada + auréolas); pontos de aventura e chip no cartão, uma vez por par por dia |

| Planeado | Descrição |
|---|---|
| **Rastro de luz** ✨ | Rasto colorido dos amigos no mundo (presença); seguir até ao fim desbloqueia um cartaz a dois |
| **Guerra de mundos** ⚔️ | Pontos por mundo + placar semanal; o vencedor ganha céu/decoração exclusiva |
| **Cadeias de recados** 🧵 | Responder a recados cria fios visíveis no chão; cadeias longas brilham mais |

## Arquitetura de referência (já em produção)

- **Render/game**: TypeScript + three.js (módulos `src/scene/*`, `SceneModule` base),
  build Vite, budget de bundle em `bundle-size.json`.
- **Multiplayer**: P2P via iroh-gossip (`src/engine/characters.ts`), semente de sala
  derivada de `world+room` (SHA-256) — sem servidor de jogo.
- **Plataforma**: PHP (`php-integration/lib/`) com presença, amigos, perfis e stores
  PDO/file; contrato HMAC aditivo (`src/core/hmac.ts`) inerte por defeito.
- **Qualidade**: gate `typecheck · lint · vitest · build · check:bundle · PHP tests`
  no CI + **E2E não-bloqueante** (`?audit`, 6 mundos).

## Fases

### Fase 0 — Fundações (feita)
- [x] Port fiel do motor, 6 mundos, segredos por mundo, sistema de descanso.
- [x] Ghosts P2P + room codes + convite.
- [x] Presença, amigos, notificações, perfil persistido (PHP).
- [x] HMAC aditivo, CI completo, budget de bundle, E2E de auditoria.
- [x] **V1 sprinteada neste documento**: guia de primeira vez, mapa de mundos,
      identidade (papel), SFX sintetizados, céu afinado por mundo.

### Fase 1 — Primeira experiência (em curso)
| Item | Critério de aceitação |
|---|---|
| Guia de primeira vez | Novo visitante vê o guia automaticamente; botão de ajuda reabre; tudo bilingue PT/EN |
| Mapa de mundos | Viajar entre os 6 mundos a partir do overlay; descrição + dica de segredo por mundo |
| Papel do avatar | Escolher papel (Explorador, Artista, …); visível no name-tag; persistido (local + servidor) |
| Áudio | SFX de UI sintetizados (abrir/fechar/segredo/viagem/guia) sem ficheiros novos |
| Texturas/céu | Paletas de céu por mundo afinadas; pipeline CC0 documentado (Objectivo) |

**Dependências**: nenhuma — corre fora do gate PHP (Sprint entregável já).

### Fase 2 — Social em tempo real (em curso)
| Item | Critério de aceitação |
|---|---|
| **Chat P2P no mundo** ✅ | Mensagens em tempo real entre quem está na mesma `room`, via o próprio canal gossip (envelope v3); janela de chat com badge de não-lidos; limite de 200 chars |
| Presença "a escrever" ✅ | Indicador "X está a escrever…" a partir de frames `typing` P2P, auto-expira (2,5 s) |
| Emojis no chat ✅ | Renderizar emojis (já suportados como UTF-8) num seletor rápido junto ao input |
| **Saudação 👋** ✅ | Acenar (tecla `G`, botão 👋 ou emoji 👋 no chat) levanta um 👋 + anel de partículas **determinístico** sobre o avatar; difundido aos amigos pelo canal de chat (sem protocolo novo) |
| **Festas/grupos** | Convidar vários amigos para a mesma `room`, manter rotação |
| Voz | WebRTC/Datachannel opcional com toggle de privacidade (P2P, sem servidor) |
| Moderação básica | Bloqueio/mute de utilizador P2P, reporte via PHP |

### Fase 3 — Persistência do mundo + UGC
- **Spawn persistente** ✅: o utilizador volta para onde estava — `lib/spawn.php` +
  `api/guinomo/spawn.php` (file/PDO, HMAC opcional); o engine restaura o ponto no
  arranque e grava em movimento (12 s + saída da página).
- **Criar/colocar objetos** (móveis simples, sinais, decorações) com gravação em DB.
- Segredos/colecionáveis como **troféus visíveis** no perfil (badges) — ✅
  endpoint pronto (`GET api/guinomo/seals?uid=N` público + POST com HMAC) e
  badges renderizados no perfil da app social (5 chips na ordem de exploração,
  encontrados dourados na hora dourada, coroa 👑 no 5/5).
- **Economia soft**: moeda do mundo, lojas de cosméticos (cor/roupa/chapéu/papel).

### Fase 4 — UGC aberto + escala
- Ferramenta de construção (grid) com partilha de "terrenos" por sala.
- Marketplace P2P moderado (votação) para criações.
- Mobile-first, performance (DPR adaptativo já existe), acesso com conta única.
- **Monetização** apenas de cosméticos — nunca pay-to-win.

## Visão pesada — os 8, organizados em blocos

> Ideias "pesadas e inovadoras em 3D" pedidas pelo utilizador (2026-10-13),
> com honestidade de limites: cada uma está desenhada para a stack atual
> (three.js + P2P Rust/wasm + PHP de estado + núcleo determinístico) e indica
> onde esbarra no WIP do utilizador (shaders/`glsl`, `characters`, `materials`).

### Bloco A — o mundo respira por simulação (o mais 3D)

| Ref | Ideia | Módulos previstos | Dependências / risco | Estado |
|---|---|---|---|---|
| **A1** | **Ecossistema determinístico** — fauna por mundo (pirilampos no Bosque, cardumes na Cidade Flutuante, poeira-estrela no Alien…) com o mesmo voo para todos os jogadores | `core/worldFauna.ts` + `scene/worldFaunaScene.ts` | Nenhuma (usa `THREE.Points`, não mexe em shaders); candidato wasm da Fase B do plano C++ | ✅ **feito** (commit `…`) |
| **A2** | **O oceano que responde à maré** — nível da água sobe dentro da janela do evento (maré cheia 18:00–19:30 na Cidade Flutuante) e vaza depois; sem shaders | `core/seaTide.ts` + `scene/tideScene.ts` | Nenhuma (eleva o mesh do mar + brilho de espuma; não toca no WIP `glsl`) | ✅ **feito** (commit `…`) |
| **A3** | **O céu como estado partilhado** — o céu segue o relógio **UTC** como estado puro (dia/amanhecer/anoitecer/noite), com paletas por mundo e fase "desperta" | `core/skyState.ts` + `scene/sky.ts` | Nenhuma — dirigido só por **uniforms** a partir de estado (não usa `glsl/*`, preserva o WIP do utilizador) | ✅ **feito** |

### Bloco B — presença e memória (o mais ousado socialmente)

| Ref | Ideia | Módulos previstos | Dependências / risco | Estado |
|---|---|---|---|---|
| **B4** | **Espectros** — trajetórias dos amigos gravadas e reproduzidas como fantasmas translúcidos quando offline | `core/presenceEcho.ts` + `scene/echoScene.ts` | Reutiliza os arrays P2P do `characters` (padrão `pairLink`); persistência `guinomo.ghosts.v1` | ✅ **feito** (commit `…`) |
| **B5** | **Polaroids no mundo** — a foto arrasta-se como quadro 3D flutuante no local onde foi tirada; partilhada por todos via backend | `core/worldPolaroid.ts` + `scene/polaroidScene.ts` + `api/guinomo/photos.php` | Backend novo no noop (padrão `notes.php`); cap 40/mundo, thumb ~96×72 | ✅ **feito** (commit `…`) |
| **B6** | **Inauguração sincronizada** — janela UTC fixa: com ≥N online, um alinhamento celeste dispara em todos os mundos e mune troféu coletivo | `core/worldCall.ts` + `components/worldCallHud.ts` + `scene/worldCallScene.ts` | Leve; consome a presença já existente (`light_trail_update`) | ✅ **feito** (commit `…`) |

### Bloco C — o limite como design

| Ref | Ideia | Módulos previstos | Dependências / risco | Estado |
|---|---|---|---|---|
| **C7** | **Metamorfose pós-5/5 — o mundo acorda** — o finale deixa de ser fim: o mundo entra em fase "desperta" (fauna jamais apaga, alinhamento muda de cor, janela diária "Eco do Despertar") | `core/worldAwakening.ts` + hooks na fauna/alinhamento | Nenhuma (estado lido do `guinomo.grand_secret.v1`; sem tocar no WIP) | ✅ **feito** (commit `…`) |
| **C8** | **Duelo de sombras** — recolher sombras no evento e duelar com projeções; replay determinístico arbitra sem servidor | `core/shadowDuel.ts` + `scene/shadowDuelScene.ts` | Netcode determinístico (Fase C do plano C++) | ✅ **feito** (commit `…`) |

### Bloco D — 3D real e combate entre jogadores (2026-10-13)

> Pedido do utilizador: "3D real" (não sprites 2D) e **guerra/duelo PvP real** entre
> avatares. Tudo abaixo entra no gate normal e **não toca no WIP** do utilizador
> (`scripts/glb2bins.mjs`, `src/scene/characters.ts`, `src/scene/glsl/*`, `materials.ts`).

| Ref | Ideia | Módulos previstos | Dependências / risco | Estado |
|---|---|---|---|---|
| **D1** | **Saudação 3D real (ossos)** — a saudação deixa de ser sprite 2D e passa a ser uma pose procedural nos **ossos reais do braço**, aplicada sobre a animação, com snapshot/restore para não vazar | `core/wavePose.ts` + injeção em `engine/characters.ts` (não-WIP) | Nenhuma — sem clipe nem shader novo (preserva o WIP `scene/characters.ts`) | ✅ **feito** |
| **D2** | **Duelo PvP real entre avatares** — desafiar o avatar mais próximo (tecla `R`), aceitar, ambos enfrentam o **mesmo padrão determinístico** e trocam os registos de parry pelo canal de chat; arbitragem pura faz os dois clientes concordarem no vencedor, sem servidor | `core/avatarDuel.ts` + `scene/avatarDuelScene.ts` | Reutiliza `shadowDuel` e o chat P2P; desafiar exige sessão (`GUINOMO_UID`) | ✅ **feito** |
| **D3** | **Bloom + vinheta de filme** no composer principal (RenderPass → Bloom → SMAA → Vinheta → Gamma), com grão temporal subtil | `core/postFxConfig.ts` + `engine/postfx.ts` + `engine/globals.ts` | `three/examples/jsm` já usado (sem dep nova); afinação por dispositivo | ✅ **feito** |
| **D4** | **Raios de sol (god rays)** em espaço de ecrã: blur radial dos pixéis claros na direção do sol (projetado pela `sky`) | `core/postFxConfig.ts` + `engine/postfx.ts` + `scene/sky.ts` + `scene/mainController.ts` | Aproximação de ecrã (sem buffer de oclusão); por dispositivo | ✅ **feito** |
| **D5** | **SSAO** — oclusão de ambiente no composer do ambiente | `scene/mainController.ts` (com `?ssao`) | O material de override é agressivo nos billboards com alpha; por isso **opt-in** para avaliação | 🟡 **feito (opt-in `?ssao`)** |
| **D6** | **Água com reflexo** | `scene/sea.ts` | Já existia: `Reflector` planar + fresnel + espuma procedural | ✅ **já em produção** |
| **D7** | **Clima como estado (chuva)** — sereno (drizzle), chuva e tempestade determinística e **partilhada** (mundo + relógio UTC + viés por mundo); a cena desenha streaks que seguem o jogador | `core/weather.ts` + `scene/rainScene.ts` | Como o céu (A3): sem rede (ambos os clientes calculam o mesmo tempo); preview `?weather=drizzle\|rain\|storm\|clear` | ✅ **feito** |
| **D8** | **Cidade alien maior e diversa** — o mundo `alien` passa a cidade real: praça com cristal, torres de cristal, bio-domes, plataformas flutuantes e pilones (procedural) + casas/armazéns/cidadelas/máquinas autorais, tudo a partir de um **plano puro testado**; zona de descanso incluída | `core/alienCity.ts` + `scene/worldLocations.ts` + `scene/environmentScene.ts` | Outros jogadores já partilham a cidade (presença por mundo/sala); sem dep nova | ✅ **feito** |

> **Reafinação D3/D4 (2026-10-13):** o bloom e os god rays liam-se exagerados
> sobre a imagem em sRGB. `BLOOM` strength 0.6→0.3 e threshold 0.82→0.9;
> `GODRAYS` intensity 0.5→0.24 e threshold 0.72→0.84; vinheta 0.8→0.68.

Gates de cada item D: `typecheck · lint · vitest` verdes; verificação de runtime
via `?audit` (passes do composer, projeção do sol, fluxo de rede do duelo).

### Sequência de execução

`A1 ✅ → B4 ✅ → B6 ✅ → A2 ✅ → B5 ✅ → C7 ✅ → Menu de mundo 3D ✅ → B8 ✅ → A3 (céu como estado) ✅ → saudação 👋 (3D real, ossos) ✅ → duelos de sombras ✅ → **duelo PvP entre avatares** ✅ → **bloom + vinheta** ✅ → **god rays** ✅ → **SSAO (opt-in `?ssao`)** 🟡 → **clima/chuva (D7)** ✅ → **cidade alien maior (D8)** ✅`.

> **Fila seguinte (proposta, a confirmar com o utilizador):** *andar vs correr*
> com velocidade de locomoção ligada à velocidade real da animação (menos
> escorregamento) → *olhar de lado* por ossos (pescoço/cabeça, como a saudação)
> → *entrar em casas / interiores* → *dormir e acordar dentro de casa*.

Critério duro: cada item entra com o gate verde (`typecheck · lint · vitest`) e,
quando aplicável, com teste de paridade (TS↔C++/wasm) antes de virar "núcleo".

### Fontes de referência externa

O que podemos (e não podemos) aproveitar de 5 repositórios pedidos pelo
utilizador (Project-Summer-Island, GDevelop, 3d-game-shaders-for-beginners,
pascalorg/editor, A-Frame) está documentado e licenciado com honestidade em
[`docs/REFERENCE_REPOS.md`](./REFERENCE_REPOS.md). Nenhum entra como
dependência nova; o mais acionável (pascalorg/editor, MIT, MCP) informa o futuro
editor de cenários do pilar UGC.

## Pipeline de assets (áudio e texturas)

Para "áudio e texturas melhores" sem estourar o budget de bundle:

1. **Áudio**: ficheiros em `public/assets/audio/*` (CC0 ou produção própria —
   o utilizador afirma ser o autor do conteúdo original). Associação por mundo em
   `src/engine/audio.ts`.
2. **Texturas**: CC0 (ex.: Poly Haven) em `public/assets/textures/`, convertidas
   para **ktx2/basis** (já usado para `skyflow`/`sea`) para carregar só o
   necessário. Manter o orçamento de `bundle-size.json` como gate.
3. **SFX procedurais**: `src/engine/sfx.ts` (WebAudio) acrescenta som sem peso.

## Riscos e limites honestos

- **Arte/música de estúdio** não são geradas pelo agente — somos integradores:
  placeholders bons + assets CC0/do autor.
- **Moderação** não é viável na Fase 1; é um requisito de Fase 2+ antes de abrir
  UGC ao público.
- **Escala**: P2P é ótimo até ~dezenas por sala; acima disso precisa de
  servidor-authoritative híbrido (Fase 4).
- **Licenças**: revisar os assets do port original antes de uso comercial — o
  autor afirma ser o detentor; manter o inventário de licenças em `docs/`.

## Como contribuir para este roadmap

Cada fase entra como sprint com o gate existente (CI + E2E não-bloqueante).
As preferências de sprints ficam registadas nas decisões de cada sessão; este
documento é atualizado em conjunto com as entregas.