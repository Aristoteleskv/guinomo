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
- Código: `src/scene/album.ts` + `src/scene/album.css` (botão flutuante
  bottom-left; painel PT por defeito, EN quando o perfil é inglês).

## Bússola sussurrante (🗣️)

- A bússola aponta para o segredo do mundo e **sussurra** pistas cada vez mais
  precisas com a distância: "algo estranho espreita…" → "está mesmo ao lado".
- A seleção de pistas é lógica pura e testada: `src/core/compassGuidance.ts`
  (vitest em `tests/compass-guidance.test.ts`).

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

- **Hora dourada** ☀️: janela diária anunciada (10 min, hora variável) com
  segredos raros e pontos a dobrar.
- **Rastro de luz** ✨: o rasto colorido de um amigo no mundo (presença) —
  segui-lo até ao fim desbloqueia um cartaz a dois.
- **Guerra de mundos** ⚔️ e **cadeias de recados** 🧵 (ver
  `docs/METAVERSE_ROADMAP.md` → Engagement).