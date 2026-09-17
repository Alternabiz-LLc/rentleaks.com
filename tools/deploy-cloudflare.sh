#!/usr/bin/env bash
# One-pass first deploy of the RentLeaks app to Cloudflare (app.rentleaks.com).
#
#   bash tools/deploy-cloudflare.sh              # build, migrate, deploy
#   bash tools/deploy-cloudflare.sh --secrets    # email (Resend / SMTP), Facebook, feed keys
#   bash tools/deploy-cloudflare.sh --data-only  # migrations + catalogue, no build
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
MODE="${1:-}"
DATA_ONLY=""; [ "$MODE" = "--data-only" ] && DATA_ONLY=1
cd "$ROOT/web"
say()  { printf '\n\033[1m== %s\033[0m\n' "$*"; }
fail() { printf '\n\033[31mStopped: %s\033[0m\n' "$*" >&2; exit 1; }
W() { npx --yes wrangler "$@"; }

say "1/8 Packages"
npm install --no-audit --no-fund --loglevel=error

say "2/8 Cloudflare login"
if ! W whoami 2>/dev/null | grep -qi "associated with the email"; then
  W login
fi
W whoami | grep -i -E "email|account" | head -5 || true

secret_names() { W secret list 2>/dev/null | grep -oE '"name": *"[A-Z0-9_]+"' | grep -oE '[A-Z0-9_]+"$' | tr -d '"' || true; }
put_secret() { printf '%s' "$2" | W secret put "$1" >/dev/null && echo "  ✓ $1 saved"; }
ask() { local v; read -rp "$1" v; printf '%s' "${v:-$2}"; }
ask_hidden() { local v; printf '%s' "$1" >&2; read -rs v; echo >&2; printf '%s' "$v"; }

integrations() {
  local have; have="$(secret_names)"
  say "Email · Resend (password resets, lead alerts, newsletters, campaigns)"
  echo "resend.com → API Keys → Create (Sending access). Enter keeps the current value."
  local v; v="$(ask_hidden "Resend API key${have:+$(echo "$have" | grep -q RESEND_API_KEY && echo ' [set]')}: ")"
  [ -n "$v" ] && put_secret RESEND_API_KEY "$v"

  say "Email · your own mailbox over SMTP (one-to-one outreach, invites)"
  echo "Namecheap Private Email: host mail.privateemail.com, port 465, your full address and its password."
  local user; user="$(ask "Mailbox address (Enter to skip): " "")"
  if [ -n "$user" ]; then
    put_secret SMTP_HOST "$(ask "SMTP host [mail.privateemail.com]: " "mail.privateemail.com")"
    put_secret SMTP_PORT "$(ask "SMTP port [465]: " "465")"
    put_secret SMTP_USER "$user"
    v="$(ask_hidden "Mailbox password: ")"
    [ -n "$v" ] && put_secret SMTP_PASS "$v"
  fi

  say "Facebook Page auto-posting (optional)"
  echo "Needs a long-lived Page access token with pages_manage_posts (Meta for Developers → Graph API Explorer)."
  local page; page="$(ask "Facebook Page ID (Enter to skip) [61594270177079]: " "")"
  if [ -n "$page" ]; then
    put_secret FB_PAGE_ID "$page"
    v="$(ask_hidden "Page access token: ")"
    [ -n "$v" ] && put_secret FB_PAGE_TOKEN "$v"
  fi

  if ! echo "$have" | grep -q META_FEED_KEY; then
    local key; key="$(openssl rand -hex 16)"
    put_secret META_FEED_KEY "$key"
    echo "  Meta catalog feed: https://app.rentleaks.com/feeds/meta-home-listings.csv?key=$key"
  fi
  v=""; unset v
}

if [ "$MODE" = "--secrets" ]; then
  integrations
  echo
  echo "Done. Secrets apply immediately — check Admin → System → Health, then send a test email."
  exit 0
fi

say "3/8 Database address"
DB_URL="${NEON_DIRECT_URL:-}"
NEON() { npx --yes neonctl@4 "$@"; }
neon_auto() {
  # Signs in to Neon in the browser (first time only), finds or creates the
  # "rentleaks" project in AWS US East, and reads its direct connection string.
  echo "Neon: a browser window may open — sign in (or sign up) and approve." >&2
  NEON me -o json >/dev/null 2>&1 || NEON auth >&2
  local pid
  pid="$(NEON projects list -o json 2>/dev/null | node -e '
    let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{
      const j=JSON.parse(s);const a=Array.isArray(j)?j:(j.projects||[]);
      const p=a.find(x=>x.name==="rentleaks");if(p)process.stdout.write(p.id)}catch{}})')"
  if [ -z "$pid" ]; then
    echo "Neon: creating project rentleaks (AWS US East)…" >&2
    NEON projects create --name rentleaks --region-id aws-us-east-1 --no-secrets -o json >/dev/null
    pid="$(NEON projects list -o json | node -e '
      let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
        const j=JSON.parse(s);const a=Array.isArray(j)?j:(j.projects||[]);
        const p=a.find(x=>x.name==="rentleaks");if(p)process.stdout.write(p.id)})')"
  else
    echo "Neon: using existing project rentleaks ($pid)" >&2
  fi
  [ -n "$pid" ] || return 1
  NEON connection-string --project-id "$pid" --ssl require 2>/dev/null | tail -1
}
if [ -z "$DB_URL" ]; then
  cat <<'TXT'
Press Enter to set up Neon automatically (recommended),
or paste a Neon DIRECT connection string (hidden) and press Enter.
TXT
  read -rs DB_URL; echo
  if [ -z "$DB_URL" ]; then
    DB_URL="$(neon_auto || true)"
  fi
fi
DB_URL="$(printf '%s' "$DB_URL" | tr -d '[:space:]' | sed -E "s/^psql//; s/^['\"]//; s/['\"]$//")"
case "$DB_URL" in
  postgres://*|postgresql://*) ;;
  *) fail "no database address. Run again and press Enter for automatic Neon setup, or paste the string from console.neon.tech → Connect (pooling off)." ;;
esac
case "$DB_URL" in *-pooler*) fail "use the DIRECT string (turn off 'Connection pooling' in Neon's Connect dialog)." ;; esac
case "$DB_URL" in *sslmode=*) ;; *\?*) DB_URL="$DB_URL&sslmode=require" ;; *) DB_URL="$DB_URL?sslmode=require" ;; esac
export DATABASE_URL="$DB_URL" DIRECT_URL="$DB_URL"

say "4/8 Tables (Prisma migrations on Neon)"
npx prisma migrate deploy
if ! npx prisma migrate diff --from-url "$DB_URL" --to-schema-datamodel prisma/schema.prisma --exit-code >/tmp/rentleaks-drift.sql 2>&1; then
  if grep -qiE "^(-- |ALTER|CREATE|DROP)" /tmp/rentleaks-drift.sql; then
    echo "⚠ The live database differs from prisma/schema.prisma. Send this to your developer:"
    sed -n 1,40p /tmp/rentleaks-drift.sql
  fi
fi
rm -f /tmp/rentleaks-drift.sql

if [ -n "$DATA_ONLY" ]; then
  say "Cities, operators and the example catalogue"
  npx prisma db seed
  echo "Done (data only)."
  exit 0
fi

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

HAVE="$(secret_names)"
echo "$HAVE" | grep -q CRON_SECRET || put_secret CRON_SECRET "$(openssl rand -hex 32)"
echo "$HAVE" | grep -q UNSUBSCRIBE_SECRET || put_secret UNSUBSCRIBE_SECRET "$(openssl rand -hex 32)"
# Seals the desk's two-factor secrets. Created once; never rotate it by hand.
echo "$HAVE" | grep -q AUTH_SECRET || put_secret AUTH_SECRET "$(openssl rand -hex 32)"
if ! echo "$HAVE" | grep -qE "RESEND_API_KEY|SMTP_PASS"; then
  read -rp "Set up email (Resend / your mailbox) and Facebook now? [Y/n] " yn
  [ "${yn:-Y}" = "n" ] || [ "${yn:-Y}" = "N" ] || integrations
fi

say "8/8 Founder account on the live database"
if [ -n "$(command -v gh)" ] && gh auth status >/dev/null 2>&1; then
  printf '%s' "$DB_URL" | gh secret set DATABASE_DIRECT_URL --repo Alternabiz-LLc/rentleaks.com && echo "GitHub secret DATABASE_DIRECT_URL set (future migrations run on push)."
else
  echo "Add the GitHub secret DATABASE_DIRECT_URL by hand (DEPLOY.md §2.3) so future migrations run on push."
fi
read -rp "Create or change your founder login (or reset its two-factor) now? [y/N] " yn
if [ "${yn:-N}" = "y" ] || [ "${yn:-N}" = "Y" ]; then
  DATABASE_URL="$DB_URL" DIRECT_URL="$DB_URL" npm run founder
fi
read -rp "Reload cities, operators and the example catalogue from data.js? (resets edits made in Admin → Markets) [y/N] " yn
if [ "${yn:-N}" = "y" ] || [ "${yn:-N}" = "Y" ]; then
  if ! DATABASE_URL="$DB_URL" DIRECT_URL="$DB_URL" npx prisma db seed; then
    echo "Skipped: the catalogue needs a founder account. Run this script again and answer y to the founder question."
  fi
fi
unset DB_URL

say "Checking https://app.rentleaks.com"
sleep 5
if META="$(curl -fsS https://app.rentleaks.com/api/v1/meta 2>/dev/null)"; then
  echo "${META:0:120}…"
  echo "Live."
else
  echo "Not answering yet — the certificate for app.rentleaks.com can take a few minutes. Try: curl https://app.rentleaks.com/api/v1/meta"
fi
