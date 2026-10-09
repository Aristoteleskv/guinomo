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
| Emojis no chat | Renderizar emojis (já suportados como UTF-8) num seletor rápido junto ao input |
| **Festas/grupos** | Convidar vários amigos para a mesma `room`, manter rotação |
| Voz | WebRTC/Datachannel opcional com toggle de privacidade (P2P, sem servidor) |
| Moderação básica | Bloqueio/mute de utilizador P2P, reporte via PHP |

### Fase 3 — Persistência do mundo + UGC
- **Spawn persistente**: o utilizador volta para onde estava (guardado no servidor).
- **Criar/colocar objetos** (móveis simples, sinais, decorações) com gravação em DB.
- Segredos/colecionáveis como **troféus visíveis** no perfil (badges).
- **Economia soft**: moeda do mundo, lojas de cosméticos (cor/roupa/chapéu/papel).

### Fase 4 — UGC aberto + escala
- Ferramenta de construção (grid) com partilha de "terrenos" por sala.
- Marketplace P2P moderado (votação) para criações.
- Mobile-first, performance (DPR adaptativo já existe), acesso com conta única.
- **Monetização** apenas de cosméticos — nunca pay-to-win.

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