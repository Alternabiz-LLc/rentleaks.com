# RentLeaks — mobile

Expo SDK 57 · React Native 0.86 · Expo Router · TypeScript. The plan, the must-haves and the tool stack are in [`../MOBILE-APP.md`](../MOBILE-APP.md).

```bash
cp .env.example .env        # EXPO_PUBLIC_API_URL = your Mac's LAN IP + :3100
npm install
npx expo start              # runs sync-shared first
npm run typecheck
npm test
```

| Script | What it does |
|---|---|
| `npm run sync-shared` | Copies `web/src/lib/{rules.json,listing-rules.ts,listing-evidence.ts}` into `src/shared/` |
| `npm start` | Syncs, then starts Metro |
| `npm run ios` / `npm run android` | Local native build (needs Xcode or Android Studio). On Xcode 26, `expo run:ios` may stop for code signing even for the Simulator — use `../Launch RentLeaks iOS.command`, which builds with `xcodebuild` |
| `npx eas-cli build --profile development` | Dev client with push, maps and native modules |

## Layout

```
app/                     routes
  (tabs)/                index (Explore) · saved · inbox · host · me
  search                 where-and-when sheet
  listing/[id]           detail + evidence layer + photo viewer
  contact/[listingId]    first message ("Ask before you pay")
  conversation/[id]      thread with scam guard, read receipts, report, block, archive
  host/new               7-step composer; `?id=` edits an existing listing
  admin/                 founder review + reports
  tools/                 passport · condition reports · rules · fee-check · afford
src/api                  client, types, hooks
src/components           ui primitives, Evidence panels, ListingCard
src/features             search state, composer, passport, condition, recent views
src/shared               GENERATED — edit the web copies
src/theme                Editorial Warm-Modern tokens, light + dark
```

Do not edit `src/shared/*`. It is overwritten on every start.
