#!/usr/bin/env python3
"""
Applies the RentLeaks X evidence layer to the repo, in one pass.

  1. data.js       — fixes the hard-coded "$" in every listing description
                     (a €1,800 Seville room was being described as $1800), and
                     removes the tenant-paid broker fee in markets where
                     charging it to the tenant is unlawful.
  2. generator     — enriches the pre-rendered listing JSON-LD with the
                     availability window, minimum-stay duration, an explicit
                     all-in UnitPriceSpecification, occupancy and petsAllowed.
                     AI crawlers largely do not run JavaScript, so this has to
                     be in the served HTML, not injected at runtime.
  3. every page    — links rentleaks-x.css and rentleaks-x.js with the right
                     relative base. Idempotent: safe to re-run.

Run from the repo root:  python3 tools/apply-rentleaks-x.py
"""

import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(os.path.join(__file__, "..")))
if not os.path.exists(os.path.join(ROOT, "data.js")):
    ROOT = os.getcwd()

CHANGES = []


def log(msg):
    CHANGES.append(msg)
    print("  " + msg)


def read(p):
    with open(p, "r", encoding="utf-8") as f:
        return f.read()


def write(p, s):
    with open(p, "w", encoding="utf-8") as f:
        f.write(s)


# ---------------------------------------------------------------------------
# 1. data.js
# ---------------------------------------------------------------------------

def patch_data():
    p = os.path.join(ROOT, "data.js")
    src = read(p)
    before = src

    # 1a. Currency in the generated description.
    old_desc = (
        "description += ' Address: ' + addressLine + '. ' + specs + '. Available ' "
        "+ availableFrom + '. All-in $' + allIn + '/mo. 30-day minimum.';"
    )
    new_desc = (
        "description += ' Address: ' + addressLine + '. ' + specs + '. Available ' "
        "+ availableFrom + '. All-in ' + fmt(allIn, currencyForCountry(city.country || 'US')) "
        "+ '/mo. ' + Math.max(30, minStay * 30) + '-day minimum.';"
    )
    if old_desc in src:
        src = src.replace(old_desc, new_desc)
        log("data.js — listing descriptions now render each market's own currency, not a hard-coded $")
    elif "fmt(allIn, currencyForCountry" in src:
        log("data.js — currency in descriptions already fixed, skipped")

    # 1b. FARE Act. A tenant may not be charged the broker fee where the
    #     landlord engaged the broker. NYC since 11 June 2025; the Dutch
    #     Wet goed verhuurderschap reaches the same result for Amsterdam,
    #     Rotterdam, The Hague and Utrecht.
    old_broker = (
        "broker = city.id === 'nyc' && seed % 4 === 0 ? Math.round(price * 0.12) : 0;"
    )
    new_broker = (
        "// Tenant-paid broker fees are unlawful where the landlord engaged the\n"
        "      // broker: NYC FARE Act (Local Law 119 of 2024, in force 11 June 2025)\n"
        "      // and the Dutch Wet goed verhuurderschap. Those markets are excluded\n"
        "      // here rather than filtered at render time, so no surface can leak one.\n"
        "      broker = NO_TENANT_BROKER_FEE.indexOf(city.id) === -1 && seed % 4 === 0\n"
        "        ? Math.round(price * 0.12)\n"
        "        : 0;"
    )
    if old_broker in src:
        src = src.replace(old_broker, new_broker)
        log("data.js — tenant-paid broker fee removed in FARE Act / Wet goed verhuurderschap markets")

    # Declare the market list once, next to the other module constants.
    if "NO_TENANT_BROKER_FEE" in src and "const NO_TENANT_BROKER_FEE" not in src:
        anchor = "  const IMG = (id) =>"
        decl = (
            "  /* Markets where a tenant may not be charged the broker fee when the\n"
            "     landlord engaged the broker. NYC: FARE Act, Local Law 119 of 2024,\n"
            "     in force 11 June 2025. NL: Wet goed verhuurderschap. */\n"
            "  const NO_TENANT_BROKER_FEE = ['nyc', 'amsterdam', 'rotterdam', 'the-hague', 'utrecht'];\n\n"
        )
        src = src.replace(anchor, decl + anchor, 1)
        log("data.js — added the NO_TENANT_BROKER_FEE market list")

    if src != before:
        write(p, src)
    return src != before


# ---------------------------------------------------------------------------
# 2. tools/generate-seo-pages.js — richer, truthful structured data
# ---------------------------------------------------------------------------

def patch_generator():
    p = os.path.join(ROOT, "tools", "generate-seo-pages.js")
    if not os.path.exists(p):
        log("tools/generate-seo-pages.js not found — skipped")
        return False
    src = read(p)
    before = src

    if "availabilityStarts" in src:
        log("generator — availability window already in the schema, skipped")
        return False

    old = """      offers: {
        "@type": "Offer",
        price: l.allIn,
        priceCurrency: l.currency || "USD",
        availability: "https://schema.org/InStock",
        url: canonical,
      },
    };"""

    new = """      petsAllowed: !!l.pets,
      occupancy: {
        "@type": "QuantitativeValue",
        minValue: 1,
        maxValue: Math.max(1, (l.beds || 1) + (l.roommates || 0)),
      },
      offers: {
        "@type": "Offer",
        price: l.allIn,
        priceCurrency: l.currency || "USD",
        availability: "https://schema.org/InStock",
        url: canonical,
        // The window is the whole point of a mid-term listing. Without it,
        // "available March through June" is not machine-answerable, which is
        // why assistants serve this category so badly today.
        availabilityStarts: l.availableFrom,
        availabilityEnds: xAvailabilityEnds(l),
        eligibleDuration: {
          "@type": "QuantitativeValue",
          minValue: Math.max(30, (l.minStayMonths || 1) * 30),
          maxValue: Math.max(30, (l.maxStayMonths || 12) * 30),
          unitCode: "DAY",
        },
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: l.allIn,
          priceCurrency: l.currency || "USD",
          unitCode: "MON",
          description:
            "All-in monthly rent: base rent plus every required fee. " +
            "Base rent is " + money(l.price, l.currency) + ".",
        },
      },
    };"""

    if old in src:
        src = src.replace(old, new)
        log("generator — listing JSON-LD now carries the availability window, stay duration and an all-in UnitPriceSpecification")

    helper = """
// End of the availability window. A lease-break ends when the lease ends;
// everything else runs to its maximum stay. Emitting a window is what makes
// "available March through June" answerable by a machine.
function xAvailabilityEnds(l) {
  if (l.housingType === "lease-break" && l.leaseEnd) return l.leaseEnd;
  const d = new Date(String(l.availableFrom) + "T00:00:00");
  if (isNaN(d.getTime())) return undefined;
  const day = d.getDate();
  d.setMonth(d.getMonth() + (l.maxStayMonths || 12));
  if (d.getDate() < day) d.setDate(0);
  return d.toISOString().slice(0, 10);
}
"""
    if "function xAvailabilityEnds" not in src:
        marker = "function esc(s) {"
        src = src.replace(marker, helper.strip() + "\n\n" + marker, 1)
        log("generator — added xAvailabilityEnds()")

    if src != before:
        write(p, src)
    return src != before


# ---------------------------------------------------------------------------
# 3. Link the layer into every page
# ---------------------------------------------------------------------------

CSS_MARK = "rentleaks-x.css"
JS_MARK = "rentleaks-x.js"
VER = "20260913"
# The script changes more often than the stylesheet; bump this when it does.
JS_VER = "20260918"


def base_for(rel_path):
    depth = rel_path.count(os.sep)
    return "../" * depth


def patch_pages():
    touched = 0
    skipped = 0
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [
            d for d in dirnames
            if d not in {".git", "node_modules", ".next", ".backup", ".snapshots", "web", "Claude outputs"}
        ]
        for fn in filenames:
            if not fn.endswith(".html"):
                continue
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, ROOT)
            src = read(full)
            if CSS_MARK in src and JS_MARK in src:
                skipped += 1
                continue
            base = base_for(rel)
            out = src

            if CSS_MARK not in out:
                link = '<link rel="stylesheet" href="%s%s?v=%s">' % (base, CSS_MARK, VER)
                m = re.search(r'<link rel="stylesheet" href="[^"]*styles\.css[^"]*">', out)
                if m:
                    out = out[: m.end()] + "\n  " + link + out[m.end():]
                elif "</head>" in out:
                    out = out.replace("</head>", "  " + link + "\n</head>", 1)

            if JS_MARK not in out:
                tag = '<script src="%s%s?v=%s" defer></script>' % (base, JS_MARK, JS_VER)
                m = None
                for pat in (r'<script src="[^"]*script\.js[^"]*"[^>]*></script>',):
                    m = re.search(pat, out)
                    if m:
                        break
                if m:
                    out = out[: m.end()] + "\n  " + tag + out[m.end():]
                elif "</body>" in out:
                    out = out.replace("</body>", "  " + tag + "\n</body>", 1)

            if out != src:
                write(full, out)
                touched += 1

    log("pages — linked the layer into %d files (%d already had it)" % (touched, skipped))
    return touched


# ---------------------------------------------------------------------------
# 4. Also link it from the generator, so regenerated pages keep it
# ---------------------------------------------------------------------------

def patch_generator_chrome():
    p = os.path.join(ROOT, "tools", "generate-seo-pages.js")
    if not os.path.exists(p):
        return False
    src = read(p)
    before = src

    if 'rentleaks-x.js' not in src:
        old = '  <script src="${base}script.js"></script>'
        new = ('  <script src="${base}script.js"></script>\n'
               '  <script src="${base}rentleaks-x.js?v=' + JS_VER + '" defer></script>')
        if old in src:
            src = src.replace(old, new)
            log("generator — chrome() now emits the rentleaks-x.js tag")
        old2 = '  <script src="../script.js?v=20260907-operators"></script>'
        new2 = (old2 + '\n  <script src="../rentleaks-x.js?v=' + JS_VER + '" defer></script>')
        if old2 in src:
            src = src.replace(old2, new2)
            log("generator — operator pages now emit the rentleaks-x.js tag")

    if 'rentleaks-x.css' not in src:
        src = src.replace(
            "const cssRoot = '<link rel=\"stylesheet\" href=\"styles.css\">';",
            "const cssRoot = '<link rel=\"stylesheet\" href=\"styles.css\"><link rel=\"stylesheet\" href=\"rentleaks-x.css?v=" + VER + "\">';",
        )
        src = src.replace(
            "const cssNested = '<link rel=\"stylesheet\" href=\"../styles.css\">';",
            "const cssNested = '<link rel=\"stylesheet\" href=\"../styles.css\"><link rel=\"stylesheet\" href=\"../rentleaks-x.css?v=" + VER + "\">';",
        )
        if 'rentleaks-x.css' in src:
            log("generator — cssRoot / cssNested now include rentleaks-x.css")

    if src != before:
        write(p, src)
    return src != before


# ---------------------------------------------------------------------------

def main():
    print("RentLeaks X — applying to %s" % ROOT)
    print()
    print("data model")
    patch_data()
    print()
    print("structured data")
    patch_generator()
    patch_generator_chrome()
    print()

    gen = os.path.join(ROOT, "tools", "generate-seo-pages.js")
    if os.path.exists(gen):
        print("regenerating pre-rendered pages")
        r = subprocess.run(["node", gen], cwd=ROOT, capture_output=True, text=True)
        if r.returncode != 0:
            print("  generator FAILED:")
            print(r.stdout[-4000:])
            print(r.stderr[-4000:])
            sys.exit(1)
        tail = [x for x in (r.stdout or "").strip().splitlines() if x][-6:]
        for line in tail:
            print("  " + line)
        log("regenerated the pre-rendered catalogue")
    print()

    print("linking the layer")
    patch_pages()
    print()
    print("done — %d changes" % len(CHANGES))


if __name__ == "__main__":
    main()
