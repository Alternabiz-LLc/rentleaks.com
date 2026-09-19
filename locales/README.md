# Locales

French and German, as path-prefixed trees: `/fr/` and `/de/`.

```
locales/fr.json      the source of truth for French — edit this
locales/fr.ui.js     generated: the half the browser needs, as a script
fr/*.html            generated: the pages
sitemap-fr.xml       generated
```

Rebuild after any edit:

```bash
node tools/build-locales.mjs          # or: … build-locales.mjs fr
node tools/generate-seo-pages.js      # so English names the new URLs back
node tools/check-locales.mjs          # must pass before you commit
```

## Why it is split in two

The site's chrome is not in the HTML. `script.js` writes the header, the
footer, the modals, the filter rail and every listing card into the page after
load, and three other modules write more. So there are two problems, and they
need different answers.

**The copy a crawler must see** — titles, descriptions, headings, FAQ answers,
JSON-LD — is baked into the file at build time by `tools/build-locales.mjs`.
A page that only becomes French once JavaScript runs is, to Google, an English
page.

**The chrome** is translated at runtime by `rentleaks-i18n.js`, which holds a
dictionary keyed by the English string those modules already emit and swaps
each one as it appears in the DOM. The alternative — threading a `t()` call
through ten thousand lines of four modules — is the version that breaks the
live site. A key that is missing simply leaves the English standing, so a
partial dictionary is always safe to ship.

Strings with a number in the middle — `19% under market`, `3 housemates`,
`from Oct 15, 2026` — can never match an exact key, so they go through
`patterns` instead: a regex per shape, with `{1}` for the capture. Three
helpers are available inside a replacement: `{1:sqm}` converts square feet to
square metres, `{1:mon}` maps an English month abbreviation, and `{1:t}` sends
the capture back through the dictionary.

A card's spec line is four facts glued with ` · ` at render time, so the whole
line is never a key either. The runtime splits on that separator and looks up
each part on its own.

## Terminology

The point of doing this by hand rather than by machine is that each market has
its own word, and the market's own word is the one with search volume behind it.

| English | French | German |
|---|---|---|
| all-in rent | loyer tout compris | **Warmmiete** |
| lease-break | reprise de bail | **Nachmieter** |
| room | chambre en colocation | **WG-Zimmer** |
| housemate | colocataire | Mitbewohner |
| 1-month+ | 1 mois et + | Wohnen auf Zeit |
| broker fee | honoraires d'agence | Maklerprovision |
| deposit | dépôt de garantie | Kaution |

None of those is what a translation of the English produces.

## What is deliberately not translated

- **`listings/*.html`** — 662 pages of host-written English. Machine-translating
  someone's description of their own flat and publishing it under their name is
  not ours to do. Links from a locale page go to the English listing.
- **`enterprise/`, `hire-a-broker/`** — brokerage terms that only hold in the
  jurisdictions they name.
- **The lease-break packet, the verification desk, the listing wizard** — these
  turn on statute. A French renter reading a wrong French summary of Article 8
  of the 1989 law is worse off than one reading the English and knowing to
  check. These stay English until a lawyer in-market reads them.

The hreflang cluster does not claim a translation exists for any of them: a
page with no counterpart emits `x-default` alone.

Where a rule *is* named, it is named as the law names it — *bail mobilité*,
*Zweckentfremdungsverbot*, § 553 BGB — not translated and translated back.

## Adding a locale

1. Copy `locales/fr.json` to `locales/<code>.json` and translate it. The
   `_comment` block at the top says what each section feeds.
2. Add the code to three lists — `LOCALE_DIRS` in `script.js`, `LOCALES` in
   `rentleaks-i18n.js`, and `LOCALES` in `tools/generate-seo-pages.js`. The
   duplication is deliberate: they are small, they change together, and the
   alternative is a build dependency between generators that otherwise do not
   know about each other. `tools/check-locales.mjs` fails if they drift.
3. Rebuild and run the checker.
