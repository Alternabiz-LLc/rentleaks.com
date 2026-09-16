#!/usr/bin/env bash
# One-pass first deploy of the RentLeaks app to Cloudflare (app.rentleaks.com).
#
#   bash tools/deploy-cloudflare.sh
#
# Before running (see DEPLOY.md §0–2):
#   - rentleaks.com is added to your Cloudflare account and shows "Active";
#   - Workers Paid is on;
#   - you have Neon's DIRECT connection string (host without "-pooler").
#
# Safe to run again: every step checks what already exists.
# The database URL is read hidden and never written to disk; Cloudflare keeps
# it inside the Hyperdrive config, and it is used here only for migrations.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/web"
say()  { printf '\n\033[1m== %s\033[0m\n' "$*"; }
fail() { printf '\n\033[31mStopped: %s\033[0m\n' "$*" >&2; exit 1; }
W() { npx --yes wrangler "$@"; }

say "1/8 Packages"
[ -d node_modules/wrangler ] || npm install

say "2/8 Cloudflare login"
if ! W whoami 2>/dev/null | grep -qi "associated with the email"; then
  W login
fi
W whoami | grep -i -E "email|account" | head -5 || true

say "3/8 Database address"
DB_URL="${NEON_DIRECT_URL:-}"
if [ -z "$DB_URL" ]; then
  cat <<'TXT'
Where to find it: console.neon.tech → your project → Connect →
turn OFF "Connection pooling" → copy the string that starts with postgresql://
(no Neon project yet? create one first, region AWS US East).
TXT
fi
for try in 1 2 3; do
  [ -n "$DB_URL" ] || { printf 'Paste it here (hidden), then Enter: '; read -rs DB_URL; echo; }
  DB_URL="$(printf '%s' "$DB_URL" | tr -d '[:space:]' | sed -E "s/^psql//; s/^['\"]//; s/['\"]$//")"
  case "$DB_URL" in
    postgres://*|postgresql://*) break ;;
    "") echo "Nothing was pasted." ;;
    *) echo "That doesn't start with postgresql:// — copy the connection string itself." ;;
  esac
  DB_URL=""
done
[ -n "$DB_URL" ] || fail "no database address. Create the Neon project, then run this again."
case "$DB_URL" in *-pooler*) fail "use the DIRECT string (turn off 'Connection pooling' in Neon's Connect dialog)." ;; esac
case "$DB_URL" in *sslmode=*) ;; *\?*) DB_URL="$DB_URL&sslmode=require" ;; *) DB_URL="$DB_URL?sslmode=require" ;; esac
export DATABASE_URL="$DB_URL" DIRECT_URL="$DB_URL"

say "4/8 Tables (Prisma migrations on Neon)"
npx prisma migrate deploy

say "5/8 Hyperdrive (pooled database connection)"
if grep -q REPLACE_WITH_HYPERDRIVE_ID wrangler.jsonc; then
  HD_ID="$(W hyperdrive list 2>/dev/null | awk '/rentleaks-db/' | grep -oE '[0-9a-f]{32}' | head -1 || true)"
  if [ -z "$HD_ID" ]; then
    OUT="$(W hyperdrive create rentleaks-db --connection-string="$DB_URL" 2>&1)" || { echo "$OUT" | sed -E 's#postgres(ql)?://[^ ]+#<hidden>#g'; fail "Hyperdrive could not be created."; }
    HD_ID="$(echo "$OUT" | grep -oE '"id": *"[0-9a-f]{32}"' | grep -oE '[0-9a-f]{32}' | head -1 || true)"
    [ -n "$HD_ID" ] || HD_ID="$(echo "$OUT" | grep -iE 'created' | grep -oE '[0-9a-f]{32}' | head -1 || true)"
  fi
  [ -n "$HD_ID" ] || fail "no Hyperdrive id found."
  sed -i.bak "s/REPLACE_WITH_HYPERDRIVE_ID/$HD_ID/" wrangler.jsonc && rm -f wrangler.jsonc.bak
  echo "Hyperdrive $HD_ID written to web/wrangler.jsonc"
else
  echo "Already set in wrangler.jsonc."
fi

say "6/8 R2 buckets"
for b in rentleaks-next-cache rentleaks-media; do
  if OUT="$(W r2 bucket create "$b" 2>&1)"; then
    echo "$b created"
  elif echo "$OUT" | grep -qi "already exists"; then
    echo "$b exists"
  else
    echo "$OUT"
    fail "R2 bucket $b could not be created. Open Cloudflare → R2 once to enable it, then run this again."
  fi
done

say "7/8 Build and deploy"
NS="$(dig +short NS rentleaks.com 2>/dev/null | tr 'A-Z' 'a-z')"
if ! echo "$NS" | grep -q "ns.cloudflare.com"; then
  echo "rentleaks.com's nameservers are still: ${NS:-unknown}"
  fail "move rentleaks.com's DNS to Cloudflare first (DEPLOY.md §0), wait until the dashboard says Active, then run this again. Steps 1–6 are done and will be skipped."
fi
export NEXT_PUBLIC_APP_URL=https://app.rentleaks.com NEXT_PUBLIC_CATALOG_ORIGIN=https://rentleaks.com
unset DATABASE_URL DIRECT_URL   # the Worker uses Hyperdrive, not this string
npm run cf:deploy

SECRETS="$(W secret list 2>/dev/null || true)"
if ! echo "$SECRETS" | grep -q CRON_SECRET; then
  openssl rand -hex 32 | W secret put CRON_SECRET
fi
if ! echo "$SECRETS" | grep -q RESEND_API_KEY; then
  printf '\nResend API key for lead emails (hidden; Enter to skip for now): '
  read -rs RESEND; echo
  [ -n "$RESEND" ] && printf '%s' "$RESEND" | W secret put RESEND_API_KEY
  unset RESEND
fi

say "8/8 Founder account on the live database"
if [ -n "$(command -v gh)" ] && gh auth status >/dev/null 2>&1; then
  printf '%s' "$DB_URL" | gh secret set DATABASE_DIRECT_URL --repo Alternabiz-LLc/rentleaks.com && echo "GitHub secret DATABASE_DIRECT_URL set (future migrations run on push)."
else
  echo "Add the GitHub secret DATABASE_DIRECT_URL by hand (DEPLOY.md §2.3) so future migrations run on push."
fi
read -rp "Create or update your founder login now? [Y/n] " yn
if [ "${yn:-Y}" != "n" ] && [ "${yn:-Y}" != "N" ]; then
  DATABASE_URL="$DB_URL" DIRECT_URL="$DB_URL" npm run founder
fi
unset DB_URL

say "Checking https://app.rentleaks.com"
sleep 5
curl -fsS https://app.rentleaks.com/api/v1/meta | head -c 300 && echo && echo "Live." \
  || echo "Not answering yet — the certificate for app.rentleaks.com can take a few minutes. Try: curl https://app.rentleaks.com/api/v1/meta"
