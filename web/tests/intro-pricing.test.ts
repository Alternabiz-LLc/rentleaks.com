import assert from "node:assert/strict";
import { test } from "node:test";
import { hostCheckoutLines } from "../src/lib/checkout";
import { discountedCents, introOffLabel, introOffPercent } from "../src/lib/plans";

test("intro discount is 20%, then 15%, then 12%, then full price", () => {
  assert.equal(introOffPercent(0), 20);
  assert.equal(introOffPercent(1), 15);
  assert.equal(introOffPercent(2), 12);
  assert.equal(introOffPercent(3), 0);
  assert.equal(introOffLabel(0), "20% off your first listing");
  assert.equal(introOffLabel(3), null);
  assert.equal(discountedCents(1400, 20), 1120);
  assert.equal(discountedCents(3500, 20), 2800);
  assert.equal(discountedCents(6000, 15), 5100);
  assert.equal(discountedCents(13000, 15), 11050);
  assert.equal(discountedCents(1400, 12), 1232);
  assert.equal(discountedCents(13000, 12), 11440);
});

test("checkout discounts the listing fee and the sponsored add-on together", () => {
  const first = hostCheckoutLines({ housingType: "room", plan: "week", sponsored: true, priorListings: 0 });
  assert.deepEqual(
    first.map((line) => [line.kind, line.amountCents]),
    [
      ["listing", 1120],
      ["sponsored", 2800],
    ],
  );
  assert.equal(first[0].priceId, undefined);

  const third = hostCheckoutLines({ housingType: "room", plan: "month", sponsored: true, priorListings: 2 });
  assert.deepEqual(
    third.map((line) => line.amountCents),
    [5280, 11440],
  );

  const later = hostCheckoutLines({ housingType: "room", plan: "week", sponsored: false, priorListings: 3 });
  assert.equal(later[0].amountCents, 1400);

  assert.equal(hostCheckoutLines({ housingType: "lease-break", plan: "week", sponsored: false, priorListings: 0 })[0].amountCents, 1500);
  assert.equal(hostCheckoutLines({ housingType: "lease-break", plan: "month", sponsored: false, priorListings: 0 })[0].amountCents, 6000);
});
