#!/usr/bin/env python3
"""
Builds the per-profile landing pages — instagram.html, tiktok.html, linkedin.html.

    python3 tools/build-social-pages.py              (all of them)
    python3 tools/build-social-pages.py instagram    (just one)

Each one is where that profile's link-in-bio, button, posts and ads send
people: the same lead form as facebook.html, the same shell, the same brand —
only the words and the attribution change. facebook.html is NOT generated here;
it came first, carries Messenger-specific wiring, and is edited by hand.

The pages are static, so nothing here depends on the accounts existing. The
"Our profile" button is emitted hidden and carries data-social-profile; it is
filled in and revealed by rentleaks-social.js only once that handle is set in
HANDLES (tools/apply-social-links.py sets them). Until then it is removed from
the page — the site never links to a profile that isn't there.

Attribution: the mount carries data-source, so a bio tap with no referrer (the
in-app browsers strip it) is still filed as instagram/tiktok/linkedin rather
than "web". The values match LEAD_SOURCES in web/src/lib/leads.ts.

The page is a full landing page, built from the site's own components
(enterprise.css) so it looks like the rest of rentleaks.com rather than like a
form on a blank sheet: a photo hero with the live numbers, the lead form, the
three steps, every housing type we list, what the account actually posts, the
safety rules, and a closing call to action.

Two things are read rather than written here, so they cannot drift:
  · the housing types and the market count come from data.js, through node;
  · the hero photo is images/social/photos/<slug>.jpg when that file exists,
    and a stock photograph until tools/fetch-ig-photos.sh has run.
"""
import json
import os
import subprocess
import sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://rentleaks.com"
TODAY = date.today().strftime("%Y-%m-%d")

# Asset versions, kept in step with facebook.html.
CSS_X, CSS_LEADS, CSS_ENT = "20260913", "20260916", "20260923"
JS_RULES, JS_X, JS_SOCIAL, JS_LEADS = "20260913b", "20260918", "20260919", "20260918"
V = "20260919"

STOCK = "https://images.unsplash.com/{id}?auto=format&fit=crop&w=2000&q=72"


def site_data():
    """housingTypes and the market count, read from data.js itself."""
    js = (
        "const fs=require('fs'),vm=require('vm');"
        "const c={window:{},localStorage:{getItem:()=>null,setItem(){}},console};vm.createContext(c);"
        "vm.runInContext(fs.readFileSync(process.argv[1],'utf8'),c);"
        "const D=c.window.RENTLEAKS_DATA;"
        "const cs=(D.cities||[]).map(c=>({name:c.name,slug:c.slug,rank:c.rank}));"
        "console.log(JSON.stringify({types:D.housingTypes,cities:(D.cities||[]).length,cities_list:cs}));"
    )
    out = subprocess.run(
        ["node", "--no-warnings", "-e", js, os.path.join(ROOT, "data.js")],
        capture_output=True, text=True, check=True,
    )
    return json.loads(out.stdout)


def hero_img(p):
    """The page's own interior once it has been fetched, a stock room until then.

    Root-absolute, and that matters: --ent-img is set inline on the element but
    substituted inside enterprise/enterprise.css, and a browser resolves a
    relative url() in a custom property against the stylesheet, not the page.
    A bare "images/..." here would be fetched as "/enterprise/images/...".
    """
    local = os.path.join(ROOT, "images", "social", "photos", f"{p['photo']}.jpg")
    if os.path.exists(local):
        return f"/images/social/photos/{p['photo']}.jpg?v={V}"
    return STOCK.format(id=p["stock"])


CHECK = (
    '<svg class="ent-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>'
)
ARROW = (
    '<svg class="ent-ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
)

PAGES = {
    "instagram": {
        "platform": "Instagram",
        "faq": [
            ("Is RentLeaks free to use?", "Yes. Asking, browsing and booking a viewing cost nothing, there is no application fee, and RentLeaks never takes a payment from a renter. You are never charged for finding a home here."),
            ("What is the minimum stay?", "Thirty days. RentLeaks is housing, not hotels — there are no nightly bookings, and in a few markets the local floor is higher (Berlin is nearer three months, Montr\u00e9al is 31 days)."),
            ("What does an all-in price include?", "Base rent plus whatever utilities, wifi and cleaning that listing includes, shown as one number before you contact anyone. If something is not included, the listing says so."),
            ("Do I have to pay a broker fee?", "Only if you hire your own broker, at a fee you agree in writing first. Since the FARE Act took effect in New York on 11 June 2025, a landlord's agent cannot pass their fee to you."),
            ("Can I find a furnished apartment for three months?", "Yes — furnished apartments, private rooms, co-living and aparthotel stays all list from 30 days, with the stay length as a filter rather than an afterthought."),
            ("How quickly will someone reply?", "Within one business day, by email, phone or text — whichever you asked for."),
        ],
        "photo": "aparthotel-lounge",
        "stock": "photo-1773069459487-3d2d7bb4532e",
        "posts": [
            ["Who pays a broker fee now", "The FARE Act in one card, and the maths that goes with it."],
            ["What a home actually costs", "All-in prices, and the fees a listing has to disclose."],
            ["The rule in your city", "Deposit caps, sublet windows, minimum stays — sourced, per market."],
            ["How to hire a broker", "Set a fee cap, compare up to three, sign one clear agreement."],
        ],
        "source": "instagram",
        "title": "RentLeaks on Instagram — Find, View &amp; Book a Flexible Home",
        "description": (
            "The link in our bio. Tell RentLeaks what you need, book a viewing, or send your dates "
            "for a room, co-living space or furnished 1-month+ home. Replies within one business day; "
            "no fees to ask."
        ),
        "h1": "You found us on Instagram. Now find the home.",
        "lede": (
            "Rooms, co-living, furnished and 1-month+ stays, at all-in prices. Tell us what you need, "
            "book a viewing, or send your dates — we reply within one business day."
        ),
        "profile_cta": "Our Instagram",
        "keywords": "RentLeaks Instagram, link in bio, book a viewing, flexible rental, furnished apartment, room for rent, co-living, 1-month rental",
    },
    "tiktok": {
        "platform": "TikTok",
        "faq": [
            ("Is RentLeaks free to use?", "Yes. Asking, browsing and booking a viewing cost nothing, there is no application fee, and RentLeaks never takes a payment from a renter."),
            ("What is the minimum stay?", "Thirty days. This is housing, not hotel nights — there are no nightly bookings."),
            ("What does an all-in price include?", "Base rent plus the utilities, wifi and cleaning that listing includes, shown as one number before you enquire."),
            ("Who pays the broker fee?", "Whoever hired the broker. Since 11 June 2025 in New York City, a landlord's agent cannot charge the renter; you pay only a broker you hired yourself, at a fee agreed in writing first."),
            ("Can I take over someone's lease?", "Yes. Lease-break posts are free, and each one shows the remaining term and whether it is an assignment or a sublet."),
            ("How quickly will someone reply?", "Within one business day, by email, phone or text."),
        ],
        "photo": "coliving-lounge",
        "stock": "photo-1773069459487-3d2d7bb4532e",
        "posts": [
            ["The fee rule in 30 seconds", "Who hires the broker pays the broker — and the one exception."],
            ["Convert before you compare", "One month, 12% and 15% on the same apartment."],
            ["Don't sign that", "Four things that mean you should walk away from an agreement."],
            ["Read the listing with me", "What a fee line tells you, and what it leaves out."],
        ],
        "source": "tiktok",
        "title": "RentLeaks on TikTok — Find, View &amp; Book a Flexible Home",
        "description": (
            "The link from our TikTok. Tell RentLeaks what you need, book a viewing, or send your dates "
            "for a room, co-living space or furnished 1-month+ home. Replies within one business day; "
            "no fees to ask."
        ),
        "h1": "You found us on TikTok. Now find the home.",
        "lede": (
            "Rooms, co-living, furnished and 1-month+ stays, at all-in prices. Tell us what you need, "
            "book a viewing, or send your dates — we reply within one business day."
        ),
        "profile_cta": "Our TikTok",
        "keywords": "RentLeaks TikTok, link in bio, book a viewing, flexible rental, furnished apartment, room for rent, co-living, 1-month rental",
    },
    "linkedin": {
        "platform": "LinkedIn",
        "faq": [
            ("What is mid-term housing?", "Furnished homes let for 30 days or more — the gap between a hotel and a 12-month lease. Relocations, contracts, projects and renovations all sit in it."),
            ("Is RentLeaks free to use?", "Yes for renters: no booking fee, no application fee, and no payment ever taken by RentLeaks."),
            ("What does an all-in price include?", "Base rent plus the utilities, wifi and cleaning that listing includes, quoted as one monthly number."),
            ("Can a company book for an employee?", "Yes. Tell us the dates, the budget and the market, and we reply within one business day."),
            ("Which markets do you cover?", "79, across the United States and Canada plus major cities in the UK, Ireland, France, Spain, the Netherlands, Switzerland, Germany and Italy."),
            ("How do broker fees work?", "Whoever hires the broker pays the broker. A renter pays only a broker they hired, at a fee agreed in writing before the search."),
        ],
        "photo": "furnished-living",
        "stock": "photo-1773069459487-3d2d7bb4532e",
        "posts": [
            ["The mid-term market", "What sits between a hotel and a 12-month lease, and who needs it."],
            ["Relocation without a year lease", "30-day-plus homes, all-in, in 79 markets."],
            ["How the rules differ", "Berlin, Amsterdam, London and New York, side by side."],
            ["For brokerages", "Tenant leads with a budget, dates and a fee already agreed."],
        ],
        "source": "linkedin",
        "title": "RentLeaks on LinkedIn — Find, View &amp; Book a Flexible Home",
        "description": (
            "Where our LinkedIn page sends people. Tell RentLeaks what you need, book a viewing, or send "
            "your dates for a room, co-living space or furnished 1-month+ home. Replies within one "
            "business day; no fees to ask."
        ),
        "h1": "Relocating, or between homes?",
        "lede": (
            "Rooms, co-living, furnished and 1-month+ stays, at all-in prices — the housing that sits "
            "between a hotel and a 12-month lease. Tell us what you need and we reply within one "
            "business day."
        ),
        "profile_cta": "Our LinkedIn page",
        "keywords": "RentLeaks LinkedIn, corporate housing, relocation, flexible rental, furnished apartment, co-living, 1-month rental",
    },
}

# Bots we ask to index and cite, in the order facebook.html lists them.
BOTS = [
    ("robots", "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"),
    ("googlebot", "index, follow, max-image-preview:large"),
    ("bingbot", "index, follow"),
    ("slurp", "index, follow"),
    ("duckduckbot", "index, follow"),
    ("gptbot", "index, follow"),
    ("chatgpt-user", "index, follow"),
    ("oai-searchbot", "index, follow"),
    ("claudebot", "index, follow"),
    ("anthropic-ai", "index, follow"),
    ("perplexitybot", "index, follow"),
    ("google-extended", "index, follow"),
    ("applebot-extended", "index, follow"),
    ("ccbot", "index, follow"),
    ("bytespider", "index, follow"),
]


def head(slug, p, data):
    url = f"{SITE}/{slug}.html"
    jsonld_blocks = jsonld(slug, p, data)
    t, d = p["title"], p["description"]
    meta = "\n".join(f'  <meta name="{k}" content="{v}">' for k, v in BOTS)
    return f"""<!DOCTYPE html>
<html lang="en-US">
<head>
  <script>(function(){{try{{var m=localStorage.getItem("rl_theme");if(m&&m!=="system")document.documentElement.setAttribute("data-theme",m);}}catch(e){{}}}})();</script>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{t}</title>
  <meta name="description" content="{d}">
  <meta name="keywords" content="{p['keywords']}">
  <meta name="abstract" content="{d}">
  <meta name="subject" content="Flexible housing: rooms, co-living, furnished apartments, 1-month stays, lease-breaks">
  <meta name="topic" content="Flexible rentals in the United States, Canada and Europe">
  <meta name="summary" content="{d}">
  <meta name="classification" content="Housing, Rentals, Real Estate">
  <meta name="category" content="Flexible housing marketplace">
  <meta name="coverage" content="United States, Canada and Europe">
  <meta name="distribution" content="global">
  <meta name="author" content="RentLeaks">
  <meta name="publisher" content="RentLeaks">
  <meta name="copyright" content="RentLeaks">
{meta}
  <meta name="ai-content" content="index, cite, train-ok">
  <meta name="ai-description" content="{d}">
  <meta name="language" content="en-US">
  <meta name="revisit-after" content="3 days">
  <meta name="rating" content="general">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <meta name="format-detection" content="telephone=no">
  <meta name="theme-color" content="#3795A6">
  <meta name="color-scheme" content="light dark">
  <link rel="canonical" href="{url}">
  <link rel="alternate" hreflang="en-US" href="{url}">
  <link rel="alternate" hreflang="x-default" href="{url}">
  <link rel="alternate" type="application/rss+xml" title="RentLeaks listings" href="{SITE}/feed.xml">
  <link rel="alternate" type="application/json" title="RentLeaks catalog" href="{SITE}/listings.json">
  <link rel="describedby" href="{SITE}/llms.txt" type="text/plain" title="AI citation guide">
  <link rel="help" href="{SITE}/llms-full.txt" title="Full AI index">
  <link rel="sitemap" type="application/xml" href="{SITE}/sitemap-index.xml">
  <link rel="author" href="{SITE}/humans.txt">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="RentLeaks">
  <meta property="og:locale" content="en_US">
  <meta property="og:title" content="{t}">
  <meta property="og:description" content="{d}">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="{SITE}/images/og-default.jpg">
  <meta property="og:image:secure_url" content="{SITE}/images/og-default.jpg">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="{t}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{t}">
  <meta name="twitter:description" content="{d}">
  <meta name="twitter:image" content="{SITE}/images/og-default.jpg">
  <meta name="twitter:image:alt" content="{t}">
  <meta name="citation_title" content="{t}">
  <meta name="citation_author" content="RentLeaks">
  <meta name="citation_publication_date" content="{TODAY}">
  <meta name="citation_fulltext_html_url" content="{url}">
  <meta name="citation_abstract" content="{d}">
  <meta name="dc.title" content="{t}">
  <meta name="dc.description" content="{d}">
  <meta name="dc.language" content="en-US">
  <meta name="dc.publisher" content="RentLeaks">
  <meta name="dc.identifier" content="{url}">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%233795A6'/><text x='16' y='22' font-size='14' font-weight='bold' fill='%23F1F9FA' text-anchor='middle' font-family='system-ui'>RL</text></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
{jsonld_blocks}
  <link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="rentleaks-x.css?v={CSS_X}"><link rel="stylesheet" href="enterprise/enterprise.css?v={CSS_ENT}"><link rel="stylesheet" href="social.css?v={V}"><link rel="stylesheet" href="rentleaks-leads.css?v={CSS_LEADS}">
</head>"""


def jsonld(slug, p, data):
    """WebPage, breadcrumb and the FAQ, as structured data.

    The FAQ on the page and the FAQPage markup come from the same list, so they
    can never disagree — which is the whole point of marking it up.
    """
    url = f"{SITE}/{slug}.html"
    blocks = [
        {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "@id": url,
            "url": url,
            "name": p["title"].replace("&amp;", "&"),
            "description": p["description"],
            "inLanguage": "en-US",
            "isPartOf": {"@type": "WebSite", "name": "RentLeaks", "url": SITE},
            "about": {"@type": "Organization", "name": "RentLeaks", "url": SITE},
            "primaryImageOfPage": {"@type": "ImageObject", "url": f"{SITE}/images/og-default.jpg"},
            "breadcrumb": {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/"},
                    {"@type": "ListItem", "position": 2, "name": f"RentLeaks on {p['platform']}", "item": url},
                ],
            },
        },
        {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
                {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}}
                for q, a in p["faq"]
            ],
        },
        {
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": "Kinds of flexible home on RentLeaks",
            "itemListElement": [
                {"@type": "ListItem", "position": i + 1, "name": t["label"], "url": f"{SITE}/{t['href']}"}
                for i, t in enumerate(data["types"])
            ],
        },
    ]
    return "\n".join(
        '  <script type="application/ld+json">' + json.dumps(b, separators=(",", ":")) + "</script>"
        for b in blocks
    )


def markets(data, utm, n=16):
    """The busiest markets, linked. Real pages, useful to a reader and to a
    crawler that would otherwise find this page a dead end."""
    top = sorted(data["cities_list"], key=lambda c: c.get("rank") or 999)[:n]
    items = "".join(
        f'<li><a href="cities/{c["slug"]}.html{utm}&amp;utm_campaign=markets">{c["name"]}</a></li>' for c in top
    )
    return f'<ul class="rl-markets">{items}</ul>'


def feed_strip(slug):
    """Six real cards from the launch feed, when they have been rendered.

    The best argument for following the account is the account's own work, so
    the page shows it rather than describing it. Missing files are skipped, so
    a fresh clone still builds a valid page.
    """
    picks = [
        ("01-welcome", "Rooms, co-living, furnished homes and 1-month-plus stays at all-in prices"),
        ("03-fare-who-pays", "Whoever hires the broker pays the broker — the New York FARE Act in one card"),
        ("04-fee-maths", "One month versus 15% of a year: a $2,880 difference on the same apartment"),
        ("11-nyc-fees", "New York application fees are capped at $20 and the deposit at one month"),
        ("13-paris", "The Paris bail mobilit\u00e9 runs one to ten months and takes no deposit"),
        ("20-for-agents", "Tenant leads for licensed agents: area, budget, dates and the fee they will pay"),
    ]
    out = []
    for name, alt in picks:
        rel = f"images/social/ig/{name}.jpg"
        if os.path.exists(os.path.join(ROOT, rel)):
            # Real alt text, not "post image": it is what a screen reader reads
            # and what an image search has to go on.
            out.append(
                f'<li><img src="{rel}?v={V}" alt="{alt}" loading="lazy" decoding="async" width="1080" height="1350"></li>'
            )
    return "".join(out)


def body(slug, p, data):
    plat, src = p["platform"], p["source"]
    utm = f"?utm_source={src}&amp;utm_medium=page"
    types = "".join(
        f'''<li class="animate-on-scroll" style="--i:{i}">
              <a href="{t['href']}{utm}&amp;utm_campaign=types">
                <h3>{t['label']}</h3>
                <p>{t['blurb']}</p>
                <span class="ent-link">See {t['short'].lower()} {ARROW}</span>
              </a>
            </li>'''
        for i, t in enumerate(data["types"])
    )
    posts = "".join(
        f'<li class="animate-on-scroll" style="--i:{i}"><h3>{h}</h3><p>{d}</p></li>'
        for i, (h, d) in enumerate(p["posts"])
    )
    faq = "".join(
        f"<details><summary>{q}</summary><p>{a}</p></details>" for q, a in p["faq"]
    )
    market_links = markets(data, utm)
    cities = data["cities"]
    strip = feed_strip(slug)
    strip_block = (
        f'<ul class="rl-feed" aria-label="Recent posts from the {plat} account">{strip}</ul>' if strip else ""
    )
    return f"""<body class="tahoe-body ent-body" data-page="{slug}">
  <div class="tahoe-bg" aria-hidden="true">
    <div class="tahoe-orb tahoe-orb--1"></div>
    <div class="tahoe-orb tahoe-orb--2"></div>
    <div class="tahoe-noise"></div>
  </div>
  <a href="#main" class="skip-link">Skip to main content</a>
  <div class="tahoe-content">
    <div id="rl-header"></div>
    <main id="main">

      <section class="ent-hero" style="--ent-img:url('{hero_img(p)}')">
        <div class="ent-hero__media" role="presentation"></div>
        <div class="container ent-hero__inner">
          <nav class="rl-crumb rl-crumb--light" aria-label="Breadcrumb"><a href="index.html">Home</a> / RentLeaks on {plat}</nav>
          <span class="ent-hero__kicker">RentLeaks on {plat}</span>
          <h1 class="ent-hero__title">{p['h1']}</h1>
          <p class="ent-hero__lede">{p['lede']}</p>
          <div class="ent-hero__actions">
            <a class="btn btn--dark btn--lg" href="#start">Tell us what you need {ARROW}</a>
            <a class="btn btn--on-dark btn--lg" href="rent.html{utm}&amp;utm_campaign=browse">Browse homes</a>
            <a class="btn btn--on-dark btn--lg" data-social-profile="{slug}" href="#" target="_blank" rel="noopener" hidden>{p['profile_cta']}</a>
          </div>
          <dl class="ent-hero__stats">
            <div><dt>minimum stay</dt><dd>30 days</dd></div>
            <div><dt>markets</dt><dd>{data['cities']}</dd></div>
            <div><dt>prices</dt><dd>All-in</dd></div>
            <div><dt>to ask</dt><dd>$0</dd></div>
          </dl>
        </div>
      </section>

      <section class="ent-section ent-section--tight" id="start">
        <div class="container">
          <span class="rl-kicker">Start here</span>
          <h2 class="ent-h2">Tell us what you need, or book a viewing</h2>
          <p class="ent-p">A reply within one business day, by email, phone or text. Free to ask, no application fee, and nothing is signed or paid until you have seen the home.</p>
          <div id="rl-landing" data-handoff="email" data-source="{src}">
            <noscript><p>This form needs JavaScript. You can also email <a href="mailto:hello@rentleaks.com">hello@rentleaks.com</a>, or <a href="rent.html">browse homes</a>.</p></noscript>
          </div>
        </div>
      </section>

      <section class="ent-section ent-section--ink">
        <div class="container">
          <span class="rl-kicker rl-kicker--light">How it works</span>
          <h2 class="ent-ink-title">As easy as 1, 2, 3</h2>
          <ol class="ent-steps">
            <li class="animate-on-scroll" style="--i:0"><span aria-hidden="true">1</span><h3>Tell us, or pick a home</h3><p>Send what you need, or choose a home and give up to three viewing times.</p></li>
            <li class="animate-on-scroll" style="--i:1"><span aria-hidden="true">2</span><h3>We confirm</h3><p>We or the host reply within one business day, by email, phone or text.</p></li>
            <li class="animate-on-scroll" style="--i:2"><span aria-hidden="true">3</span><h3>View it, then decide</h3><p>In person or on a live video call. Nothing signed or paid until you have seen it.</p></li>
          </ol>
        </div>
      </section>

      <section class="ent-section">
        <div class="container">
          <span class="rl-kicker">What we list</span>
          <h2 class="ent-h2">Six kinds of home, one honest price</h2>
          <p class="ent-p">Every listing shows an all-in monthly price — base rent plus the utilities, wifi and cleaning it includes — and every stay is 30 days or more. Housing, not hotel nights.</p>
          <ul class="ent-grid">{types}</ul>
        </div>
      </section>

      <section class="ent-section ent-section--tight">
        <div class="container">
          <span class="rl-kicker">On the feed</span>
          <h2 class="ent-h2">What we post on {plat}</h2>
          <p class="ent-p">No listing spam. The things that actually change what you pay, and what you sign.</p>
          <ul class="ent-grid">{posts}</ul>
          {strip_block}
          <p class="ent-fine">General information, not legal advice; rules vary by city and state. We describe homes, never the people who should live in them.</p>
        </div>
      </section>

      <section class="ent-section">
        <div class="container ent-split">
          <div>
            <span class="rl-kicker">Free guides</span>
            <h2 class="ent-h2">Three PDFs worth five minutes</h2>
            <p class="ent-p">Who pays a broker fee now, what one should cost, how to negotiate it, and — for licensed agents — how our referral program works and what it pays.</p>
            <p><a class="btn btn--primary btn--lg" href="hire-a-broker/guide.html{utm}&amp;utm_campaign=guide">Get the guides {ARROW}</a></p>
          </div>
          <div>
            <span class="rl-kicker">Stay safe</span>
            <h2 class="ent-h2">Never pay before you have seen it</h2>
            <ul class="ent-ticks">
              <li>{CHECK}Rent and deposits go to the landlord, against a signed lease</li>
              <li>{CHECK}Never to a personal account, by wire, gift card or crypto</li>
              <li>{CHECK}See the home first — in person or on a live video call</li>
              <li>{CHECK}RentLeaks never takes a payment and never asks you for one</li>
            </ul>
          </div>
        </div>
      </section>

      <section class="ent-section ent-section--tight" id="questions">
        <div class="container">
          <span class="rl-kicker">Questions</span>
          <h2 class="ent-h2">The ones people actually ask</h2>
          <div class="rl-faq">{faq}</div>
        </div>
      </section>

      <section class="ent-section ent-section--tight">
        <div class="container">
          <span class="rl-kicker">Where</span>
          <h2 class="ent-h2">{cities} markets, and counting</h2>
          <p class="ent-p">The United States and Canada, plus major cities across the UK, Ireland, France, Spain, the Netherlands, Switzerland, Germany and Italy. A few of the busiest:</p>
          {market_links}
          <p class="ent-p"><a class="ent-link" href="cities.html{utm}&amp;utm_campaign=markets">See every market {ARROW}</a></p>
        </div>
      </section>

      <section class="ent-section ent-section--quote">
        <div class="container ent-quote">
          <div class="ent-quote__intro animate-on-scroll">
            <span class="section-head__eyebrow">Next</span>
            <h2 class="ent-h2">Two minutes of typing, then a real reply</h2>
            <p class="ent-p">Or hire your own broker: set the most you will pay, and up to three verified licensed agents propose at or under it. No lease, no fee. Nothing owed to us, ever.</p>
            <p class="ent-hero__actions">
              <a class="btn btn--primary btn--lg" href="#start">Tell us what you need {ARROW}</a>
              <a class="btn btn--outline btn--lg" href="hire-a-broker/{utm}&amp;utm_campaign=hire">Hire a broker</a>
              <a class="btn btn--outline btn--lg" data-social-profile="{slug}" href="#" target="_blank" rel="noopener" hidden>{p['profile_cta']}</a>
            </p>
          </div>
        </div>
      </section>

    </main>
    <div id="rl-footer"></div>
  </div>
  <script src="data.js"></script>
  <script src="data-source.js"></script>
  <script src="script.js"></script>
  <script src="rentleaks-rules.js?v={JS_RULES}"></script>
  <script src="rentleaks-x.js?v={JS_X}" defer></script>
  <script src="rentleaks-social.js?v={JS_SOCIAL}" defer></script>
  <script src="rentleaks-leads.js?v={JS_LEADS}" defer></script>
</body>
</html>
"""


def main():
    want = [a.lower() for a in sys.argv[1:]] or list(PAGES)
    unknown = [w for w in want if w not in PAGES]
    if unknown:
        sys.exit(f"Unknown page(s): {', '.join(unknown)}. Have: {', '.join(PAGES)}")
    written = []
    for slug in want:
        p = PAGES[slug]
        path = os.path.join(ROOT, f"{slug}.html")
        data = site_data()
        open(path, "w", encoding="utf-8").write(head(slug, p, data) + "\n" + body(slug, p, data))
        written.append(f"{slug}.html")
    print("Wrote " + ", ".join(written))
    print("  The profile button stays hidden until tools/apply-social-links.py sets that handle.")


if __name__ == "__main__":
    main()
