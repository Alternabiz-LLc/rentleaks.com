/**
 * Checks the built locale trees. Run it after tools/build-locales.mjs and
 * tools/generate-seo-pages.js, before committing:
 *
 *     node tools/check-locales.mjs
 *
 * What it is actually guarding against, in order of how quietly each one
 * fails in production:
 *
 *   1. hreflang that is not reciprocal. Google discards a cluster whose
 *      members do not all name each other, and discards it silently — the
 *      pages stay indexed, they just compete with each other instead of
 *      serving the right language. Nothing in the HTML looks wrong.
 *   2. An asset path with the wrong number of ../ segments. A page one level
 *      deeper loads no CSS and no JavaScript, and still returns 200.
 *   3. The dictionary loading after script.js, which leaves the header in
 *      English on a French page for as long as anyone looks at it.
 *   4. A translated page missing from a sitemap, or a sitemap entry with no
 *      page behind it.
 *   5. A dictionary key whose translation is still the English.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://rentleaks.com";
const CODES = fs
  .readdirSync(path.join(ROOT, "locales"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""));
const ALL = [{ code: "en", tag: "en-US", dir: "" }].concat(
  CODES.map((c) => ({ code: c, tag: c, dir: c }))
);

let failed = 0;
const fail = (m) => { console.log("  FAIL  " + m); failed++; };
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const urlFor = (dir, neutral) => `${SITE}/${dir ? dir + "/" : ""}${neutral}`;
const fileFor = (dir, neutral) => (dir ? dir + "/" : "") + (neutral || "index.html");

/* Every page that should exist in all three trees. */
function neutralPaths() {
  const L = JSON.parse(read(`locales/${CODES[0]}.json`));
  const core = ["", "rent.html", "cities.html", "match.html", "list.html",
    "professionals.html", "operators.html", "faq.html", "contact.html",
    "privacy.html", "terms.html"];
  const types = Object.values(L.types).map((t) => t.file);
  const cities = fs
    .readdirSync(path.join(ROOT, "cities"))
    .filter((f) => f.endsWith(".html"))
    .map((f) => "cities/" + f);
  return { core, types, cities, all: [...core, ...types, ...cities] };
}

const P = neutralPaths();
console.log(`Checking ${ALL.length} locales × ${P.all.length} pages\n`);

/* 1 · every page present, in every tree */
let missing = 0;
for (const l of ALL) {
  for (const n of P.all) {
    if (!exists(fileFor(l.dir, n))) { fail(`missing ${fileFor(l.dir, n)}`); missing++; }
    if (missing > 8) break;
  }
}
if (!missing) console.log(`  PASS  all ${ALL.length * P.all.length} pages exist`);

/* 2 · hreflang, reciprocal, on a sample from each shape in each tree */
const sample = ["", P.types[0], "faq.html", P.cities[0], P.cities[P.cities.length - 1]];
let bad = 0;
for (const l of ALL) {
  for (const n of sample) {
    const f = fileFor(l.dir, n);
    if (!exists(f)) continue;
    const html = read(f);
    const got = new Set(
      [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)]
        .map((m) => m[1] + " " + m[2])
    );
    for (const other of ALL) {
      const want = `${other.tag} ${urlFor(other.dir, n)}`;
      if (!got.has(want)) { fail(`${f} does not name ${want}`); bad++; }
    }
    if (!got.has(`x-default ${urlFor("", n)}`)) { fail(`${f} has no x-default`); bad++; }
    const canon = (html.match(/<link rel="canonical" href="([^"]+)">/) || [])[1];
    if (canon !== urlFor(l.dir, n)) { fail(`${f} canonical is ${canon}`); bad++; }
  }
}
if (!bad) console.log(`  PASS  hreflang reciprocal and canonical self-referencing`);

/* 3 · asset depth, and the load order the runtime layer depends on */
let deep = 0;
for (const l of ALL.filter((x) => x.dir)) {
  for (const n of ["", P.types[0], P.cities[0]]) {
    const f = fileFor(l.dir, n);
    if (!exists(f)) continue;
    const html = read(f);
    const depth = f.split("/").length - 1;
    const srcs = [...html.matchAll(/<(?:script src|link[^>]*href)="((?:\.\.\/)+[^"]+)"/g)].map((m) => m[1]);
    for (const s of srcs) {
      const ups = (s.match(/\.\.\//g) || []).length;
      if (ups !== depth) { fail(`${f} climbs ${ups} for ${s}, needs ${depth}`); deep++; }
    }
    const order = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
    const iDict = order.findIndex((x) => /locales\/\w+\.ui\.js/.test(x));
    const iMain = order.findIndex((x) => /\bscript\.js/.test(x));
    const iI18n = order.findIndex((x) => /rentleaks-i18n\.js/.test(x));
    if (!(iDict >= 0 && iDict < iMain && iMain < iI18n)) {
      fail(`${f} script order is dict=${iDict} script=${iMain} i18n=${iI18n}`);
      deep++;
    }
    const lang = (html.match(/<html lang="([^"]+)"/) || [])[1] || "";
    if (!lang.startsWith(l.code)) { fail(`${f} declares lang="${lang}"`); deep++; }
  }
}
if (!deep) console.log("  PASS  asset depth, script order and html lang");

/* 4 · sitemaps line up with what is on disk */
let sm = 0;
for (const c of CODES) {
  const f = `sitemap-${c}.xml`;
  if (!exists(f)) { fail(`${f} not built`); sm++; continue; }
  const locs = [...read(f).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  for (const loc of locs) {
    const rel = loc.replace(SITE + "/", "");
    if (!exists(rel || "index.html") && !exists(rel + "index.html")) {
      fail(`${f} lists ${loc} but no file is there`);
      if (++sm > 5) break;
    }
  }
  if (!read("sitemap-index.xml").includes(f)) { fail(`sitemap-index.xml omits ${f}`); sm++; }
  if (!read("robots.txt").includes(f)) { fail(`robots.txt omits ${f}`); sm++; }
}
if (!sm) console.log(`  PASS  locale sitemaps, sitemap-index and robots.txt agree`);

/* 5 · dictionary sanity */
let dict = 0;
for (const c of CODES) {
  const L = JSON.parse(read(`locales/${c}.json`));
  // Words that are genuinely the same in the target language. Listing them
  // is the point: an entry here is a claim someone checked, and anything not
  // on it that matches its English is a key that was copied and not translated.
  const SAME = new Set([
    "FAQ", "Stay DNA", "Wifi", "Video", "Website", "Name", "Max", "Min", "API",
    "Co-Living", "Coliving", "Aparthotel", "Contact", "Type", "Message",
    "Name A–Z", "Sort", "Grid", "Moment",
  ]);
  const untouched = Object.entries(L.ui).filter(([k, v]) => k === v && !SAME.has(k));
  if (untouched.length) {
    fail(`${c}: ${untouched.length} key(s) still equal the English — ${untouched.slice(0, 5).map(([k]) => JSON.stringify(k)).join(", ")}`);
    dict++;
  }
  for (const r of L.patterns || []) {
    try { new RegExp(r.re); } catch (e) { fail(`${c}: bad pattern ${r.re} — ${e.message}`); dict++; }
    // Only a rule that captures something has something to put back.
    const captures = (() => { try { return new RegExp(r.re + "|").exec("").length - 1; } catch (e) { return 0; } })();
    if (captures > 0 && !/\{\d+/.test(r.to)) { fail(`${c}: pattern ${r.re} discards its capture`); dict++; }
  }
  if (!exists(`locales/${c}.ui.js`)) { fail(`locales/${c}.ui.js not built`); dict++; }
  else if (!read(`locales/${c}.ui.js`).startsWith("/* Generated")) { fail(`locales/${c}.ui.js looks hand-edited`); dict++; }
}
if (!dict) console.log("  PASS  dictionaries translated, patterns valid, runtime files generated");

console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
