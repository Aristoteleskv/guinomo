# Referência: `Bitstrips-Assets-master`

Avaliação dos assets descompilados do **Bitstrips** (o criador 2D de
avatares/comics) e o que foi — e não foi — aproveitado no Guinomo. O objetivo é
registar a decisão para não se repetir a análise nem se reintroduzir arte com
problemas de licença.

## O que é

Dump descompilado de **três apps Flash 2D** (`CharBuilder`, `ComicBuilder`,
`SceneBuilder`), cada uma com os mesmos tipos de ficheiros:

| Tipo | Qtde | Conteúdo |
|---|---|---|
| `.png` | 1935 | sprites/raster |
| `.svg` | 703 | **shapes** vetoriais: corpo, cabelo, olhos, boca, roupa |
| `.as` | 1198 | ActionScript descompilado (`BodyBuilderAS`, `EyeMouthUI`, `PoseUI`, `StanceUI`, `hair_colour`, `clothes_colour`, `Blinker`, …) |
| `.ttf` | 39 | fontes |
| `.swf` | 3 | bins Flash |
| `.bin` | 3 | `…BS_fr.bin`, 9 959 bytes, **os três idênticos** |

### Sobre os `.bin` (o falso "avatar.bin")

Não há `avatar.bin`. Os 3 `.bin` são `DefineBinaryData` do Flash (header
`DE 12 04 95`, sufixo `_BS_fr` = bundle francês) — **não** são geometria e
**não** estão no formato Draco do motor. Não passam no `DRACOLoader`.

## O que encaixa no nosso código

- O avatar 3D do Guinomo é o **`kid.bin`** + `kid-bones.bin` + clips,
  personalizado por **DNA** (`php/avatar.php`) e tinta no shader.
- O caminho 2D é o SVG de `php/avatar.php?uid=N`, usado nas name tags e no
  perfil (`<img src>`).

Como o Bitstrips é 2D vetorial, **não alimenta** o avatar 3D. O ganho real está
no SVG 2D e na taxonomia de partes.

## Aplicado agora

- **`php-integration/avatar.php`**: avatar SVG passou de 3 formas (rect +
  círculo + path) para um avatar determinístico com **cabelo** (6 estilos +
  cor), **olhos** (4), **boca** (4), óculos, chapéu e sardas. Tudo **desenhado
  por nós**, escolhido por `uid` via `avatar_pick()` (estável em reload).
  Os traços vão também no JSON como chaves aditivas (`hair-style`, `hair-hex`,
  `eye-style`, `mouth-style`, `accessory`, `freckles`); o cliente 3D ignora-as,
  logo o contrato `shirt-hex`/`skin-hex`/`hat-visible` mantém-se.
- **`php-integration/README.md`**: documenta a taxonomia e as chaves aditivas.
- **Arte vendorizada** em `public/assets/bitstrips/` (2 646 ficheiros, 4,3 MB):
  `.svg` (703), `.png` (1935), `.jpg` (1) e 7 fontes `.ttf` deduplicadas, com a
  estrutura original (`shapes/`, `sprites/`, `buttons/`, …) por builder
  (`character-builder`, `comic-builder`, `scene-builder`). O `vite build` copia
  para `dist/assets/bitstrips/` (o budget de bundle continua verde). Ver o
  `README.md` dessa pasta para layout, fontes e aviso de licença.

## Rejeitado (por agora)

- **Runtime SWF** e os `.bin` Flash: incompatíveis e mortos.
- **Editor de avatar / comics 3D**: fora de âmbito; exigiria tocar no pipeline
  3D (`fragment.glsl`, `characters.ts`) e no editor (`ui.ts`).

## Se quisermos mais

- **Mais partes 2D**: seguir a taxonomia (`PoseUI`/`StanceUI`/`EyeMouthUI`) e
  desenhar novos estilos em `avatar_svg()`, mantendo chaves aditivas.
- **Emotes/stickers no chat**: as poses do Bitstrips inspiram stickers, mas
  exigem integração em `ui.ts` (não fazer sem coordenar).
- **Morfos/expressões**: `morphshapes` + `Blinker.as` como inspiração para
  animação facial futura.

## Licenças

- Bitstrips: **proprietário** (Snap Inc.), sem licença aberta; assets
  descompilados. Foram vendorizados por decisão explícita do dono do projeto,
  que afirma estar a tratar dos direitos diretamente com a Snap. Se essa
  autorização não se confirmar, **apagar `public/assets/bitstrips/`** — nada na
  app depende dele ainda.
- Fontes: `Verdana` e `Arial Rounded MT Bold` são de terceiros (Microsoft /
  Monotype) e trazem a sua própria licença; `CreativeBlock BB` é a fonte interna
  do Bitstrips.
- O que foi produzido em `avatar.php` é autoral do projeto.
