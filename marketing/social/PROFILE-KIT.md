# RentLeaks social profiles — everything ready to paste

Three profiles: **LinkedIn** (company page), **Instagram** (business account),
**TikTok** (business account). Copy below is written to each platform's own
character limits and to the same rules as the site: all-in prices, honest fees,
fair housing, no stock faces.

Artwork is in `marketing/social/<platform>/`, built by
`python3 tools/build-social-art.py` — re-run it after any copy or colour change.

> **What I can't do for you:** creating the accounts needs your login, so the
> steps below are yours to click. Everything else — fields, images, posts — is
> done. Set the same handle everywhere if it's free: **@rentleaks** (fallbacks:
> `@rentleakshq`, matching the Facebook page, then `@rentleaks.official`).

---

## 1. LinkedIn — company page

Create at **linkedin.com/company/setup/new** (you need a personal LinkedIn
profile; you become the first admin).

| Field | What to paste |
| --- | --- |
| Name | `RentLeaks` |
| LinkedIn public URL | `linkedin.com/company/rentleaks` |
| Website | `https://rentleaks.com` |
| Industry | `Real Estate` (secondary, if offered: `Software Development`) |
| Company size | `2-10 employees` |
| Company type | `Privately Held` |
| Logo | `linkedin/logo-300.png` (300×300) |
| Cover | `linkedin/cover-1128x191.png` (1128×191) |
| Tagline (120 max) | `Flexible housing, priced honestly — and a broker network where renters set the fee.` (83 characters) |
| Location | `Brooklyn, New York, United States` — HQ; add `New York, NY` as the primary location |
| Founded | `2025` |
| Phone | the brokerage number on your enterprise licence strip |
| Custom button | `Learn more` → `https://rentleaks.com/hire-a-broker/?utm_source=linkedin&utm_medium=profile&utm_campaign=page-button` |

**About (2,000 max — this one is 1,448):**

```
RentLeaks is a flexible-housing marketplace and a licensed real estate brokerage. We list rooms, co-living, furnished apartments, one-month-plus stays and lease-breaks with all-in prices — what you pay is what you see — and we never deal in hotel nights: 30 days is the floor.

Two things sit alongside the listings.

Hire a broker. Renters who want someone on their side tell us what they need and the most they'll pay a broker. Up to three verified, licensed agents who work that area send a short pitch and a fee at or under that cap. The renter picks one — or none — and signs one plain-English representation and fee agreement in the app, with a time-stamped record and a copy for everyone. No lease, no fee, and nothing is owed to RentLeaks.

The referral partner program. Licensed agents and brokerages get renters who have already decided to hire someone, with the brief, the budget and the fee cap up front. No sign-up fee and no charge per lead: a broker-to-broker referral fee is invoiced to the brokerage only after a lease is signed, the way New York Real Property Law § 442 requires.

Enterprise services for building owners, corporate portfolios, developers and out-of-state landlords: licensed leasing, marketing and 3D tours, listing distribution, and property management with monthly owner statements.

Fair housing in every ad, conversation and screening standard. Licences verified with the state. Fees agreed in writing, first.
```

**Specialties** (LinkedIn allows up to 20 — these are 16):

```
flexible housing, co-living, furnished rentals, room rentals, lease takeovers, month-to-month rentals, tenant representation, rental brokerage, real estate referral network, property management, multifamily leasing, listing distribution, virtual tours, relocation, fair housing compliance, FARE Act compliance
```

**Hashtags to follow on the page** (3 max): `#rentals` `#realestate` `#proptech`

**Right after you create it**
1. Post the launch post (POSTS-LINKEDIN.md #1) before inviting anyone — an empty page loses follows.
2. Add yourself and the team under "Page admins".
3. Invite connections (LinkedIn gives credits monthly — spend them on agents and brokers first).
4. Add the page to your personal profile's Experience so your network sees it.
5. Turn on "Show page follow button" in your personal profile settings.

---

## 2. Instagram — business account

Create in the app or at **instagram.com/accounts/emailsignup**, then
Settings → Account type → **Switch to professional account** → **Business** →
category `Real Estate`.

| Field | What to paste |
| --- | --- |
| Username | `rentleaks` (fallback `rentleakshq`) |
| Name (30 max — searchable, so use words people type) | `RentLeaks · Rentals & Brokers` (29) |
| Profile photo | `instagram/profile-320.png` |
| Category | `Real Estate` |
| Contact | the brokerage email and phone; address optional |
| Website | `https://rentleaks.com/hire-a-broker/guide.html?utm_source=instagram&utm_medium=bio&utm_campaign=link-in-bio` |

**Bio (150 max — this one is 140):**

```
Flexible housing, priced honestly 🏙
Hire your own broker for a fee YOU set
Free renter's playbook + agent kit ↓
30-day+ homes · Fair housing
```

**Alternative bio, agent-leaning (121):**

```
Rentals without fee surprises
Renters: set your broker fee cap
Licensed agents: leads that already want you
Free guides ↓
```

**Highlight covers** (`instagram/highlight-*.png`): `Guides` · `How it works` · `For agents`.
Make one highlight per cover and pin the matching stories into it on day one.

**Settings worth changing**
- Professional dashboard → **Contact options**: email + phone, so the buttons appear.
- Settings → Business → **Connect a Facebook Page** (rentleakshq) so you can boost posts later and cross-post Reels.
- Because housing is a Special Ad Category on Meta, any paid promotion must be set up as **Housing** — targeting by age, gender, ZIP and many interests is blocked. Organic posts are unaffected; keep every image and caption about the home, never about who lives there.

---

## 3. TikTok — business account

Create in the app, then Settings → **Manage account** → Switch to Business
Account → category `Real Estate` (Business accounts get the website field and
analytics; Creator accounts don't).

| Field | What to paste |
| --- | --- |
| Username | `rentleaks` (fallback `rentleakshq`) |
| Name (30 max) | `RentLeaks` |
| Profile photo | `tiktok/profile-200.png` |
| Category | `Real Estate` |
| Website (Business accounts) | `https://rentleaks.com/hire-a-broker/guide.html?utm_source=tiktok&utm_medium=bio&utm_campaign=link-in-bio` |
| Email | the brokerage email |

**Bio (80 max — TikTok's is the tightest; this one is 76):**

```
Rentals, fees explained.
Free NYC broker-fee guide ↓
Licensed · fair housing
```

**Shorter alternative (61):**

```
Know what you owe a broker — and what you don't. Free guide ↓
```

**Settings worth changing**
- Turn on **Comment filters** with a word list (see the moderation list below) —
  housing comments attract fair-housing landmines fast.
- Turn off **Duet/Stitch** on explainer videos about legal rules; leave them on
  for market-fact videos.
- Use the **Business Creative Hub** for sounds cleared for commercial use. A
  trending track that isn't cleared can get a business video muted.

---

## Handles, links and how traffic shows up in the desk

Every link in the kit is tagged, and the site already reads the tags: the guide
form stores `source` and `campaign`, so downloads show `linkedin`, `instagram`
or `tiktok` on the **Broker network → Guide leads** tab, and the CRM contact
gets a `campaign:…` tag.

| Where | Link |
| --- | --- |
| LinkedIn button / posts | `https://rentleaks.com/hire-a-broker/?utm_source=linkedin&utm_medium=social&utm_campaign=<post>` |
| Instagram bio | `https://rentleaks.com/hire-a-broker/guide.html?utm_source=instagram&utm_medium=bio&utm_campaign=link-in-bio` |
| Instagram stories (link sticker) | `…/guide.html?utm_source=instagram&utm_medium=story&utm_campaign=<story>` |
| TikTok bio | `https://rentleaks.com/hire-a-broker/guide.html?utm_source=tiktok&utm_medium=bio&utm_campaign=link-in-bio` |
| Agent recruiting, any platform | `https://rentleaks.com/hire-a-broker/agents.html?utm_source=<platform>&utm_medium=social&utm_campaign=agents` |

Keep `utm_campaign` short and reusable: `launch`, `fare-act`, `fee-cap`,
`agents`, `roster`, `guide`, `lease-win`.

**When the profiles exist**, run this once so the site links to them and search
engines connect the accounts to the brand:

```
python3 tools/apply-social-links.py --linkedin rentleaks --instagram rentleaks --tiktok rentleaks
```

It updates the footer links on every page and the Organization `sameAs` in
`index.html` and `llms.txt`. Leave a platform out and it stays hidden.

---

## House rules for anything posted

1. **The home, never the people.** No "perfect for young professionals", no
   family/roommate preferences, no neighbourhood "vibe" that stands in for who
   lives there. Fair housing applies to organic posts exactly as it does to ads.
2. **Fees in writing, always.** Never imply a renter owes a fee on a
   landlord-listed home. Post-FARE Act, that's the landlord's cost.
3. **No invented results.** Use a real lease or none: "a Williamsburg one-bed at
   $3,450, fee 0.75 months" only if it happened. Illustrations are labelled.
4. **No stock faces.** Partner headshots are the real ten on the page.
5. **Licence on screen** for anything about brokerage services: the brokerage
   name and licence number, as the enterprise pages show them.
6. **Screenshots**: blur renter names, emails and phone numbers before posting.
7. **Comment moderation word list** (paste into Instagram and TikTok filters):
   `section 8, no kids, no children, adults only, males only, females only, whites, blacks, christian only, muslim only, student only, no vouchers, dm me your, cashapp, zelle, wire, deposit first`

---

## Posting rhythm that fits one person

| Day | LinkedIn | Instagram | TikTok |
| --- | --- | --- | --- |
| Mon | Post (market or rule explainer) | Story: guide link | — |
| Tue | — | Feed post (carousel) | Video |
| Wed | Post (agent recruiting) | Story: partner spotlight | — |
| Thu | — | — | Video |
| Fri | Comment on 5 industry posts | Feed post (fact card) | — |
| Sat/Sun | — | Story reshare | Video (optional) |

Three feed posts and two-to-three videos a week is enough to keep the page
alive. The content in POSTS-*.md covers the first four weeks at that rate.
