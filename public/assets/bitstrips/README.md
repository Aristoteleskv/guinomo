# Bitstrips assets (vendored art)

Art extracted from the decompiled **Bitstrips** Flash apps (`CharBuilder`,
`ComicBuilder`, `SceneBuilder`). Vendored here so the deployed build can serve
it from `public/assets/bitstrips/`.

> **Licensing / provenance.** Bitstrips is proprietary (Snap Inc.). These files
> come from a third-party decompilation of the shipped SWFs, not from an open
> licence. They were vendored on the **project owner's explicit instruction**,
> who states they are clearing the rights directly with Snap. If that
> clearance is not confirmed, **delete this folder** — nothing in the app
> depends on it yet.

## Layout

```
bitstrips/
  character-builder/   shapes/  sprites/  buttons/  images/  morphshapes/  frames/
  comic-builder/       shapes/  sprites/  buttons/  images/  morphshapes/  frames/
  scene-builder/       shapes/  sprites/  buttons/  images/  morphshapes/  frames/
  fonts/               (deduped, see below)
```

- `shapes/*.svg` and `sprites|images|buttons|morphshapes|frames/*.png` keep the
  original `DefineShape_N` / `DefineSprite_N` names and sub-folder structure,
  so they still line up with each builder's `symbols.csv` (kept in the source
  dump, not here).
- Only `.svg`, `.png`, `.jpg` and fonts are included. The decompiled
  ActionScript (`.as`), text dumps (`.txt`), the compiled apps (`.swf`) and the
  Flash `binaryData` (`.bin`) were **not** copied — they are source/build
  artefacts, not deployable art.

## Fonts

The 39 embedded `.ttf` in the dump are per-app glyph **subsets** (Flash embeds
only the glyphs each app used), and most are the same face repeated. Deduped to
one file per face, largest copy kept:

| File | Source name(s) |
|---|---|
| `Verdana.ttf` | `Verdana` |
| `Verdana-Bold.ttf` | `com.bitstrips.BitStrips_fontvb__Verdana` |
| `ArialRoundedMTBold.ttf` | `Arial Rounded MT Bold` |
| `CreativeBlockBB-Regular.ttf` | `CreativeBlock BB`, `com.bitstrips.BitStrips_font__CreativeBlock BB` |
| `CreativeBlockBB-Italic.ttf` | `com.bitstrips.BitStrips_fonti__CreativeBlock BB` |
| `CreativeBlockBB-Bold.ttf` | `CreativeBlock BB Bold`, `com.bitstrips.BitStrips_fontb__CreativeBlock BB` |
| `CreativeBlockBB-BoldItalic.ttf` | `com.bitstrips.BitStrips_fontbi__CreativeBlock BB` |

`Verdana` and `Arial Rounded MT Bold` are third-party fonts that happen to be
embedded in the SWFs — they carry their own vendor licences (Microsoft /
Monotype) on top of the Bitstrips question. `CreativeBlock BB` is the
Bitstrips in-house face.

## Using

Reference with the Vite base (`./`) so it works in any sub-folder:

```html
<img src="./assets/bitstrips/character-builder/sprites/DefineSprite_12.png" />
```

```css
@font-face {
  font-family: 'CreativeBlock BB';
  src: url('./assets/bitstrips/fonts/CreativeBlockBB-Regular.ttf') format('truetype');
  font-weight: 400;
}
```

Note: nothing in the app imports these yet; this is vendored art for a future
avatar/comic feature.
