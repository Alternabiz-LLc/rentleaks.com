#!/usr/bin/env node
/**
 * Wraps the canonical rules into a browser global for the static layer.
 *
 *   web/src/lib/rules.json  ->  rentleaks-rules.js  (window.RENTLEAKS_RULES)
 *
 * The TypeScript side imports the JSON directly, so it needs no build step.
 * The static site cannot import JSON from a <script>, so it gets this wrapper.
 * One file to edit either way, which is the whole point — the data is what
 * drifts, not the twenty-line merge function on each side.
 *
 * Run from the repo root:  node tools/build-rules.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "web", "src", "lib", "rules.json");
const OUT = path.join(ROOT, "rentleaks-rules.js");

const raw = readFileSync(SRC, "utf8");

let parsed;
try {
  parsed = JSON.parse(raw);
} catch (err) {
  console.error("rules.json is not valid JSON:", err.message);
  process.exit(1);
}

/* Cheap integrity checks. A rule pointing at a source key that does not exist
   renders as a citation-less claim, which is worse than no claim at all. */
const problems = [];
const sourceKeys = new Set(Object.keys(parsed.sources || {}));
const SRC_FIELDS = [
  "minStaySrc", "depositSrc", "appFeeSrc", "applicationFeeSrc", "moveInFeesSrc",
  "tenantBrokerFeeSrc", "soiSrc", "fairChanceSrc", "allInSrc", "listingFeeDisclosureSrc",
  "registrationSrc", "subletSurchargeSrc", "brokerLicenceSrc", "reusableSrc",
  "screeningLaw", "adLaw", "dataLaw",
];

for (const scope of ["city", "region", "country"]) {
  for (const [key, rule] of Object.entries(parsed[scope] || {})) {
    for (const field of SRC_FIELDS) {
      const value = rule[field];
      if (value && !sourceKeys.has(value)) {
        problems.push(`${scope}.${key}.${field} -> unknown source "${value}"`);
      }
    }
    if (rule.sublet?.src && !sourceKeys.has(rule.sublet.src)) {
      problems.push(`${scope}.${key}.sublet.src -> unknown source "${rule.sublet.src}"`);
    }
  }
}

for (const [key, source] of Object.entries(parsed.sources || {})) {
  if (!source.label || !source.eff || !source.url) {
    problems.push(`sources.${key} is missing label, eff or url`);
  }
  if (source.eff && !/^\d{4}-\d{2}-\d{2}$/.test(source.eff)) {
    problems.push(`sources.${key}.eff "${source.eff}" is not YYYY-MM-DD`);
  }
}

if (problems.length) {
  console.error("rules.json failed its checks:");
  for (const p of problems) console.error("  · " + p);
  process.exit(1);
}

const banner = `/**
 * GENERATED — do not edit.
 *
 * Source: web/src/lib/rules.json
 * Rebuild: node tools/build-rules.mjs
 *
 * Edits here are lost on the next build. The rules live in one file so that a
 * change to a deposit cap or a minimum-stay floor cannot land on one half of
 * the product and not the other.
 */
`;

writeFileSync(OUT, `${banner}window.RENTLEAKS_RULES = ${JSON.stringify(parsed, null, 2)};\n`);

const counts = {
  sources: Object.keys(parsed.sources || {}).length,
  cities: Object.keys(parsed.city || {}).length,
  regions: Object.keys(parsed.region || {}).length,
  countries: Object.keys(parsed.country || {}).length,
  bannedTerms: (parsed.bannedTerms || []).length,
};
console.log("rentleaks-rules.js written —", JSON.stringify(counts));
