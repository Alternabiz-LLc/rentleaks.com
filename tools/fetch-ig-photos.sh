#!/usr/bin/env bash
# Fetches the eight interiors behind the Instagram feed, then re-renders it.
#
#     bash tools/fetch-ig-photos.sh
#     bash tools/fetch-ig-photos.sh --force     # re-download what is already here
#
# The URLs live in tools/social/ig-photos.json. Files land in
# images/social/photos/ and are committed with the rest of the site, because
# Instagram fetches a post's picture by public URL.
#
# Run it from the repository root. Until it has run, tools/build-ig-feed.py
# draws the painted cards instead — the feed is never half-made.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SPEC="$ROOT/tools/social/ig-photos.json"
DIR="$ROOT/$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['dir'])" "$SPEC")"
FORCE="${1:-}"

mkdir -p "$DIR"
got=0; skipped=0; failed=0

while IFS=$'\t' read -r slug path url; do
  # A photo either lands in the feed's photo directory or at its own path —
  # the page heroes live under images/, not with the feed interiors.
  if [ "$path" != "-" ] && [ -n "$path" ]; then out="$ROOT/$path"; mkdir -p "$(dirname "$out")"; else out="$DIR/$slug.jpg"; fi
  if [ -s "$out" ] && [ "$FORCE" != "--force" ]; then
    echo "  = ${out#$ROOT/} (already here)"
    skipped=$((skipped + 1))
    continue
  fi
  if curl -fsSL --max-time 120 -o "$out.part" "$url"; then
    mv "$out.part" "$out"
    echo "  + ${out#$ROOT/}  ($(du -h "$out" | cut -f1))"
    got=$((got + 1))
  else
    rm -f "$out.part"
    echo "  ! ${out#$ROOT/} failed — $url" >&2
    failed=$((failed + 1))
  fi
done < <(python3 - "$SPEC" <<'PY'
import json, sys
spec = json.load(open(sys.argv[1]))
for slug, p in spec["photos"].items():
      # "-" rather than an empty field: tab is IFS whitespace, so bash's read
    # collapses two tabs into one and every column after it shifts left.
    print(f"{slug}\t{p.get('path') or '-'}\t{p['url']}")
PY
)

echo
echo "$got downloaded, $skipped already here, $failed failed."
# NOT `[ "$failed" -gt 0 ] && exit 1` — under `set -e` that aborts the whole
# script when nothing failed, which silently skipped every step below it.
if [ "$failed" -gt 0 ]; then exit 1; fi
if [ "$skipped" -gt 0 ]; then
  echo "(a file already on disk is left alone — pass --force to replace one, e.g. a placeholder)"
fi

echo "Re-rendering the feed and the landing pages…"
python3 "$ROOT/tools/build-ig-feed.py"
# The landing-page heroes take one of these photos too, so they are rebuilt
# here rather than leaving a page pointing at the stock room.
python3 "$ROOT/tools/build-social-pages.py"
# The hire-a-broker heroes read images/ at build time too.
node --no-warnings "$ROOT/tools/build-broker-pages.mjs"
echo
echo "Commit images/ and the rebuilt pages, then deploy the static site:"
echo "  git add images *.html hire-a-broker && git commit -m 'Instagram feed: the interiors' && git push origin main"
