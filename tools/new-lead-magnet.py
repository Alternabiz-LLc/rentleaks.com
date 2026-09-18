#!/usr/bin/env python3
"""
Scaffolds a new lead magnet: writes tools/guides/<id>.json with a working
skeleton you edit, so a new guide is a text file and one command.

    python3 tools/new-lead-magnet.py --id fee-negotiation --audience tenant \
        --title "How to negotiate a broker fee in New York"

    (edit tools/guides/fee-negotiation.json)
    python3 tools/build-guides.py

That second command renders the PDF into web/public/guides/ and rewrites the
guides catalog inside web/src/lib/network/core.ts, which is what puts it on
rentleaks.com/hire-a-broker/guide.html (after `node tools/build-broker-pages.mjs`),
into the capture API, the download page, the emails and the desk.

Audience decides who it's aimed at and which extra field the form asks for:
  tenant  → renters, asks for the city
  partner → licensed agents, asks for the brokerage
"""
import argparse
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPECS = os.path.join(ROOT, "tools", "guides")
ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{2,40}$")


def skeleton(gid, audience, title, tagline, file_name, cta):
    tenant = audience == "tenant"
    return {
        "id": gid,
        "audience": audience,
        "title": title,
        "tagline": tagline,
        "file": file_name,
        "extra": "city" if tenant else "brokerage",
        "cta": cta,
        "inside": [
            "First thing they get — the one that makes them give an email",
            "Second thing, with a number in it",
            "Third thing: a worksheet, checklist or table they'll keep",
            "Fourth thing",
            "Fifth thing",
        ],
        "subject": tagline,
        "footer": f"{title} · RentLeaks",
        "cover": {
            "kicker": "RENTLEAKS · BROKER NETWORK",
            "headline": title,
            "lede": tagline,
            "facts": [
                ["What&rsquo;s inside", "Three or four phrases, separated by ·"],
                ["Who it&rsquo;s for", "Renters in New York" if tenant else "Licensed agents and brokerages"],
                ["From", "RentLeaks — all-in prices, honest fees, 30-day-plus homes"],
            ],
        },
        "blocks": [
            {"type": "kicker", "text": "Start here"},
            {"type": "h1", "text": "The promise, restated as a sentence they'd say themselves"},
            {"type": "lede", "text": "One paragraph that earns the next page. Put the most useful fact first; don't warm up."},
            {"type": "body", "text": "Two or three sentences of context. <b>Bold</b> and <i>italic</i> work, and &rsquo; &ldquo; &rdquo; &sect; &amp; are the safe way to write ' “ ” § &."},
            {"type": "box", "title": "The one-line version", "text": "The thing to remember if they read nothing else. Tone can be brand (default), value or bad."},
            {"type": "h2", "text": "A table earns its place when the numbers do the arguing"},
            {
                "type": "table",
                "widths": [2.3, 2.3, 2.4],
                "rows": [
                    ["Column", "Column", "Column"],
                    ["Row", "Row", "Row"],
                    ["Row", "Row", "Row"],
                ],
            },
            {"type": "pagebreak"},
            {"type": "kicker", "text": "Second page"},
            {"type": "h2", "text": "What to do about it"},
            {
                "type": "steps",
                "items": [
                    ["Step one", "What they do first, in a sentence."],
                    ["Step two", "What happens next."],
                    ["Step three", "How it ends."],
                    ["Step four", "What it costs them — honestly."],
                ],
            },
            {
                "type": "bullets",
                "items": [
                    "<b>A claim.</b> Then the evidence for it.",
                    "<b>A second claim.</b> Short enough to read standing up.",
                    "<b>A third.</b>",
                ],
            },
            {
                "type": "checklist",
                "items": [
                    "Something they tick before they act.",
                    "Something a regulator would look for.",
                    "Something that protects them.",
                ],
            },
            {
                "type": "box",
                "text": (
                    "<b>rentleaks.com/hire-a-broker/</b> — the next step, named plainly."
                    if tenant
                    else "<b>rentleaks.com/hire-a-broker/agents.html</b> — the next step, named plainly."
                ),
                "title": "When you're ready",
            },
            {"type": "rule"},
            {
                "type": "small",
                "text": "General information, not legal advice; rules vary by city and state. Figures are worked examples, not offers.",
            },
        ],
    }


def main():
    ap = argparse.ArgumentParser(description="Scaffold a new lead magnet spec.")
    ap.add_argument("--id", required=True, help="kebab-case, e.g. fee-negotiation")
    ap.add_argument("--audience", required=True, choices=["tenant", "partner"])
    ap.add_argument("--title", required=True)
    ap.add_argument("--tagline", help="one line, used on the card and in the email")
    ap.add_argument("--cta", help="the form's button, e.g. 'Send me the checklist'")
    ap.add_argument("--force", action="store_true", help="overwrite an existing spec")
    a = ap.parse_args()

    if not ID_RE.match(a.id):
        sys.exit("--id should be kebab-case letters, numbers and dashes, 3-40 characters.")
    os.makedirs(SPECS, exist_ok=True)
    path = os.path.join(SPECS, f"{a.id}.json")
    if os.path.exists(path) and not a.force:
        sys.exit(f"{path} already exists — edit it, or pass --force.")

    tagline = a.tagline or ("What it is, who it's for, and why it's worth an email address.")
    cta = a.cta or ("Send me the guide" if a.audience == "tenant" else "Send me the kit")
    file_name = f"rentleaks-{a.id}.pdf"
    spec = skeleton(a.id, a.audience, a.title, tagline, file_name, cta)
    json.dump(spec, open(path, "w", encoding="utf-8"), indent=2, ensure_ascii=False)

    print(f"Wrote {os.path.relpath(path, ROOT)}")
    print("\nNext:")
    print("  1. Edit it — every block is an example, so replace the words, keep the shapes.")
    print(f"  2. python3 tools/build-guides.py {a.id}")
    print("  3. node --no-warnings tools/build-broker-pages.mjs   (puts it on the public page)")
    print("  4. Commit web/public/guides/, web/src/lib/network/core.ts and hire-a-broker/")


if __name__ == "__main__":
    main()
