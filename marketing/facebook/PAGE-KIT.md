# RentLeaks on Facebook — Page kit

_Page: <https://www.facebook.com/rentleakshq> · September 2026_

This is what goes on the Page, field by field, and what was built on the
website so the two work together.

---

## 1. What the Page shows today (checked 15 Sep 2026)

| Field | Current value | Problem |
|---|---|---|
| Name | RentLeaks | — |
| Followers | 0 | — |
| Intro | "Rentleaks has the finest, most accurate selection of rentals and sales in NYC…" | Old positioning: NYC sales. RentLeaks is now flexible rentals across the U.S. and Europe, and does not list sales. |
| Category | Real Estate Service | Fine; can add more (below) |
| Address | 347 Fifth Avenue St 1408, New York, NY 10016 | Keep only if RentLeaks actually operates there |
| Phone | (718) 406-7956 | — |
| Email | ydikoume@doo-realty-nyc.com | A Doo Realty address on the RentLeaks Page reads as a different company |
| Website | http://rentleaks.com/ | **rentleaks.com does not load.** The domain is not pointed at the new site (see §4). |
| Latest post | 19 Nov 2022, Homesnap Pro+ / realtyleaks.com / Corcoran | Off-brand, and it names a former employer. Hide or delete it. |

---

## Plan: a new Page from Yves Dikoume's profile

Decided 15 Sep 2026: rather than recover the old Page, create a new RentLeaks
Page from Yves Dikoume's personal Facebook account. A business can't run as a
personal profile, so the profile only owns the Page; RentLeaks posts go on the
Page, not on the profile.

1. Sign in to Facebook as Yves Dikoume (in the Claude app's browser if Claude is
   doing the setup — you type the password, never Claude).
2. Create the Page: Menu → Pages → Create new Page (facebook.com/pages/create).
   Name **RentLeaks**, category **Real Estate Service**, bio from section 2.
3. Add the details from section 2: contact, website, action button
   **Send message**, the profile picture and cover in this folder.
4. Pick the Page username in its settings. `rentleaks` is most likely still held
   by the old Page, so choose something like `rentleakshq` or `rentleaks.homes`.
5. Move every website and app link to the new Page in one step:

   ```sh
   python3 tools/apply-facebook.py --page-username <new-username>
   ```

   That rewrites the static site (footer links, share row, Messenger link,
   `article:publisher`, the home page's `sameAs`, and the script's cache
   version), the Next app footer and metadata, the mobile app's You tab, and
   the address at the top of this file. Then commit, push and rebuild the
   mobile app.
6. Publish the first posts from section 3 and pin "What RentLeaks is".
7. The old Page: if admin access comes back, Facebook can merge two Pages you
   manage that represent the same business (followers move to the one you
   keep). If it never does, use Facebook's Help Center request for a Page you
   no longer manage, so there aren't two RentLeaks Pages.

### On the profile (facebook.com/yves.dikoume)

The profile points people to the Page; the listings, posts and Messenger
inbox stay on the Page.

- **Intro bio** (97 of 101 characters):
  > Founder of RentLeaks — flexible homes, every fee up front. Broker & property manager in Brooklyn.
- **Work**: add *Founder at RentLeaks* and choose the new RentLeaks Page from
  the suggestions, so the entry links to it (the Page has to exist first).
- **Links**: rentleaks.com once the DNS fix in section 4 is live.
- **Featured**: pin the announcement below.
- **Announcement** (post as Public, then share it to the Page):
  > I've launched RentLeaks, a marketplace for the months in between: rooms,
  > co-living, furnished apartments, 1-month+ stays and lease takeovers. You put
  > in your move-in and move-out dates and see only homes that fit, with every
  > fee shown up front. RentLeaks never takes deposits or rent.
  > Follow the Page for new listings: facebook.com/<page-username>

Sections 2–6 below apply to the new Page unchanged; section 1 describes the old one.

### Status (15 Sep 2026)

- New Page created from Yves Dikoume's profile: https://www.facebook.com/profile.php?id=61594270177079
  (category Real Estate Service; bio, website, hello@rentleaks.com, "Send message" button,
  RL profile picture, cover; the four posts in section 3 published, "What RentLeaks is" pinned).
- Username set: https://www.facebook.com/rentleakshq (Messenger: https://m.me/rentleakshq).
  All site/app links were switched with `python3 tools/apply-facebook.py --page-username rentleakshq`.
- Profile: bio and "Founder at RentLeaks" added.

## 2. What to put on the Page

**Profile picture** — `rentleaks-facebook-profile.png` (720 × 720). It is the site's original RL logo mark — the same one in the site header and the app icon — and it sits inside Facebook's circle crop.

**Cover photo** — `rentleaks-facebook-cover.png` (1640 × 924), led by the full RentLeaks logo (RL mark + wordmark, as in the site footer). All the text sits in the middle band, so it survives both the desktop crop (top and bottom) and the mobile crop (sides).

**Bio / Intro** (93 of 101 characters):

> Rooms, co-living, furnished & 1-month+ homes. Every fee up front. We never take your deposit.

**Categories** (pick up to three, in this order, from what Facebook offers):
Real Estate Service · Apartment & Condo Building · Property Management Company

**Website** — `https://rentleaks.com` once §4 is done. Until then: `https://alternabiz-llc.github.io/rentleaks.com/`

**Email** — a RentLeaks address (for example hello@rentleaks.com, once mail is set up on the domain), not the Doo Realty one.

**Action button** — **Send message** for now: the Page is how renters and hosts
reach a person, and Messenger lands in the Business Suite inbox.
Switch to **Use app** when the iOS app is in the App Store.

**About → Additional info** (long description):

> RentLeaks is a marketplace for flexible homes: private rooms, co-living,
> furnished apartments, stays of a month or more, and lease takeovers — in
> U.S. and Canadian cities and major markets across Europe.
>
> Every listing shows the all-in monthly price, checks each fee against local
> law (like New York's FARE Act), and says plainly which trust checks have and
> have not been run. A person reviews every listing before it goes live.
>
> RentLeaks never takes deposits, rent or application fees. If anyone asks you
> to pay RentLeaks, it is a scam — report it to us.
>
> Equal housing opportunity. Operated by Alternabiz LLC.

**Hours** — "No hours available" rather than "Always open", unless someone
really answers messages around the clock (Facebook shows response times).

**Messenger automated replies** (Business Suite → Inbox → Automations):

- *Instant reply*: "Thanks for writing to RentLeaks. We reply within one business day. Looking for a home? Search by your move-in and move-out dates at rentleaks.com. We never ask for payment over Messenger."
- *FAQs*: "How do I list my place?" → list page · "Is RentLeaks a broker?" → "No — a listing platform. We don't charge renters." · "Someone asked me to pay a deposit before a viewing" → "Don't pay. Report the listing on RentLeaks."

---

## 3. First posts

Post these in order, a few days apart. Pin the first one. Every post links with
UTM tags so the traffic shows up separately in analytics.

**Pinned — What RentLeaks is**
> Two dates. Every fee up front.
> RentLeaks is for the months in between: rooms, co-living, furnished apartments, 1-month+ stays and lease takeovers. Put in your move-in and move-out dates, and see only homes that fit — with the all-in price, not the teaser.
> https://rentleaks.com/?utm_source=facebook&utm_medium=organic&utm_campaign=launch

**Safety — the four steps**
> The four steps that stop almost every rental scam:
> 1. See it first — in person or on a live video call.
> 2. Read the lease before any money moves.
> 3. Pay traceably, to a named account. Never wire, gift cards or crypto.
> 4. Photograph the condition on move-in day.
> RentLeaks never takes deposits or rent. Anyone asking you to pay us is running a scam.

**Hosts — list a room**
> Renting out a room, leaving your lease early, or managing furnished units? Listing on RentLeaks takes about ten minutes. We check the fees against your city's rules before it goes live, so renters trust what they see.
> https://rentleaks.com/list.html?utm_source=facebook&utm_medium=organic&utm_campaign=hosts

**New York — the FARE Act**
> New York renters: since June 11, 2025, a broker hired by the landlord can't charge you the broker fee (Local Law 119 of 2024). Every New York listing on RentLeaks shows who is in the deal and flags a fee that shouldn't be there.

Wording rule for every post and ad: describe the home, never the person you want in it. No "ideal for young professionals", "no kids", "Christian household" and so on — Fair Housing applies to posts too.

---

## 4. Fix the website link first — point rentleaks.com at the new site

The new site is live at `https://alternabiz-llc.github.io/rentleaks.com/`, but
`rentleaks.com` does not resolve. Until it does, the Page's website link is dead.

1. At the domain registrar, set DNS for **rentleaks.com**:
   - `A` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `AAAA` → `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`
   - `CNAME` **www** → `alternabiz-llc.github.io`
   - Remove any old A records left over from the WordPress host.
2. GitHub → Alternabiz-LLc/rentleaks.com → Settings → Pages → Custom domain: `rentleaks.com` → Save. When the check passes, tick **Enforce HTTPS**.
   (The site deploys with a custom Actions workflow, so no `CNAME` file is needed in the repo.)
3. Wait for DNS (minutes to a few hours), then open https://rentleaks.com.

---

## 5. Meta Business Suite (domain, pixel, catalog)

**Domain verification** — Business Suite → Settings → Brand safety → Domains → Add `rentleaks.com` → Meta-tag method. Copy only the `content="…"` value, then:

```
python3 tools/apply-facebook.py --domain-verification <code>
```

and set `FACEBOOK_DOMAIN_VERIFICATION=<code>` for the Next app. Commit, push, then press Verify.

**Meta Pixel** (optional) — Events Manager → Connect data → Web → Pixel. Then:

```
python3 tools/apply-facebook.py --pixel <pixel id>
```

The site then asks each visitor before loading it, respects Global Privacy
Control, and sends only page views, listing views (the listing ID, so it
matches the catalog) and contact clicks. Remove it with `--pixel none`.
Housing is a Special Ad Category on Meta: ads can't target by age, gender or
ZIP code, lookalike audiences aren't available, and location targeting has a
15-mile minimum radius.

**Home-listing catalog** — Commerce Manager → Create catalog → *Home listings*
→ Data sources → Data feed → scheduled → URL:

```
https://<app host>/feeds/meta-home-listings.csv?key=<META_FEED_KEY>
```

The feed contains only approved, live listings from real accounts — never the
seeded sample catalogue — and respects each lister's address-privacy setting.
Listings without a postal code in their address are skipped and counted in
the `X-RentLeaks-Skipped` response header. It needs the Next app deployed on
a public host first.

---

## 6. What was built on the website

- **Every static page** (860 of them) links `rentleaks-social.js`:
  - "Follow on Facebook" and "Message us" in the footer;
  - a share row under each listing title — Facebook share dialog, Messenger on phones, Copy link — with UTM tags;
  - the consent-gated pixel described above (off until a Pixel ID is set).
- Listing pages carry `article:publisher` → the Page; the home page's
  Organization JSON-LD lists the Page in `sameAs`.
- `tools/generate-seo-pages.js` emits the script too, so regenerated pages keep it.
- **Next app**:
  - footer links to the Page and Messenger;
  - `article:publisher` meta, plus `facebook-domain-verification` from the environment;
  - the catalog feed at `/feeds/meta-home-listings.csv`.
- **Mobile app** — "RentLeaks on Facebook" in the You tab.
