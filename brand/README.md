# Brand artwork

`rentleaks-logo.pdf` is the logo as supplied: the line-art phone-and-house
mark, the Kaushan Script wordmark, and the tagline, cream on #0E67B4.

`rentleaks-mark.pdf` is the mark on its own, rebuilt from the supplied
file's vector paths. It exists because the mark cannot be cropped out of
the original: the wordmark's "R" crosses it, and the tagline's "D" sits
under its lower right. Redrawing the paths is the only way to get the
mark whole and alone.

## Colours

| Token | Value | Where |
|---|---|---|
| Brand blue | `#0E67B4` | App icon, splash |
| Cream | `#F7F3E8` | The artwork itself |
| Line art | `#BFBDB8` | The mark, as drawn in the source |

## The app's assets are generated, not hand-edited

`mobile/assets/*` comes from these two files. The mark is optically
thickened for the icon — at 60pt the hairlines of the original disappear
entirely, so the icon uses a dilated copy. That is an adaptation for size,
not a redraw: the geometry is unchanged.

The in-app logo (`logo-lockup.png`) is white on transparency and tinted at
runtime to the theme's ink, so the logo never carries a second background
colour into a screen. The brand blue stays where it belongs — the icon and
the launch screen.

## The web logo

`images/rentleaks-mark.svg` and `web/public/brand/rentleaks-logo.svg` are the
mark and the full lockup as vectors, drawn in `currentColor` so one file
serves light and dark. The static site inlines the lockup in `script.js`;
the Next app paints it through a CSS mask, because `globals.css` needs the
colour to follow the theme token rather than a fill baked into the file.
