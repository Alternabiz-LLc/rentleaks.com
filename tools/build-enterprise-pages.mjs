#!/usr/bin/env node
/**
 * Builds rentleaks.com/enterprise/ — the service menu for building owners,
 * corporations, developers and out-of-state landlords — straight from the
 * catalogue the app uses (web/src/lib/enterprise/catalog.ts), so the website,
 * the request API and the desk can't disagree about a package.
 *
 *   node --no-warnings tools/build-enterprise-pages.mjs
 *
 * Needs Node 22.18+ (it imports the TypeScript catalogue directly). Writes
 * enterprise/index.html and one page per service line. The licence strip,
 * "from" prices and the form's open state are read live from the app
 * (/api/enterprise) by enterprise/enterprise.js — no rebuild needed when they
 * change.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://rentleaks.com";
const OG = `${SITE}/images/og-default.jpg`;
const OUT = path.join(ROOT, "enterprise");
const V = "20260923";

const C = await import(pathToFileURL(path.join(ROOT, "web/src/lib/enterprise/catalog.ts")).href);
const { TRACKS, SERVICES, PACKAGES, ADD_ONS, FAQ, HOW_IT_WORKS, COMPLIANCE_CHECKS, CLIENT_ROLES, PROPERTY_KINDS, TIMELINES } = C;

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

const ICON = {
  key: '<path d="M14.5 9.5a4.5 4.5 0 1 1-2.2-3.9M12.3 13.4 4 21.7M7 18.7l2.3 2.3M9.6 16.1l2 2"/><circle cx="15.5" cy="8.5" r="1.2"/>',
  broadcast: '<path d="M4.9 19.1a10 10 0 0 1 0-14.2M19.1 4.9a10 10 0 0 1 0 14.2M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4"/><circle cx="12" cy="12" r="2"/>',
  megaphone: '<path d="M3 10v4h3l7 5V5L6 10zM17 8.5a5 5 0 0 1 0 7M20 5.5a9 9 0 0 1 0 13"/>',
  camera: '<path d="M4 7h3l2-3h6l2 3h3v13H4z"/><circle cx="12" cy="13" r="4"/>',
  building: '<path d="M4 21V5l8-3v19M12 8h8v13M2 21h20M7 7h2M7 11h2M7 15h2M15 12h2M15 16h2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  tools: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  sofa: '<path d="M4 11V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v3M2 13a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v5H2zM5 18v2M19 18v2"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4"/>',
  scale: '<path d="M12 3v18M5 21h14M6 7h12M6 7l-3 7a3 3 0 0 0 6 0zM18 7l-3 7a3 3 0 0 0 6 0z"/>',
  vault: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="12" cy="12" r="3.5"/><path d="M12 8.5V7M15.5 12H17M12 15.5V17M8.5 12H7"/>',
  chart: '<path d="M3 20h18M6 16v-5M11 16V8M16 16v-8M21 4l-5 4-5-3-5 4"/>',
};
const icon = (name, size = 22) =>
  `<svg class="ent-ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ICON.check}</svg>`;

const PAGES = {
  index: {
    file: "index.html",
    track: null,
    title: "RentLeaks Enterprise — Brokerage, Marketing & Property Management for Building Owners",
    description:
      "Licensed leasing, listing distribution, photography and 3D tours, social campaigns and property management for apartment buildings, complexes, corporate portfolios, developers and out-of-state owners.",
    keywords: "property management company, apartment building marketing, multifamily leasing agent, landlord broker, out of state landlord property management, virtual tour apartment, rental listing syndication, co-living management",
    kicker: "RentLeaks Enterprise · Buildings, portfolios, out-of-state owners",
    h1: "Your buildings, <em>leased and looked after</em> — the RentLeaks way",
    lede: "Licensed leasing, photos and 3D tours, distribution to the portals renters use, social campaigns and full property management — with the same all-in honesty, 30-day floor and fair-housing rules as everything on RentLeaks.",
    image: "photo-1486406146926-c627a92ad1ab",
  },
  brokerage: {
    file: "brokerage.html",
    track: "brokerage",
    title: "Landlord-Side Leasing & Brokerage for Buildings | RentLeaks Enterprise",
    description: "Exclusive leasing agent for apartment buildings and complexes: pricing studies, showings, one written screening standard, leases and renewals. Fees paid by the owner who hires us.",
    keywords: "exclusive leasing agent, landlord broker, apartment building leasing, tenant placement service, new development lease up, FARE Act broker fee",
    kicker: "Brokerage & leasing · Licensed · Landlord-side",
    h1: "Leased by the book, <em>paid by the owner</em>",
    lede: "Our licensed brokerage prices, markets, shows and leases your units under a written agreement. Renters never pay a fee for our work — and every fee they do pay is in the listing.",
    image: "photo-1522708323590-d24dbb6b0267",
  },
  marketing: {
    file: "marketing.html",
    track: "marketing",
    title: "Apartment Marketing: Photos, 3D Tours, Listing Distribution & Social | RentLeaks Enterprise",
    description: "Marketing packages for apartment buildings: HDR photography, 3D virtual tours, video, floor plans, distribution to major rental portals, and social campaigns across the US and Europe under housing ad rules.",
    keywords: "apartment marketing package, multifamily marketing, rental listing syndication, 3D virtual tour apartment, real estate photography building, social media marketing property management, lease up marketing",
    kicker: "Marketing & media · US + Europe",
    h1: "Fill a building <em>faster</em>",
    lede: "One team for the photos, the 3D tour, the listings on every portal and the social campaign — one report, one inbox, and every lead answered within a business day.",
    image: "photo-1493809842364-78817add7ccb",
  },
  management: {
    file: "management.html",
    track: "management",
    title: "Property Management for Buildings, Multi-Room Homes & Furnished Units | RentLeaks Enterprise",
    description: "Property management with rent collected into a client trust account, monthly owner statements, maintenance with your spending limit, turnovers and renewals — for buildings, co-living homes and furnished portfolios.",
    keywords: "property management multifamily, co-living property management, furnished apartment management, rent collection owner statement, room by room leasing management",
    kicker: "Property management · Buildings · Rooms · Furnished",
    h1: "Run for you, <em>reported plainly</em>",
    lede: "Rent collected into a client trust account and paid out with a statement you can read in a minute. Maintenance within your limit. Turnovers, renewals and a compliance calendar — for whole buildings, multi-room homes and furnished units.",
    image: "photo-1560448204-e02f11c3d0e2",
  },
  owners: {
    file: "owners.html",
    track: "owners",
    title: "Out-of-State Landlord Services — Long-Term Leasing & Management | RentLeaks Enterprise",
    description: "For owners who don't live near their rental: local rules checked, a qualified long-term renter, remote signing, photo condition reports and a monthly statement — from a licensed local team.",
    keywords: "out of state landlord, remote landlord property management, long distance landlord services, long term rental management, rental compliance checklist",
    kicker: "Out-of-state owners · Long-term rentals",
    h1: "Own it <em>from anywhere</em>",
    lede: "A licensed team on the ground for owners who live somewhere else: we check the local rules first, lease to a qualified long-term renter, hand over the keys and send photos and a statement you can trust from a thousand miles away.",
    image: "photo-1536376072261-38c75010e6c9",
  },
};

function head(pg) {
  const canonical = `${SITE}/enterprise/${pg.file === "index.html" ? "" : pg.file}`;
  const t = esc(pg.title);
  const d = esc(pg.description);
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: pg.track ? TRACKS.find((x) => x.id === pg.track).label : "RentLeaks Enterprise",
      serviceType: pg.track ? TRACKS.find((x) => x.id === pg.track).label : "Real estate brokerage, marketing and property management",
      description: pg.description,
      url: canonical,
      provider: { "@type": ["Organization", "RealEstateAgent"], name: "RentLeaks", url: SITE },
      areaServed: [{ "@type": "Country", name: "United States" }, { "@type": "Place", name: "Europe" }],
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Packages",
        itemListElement: PACKAGES.filter((p) => !pg.track || p.track === pg.track).map((p) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: p.name, description: p.tagline } })),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.filter((f) => !pg.track || !f.track || f.track === pg.track).map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Enterprise", item: `${SITE}/enterprise/` },
        ...(pg.track ? [{ "@type": "ListItem", position: 3, name: TRACKS.find((x) => x.id === pg.track).label, item: canonical }] : []),
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
  <link rel="stylesheet" href="../styles.css"><link rel="stylesheet" href="../rentleaks-x.css?v=20260913"><link rel="stylesheet" href="enterprise.css?v=${V}">
  ${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n  ")}
</head>`;
}

function menu(current) {
  const items = [
    { key: "index", href: "./", label: "Overview" },
    ...TRACKS.map((t) => ({ key: t.id, href: t.page, label: t.label })),
  ];
  return `<nav class="ent-menu" aria-label="Enterprise services">
    <div class="container ent-menu__inner">
      <a class="ent-menu__brand" href="./"><span class="logo__mark">RL</span> Enterprise</a>
      <ul>${items.map((i) => `<li><a href="${i.href}"${i.key === current ? ' class="is-on" aria-current="page"' : ""}>${esc(i.label)}</a></li>`).join("")}</ul>
      <a class="btn btn--brand btn--sm ent-menu__cta" href="#quote">Get a proposal</a>
    </div>
  </nav>`;
}

function hero(pg) {
  const stats = pg.track
    ? [
        [String(PACKAGES.filter((p) => p.track === pg.track).length), "packages"],
        [String(SERVICES.filter((s) => s.track === pg.track || PACKAGES.some((p) => p.track === pg.track && p.services.includes(s.id))).length), "services inside"],
        ["1 day", "to a first reply"],
        ["30+", "day stays only"],
      ]
    : [
        [String(TRACKS.length), "service lines"],
        [String(PACKAGES.length), "packages"],
        [String(cityCount), "markets on RentLeaks"],
        ["6", "listing languages"],
      ];
  return `<section class="ent-hero" style="--ent-img:url('${shot(pg.image)}')">
    <div class="ent-hero__media" role="presentation"></div>
    <div class="container ent-hero__inner">
      <nav class="rl-crumb rl-crumb--light" aria-label="Breadcrumb"><a href="../index.html">Home</a> / ${pg.track ? `<a href="./">Enterprise</a> / ${esc(TRACKS.find((t) => t.id === pg.track).label)}` : "Enterprise"}</nav>
      <span class="ent-hero__kicker">${esc(pg.kicker)}</span>
      <h1 class="ent-hero__title">${pg.h1}</h1>
      <p class="ent-hero__lede">${esc(pg.lede)}</p>
      <div class="ent-hero__actions">
        <a class="btn btn--dark btn--lg" href="#quote">Get a proposal ${icon("arrow", 18)}</a>
        <a class="btn btn--on-dark btn--lg" href="#packages">See the packages</a>
      </div>
      <dl class="ent-hero__stats">${stats.map(([v, k]) => `<div><dt>${esc(k)}</dt><dd data-count="${esc(v)}">${esc(v)}</dd></div>`).join("")}</dl>
    </div>
  </section>`;
}

function licenceStrip() {
  return `<section class="ent-licence" id="ent-licence" aria-label="Licence">
    <div class="container ent-licence__inner">
      ${icon("shield", 20)}
      <p class="ent-licence__text" data-licence>Brokerage and property management are provided by a licensed real estate brokerage, under a signed agreement. Licence details are shown here and on request.</p>
      <a class="ent-licence__notice" data-ny-notice hidden target="_blank" rel="noopener">NY Housing &amp; Anti-Discrimination Notice</a>
      <a class="ent-licence__fh" href="https://www.hud.gov/program_offices/fair_housing_equal_opp" target="_blank" rel="noopener">Equal housing opportunity</a>
    </div>
  </section>`;
}

function serviceCard(s, i) {
  const track = TRACKS.find((t) => t.id === s.track);
  return `<article class="ent-svc animate-on-scroll" style="--i:${i}">
      <div class="ent-svc__icon">${icon(s.icon, 24)}</div>
      <div class="ent-svc__body">
        <span class="ent-tag${s.licensed ? " ent-tag--licensed" : ""}">${s.licensed ? "Licensed" : esc(track.label)}</span>
        <h3>${esc(s.title)}</h3>
        <p>${esc(s.short)}</p>
        <ul class="ent-ticks">${s.bullets.map((b) => `<li>${icon("check", 15)}${esc(b)}</li>`).join("")}</ul>
        <a class="ent-link" href="${s.page}#svc-${s.id}">More on ${esc(s.title.toLowerCase())} ${icon("arrow", 15)}</a>
      </div>
    </article>`;
}

function packageCard(p) {
  return `<article class="ent-pack${p.featured ? " ent-pack--featured" : ""}" data-pack="${p.id}" data-track="${p.track}">
      ${p.featured ? '<span class="ent-pack__flag">Most chosen</span>' : ""}
      <header>
        <h3>${esc(p.name)}</h3>
        <p>${esc(p.tagline)}</p>
      </header>
      <div class="ent-pack__price"><b data-price="${p.id}">Custom quote</b><small>${esc(p.basis)}</small></div>
      <p class="ent-pack__for"><span>Best for</span> ${esc(p.bestFor)}</p>
      <ul class="ent-ticks">${p.includes.map((x) => `<li>${icon("check", 15)}${esc(x)}</li>`).join("")}</ul>
      <button type="button" class="btn ${p.featured ? "btn--brand" : "btn--outline"} btn--block" data-choose="${p.id}">Choose ${esc(p.name)}</button>
    </article>`;
}

function packages(track) {
  const tracks = track ? TRACKS.filter((t) => t.id === track) : TRACKS;
  return `<section class="ent-section" id="packages">
    <div class="container">
      <div class="section-head animate-on-scroll">
        <div class="section-head__text">
          <span class="section-head__eyebrow">Packages</span>
          <h2>${track ? `${esc(tracks[0].label)} packages` : "Pick a starting point"}</h2>
          <p>Every proposal starts from one of these and is shaped around your building. Prices are quoted per property — we never guess a number before we've seen it.</p>
        </div>
      </div>
      ${
        track
          ? ""
          : `<div class="ent-tabs" role="tablist" aria-label="Service lines">${tracks
              .map((t, i) => `<button type="button" role="tab" class="ent-tab${i === 0 ? " is-on" : ""}" aria-selected="${i === 0}" aria-controls="pk-${t.id}" id="tab-${t.id}" data-tab="${t.id}">${esc(t.label)}</button>`)
              .join("")}</div>`
      }
      ${tracks
        .map(
          (t, i) => `<div class="ent-packs" id="pk-${t.id}" role="tabpanel" aria-labelledby="tab-${t.id}"${!track && i > 0 ? " data-hidden" : ""}>
        ${track ? "" : `<p class="ent-packs__lede"><b>${esc(t.title)}.</b> ${esc(t.lede)} <a href="${t.page}">Read more</a></p>`}
        <div class="ent-packs__grid">${PACKAGES.filter((p) => p.track === t.id).map(packageCard).join("")}</div>
      </div>`,
        )
        .join("")}
      <div class="ent-addons animate-on-scroll">
        <h3>Add-ons, any package</h3>
        <ul>${ADD_ONS.filter((a) => !track || PACKAGES.some((p) => p.track === track && p.services.includes(a.service))).map((a) => `<li>${esc(a.label)}</li>`).join("")}</ul>
      </div>
    </div>
  </section>`;
}

function who() {
  const cards = [
    ["building", "Landlords with buildings", "Walk-ups, mid-rises and apartment complexes that need steady leasing and less time on the phone."],
    ["chart", "Corporations & family offices", "Portfolios across addresses and cities, one reporting line, one account manager."],
    ["key", "Developers", "Pre-leasing, launch campaigns and lease-up to stabilisation for new buildings."],
    ["globe", "Out-of-state owners", "A licensed local team for the rental you own somewhere you don't live."],
  ];
  return `<section class="ent-section ent-section--tight">
    <div class="container">
      <div class="ent-who">${cards
        .map(
          ([ic, h, p], i) => `<article class="ent-who__card animate-on-scroll" style="--i:${i}">${icon(ic, 26)}<h3>${esc(h)}</h3><p>${esc(p)}</p></article>`,
        )
        .join("")}</div>
    </div>
  </section>`;
}

function servicesGrid(track) {
  const list = track ? SERVICES.filter((s) => s.track === track || PACKAGES.some((p) => p.track === track && p.services.includes(s.id))) : SERVICES;
  const primary = track ? list.filter((s) => s.track === track) : list;
  const also = track ? list.filter((s) => s.track !== track) : [];
  return `<section class="ent-section" id="services">
    <div class="container">
      <div class="section-head animate-on-scroll">
        <div class="section-head__text">
          <span class="section-head__eyebrow">${track ? "What's included" : "The menu"}</span>
          <h2>${track ? "The work, in detail" : "Everything a building needs, from one team"}</h2>
          <p>${track ? "Each service below is available on its own or inside a package." : "Take one service or the whole menu. Licensed work — leasing and management — always runs under a signed agreement."}</p>
        </div>
      </div>
      ${
        track
          ? `<div class="ent-detail">${primary
              .map(
                (s) => `<article class="ent-detail__item animate-on-scroll" id="svc-${s.id}">
          <div class="ent-svc__icon">${icon(s.icon, 26)}</div>
          <div><span class="ent-tag${s.licensed ? " ent-tag--licensed" : ""}">${s.licensed ? "Licensed" : "Service"}</span><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p>
          <ul class="ent-ticks ent-ticks--cols">${s.bullets.map((b) => `<li>${icon("check", 15)}${esc(b)}</li>`).join("")}</ul></div>
        </article>`,
              )
              .join("")}</div>
      ${also.length ? `<p class="ent-also">Often paired with: ${also.map((s) => `<a href="${s.page}#svc-${s.id}">${esc(s.title)}</a>`).join(" · ")}</p>` : ""}`
          : `<div class="ent-svcs">${list.map(serviceCard).join("")}</div>`
      }
    </div>
  </section>`;
}

function how() {
  return `<section class="ent-section ent-section--ink" id="how">
    <div class="container">
      <span class="rl-kicker rl-kicker--light">How it works</span>
      <h2 class="ent-ink-title">Four steps, no surprises</h2>
      <ol class="ent-steps">${HOW_IT_WORKS.map((s, i) => `<li class="animate-on-scroll" style="--i:${i}"><span>${String(i + 1).padStart(2, "0")}</span><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></li>`).join("")}</ol>
    </div>
  </section>`;
}

function trust(track) {
  const points = [
    ["scale", "Owner-paid leasing fees", "We work for the owner who hires us. Renters never pay a fee for our leasing work, and any fee they do pay is spelled out in the listing — as New York City's FARE Act requires."],
    ["shield", "Fair housing, every ad", "One written screening standard for every applicant. No targeting or preference by any protected characteristic, and paid social runs under the housing ad rules."],
    ["vault", "Client money kept apart", "Rent we collect is held in a client trust account, separate from our own money, and reconciled on every statement."],
    ["building", "Homes, not hotel nights", "Furnished and co-living units are leased for 30 days or more — the same floor as the rest of RentLeaks."],
  ];
  return `<section class="ent-section" id="standards">
    <div class="container">
      <div class="section-head animate-on-scroll">
        <div class="section-head__text">
          <span class="section-head__eyebrow">Done by the book</span>
          <h2>The same DNA as every RentLeaks listing</h2>
          <p>All-in prices, honest fees and fair housing aren't a policy page here — they're how the work is done.</p>
        </div>
      </div>
      <div class="ent-trust">${points.map(([ic, h, p], i) => `<article class="animate-on-scroll" style="--i:${i}">${icon(ic, 24)}<h3>${esc(h)}</h3><p>${esc(p)}</p></article>`).join("")}</div>
      ${
        track === "owners" || !track
          ? `<div class="ent-checks animate-on-scroll">
        <h3>${track ? "Before your home is listed, we check" : "For out-of-state owners, before listing we check"}</h3>
        <ul>${COMPLIANCE_CHECKS.map((c) => `<li>${icon("check", 15)}${esc(c)}</li>`).join("")}</ul>
        <p class="ent-fine">Requirements depend on the city and state; we confirm the ones that apply to your property in writing. This is not legal advice.</p>
      </div>`
          : ""
      }
    </div>
  </section>`;
}

function statementDemo() {
  const rows = [
    ["Rent collected for you", "$18,400.00"],
    ["Paid for you: plumber, unit 3B", "− $240.00"],
    ["Paid for you: common-area cleaning", "− $380.00"],
    ["Management fee (8%)", "− $1,472.00"],
  ];
  return `<section class="ent-section ent-section--tight">
    <div class="container ent-split">
      <div class="animate-on-scroll">
        <span class="section-head__eyebrow">Owner statements</span>
        <h2 class="ent-h2">A statement you can read in a minute</h2>
        <p class="ent-p">Every month: rent collected, what we paid on your behalf with the receipts, our fee and the net to you — plus occupancy and anything that needs your decision. Out-of-state owners tell us it's the part they value most.</p>
        <ul class="ent-ticks">
          <li>${icon("check", 15)}Sent by the 10th for the month before</li>
          <li>${icon("check", 15)}Spending above your limit needs your OK first</li>
          <li>${icon("check", 15)}Photos with every inspection and turnover</li>
        </ul>
      </div>
      <figure class="ent-statement animate-on-scroll" aria-label="Illustration of an owner statement">
        <figcaption><span>Illustration · sample figures</span><b>Sample building — August</b><small>12 units · 11 occupied</small></figcaption>
        <table>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}<tr class="is-total"><td>Net to you</td><td>$16,308.00</td></tr></table>
        <div class="ent-statement__bar" style="--p:92%"><i></i><span>92% occupied</span></div>
      </figure>
    </div>
  </section>`;
}

function mediaStrip() {
  const tiles = [
    ["camera", "HDR photo sets", "Every unit type, the amenities and the street."],
    ["globe", "3D virtual tours", "Walk the unit from another city — or another country."],
    ["megaphone", "Reels & video", "Short walkthroughs built for social and portals."],
    ["broadcast", "Everywhere at once", "Major portals, local sites, social marketplaces and RentLeaks."],
  ];
  return `<section class="ent-section ent-section--tight">
    <div class="container">
      <div class="ent-media">${tiles.map(([ic, h, p], i) => `<article class="animate-on-scroll" style="--i:${i}">${icon(ic, 26)}<h3>${esc(h)}</h3><p>${esc(p)}</p></article>`).join("")}</div>
      <p class="ent-fine">Virtual staging is always labelled. Aerial footage is flown by a licensed drone pilot where it's allowed. Portal fees, where a portal charges them, are shown separately in the proposal.</p>
    </div>
  </section>`;
}

function remoteSteps() {
  const steps = [
    ["Local rules first", "Registration, disclosures, deposit limits and required notices — confirmed for your address before anything is listed."],
    ["Leased to a qualified renter", "Photos, listing, showings and one written screening standard. You approve the applicant."],
    ["Signed and handed over remotely", "E-signed lease, keys by courier or lockbox, and a move-in report with photos."],
    ["Looked after", "Rent collected, maintenance within your limit, seasonal inspections and a monthly statement."],
  ];
  return `<section class="ent-section ent-section--tight">
    <div class="container">
      <div class="section-head animate-on-scroll"><div class="section-head__text"><span class="section-head__eyebrow">From a thousand miles away</span><h2>What happens, in order</h2></div></div>
      <ol class="ent-timeline">${steps.map(([h, p], i) => `<li class="animate-on-scroll" style="--i:${i}"><span>${i + 1}</span><div><h3>${esc(h)}</h3><p>${esc(p)}</p></div></li>`).join("")}</ol>
    </div>
  </section>`;
}

function faq(track) {
  const items = FAQ.filter((f) => !track || !f.track || f.track === track);
  return `<section class="ent-section" id="faq">
    <div class="container ent-faq">
      <div class="section-head animate-on-scroll"><div class="section-head__text"><span class="section-head__eyebrow">Questions</span><h2>Answered plainly</h2></div></div>
      <div class="ent-faq__list">${items.map((f) => `<details class="animate-on-scroll"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</div>
    </div>
  </section>`;
}

function form(track) {
  const pre = track ? new Set(SERVICES.filter((s) => s.track === track).map((s) => s.id)) : new Set();
  const opt = (xs, def) => xs.map((x) => `<option value="${x.id}"${x.id === def ? " selected" : ""}>${esc(x.label)}</option>`).join("");
  return `<section class="ent-section ent-section--quote" id="quote">
    <div class="container ent-quote">
      <div class="ent-quote__intro animate-on-scroll">
        <span class="section-head__eyebrow">Get a proposal</span>
        <h2 class="ent-h2">Tell us about the property</h2>
        <p class="ent-p">Two minutes. A person replies within one business day to set up a call or a walk-through, then you get a written proposal with the scope, the fee and the timeline.</p>
        <ul class="ent-ticks">
          <li>${icon("check", 15)}No obligation, nothing to pay to ask</li>
          <li>${icon("check", 15)}We ask about the property — never about who will live there</li>
          <li>${icon("check", 15)}Licensed work starts only under a signed agreement</li>
        </ul>
      </div>
      <form class="ent-form form animate-on-scroll" id="ent-form" novalidate>
        <input type="text" name="website" class="ent-hp" tabindex="-1" autocomplete="off" aria-hidden="true">
        <fieldset>
          <legend><span>1</span> You</legend>
          <div class="ent-grid">
            <div class="form-group"><label for="f-name">Name</label><input id="f-name" name="name" class="form-input" autocomplete="name" required></div>
            <div class="form-group"><label for="f-email">Email</label><input id="f-email" name="email" type="email" class="form-input" autocomplete="email" required></div>
            <div class="form-group"><label for="f-phone">Phone <small>optional</small></label><input id="f-phone" name="phone" type="tel" class="form-input" autocomplete="tel"></div>
            <div class="form-group"><label for="f-company">Company <small>optional</small></label><input id="f-company" name="company" class="form-input" autocomplete="organization"></div>
            <div class="form-group"><label for="f-role">You are</label><select id="f-role" name="role" class="form-input">${opt(CLIENT_ROLES, track === "owners" ? "landlord" : "landlord")}</select></div>
            <div class="form-group"><label for="f-owner">Where you're based <small>optional</small></label><input id="f-owner" name="ownerLocation" class="form-input" placeholder="e.g. Texas, or London"></div>
          </div>
          <label class="ent-check"><input type="checkbox" name="outOfState"${track === "owners" ? " checked" : ""}> I don't live in the same state as the property</label>
        </fieldset>
        <fieldset>
          <legend><span>2</span> The property</legend>
          <div class="ent-grid">
            <div class="form-group"><label for="f-kind">Type</label><select id="f-kind" name="propertyKind" class="form-input">${opt(PROPERTY_KINDS, track === "owners" ? "single" : track === "management" ? "multi_room" : "building")}</select></div>
            <div class="form-group"><label for="f-units">Units or rooms</label><input id="f-units" name="units" type="number" min="0" inputmode="numeric" class="form-input" placeholder="24"></div>
            <div class="form-group"><label for="f-buildings">Buildings <small>optional</small></label><input id="f-buildings" name="buildings" type="number" min="0" inputmode="numeric" class="form-input" placeholder="1"></div>
            <div class="form-group"><label for="f-market">City</label><input id="f-market" name="market" class="form-input" list="ent-cities" placeholder="Brooklyn, NY"><datalist id="ent-cities"></datalist></div>
            <div class="form-group ent-grid__wide"><label for="f-address">Address or neighborhood <small>optional</small></label><input id="f-address" name="address" class="form-input" autocomplete="street-address"></div>
          </div>
        </fieldset>
        <fieldset>
          <legend><span>3</span> What you need</legend>
          <div class="form-group"><label for="f-package">Package <small>optional — we'll suggest one</small></label><select id="f-package" name="packageId" class="form-input"><option value="">Not sure yet</option>${TRACKS.map(
            (t) => `<optgroup label="${esc(t.label)}">${PACKAGES.filter((p) => p.track === t.id)
              .map((p) => `<option value="${p.id}">${esc(p.name)} — ${esc(p.tagline)}</option>`)
              .join("")}</optgroup>`,
          ).join("")}</select></div>
          <div class="ent-choices" role="group" aria-label="Services">${SERVICES.map(
            (s) => `<label class="ent-choice"><input type="checkbox" name="services" value="${s.id}"${pre.has(s.id) ? " checked" : ""}><span>${icon(s.icon, 18)}<b>${esc(s.title)}</b><small>${esc(s.short)}</small></span></label>`,
          ).join("")}</div>
          <details class="ent-more"><summary>Add-ons</summary><div class="ent-addon-picks">${ADD_ONS.map((a) => `<label class="ent-check"><input type="checkbox" name="addOns" value="${a.id}"> ${esc(a.label)}</label>`).join("")}</div></details>
          <div class="ent-grid">
            <div class="form-group"><label for="f-timeline">When</label><select id="f-timeline" name="timeline" class="form-input">${opt(TIMELINES, "30d")}</select></div>
          </div>
          <div class="form-group"><label for="f-message">Anything we should know <small>optional</small></label><textarea id="f-message" name="message" rows="4" class="form-input" placeholder="Vacancies, current manager, what's not working, the date you need to be leased by…"></textarea></div>
        </fieldset>
        <label class="ent-check ent-consent"><input type="checkbox" name="consent" required> RentLeaks may contact me about this request by email or phone.</label>
        <p class="ent-form__error" role="alert" hidden></p>
        <button type="submit" class="btn btn--brand btn--lg btn--block">Send my request ${icon("arrow", 18)}</button>
        <p class="ent-fine">Brokerage and management are provided under a signed agreement by the licensed brokerage shown at the top of this page. We never ask for payment to review a request.</p>
      </form>
      <div class="ent-done" id="ent-done" hidden tabindex="-1">
        ${icon("check", 34)}
        <h3>Request received</h3>
        <p>Thank you — a copy is on its way to your inbox. Someone from our team replies within one business day.</p>
        <a class="btn btn--outline" href="../index.html">Back to RentLeaks</a>
      </div>
    </div>
  </section>`;
}

function cta(track) {
  const others = TRACKS.filter((t) => t.id !== track);
  return `<section class="professionals-cta">
    <div class="container">
      <span class="rl-kicker rl-kicker--light">More from RentLeaks Enterprise</span>
      <h2 class="professionals-cta__title">${track ? "Pair it with the rest of the menu" : "Just listing a few rooms?"}</h2>
      <p class="professionals-cta__subtitle">${
        track
          ? others.map((t) => `<a href="${t.page}">${esc(t.label)}</a>`).join(" · ")
          : 'Hosts and operators can still list directly with a weekly or monthly plan. <a href="../professionals.html">See host plans</a>.'
      }</p>
      <a href="#quote" class="btn btn--dark btn--lg">Get a proposal</a>
    </div>
  </section>`;
}

function page(key) {
  const pg = PAGES[key];
  const t = pg.track;
  const body = [
    hero(pg),
    licenceStrip(),
    menu(key),
    t ? "" : who(),
    servicesGrid(t),
    t === "marketing" ? mediaStrip() : "",
    t === "owners" ? remoteSteps() : "",
    t === "management" || t === "owners" ? statementDemo() : "",
    packages(t),
    how(),
    trust(t),
    faq(t),
    form(t),
    cta(t),
  ].join("\n");
  return `${head(pg)}
<body class="tahoe-body ent-body" data-page="enterprise" data-track="${t || "all"}">
  <div class="tahoe-bg" aria-hidden="true"><div class="tahoe-orb tahoe-orb--1"></div><div class="tahoe-orb tahoe-orb--2"></div><div class="tahoe-noise"></div></div>
  <a href="#main" class="skip-link">Skip to main content</a>
  <div class="tahoe-content">
    <div id="rl-header"></div>
    <main id="main">
${body}
    </main>
    <div id="rl-footer"></div>
  </div>
  <script src="../data.js"></script>
  <script src="../data-source.js"></script>
  <script src="../script.js"></script>
  <script src="../rentleaks-i18n.js"></script>
  <script src="../rentleaks-rules.js?v=20260913b"></script>
  <script src="../rentleaks-x.js?v=20260918" defer></script>
  <script src="../rentleaks-social.js?v=20260915-rentleaks.official" defer></script>
  <script src="enterprise.js?v=${V}" defer></script>
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
