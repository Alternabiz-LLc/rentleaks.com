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
"""
import os
import sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://rentleaks.com"
TODAY = date.today().strftime("%Y-%m-%d")

# Asset versions, kept in step with facebook.html.
CSS_X, CSS_LEADS = "20260913", "20260916"
JS_RULES, JS_X, JS_SOCIAL, JS_LEADS = "20260913b", "20260918", "20260918", "20260918"

PAGES = {
    "instagram": {
        "platform": "Instagram",
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


def head(slug, p):
    url = f"{SITE}/{slug}.html"
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
  <link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="rentleaks-x.css?v={CSS_X}"><link rel="stylesheet" href="rentleaks-leads.css?v={CSS_LEADS}">
</head>"""


def body(slug, p):
    plat, src = p["platform"], p["source"]
    utm = f"?utm_source={src}&amp;utm_medium=page"
    return f"""<body class="tahoe-body" data-page="{slug}">
  <div class="tahoe-bg" aria-hidden="true">
    <div class="tahoe-orb tahoe-orb--1"></div>
    <div class="tahoe-orb tahoe-orb--2"></div>
    <div class="tahoe-noise"></div>
  </div>
  <a href="#main" class="skip-link">Skip to main content</a>
  <div class="tahoe-content">
    <div id="rl-header"></div>
    <main id="main">
      <section class="container fbl-wrap page-hero fbl-hero">
        <span class="rl-kicker">RentLeaks on {plat}</span>
        <h1>{p['h1']}</h1>
        <p>{p['lede']}</p>
        <ul class="fbl-trust">
          <li>Free to ask — no application fees</li>
          <li>Reply within one business day</li>
          <li>Never pay before you view</li>
        </ul>
        <p class="fbl-hero__links">
          <a class="btn btn--outline" href="rent.html{utm}&amp;utm_campaign=browse">Browse homes</a>
          <a class="btn btn--outline" href="mailto:hello@rentleaks.com?subject=RentLeaks%20from%20{plat}">Email us</a>
          <a class="btn btn--outline" data-social-profile="{slug}" href="#" target="_blank" rel="noopener" hidden>{p['profile_cta']}</a>
        </p>
      </section>
      <section class="rl-page" style="padding-top:0">
        <div class="container fbl-wrap">
          <div id="rl-landing" data-handoff="email" data-source="{src}">
            <noscript><p>This form needs JavaScript. You can also email <a href="mailto:hello@rentleaks.com">hello@rentleaks.com</a>, or <a href="rent.html">browse homes</a>.</p></noscript>
          </div>
        </div>
      </section>
      <section class="rl-page" style="padding-top:0">
        <div class="container fbl-wrap">
          <h2>How it works</h2>
          <ol class="fbl-steps">
            <li><b>Tell us, or pick a home</b>Send what you need, or choose a home and give up to three viewing times.</li>
            <li><b>We confirm</b>We or the host reply within one business day by email, phone or text.</li>
            <li><b>View it, then decide</b>In person or on a live video call. Nothing is signed or paid until you have seen it.</li>
          </ol>
        </div>
      </section>
      <section class="rl-page" style="padding-top:0">
        <div class="container fbl-wrap">
          <h2>Came from a post?</h2>
          <p>The things we talk about on {plat}, in full:</p>
          <ul class="fbl-trust">
            <li><a href="hire-a-broker/guide.html{utm}&amp;utm_campaign=guide">The free renter guides</a> — who pays a broker fee now, what a fee should cost, and what a fair agreement says.</li>
            <li><a href="hire-a-broker/{utm}&amp;utm_campaign=hire">Hire a broker</a> — set the most you&rsquo;ll pay, and licensed agents propose at or under it.</li>
            <li><a href="hire-a-broker/agents.html{utm}&amp;utm_campaign=agents">For agents</a> — join the referral network; nothing to join, nothing per lead.</li>
          </ul>
          <p class="fbl-hint">General information, not legal advice. We describe homes, never the people who should live in them.</p>
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
        open(path, "w", encoding="utf-8").write(head(slug, p) + "\n" + body(slug, p))
        written.append(f"{slug}.html")
    print("Wrote " + ", ".join(written))
    print("  The profile button stays hidden until tools/apply-social-links.py sets that handle.")


if __name__ == "__main__":
    main()
