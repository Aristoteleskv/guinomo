# Referência: portado de `Imtiaj-Sajin/3dWeb` ("Warm Afternoon")

O que foi aproveitado deste repo Three.js (e porque), o que ficou para mais
tarde, e como usar o que cá está. O original é uma reimplementação *from
scratch*, em Three.js + Vite, do conceito *Summer Afternoon* do Vicente
Lucendo — a mesma inspiração do Guinomo — com multiplayer WebSocket simples
e server-authoritative.

Origem: https://github.com/Imtiaj-Sajin/3dWeb (commit `f113d090`)

## O que foi portado agora

### `src/core/socialGame.ts` (+ `tests/social-game.test.ts`)

Módulo puro (sem DOM, sem motor) com a parte **social** do design do
`shared/world.js` original — a filosofia de que o ranking premia a vida
social, não o conflito:

- `SCORE_WEIGHTS` / `scoreOf()` — ranking "social-first": ser cumprimentado
  vale **4**, cumprimentar vale **2**, e qualquer conflito vale menos (kill 1,
  morte −0.5). É um contrato único que o cliente *e* um futuro servidor
  autoritativo podem importar sem se afastarem.
- `ANIM` / `ANIM_CLIP` / `RESTING_ANIMS` — estados remotos como **inteiros
  pequenos** (menos bytes na rede), com o mapa para os clips de animação.
- `inSafeZone()` / `isProtected()` — "chão pacífico": zona circular (a praça
  da mostra) + quem está sentado/deitado em qualquer lado fica em tréguas.
- `pickLook()` / `TINTS` / `SCALES` / `shouldTintPart()` — variedade barata
  (14 tintas × 3 escalas, sem downloads nem draw calls extra) e a regra de
  **nunca tingir cara/cabelo** (cara verde lê-se como bug, não como variedade).
- `makeName()` / `NAME_WORDS` — nomes palavra+número para convidados/bots.

O módulo é **engine-free**: a equipa pode ligá-lo a uma futura tabela de
classificação, aos selos/conquistas, ou a um servidor de presença.

### `scripts/fetch-kaykit.mjs`

Busca sob demanda os modelos de personagens **KayKit (CC0)** do repo original
para `vendor/3dweb/kaykit/` (fora do git). Correr quando a pipeline de
avatares os suportar:

```sh
bun scripts/fetch-kaykit.mjs    # ou: node scripts/fetch-kaykit.mjs
```

### `vendor/3dweb/kaykit/KAYKIT_LICENSE.txt`

Licença CC0 dos modelos KayKit (obrigatório mantê-la ao lado dos modelos).
Binários `.glb`/`.png` estão ignorados no git.

### `scripts/kaykit2bins.mjs`

Converte um GLB KayKit (ex.: `vendor/3dweb/kaykit/Rogue.glb`) no conjunto
`.bin` que o motor carrega — malha esqueleto + clips — sem tocar em
`package.json`:

```sh
node scripts/kaykit2bins.mjs vendor/3dweb/kaykit/Rogue.glb \
  --draco "…/node_modules/draco3d" --verify --out out/ \
  --fps 24 --clips idle=Idle,run=Running_A,air=Jump_Idle,bored=Interact
```

Escreve `rogue.bin` (mesh), `rogue-bones.bin` (esqueleto) e uma `.bin` por
clip. O `--draco` aponta para um `draco3d` instalado fora do repo (ex.: pasta
temporária); sem ele o script grava payloads RAW e avisa que não são
runtime-ready. Decisões da conversão:

- **Mesh**: junta os primitives *skinned*; armas/capa (não-skinned) ficam de
  fora (acessórios são trabalho do motor). Zonas `colorInfo` derivam do nome
  do node (`Head` → pele, resto → camisa).
- **Esqueleto**: 41 bones do `skin.joints`, reordenados topologicamente com
  `JOINTS_0` remapeado; TRS local = `inv(bindWorld(parent)) ∘ bindWorld(bone)`.
- **Clips**: resampled a `--fps`; layout do motor `[frame][bone]`.
- **Encoder Draco**: `SetSpeedOptions(7, 7)` — o caminho default (lossy-fast)
  deste build produz streams corruptos em malhas reais, e a quantização por
  tipo é no-op para atributos `MeshBuilder`/GENERIC (a `NORMAL` até crashava).
  O encoder funde apenas vértices bit-idênticos em todos os atributos
  (217/3511 no Rogue) — sem conflitos de atributos no output.
- **Cabeça/boca**: as máscaras `fragment.glsl` (74/75/76/77) e o kid estão
  afinados para o `kid.bin`; o Rogue usa os códigos 74/1.5 (camisa) e 0/0.5
  (pele) — a tinta fina das expressões fica para uma fase futura.

## Porque é que os modelos `GLB` não entraram já

O motor do Guinomo **não carrega GLB**: a geometria do mundo vem em `.bin`
(formato do motor Lucendo) e o avatar é construído a partir do DNA do perfil
(`php/avatar.php`). Os 5 modelos KayKit (~2.3 MB cada) só fazem sentido quando
houver um carregador GLB/rig no motor — por isso ficam disponíveis via script,
não ocupam o repo.

## O que foi estudado e deixado de fora (por agora)

Ideias boas do original que sugerem features futuras, não código a portar já:

- **Autoridade no servidor** (`server/index.js`): o cliente só diz "ataquei";
  o servidor decide alcance/arco/cooldown/proteção com a sua cópia das
  posições. Padrão a seguir se o Guinomo ganhar minijogos físicos.
- **Rede lean** (`src/net.js`): só `x, z, heading, anim` no ar (o **Y nunca
  viaja**; cada cliente deriva a altura do terreno), throttling a 10 Hz, e
  parar de enviar quando parado. O Guinomo já tem presença via PHP — este é
  o formato a usar se a rede evoluir para WebSocket.
- **Fallback gracioso** (`serverCandidates()`): ordem `?server=` → env →
  alojado → localhost, com "a acordar o servidor…" e **modo solo com bots**
  se o socket falhar. A página nunca deixa de funcionar por causa do servidor.
- **Pipeline de redução GLB** (`scripts/prep-characters.mjs`): remove clips
  de animação não usados (`@gltf-transform` `dedup`/`prune`) — ~3.5 MB →
  ~0.9 MB por modelo. Aplicar quando integrarmos GLB.

## Licenças

- Modelos KayKit: **CC0** (Kay Lousberg) — `vendor/3dweb/kaykit/KAYKIT_LICENSE.txt`.
- Código do repo original: repo sem licença (todos os direitos reservados por
  omissão) — por isso **nada foi copiado verbatim**; o que entrou é a *ideia*
  reimplementada no estilo do Guinomo, e o resto fica documentado como
  referência.