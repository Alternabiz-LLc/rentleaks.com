#!/bin/zsh -l
# Double-click in Finder to start the RentLeaks API and open the iOS app in the Simulator.
#
# Builds with xcodebuild directly rather than `expo run:ios`: on Xcode 26 the
# Expo CLI can mistake the Simulator for a physical device and stop for code
# signing. xcodebuild against the Simulator needs no certificate.
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
export LANG=en_US.UTF-8
SIM="${RENTLEAKS_SIM:-iPhone 17 Pro}"

echo "== RentLeaks iOS launcher =="
echo "Node: $(node -v 2>/dev/null || echo 'not found')   Xcode: $(xcodebuild -version 2>/dev/null | head -1 || echo 'not found')"

if ! command -v node >/dev/null; then
  echo "Node.js is not on PATH. Install it from https://nodejs.org, then run this again."; read -k1; exit 1
fi
if ! xcodebuild -version >/dev/null 2>&1; then
  echo "Xcode is not installed or not selected (xcode-select). Install Xcode from the App Store, open it once, then run this again."; read -k1; exit 1
fi

echo "\n-- 1/5 Database (Docker) --"
(cd web && npm run db:up) || echo "Could not start Docker Postgres — open Docker Desktop and run this again if the app shows no homes."

echo "\n-- 2/5 API server on http://localhost:3100 --"
if curl -s -o /dev/null http://localhost:3100/api/v1/meta; then
  echo "Already running."
else
  [ -d web/node_modules ] || (cd web && npm install)
  (cd web && npx prisma generate >/dev/null 2>&1 || true)
  (cd web && nohup npm run dev > /tmp/rentleaks-web.log 2>&1 &)
  echo -n "Starting"
  for i in {1..60}; do
    if curl -s -o /dev/null http://localhost:3100/api/v1/meta; then echo " ready."; break; fi
    echo -n "."; sleep 2
  done
  echo "(server log: /tmp/rentleaks-web.log)"
fi

echo "\n-- 3/5 App dependencies --"
cd "$ROOT/mobile"
[ -f .env ] || printf 'EXPO_PUBLIC_API_URL=http://localhost:3100\nEXPO_PUBLIC_WEB_URL=https://rentleaks.com\n' > .env
[ -d node_modules ] || npm install
if ! command -v pod >/dev/null; then
  echo "CocoaPods is missing — installing it (needed for iOS builds)."
  if command -v brew >/dev/null; then brew install cocoapods; else sudo gem install cocoapods; fi
fi

echo "\n-- 4/5 Native build for the Simulator (first build takes several minutes) --"
if [ ! -d ios ]; then
  npx expo prebuild --platform ios --no-install
fi
(cd ios && pod install)
UDID=$(xcrun simctl list devices available | grep -F "$SIM (" | head -1 | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/')
if [ -z "$UDID" ]; then
  echo "No Simulator named \"$SIM\". Open Xcode → Settings → Components to add one, or set RENTLEAKS_SIM=\"<name>\"."; read -k1; exit 1
fi
xcodebuild -workspace ios/RentLeaks.xcworkspace -scheme RentLeaks -configuration Debug \
  -destination "platform=iOS Simulator,id=$UDID" -derivedDataPath ios/build \
  -skipMacroValidation -quiet build
APP=$(find ios/build/Build/Products/Debug-iphonesimulator -maxdepth 1 -name "*.app" | head -1)
BUNDLE=$(/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$APP/Info.plist")

echo "\n-- 5/5 Install, launch, and start Metro --"
open -a Simulator
xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl install "$UDID" "$APP"
xcrun simctl launch "$UDID" "$BUNDLE" >/dev/null
echo "The app opens on its development launcher. If it asks, tap the \"RentLeaks\" server entry once — after that it reconnects on its own."
echo "Leave this window open: it is the JavaScript bundler. Ctrl+C stops it."
npx expo start
