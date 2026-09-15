#!/usr/bin/env node
/**
 * Writes the app-link files for the STATIC site (rentleaks.com on GitHub Pages),
 * so https://rentleaks.com/listings/... opens the app.
 *
 *   APPLE_TEAM_ID=ABCDE12345 ANDROID_CERT_SHA256=AA:BB:... node tools/write-app-links.mjs
 *
 * GitHub Pages notes:
 *  - A `.nojekyll` file at the repo root is required or `.well-known/` is not published.
 *    This script creates it if missing.
 *  - Pages serves `apple-app-site-association` (no extension) as
 *    application/octet-stream. Apple's CDN generally accepts this, but if
 *    validation fails, serve the site through a CDN rule that sets
 *    Content-Type: application/json, or rely on the Next app domain, which
 *    serves the correct type (web/src/app/.well-known/).
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const team = process.env.APPLE_TEAM_ID;
const bundle = process.env.IOS_BUNDLE_ID || "com.alternabiz.rentleaks";
const pkg = process.env.ANDROID_PACKAGE || "com.alternabiz.rentleaks";
const prints = (process.env.ANDROID_CERT_SHA256 || "").split(",").map((s) => s.trim()).filter(Boolean);

if (!team || !/^[A-Z0-9]{10}$/.test(team)) {
  console.error("Set APPLE_TEAM_ID (10 characters, from developer.apple.com → Membership).");
  process.exit(1);
}

const dir = join(root, ".well-known");
mkdirSync(dir, { recursive: true });
const appID = `${team}.${bundle}`;

writeFileSync(
  join(dir, "apple-app-site-association"),
  JSON.stringify({ applinks: { details: [{ appIDs: [appID], components: [{ "/": "/listings/*" }, { "/": "/listing.html" }] }] } }, null, 2) + "\n",
);
console.log("wrote .well-known/apple-app-site-association for", appID);

if (prints.length) {
  writeFileSync(
    join(dir, "assetlinks.json"),
    JSON.stringify([{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: pkg, sha256_cert_fingerprints: prints } }], null, 2) + "\n",
  );
  console.log("wrote .well-known/assetlinks.json for", pkg);
} else {
  console.log("ANDROID_CERT_SHA256 not set — skipped assetlinks.json");
}

if (!existsSync(join(root, ".nojekyll"))) {
  writeFileSync(join(root, ".nojekyll"), "");
  console.log("created .nojekyll so GitHub Pages publishes .well-known/");
}
