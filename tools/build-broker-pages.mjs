#!/usr/bin/env node
/**
 * Builds rentleaks.com/hire-a-broker/ — the tenant page (hire your own broker
 * in three steps) and the agent page (join the referral partner program) —
 * straight from the network module the app uses
 * (web/src/lib/network/core.ts), so the pages, the API and the agreements
 * can't disagree about a menu, a step or a fee type.
 *
 *   node --no-warnings tools/build-broker-pages.mjs
 *
 * Needs Node 22.18+ (it imports the TypeScript module directly). Writes
 * hire-a-broker/index.html and hire-a-broker/agents.html. The live numbers
 * (open or paused, referral %, answer window, covered markets) come from
 * /api/network at view time — no rebuild needed when they change.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://rentleaks.com";
const OG = `${SITE}/images/og-default.jpg`;
const OUT = path.join(ROOT, "hire-a-broker");
const V = "20260924";

const N = await import(pathToFileURL(path.join(ROOT, "web/src/lib/network/core.ts")).href);
const { HOME_TYPES, BUILDING_AGES, TERMS, MUST_HAVES, SPECIALTIES, LANGUAGES, LICENSE_TYPES, FEE_TYPES, TENANT_STEPS, PARTNER_STEPS, NETWORK_FAQ, GUIDES, GUIDE_CONSENT, GUIDE_PROMISE, ROSTER_SLOTS } = N;

const ctx = { window: {}, localStorage: { getItem: () => null, setItem() {} }, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, "data.js"), "utf8"), ctx);
const DATA = ctx.window.RENTLEAKS_DATA;
const cityCount = (DATA.cities || []).length;

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const shot = (id, w = 2000) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=72`;

/* ---- hero images ------------------------------------------------------
 * Each page takes its own photo from images/ if the file is there, and falls
 * back to the stock id when it isn't. Swapping a hero is therefore dropping a
 * file in and re-running this script — no code change, and never a broken
 * image while a photo is still being chosen.
 *
 *   images/hero-hire.jpg      the renter page
 *   images/hero-guide.jpg     the guides page
 *   images/hero-agents.jpg    the agents page
 *
 * Landscape, at least 2000px wide, and quiet on the left third — the kicker,
 * headline and lede sit there. No people in them: this is a housing site, and
 * a photo that pictures who lives somewhere is a fair-housing problem.
 */
const HERO = {
  tenant: { file: "images/hero-hire.jpg", stock: "photo-1502672260266-1c1ef2d93688" },
  guide: { file: "images/hero-guide.jpg", stock: "photo-1521791136064-7986c2920216" },
  partner: { file: "images/hero-agents.jpg", stock: "photo-1773069459487-3d2d7bb4532e" },
};
const heroUsed = [];
function heroImage(pg) {
  const h = HERO[pg.who] || HERO.tenant;
  if (h.file && fs.existsSync(path.join(ROOT, h.file))) {
    heroUsed.push(`${pg.file} \u2190 ${h.file}`);
    return `../${h.file}?v=${V}`;
  }
  heroUsed.push(`${pg.file} \u2190 stock ${h.stock}`);
  return shot(h.stock);
}

const ICON = {
  check: '<path d="M5 12l5 5L20 7"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4"/>',
  scale: '<path d="M12 3v18M5 21h14M6 7h12M6 7l-3 7a3 3 0 0 0 6 0zM18 7l-3 7a3 3 0 0 0 6 0z"/>',
  pen: '<path d="M4 20l4-1 11-11-3-3L5 16zM14 6l3 3M4 20h16"/>',
  lock: '<path d="M6 11h12v10H6zM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11M12 15v2"/>',
  key: '<path d="M14.5 9.5a4.5 4.5 0 1 1-2.2-3.9M12.3 13.4 4 21.7M7 18.7l2.3 2.3M9.6 16.1l2 2"/><circle cx="15.5" cy="8.5" r="1.2"/>',
  handshake: '<path d="M2 11l4-4 4 2 3-2 3 1 6 3M2 11l3 3M22 11l-4 4-3 3a1.5 1.5 0 0 1-2.1 0L7 12.5M11 15l2 2M13.5 12.5l2.5 2.5M9 17.5l1.5 1.5"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  chart: '<path d="M3 20h18M6 16v-5M11 16V8M16 16v-8M21 4l-5 4-5-3-5 4"/>',
  building: '<path d="M4 21V5l8-3v19M12 8h8v13M2 21h20M7 7h2M7 11h2M7 15h2M15 12h2M15 16h2"/>',
  home: '<path d="M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6"/>',
  sofa: '<path d="M4 11V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v3M2 13a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v5H2zM5 18v2M19 18v2"/>',
  users: '<path d="M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20v-.5A5.5 5.5 0 0 1 7.5 14h1a5.5 5.5 0 0 1 5.5 5.5v.5M16 4.2a3.5 3.5 0 0 1 0 6.6M17.5 14a5.5 5.5 0 0 1 4.5 5.4v.6"/>',
  star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>',
  mail: '<path d="M3 6h18v12H3zM3 7l9 6 9-6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
};
const HOME_ICON = { apartment: "building", room: "key", coliving: "users", furnished: "sofa", house: "home", luxury: "star" };
const icon = (name, size = 22) =>
  `<svg class="ent-ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ICON.check}</svg>`;

const PAGES = {
  tenant: {
    file: "index.html",
    who: "tenant",
    title: "Hire a Rental Broker in 3 Steps — Licensed Agents, Your Fee Cap | RentLeaks",
    description:
      "Tell us what you need, compare up to three licensed brokers who propose a fee at or under your cap, and sign one clear agreement in the app. Long or short term, new development or classic buildings.",
    keywords: "hire a rental broker, tenant broker, apartment broker NYC, renter's agent, tenant representation agreement, broker fee cap, FARE Act broker fee, find an apartment broker, relocation rental agent",
    kicker: "Hire a broker · Long & short term · New & classic buildings",
    h1: "Your own broker, <em>in three steps</em>",
    lede: "Tell us what you're looking for and the most you'll pay a broker. Licensed, verified agents who work your area send a short pitch and a fee at or under your cap. You pick one — or none — and sign one clear agreement right in the app.",
  },
  guide: {
    file: "guide.html",
    who: "guide",
    title: "Free Guides: The NYC Renter's Broker Playbook & Referral Partner Kit | RentLeaks",
    description:
      "Two free PDFs: how broker fees work after the FARE Act and how to hire an agent for a fee you set, and — for licensed agents — how the RentLeaks referral partner program works and what it pays.",
    keywords: "nyc broker fee guide, fare act explained renters, hire a broker guide, real estate referral program pdf, rental agent leads guide, broker fee calculator nyc, referral fee calculator",
    kicker: "Free guides · Renters & licensed agents",
    h1: "Two guides, <em>one honest page</em>",
    lede: "Whichever side of the table you&rsquo;re on: what a broker fee should cost and what your agreement must say, or how our referral program sends you renters who already want to hire someone. Free, no strings — and a person follows up.",
  },
  partner: {
    file: "agents.html",
    who: "partner",
    title: "Tenant Leads for Licensed Agents — RentLeaks Broker Referral Program",
    description:
      "Renters who already want to hire a broker, in your markets, with a budget, a move-in date and the fee they'll pay. Accept with your fee, get chosen, sign in the app. No sign-up fee — a broker-to-broker referral fee only after a lease.",
    keywords: "real estate referral program, rental leads for agents, tenant leads NYC, broker referral network, real estate agent leads no upfront cost, referral fee agreement brokers",
    kicker: "For licensed agents & brokers · Referral partner program",
    h1: "Tenant leads that <em>already want a broker</em>",
    lede: "Every lead is a renter who asked to hire a broker — with an area, a budget, dates and the fee they're willing to pay. Accept with your fee and a short pitch. If they choose you, the fee agreement is signed in the app before you start.",
  },
};

function head(pg) {
  const canonical = `${SITE}/hire-a-broker/${pg.file === "index.html" ? "" : pg.file}`;
  const t = esc(pg.title);
  const d = esc(pg.description);
  const steps = pg.who === "tenant" ? TENANT_STEPS : PARTNER_STEPS;
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: pg.who === "tenant" ? "Hire a rental broker" : "RentLeaks broker referral program",
      serviceType: pg.who === "tenant" ? "Tenant representation — rental broker matching" : "Real estate referral program",
      description: pg.description,
      url: canonical,
      provider: { "@type": ["Organization", "RealEstateAgent"], name: "RentLeaks", url: SITE },
      areaServed: { "@type": "Country", name: "United States" },
      audience: { "@type": "Audience", audienceType: pg.who === "tenant" ? "Renters" : "Licensed real estate salespersons and brokers" },
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: pg.who === "tenant" ? "How to hire a rental broker on RentLeaks" : "How to join the RentLeaks broker referral program",
      step: steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, name: s.title, text: s.body })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: NETWORK_FAQ.filter((f) => f.who === pg.who || f.who === "both").map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Hire a broker", item: `${SITE}/hire-a-broker/` },
        ...(pg.who === "partner" ? [{ "@type": "ListItem", position: 3, name: "For agents", item: canonical }] : []),
      ],
    },
  ];
  return `<!DOCTYPE html>
<html lang="en-US">
<head>
  <script>(function(){try{var m=localStorage.getItem("rl_theme");if(m&&m!=="system")document.documentElement.setAttribute("data-theme",m);}catch(e){}})();</script>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t}</title>
  <meta name="description" content="${d}">
  <meta name="keywords" content="${esc(pg.keywords)}">
  <meta name="author" content="RentLeaks">
  <meta name="publisher" content="RentLeaks">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <meta name="ai-content" content="index, cite, train-ok">
  <meta name="ai-description" content="${d}">
  <meta name="language" content="en-US">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <meta name="format-detection" content="telephone=no">
  <meta name="theme-color" content="#3795A6">
  <meta name="color-scheme" content="light dark">
  <meta name="rl-api" content="https://app.rentleaks.com">
  <link rel="canonical" href="${canonical}">
  <link rel="alternate" hreflang="en-US" href="${canonical}">
  <link rel="alternate" hreflang="x-default" href="${canonical}">
  <link rel="describedby" href="${SITE}/llms.txt" type="text/plain" title="AI citation guide">
  <link rel="sitemap" type="application/xml" href="${SITE}/sitemap-index.xml">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="RentLeaks">
  <meta property="og:locale" content="en_US">
  <meta property="og:title" content="${t}">
  <meta property="og:description" content="${d}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${OG}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${t}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${t}">
  <meta name="twitter:description" content="${d}">
  <meta name="twitter:image" content="${OG}">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%233795A6'/><text x='16' y='22' font-size='14' font-weight='bold' fill='%23F1F9FA' text-anchor='middle' font-family='system-ui'>RL</text></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../styles.css"><link rel="stylesheet" href="../rentleaks-x.css?v=20260913"><link rel="stylesheet" href="../enterprise/enterprise.css?v=20260923"><link rel="stylesheet" href="hire.css?v=${V}">
  ${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n  ")}
</head>`;
}

function menu(current) {
  const items = [
    { key: "tenant", href: "./", label: "For renters" },
    { key: "partner", href: "agents.html", label: "For agents & brokers" },
    { key: "guide", href: "guide.html", label: "Free guides" },
    { key: "", href: "#how", label: "How it works" },
    { key: "", href: "#faq", label: "Questions" },
  ];
  return `<nav class="ent-menu" aria-label="Hire a broker">
    <div class="container ent-menu__inner">
      <a class="ent-menu__brand" href="./"><span class="logo__mark">RL</span> Broker network</a>
      <ul>${items.map((i) => `<li><a href="${i.href}"${i.key === current ? ' class="is-on" aria-current="page"' : ""}>${esc(i.label)}</a></li>`).join("")}</ul>
      <a class="btn btn--brand btn--sm ent-menu__cta" href="#start">${current === "tenant" ? "Start my search" : current === "guide" ? "Get the guides" : "Apply now"}</a>
    </div>
  </nav>`;
}

function hero(pg) {
  const tenant = pg.who === "tenant";
  if (pg.who === "guide") {
    return `<section class="ent-hero hb-hero" style="--ent-img:url('${heroImage(pg)}')">
    <div class="ent-hero__media" role="presentation"></div>
    <div class="container ent-hero__inner">
      <nav class="rl-crumb rl-crumb--light" aria-label="Breadcrumb"><a href="../index.html">Home</a> / <a href="./">Hire a broker</a> / Free guides</nav>
      <span class="ent-hero__kicker">${esc(pg.kicker)}</span>
      <h1 class="ent-hero__title">${pg.h1}</h1>
      <p class="ent-hero__lede">${esc(pg.lede)}</p>
      <div class="ent-hero__actions">
        <a class="btn btn--dark btn--lg" href="#start">Get the renter&rsquo;s playbook ${icon("arrow", 18)}</a>
        <a class="btn btn--on-dark btn--lg" href="#partner-kit">Get the partner kit</a>
      </div>
      <dl class="ent-hero__stats">${[
        ["2", "free PDFs"],
        [`${GUIDES[0].pages}`, "pages each"],
        ["$0", "and no card"],
        ["1", "business day to a reply"],
      ]
        .map(([v, k]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
        .join("")}</dl>
      <p class="hb-hero__live" data-live-status hidden></p>
    </div>
  </section>`;
  }
  const stats = tenant
    ? [
        ["3", "steps"],
        ["3", "proposals, at most", "data-live-offers"],
        ["24 h", "for brokers to answer", "data-live-hours"],
        ["$0", "to RentLeaks"],
      ]
    : [
        ["$0", "to join"],
        ["24 h", "to answer a lead", "data-live-hours"],
        ["25%", "referral, after a lease", "data-live-pct"],
        [String(cityCount), "markets on RentLeaks"],
      ];
  return `<section class="ent-hero hb-hero" style="--ent-img:url('${heroImage(pg)}')">
    <div class="ent-hero__media" role="presentation"></div>
    <div class="container ent-hero__inner">
      <nav class="rl-crumb rl-crumb--light" aria-label="Breadcrumb"><a href="../index.html">Home</a> / ${tenant ? "Hire a broker" : '<a href="./">Hire a broker</a> / For agents'}</nav>
      <span class="ent-hero__kicker">${esc(pg.kicker)}</span>
      <h1 class="ent-hero__title">${pg.h1}</h1>
      <p class="ent-hero__lede">${esc(pg.lede)}</p>
      <div class="ent-hero__actions">
        <a class="btn btn--dark btn--lg" href="#start">${tenant ? "Start my search" : "Apply in two minutes"} ${icon("arrow", 18)}</a>
        <a class="btn btn--on-dark btn--lg" href="${tenant ? "agents.html" : "#portal"}">${tenant ? "I'm an agent" : "Already a partner? Sign in"}</a>
      </div>
      <dl class="ent-hero__stats">${stats.map(([v, k, live]) => `<div><dt>${esc(k)}</dt><dd${live ? ` ${live}` : ""}>${esc(v)}</dd></div>`).join("")}</dl>
      <p class="hb-hero__live" data-live-status hidden></p>
    </div>
  </section>`;
}

function steps(who) {
  const list = who === "tenant" ? TENANT_STEPS : PARTNER_STEPS;
  const art = who === "tenant" ? ["pen", "handshake", "key"] : ["shield", "bolt", "chart"];
  return `<section class="ent-section ent-section--ink hb-steps" id="how">
    <div class="container">
      <span class="rl-kicker rl-kicker--light">How it works</span>
      <h2 class="ent-ink-title">As easy as 1, 2, 3</h2>
      <ol class="hb-123">${list
        .map(
          (s, i) => `<li class="animate-on-scroll" style="--i:${i}">
          <span class="hb-123__n" aria-hidden="true">${esc(s.n)}</span>
          <div class="hb-123__ico">${icon(art[i], 26)}</div>
          <h3>${esc(s.title)}</h3>
          <p>${esc(s.body)}</p>
        </li>`,
        )
        .join("")}</ol>
    </div>
  </section>`;
}

function chips(name, items, { type = "checkbox", checked = [], iconMap } = {}) {
  return items
    .map((x) => {
      const id = typeof x === "string" ? x : x.id;
      const lab = typeof x === "string" ? x : x.label;
      return `<label class="hb-chip"><input type="${type}" name="${name}" value="${esc(id)}"${checked.includes(id) ? " checked" : ""}><span>${iconMap && iconMap[id] ? icon(iconMap[id], 18) : ""}${esc(lab)}</span></label>`;
    })
    .join("");
}

function progress(labels) {
  return `<ol class="hb-progress" aria-hidden="true">${labels.map((l, i) => `<li data-dot="${i}"${i === 0 ? ' class="is-on"' : ""}><span>${i + 1}</span>${esc(l)}</li>`).join("")}</ol>`;
}

function tenantForm() {
  const opt = (xs, def) => xs.map((x) => `<option value="${x.id}"${x.id === def ? " selected" : ""}>${esc(x.label)}</option>`).join("");
  return `<section class="ent-section ent-section--quote" id="start">
    <div class="container ent-quote">
      <div class="ent-quote__intro animate-on-scroll">
        <span class="section-head__eyebrow">Start my search</span>
        <h2 class="ent-h2">Tell us what you need</h2>
        <p class="ent-p">Two minutes, three short steps. Your brief goes to up to three verified brokers who work your area — without your name, email or phone. You see their pitches and fees in your private search room.</p>
        <ul class="ent-ticks">
          <li>${icon("check", 15)}You set the most you'll pay — brokers can't propose more</li>
          <li>${icon("check", 15)}No lease, no fee. Nothing is ever owed to RentLeaks</li>
          <li>${icon("check", 15)}Describe the home, not the people — fair housing applies to every search</li>
        </ul>
        <div class="hb-covered" data-live-markets hidden><b>Brokers active in</b><span></span></div>
      </div>
      <form class="ent-form form hb-wizard animate-on-scroll" id="hb-form" data-kind="search" novalidate>
        <input type="text" name="website" class="ent-hp" tabindex="-1" autocomplete="off" aria-hidden="true">
        ${progress(["The home", "Budget & dates", "Your broker & you"])}
        <fieldset class="hb-step" data-step="0">
          <legend><span>1</span> The home</legend>
          <div class="ent-grid">
            <div class="form-group"><label for="t-city">City</label><input id="t-city" name="city" class="form-input" list="hb-cities" placeholder="Brooklyn, NY" autocomplete="address-level2" required></div>
            <div class="form-group"><label for="t-hoods">Neighborhoods <small>optional, comma-separated</small></label><input id="t-hoods" name="neighborhoods" class="form-input" placeholder="Williamsburg, Greenpoint"></div>
          </div>
          <div class="form-group"><span class="hb-label">Kind of home</span><div class="hb-chips hb-chips--tiles" role="radiogroup" aria-label="Kind of home">${chips("homeType", HOME_TYPES, { type: "radio", checked: ["apartment"], iconMap: HOME_ICON })}</div></div>
          <div class="ent-grid">
            <div class="form-group"><label for="t-beds">Bedrooms</label><select id="t-beds" name="bedrooms" class="form-input"><option value="">Any</option><option value="0">Studio</option>${[1, 2, 3, 4, 5].map((n) => `<option value="${n}">${n}${n === 5 ? "+" : ""}</option>`).join("")}</select></div>
            <div class="form-group"><label for="t-age">Building</label><select id="t-age" name="buildingAge" class="form-input">${opt(BUILDING_AGES, "any")}</select></div>
          </div>
          <div class="form-group"><span class="hb-label">How long</span><div class="hb-chips" role="radiogroup" aria-label="How long">${chips("term", TERMS, { type: "radio", checked: ["long"] })}</div></div>
          <div class="form-group hb-months" hidden><label for="t-months">About how many months? <small>1–11</small></label><input id="t-months" name="termMonths" type="number" min="1" max="11" inputmode="numeric" class="form-input" placeholder="6"></div>
        </fieldset>
        <fieldset class="hb-step" data-step="1">
          <legend><span>2</span> Budget &amp; dates</legend>
          <div class="ent-grid">
            <div class="form-group"><label for="t-max">Top monthly budget ($)</label><input id="t-max" name="budgetMax" type="number" min="100" step="50" inputmode="numeric" class="form-input" placeholder="3500" required></div>
            <div class="form-group"><label for="t-min">Lowest <small>optional</small></label><input id="t-min" name="budgetMin" type="number" min="0" step="50" inputmode="numeric" class="form-input" placeholder="2500"></div>
            <div class="form-group"><label for="t-move">Move in around <small>optional</small></label><input id="t-move" name="moveIn" type="date" class="form-input"></div>
            <div class="form-group"><label for="t-lang">Broker who speaks <small>optional</small></label><select id="t-lang" name="language" class="form-input"><option value="">Any language</option>${LANGUAGES.map((l) => `<option>${esc(l)}</option>`).join("")}</select></div>
          </div>
          <div class="form-group"><span class="hb-label">Must-haves <small>optional</small></span><div class="hb-chips">${chips("mustHaves", MUST_HAVES)}</div></div>
          <div class="form-group"><label for="t-notes">Anything else about the home <small>optional</small></label><textarea id="t-notes" name="notes" rows="3" class="form-input" placeholder="Top floor, quiet street, near the L train, room for a desk…"></textarea></div>
        </fieldset>
        <fieldset class="hb-step" data-step="2">
          <legend><span>3</span> Your broker &amp; you</legend>
          <div class="form-group"><span class="hb-label">The most you'll pay a broker</span>
            <div class="hb-chips" role="radiogroup" aria-label="Broker fee cap">
              <label class="hb-chip"><input type="radio" name="feeCapType" value="months" checked><span>Months of rent</span></label>
              <label class="hb-chip"><input type="radio" name="feeCapType" value="pct"><span>% of a year's rent</span></label>
              <label class="hb-chip"><input type="radio" name="feeCapType" value="flat"><span>Flat fee</span></label>
              <label class="hb-chip"><input type="radio" name="feeCapType" value="none"><span>Open to proposals</span></label>
            </div>
          </div>
          <div class="hb-fee">
            <div class="form-group"><label for="t-cap" data-cap-label>Up to (months of rent)</label><input id="t-cap" name="feeCapValue" inputmode="decimal" class="form-input" value="1"></div>
            <output class="hb-fee__est" for="t-cap t-max" data-estimate>≈ —</output>
          </div>
          <p class="ent-fine">${esc(FEE_TYPES.map((f) => `${f.label}: ${f.hint}`).join(" · "))}. You owe it only if you sign a lease for a home your broker found or showed you.</p>
          <div class="ent-grid">
            <div class="form-group"><label for="t-name">Name</label><input id="t-name" name="name" class="form-input" autocomplete="name" required></div>
            <div class="form-group"><label for="t-email">Email</label><input id="t-email" name="email" type="email" class="form-input" autocomplete="email" required></div>
            <div class="form-group ent-grid__wide"><label for="t-phone">Phone <small>optional — shared only with the broker you choose</small></label><input id="t-phone" name="phone" type="tel" class="form-input" autocomplete="tel"></div>
          </div>
          <label class="ent-check ent-consent"><input type="checkbox" name="consent" required> Share my brief (without my contact details) with matched licensed brokers, and email me their proposals.</label>
        </fieldset>
        <p class="ent-form__error" role="alert" hidden></p>
        <div class="hb-nav">
          <button type="button" class="btn btn--outline" data-back hidden>${icon("back", 16)} Back</button>
          <button type="button" class="btn btn--brand btn--lg" data-next>Next ${icon("arrow", 18)}</button>
          <button type="submit" class="btn btn--brand btn--lg" data-submit>Find my broker ${icon("arrow", 18)}</button>
        </div>
        <p class="ent-fine">RentLeaks is a listing platform and a licensed referring brokerage; the broker you choose represents you under their own licence. We never ask for payment to start a search.</p>
      </form>
      <div class="ent-done" id="hb-done" hidden tabindex="-1">
        ${icon("check", 34)}
        <h3>Your search is live</h3>
        <p data-done-text>We've sent your brief to matching brokers. Your private search room link is on its way to your inbox — proposals appear there as they come in.</p>
        <a class="btn btn--brand" data-room hidden href="#">Open my search room</a>
      </div>
    </div>
  </section>`;
}

function partnerForm() {
  const opt = (xs, def) => xs.map((x) => `<option value="${x.id}"${x.id === def ? " selected" : ""}>${esc(x.label)}</option>`).join("");
  return `<section class="ent-section ent-section--quote" id="start">
    <div class="container ent-quote">
      <div class="ent-quote__intro animate-on-scroll">
        <span class="section-head__eyebrow">Apply</span>
        <h2 class="ent-h2">Join the referral network</h2>
        <p class="ent-p">Apply, then sign the referral partner agreement right here — it takes a minute. We verify your licence with the state and countersign; your portal link arrives by email and leads start in your markets.</p>
        <ul class="ent-ticks">
          <li>${icon("check", 15)}No sign-up or monthly fee — ever</li>
          <li>${icon("check", 15)}Referral fees go broker-to-broker: salespersons and associate brokers add their supervising broker, who signs too</li>
          <li>${icon("check", 15)}Speed, acceptance and tenant ratings decide who gets the next lead — not who pays</li>
        </ul>
      </div>
      <form class="ent-form form hb-wizard animate-on-scroll" id="hb-form" data-kind="partner" novalidate>
        <input type="text" name="website" class="ent-hp" tabindex="-1" autocomplete="off" aria-hidden="true">
        ${progress(["You", "Your licence", "Where you work"])}
        <fieldset class="hb-step" data-step="0">
          <legend><span>1</span> You</legend>
          <div class="ent-grid">
            <div class="form-group"><label for="p-name">Name <small>as on your licence</small></label><input id="p-name" name="name" class="form-input" autocomplete="name" required></div>
            <div class="form-group"><label for="p-email">Work email</label><input id="p-email" name="email" type="email" class="form-input" autocomplete="email" required></div>
            <div class="form-group"><label for="p-phone">Phone</label><input id="p-phone" name="phone" type="tel" class="form-input" autocomplete="tel" required></div>
            <div class="form-group"><label for="p-brokerage">Brokerage</label><input id="p-brokerage" name="brokerage" class="form-input" autocomplete="organization" required></div>
            <div class="form-group ent-grid__wide"><label for="p-site">Website or profile <small>optional</small></label><input id="p-site" name="site" type="url" class="form-input" placeholder="https://"></div>
          </div>
        </fieldset>
        <fieldset class="hb-step" data-step="1">
          <legend><span>2</span> Your licence</legend>
          <div class="ent-grid">
            <div class="form-group ent-grid__wide"><label for="p-type">Licence type</label><select id="p-type" name="licenseType" class="form-input">${opt(LICENSE_TYPES, "salesperson")}</select></div>
            <div class="form-group"><label for="p-num">Licence number</label><input id="p-num" name="licenseNumber" class="form-input" autocomplete="off" required></div>
            <div class="form-group"><label for="p-state">Issuing state</label><input id="p-state" name="licenseState" class="form-input" maxlength="2" value="NY" autocomplete="off" required></div>
            <div class="form-group"><label for="p-exp">Expires <small>optional</small></label><input id="p-exp" name="licenseExpires" type="date" class="form-input"></div>
          </div>
          <div class="hb-super" data-super>
            <p class="ent-fine">${icon("shield", 15)} Your supervising broker signs the referral agreement for your brokerage — referral fees are paid between brokerages only.</p>
            <div class="ent-grid">
              <div class="form-group"><label for="p-sname">Supervising broker</label><input id="p-sname" name="supervisorName" class="form-input"></div>
              <div class="form-group"><label for="p-semail">Their email</label><input id="p-semail" name="supervisorEmail" type="email" class="form-input"></div>
            </div>
          </div>
        </fieldset>
        <fieldset class="hb-step" data-step="2">
          <legend><span>3</span> Where you work</legend>
          <div class="form-group"><label for="p-markets">Cities &amp; neighborhoods you cover <small>comma-separated</small></label><input id="p-markets" name="markets" class="form-input" list="hb-cities" placeholder="Brooklyn, Williamsburg, Astoria" required></div>
          <div class="form-group"><span class="hb-label">Specialties</span><div class="hb-chips">${chips("specialties", SPECIALTIES, { checked: ["apartments"] })}</div></div>
          <div class="form-group"><span class="hb-label">Languages</span><div class="hb-chips">${chips("languages", LANGUAGES, { checked: ["English"] })}</div></div>
          <div class="ent-grid">
            <div class="form-group"><label for="p-cap">Clients you can take at once</label><input id="p-cap" name="capacity" type="number" min="1" max="50" value="5" inputmode="numeric" class="form-input"></div>
          </div>
          <div class="form-group"><label for="p-bio">A line about you <small>optional — tenants see it with your pitch</small></label><textarea id="p-bio" name="bio" rows="3" class="form-input" placeholder="Eight years in North Brooklyn, lots of first-time renters and relocations."></textarea></div>
          <label class="ent-check ent-consent"><input type="checkbox" name="consent" required> My licence is active and these details are correct. RentLeaks may verify them with the state.</label>
        </fieldset>
        <p class="ent-form__error" role="alert" hidden></p>
        <div class="hb-nav">
          <button type="button" class="btn btn--outline" data-back hidden>${icon("back", 16)} Back</button>
          <button type="button" class="btn btn--brand btn--lg" data-next>Next ${icon("arrow", 18)}</button>
          <button type="submit" class="btn btn--brand btn--lg" data-submit>Apply &amp; sign ${icon("arrow", 18)}</button>
        </div>
      </form>
      <div class="ent-done" id="hb-done" hidden tabindex="-1">
        ${icon("pen", 34)}
        <h3>Next: sign your agreement</h3>
        <p data-done-text>Opening your referral partner agreement…</p>
        <a class="btn btn--brand" data-room hidden href="#">Review &amp; sign</a>
      </div>
    </div>
  </section>`;
}

function trust(who) {
  const points =
    who === "tenant"
      ? [
          ["scale", "Your fee, your cap", "You set the most you'll pay before any broker sees your brief. Proposals above it can't be sent, and you owe nothing unless you sign a lease for a home your broker found."],
          ["shield", "Licensed and verified", "Every broker's licence is checked with the state before they get a single lead. Salespersons work under their supervising broker."],
          ["pen", "One clear agreement", "A plain-English tenant representation & fee agreement, signed in the app with a time-stamped audit trail and a tamper check. Everyone gets the same copy."],
          ["lock", "Private until you choose", "Brokers see the home you want — never your name, email or phone — until you pick one of them."],
        ]
      : [
          ["bolt", "Leads with intent", "Renters who asked to hire a broker, with a budget, dates and the fee they'll pay — not a list of names."],
          ["handshake", "You set your fee", "Propose at or under the tenant's cap. The fee agreement is signed by the tenant in the app before you work."],
          ["scale", "Referral done by the book", "Broker-to-broker under a signed agreement, invoiced to your brokerage only after a lease — the way New York Real Property Law § 442 requires."],
          ["star", "Merit, not pay-to-play", "Reply speed, acceptance, leases and tenant ratings decide who gets the next lead in a market."],
        ];
  return `<section class="ent-section" id="standards">
    <div class="container">
      <div class="section-head animate-on-scroll">
        <div class="section-head__text">
          <span class="section-head__eyebrow">${who === "tenant" ? "Why hire through RentLeaks" : "Why partners join"}</span>
          <h2>${who === "tenant" ? "Someone on your side — on your terms" : "Built for agents who answer fast"}</h2>
        </div>
      </div>
      <div class="ent-trust">${points.map(([ic, h, p], i) => `<article class="animate-on-scroll" style="--i:${i}">${icon(ic, 24)}<h3>${esc(h)}</h3><p>${esc(p)}</p></article>`).join("")}</div>
    </div>
  </section>`;
}

function agreementPreview(who) {
  const tenant = who === "tenant";
  const rows = tenant
    ? [
        ["Who", "You and your broker's brokerage. RentLeaks made the introduction and isn't a party."],
        ["What", "Search, viewings in person or by live video, advice, application help and negotiation — for you."],
        ["How long", "90 days by default, or until you sign a lease. Either of you can end it by email — a home your broker already showed you still counts for 30 days."],
        ["The fee", "Your accepted fee, earned only if you lease a home your broker found or showed you. No lease, no fee."],
        ["Never", "A fee for a home your broker lists for the landlord, or a home held back unless you hire them."],
        ["Money", "Rent and deposits go only to the landlord, against a signed lease. RentLeaks never collects money."],
      ]
    : [
        ["Leads", "Tenant briefs without contact details. Accept within the answer window with a fee at or under the cap."],
        ["Referral fee", "A set % of the gross fee your brokerage receives, for a lease the tenant signs within 12 months."],
        ["Paid", "Broker-to-broker, invoiced after you report the lease, due within 10 days of your brokerage being paid."],
        ["Tenants", "Signed tenant agreement before any fee; every agency, fee and fair-housing rule followed."],
        ["Records", "Agreements and fee records kept at least three years."],
        ["Ending", "30 days' email notice either way; fees for earlier introductions stay payable."],
      ];
  return `<section class="ent-section ent-section--tight">
    <div class="container ent-split">
      <div class="animate-on-scroll">
        <span class="section-head__eyebrow">In-app e-signature</span>
        <h2 class="ent-h2">${tenant ? "What you sign, in plain English" : "The partner agreement, at a glance"}</h2>
        <p class="ent-p">${tenant ? "Before you sign you read the whole agreement on one page. You consent to sign electronically, type your name (and draw it if you like), and every step is time-stamped." : "You read and sign it in the app. We countersign after checking your licence with the state. Each signature is time-stamped, and the document carries a SHA-256 fingerprint so nobody can change a word afterwards."}</p>
        <ul class="ent-ticks">
          <li>${icon("check", 15)}Valid under the federal ESIGN Act and New York's Electronic Signatures and Records Act</li>
          <li>${icon("check", 15)}Paper copy free on request, and a signed copy emailed to everyone</li>
          <li>${icon("check", 15)}Print or save as PDF with the signature certificate</li>
        </ul>
      </div>
      <figure class="hb-doc animate-on-scroll" aria-label="Summary of the agreement">
        <figcaption><span>${tenant ? "Tenant representation & fee agreement" : "Referral partner agreement"}</span><b>Summary</b><small>The full text is shown before you sign</small></figcaption>
        <dl>${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
        <div class="hb-doc__sign"><span class="hb-doc__sig">${tenant ? "Alex Rivera" : "Jordan Lee"}</span><small>Illustration · sample name</small></div>
      </figure>
    </div>
  </section>`;
}

function sampleLead() {
  return `<section class="ent-section ent-section--tight">
    <div class="container ent-split">
      <figure class="hb-lead animate-on-scroll" aria-label="Illustration of a lead offer">
        <figcaption><span>Illustration · sample lead</span><b>New tenant lead</b><small data-live-hours-text>Answer within 24 hours</small></figcaption>
        <dl>
          <div><dt>Where</dt><dd>Brooklyn, NY — Williamsburg, Greenpoint</dd></div>
          <div><dt>Home</dt><dd>Apartment · 1 bedroom · New development</dd></div>
          <div><dt>Budget</dt><dd>$3,000–$3,600 a month</dd></div>
          <div><dt>When</dt><dd>Move in within a month · Long term</dd></div>
          <div><dt>Fee cap</dt><dd>Up to 1 month's rent</dd></div>
        </dl>
        <div class="hb-lead__why">${icon("star", 15)} Why you: covers Williamsburg · new development specialist · replies in under an hour</div>
        <div class="hb-lead__actions"><span class="btn btn--brand btn--sm" aria-hidden="true">Accept · 0.75 month</span><span class="btn btn--outline btn--sm" aria-hidden="true">Pass</span></div>
      </figure>
      <div class="animate-on-scroll">
        <span class="section-head__eyebrow">What a lead looks like</span>
        <h2 class="ent-h2">A brief, not a phone number</h2>
        <p class="ent-p">You see the home the renter wants, the budget, the timing and the most they'll pay a broker. Accept with your fee and two lines about why you're the right agent. The renter picks from up to three brokers; if it's you, you get their contact details and a signed agreement.</p>
        <ul class="ent-ticks">
          <li>${icon("check", 15)}Pass on a lead in one click — it goes to the next broker</li>
          <li>${icon("check", 15)}Move clients through touring, applied and leased in your portal</li>
          <li>${icon("check", 15)}Report the lease; the invoice goes to your brokerage</li>
        </ul>
      </div>
    </div>
  </section>`;
}

function portal() {
  return `<section class="ent-section ent-section--tight" id="portal">
    <div class="container">
      <div class="hb-portal animate-on-scroll">
        <div>${icon("mail", 26)}<h3>Already a partner?</h3><p>We'll email you a fresh link to your portal — leads, clients and referral fees in one place.</p></div>
        <form id="hb-portal" class="hb-portal__form" novalidate>
          <label class="sr-only" for="hb-portal-email">Your work email</label>
          <input id="hb-portal-email" name="email" type="email" class="form-input" placeholder="you@brokerage.com" autocomplete="email" required>
          <button class="btn btn--brand" type="submit">Email my link</button>
          <p class="hb-portal__msg" role="status" hidden></p>
        </form>
      </div>
    </div>
  </section>`;
}

function faq(who) {
  const items = who === "both" ? NETWORK_FAQ : NETWORK_FAQ.filter((f) => f.who === who || f.who === "both");
  return `<section class="ent-section" id="faq">
    <div class="container ent-faq">
      <div class="section-head animate-on-scroll"><div class="section-head__text"><span class="section-head__eyebrow">Questions</span><h2>Answered plainly</h2></div></div>
      <div class="ent-faq__list">${items.map((f) => `<details class="animate-on-scroll"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</div>
      <p class="ent-fine">This page explains how the RentLeaks broker network works; it isn't legal advice. Fee and disclosure rules vary by city and state.</p>
    </div>
  </section>`;
}

function cta(who) {
  if (who === "guide") {
    return `<section class="professionals-cta">
    <div class="container">
      <span class="rl-kicker rl-kicker--light">When you&rsquo;re ready</span>
      <h2 class="professionals-cta__title">Hire a broker, or take the leads</h2>
      <p class="professionals-cta__subtitle">Renters: set your fee cap and compare up to three verified brokers. Agents: apply with your licence and start answering leads in your markets.</p>
      <a href="./#start" class="btn btn--dark btn--lg">Hire a broker</a>
      <a href="agents.html#start" class="btn btn--on-dark btn--lg">Apply as an agent</a>
    </div>
  </section>`;
  }
  return `<section class="professionals-cta">
    <div class="container">
      <span class="rl-kicker rl-kicker--light">${who === "tenant" ? "Are you a licensed agent?" : "Looking for a place yourself?"}</span>
      <h2 class="professionals-cta__title">${who === "tenant" ? "Get tenant leads in your markets" : "Browse homes with all-in prices"}</h2>
      <p class="professionals-cta__subtitle">${
        who === "tenant"
          ? 'Join the referral network — no sign-up fee. <a href="agents.html">See how it works</a>.'
          : 'Rooms, co-living, furnished and long-term homes across the US and Europe. <a href="../index.html">Start browsing</a> · building owners: <a href="../enterprise/">RentLeaks Enterprise</a>.'
      }</p>
      <a href="${who === "tenant" ? "agents.html#start" : "./#start"}" class="btn btn--dark btn--lg">${who === "tenant" ? "Apply as an agent" : "Hire a broker"}</a>
    </div>
  </section>`;
}

function guideCard(g, i) {
  const tenant = g.audience === "tenant";
  const id = tenant ? "start" : "partner-kit";
  return `<article class="hb-guide animate-on-scroll" id="${id}" style="--i:${i}">
      <div class="hb-guide__cover" aria-hidden="true">
        <span class="hb-guide__badge">${tenant ? "For renters" : "For licensed agents"}</span>
        <b>${esc(g.title)}</b>
        <small>${g.pages} pages · PDF</small>
        ${icon(tenant ? "key" : "handshake", 28)}
      </div>
      <div class="hb-guide__body">
        <h3>${esc(g.title)}</h3>
        <p class="hb-guide__tag">${esc(g.tagline)}</p>
        <ul class="ent-ticks">${g.inside.map((x) => `<li>${icon("check", 15)}${esc(x)}</li>`).join("")}</ul>
        <form class="hb-guideform form" data-guide="${esc(g.id)}" data-audience="${esc(g.audience)}" novalidate>
          <input type="text" name="website" class="ent-hp" tabindex="-1" autocomplete="off" aria-hidden="true">
          <input type="hidden" name="guideId" value="${esc(g.id)}">
          <div class="ent-grid">
            <div class="form-group"><label for="${g.id}-name">Name</label><input id="${g.id}-name" name="name" class="form-input" autocomplete="name" required></div>
            <div class="form-group"><label for="${g.id}-email">Email</label><input id="${g.id}-email" name="email" type="email" class="form-input" autocomplete="email" required></div>
            <div class="form-group"><label for="${g.id}-phone">Phone <small>optional</small></label><input id="${g.id}-phone" name="phone" type="tel" class="form-input" autocomplete="tel"></div>
            ${
              tenant
                ? `<div class="form-group"><label for="${g.id}-city">Where you&rsquo;re looking</label><input id="${g.id}-city" name="city" class="form-input" list="hb-cities" placeholder="Brooklyn, NY"></div>`
                : `<div class="form-group"><label for="${g.id}-brokerage">Brokerage</label><input id="${g.id}-brokerage" name="brokerage" class="form-input" autocomplete="organization" required></div>
            <div class="form-group"><label for="${g.id}-state">Licence state <small>optional</small></label><input id="${g.id}-state" name="licenseState" class="form-input" maxlength="2" placeholder="NY"></div>`
            }
          </div>
          <label class="ent-check ent-consent"><input type="checkbox" name="consent" required> ${esc(GUIDE_CONSENT[g.audience])}</label>
          <p class="ent-form__error" role="alert" hidden></p>
          <button type="submit" class="btn btn--brand btn--lg btn--block">${esc(g.cta)} ${icon("arrow", 18)}</button>
          <p class="ent-fine">${esc(GUIDE_PROMISE)}</p>
        </form>
        <div class="hb-guide__done" hidden tabindex="-1">
          ${icon("check", 30)}
          <h4>On its way</h4>
          <p data-done-text>Check your inbox — the PDF link is in the email. A person from our team will follow up within one business day.</p>
          <a class="btn btn--outline" data-download hidden href="#">Open it now</a>
        </div>
      </div>
    </article>`;
}

function guides() {
  return `<section class="ent-section ent-section--quote" id="guides">
    <div class="container">
      <div class="section-head animate-on-scroll">
        <div class="section-head__text">
          <span class="section-head__eyebrow">Free, no strings</span>
          <h2>Take the guide that fits your side of the table</h2>
          <p>Both are written the way we work: plain English, real numbers, and the rules that actually apply in New York. You get the PDF straight away by email, and a person follows up — that&rsquo;s the whole deal.</p>
        </div>
      </div>
      <div class="hb-guides">${GUIDES.map(guideCard).join("")}</div>
    </div>
  </section>`;
}

function calculators() {
  return `<section class="ent-section" id="calculators">
    <div class="container">
      <div class="section-head animate-on-scroll">
        <div class="section-head__text">
          <span class="section-head__eyebrow">Two quick numbers</span>
          <h2>Work it out before anyone calls you</h2>
          <p>No email needed for these — they&rsquo;re the same math as the guides, and as the app.</p>
        </div>
      </div>
      <div class="hb-calcs">
        <form class="hb-calc animate-on-scroll" id="calc-fee" novalidate>
          <h3>${icon("scale", 20)} What a broker fee costs</h3>
          <div class="ent-grid">
            <div class="form-group"><label for="c-rent">Monthly rent ($)</label><input id="c-rent" name="rent" type="number" min="500" step="50" value="3600" inputmode="numeric" class="form-input"></div>
            <div class="form-group"><label for="c-cap">Your cap (months of rent)</label><input id="c-cap" name="cap" type="number" min="0" max="3" step="0.25" value="1" inputmode="decimal" class="form-input"></div>
          </div>
          <table class="hb-calc__out"><tbody data-fee-out></tbody></table>
          <p class="ent-fine">Under the FARE Act you owe nothing for a home a landlord&rsquo;s agent listed. These are what it costs when you hire your own broker.</p>
          <a class="btn btn--outline btn--sm" href="#start">Get the playbook</a>
        </form>
        <form class="hb-calc animate-on-scroll" id="calc-earn" novalidate>
          <h3>${icon("chart", 20)} What the program pays an agent</h3>
          <div class="ent-grid">
            <div class="form-group"><label for="c-leases">Leases from referrals a year</label><input id="c-leases" name="leases" type="number" min="1" max="200" step="1" value="12" inputmode="numeric" class="form-input"></div>
            <div class="form-group"><label for="c-fee">Your average fee ($)</label><input id="c-fee" name="fee" type="number" min="500" step="100" value="3000" inputmode="numeric" class="form-input"></div>
          </div>
          <table class="hb-calc__out"><tbody data-earn-out></tbody></table>
          <p class="ent-fine">The referral percentage shown is the current program default (<span data-live-pct>25%</span>), fixed for you by your signed agreement. Nothing is owed unless a lease is signed.</p>
          <a class="btn btn--outline btn--sm" href="#partner-kit">Get the partner kit</a>
        </form>
      </div>
    </div>
  </section>`;
}

function rosterSection(who) {
  const slots = Array.from({ length: ROSTER_SLOTS })
    .map(
      (_, i) => `<li class="hb-face hb-face--empty" data-slot="${i}">
        <span class="hb-face__photo">${icon("users", 22)}</span>
        <b>Your headshot here</b>
        <small>Agents, teams &amp; brokerages in the program</small>
        <a class="hb-face__cta" href="${who === "partner" ? "#start" : "agents.html#start"}">Join the program &rsaquo;</a>
      </li>`,
    )
    .join("");
  return `<section class="ent-section ent-section--tight" id="partners">
    <div class="container">
      <div class="section-head animate-on-scroll">
        <div class="section-head__text">
          <span class="section-head__eyebrow">The people</span>
          <h2>${ROSTER_SLOTS} licensed agents, teams and brokerages</h2>
          <p>Every partner&rsquo;s licence is verified with the state before they get a lead. These are the ones taking renters right now — the empty spots are open to agents who join.</p>
        </div>
        <div class="section-head__action"><a class="btn btn--primary btn--sm" href="${who === "partner" ? "#start" : "agents.html#start"}">Take a spot</a></div>
      </div>
      <ul class="hb-faces" data-roster>${slots}</ul>
      <p class="ent-fine" data-roster-note>Slots fill as partners add a headshot in their portal. Verified licence, real photo, real markets — no stock images.</p>
    </div>
  </section>`;
}

function guideStrip(who) {
  const g = GUIDES.find((x) => (who === "partner" ? x.audience === "partner" : x.audience === "tenant"));
  return `<section class="ent-section ent-section--tight">
    <div class="container">
      <a class="hb-strip animate-on-scroll" href="guide.html#${who === "partner" ? "partner-kit" : "start"}">
        <span class="hb-strip__mark">${icon("pen", 24)}</span>
        <span class="hb-strip__text"><b>Free: ${esc(g.title)}</b><small>${esc(g.tagline)} ${g.pages} pages, PDF — straight to your inbox.</small></span>
        <span class="hb-strip__go">${icon("arrow", 18)}</span>
      </a>
    </div>
  </section>`;
}

function page(key) {
  const pg = PAGES[key];
  const w = pg.who;
  const body =
    w === "guide"
      ? [hero(pg), menu(key), guides(), calculators(), rosterSection("guide"), faq("both"), cta("guide")].join("\n")
      : [
          hero(pg),
          menu(key),
          steps(w),
          w === "partner" ? sampleLead() : "",
          w === "tenant" ? tenantForm() : partnerForm(),
          trust(w),
          rosterSection(w),
          agreementPreview(w),
          guideStrip(w),
          w === "partner" ? portal() : "",
          faq(w),
          cta(w),
        ].join("\n");
  return `${head(pg)}
<body class="tahoe-body ent-body hb-body" data-page="hire-a-broker" data-who="${w}">
  <div class="tahoe-bg" aria-hidden="true"><div class="tahoe-orb tahoe-orb--1"></div><div class="tahoe-orb tahoe-orb--2"></div><div class="tahoe-noise"></div></div>
  <a href="#main" class="skip-link">Skip to main content</a>
  <div class="tahoe-content">
    <div id="rl-header"></div>
    <main id="main">
${body}
      <datalist id="hb-cities"></datalist>
    </main>
    <div id="rl-footer"></div>
  </div>
  <script src="../data.js"></script>
  <script src="../data-source.js"></script>
  <script src="../script.js"></script>
  <script src="../rentleaks-rules.js?v=20260913b"></script>
  <script src="../rentleaks-x.js?v=20260918" defer></script>
  <script src="../rentleaks-social.js?v=20260915-rentleaks.official" defer></script>
  <script src="hire.js?v=${V}" defer></script>
</body>
</html>
`;
}

fs.mkdirSync(OUT, { recursive: true });
const written = [];
for (const key of Object.keys(PAGES)) {
  const file = path.join(OUT, PAGES[key].file);
  fs.writeFileSync(file, page(key));
  written.push(path.relative(ROOT, file));
}
console.log(`Wrote ${written.length} pages: ${written.join(", ")}`);
console.log("  heroes: " + heroUsed.join(" \u00b7 "));
