# Locales

French, German and Italian, as path-prefixed trees: `/fr/`, `/de/` and `/it/`.

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

Italian is the one where a literal translation is actively wrong. **`affitto
breve` is not "short-term" here** — in Italian law a *locazione breve* is a let
of under 30 days (art. 4, DL 50/2017), the regime with the cedolare secca, the
portal withholding and the CIN, which is exactly what this site refuses to
list. The product is the *contratto di locazione transitoria*, 1 to 18 months
under art. 5 of legge 431/1998. The Italian pages say **affitto transitorio**
throughout, and the FAQ says outright that the 30-day floor keeps the site out
of the *locazione breve* regime.

Italian also uses `tu` where French uses *vous* and German *Sie*. That is
deliberate: Italian consumer housing sites all address the renter informally.

None of those is what a translation of the English produces.

## Pages with no translated URL

662 listing pages, 93 operator pages, `enterprise/` and `hire-a-broker/` are
single-URL on purpose: their body is the host's own prose or jurisdiction-bound
brokerage terms, and publishing three near-identical copies is duplicate
content that hreflang does not rescue.

But the valuable half of a listing page is not the host's paragraph — it is the
fee ledger, the rules engine, the trust ledger and the takeover desk, all of
which the dictionary covers. So `rentleaks-i18n.js` remembers the language a
visitor was last reading (`rl_lang` in localStorage) and, on an English URL,
loads that dictionary and translates the chrome and those panels on top of the
English body. The canonical page stays English in the source, where a crawler
reads it; nothing this does changes what is indexed. Choosing EN in the
switcher on such a page clears the preference rather than navigating.

## Listing titles

All 662 are template output from `data.js` — see the `title = ...` assignments
around lines 712-786 — not host prose, so they are translated by pattern, at
build time *and* at runtime. `tools/add-title-patterns.py` holds the five
shapes. The neighbourhood inside each title is a proper noun and stays put.

The same applies to the `alt` text, which wraps a title inside a sentence; the
`{1:t}` helper sends a capture back through the full lookup so the inner title
is matched by its own rule.

## City names

`cityNames` in each locale file maps the exonyms that genuinely differ —
Cologne/Köln, Rome/Roma, Geneva/Genève. `data.js` stores the English name, so
without this the German tree said "Flexibles Wohnen in Cologne". Only names
that actually change are listed; a map full of identities is a map nobody
trusts.

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
   `rentleaks-i18n.js`, and `LOCALES` in `tools/generate-seo-pages.js`, plus the
   two `sitemap-<code>.xml` lines in that file's sitemap index and robots.txt. The
   duplication is deliberate: they are small, they change together, and the
   alternative is a build dependency between generators that otherwise do not
   know about each other. `tools/check-locales.mjs` fails if they drift.
3. Rebuild and run the checker.
