/**
 * Builds the French and German trees.
 *
 *     node tools/build-locales.mjs            # every locale in locales/
 *     node tools/build-locales.mjs fr         # just one, while you edit it
 *
 * Output, per locale <c>:
 *
 *   <c>/*.html            the core pages and the six stay-type pages
 *   <c>/cities/*.html     one page per market, all of them
 *   locales/<c>.ui.js     the runtime dictionary rentleaks-i18n.js reads
 *   sitemap-<c>.xml       that locale's own sitemap
 *
 * Why path prefixes and not a query string, a cookie or a client-side swap:
 * Google needs one crawlable URL per language, and it needs the three of them
 * to point at each other. A page that renders French only after JavaScript
 * runs is, to a crawler, an English page. So the French is in the file.
 *
 * What is NOT translated, deliberately:
 *   listings/*.html   662 pages of host-written English prose. Machine-
 *                     translating someone's description of their own flat and
 *                     publishing it under their name is not ours to do.
 *   enterprise/, hire-a-broker/
 *                     Both carry brokerage terms that only hold in the
 *                     jurisdictions they name.
 *   the lease-break packet, the verification desk, the listing wizard
 *                     These turn on statute. A French renter reading a wrong
 *                     French summary of Article 8 of the 1989 law is worse off
 *                     than one reading the English and knowing to check.
 * Links to those from a locale page resolve to the English page on purpose;
 * the hreflang cluster does not claim a translation exists for them.
 *
 * Coupled to tools/generate-seo-pages.js: the <head>, the chrome and the
 * listing card are the same markup, reproduced here rather than imported
 * because that file runs its writers on load. If you change a card there,
 * change it here.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://rentleaks.com";
const OG = SITE + "/images/og-default.jpg";
const ICON =
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%233795A6'/><text x='16' y='22' font-size='14' font-weight='bold' fill='%23F1F9FA' text-anchor='middle' font-family='system-ui'>RL</text></svg>";
const FONTS =
  '<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">';

/* ------------------------------------------------------------------ *
 * Data
 * ------------------------------------------------------------------ */

const ctx = { window: {}, localStorage: { getItem: () => null, setItem() {} }, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, "data.js"), "utf8"), ctx);
const DATA = ctx.window.RENTLEAKS_DATA;
const LISTINGS = DATA.listings.filter((l) => !String(l.id).startsWith("mine-"));

const LOCALE_DIR = path.join(ROOT, "locales");
const CODES = fs
  .readdirSync(LOCALE_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""));

/* Every locale, English included, so hreflang can be emitted reciprocally.
   English has no directory; it is the tree at the root. */
const ALL = ["en", ...CODES.filter((c) => c !== "en")];
const DIR_OF = Object.fromEntries(ALL.map((c) => [c, c === "en" ? "" : c]));
const TAG_OF = { en: "en-US" };

/* Pages that exist in all three trees. Kept in step with the same list in
   rentleaks-i18n.js — a page here but not there gets a switcher link that
   404s, a page there but not here gets an hreflang pointing at nothing. */
const TRANSLATED_PATHS = new Set([
  "",
  "rooms.html",
  "coliving.html",
  "furnished.html",
  "short-term.html",
  "aparthotel.html",
  "lease-break.html",
  "rent.html",
  "cities.html",
  "match.html",
  "list.html",
  "professionals.html",
  "operators.html",
  "faq.html",
  "contact.html",
  "privacy.html",
  "terms.html",
  "404.html",
  ...DATA.cities.map((c) => `cities/${c.slug}.html`),
]);

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* Copy that carries its own markup — a paragraph with a link in it — is
   written as HTML in the locale file and must not be escaped again. */
const raw = (s) => String(s == null ? "" : s);

function fill(tpl, vars) {
  return String(tpl).replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined ? m : vars[k]));
}

function jsonLd(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
}

function urlFor(code, neutral) {
  return SITE + "/" + (DIR_OF[code] ? DIR_OF[code] + "/" : "") + neutral;
}

/* The hreflang cluster. Reciprocity is the whole point: a set of pages that
   name each other is a cluster Google honours, and a one-way list is one it
   ignores. x-default goes to English because that is the widest audience the
   site has, not because English outranks the others. */
function alternates(neutral) {
  if (!TRANSLATED_PATHS.has(neutral)) {
    // No counterparts: say so by naming only this page, rather than claiming
    // translations that do not exist.
    return `\n  <link rel="alternate" hreflang="x-default" href="${urlFor("en", neutral)}">`;
  }
  const rows = ALL.map(
    (c) => `\n  <link rel="alternate" hreflang="${TAG_OF[c] || c}" href="${urlFor(c, neutral)}">`
  );
  rows.push(`\n  <link rel="alternate" hreflang="x-default" href="${urlFor("en", neutral)}">`);
  return rows.join("");
}

function money(n, currency, L) {
  const cur = currency || "EUR";
  try {
    return new Intl.NumberFormat(L.dateLocale, {
      style: "currency",
      currency: cur,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(Number(n) || 0));
  } catch (e) {
    return Math.round(Number(n) || 0).toLocaleString() + " " + cur;
  }
}

const T = (L, s) => (L.ui && L.ui[s]) || s;

/* A city's name in the page's own language. data.js stores the English
   exonym, which is how the German tree was saying "Flexibles Wohnen in
   Cologne" and the Italian one would have said "a Rome". Only the names that
   genuinely differ are listed; everything else falls through unchanged. */
const CITY = (L, name) => (L.cityNames && L.cityNames[name]) || name;

/* ------------------------------------------------------------------ *
 * The same translation the browser does, done here instead
 * ------------------------------------------------------------------ *
 * rentleaks-i18n.js can translate a card title after load, and it does. But
 * a crawler reads the file, not the page after JavaScript — so a French page
 * whose 111 card titles say "Sunny private room in Bushwick share" in the
 * source is, for those 111 strings, an English page. The titles are template
 * output from data.js, not host prose, so the same dictionary and the same
 * patterns apply; they are simply applied here as well.
 *
 * Deliberately a copy of the runtime logic rather than a shared module: this
 * file is ESM run by node, that one is a classic script the browser parses
 * before anything else. The two are checked against each other by
 * tools/check-locales.mjs.
 */
function makeTranslator(L) {
  const dict = Object.assign({}, L.cityNames || {}, L.ui || {});
  const rules = (L.patterns || []).map((r) => ({ re: new RegExp(r.re), to: r.to }));
  const months = L.months || {};

  const expand = (tpl, m, depth = 0) =>
    tpl.replace(/\{(\d+)(?::(\w+))?\}/g, (_, i, fn) => {
      const v = m[Number(i)];
      if (v === undefined) return "";
      if (fn === "sqm") return String(Math.round(Number(v) * 0.092903));
      if (fn === "mon") return months[v] || v;
      if (fn === "t") { const r = depth < 3 ? one(v, depth + 1) : null; return r === null ? v : r; }
      return v;
    });

  const one = (t, depth = 0) => {
    if (dict[t] !== undefined) return dict[t];
    for (const r of rules) {
      const m = r.re.exec(t);
      if (m) return expand(r.to, m, depth);
    }
    return null;
  };

  const SEP = " \u00b7 ";
  return function tr(text) {
    const t = String(text == null ? "" : text).trim();
    if (t.length < 2) return text;
    let hit = one(t);
    if (hit === null && t.includes(SEP)) {
      let any = false;
      const parts = t.split(SEP).map((p) => {
        const v = one(p.trim());
        if (v === null) return p;
        any = true;
        return v;
      });
      if (any) hit = parts.join(SEP);
    }
    return hit === null ? text : hit;
  };
}

/* ------------------------------------------------------------------ *
 * <head>
 * ------------------------------------------------------------------ */

function head(L, { title, description, keywords, neutral, extra, geo, robots, type }) {
  const canonical = urlFor(L.locale, neutral);
  const indexable = !robots || /index/.test(robots) === true;
  const robot = robots || "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
  const aiBots = indexable ? "index, follow" : "noindex";
  const geoTags = geo
    ? `<meta name="geo.region" content="${esc(geo.region)}">
  <meta name="geo.placename" content="${esc(geo.place)}">
  <meta name="geo.position" content="${geo.lat};${geo.lng}">
  <meta name="ICBM" content="${geo.lat}, ${geo.lng}">`
    : "";
  return `<!DOCTYPE html>
<html lang="${L.htmlLang}">
<head>
  <script>(function(){try{var m=localStorage.getItem("rl_theme");if(m&&m!=="system")document.documentElement.setAttribute("data-theme",m);}catch(e){}})();</script>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="keywords" content="${esc(keywords)}">
  <meta name="abstract" content="${esc(description)}">
  <meta name="summary" content="${esc(description)}">
  <meta name="classification" content="Housing, Rentals, Real Estate">
  <meta name="category" content="Flexible housing marketplace">
  <meta name="distribution" content="global">
  <meta name="author" content="RentLeaks">
  <meta name="publisher" content="RentLeaks">
  <meta name="copyright" content="RentLeaks">
  <meta name="robots" content="${robot}">
  <meta name="googlebot" content="${indexable ? "index, follow, max-image-preview:large" : robot}">
  <meta name="bingbot" content="${aiBots}">
  <meta name="gptbot" content="${aiBots}">
  <meta name="oai-searchbot" content="${aiBots}">
  <meta name="claudebot" content="${aiBots}">
  <meta name="anthropic-ai" content="${aiBots}">
  <meta name="perplexitybot" content="${aiBots}">
  <meta name="google-extended" content="${aiBots}">
  <meta name="ai-content" content="${indexable ? "index, cite, train-ok" : "noindex"}">
  <meta name="ai-description" content="${esc(description)}">
  <meta name="language" content="${L.htmlLang}">
  <meta name="rating" content="general">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <meta name="format-detection" content="telephone=no">
  <meta name="theme-color" content="#3795A6">
  <meta name="color-scheme" content="light dark">
  <link rel="canonical" href="${canonical}">${alternates(neutral)}
  <link rel="alternate" type="application/json" title="RentLeaks catalog" href="${SITE}/listings.json">
  <link rel="sitemap" type="application/xml" href="${SITE}/sitemap-index.xml">
  <meta property="og:type" content="${type || "website"}">
  <meta property="og:site_name" content="RentLeaks">
  <meta property="og:locale" content="${L.ogLocale}">
${ALL.filter((c) => c !== L.locale && TRANSLATED_PATHS.has(neutral))
  .map((c) => `  <meta property="og:locale:alternate" content="${c === "en" ? "en_US" : localeOf(c).ogLocale}">`)
  .join("\n")}
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${OG}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(title)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${OG}">
  <meta name="dc.title" content="${esc(title)}">
  <meta name="dc.description" content="${esc(description)}">
  <meta name="dc.language" content="${L.htmlLang}">
  <meta name="dc.publisher" content="RentLeaks">
  <meta name="dc.identifier" content="${canonical}">
  ${geoTags}
  <link rel="icon" href="${ICON}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  ${FONTS}
  ${extra || ""}
</head>`;
}

/* ------------------------------------------------------------------ *
 * Body chrome
 * ------------------------------------------------------------------ */

/* depth is how far below the site root the file sits: /fr/index.html is 1,
   /fr/cities/paris.html is 2. Assets are always at the root, so every src
   here climbs all the way back up. */
function chrome(L, depth, main, bodyAttrs) {
  const up = "../".repeat(depth);
  return `
<body class="tahoe-body" ${bodyAttrs}>
  <div class="tahoe-bg" aria-hidden="true"><div class="tahoe-orb tahoe-orb--1"></div><div class="tahoe-orb tahoe-orb--2"></div><div class="tahoe-orb tahoe-orb--3"></div><div class="tahoe-orb tahoe-orb--4"></div><div class="tahoe-noise"></div></div>
  <a href="#main" class="skip-link">${esc(T(L, "Skip to main content"))}</a>
  <div class="tahoe-content">
    <div id="rl-header"></div>
    <main id="main">${main}</main>
    <div id="rl-footer"></div>
  </div>
  <script src="${up}locales/${L.locale}.ui.js"></script>
  <script src="${up}data.js"></script>
  <script src="${up}data-source.js"></script>
  <script src="${up}script.js"></script>
  <script src="${up}rentleaks-i18n.js"></script>
  <script src="${up}rentleaks-rules.js?v=20260913b"></script>
  <script src="${up}rentleaks-x.js?v=20260918" defer></script>
  <script src="${up}rentleaks-social.js?v=20260915-rentleaks.official" defer></script>
</body>
</html>`;
}

const css = (depth) => {
  const up = "../".repeat(depth);
  return `<link rel="stylesheet" href="${up}styles.css"><link rel="stylesheet" href="${up}rentleaks-x.css?v=20260913">`;
};

/* A listing card. Same markup as generate-seo-pages.js, with the price in the
   locale's own number format and the two badges translated. The link goes to
   the English listing page: those are not translated, and pointing at a URL
   that does not exist would be worse than a language seam. */
function card(L, l, depth) {
  const up = "../".repeat(depth);
  const tr = L.__tr || (L.__tr = makeTranslator(L));
  const shots = (l.images || []).length;
  const photos = L.locale === "de" ? `${shots} Fotos` : L.locale === "fr" ? `${shots} photos` : `${shots} photos`;
  return `<article class="listing-card" data-id="${esc(l.id)}" itemscope itemtype="https://schema.org/Accommodation">
    <a href="${up}${l.path}" class="listing-card__link" itemprop="url">
      <div class="listing-card__img-wrap">
        <img class="listing-card__photo" src="${l.image}" alt="${esc(tr(l.imageAlt))}" width="1400" height="933" loading="lazy" decoding="async" itemprop="image">
        ${l.video ? `<span class="listing-card__vid">${esc(T(L, "Video"))}</span>` : ""}
        ${shots > 1 ? `<span class="listing-card__shots">${esc(photos)}</span>` : ""}
      </div>
      <div class="listing-card__body">
        <p class="listing-card__price">${money(l.allIn, l.currency, L)}<span class="listing-card__period"> ${esc(T(L, "all-in /mo"))}</span></p>
        <h3 class="listing-card__title" itemprop="name">${esc(tr(l.title))}</h3>
        <p class="listing-card__address" itemprop="address">${esc(l.address)}</p>
        <p class="listing-card__specs">${esc(tr(l.specs))}</p>
      </div>
    </a>
  </article>`;
}

function website(L) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "RentLeaks",
    url: urlFor(L.locale, ""),
    description: L.pages.index.description,
    inLanguage: L.htmlLang,
    potentialAction: {
      "@type": "SearchAction",
      target: urlFor(L.locale, "rent.html") + "?q={query}",
      "query-input": "required name=query",
    },
  };
}

function breadcrumb(L, trail) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: t.name,
      item: urlFor(L.locale, t.neutral),
    })),
  };
}

/* ------------------------------------------------------------------ *
 * Pages
 * ------------------------------------------------------------------ */

function writeIndex(L, out) {
  const P = L.pages.index;
  const S = P.sections;
  const H = P.hero;
  const nCities = DATA.cities.length;
  const neutral = "";
  const main = `
      <section class="hero hero--split">
        <div class="hero__inner">
          <div class="hero__lead">
            <span class="hero__kicker">${esc(H.kicker)}</span>
            <h1 class="hero__title">${raw(H.title)}</h1>
            <p class="hero__subtitle">${esc(H.subtitle)}</p>
            <div class="hero__quick" id="rl-hero-quick"></div>
            <div class="trust-bar">
              <span class="trust-bar__item"><span class="trust-bar__value" id="trust-rent-count">0</span> ${esc(H.liveHomes)}</span>
              <span class="trust-bar__item"><span class="trust-bar__value" id="trust-city-count">${nCities}</span> ${esc(H.markets)}</span>
              <span class="trust-bar__item">${esc(H.freeLeaseBreak)}</span>
            </div>
          </div>
          <div class="rl-hero-carousel" id="rl-hero-carousel" aria-label="${esc(T(L, "Featured homes"))}"></div>
          <div class="search-card">
            <form class="search-form" action="rent.html" aria-label="${esc(T(L, "Search"))}">
              <div class="search-form__row">
                <div class="search-field search-field--city">
                  <select id="city" name="city" aria-label="${esc(T(L, "City"))}"><option value="">${esc(T(L, "All cities"))}</option></select>
                </div>
                <div class="search-field search-field--type">
                  <select id="housing-type" name="type" aria-label="${esc(T(L, "Stay type"))}"><option value="">${esc(T(L, "All stay types"))}</option></select>
                </div>
                <div class="search-field search-field--location">
                  <input type="text" id="location" name="q" placeholder="${esc(T(L, "Neighborhood"))}" aria-label="${esc(T(L, "Neighborhood"))}">
                </div>
                <div class="search-field search-field--price">
                  <input type="number" id="price-max" name="max" placeholder="${esc(T(L, "Any"))}" min="0" aria-label="${esc(T(L, "Max all-in"))}">
                </div>
                <div class="search-field search-field--stay">
                  <select id="min-stay" name="stay" aria-label="${esc(T(L, "Stay length"))}">
                    <option value="">${esc(T(L, "Any length"))}</option>
                    <option value="1">${esc(T(L, "1 month ok"))}</option>
                    <option value="3">${esc(T(L, "Up to 3 months"))}</option>
                    <option value="6">${esc(T(L, "Up to 6 months"))}</option>
                    <option value="12">${esc(T(L, "Up to 12 months"))}</option>
                  </select>
                </div>
                <button type="submit" class="btn btn--primary btn--search">${esc(T(L, "Search"))}</button>
              </div>
            </form>
          </div>
          <p class="hero__hint">${raw(H.hint)}</p>
        </div>
      </section>

      <section class="compliance-banner" aria-label="Fair Housing">
        <p class="compliance-banner__text">${raw(P.compliance)}</p>
      </section>

      <section class="categories-section">
        <div class="container">
          <div class="section-head animate-on-scroll">
            <div class="section-head__text">
              <span class="section-head__eyebrow">${esc(S.typesEyebrow)}</span>
              <h2 class="categories-title">${esc(S.typesTitle)}</h2>
              <p>${esc(S.typesBody)}</p>
            </div>
            <div class="section-head__action"><a class="btn btn--outline btn--sm" href="rent.html">${esc(S.typesCta)}</a></div>
          </div>
          <div class="rl-types animate-on-scroll" id="rl-types"></div>
        </div>
      </section>

      <section class="listings-section">
        <div class="container">
          <div class="rl-pulse animate-on-scroll" id="rl-pulse"></div>
          <div class="listings__top">
            <h2 class="listings__count" id="listings-count">${esc(S.featured)}</h2>
            <a class="btn btn--outline btn--sm" href="rent.html">${esc(S.seeAll)}</a>
          </div>
          <div class="listings__grid" id="listings-grid"></div>
        </div>
      </section>

      <section class="categories-section">
        <div class="container">
          <div class="section-head animate-on-scroll">
            <div class="section-head__text">
              <span class="section-head__eyebrow">${esc(S.citiesEyebrow)}</span>
              <h2 class="categories-title">${esc(fill(S.citiesTitle, { n: nCities }))}</h2>
              <p>${esc(S.citiesBody)}</p>
            </div>
            <div class="section-head__action"><a class="btn btn--outline btn--sm" href="cities.html">${esc(S.citiesCta)}</a></div>
          </div>
          <div class="rl-cities animate-on-scroll" id="rl-cities"></div>
        </div>
      </section>

      <section class="alerts-section">
        <div class="container">
          <span class="rl-kicker">${esc(S.dnaKicker)}</span>
          <h2 class="alerts-section__title">${esc(S.dnaTitle)}</h2>
          <p class="alerts-section__subtitle">${esc(S.dnaBody)}</p>
          <ul class="alerts-features">${S.dnaList.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
          <a class="btn btn--primary btn--lg" href="match.html">${esc(S.dnaCta)}</a>
        </div>
      </section>

      <section class="categories-section">
        <div class="container">
          <div class="section-head animate-on-scroll">
            <div class="section-head__text">
              <span class="section-head__eyebrow">${esc(S.entEyebrow)}</span>
              <h2 class="categories-title">${esc(S.entTitle)}</h2>
              <p>${esc(S.entBody)}</p>
            </div>
            <div class="section-head__action"><a class="btn btn--primary btn--sm" href="../enterprise/">${esc(S.entCta)}</a></div>
          </div>
          <div class="rl-hero-menus animate-on-scroll">
            <a class="rl-hero-menus__link" href="../enterprise/brokerage.html">${esc(T(L, "Brokerage & leasing"))}</a>
            <a class="rl-hero-menus__link" href="../enterprise/marketing.html">${esc(T(L, "Marketing & virtual tours"))}</a>
            <a class="rl-hero-menus__link" href="../enterprise/management.html">${esc(T(L, "Property management"))}</a>
            <a class="rl-hero-menus__link" href="../enterprise/owners.html">${esc(T(L, "Out-of-state owners"))}</a>
          </div>
        </div>
      </section>

      <section class="categories-section">
        <div class="container">
          <div class="section-head animate-on-scroll">
            <div class="section-head__text">
              <span class="section-head__eyebrow">${esc(S.brokerEyebrow)}</span>
              <h2 class="categories-title">${esc(S.brokerTitle)}</h2>
              <p>${esc(S.brokerBody)}</p>
            </div>
            <div class="section-head__action"><a class="btn btn--primary btn--sm" href="../hire-a-broker/">${esc(S.brokerCta)}</a></div>
          </div>
          <div class="rl-hero-menus animate-on-scroll">
            <a class="rl-hero-menus__link" href="../hire-a-broker/#start">${esc(S.brokerSteps[0])}</a>
            <a class="rl-hero-menus__link" href="../hire-a-broker/#how">${esc(S.brokerSteps[1])}</a>
            <a class="rl-hero-menus__link" href="../hire-a-broker/#standards">${esc(S.brokerSteps[2])}</a>
            <a class="rl-hero-menus__link" href="../hire-a-broker/agents.html">${esc(S.brokerSteps[3])}</a>
            <a class="rl-hero-menus__link" href="../hire-a-broker/guide.html">${esc(S.brokerSteps[4])}</a>
          </div>
        </div>
      </section>

      <section class="professionals-cta">
        <div class="container">
          <span class="rl-kicker rl-kicker--light">${esc(S.hostKicker)}</span>
          <h2 class="professionals-cta__title">${esc(S.hostTitle)}</h2>
          <p class="professionals-cta__subtitle">${raw(S.hostBody)}</p>
          <a href="list.html" class="btn btn--dark btn--lg">${esc(S.hostCta)}</a>
        </div>
      </section>
`;
  const noscript = `
  <noscript>
    <section class="container rl-page">
      <h2>${esc(P.noscript.title)}</h2>
      <ul>
        ${Object.values(L.types).map((t) => `<li><a href="${t.file}">${esc(t.h1)}</a></li>`).join("\n        ")}
        <li><a href="cities.html">${esc(L.pages.cities.h1)}</a></li>
        <li><a href="../listings.json">${esc(P.noscript.catalog)}</a></li>
      </ul>
    </section>
  </noscript>`;

  const html =
    head(L, {
      title: P.title,
      description: P.description,
      keywords: P.keywords,
      neutral,
      extra: css(1) + jsonLd(website(L)),
    }) + chrome(L, 1, main + noscript, `data-page="home"`);
  write(out, "index.html", html);
}

function writeTypePages(L, out) {
  Object.entries(L.types).forEach(([id, copy]) => {
    const subset = LISTINGS.filter((l) => l.housingType === id);
    const neutral = copy.file;
    const main = `
  <div id="rl-page-hero"></div>
  <section class="container page-hero">
    <nav class="rl-crumb" aria-label="${esc(T(L, "Breadcrumb"))}"><a href="index.html">${esc(T(L, "Home"))}</a> / ${esc(copy.h1)}</nav>
    <h1>${esc(copy.h1)}</h1>
    <p>${esc(copy.blurb)}</p>
  </section>
  <section id="listings" class="listings-section">
    <div class="container">
      <h2 class="listings__count">${subset.length} ${esc(copy.countLabel)}</h2>
      <div class="listings__grid" id="listings-grid">${subset.map((l) => card(L, l, 1)).join("")}</div>
    </div>
  </section>`;
    const html =
      head(L, {
        title: copy.title,
        description: copy.description,
        keywords: copy.keywords,
        neutral,
        extra:
          css(1) +
          jsonLd(website(L)) +
          jsonLd(breadcrumb(L, [{ name: T(L, "Home"), neutral: "" }, { name: copy.h1, neutral }])) +
          jsonLd({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: copy.h1,
            description: copy.description,
            url: urlFor(L.locale, neutral),
            inLanguage: L.htmlLang,
            about: id,
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: subset.length,
              itemListElement: subset.slice(0, 20).map((l, i) => ({
                "@type": "ListItem",
                position: i + 1,
                url: SITE + "/" + l.path,
                name: makeTranslator(L)(l.title),
              })),
            },
          }),
      }) + chrome(L, 1, main, `data-page="browse" data-type="${id}"`);
    write(out, copy.file, html);
  });
}

function writeCityPages(L, out) {
  const dir = path.join(out, "cities");
  fs.mkdirSync(dir, { recursive: true });
  const C = L.city;
  DATA.cities.forEach((cityRow) => {
    const subset = LISTINGS.filter((l) => l.cityId === cityRow.id);
    const nhoods = (cityRow.neighborhoods || []).slice(0, 5).join(", ");
    const local = CITY(L, cityRow.name);
    const vars = { city: local, nhoods, n: subset.length };
    const neutral = `cities/${cityRow.slug}.html`;
    const title = fill(C.title, vars);
    const main = `
  <section class="container page-hero">
    <nav class="rl-crumb" aria-label="${esc(T(L, "Breadcrumb"))}"><a href="../index.html">${esc(T(L, "Home"))}</a> / <a href="../cities.html">${esc(T(L, "Cities"))}</a> / ${esc(local)}</nav>
    <h1>${esc(fill(C.h1, vars))}</h1>
    <p>${esc(fill(C.blurb, vars))}</p>
    <p>${(cityRow.neighborhoods || []).map((n) => esc(n)).join(" · ")}</p>
  </section>
  <section class="listings-section"><div class="container">
    <h2>${subset.length} ${esc(fill(C.countLabel, vars))}</h2>
    <div data-browse-scope="city" data-browse-value="${esc(cityRow.id)}">
      <div class="listings__grid">${subset.map((l) => card(L, l, 2)).join("")}</div>
    </div>
  </div></section>`;
    const html =
      head(L, {
        title,
        description: fill(C.description, vars),
        keywords: fill(C.keywords, vars),
        neutral,
        geo: cityRow.lat
          ? {
              region: (cityRow.country || "US") === "US" ? "US-" + cityRow.state : cityRow.country,
              place: cityRow.name,
              lat: cityRow.lat,
              lng: cityRow.lng,
            }
          : undefined,
        extra:
          css(2) +
          jsonLd(website(L)) +
          jsonLd(
            breadcrumb(L, [
              { name: T(L, "Home"), neutral: "" },
              { name: T(L, "Cities"), neutral: "cities.html" },
              { name: cityRow.name, neutral },
            ])
          ) +
          jsonLd({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: title,
            url: urlFor(L.locale, neutral),
            inLanguage: L.htmlLang,
            about: { "@type": "City", name: local, addressRegion: cityRow.state },
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: subset.length,
              itemListElement: subset.slice(0, 30).map((l, i) => ({
                "@type": "ListItem",
                position: i + 1,
                url: SITE + "/" + l.path,
                name: makeTranslator(L)(l.title),
              })),
            },
          }),
      }) + chrome(L, 2, main, `data-page="city" data-city="${cityRow.id}" data-static="1"`);
    fs.writeFileSync(path.join(dir, cityRow.slug + ".html"), html);
  });
  return DATA.cities.length;
}

/* The simple pages: a hero, then whatever the page's own JavaScript mounts. */
function simplePage(L, out, key, { bodyAttrs, main, extra, robots }) {
  const P = L.pages[key];
  const neutral = P.file === "index.html" ? "" : P.file;
  const html =
    head(L, {
      title: P.title,
      description: P.description,
      keywords: P.keywords,
      neutral,
      robots,
      extra: css(1) + jsonLd(website(L)) + (extra || ""),
    }) + chrome(L, 1, main, bodyAttrs);
  write(out, P.file, html);
}

function hero(L, P, extraHtml) {
  return `
  <div id="rl-page-hero"></div>
  <section class="container page-hero">
    <h1>${esc(P.h1)}</h1>
    <p>${esc(P.sub)}</p>
  </section>${extraHtml || ""}`;
}

function writeCorePages(L, out) {
  /* rent.html — the search page. The form is static so it works before the
     JavaScript lands and so a crawler sees the filters exist. */
  const R = L.pages.rent;
  simplePage(L, out, "rent", {
    bodyAttrs: `data-page="browse"`,
    main: `
      <section class="hero">
        <div class="hero__inner">
          <h1 class="hero__title">${esc(R.h1)}</h1>
          <p class="hero__subtitle">${esc(R.sub)}</p>
          <div class="search-card">
            <form class="search-form" action="rent.html" aria-label="${esc(T(L, "Search"))}">
              <div class="search-form__row">
                <div class="search-field search-field--city"><select id="city" name="city" aria-label="${esc(T(L, "City"))}"></select></div>
                <div class="search-field search-field--type"><select id="housing-type" name="type" aria-label="${esc(T(L, "Stay type"))}"></select></div>
                <div class="search-field search-field--location"><input type="text" id="location" name="q" placeholder="${esc(T(L, "Neighborhood or keyword"))}" aria-label="${esc(T(L, "Neighborhood"))}"></div>
                <div class="search-field search-field--price">
                  <input type="number" id="price-min" name="min" placeholder="${esc(T(L, "Min"))}" min="0" aria-label="${esc(T(L, "Min all-in"))}">
                  <span class="search-field__sep">–</span>
                  <input type="number" id="price-max" name="max" placeholder="${esc(T(L, "Max"))}" min="0" aria-label="${esc(T(L, "Max all-in"))}">
                </div>
                <div class="search-field search-field--stay">
                  <select id="min-stay" name="stay" aria-label="${esc(T(L, "Stay length"))}">
                    <option value="">${esc(T(L, "Stay length"))}</option>
                    <option value="1">${esc(T(L, "1 month ok"))}</option>
                    <option value="3">${esc(T(L, "Up to 3 months"))}</option>
                    <option value="6">${esc(T(L, "Up to 6 months"))}</option>
                    <option value="12">${esc(T(L, "Up to 12 months"))}</option>
                  </select>
                </div>
                <div class="search-field"><input type="date" id="move-in" name="moveIn" aria-label="${esc(T(L, "Move in by"))}"></div>
                <button type="submit" class="btn btn--primary btn--search">${esc(T(L, "Search"))}</button>
              </div>
            </form>
          </div>
        </div>
      </section>
      <section id="listings" class="listings-section">
        <div class="container">
          <div class="rl-adv">
            <label class="rl-check"><input type="checkbox" id="filter-furnished"> ${esc(T(L, "Fully furnished"))}</label>
            <label class="rl-check"><input type="checkbox" id="filter-pets"> ${esc(T(L, "Pets ok"))}</label>
            <label class="rl-check"><input type="checkbox" id="filter-bath"> ${esc(T(L, "Private bath"))}</label>
            <label class="rl-check"><input type="checkbox" id="filter-work"> ${esc(T(L, "Workspace"))}</label>
            <label class="rl-check"><input type="checkbox" id="filter-nofee"> ${esc(T(L, "No broker fee"))}</label>
            <label class="rl-check"><input type="checkbox" id="filter-utils"> ${esc(T(L, "Utilities included"))}</label>
            <label class="rl-check"><input type="checkbox" id="filter-verified"> ${esc(T(L, "Verified host"))}</label>
          </div>
          <div class="listings__top">
            <h2 class="listings__count" id="listings-count">0</h2>
            <div class="rl-view" role="group" aria-label="${esc(T(L, "View"))}">
              <button type="button" class="is-on" data-view="grid">${esc(T(L, "Grid"))}</button>
              <button type="button" data-view="list">${esc(T(L, "List"))}</button>
              <button type="button" data-view="map">${esc(T(L, "Map"))}</button>
            </div>
            <div class="listings__sort">
              <label for="sort">${esc(T(L, "Sort"))}</label>
              <select id="sort" name="sort">
                <option value="newest">${esc(T(L, "Newest"))}</option>
                <option value="price-asc">${esc(T(L, "All-in: low to high"))}</option>
                <option value="price-desc">${esc(T(L, "All-in: high to low"))}</option>
                <option value="move-in">${esc(T(L, "Soonest move-in"))}</option>
                <option value="match">${esc(T(L, "Best Stay DNA"))}</option>
              </select>
            </div>
          </div>
          <div class="listings__grid" id="listings-grid"></div>
          <div class="listings__empty" id="listings-empty" hidden></div>
          <div id="rl-suggest" class="rl-block" hidden></div>
        </div>
      </section>`,
  });

  simplePage(L, out, "cities", {
    bodyAttrs: `data-page="cities"`,
    main: hero(L, L.pages.cities, `
      <section class="rl-page"><div class="container"><div class="rl-city-directory" id="rl-city-directory"></div></div></section>`),
  });

  simplePage(L, out, "match", {
    bodyAttrs: `data-page="match"`,
    main: hero(L, L.pages.match, `
      <section class="rl-page"><div class="container" id="rl-match"></div></section>`),
  });

  simplePage(L, out, "list", {
    bodyAttrs: `data-page="list"`,
    main: hero(L, L.pages.list, `
      <section class="rl-page"><div class="container" id="rl-list"></div></section>`),
  });

  simplePage(L, out, "operators", {
    bodyAttrs: `data-page="operators"`,
    main: hero(L, L.pages.operators, `
      <section class="rl-page"><div class="container" id="rl-operators"></div></section>`),
  });

  /* professionals.html — the plan cards, priced in euro rather than converted
     from dollars on the fly: a published price is a commitment, not a rate. */
  const PR = L.pages.professionals;
  simplePage(L, out, "professionals", {
    bodyAttrs: `data-page="professionals"`,
    main: `
      <section class="hero">
        <div class="hero__inner">
          <h1 class="hero__title">${esc(PR.h1)}</h1>
          <p class="hero__subtitle" id="rl-pro-note">${esc(PR.sub)}</p>
          <a class="btn btn--primary" href="list.html">${esc(T(L, "List a place"))}</a>
        </div>
      </section>
      <section class="pricing-section">
        <div class="container">
          <div class="pricing-grid">
            ${PR.plans
              .map(
                (p, i) => `<article class="plan-card${i === 3 ? " plan-card--enterprise" : ""}">
              ${p.badge ? `<span class="plan-card__badge">${esc(p.badge)}</span>` : ""}
              <h3 class="plan-card__title">${esc(p.title)}</h3>
              <p class="plan-card__desc">${esc(p.desc)}</p>
              <div class="plan-card__price"><span class="plan-card__amount">${esc(p.amount)}</span>${p.period ? `<span class="plan-card__period">${esc(p.period)}</span>` : ""}</div>
              <ul class="plan-card__features">${p.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
              <a href="${p.href}" class="btn ${p.style} plan-card__cta">${esc(p.cta)}</a>
            </article>`
              )
              .join("\n            ")}
          </div>
          <p class="pricing-note">${esc(PR.note)}</p>
        </div>
      </section>`,
  });

  /* faq.html — the only page whose structured data is worth more than its
     copy: an FAQPage in French is what gets the French rich result. */
  const F = L.pages.faq;
  simplePage(L, out, "faq", {
    bodyAttrs: `data-page="faq"`,
    extra: jsonLd({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      inLanguage: L.htmlLang,
      mainEntity: F.items.map((it) => ({
        "@type": "Question",
        name: it.q,
        acceptedAnswer: { "@type": "Answer", text: it.a },
      })),
    }),
    main: `
      <section class="container page-hero">
        <h1>${esc(F.h1)}</h1>
        <p>${esc(F.sub)}</p>
      </section>
      <section class="faq-section">
        <div class="container">
          <div class="faq-list" itemscope itemtype="https://schema.org/FAQPage">
            ${F.items
              .map(
                (it) => `<article class="faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
              <h3 class="faq-q" itemprop="name">${esc(it.q)}</h3>
              <div class="faq-a" itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
                <p itemprop="text">${esc(it.a)}</p>
              </div>
            </article>`
              )
              .join("\n            ")}
          </div>
        </div>
      </section>`,
  });

  const CO = L.pages.contact;
  simplePage(L, out, "contact", {
    bodyAttrs: `data-page="contact"`,
    main: `
      <section class="container page-hero">
        <h1>${esc(CO.h1)}</h1>
        <p>${esc(CO.sub)}</p>
      </section>
      <section class="rl-page">
        <div class="container" style="max-width:640px">
          <form id="contact-form" class="form form-card">
            <div class="form-group"><label for="contact-name">${esc(T(L, "Name"))}</label><input id="contact-name" name="name" class="form-input" required></div>
            <div class="form-group"><label for="contact-email">${esc(T(L, "Email"))}</label><input type="email" id="contact-email" name="email" class="form-input" required></div>
            <div class="form-group"><label for="contact-topic">${esc(T(L, "Topic"))}</label>
              <select id="contact-topic" name="topic" class="form-input">
                <option>${esc(T(L, "Renter help"))}</option>
                <option>${esc(T(L, "Host / operator"))}</option>
                <option>${esc(T(L, "Report a listing"))}</option>
                <option>${esc(T(L, "Press"))}</option>
              </select>
            </div>
            <div class="form-group"><label for="contact-msg">${esc(T(L, "Message"))}</label><textarea id="contact-msg" name="message" class="form-input" rows="5" required></textarea></div>
            <button type="submit" class="btn btn--primary">${esc(T(L, "Send"))}</button>
          </form>
        </div>
      </section>`,
  });

  ["privacy", "terms"].forEach((key) => {
    const P = L.pages[key];
    simplePage(L, out, key, {
      bodyAttrs: `data-page="${key}"`,
      main: `
      <div class="container rl-page">
        <h1>${esc(P.h1)}</h1>
        ${P.body.map((p) => `<p>${raw(p)}</p>`).join("\n        ")}
      </div>`,
    });
  });

  const NF = L.pages["404"];
  simplePage(L, out, "404", {
    bodyAttrs: `data-page="404"`,
    robots: "noindex, follow",
    main: `
      <div class="container rl-empty">
        <h1>${esc(NF.h1)}</h1>
        <p>${esc(NF.sub)}</p>
        <p><a class="btn btn--primary" href="rent.html">${esc(T(L, "Browse homes"))}</a> <a class="btn btn--outline" href="cities.html">${esc(T(L, "Cities"))}</a></p>
      </div>`,
  });
}

/* ------------------------------------------------------------------ *
 * Runtime dictionary + sitemap
 * ------------------------------------------------------------------ */

/* Only the half rentleaks-i18n.js needs, as a script rather than JSON: it has
   to be parsed before the first paint, and a fetch cannot promise that. */
function writeRuntimeDict(L) {
  const payload = {
    locale: L.locale,
    htmlLang: L.htmlLang,
    currency: L.currency || "EUR",
    nav: L.nav || {},
    patterns: L.patterns || [],
    months: L.months || {},
    // Folded into ui rather than shipped separately: the sweep already does
    // exact-match lookup, and a city name is exactly that.
    ui: Object.assign({}, L.cityNames || {}, L.ui),
  };
  const js = `/* Generated by tools/build-locales.mjs from locales/${L.locale}.json — do not edit. */
window.RL_I18N=${JSON.stringify(payload)};
`;
  fs.mkdirSync(LOCALE_DIR, { recursive: true });
  fs.writeFileSync(path.join(LOCALE_DIR, `${L.locale}.ui.js`), js);
}

function writeSitemap(L) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    "",
    ...Object.values(L.types).map((t) => t.file),
    "rent.html",
    "cities.html",
    "match.html",
    "list.html",
    "professionals.html",
    "operators.html",
    "faq.html",
    "contact.html",
    "privacy.html",
    "terms.html",
    ...DATA.cities.map((c) => `cities/${c.slug}.html`),
  ];
  const body = urls
    .map((u) => {
      const links = ALL.map(
        (c) => `\n    <xhtml:link rel="alternate" hreflang="${TAG_OF[c] || c}" href="${urlFor(c, u)}"/>`
      ).join("");
      return `  <url>
    <loc>${urlFor(L.locale, u)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u === "" ? "daily" : "weekly"}</changefreq>
    <priority>${u === "" ? "1.0" : u.startsWith("cities/") ? "0.7" : "0.8"}</priority>${links}
    <xhtml:link rel="alternate" hreflang="x-default" href="${urlFor("en", u)}"/>
  </url>`;
    })
    .join("\n");
  fs.writeFileSync(
    path.join(ROOT, `sitemap-${L.locale}.xml`),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${body}
</urlset>
`
  );
  return urls.length;
}

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */

const LOADED = {};
function localeOf(code) {
  if (!LOADED[code]) {
    LOADED[code] = JSON.parse(fs.readFileSync(path.join(LOCALE_DIR, `${code}.json`), "utf8"));
  }
  return LOADED[code];
}

function write(out, file, html) {
  fs.writeFileSync(path.join(out, file), html);
}

function main() {
  const only = process.argv.slice(2);
  const codes = only.length ? only : CODES;
  const unknown = codes.filter((c) => !CODES.includes(c));
  if (unknown.length) {
    console.error(`Unknown locale(s): ${unknown.join(", ")}. Have: ${CODES.join(", ")}`);
    process.exit(1);
  }

  codes.forEach((code) => {
    const L = localeOf(code);
    if (!L.ui || !L.pages || !L.types) {
      console.error(`locales/${code}.json is missing ui, pages or types.`);
      process.exit(1);
    }
    const out = path.join(ROOT, L.dir);
    fs.mkdirSync(out, { recursive: true });

    writeRuntimeDict(L);
    writeIndex(L, out);
    writeTypePages(L, out);
    writeCorePages(L, out);
    const cities = writeCityPages(L, out);
    const urls = writeSitemap(L);

    const keys = Object.keys(L.ui).length;
    console.log(
      `${L.label.padEnd(9)} /${L.dir}/  ${13 + Object.keys(L.types).length} core pages, ${cities} city pages, ${keys} UI strings  ->  sitemap-${code}.xml (${urls} urls)`
    );
  });

  console.log(`\nlocales/*.ui.js rebuilt. Run tools/generate-seo-pages.js afterwards so the`);
  console.log(`English pages carry the matching hreflang, then commit both trees.`);
}

main();
