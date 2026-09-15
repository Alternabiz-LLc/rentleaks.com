# RentLeaks mobile: the plan and the build

_September 2026. This brief sits next to `CHALLENGE-AND-GAPS.md` and follows the same rule: nothing here claims more than the code does._

---

## 1. The niche on a phone

RentLeaks isn't Airbnb with longer stays, and it isn't Zillow with fewer bedrooms. It's a **flexible-housing** marketplace: rooms, co-living, furnished homes, stays of a month or more, and lease takeovers. The web brief lists three things that shape the product. A phone changes how each one lands.

| What the brief says | What the phone adds |
|---|---|
| A mid-term renter arrives with **two dates**. | Dates are the first thing the renter sets on the home screen, and a saved search **pushes a notification** when a new home fits them. People who move every few months treat alerts as the product. |
| The platform **never touches the money**, so the only protection it can give is information before payment. | Scams happen **in the chat**, not on the listing page. The app puts a scam guard in every message and gives renters a camera tool that records the home's condition, which is the evidence they need to get their deposit back. |
| **Evidence, not inventory.** | The fee-legality verdicts, price-truth percentile, trust ledger and cited market rules run on the same pure functions as the web. The app has no second copy that could drift from them. |

It serves four groups, and they need different things:

- **Renters** need two-date search, the true all-in price, whether each fee is legal, a scam guard, a portable renter profile and deposit evidence.
- **Owners and landlords** need a listing flow that uses the phone camera, a review status they can see, pause and resume, and a count of enquiries.
- **Brokers and managers** need the same flow. The app records that they act for the owner, so a broker fee charged to the renter in a market like New York is blocked before it can publish. The market-rules reference and the fee checker also help them check their own paperwork.
- **Departing tenants** need the lease-takeover flow: sublet or assignment, landlord consent, and the statutory clock where one applies.
- **The founder** (you) gets the review queue and the report queue on the phone.

---

## 2. The must-haves, and what was built for each

| # | Must-have | Why it matters in this niche | In the build |
|---|---|---|---|
| 1 | **Two-date search** with minimum and maximum stay | A 90-day minimum doesn't match a 45-day stay, however well the dates overlap | Explore hero plus `GET /api/v1/listings` (`moveIn`, `moveOut`, max-stay guard) |
| 2 | **All-in price first**, in the market's own currency | Renters leave when they find a fee that wasn't in the advert | Card, detail and composer. Budget filters are typed in local currency and searched in USD |
| 3 | **Legality check on every fee**, with the source cited | The FARE Act, GOL §7-108 and RPL §238-a are what a renter can act on | Fee ledger on the listing, plus the "Is this fee legal?" tool |
| 4 | **Messaging with a scam guard** (brief §4.1) | Enquiries are where people convert and where scams happen | Inbox and threads, 7 scam signals, report and block, push notifications |
| 5 | **Saved homes and saved searches with alerts** (brief §4.5) | Saved items shouldn't be tied to one browser | Server-side `SavedListing` and `SavedSearch`, plus the alert job |
| 6 | **Trust ledger that states what wasn't checked** | A green tick is a promise | Rendered from `trustFor()`. Checks that don't run yet say so |
| 7 | **Identity verification** | Renters filter by it, and hosts get more enquiries with it | A one-time code opens `/verify` in an in-app browser. The document never reaches our servers |
| 8 | **Listing with the phone camera**, with photo tips and the publication gate | Photos are the first filter, and stock photos are the most common scam sign | 7-step composer: camera and library uploads, basic photo checks, the gate from `listing-rules.ts`, which the server runs again |
| 9 | **Human review before a listing goes live** | Stops fraudulent and non-compliant listings | Founder queue on the phone: approve, or decline with a reason the host sees |
| 10 | **Move-in condition report** | The platform holds no deposit, so evidence is the only help it can give | Photos per room with a timestamp, optional location and a SHA-256 fingerprint, exported as a PDF |
| 11 | **Renter passport** (brief §4.4, first step) | Renters shouldn't re-apply from scratch for every listing | Kept on the device in the OS keychain and shared as a text summary. Income is a band only, and no documents are stored |
| 12 | **Lease-takeover desk** | This is the differentiator, and the law here is the hardest | Sublet vs assignment, consent status, and the statutory clock only where it applies |
| 13 | **Required to pass App Store / Play review** | Otherwise the app is rejected | Account deletion inside the app (Apple 5.1.1(v)); report, block and published contact details for user-generated content (1.2); permission strings; no in-app sale of digital goods (3.1.1) |
| 14 | **Fair housing built into the structure** | *Roommates.com*: a platform can lose §230 protection for content it requires | No filter anywhere on a protected characteristic. The composer checks wording as it's typed |

---

## 3. Recommended tools

### Core stack (in the repo now)

| Layer | Choice | Why |
|---|---|---|
| App framework | **Expo SDK 57 + React Native 0.86 + Expo Router** | Same TypeScript and React as `web/`. File-based routes. One codebase for iOS and Android |
| Builds and releases | **EAS Build, EAS Submit, EAS Update** | Cloud iOS builds, store submission, and JS fixes shipped without waiting for review |
| Data layer | **TanStack Query** | Caching, infinite scroll, optimistic saves, refetch when the app returns to the foreground |
| Maps | **react-native-maps** (Apple Maps on iOS, Google Maps on Android) | Native maps, no web view |
| Images | **expo-image**, **expo-image-manipulator** | Disk cache and fast lists. Photos are resized and re-encoded before upload, which also removes GPS data from the file |
| Security | **expo-secure-store** | The session token and the passport live in the Keychain / Keystore |
| Push | **expo-notifications** + the Expo push service | One API for APNs and FCM. The server prunes dead tokens |
| Evidence | **expo-crypto, expo-print, expo-sharing, expo-location** | Photo fingerprints, PDF export, and location stamps on condition photos |

### Add before a public launch

| Need | Recommended | Notes |
|---|---|---|
| Crash and error reporting | **Sentry** (`@sentry/react-native`) | Required for a store launch. Upload source maps from EAS |
| Product analytics | **PostHog** | Funnels: search → view → enquiry → reply. Self-hostable. Don't send message text |
| Photo storage | **Cloudflare R2** or **S3** plus a CDN | Uploads currently go to `web/public/uploads`, which is for development only. Swap `lib/v1/media-store.ts` |
| Duplicate and stock photo detection (brief §4.2) | **pHash** with `sharp` + `imghash` on upload, plus a reverse-image API (**Google Cloud Vision – Web Detection**) | This is the highest-value trust check still marked "not run" |
| Identity at scale | **Stripe Identity** or **Persona** | The schema already has `provider` and `stripeSessionId` columns. Keep the rule of storing status only |
| Tenant screening, if hosts ask | **TransUnion SmartMove** or **Checkr** (renter-initiated) | Must be renter-initiated. Watch state caps on application and screening fees (NY: $20) |
| Search at scale | **Typesense** or **Meilisearch** | Postgres is fine for now. Move when text and geo search slow down |
| Email and SMS | **Resend** / **Twilio Verify** | Password-reset email (wired to Resend), phone verification, fallback when push is off |
| Scheduled alerts | **Vercel Cron** or a GitHub Actions schedule | Call `GET /api/v1/cron/alerts` with `Bearer $CRON_SECRET` hourly |
| Rate limiting across instances | **Upstash Redis** | The current limiter is in-memory, per process |
| Store listing and ASO | App Store Connect + Play Console. Screenshots from the dark and light themes | Category: *Lifestyle* or *Travel*. Lead the keywords with "furnished rentals, rooms, sublet, lease takeover" |

### Money: the one policy decision to make before launch

The app **sells nothing**. Hosting plans and sponsored placement stay on the web.

- Apple treats a paid boost as a digital service, so selling it inside the app would require Apple's in-app purchase system and its commission.
- Since the May 2025 court order, apps on the US App Store may link out to a web checkout. Outside the US the rules differ.
- Recommendation: keep payments on the web. Add a plain "Manage your plan on rentleaks.com" link on US builds only, once you choose to.

Renters never pay RentLeaks, so the in-app purchase rules never apply to them.

---

## 4. Architecture

```
rentleaks.com/
├─ web/                         Next.js — now also the mobile API
│  ├─ src/app/api/v1/…          ← NEW: bearer-auth JSON API for the app
│  ├─ src/lib/v1/…              ← NEW: http, session, search, composer, scam-guard, push, inbox, listing-view
│  ├─ prisma/migrations/20260915120000_mobile_app/   ← NEW
│  └─ tests/v1.test.ts          ← NEW: 13 tests (gate, rules, scam guard, search, address privacy)
├─ mobile/                      ← NEW: Expo app
│  ├─ app/                      routes (tabs: Explore · Saved · Inbox · Host · You)
│  ├─ src/api                   client, types, React Query hooks
│  ├─ src/shared                GENERATED copies of rules.json, listing-rules.ts, listing-evidence.ts
│  ├─ src/features              search state, composer, passport, condition reports
│  └─ src/components            design system, evidence panels, listing card
└─ tools/sync-mobile-shared.mjs ← NEW: keeps src/shared identical to web/src/lib
```

**One rules engine.** `web/src/lib/listing-rules.ts` and `rules.json` are copied into the app before every `npm start`. The composer runs the gate on the phone so no one wastes ten minutes on a form that will fail. The server runs it again, and the server's result decides.

### API surface (`/api/v1`)

| Endpoint | Purpose |
|---|---|
| `POST auth/login` · `auth/signup` · `auth/logout` | Bearer sessions in the existing `Session` table, stored as a sha256 hash. Rate-limited |
| `POST/GET auth/handoff` | One-time, 120-second code that opens a web page already signed in (identity verification) |
| `GET/PATCH/DELETE me` | Profile, badge counts, account deletion. `PATCH { role: "host" }` is the one-tap renter → host switch (never admin) |
| `GET meta` | Cities, housing types, FX rates, rules version |
| `GET listings` · `GET listings/:id` | Live listings only. The detail response includes the full evidence layer, host response stats and viewer state |
| `GET/POST saved`, `DELETE saved/:id` | Server-side saved homes |
| `GET/POST searches`, `PATCH/DELETE searches/:id` | Saved searches and alert toggles |
| `POST/DELETE devices` | Expo push tokens |
| `GET/POST conversations`, `GET/POST/PATCH conversations/:id` | Inbox, threads, read receipts, scam-guard flags, push |
| `POST reports` · `POST/DELETE blocks` | Safety |
| `GET/POST host/listings`, `GET/PUT/PATCH/DELETE host/listings/:id` | Seller dashboard and composer. `GET :id` returns the stored listing in the composer's shape; `PUT :id` re-gates an edit and sends it back to review |
| `POST uploads` | Multipart photo upload (host accounts) |
| `GET admin/queue`, `POST admin/listings/:id`, `POST admin/reports/:id` | Founder review, re-running the gate on stored rows |
| `GET cron/alerts` | Saved-search push job |

### Fixes to the existing web app made along the way

1. **`GET /api/listings` served pending, declined and paused listings** to the static site. It now applies `liveListingWhere()`.
2. **The web composer wrote `allInUsd` in the local currency** (`allInUsd: allIn`). It now converts with `toUsd()`, as the brief's "Fixed" row intended. The new mobile composer does the same.
3. **Sponsored scoping (brief §4.6)** is correct in the v1 search. Promotion only lifts a listing when the search resolves to that listing's city. `BrowseWorkspace` on the web still needs the same change.

---

## 5. Running it

```bash
# 1. Server: apply the new tables (run on your Mac — the sandbox can't reach your Postgres)
cd web
npx prisma migrate deploy && npx prisma generate
npm test                      # 13 unit tests
npm run dev                   # http://localhost:3100

# 2. App
cd ../mobile
cp .env.example .env          # set EXPO_PUBLIC_API_URL to your Mac's LAN IP, e.g. http://192.168.1.20:3100
npm install
npx expo start                # press i / a, or scan with Expo Go
```

- **On a Mac, double-click `Launch RentLeaks iOS.command`** at the repo root: it starts Postgres and the API, builds the app for the Simulator with `xcodebuild` (on Xcode 26 `expo run:ios` can mistake the Simulator for a physical device and stop for code signing), installs it, and starts Metro.
- **Push, Google Maps on Android, and a native date picker** need a development build: `npx eas-cli build --profile development`. On Android, Expo Go can't receive remote push notifications.
- Run `eas init` once, then put the project ID in `EAS_PROJECT_ID`. Without it, the app skips push registration and keeps working.
- Server environment: add `CRON_SECRET` and, optionally, `EXPO_ACCESS_TOKEN` to `web/.env`.

---

## 6. Verification, stated plainly

| Check | State |
|---|---|
| `tsc` on `web/` (including the new API and tests) | Clean |
| `tsc` on `mobile/` | Clean |
| `web` unit tests (`tsx --test`) | 17 / 17 pass |
| `mobile` unit tests (`node --test`) | 4 / 4 pass |
| Metro bundle, iOS and Android (`expo export`) | Both bundle |
| Prisma migration | **Applied** to the local Postgres (`prisma migrate status`: up to date) |
| API against the live database | **Run.** A 45-call smoke script (`signup → save → saved search → enquiry → scam-flagged message → report → block → compose → gate → owner-only visibility → delete account`) passes, plus a second script for edit and role-switch |
| The app on a device or simulator | **Run on an iPhone 17 Pro simulator (iOS 26.5), Xcode 26.6**, against the live API. Walked: Explore list and map, the search sheet, listing detail with the evidence layer, the photo viewer, sign-up, an enquiry, a host reply flagged by the scam guard, a report, renter → host switch, the host dashboard, editing a listing through the composer with on-device geocoding, dark mode, Saved → Recent |
| Android on a device | **Not run.** The bundle compiles; nothing native has been exercised |
| Push notifications | **Not run.** Needs an EAS project ID and a physical device |

### What the first run on a simulator found (15 September, afternoon)

Bugs, all fixed with a test where a pure function was involved:

1. **The unit number leaked on every listing.** `publicAddress()` only stripped `#7` at the end of the string; every stored address is `"440 Albert Cuypstraat, #7, Amsterdam, Netherlands"`, so "street only" still showed the unit. The web listing page (`app/listings/[id]/page.tsx`) printed the full address and ignored the privacy setting altogether. Both now go through the same function.
2. **Threads only ever returned the newest message.** `int(null, 50)` returned `1`, because `Number(null)` is `0`. The same helper parses `page` and `pageSize`.
3. **The scam guard missed "I'm abroad … I'll mail the keys"** when the two halves were more than 80 characters apart, and missed "wire the deposit" because it only knew "wire transfer". Both widened; "wired internet" stays clean.
4. **Fast Refresh, not a bug, but worth knowing:** editing a file resets the navigation stack in the dev client, and iOS then offers to save a half-typed password.

Things that were built because the walk showed they were missing (see §2 and §9):

- Results were below the fold on a phone. The hero now collapses into a search pill once a city or dates are set; the pill opens a where-and-when sheet with "how long" chips (1 / 3 / 6 / 12 months), which is how mid-term renters actually think.
- A full-screen, pinch-to-zoom photo viewer.
- The chat opens at the newest message (inverted list), shows "Seen" from the other side's read receipt, and can be archived.
- Hosts can edit a listing from the phone. Renters can become hosts in one tap.
- The composer geocodes the address on the device (Apple/Google geocoders, no key) and shows the area on a map before submitting; the server keeps the point only if it is within the city.
- An offline banner from the OS's connectivity, and TanStack Query paused while offline.
- The notification permission is asked for in context (saving a search, sending a first enquiry), never at launch.
- The terms toggle on sign-up was a native switch the simulator could not toggle and the label was not tappable; it is a whole-row checkbox now.

## 7. Not built yet, in order

1. **Object storage** for uploads, before any production traffic.
2. **Perceptual-hash photo check** (brief §4.2), which retires the "not run" row.
3. **Verified stay records** (brief §4.3). Messaging now exists to attach them to.
4. **Sign in with Apple / Google.** Apple requires Sign in with Apple once any third-party social login is offered, so add both together.
5. **Localisation** (FR / DE / ES / IT / NL), because half the markets are in Europe.
6. **Editing a live listing without taking it offline.** An edit goes back to review, which hides the listing until approved. Keeping the old version live while the new one waits needs a pending-edit column and a diff in the founder queue.
7. **Map clustering** once a city has more than a few hundred live pins.
8. **Sentry and PostHog** before TestFlight goes beyond you (see §3).

---

## 8. iOS release runbook

Built since the first pass:

- **Password reset**, on web and in the app. `POST /api/v1/auth/forgot` always gives the same answer, so it never reveals whether an email has an account. `POST /api/v1/auth/reset` takes a single-use, 30-minute token stored hashed in `Session`, so no migration is needed. It signs the account out everywhere and returns a fresh session. The web page is `/reset`, linked from `/login`, and the app screens are `auth/forgot` and `auth/reset`. Email goes through Resend when `RESEND_API_KEY` is set; otherwise the link is printed in the dev server terminal.
- **App-link files.**
  - The Next app serves `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` from environment variables, with the correct JSON content type.
  - `tools/write-app-links.mjs` writes the same files for the static rentleaks.com site and adds `.nojekyll` so GitHub Pages publishes `.well-known/`.
  - The app's associated domains pick up the API host automatically.

### From your Mac to TestFlight

| Step | Command / place | Notes |
|---|---|---|
| 1. Database | `cd web && npx prisma migrate deploy && npx prisma generate` | Mobile tables |
| 2. Simulator pass | Double-click `Launch RentLeaks iOS.command` | Done once on 15 September (see §6). Repeat after any native change |
| 3. Deploy the API | Vercel (or any Node host) + managed Postgres | Set `DATABASE_URL`, `APP_URL=https://app.rentleaks.com`, `CRON_SECRET`, `RESEND_API_KEY`, `APPLE_TEAM_ID` |
| 4. Photo storage | Swap `web/src/lib/v1/media-store.ts` to R2 or S3 | Local disk doesn't survive a serverless deploy |
| 5. Apple account | developer.apple.com: enroll Alternabiz LLC (needs a D-U-N-S number) | Team ID is under Membership |
| 6. Expo project | `npx eas-cli login && npx eas-cli init` | Put the project ID in `EAS_PROJECT_ID` (EAS environment variables) |
| 7. Build | `npx eas-cli build -p ios --profile production` | EAS creates the certificates and provisioning profile |
| 8. Upload | `npx eas-cli submit -p ios` | Appears in TestFlight after processing |
| 9. App links | Deploy step 3 with `APPLE_TEAM_ID`; for rentleaks.com run `APPLE_TEAM_ID=… node tools/write-app-links.mjs` and push | Check with Apple's AASA validator or `swcutil` |

### App Store Connect before review

- **Privacy nutrition label.**
  - Contact info (name, email), user content (messages, photos), identifiers (push token) and coarse location (condition-report stamps, "near me").
  - All of it is linked to the user, and none of it is used for tracking.
- **Demo account for the reviewer.** Give it a live listing, a conversation and a hosting role. The shared demo logins are gone: `npm run founder` in `web/` makes your own account the founder and moves the catalogue to it. Create a separate reviewer account for Apple.
- **Support and privacy URLs:** `rentleaks.com/contact.html` and `rentleaks.com/privacy.html`.
- **Review notes.**
  - The app sells nothing.
  - Deposits and rent are paid directly between parties.
  - Listings are moderated before publication.
  - Users can report and block, and can delete their account under You → Settings.
- **Screenshots** at 6.9" (1320 × 2868) and 6.5" (1284 × 2778). The web preview is a starting point; capture final shots from the Simulator.
- **Age rating:** 17+ is likely, because the app has unrestricted user messaging. Answer the questionnaire honestly.
