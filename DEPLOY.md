# Deploying RentLeaks

| What | Where | Address |
|---|---|---|
| Public website (static HTML in the repo root) | GitHub Pages, `.github/workflows/pages.yml` on every push to `main` | https://rentleaks.com |
| App + API (`web/`) | **Cloudflare Workers** (OpenNext) | https://app.rentleaks.com |
| Database | **Neon** Postgres, reached through **Cloudflare Hyperdrive** | — |
| Photos and videos | **Cloudflare R2** | https://media.rentleaks.com |
| Rate limits | **Upstash** Redis | — |
| Schema migrations | GitHub Actions, `.github/workflows/db-migrate.yml` | — |

The Pages workflow publishes only the website; `web/`, `mobile/`, `tools/`,
`marketing/`, `outreach/`, `Claude outputs/` and notes are never served.

Monthly cost at launch: **$5** (Workers Paid). Neon, R2 and Upstash start on
their free tiers.

---

## 0. Move rentleaks.com's DNS to Cloudflare (one time)

Workers custom domains and R2 custom domains need the domain's DNS on
Cloudflare. Namecheap stays the registrar (renewals stay there).

1. Cloudflare dashboard → **Add a domain** → `rentleaks.com` → **Free** plan.
2. Cloudflare scans the current records. Check the list contains, and add any missing:
   - `A @ 185.199.108.153`, `.109.153`, `.110.153`, `.111.153` — **DNS only** (grey cloud)
   - `CNAME www alternabiz-llc.github.io` — **DNS only**
   - the Namecheap email-forwarding records: `MX @ eforward1.registrar-servers.com`
     … `eforward5` and `TXT @ v=spf1 include:spf.efwd.registrar-servers.com ~all`
3. Namecheap → Domain List → rentleaks.com → **Nameservers → Custom DNS** →
   paste the two Cloudflare nameservers. Activation takes minutes to a few hours.
4. Check https://rentleaks.com still loads, then keep going.

## Short path: one script

After §0 (domain active on Cloudflare) and Workers Paid. At the database prompt, press Enter and the script signs in to Neon, creates the `rentleaks` project and reads its address itself:

```sh
cd ~/Apps/rentleaks.com && bash tools/deploy-cloudflare.sh
```

It logs in to Cloudflare, runs the migrations on Neon, creates Hyperdrive and
the R2 buckets, builds and deploys to `app.rentleaks.com` (the domain is in
`wrangler.jsonc` → `routes`), sets `CRON_SECRET` and optionally
`RESEND_API_KEY`, and creates your founder login. Safe to run again. §1–7 below
are the same steps by hand; §3 R2 token, §4 Upstash and §5 S3 secrets are
still needed for photo uploads and shared rate limits.

## 1. Workers plan and CLI

1. Cloudflare → **Workers & Pages** → **Plans** → **Workers Paid** ($5/month).
2. On your Mac, once: `cd ~/Apps/rentleaks.com/web && npm install && npx wrangler login`

## 2. Database — Neon + Hyperdrive

1. neon.com → new project (region **AWS US East**). **Connect** → copy the
   **direct** connection string (host without `-pooler`), with `?sslmode=require`.
2. Create the Hyperdrive pool and paste its id into `web/wrangler.jsonc`
   (`REPLACE_WITH_HYPERDRIVE_ID`):

   ```sh
   npx wrangler hyperdrive create rentleaks-db --connection-string="<Neon direct URL>"
   ```

3. GitHub → repository → **Settings → Secrets and variables → Actions** →
   new secret `DATABASE_DIRECT_URL` = the Neon direct URL. Then **Actions →
   Database migrations → Run workflow** to create the tables.

## 3. Storage — R2

```sh
npx wrangler r2 bucket create rentleaks-media        # photos and videos
npx wrangler r2 bucket create rentleaks-next-cache   # Next.js page cache
```

- `rentleaks-media` → **Settings → Custom Domains** → `media.rentleaks.com`.
- R2 → **Manage API tokens** → token with **Object Read & Write** on `rentleaks-media`.

## 4. Rate limits — Upstash

console.upstash.com → Redis database (same region) → copy the **REST URL** and **REST token**.

## 5. Secrets on the Worker

Plain settings are already in `web/wrangler.jsonc` (`vars`). Add the secrets
once each (or in the dashboard: Worker → Settings → Variables and Secrets):

```sh
cd ~/Apps/rentleaks.com/web
npx wrangler secret put CRON_SECRET              # openssl rand -hex 32
npx wrangler secret put S3_ENDPOINT              # https://<ACCOUNT_ID>.r2.cloudflarestorage.com
npx wrangler secret put S3_BUCKET                # rentleaks-media
npx wrangler secret put S3_ACCESS_KEY_ID
npx wrangler secret put S3_SECRET_ACCESS_KEY
npx wrangler secret put S3_PUBLIC_URL            # https://media.rentleaks.com
npx wrangler secret put UPSTASH_REDIS_REST_URL
npx wrangler secret put UPSTASH_REDIS_REST_TOKEN
npx wrangler secret put RESEND_API_KEY           # password-reset email
# when ready: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, APPLE_TEAM_ID,
# ANDROID_CERT_SHA256, FACEBOOK_DOMAIN_VERIFICATION, META_FEED_KEY
```

## 6. Deploy

**First deploy, from your Mac:**

```sh
cd ~/Apps/rentleaks.com/web
npm run cf:deploy
```

`app.rentleaks.com` is attached by the deploy itself (`routes` in `wrangler.jsonc`).

**Automatic deploys after that:** Worker → **Settings → Build** → connect the
GitHub repository `Alternabiz-LLc/rentleaks.com`:

| Setting | Value |
|---|---|
| Root directory | `web` |
| Build command | `npx opennextjs-cloudflare build` |
| Deploy command | `npx wrangler deploy` |
| Build variables | `NEXT_PUBLIC_APP_URL=https://app.rentleaks.com`, `NEXT_PUBLIC_CATALOG_ORIGIN=https://rentleaks.com` |

Every push to `main` then rebuilds the app; migrations run in GitHub Actions.

## 7. After the first deploy

1. Founder account on the hosted database (from your Mac):

   ```sh
   cd ~/Apps/rentleaks.com/web
   DATABASE_URL="<Neon direct URL>" DIRECT_URL="<Neon direct URL>" npm run founder
   ```

2. Checks:
   - https://app.rentleaks.com/api/v1/meta returns JSON
   - sign in at https://app.rentleaks.com/login
   - upload a photo; its address starts with `https://media.rentleaks.com/`
   - Worker → **Logs** shows the hourly `0 * * * *` cron without errors
3. Mobile: production builds already call `https://app.rentleaks.com`
   (`mobile/eas.json`): `eas build --profile production`.
4. Resend: verify `rentleaks.com` (DNS records now go in Cloudflare).
5. Meta catalog feed: `https://app.rentleaks.com/feeds/meta-home-listings.csv?key=<META_FEED_KEY>`.

## Leads from Facebook

`rentleaks.com/facebook.html` posts to `https://app.rentleaks.com/api/leads`
(CORS allows rentleaks.com; override with `API_ALLOWED_ORIGINS`). It needs the
`Lead` table (migration `20260916120000_leads`) and, for the emails,
`RESEND_API_KEY`. Leads show at `/admin#leads`. Details:
marketing/facebook/PAGE-KIT.md §7.

## Lead magnets and social profiles

The two guides are generated, not hand-made. Their content lives in
`tools/guides/*.json`:

```bash
python3 tools/build-guides.py            # render the PDFs + refresh the catalogue in core.ts
node --no-warnings tools/build-broker-pages.mjs   # put them on rentleaks.com/hire-a-broker/
```

A new magnet is one file and one command:

```bash
python3 tools/new-lead-magnet.py --id fee-negotiation --audience tenant \
    --title "How to negotiate a broker fee"
# edit tools/guides/fee-negotiation.json, then:
python3 tools/build-guides.py && node --no-warnings tools/build-broker-pages.mjs
```

The PDFs are served from the app (`web/public/guides/`), never from the
website, so the private link the capture API emails is the only way to a copy.
Downloads land on **Broker network → Guide leads** with the consent sentence,
the source and the campaign.

Social artwork and the profile kits are in `marketing/social/`:

```bash
python3 tools/build-social-art.py         # LinkedIn, Instagram and TikTok images
```

Once the profiles exist, point the site at them in one command — it sets the
footer links on every page, the Organization `sameAs` in `index.html` and the
`Profiles:` line in `llms.txt`:

```bash
python3 tools/apply-social-links.py --linkedin rentleaks --instagram rentleaks --tiktok rentleaks
python3 tools/apply-social-links.py --show     # what's live
python3 tools/apply-social-links.py --clear tiktok
```

Handles left empty stay hidden, so the site never links to a profile that
isn't there.

## Email, photos and integrations

After the first deploy, run:

```sh
cd ~/Apps/rentleaks.com && bash tools/deploy-cloudflare.sh --secrets
```

It asks, each optional (Enter skips or keeps the current value):

| Secret | What it does |
|---|---|
| `RESEND_API_KEY` | Password resets, lead alerts, newsletters and campaigns. Verify `rentleaks.com` in Resend first (its DNS records go in Cloudflare → DNS). |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` | Your own mailbox, e.g. Namecheap Private Email (`mail.privateemail.com`, 465). One-to-one CRM emails and trial invites go from it, so replies land in your inbox. Used for everything if Resend isn't set. |
| `FB_PAGE_ID` `FB_PAGE_TOKEN` | Lets Admin → Social publish scheduled posts to the Facebook Page by itself. Without it, due posts wait for you to post and tick “Mark posted”. |
| `META_FEED_KEY` | Generated for you; protects the Meta catalog feed URL. |
| `UNSUBSCRIBE_SECRET`, `CRON_SECRET` | Generated on deploy. |

Namecheap Private Email is a paid Namecheap product with its own MX records;
switching rentleaks.com's MX from email forwarding to Private Email stops the
forwarding. Resend needs no MX change (it uses a `send.` subdomain).

**Photos** are written to the `rentleaks-media` bucket through the
`MEDIA_BUCKET` binding — no access keys. Serve them by connecting the custom
domain: Cloudflare → R2 → rentleaks-media → Settings → Custom Domains →
`media.rentleaks.com`. Admin → System → “Test photo upload” checks the whole
path.

**Scheduled jobs**: `0 * * * *` saved-search alerts; `*/5 * * * *` the outbox
(campaign emails in paced batches, due Facebook posts, invite expiry). Admin →
System shows when each last ran.

## Founder admin

`https://app.rentleaks.com/admin` (founder account only):

| Section | For |
|---|---|
| Overview | Today's numbers, the review queue, market compliance. |
| Leads | The Facebook/landing-page inbox, reply times, sources. |
| Listings | Search every listing; bulk approve / decline / pause / sponsor / feature / verify; edit price, plan, host. |
| Accounts | Roles, verification, free days, sign out everywhere, suspend (signs out and pauses listings). |
| Reports & safety | Member reports; remove a listing or suspend an account; scam-guard flags. |
| CRM | Every renter, host, operator and partner with stage, tags, follow-ups, timeline, one-to-one email, CSV import/export. Leads and sign-ups are added automatically. |
| Outreach | Templates (6 starters), follow-ups due, prospect counts. |
| Email & newsletters | Newsletters (opted-in only, double opt-in via `POST /api/newsletter`), announcements and outreach waves with preview, test send, schedule, paced sending, unsubscribe and suppression. Needs the mailing address in System. |
| Social posts | Compose once for several channels, bulk-schedule (posts separated by `---`), auto-publish to the Facebook Page. |
| Paid ads | Campaigns with tracking links; leads and bookings per campaign; cost per lead. |
| Free-trial invites | Invite hosts (one or 200 at a time) to list free for N days; `/invite/<code>` creates the account and starts the trial. |
| Revenue & analytics | Payments, recurring revenue, weekly accounts / leads / listings, funnel. |
| Markets & operators | Rank, featured markets, local medians; operator pages. |
| System & settings | Health of every integration, mailing address, test email, photo-upload test, suppression, audit log. |

Every change made here is written to the audit log.

## How the app runs on Workers

- `wrangler.jsonc` — Worker config, Hyperdrive, R2 cache bucket, hourly cron, plain vars.
- `worker.ts` — OpenNext's handler plus the cron (`/api/v1/cron/alerts`).
- `src/lib/prisma.ts` — one Prisma client per request through Hyperdrive on
  Workers; the usual single client on Node. The rest of the code just imports `prisma`.
- `src/lib/storage` — uploads go to R2 over the S3 API; Workers have no disk.
- `src/lib/listing-shapes.ts`, `src/lib/plans.ts` — browser-safe pieces, so
  client components never bundle the database driver.
- `npm run cf:preview` — runs the production Worker locally against the
  Docker database (`localConnectionString` in `wrangler.jsonc`).

## Local development is unchanged

```sh
npm run db:up                  # Postgres in Docker on :5434
cd web && npm run dev          # http://localhost:3100
```

`web/.env` needs `DIRECT_URL` equal to `DATABASE_URL` (already added).

---

## Moving to Vercel later

The same code runs on Vercel unchanged (`vercel.json`, `vercel-build`).
Nothing depends on Cloudflare except `wrangler.jsonc` and `worker.ts`.
Consider it when one of these happens, not because of traffic alone
(Workers handle high traffic well and cost less):

- a Next.js feature you need isn't supported by OpenNext yet, or an
  OpenNext upgrade blocks a Next.js upgrade for more than a few weeks;
- Worker-specific bugs cost you real time (database connection errors,
  requests timing out) more than once a month;
- the team grows and wants preview deployments per pull request with
  comments, which Vercel does out of the box;
- revenue makes the price difference ($20 vs $5/month plus usage) irrelevant.

Steps: create the Vercel project with root `web`, copy the same secrets, use
Neon's **pooled** URL as `DATABASE_URL` and the direct one as `DIRECT_URL`,
move `app.rentleaks.com` to Vercel, and disable the Worker's cron (Vercel runs
it from `vercel.json`).
