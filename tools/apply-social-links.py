#!/usr/bin/env python3
"""
Switches the site's social links on, once the profiles actually exist.

    python3 tools/apply-social-links.py --linkedin rentleaks --instagram rentleaks --tiktok rentleaks
    python3 tools/apply-social-links.py --linkedin rentleaks            (just one)
    python3 tools/apply-social-links.py --clear tiktok                  (take one down)
    python3 tools/apply-social-links.py --show                          (what's live now)

It touches three places, and nothing else:

  rentleaks-social.js  the HANDLES object — the footer link on every page
  index.html           the Organization sameAs list, so search engines tie the
                       profiles to the brand (and AI answers cite the real ones)
  llms.txt             a one-line "Profiles:" entry for the same reason

Handles only — no URLs, no @ needed. An empty handle hides that link everywhere,
so the site can never point at a profile that isn't there.
"""
import argparse
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JS = os.path.join(ROOT, "rentleaks-social.js")
INDEX = os.path.join(ROOT, "index.html")
LLMS = os.path.join(ROOT, "llms.txt")

PLATFORMS = {
    "linkedin": ("LinkedIn", "https://www.linkedin.com/company/{h}"),
    "instagram": ("Instagram", "https://www.instagram.com/{h}"),
    "tiktok": ("TikTok", "https://www.tiktok.com/@{h}"),
}
HANDLE_RE = re.compile(r"^[A-Za-z0-9._-]{2,40}$")


def facebook_url():
    """Whatever Facebook URL the site already uses — never rewritten here."""
    try:
        s = open(INDEX, encoding="utf-8").read()
        m = re.search(r'"sameAs":\[([^\]]*)\]', s)
        if m:
            for u in json.loads("[" + m.group(1) + "]"):
                if "facebook.com" in u:
                    return u
    except Exception:
        pass
    js = open(JS, encoding="utf-8").read()
    m = re.search(r'var PAGE_URL = "([^"]+)"', js)
    return m.group(1) if m else "https://www.facebook.com/rentleakshq"


def read_handles():
    s = open(JS, encoding="utf-8").read()
    m = re.search(r"var HANDLES = \{(.*?)\};", s, re.S)
    if not m:
        sys.exit("HANDLES not found in rentleaks-social.js — has the file moved on?")
    out = {}
    for key in PLATFORMS:
        km = re.search(rf'{key}:\s*"([^"]*)"', m.group(1))
        out[key] = km.group(1) if km else ""
    return out


def write_handles(handles):
    s = open(JS, encoding="utf-8").read()
    block = ", ".join(f'{k}: "{handles[k]}"' for k in PLATFORMS)
    s = re.sub(r"var HANDLES = \{.*?\};", f"var HANDLES = {{ {block} }};", s, count=1, flags=re.S)
    open(JS, "w", encoding="utf-8").write(s)


def urls(handles):
    return [PLATFORMS[k][1].format(h=handles[k]) for k in PLATFORMS if handles[k]]


def write_sameas(handles):
    """Rewrites only the sameAs array inside the Organization JSON-LD."""
    s = open(INDEX, encoding="utf-8").read()
    want = json.dumps([facebook_url()] + urls(handles), separators=(",", ":"))
    new, n = re.subn(r'"sameAs":\[[^\]]*\]', f'"sameAs":{want}', s, count=1)
    if not n:
        print("  ! no sameAs found in index.html — add it by hand:", want)
        return
    open(INDEX, "w", encoding="utf-8").write(new)


def write_llms(handles):
    s = open(LLMS, encoding="utf-8").read()
    live = [f"{PLATFORMS[k][0]}: {PLATFORMS[k][1].format(h=handles[k])}" for k in PLATFORMS if handles[k]]
    line = "Profiles: Facebook: " + facebook_url() + ("; " + "; ".join(live) if live else "") + "\n"
    if "Profiles: Facebook:" in s:
        s = re.sub(r"Profiles: Facebook:.*\n", line, s, count=1)
    else:
        s = s.rstrip("\n") + "\n\n" + line
    open(LLMS, "w", encoding="utf-8").write(s)


def main():
    ap = argparse.ArgumentParser(description="Point the site at the real social profiles.")
    for key in PLATFORMS:
        ap.add_argument(f"--{key}", help=f"{PLATFORMS[key][0]} handle (no @)")
    ap.add_argument("--clear", nargs="*", default=[], choices=list(PLATFORMS), help="remove these")
    ap.add_argument("--show", action="store_true", help="print what's live and stop")
    a = ap.parse_args()

    handles = read_handles()
    if a.show:
        for k in PLATFORMS:
            print(f"{PLATFORMS[k][0]:10} {handles[k] or '— not set —'}")
        return

    changed = False
    for key in PLATFORMS:
        v = getattr(a, key)
        if v:
            h = v.strip().lstrip("@")
            if not HANDLE_RE.match(h):
                sys.exit(f"'{v}' doesn't look like a {key} handle (letters, numbers, dot, dash, underscore).")
            handles[key], changed = h, True
    for key in a.clear:
        handles[key], changed = "", True
    if not changed:
        ap.error("Nothing to do — pass a handle, --clear, or --show.")

    write_handles(handles)
    write_sameas(handles)
    write_llms(handles)
    live = [f"{PLATFORMS[k][0]} @{handles[k]}" for k in PLATFORMS if handles[k]] or ["none"]
    print("Live profiles: " + ", ".join(live))
    print("Updated: rentleaks-social.js (footer), index.html (sameAs), llms.txt")
    print("Deploy the static site to publish: bash tools/deploy-cloudflare.sh")


if __name__ == "__main__":
    main()
