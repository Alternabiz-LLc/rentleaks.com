# Deploying RentLeaks

Two separate things are hosted:

| What | Where | Address |
|---|---|---|
| Public website (static HTML in the repo root) | GitHub Pages, deployed by `.github/workflows/pages.yml` on every push to `main` | https://rentleaks.com |
| App + API + database (`web/`) | Vercel (app), Neon (Postgres), Cloudflare R2 (uploads), Upstash (rate limits) | https://app.rentleaks.com |

The Pages workflow publishes only the website. `web/`, `mobile/`, `tools/`,
`marketing/`, `outreach/`, `Claude outputs/`, Markdown notes and zips stay in
the repo but are never served; the workflow fails if any of them slips in.

Domain, DNS and email forwarding stay at Namecheap.

---

## 1. Database — Neon

1. Create a project at neon.com (region: AWS US East, close to Vercel's default).
2. Open **Connect** and copy two connection strings for the `neondb` database:
   - **Pooled** (host contains `-pooler`) → `DATABASE_URL`
   - **Direct** (no `-pooler`) → `DIRECT_URL`

   Both need `?sslmode=require`. Add `&pgbouncer=true&connection_limit=1` to the pooled one.
3. Nothing to run by hand: the Vercel build applies migrations
   (`prisma migrate deploy`) using `DIRECT_URL`.

The free plan (0.5 GB) is enough to launch. Move to the Launch plan when
storage or compute gets close to the limit.

## 2. Uploads — Cloudflare R2

1. Cloudflare dashboard → **R2** → **Create bucket** `rentleaks-media`.
2. Bucket → **Settings → Custom Domains** → connect `media.rentleaks.com`.
   (Cloudflare shows a CNAME to add; add it at Namecheap → Advanced DNS.)
   Until then the bucket's `r2.dev` public URL works for testing.
3. R2 → **Manage API tokens** → create a token with **Object Read & Write** on that bucket.
4. Values:
   - `S3_ENDPOINT` = `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
   - `S3_REGION` = `auto`
   - `S3_BUCKET` = `rentleaks-media`
   - `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` = from the token
   - `S3_PUBLIC_URL` = `https://media.rentleaks.com`

Without these, uploads on Vercel answer "Uploads aren't set up on this server
yet" instead of silently losing files (Vercel has no persistent disk).
Locally, uploads keep going to `web/public/uploads`.

## 3. Rate limits — Upstash Redis

1. console.upstash.com → **Create database** (Regional, same region as Neon).
2. Copy **REST URL** → `UPSTASH_REDIS_REST_URL` and **REST token** → `UPSTASH_REDIS_REST_TOKEN`.

Without them each server instance counts on its own. If Upstash is down,
requests are allowed and the error is logged.

## 4. App — Vercel

1. vercel.com → **Add New → Project** → import `Alternabiz-LLc/rentleaks.com`.
2. **Root Directory**: `web`. Framework: Next.js (detected). Leave the build
   command empty: `package.json` has `vercel-build`
   (`prisma generate && prisma migrate deploy && next build`).
3. **Environment Variables** (Production), from `web/.env.example`:

   | Name | Value |
   |---|---|
   | `DATABASE_URL`, `DIRECT_URL` | from Neon |
   | `APP_URL`, `NEXT_PUBLIC_APP_URL` | `https://app.rentleaks.com` |
   | `CATALOG_ORIGIN`, `NEXT_PUBLIC_CATALOG_ORIGIN` | `https://rentleaks.com` |
   | `CRON_SECRET` | a long random string (`openssl rand -hex 32`) |
   | `S3_*` | from R2 |
   | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | from Upstash |
   | `RESEND_API_KEY`, `MAIL_FROM` | from Resend (password-reset email) |
   | `STRIPE_*` | when payments go live |
   | `APPLE_TEAM_ID`, `IOS_BUNDLE_ID`, `ANDROID_CERT_SHA256`, `ANDROID_PACKAGE` | app links |
   | `FACEBOOK_DOMAIN_VERIFICATION`, `META_FEED_KEY` | Meta, optional |

4. **Deploy.** Plan: Pro ($20/month) — Hobby is non-commercial only.
5. **Settings → Domains** → add `app.rentleaks.com`. At Namecheap → Advanced DNS
   add the record Vercel shows (a CNAME `app` → `cname.vercel-dns.com`, or
   whatever value Vercel displays).
6. **Cron**: `web/vercel.json` calls `/api/v1/cron/alerts` hourly; Vercel sends
   `Authorization: Bearer $CRON_SECRET` automatically.

## 5. After the first deploy

1. Create your admin account against the hosted database (from your Mac):

   ```sh
   cd ~/Apps/rentleaks.com/web
   DATABASE_URL="<Neon direct URL>" DIRECT_URL="<Neon direct URL>" npm run founder
   ```

2. Check: `https://app.rentleaks.com/api/v1/meta` answers JSON; sign in at
   `https://app.rentleaks.com/login`; upload a photo and confirm its URL starts
   with `https://media.rentleaks.com/`.
3. Mobile: production builds already use `EXPO_PUBLIC_API_URL=https://app.rentleaks.com`
   (`mobile/eas.json`). Build with `eas build --profile production`.
4. Resend: verify `rentleaks.com` (it gives DNS records to add at Namecheap).
5. Meta catalog feed: `https://app.rentleaks.com/feeds/meta-home-listings.csv?key=<META_FEED_KEY>`.

## Local development is unchanged

```sh
npm run db:up        # Postgres in Docker on :5434
cd web && npm run dev
```

`web/.env` needs `DIRECT_URL` equal to `DATABASE_URL` (already added).
