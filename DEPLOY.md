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

Then Worker `rentleaks-app` → **Settings → Domains & Routes → Add → Custom domain** → `app.rentleaks.com`.

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
