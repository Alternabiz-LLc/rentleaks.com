# RentLeaks — challenge and gap brief

_September 2026. Written after an end-to-end audit of both implementations: the
static catalogue at the repository root and the Next.js application in `web/`._

This is the document that should have been written first. It sets out what the
audit challenged, what was wrong, what has been built in response, and — the
part that matters most — what is still missing and what it would cost.

---

## 1. The challenge

Flexible housing is not short-let hospitality with a longer minimum, and it is
not classified advertising. It sits in the gap between them, and the gap has a
specific shape:

**The renter is committing to live somewhere.** They will sign a lease, hand
over a deposit that is often two months of income, and have no legal recourse
against the platform if any of it goes wrong. A booking site can afford to be
cheerful about a bad weekend. A housing site cannot.

**The transaction is illegal in more places than anyone admits.** A tenant-paid
broker fee that is lawful in Chicago is unlawful in New York. A 45-day let is
ordinary in Toronto and prohibited in Berlin. A furnished sublet priced 15%
over the legal rent is, in a rent-stabilised New York unit, an incurable ground
for eviction. Every competitor in this category treats jurisdiction as a
display string on a card.

**The money never touches the platform.** RentLeaks holds no deposit and no
rent. That is a deliberate position — it removes an entire regulatory surface —
but it means the platform cannot reverse anything, and therefore the only
protection it can offer is information delivered before the payment.

Three conclusions follow, and they are the spine of everything built since:

1. **The product is evidence, not inventory.** Anyone can list rooms. The
   defensible thing is being the site that tells you what the price really is,
   what the law really allows, and what has actually been checked.
2. **A claim the platform cannot substantiate is worse than no claim.** A green
   tick a renter acts on is a promise. This is the standard the whole build was
   held to, and the place it was hardest to hold.
3. **A mid-term renter arrives with two dates.** Everything else is a
   refinement.

---

## 2. What the audit found wrong

Ordered by what would have cost someone the most.

| Finding | Why it mattered | State |
|---|---|---|
| NYC listings advertised tenant-paid broker fees | The FARE Act (NYC Local Law 119 of 2024, in force 11 June 2025) bars a landlord's agent charging the tenant. The site was advertising an unlawful charge in its largest market. | Fixed |
| The first fix banned the fee outright | Wrong in the other direction: the statute binds a *landlord's agent*, not an owner letting their own home and not a departing tenant. Rebuilt as a three-value model on who is in the deal. | Fixed |
| Three surfaces claimed deposits were held and released 48h after move-in | Flatly untrue — no escrow exists. This is the single most dangerous kind of false claim a housing platform can make. | Removed |
| Prices rendered with `$` regardless of market | A €900 Berlin room shown as "$900" is not a formatting bug, it is a different price. | Fixed |
| `allInUsd` written in local currency | Every cross-market sort and budget filter silently wrong. | Fixed |
| `rules.json` keyed cities by slug, the database by id | New York resolved to bare defaults — no FARE Act, no deposit cap, no §226-b — while still rendering an authoritative-looking panel. | Fixed |
| The ownership guard in `listing-admin.ts` compiled while doing nothing | A three-branch union that did not narrow. One account could have paused or promoted another's listings. | Fixed |
| `liveListingWhere()` returned `{}` | The pause control on the seller dashboard was decoration; paused listings were served to renters. | Fixed |
| The §226-b deemed-consent clock was shown on assignments | Assignment has no deemed-consent rule. A countdown that does not exist is worse than none. | Fixed |
| Trust rows were derived from a hash of the listing id | Fine for a seeded demo catalogue, fabrication against a real database. | Rebuilt: computed or reported "not run" |
| The trust panel scored /100 over only the checks that ran | Rendered a confident **100** on a listing whose address was never verified. | Now a count |
| Affordability showed 30%-of-gross and 40× rent as two thresholds | They are the same test — 12 ÷ 0.30 = 40. The panel invented a distinction. | Fixed |
| Pre-rendered city pages emitted no `data-id` | The entire evidence layer was inert on all 79 city pages. | Fixed |
| The composer, seller dashboard and founder view had no CSS at all in the Next app | None of the `.c-` / `.s-` / `.a-` / `.v-` classes existed in `globals.css`. | Fixed |
| `/verify` was linked from two pages and did not exist | A 404 on the exact flow the product calls "the highest-return four minutes you can spend here". | Built |
| Nothing could search by date | `availableUntil` was a column, indexed, flagged in the founder view, and computed by the evidence layer — and no user could ask the question. | Built |
| Featured markets were a hand-picked constant, sliced to 8 | Every European city sits at rank 32+, so the slice cut all of them. A Berlin visitor met an all-American block on a "U.S. + Europe" product. | Fixed |
| `.rl-city-grid` had no `grid-template-columns` | Eight markets stacked vertically. | Fixed |

---

## 3. What has been built

**One rules engine, one file.** `web/src/lib/rules.json` — 33 cited
instruments, 16 cities, 16 regions, 10 countries, an FX table and 38 banned
advertising terms. Rules resolve city → region → country → defaults and every
one carries the instrument and the date it took effect, so a stale rule is
visible rather than silently wrong. The static layer reads the same file
through a build step; the merge is the only logic written twice, and a merge
function does not drift.

**A publication gate that runs server-side.** The composer's blocking checks
are re-run inside the server action, because a client gate is UX and not
enforcement. The founder view re-runs the same gate over stored rows, so a
listing written before a rule changed surfaces rather than sitting quietly
non-compliant.

**Fair-housing structure, deliberately.** No structured filter on any protected
characteristic exists anywhere in the product. *Fair Housing Council v.
Roommates.com* (9th Cir. en banc, 2008) held that a site loses CDA §230
immunity for content it requires users to produce. A dropdown is a design
decision that forfeits a statutory defence, so there is none. The lexicon guard
catches the wording instead.

**The evidence layer, on both implementations.** Price truth against live
comparables, fee-by-fee legality verdicts with citations, the trust ledger, the
takeover desk with the statutory clock, the jurisdiction panel, affordability.

**Review before publication.** Nothing reaches renters until the founder
account approves it. Decline requires a reason and the seller is shown it
verbatim.

**Identity verification that keeps nothing.** The document is checked in the
browser against a selfie and discarded; there is no upload endpoint and no
image column. The founder view shows status, never documents.

**Stay-window search.** Move-in and move-out dates, matched against
availability *and* against minimum stay — a 90-day minimum is not a match for a
45-day window however well the dates overlap.

---

## 4. What is still missing

Honest list, ordered by value. Nothing here is started.

### 4.1 Enquiry and messaging — the largest gap

`Conversation` and `Message` models exist in the schema and nothing uses them.
The listing page sends renters to `apply.html` on the static origin, so the
conversion event — the moment a renter contacts a host — leaves the
application entirely. There is no inbox, no notification, and no record on
either side.

This also blocks three things that depend on it: response-rate as a ranking
signal, the "ask before you pay" flow the trust panel keeps recommending, and
any evidence that a stay actually happened.

**Estimate:** a working inbox is two to three days. It is the next thing to
build.

### 4.2 The two trust checks that say "not run"

The ledger currently reports, truthfully, that two checks are not performed:

- **Control of the address.** Documents are collected in the verification desk;
  matching them to the listed address is not automated. Realistically this is
  a manual review step first and an integration later.
- **Photograph uniqueness.** Perceptual hashing against the corpus and against
  known stock sources. This is the highest-value one — duplicated and stock
  photographs are the commonest scam signature, and the composer already tells
  sellers so.

Until these run, the ledger scores 3 of 5 and says why. That is the correct
behaviour, but it is a smaller claim than the product wants to make.

### 4.3 Verified stay records

Reviews from people who actually lived somewhere. The static prototype has the
surface; there is no data model behind it, and there cannot be a credible one
until messaging and some evidence of a completed tenancy exist. Sequenced after
4.1.

### 4.4 The renter passport

A portable, renter-held pack — identity, income band, references — offered to
hosts rather than re-submitted per listing. Designed on the static site, not
modelled. It is the strongest differentiator in the list and the most work,
because it touches income data and therefore a much heavier privacy surface.

### 4.5 Saved listings are per-browser

`localStorage` only. They do not survive a device change and Claude cannot act
on them. Small piece of work, real annoyance.

### 4.6 Sponsored placement is not scoped in the Next app browse

The static layer scopes promotion to the listing's own market. `BrowseWorkspace`
pins by `featured` regardless of the city being searched, so a sponsored New
York listing can surface in a Berlin search. Half a day.

### 4.7 Image quality analysis is not ported

The static verification tool measures blur (Laplacian variance), glare, darkness
and framing, and tells the seller which photograph is the weak one. The React
composer gives written guidance only. This pairs naturally with 4.2.

### 4.8 No test suite in `web/`

The static site has a 48-combination headless regression pass. The Next
application has none: `tsc` and `eslint` are the entire safety net, and every
visual check so far has been manual. Before the next substantial change, the
rules engine and the publication gate should have unit tests — they are pure
functions and the highest-consequence code in the repository.

---

## 5. Verification status, stated plainly

| Check | State |
|---|---|
| TypeScript | Clean |
| ESLint | Clean (8 pre-existing `next/image` warnings) |
| Static site regression, 48 page × viewport × theme | Clean |
| Rules resolution across 6 markets | Verified against expected values |
| Next.js production build | **Never run.** No SWC binary available in the audit sandbox. |
| Rendered visual check of the Next app | **Never run.** No network path to the dev server. |
| Prisma client generation | **Blocked in sandbox.** Runs on the developer machine. |

The last three are real. Everything visual in `web/` has been verified by the
developer, not by the audit, and any statement here about how a page *looks*
should be read with that in mind.

---

## 6. Recommended order

1. Unit tests for the rules engine and the publication gate — before anything
   else changes them.
2. Messaging and the enquiry flow (4.1).
3. Perceptual-hash photograph checking (4.2), which retires the largest of the
   "not run" rows.
4. Sponsored scoping in the Next browse (4.6) — small, and currently a
   correctness bug rather than a missing feature.
5. Verified stay records (4.3), once 4.1 gives them something to attach to.

---

## 7. Addendum — mobile app (15 September 2026)

The native app and its API are specified and built in `MOBILE-APP.md`. Against
the list in §4:

- **4.1 Enquiry and messaging** — built at the API level (`/api/v1/conversations`)
  and in the app, with read receipts, push, report/block and a scam guard on
  every message. The web listing page still sends renters to `apply.html`;
  wiring the web to the same endpoints is the remaining step.
- **4.5 Saved listings** — server-side (`SavedListing`, `SavedSearch` with
  alerts). The web still uses `localStorage`.
- **4.6 Sponsored scoping** — correct in `/api/v1/listings`; `BrowseWorkspace`
  unchanged.
- **4.8 Tests** — `web/tests/v1.test.ts` covers the rules engine, the
  publication gate, the scam guard, search parsing and address privacy
  (`npm test`).

Two defects found and fixed on the way: `GET /api/listings` served unreviewed
and paused rows, and the web composer wrote `allInUsd` in local currency.

### 15 September, afternoon — first run on a simulator

The app ran on an iPhone 17 Pro simulator against the live database, and the
API was driven end to end by a smoke script. Three defects surfaced that the
type-checker and unit tests could not have caught, all fixed with tests:

- The unit number leaked through "street only" address privacy on every
  seeded listing, on the app and on the web listing page.
- A thread only ever returned its newest message (`int(null)` parsed as 1).
- The "I'm abroad, I'll mail the keys" and "wire the deposit" scam scripts
  slipped past the guard when phrased the way people phrase them.

Built on top: editing a listing from the phone, renter → host in one tap,
on-device geocoding so new listings sit on the right street, a search sheet
with length-of-stay chips, a photo viewer, read receipts, archive, offline
handling, and in-context notification permission. Details in `MOBILE-APP.md` §6.
