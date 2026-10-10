# Engajamento — guia das funcionalidades viciantes

Como funcionam as funcionalidades de retenção do Guinomo (estado atual e
próximos passos). Para jogadores e para quem desenvolve.

## Streak de visitas (🔥)

- Cada dia de visita soma 1 à sequência; **faltar um dia recomeça em 1**.
- Guardado em `localStorage` (`guinomo.streak.v1`); idempotente no mesmo dia
  (recarregar a página não conta duas vezes).
- Aos **7 dias** o badge no canto fica dourado e o **cartaz** ganha moldura
  dourada dupla com contador `🔥 N`.
- Código: `src/core/streak.ts` (lógica) + `src/components/streakHud.ts` + o
  desenho dourado em `src/engine/photo.ts`.

## Álbum de selos (🏅)

- 5 selos colecionáveis, um por segredo, com raridade **Comum / Raro / Lendário**.
- Lêem o mesmo armazenamento dos segredos (`guinomo_secrets`) — ao encontrares
  um segredo, o selo "acende" em tempo real (evento `webgl_secret_found`).
- O 6.º selo-mestre **👑 "Mestre dos Segredos"** acende quando o Grande Segredo
  é desbloqueado (5/5).
- Código: `src/scene/album.ts` + `src/scene/album.css` (botão flutuante
  bottom-left; painel PT por defeito, EN quando o perfil é inglês).

## Grande Segredo (👑 5/5)

- Quando encontrares os **5 segredos**, o finale desbloqueia **uma única vez**:
  overlay dourado bilingue, bónus de **+200 XP** (×2 na hora dourada) e o
  selo-mestre acende no álbum.
- Jogadores que já tinham os 5 segredos antes do finale recebem a marca
  **silenciosamente** ao carregar (sem repetir o modal).
- Disparado pelo momento do 5.º segredo ao vivo (`maybeUnlockGrandSecret`) e
  pela marca retroativa no load (`main.ts`), antes do sync inicial de troféus.
- Código: `src/core/secrets.ts` (estado único), `src/components/ui.ts`
  (`showGrandSecret` no overlay `#info`), `src/scene/album.ts` + `album.css`,
  evento `webgl_grand_secret_unlocked` em `src/main.ts`.

## Troféus persistidos no servidor (🏅 → perfil)

- Os selos sincronizam para o servidor via `api/guinomo/seals.php`:
  **POST** autenticado (uid da sessão = uid enviado + **HMAC aditivo**) grava o
  estado; **GET** público por `uid` devolve os troféus (para o perfil dos outros
  jogadores verem a tua coleção).
- Store por defeito em ficheiro (`lib/seals.php`, `.seals.json`); com
  `GUINOMO_DB_DSN` passa a usar a tabela `guinomo_seals` (PDO, em `schema.sql`).
- Sem `GUINOMO_UID` o sync é **inercial** (lê, não grava) — o jogo funciona
  normalmente sem servidor.
- Código: `src/core/sealsSync.ts` (TS), `php-integration/api/guinomo/seals.php`
  + `php-integration/lib/seals.php` (PHP), `tests/seals-sync.test.ts` + testes
  PHP em `tests/php/`.

## Celebração ao encontrar (🎉)

- No momento exato em que encontras um segredo, a personagem dá **dois saltos
  de alegria** (pedidos de salto à física — o segundo salta ao aterrar).
- Um **toast violeta** conta o progresso e guia o próximo passo — ex.:
  "🎉 Encontraste um segredo (2/5) — agora vai à procura do próximo: viaja para
  Cidade Tropical 🌴, a bússola aponta-te o caminho." (PT por defeito, EN se o
  perfil for inglês; no 5/5 o Grande Segredo toma conta da festa).
- A **bússola entra em modo quest**: a agulha aponta (com brilho dourado) para o
  **botão do Mapa de Mundos** — o caminho para viajar até ao próximo segredo — e o
  rótulo passa a "Próximo · 🌴 Cidade Tropical" com a pista "abre o Mapa de
  Mundos e viaja até lá". Aponta o próximo segredo, não o local.
- Ordem de busca em `src/core/secrets.ts` (`SECRETS`); lógica pura coberta por
  vitest (`tests/secrets.test.ts`, `tests/compass-guidance.test.ts`).
- Código: `src/scene/setpieces.ts` (salto), `src/main.ts` (toast),
  `src/components/compass.ts` + `compass.css` (modo quest).

## Bússola sussurrante (🗣️)

- A bússola aponta para o segredo do mundo e **sussurra** pistas cada vez mais
  precisas com a distância: "algo estranho espreita…" → "está mesmo ao lado".
- Com o segredo do mundo já encontrado (ou num mundo sem segredo), entra em
  **modo quest**: a agulha aponta para o botão do Mapa de Mundos, por onde se
  viaja para o próximo mundo com segredo (ver "Celebração").
- A seleção de pistas é lógica pura e testada: `src/core/compassGuidance.ts`
  (vitest em `tests/compass-guidance.test.ts`).

## Hora dourada (☀️)

- Janela diária de **10 min** a hora **variável** (determinística por dia —
  a mesma janela em todos os dispositivos) e **anunciada** pelo HUD.
- Durante a janela, segredos e descobertas dão **pontos a dobrar** e selos
  encontrados ficam gravados como **selos dourados** no álbum.
- Código: `src/core/goldenHour.ts` (lógica pura, testada em
  `tests/golden-hour.test.ts`) + `src/components/goldenHourHud.ts`.

## Cartaz dourado (📸⭐)

- Com **streak ≥ 7 dias**, o cartaz sai com moldura dourada dupla + contador de
  dias — o troféu visível do hábito diário.

## Par Extraordinário (👥)

- Vínculo ao vivo: quando tu e outro jogador ficam próximos (≤ **4 m**) no mesmo
  mundo, uma **linha dourada** carrega entre vocês; ao fim de ~**1,2 s** juntos o
  par forma-se (linha + auréolas no chão). Afastarem-se além de **6 m** quebra o
  vínculo (histerese, para não piscar ao passar).
- A primeira vez de cada dia com cada amigo dá **40 pontos de aventura** (×2 na
  hora dourada), um toast bilingue e o chip **👥 Par Extraordinário** no cartão
  de identidade acende; reencontrar o mesmo amigo no mesmo dia repete o efeito
  sem pontos.
- Código: `src/core/extraordinaryPair.ts` (máquina de estados pura, testada em
  `tests/extraordinary-pair.test.ts`), `src/scene/pairLinkScene.ts` (rendering)
  e `src/components/pairHud.ts` (chip + pontos).

## Próximos passos

- **Rastro de luz** ✨: o rasto colorido de um amigo no mundo (presença) —
  segui-lo até ao fim desbloqueia um cartaz a dois.
- **Guerra de mundos** ⚔️ e **cadeias de recados** 🧵 (ver
  `docs/METAVERSE_ROADMAP.md` → Engagement).