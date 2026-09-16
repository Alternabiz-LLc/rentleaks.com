#!/usr/bin/env python3
"""
Connects the static site to the RentLeaks Facebook Page, in one idempotent pass.

  python3 tools/apply-facebook.py
  python3 tools/apply-facebook.py --domain-verification abc123   # Meta Business Suite code
  python3 tools/apply-facebook.py --pixel 1234567890123456         # enables the consent-gated pixel
  python3 tools/apply-facebook.py --pixel none                     # removes the pixel tag
  python3 tools/apply-facebook.py --page-username rentleakshq      # moves every link to a new Page

The Page address is read from rentleaks-social.js, so a plain re-run keeps whatever
--page-username last set. --page-username rewrites it in the static site, the Next app
(footer + article:publisher), the mobile app's You tab and marketing/facebook/PAGE-KIT.md.

What it does to every .html page (safe to re-run):
  - links rentleaks-social.js (footer Facebook links, listing share row, pixel)
  - adds <meta property="article:publisher"> pointing at the Page (listing pages)
  - adds/updates <meta name="facebook-domain-verification"> when a code is given
  - adds/updates/removes <meta name="rl-meta-pixel"> when --pixel is given
  - adds the Page to the Organization JSON-LD "sameAs" on the home page
And patches tools/generate-seo-pages.js so regenerated pages keep the script.
"""
import argparse
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
USERNAME = "rentleaks"  # replaced in main() by the value found in rentleaks-social.js
PAGE = "https://www.facebook.com/rentleaks"
BASE_VER = "20260915"
VER = BASE_VER
SOCIAL_JS = "rentleaks-social.js"
# Files outside the static pages that carry the Page address.
LINKED_FILES = [
    SOCIAL_JS,
    "web/src/app/layout.tsx",
    "web/src/components/SiteFooter.tsx",
    "mobile/app/(tabs)/me.tsx",
    "marketing/facebook/PAGE-KIT.md",
    "rentleaks-leads.js",
    "web/src/lib/leads.ts",
]
FB_NAME = r"[A-Za-z0-9.]+"
NAME_END = r"(?![A-Za-z0-9.])"
SKIP = {".git", "node_modules", ".next", ".backup", ".snapshots", "web", "mobile", "Claude outputs", "marketing"}


def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


def write(p, s):
    with open(p, "w", encoding="utf-8") as f:
        f.write(s)


def set_meta(html, name_attr, name, content):
    """Insert or replace <meta {name_attr}="{name}" content="..."> in <head>; content None removes it."""
    pat = re.compile(r'\s*<meta %s="%s" content="[^"]*">' % (name_attr, re.escape(name)))
    html = pat.sub("", html)
    if content is None:
        return html
    tag = '<meta %s="%s" content="%s">' % (name_attr, name, content)
    m = re.search(r'<meta property="og:site_name"[^>]*>', html) or re.search(r"<meta charset[^>]*>", html)
    if m:
        return html[: m.end()] + "\n  " + tag + html[m.end():]
    return html.replace("</head>", "  " + tag + "\n</head>", 1)


def add_same_as(html):
    def fix(match):
        raw = match.group(1)
        try:
            data = json.loads(raw)
        except ValueError:
            return match.group(0)
        types = data.get("@type")
        types = types if isinstance(types, list) else [types]
        if "Organization" not in types:
            return match.group(0)
        same = data.get("sameAs") or []
        if isinstance(same, str):
            same = [same]
        if PAGE in same and not any("facebook.com/" in u and u != PAGE for u in same):
            return match.group(0)
        data["sameAs"] = [u for u in same if "facebook.com/" not in u] + [PAGE]
        return '<script type="application/ld+json">%s</script>' % json.dumps(data, ensure_ascii=False, separators=(",", ":"))

    return re.sub(r'<script type="application/ld\+json">(.*?)</script>', fix, html, flags=re.S)


def patch_page(path, rel, args):
    src = read(path)
    out = src
    base = "../" * rel.count(os.sep)

    if "rentleaks-social.js" not in out:
        tag = '<script src="%srentleaks-social.js?v=%s" defer></script>' % (base, VER)
        m = re.search(r'<script src="[^"]*rentleaks-x\.js[^"]*"[^>]*></script>', out) or re.search(
            r'<script src="[^"]*script\.js[^"]*"[^>]*></script>', out)
        if m:
            out = out[: m.end()] + "\n  " + tag + out[m.end():]
        elif "</body>" in out:
            out = out.replace("</body>", "  " + tag + "\n</body>", 1)

    else:
        out = re.sub(r'rentleaks-social\.js\?v=[^"]*"', 'rentleaks-social.js?v=%s"' % VER, out)

    if 'property="og:type" content="article"' in out:
        out = set_meta(out, "property", "article:publisher", PAGE)

    if args.domain_verification:
        out = set_meta(out, "name", "facebook-domain-verification", args.domain_verification)

    if args.pixel is not None:
        out = set_meta(out, "name", "rl-meta-pixel", None if args.pixel == "none" else args.pixel)

    if rel == "index.html":
        out = add_same_as(out)

    if out != src:
        write(path, out)
        return True
    return False


def patch_generator():
    p = os.path.join(ROOT, "tools", "generate-seo-pages.js")
    if not os.path.exists(p):
        return False
    src = read(p)
    out = src
    out = re.sub(r'rentleaks-social\.js\?v=[^"]*"', 'rentleaks-social.js?v=%s"' % VER, out)
    if "rentleaks-social.js" not in out:
        out = re.sub(
            r'(  <script src="\$\{base\}rentleaks-x\.js\?v=[^"]*" defer></script>)',
            r'\1\n  <script src="${base}rentleaks-social.js?v=' + VER + '" defer></script>',
            out,
        )
        out = re.sub(
            r'(  <script src="\.\./rentleaks-x\.js\?v=[^"]*" defer></script>)',
            r'\1\n  <script src="../rentleaks-social.js?v=' + VER + '" defer></script>',
            out,
        )
    if out != src:
        write(p, out)
        return True
    return False


def current_username():
    p = os.path.join(ROOT, SOCIAL_JS)
    m = re.search(r'PAGE_URL = "https://www\.facebook\.com/(%s)"' % FB_NAME, read(p)) if os.path.exists(p) else None
    return m.group(1) if m else "rentleaks"


def set_page(username):
    global USERNAME, PAGE, VER
    USERNAME = username
    PAGE = "https://www.facebook.com/" + username
    VER = BASE_VER if username == "rentleaks" else "%s-%s" % (BASE_VER, username.lower())


def move_links(old, new):
    """Rewrite facebook.com/<old> and m.me/<old> in the non-HTML files. Returns the files changed."""
    changed = []
    for rel in LINKED_FILES:
        p = os.path.join(ROOT, rel)
        if not os.path.exists(p):
            continue
        src = read(p)
        out = re.sub(r"(https://(?:www\.)?facebook\.com/)%s%s" % (re.escape(old), NAME_END), r"\g<1>" + new, src)
        out = re.sub(r"(https://m\.me/)%s%s" % (re.escape(old), NAME_END), r"\g<1>" + new, out)
        if out != src:
            write(p, out)
            changed.append(rel)
    return changed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--domain-verification", help="content value of Meta's facebook-domain-verification tag")
    ap.add_argument("--pixel", help="Meta Pixel ID, or 'none' to remove it")
    ap.add_argument("--page-username", help="the Page's Facebook username, e.g. rentleakshq (facebook.com/<username>)")
    args = ap.parse_args()
    if args.page_username is not None and not re.fullmatch(r"[A-Za-z0-9.]{5,50}", args.page_username):
        raise SystemExit("--page-username: use the part after facebook.com/ (5+ letters, digits or dots).")
    if args.pixel and args.pixel != "none" and not re.fullmatch(r"\d{6,20}", args.pixel):
        raise SystemExit("--pixel must be the numeric Pixel ID (or 'none').")
    if args.domain_verification and not re.fullmatch(r"[a-z0-9]{10,64}", args.domain_verification):
        raise SystemExit("--domain-verification looks wrong: paste only the content=\"...\" value.")

    old = current_username()
    set_page(args.page_username or old)
    if args.page_username and args.page_username != old:
        moved = move_links(old, args.page_username)
        print("Page: facebook.com/%s -> facebook.com/%s (%s)" % (old, args.page_username, ", ".join(moved) or "no linked files changed"))
    else:
        print("Page: facebook.com/%s" % USERNAME)

    touched = total = 0
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP]
        for fn in filenames:
            if fn.endswith(".html"):
                full = os.path.join(dirpath, fn)
                total += 1
                if patch_page(full, os.path.relpath(full, ROOT), args):
                    touched += 1
    gen = patch_generator()
    print("pages: %d of %d updated; generator %s" % (touched, total, "updated" if gen else "unchanged"))


if __name__ == "__main__":
    main()
