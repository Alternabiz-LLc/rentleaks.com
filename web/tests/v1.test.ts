/**
 * Unit tests for the pure pieces the mobile API depends on, plus the
 * publication gate the brief asks to have covered first (§6.1).
 *
 *   npm test        (runs: tsx --test tests/*.test.ts)
 *
 * No database: every function here is pure.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { blockersFor, checkListing, rulesFor, type ListingDraft } from "../src/lib/listing-rules";
import { scanMessage } from "../src/lib/v1/scam-guard";
import { coerceSearch, parseSearch, searchOrder } from "../src/lib/v1/search";
import { publicAddress } from "../src/lib/v1/listing-view";
import { int } from "../src/lib/v1/http";

const nyc = { cityId: "nyc", citySlug: "new-york", cityName: "New York", state: "NY", country: "US" };

function draft(over: Partial<ListingDraft> = {}): ListingDraft {
  return {
    role: "manager",
    housingType: "room",
    ...nyc,
    title: "Bright private room near the park",
    neighborhood: "Park Slope",
    address: "123 Example St",
    description: "A quiet room in a three-bedroom apartment with two housemates who work from home. ".repeat(3),
    price: 1500,
    deposit: 1500,
    fees: [{ type: "utilities", amount: 80, cadence: "monthly", mandatory: true }],
    availableFrom: "2026-10-01",
    availableUntil: "2027-06-30",
    minStayMonths: 1,
    maxStayMonths: 12,
    registrationNumber: "",
    photoCount: 6,
    ...over,
  };
}

/* --- rules engine & gate ------------------------------------------------ */

test("New York resolves to its own rules, not the defaults", () => {
  const r = rulesFor(nyc);
  assert.equal(r.landlordAgentMayChargeTenant, false, "FARE Act must apply");
  assert.equal(r.depositCapMonths, 1, "GOL 7-108 one-month cap");
});

test("a clean NYC draft passes the gate", () => {
  assert.deepEqual(blockersFor(draft()).map((b) => b.id), []);
});

test("a landlord's agent charging the renter a broker fee in NYC is blocked", () => {
  const ids = blockersFor(draft({ fees: [{ type: "broker", amount: 3000, cadence: "once", mandatory: true }] })).map((b) => b.id);
  assert.ok(ids.includes("broker"));
});

test("a deposit over the NYC cap is blocked", () => {
  const ids = blockersFor(draft({ deposit: 3000 })).map((b) => b.id);
  assert.ok(ids.includes("deposit"));
});

test("fewer than four photos is blocked", () => {
  assert.ok(blockersFor(draft({ photoCount: 2 })).some((b) => b.id === "photos"));
});

test("discriminatory wording is blocked", () => {
  const checks = checkListing(draft({ description: "Perfect for a young professional, no kids please. ".repeat(4) }));
  const wording = checks.find((c) => c.id === "wording");
  assert.ok(wording && !wording.ok && wording.blocking);
});

test("an availability window shorter than the minimum stay is blocked", () => {
  const ids = blockersFor(draft({ minStayMonths: 6, availableUntil: "2026-12-01" })).map((b) => b.id);
  assert.ok(ids.includes("window"));
});

/* --- scam guard ---------------------------------------------------------- */

test("scam guard flags the classic scripts", () => {
  const keys = (s: string) => scanMessage(s).map((x) => x.key);
  assert.ok(keys("Please send the deposit by Western Union").includes("untraceable-payment"));
  assert.ok(keys("You need to pay the deposit before the viewing").includes("pay-before-viewing"));
  assert.ok(keys("I am out of the country so I will mail you the keys").includes("abroad-keys"));
  assert.ok(keys("Text me on WhatsApp instead").includes("off-platform"));
  assert.ok(keys("Transfer the fee to RentLeaks to reserve").includes("pay-rentleaks"));
});

test("scam guard stays quiet on an ordinary message", () => {
  assert.deepEqual(scanMessage("Hi! Is the room still free in October? Could we do a video call on Tuesday?"), []);
});

/* --- search -------------------------------------------------------------- */

test("parseSearch drops malformed dates and unknown types", () => {
  const s = parseSearch(new URLSearchParams("moveIn=2026-13&moveOut=2027-01-01&type=castle&noFee=1"));
  assert.equal(s.moveIn, undefined);
  assert.equal(s.moveOut, "2027-01-01");
  assert.equal(s.type, undefined);
  assert.equal(s.noFee, true);
});

test("coerceSearch round-trips a stored query", () => {
  const s = coerceSearch({ city: "berlin", maxUsd: 1200, furnished: true, verified: false });
  assert.equal(s.city, "berlin");
  assert.equal(s.maxUsd, 1200);
  assert.equal(s.furnished, true);
  assert.equal(s.verified, false);
});

test("sponsored placement only lifts results inside a city search", () => {
  assert.deepEqual(searchOrder({})[0], { verified: "desc" });
  assert.deepEqual(searchOrder({ city: "nyc" })[0], { sponsored: "desc" });
});

/* --- address privacy ----------------------------------------------------- */

test("publicAddress honours the lister's privacy choice", () => {
  const base = { address: "123 Example St, #4B", neighborhood: "Park Slope" };
  assert.equal(publicAddress({ ...base, addressPrivacy: "full" }), "123 Example St, #4B");
  assert.equal(publicAddress({ ...base, addressPrivacy: "hide-unit" }), "123 Example St");
  assert.equal(publicAddress({ ...base, addressPrivacy: "street-only" }), "Example St");
  assert.equal(publicAddress({ ...base, addressPrivacy: "hidden" }), "Park Slope");
  /* Seeded and pasted addresses carry the city after the unit. */
  const postal = { address: "440 Albert Cuypstraat, #7, Amsterdam, Netherlands", neighborhood: "De Pijp" };
  assert.equal(publicAddress({ ...postal, addressPrivacy: "street-only" }), "Albert Cuypstraat, Amsterdam, Netherlands");
  assert.equal(publicAddress({ ...postal, addressPrivacy: "hide-unit" }), "440 Albert Cuypstraat, Amsterdam, Netherlands");
  assert.equal(publicAddress({ address: "12 Main St Apt 3, Austin, TX", neighborhood: "x", addressPrivacy: "hide-unit" }), "12 Main St, Austin, TX");
});

/* --- composer: edit round-trip ------------------------------------------ */

import { toComposerDraft } from "../src/lib/v1/composer";

test("a stored listing comes back in the shape the composer edits", () => {
  const row = {
    id: "nyc-room-x", cityId: "nyc", hostId: "h", operatorId: null, housingType: "room", title: "Room", address: "12 Example St, #3B",
    neighborhood: "Astoria", price: 1500, allIn: 1580, currency: "USD", allInUsd: 1580, deposit: 1500, beds: 1, baths: 1, sqft: 0,
    lat: 40.7, lng: -73.9, image: "/uploads/h/a.jpg", description: "x".repeat(200), minStayMonths: 1, availableFrom: "2026-11-01",
    furnishedLevel: "fully", verified: false, noFee: true, amenitiesJson: '["wifi"]', maxStayMonths: 12, privateBath: false,
    workplaceReady: true, petsPolicy: "cats", utilitiesIncl: false, scamShield: true, featured: false, remainingMonths: null,
    leaseEnd: null, takeoverType: null, postedAt: new Date(), availableUntil: "2027-06-30", listedBy: "manager",
    addressPrivacy: "hide-unit", status: "active", scheduledAt: null, vouchersAccepted: true, registrationNumber: null,
    consentStatus: null, accessibilityJson: '["step-free"]', feesJson: '[{"type":"utilities","amount":80,"cadence":"monthly","mandatory":true}]',
    moderation: "approved", moderationNote: null, moderatedAt: null, moderatedById: null, sponsored: false, plan: "week",
    detail: { photos: ["/uploads/h/a.jpg", "/uploads/h/b.jpg"], tourUrl: "https://example.com/tour" }, createdAt: new Date(), updatedAt: new Date(),
  };
  const d = toComposerDraft(row as never);
  assert.equal(d.address, "12 Example St");
  assert.equal(d.unit, "3B");
  assert.equal(d.role, "manager");
  assert.deepEqual(d.photos, ["/uploads/h/a.jpg", "/uploads/h/b.jpg"]);
  assert.equal(d.fees[0].amount, 80);
  assert.equal(d.tourUrl, "https://example.com/tour");
  assert.equal(d.pets, "cats");
  const bare = toComposerDraft({ ...row, detail: {} } as never);
  assert.deepEqual(bare.photos, ["/uploads/h/a.jpg"], "falls back to the cover image");
});

test("the abroad-keys script is caught across sentences", () => {
  const keys = scanMessage("I'm currently abroad for work so I can't show it, but if you wire the deposit today to hold it I will mail you the keys.").map((s) => s.key);
  assert.ok(keys.includes("abroad-keys"), keys.join(","));
  assert.ok(keys.includes("untraceable-payment"));
});

test("wired internet is not a payment rail", () => {
  assert.equal(scanMessage("The flat has wired internet and a desk.").length, 0);
});

test("int() treats a missing query value as absent, not zero", () => {
  assert.equal(int(null, 50, 1, 100), 50);
  assert.equal(int("", 50, 1, 100), 50);
  assert.equal(int("0", 50, 1, 100), 1);
  assert.equal(int("250", 50, 1, 100), 100);
  assert.equal(int("abc", 50, 1, 100), 50);
});
