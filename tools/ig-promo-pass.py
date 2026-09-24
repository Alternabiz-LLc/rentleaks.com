#!/usr/bin/env python3
"""
Brings the Instagram feed in line with what the site now charges, and gives
the free-first-week offer a post of its own.

Three things were wrong or missing:

  Post 19 (lease-break) was built entirely on "Posting a takeover is free."
  That stopped being true when a lease-break became a listing like any other.
  It is rewritten around what IS true now — the first week is free, on any
  listing — keeping the lease-break subject, because the remaining-term and
  consent detail is the part worth posting.

  Post 12 (nyc-sublet) closed on "Lease-break posts are free on RentLeaks."
  Same problem, one sentence.

  The offer being announced on Instagram and Facebook had no post. A promo
  you are paying to advertise should have a card that states it.

Run from the repository root:

    python3 tools/ig-promo-pass.py
    python3 tools/build-ig-feed.py        # re-renders cards, queue and IG-FEED.md
"""
import collections
import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPEC = os.path.join(ROOT, "tools", "social", "ig-posts.json")

spec = json.loads(io.open(SPEC, encoding="utf-8").read(),
                  object_pairs_hook=collections.OrderedDict)
posts = spec["posts"]
by_id = {p["id"]: p for p in posts}

# ------------------------------------------------------------------ post 19
lb = by_id.get("lease-break")
if lb is None:
    sys.exit("post 'lease-break' not found")

lb["headline"] = "Your first week is free"
lb["sub"] = (
    "Then $14 a week, the same as any listing. Remaining term, assignment or "
    "sublet, and the consent the landlord's rules need — stated up front."
)
lb["alt"] = (
    "Card reading “Your first week is free” — lease-break listings "
    "showing remaining term, assignment or sublet, and the consent rules that apply"
)
lb["chips"] = [
    "First week free",
    "Remaining term shown",
    "Assignment vs sublet",
    "Consent rules per city",
]
lb["caption"] = (
    "Leaving a lease early is a bad week that doesn't need to become a bad year.\n\n"
    "Your first week on RentLeaks is free — on a lease-break or anything else. "
    "After that it's $14 a week, the same as every other listing, because a "
    "takeover takes the same slot in search and the same checks as a room does.\n\n"
    "What the listing shows: the remaining term, whether it's an assignment or a "
    "sublet, and what consent the landlord's rules actually require in that city. "
    "Those are the three things every serious replacement asks in the first "
    "message, so they are answered before anyone has to.\n\n"
    "Link in bio."
)
print("  post 'lease-break' rewritten")

# ------------------------------------------------------------------ post 12
sub = by_id.get("nyc-sublet")
if sub is None:
    sys.exit("post 'nyc-sublet' not found")
old_tail = "Lease-break posts are free on RentLeaks. Link in bio."
new_tail = "Your first week on RentLeaks is free, whatever you list. Link in bio."
if old_tail not in sub["caption"]:
    sys.exit("nyc-sublet: expected closing line not found")
sub["caption"] = sub["caption"].replace(old_tail, new_tail, 1)
print("  post 'nyc-sublet' closing line corrected")

# ------------------------------------------------------------- the new post
# Photo choice matters only in that neighbours should not repeat; the feed
# builder cycles eight interiors and this sits at the end.
if "first-week-free" not in by_id:
    posts.append(collections.OrderedDict([
        ("id", "first-week-free"),
        ("theme", "night"),
        ("photo", "studio-compact"),
        ("kicker", "Listing on RentLeaks"),
        ("headline", "Your first week is free"),
        ("sub", "Every kind of listing. Billing starts on day eight, and taking it down before then costs nothing."),
        ("alt", "Card reading “Your first week is free” — the first seven days of any RentLeaks listing cost nothing, billing starts on day eight"),
        ("chips", ["7 days free", "Any listing type", "$14 a week after", "Renters never pay"]),
        ("link", "https://rentleaks.com/list.html"),
        ("caption",
         "Seven days, on the house.\n\n"
         "Post a room, a co-living unit, a furnished flat, an aparthotel stay or a "
         "lease-break — the first week costs nothing. Billing starts on day eight, "
         "and if you take the listing down before then you pay nothing at all.\n\n"
         "After the week it's $14 a week or $60 a month, the same price whatever "
         "you're listing. Renters are never charged, for anything, ever — that "
         "hasn't changed and won't.\n\n"
         "Link in bio."),
    ]))
    print("  post 'first-week-free' added")
else:
    print("  post 'first-week-free' already present")

io.open(SPEC, "w", encoding="utf-8").write(
    json.dumps(spec, ensure_ascii=False, indent=2) + "\n")
print(f"\n{len(posts)} posts in tools/social/ig-posts.json")
print("Now run: python3 tools/build-ig-feed.py")
