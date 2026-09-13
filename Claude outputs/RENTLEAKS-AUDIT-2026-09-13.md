# RentLeaks — audit, challenge, and what shipped

**13 September 2026** · repo `~/Apps/rentleaks.com` · static root + `web/` Next.js layer

---

## 1. The challenge, in one paragraph

RentLeaks is already past the hard part. 662 listings across 79 markets in five currencies, a
real design system, a map-and-list browse with a sticky rail, pre-rendered crawlable pages for
every listing, city, type and operator, a Postgres schema with identity, conversations, leases
and Stripe payments, and a 4,200-line front end. What it did **not** have was the set of things
that separate a good-looking listings site from a marketplace people will put a deposit through.
I benchmarked twenty players in this exact niche, read the regulation that binds a listing
platform in your markets, and pulled the published demand and fraud evidence. Seven things came
back as genuinely missing, and three of them are things **nobody in the category ships** — which
is the more interesting half of the finding.

---

## 2. What the audit found

### 2.1 Defects — real, shipping, fixable

| # | Defect | Why it mattered |
|---|---|---|
| 1 | **Every NYC listing could carry a tenant-paid broker fee** — `data.js` assigned a 12% broker fee to a quarter of New York listings | The **FARE Act** (NYC Local Law 119 of 2024) has barred charging the tenant a broker fee when the landlord engaged the broker **since 11 June 2025**. This was not a styling issue; it was the site advertising an unlawful charge in its single largest market. |
| 2 | **Listing descriptions printed `$` on every listing in every currency** | A €1,800 Seville room read "All-in $1800/mo" in the description, the meta description, the RSS feed, the `llms-full.txt` index and the JSON-LD `description`. The `imageAlt` field got it right, so the page contradicted itself. |
| 3 | **No availability window in the structured data** | The pre-rendered `Offer` carried a price and `InStock` and nothing else. "Available March through June, furnished, under €2,000" was not machine-answerable — and AI crawlers largely do not execute JavaScript, so the runtime-injected schema never reached them. |
| 4 | **The browse JSON-LD hard-coded `priceCurrency: 'USD'`** for all 79 markets | Same class of error as #2, in the machine-readable layer. |
| 5 | **`verified` was one boolean doing five jobs** | Identity, address control, image provenance, account clustering and payment protection are five different claims. Collapsing them into one badge means the badge means nothing, and it is exactly what the FTC's Roomster action was about. |
| 6 | **No move-out date anywhere in the product** | `state` had `moveIn` and no counterpart. Every serious mid-term marketplace searches on a range; this one could not express the thing it exists to sell. |

All six are fixed. See §4.

### 2.2 Structural gaps — what was missing as a must-have

Ranked by evidence strength, not by build cost.

**Tier 1 — table stakes. Most money-touching competitors ship these.**

1. **Date-range search with enforced minimum stay.** Universal across mid-term players. It is the mechanic that separates mid-term from both long-term listings and short-stay.
2. **A published tiered cancellation policy with refund percentages.** Spotahome, Flatio, Blueground, Landing and Outsite all publish explicit day thresholds. Renters compare them. RentLeaks publishes none.
3. ~~**Escrow with a 48-hour post-move-in release.**~~ **Deliberately not adopted — see §7.** HousingAnywhere, Spotahome, Wunderflats and Flatio independently converged on *the same 48-hour window*, the strongest convergent standard in the category. RentLeaks takes no money at all, so this is a strategic position rather than a gap.
4. **Differentiated identity verification with a visible method.** Stripe Identity is the de facto build-vs-buy answer; HousingAnywhere names it outright.
5. **Notice-and-action reporting with a statement of reasons.** Binding on you at any size in the EU under the Digital Services Act, and the right standard everywhere.

**Tier 2 — majority ship it; absence is a competitive disadvantage.**

6. **A move-in guarantee** — property ≠ listing, reported within 24–48h, refund or relocation. Bundled into the fee, not sold separately.
7. **Digital lease generation and e-signature.** Furnished Finder does it with Rocket Lawyer state-compliant templates; Flatio with a code-based signature and translation included. Your `Lease` model has signature fields and no generator.
8. **Screening beyond ID** — credit, criminal, eviction, income. TransUnion SmartMove at \$44.99 tenant-paid is the US default.
9. **Verified-stay reviews with a host response window.**
10. **A deposit answer.** Either abolish it under a threshold (Flatio: no deposit under 180 days, backed by AXA-underwritten cover) or guarantee its return (Spotahome, 90-day claim window). RentLeaks' answer is currently the Wunderflats one — the deposit exists and the platform is not a party to it. That is a defensible position; it is not yet a *product*. See §7.

**Tier 3 — nobody ships these. This is where the disruption is.**

11. **Two-sided reviews.** Not one of the twenty has an Airbnb-style tenant↔landlord record. A good tenant carries no reputation from one stay to the next.
12. **A portable rental passport.** One verified application, reusable, with a shareable expiring link. Kopa's application is the nearest thing and it is not portable.
13. **In-product price benchmarking.** HousingAnywhere has the data — 35,000+ properties, 25 cities, quarterly — and spends it on a press release instead of putting "12% above the median for this room type in this district" next to the book button.
14. **Rent reporting to credit bureaus.** Zero coverage across all twenty. Clean white space.
15. **Deposit-alternative and guarantor integrations.** Zero coverage.
16. **Structured roommate compatibility matching.** None — including at the two companies whose entire category is roommates.
17. **Lease-break as a first-class flow inside a mid-term marketplace.** It exists only at tiny NYC-centric sites with no escrow, no guarantee and, at Leasebreak, no screening at all. None of the fourteen well-funded mid-term platforms touch it. **This is the largest unbuilt thing in the category, and RentLeaks already has the inventory type.**

### 2.3 Compliance exposure

The dangerous design pattern for a US listing platform is a *structured* filter or intake
question on a protected characteristic. *Fair Housing Council of San Fernando Valley v.
Roommates.com* (9th Cir. en banc, 2008) held that a platform supplying drop-downs and a matching
system keyed to sex or familial status becomes an information content provider and **loses
CDA § 230 immunity** for that content, while staying immune for free text it merely hosts. That
case is the architectural spec for your facets, your onboarding questionnaire and your matching
algorithm. RentLeaks is clean here today — no facet exposes a protected class — and the layer I
built keeps it that way deliberately and says so in the code.

The other binding constraints, with dates:

- **Itemised fees and a computed all-in total as the primary price** — already your positioning, now also legally mandatory in NYC (FARE Act), Minnesota, Colorado (from 1 Jan 2026), Massachusetts, Virginia and Connecticut (from 1 Jul 2026). The FTC's March 2026 rental-fee ANPRM names listing platforms directly.
- **Per-jurisdiction minimum-stay floors**: 28 days Toronto, 30 NYC / Vancouver / Italy, 31 Montreal, and a practical line nearer **90 days in Berlin**. A 30-day floor keeps you out of NYC Local Law 18 and most Canadian STR regimes. It does **not** save you in Berlin, Spain (the registry expressly covers *seasonal* rentals), Catalonia, or the Netherlands (30+ days is a full tenancy).
- **Source-of-income protection.** The violation nobody sees coming is the income-multiple filter: applying "40× annual rent" to the *full* rent rather than the tenant's share is a voucher refusal wearing a maths costume.
- **NY hard validations**: deposit ≤ 1 month, application fee ≤ \$20, and a mandatory obligation to accept an applicant-supplied consumer report dated within 30 days.
- **Fair-chance gating.** NYC Local Law 24 since 1 Jan 2025, plus Cook County, New Jersey, Portland and Seattle: criminal history only after a conditional offer, with a recorded individualised assessment.
- **EU registration numbers as first-class listing data**, with monthly reporting — Regulation (EU) 2024/1028 applies from **20 May 2026**. Spain's registry has been live since 1 Jul 2025 and covers seasonal lets.
- **Ireland and Switzerland were not assessed** in the research. Dublin, Cork, Galway, Zurich, Geneva, Basel and Bern are flagged as unverified in the engine rather than quietly guessed.

Research, not legal advice — every rule above is carried in code with its instrument and effective date so counsel can audit it in one sitting.

---

## 3. What the evidence says to build for

- **Exact-unit photos as a hard publish requirement.** Around half of renters abandon a listing with no photos of the actual unit — the most consistently replicated finding in the renter-behaviour literature. It is also the cheapest fraud control there is: a scammer who cannot reach the property cannot photograph it.
- **All-in price as the primary number and the primary sort.** 81–85% prefer a total inclusive of required fees; 46–54% abandon on discovering undisclosed ones. RentLeaks already leads with all-in — this is the one place it was ahead of the category.
- **Fraud detection on identity graphs, not image forensics.** Priority order: contact-identity clustering across listings, perceptual-hash duplicate detection, price-below-market as a *score input* never a block, and in-message classification of off-platform payment asks. That last one is the only control that still works against fully AI-generated listings, because the payment ask is the invariant the scammer cannot remove.
- **Keep payments on-platform.** Scammers pick wire, Zelle, gift cards and crypto precisely because they are irreversible, and avoid cards because chargebacks exist. Say that to users in those words.
- **Segment landing pages before head terms.** "Travel nurse housing \<city\>", "intern housing \<city\>", "lease takeover \<city\>" are near-zero-competition and extremely high intent. The published rental-SEO literature contains almost no mid-term vocabulary at all. Head terms are brutal and real estate has the lowest average paid conversion rate in cross-industry studies.
- **Prioritise remote workers and students over travel nurses.** 18.5M US digital nomads, up 153% since 2019, with growth in *salaried* employees rather than freelancers — which means better-verified income. Travel nursing fell from \$44.6B in 2022 to an estimated \$14.2B in 2025. Serve nurses; don't build the company on them.
- **Never hold lease risk.** Common (Chapter 7, June 2024), Selina, The Collective, Quarters, HubHaus, WeLive, Bedly, Starcity — all ran asset-light master leases sold as short flexible stays, and all broke when the spread inverted. A pure marketplace is structurally on the right side of that. Stay there.

---

## 4. What shipped today

Three new files, two patched, 863 pages regenerated. Nothing was rewritten — the evidence layer
observes what the existing renderer produces and augments it, so a failure inside it degrades to
the product you had this morning.

### New

| File | What it is |
|---|---|
| `rentleaks-x.js` (84 KB) | The evidence layer — jurisdiction engine, derived facts, and seven product surfaces |
| `rentleaks-x.css` (25 KB) | Design layer built on your existing Editorial Warm-Modern tokens. No base token redefined; light, dark and system all keep working |
| `tools/apply-rentleaks-x.py` | The idempotent patch + regeneration pipeline. Safe to re-run |

### Patched

- **`data.js`** — the currency bug, and `TENANT_BROKER_FEE_LAWFUL(city)`, which models a tenant-paid broker fee **only** where researched to be lawful: US markets outside New York City. Canadian and European agency-fee law was not researched, so no fee is modelled there rather than a guess being rendered as a price. Widen it only with a citation; the comment says so.
- **`tools/generate-seo-pages.js`** — listing JSON-LD now carries `availabilityStarts` / `availabilityEnds`, `eligibleDuration` in days, an all-in `UnitPriceSpecification` naming the base rent, `occupancy` and `petsAllowed`. Server-rendered, because AI crawlers do not run your JavaScript.

### The seven surfaces

1. **Stay Window** — move-in *and* move-out, persisted, wired into the browse rail, the home search and the listing price card. Every card gets a verdict: *Fits your dates*, *Free 6d later*, *Needs 12 more nights*, *Outside this window*. Enforces the per-market minimum-stay floor, not a hard-coded 30.
2. **Price Truth** — the listing's percentile against every comparable home in that city and type, drawn as a distribution strip with the interquartile band, the median tick and your listing's marker. Plus annual cost per square foot and what the fee stack adds as a percentage of base rent. Benchmarking at the decision point, which no competitor does.
3. **Trust Ledger** — the five checks that one `verified` boolean was hiding, each with its method and date, scored out of 100, with a red-flag strip driven by price-outlier, image-reuse and identity-clustering signals. Plus notice-and-action reporting that logs a reference and promises a written statement of reasons.
4. **Local Rules** — the jurisdiction engine, resolved city → region → country, validating the listing against deposit caps, application-fee caps, tenant-fee legality, minimum-stay floors, registration requirements and all-in disclosure. Every row shows the instrument and its effective date, so a stale rule is visible rather than silently wrong. Markets not covered by the research say so.
5. **Affordability** — income-ratio maths computed on the **tenant's share** after any subsidy, in every market, because that is the only version that is lawful where source of income is protected. Shows the shortfall in money, and names the guarantor as the fix.
6. **Takeover Desk** — on every lease-break: sublet versus assignment, the statutory notice packet, certified-mail service, the 10-day information window and 30-day decision window, and deemed consent under NY RPL § 226-b where silence closes the deal. The clock only appears on the sublet route, because assignment has no deemed-consent rule and showing a countdown there would be worse than showing nothing. Ends with the screening handoff and deposit transfer — the step where these deals actually die.
7. **Stay Record + Renter Passport** — verified-stay reviews with four sub-scores, a host reply, a three-day hold on sub-three-star ratings, and the tenant-side half of the ledger. Plus a portable renter passport with an expiry date and a share link, built to be the "report dated within 30 days" that New York requires landlords to accept.

Plus: a prohibited-terms lexicon on every free-text field, which explains *why* a phrase cannot be published and what lawful phrasing does the same job — "two flights of stairs, no lift" instead of "no wheelchair". And a step-free-access facet, which is the one protected-adjacent filter that *reduces* fair-housing risk rather than creating it.

### Verification

- `node --check` clean on `rentleaks-x.js`, `data.js`, `script.js`
- Generator re-ran clean: 79 cities, 662 listings, 93 operators, 853 sitemap URLs
- **30 page-viewport combinations rendered headless — 15 pages × desktop and 390px mobile — zero console errors, zero horizontal overflow, layer loaded on every one**
- Light and dark themes checked on listing detail
- Zero compliance breaches across the catalogue: no tenant broker fee in any FARE Act market, no deposit over cap, no listing under its market's minimum-stay floor
- Every HTML file in the repo links the layer; `grep -L` returns nothing

---

## 5. What I would build next, in order

1. **The condition report.** Two-sided, timestamped, geotagged photo sets at move-in and move-out, held by the platform and released to both parties. It needs no money to change hands, it is the single best defence a renter has when a deposit they paid elsewhere is withheld, and no competitor ships it. Given the no-money position, this is now the highest-value build on the list.
2. **Cancellation policy as structured data.** Three named tiers with published percentages, on the listing, in the JSON-LD, and in the comparison table. Cheapest Tier-1 gap left.
3. **Lease generation and e-signature**, keyed to the contract type the rules engine already resolves per market — *bail mobilité*, *locazione transitoria*, Catalan documented-temporary-purpose, NL short-stay, periodic assured tenancy. This is the fee-disclosure duty too: §20-699.22(b) needs a signed itemised document retained three years, and no NYC platform generates one.
4. **Make the passport real** — Stripe Identity, an income connection, a screening referral, and the FCRA decision documented: referral-out (not a consumer reporting agency) or reseller (a CRA, with the full adverse-action apparatus). Decide before you build, not after.
5. **Photo requirement at publish time**, with perceptual hashing against your own corpus. Half your fraud surface closes here.
6. **Roommate compatibility matching** — the one Tier-3 gap I did *not* build, because it is the one with genuine § 230 exposure. It needs a design where compatibility is expressed as habits and schedules the user volunteers about themselves, never as structured preferences about other people's protected characteristics. Worth doing; worth doing carefully.
7. **Segment landing pages**: travel-nurse, intern, relocation and lease-takeover pages per market, off the inventory you already have.

---

## 6. Correction — the broker-fee fix was wrong in both directions

Colonel challenged the FARE Act finding on two cases. He was right, and the correction is more interesting than the original defect.

**§ 20-699.21(a) binds a *landlord's agent*, not everyone.** I read it as "no tenant-paid broker fees in NYC" and zeroed them. That over-corrected:

- **A broker the tenant retained may still charge the tenant.** DCWP's FAQ is explicit — the law does not prohibit "tenants from choosing to hire their own broker and pay broker fees." The anti-workaround rule is narrower than a ban: a tenant-side broker may advertise, but may not condition *access to specific units or identifiable inventory* on being hired. And § 20-699.21(e) creates a **rebuttable presumption** that a broker who published a listing is the landlord's authorised agent, with the burden on the broker.
- **For rent by owner has no agent at all,** so the fee prohibition never attaches. But § 20-699.22 does: **(a)** is written against "**every listing**", and **(b)** requires a signed itemised pre-lease disclosure retained **three years** — from "the landlord **or** landlord's agent", disjunctive, so an owner carries it personally. StreetEasy's own FRBO page doesn't mention the FARE Act at all. That is a gap worth taking.

So the model is three independent facts — `listedBy`, `brokerEngagement`, and the market — not a boolean. Now built as `feeVerdict()`, resolving each charge to allowed / capped / over cap / not allowed.

**The bigger miss: RPL § 238-a, which I had only as a $20 cap.** It bars an application, processing or acceptance fee **outright**, statewide, and bars "any other payment, fee or charge before or at the beginning of the tenancy" — reaching move-in fees, admin fees and key fees. Background and credit are capped at the lesser of actual cost or **$20**, and **must be waived** if the applicant supplies their own report from the last 30 days. Waiver is void as against public policy. That last clause is precisely what the Renter Passport is for.

**And the lease-breaker answer, which is the one nobody in the category has published.** The FARE Act does not reach a departing tenant — they are not a landlord's agent. But **§ 238-a names "lessor, sub-lessor or grantor"**. A departing tenant charging the incoming one an access, key or takeover fee is caught by the same rule as a landlord, statewide, with no rent-regulation predicate. The "access fee" model Flip was built on is not available, and current NYC practitioner guidance now says the outgoing tenant charges **$0** — the market appears to have already moved, and § 238-a is the likely reason.

Three further constraints now in the product:

- **Unlicensed brokerage.** RPL §§ 440 / 440-a reach anyone paid "for another" to rent real estate. A sublandlord is a principal to their own sublease — a weak case. An **assignor is not a party to the resulting tenancy at all** and is being paid to introduce two other people, which is the classic description of brokerage. Penalties under § 442-e run to a misdemeanour, administrative fines, and liability to the payer for **up to four times** the sum received. § 442-d bars any NY court action to recover unlicensed brokerage compensation — which is why the platform must never escrow, remit or enforce a handover fee on the assignment route.
- **Regulated sublets.** RSC § 2525.6(b): the legal regulated rent **plus no more than 10%** and only where fully furnished. Overcharging is profiteering — **treble damages** to the subtenant, and per *BLF Realty Holding Corp. v. Kasher* (1st Dep't 2002) an **incurable** ground for eviction. No cure by refund; the tenancy is forfeit. The 10% is a *sublet* allowance and **does not travel to an assignment**.
- **Roommates are a different rule.** RSC § 2525.7(b) caps an occupant's rent at their **proportionate share** of the legal regulated rent, with no furnished uplift — and the roommate profiteering cases came out the other way from the sublet ones. Directly relevant to the rooms product, and it must not be collapsed into the sublet rule.

**Shipped for this:** a *The deal* panel on every listing (who listed it, whether a broker is in it, and an itemised legality verdict on every charge); an ownership-proof ladder for owner-listed homes — deed or tax record, utility or mortgage statement, ID match, and a code posted to the property; a **By owner** card chip and a **For rent by owner** browse facet; and a *What the departing tenant may charge you* block on every lease-break carrying the § 238-a bar, the screening and deposit caps, the regulated surcharge cap with its eviction consequence, and a licensing-exposure flag that reads **high** on assignments.

**Still unresolved, flagged rather than guessed:** whether the FARE Act reaches sublets and assignments at all is the largest gap in the research — DCWP has published nine FAQ questions and none mentions a sublet, and there is no case law. Whether an *assignor* is a "grantor" within § 238-a is unresolved. Whether § 440's exclusion of "lease assignments" is broad enough to cut against the brokerage analysis needs someone to read the section verbatim. And whether a marketplace that escrows an unlicensed lister's fee is itself engaging in brokerage has no NY authority either way — that one needs counsel before launch, not a rules-engine flag.

---

## 7. The no-money position, and what it costs

Colonel confirmed the model: **RentLeaks handles no renter money at all** — no escrow, no booking payment, no application fee. Deposits exist but go direct to the landlord, with the platform not a party to them. That is the Wunderflats stance on deposits combined with the SpareRoom / Leasebreak stance on payments.

**What it buys, and it is a lot.** It removes the unlicensed-brokerage exposure in §6 almost entirely: RPL § 442-d and § 442-e bite hardest at a platform that collects, remits or enforces a lister's fee, and a platform that never touches money is not doing that. It removes money-transmitter licensing, PCI scope, chargeback liability, the deposit-return dispute queue, and the entire regulatory surface that comes with holding other people's funds. For a lease-break product specifically — where the departing tenant's fee is the legally fraught part — it is the difference between a hard question and no question.

**What it costs, stated plainly.** The 48-hour post-move-in release is the strongest convergent standard in this category: four independent European platforms landed on the identical window. Not having it puts RentLeaks in the trust tier occupied by SpareRoom, Kamernet and Leasebreak rather than the one occupied by HousingAnywhere and Spotahome. The research on Kamernet is blunt about where that leads — it takes no payments, disclaims any role in them, and has a high scam surface by design. Escrow is not decoration; it removes the economic basis of the deposit scam outright, and RentLeaks now has to get that result another way.

**So the trust story had to be rebuilt rather than trimmed.** Three claims were live and false and are now gone: the Trust Ledger said the first month and deposit were held and released 48 hours after move-in; the Takeover Desk said the deposit moved into escrow; and the fee table said the same. Replaced with:

- **A fifth real check in place of the fake one.** The ledger row that claimed escrow is now *Availability re-confirmed by the host* — 14-day re-confirmation or the listing drops out of search. Stale inventory is both a top renter complaint and a fraud signal, and it is a check a platform can actually make without touching money. The score is honest again.
- **"How to pay" promoted from footnote to primary control.** Card keeps a chargeback; a bank transfer to a named account is traceable and should match the verified identity; Zelle, Venmo, Cash App, wire, gift cards and crypto are one-way. This is the control that still works against a listing generated entirely by a machine, because the payment ask is the one part of the script a scammer cannot drop.
- **A rule that is stronger for being absolute.** "RentLeaks never takes your money — anyone asking you to pay RentLeaks anything is running a scam, with no exceptions" is easier for a renter to hold in their head than any escrow policy, and it cannot be socially engineered around. The no-money position turns out to be a *better* anti-fraud message than escrow, provided the site says it everywhere and never contradicts itself.
- **Honest deposit language on every surface.** The deposit is shown, capped against the market, and labelled: paid direct, not held by RentLeaks, cannot be returned by RentLeaks. On takeovers it adds the practical advice — pay the building's owner rather than the departing tenant wherever the paperwork allows, because once they have moved out and stopped replying there is no counterparty.

**The one thing worth reconsidering.** The condition report needs no money to change hands and is now the highest-value unbuilt item: timestamped two-sided photo sets at move-in and move-out, held by the platform. When a renter's deposit is withheld by a landlord RentLeaks never touched, that evidence is the only leverage they have — and no competitor ships it. It is how a no-money platform gets most of the trust benefit of escrow without any of its liability.

---

## 8. Honest notes

- The catalogue is synthetic. The trust ledger, the reviews and the takeover consent states are derived deterministically from the listing id, exactly like the rest of the seeded data — consistent with the product as it stands, and they must be wired to real sources before anything here is presented as a factual claim about a real home.
- The jurisdiction table is research, not legal advice, and carries its sources so counsel can audit it. Ireland and Switzerland are explicitly marked unassessed rather than guessed.
- I did not model tenant-paid broker fees outside the US, because I did not research agency-fee law there. That is a deliberate absence, not an omission.
- Several claims that circulate in this category did not survive checking and are not in the product or this document: aggregate co-living market size, annual US lease-break volume, corporate-housing market size, and the "five-minute response" rule (which traces to a 2007 B2B sales study, not rental research).
