/** Pure formatting helpers. Run: npm test (Node 22.6+). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { addMonths, daysBetween, money, stayLabel, toIso } from "../src/lib/format.ts";

test("money uses the market's currency", () => {
  assert.equal(money(900, "EUR"), "€900");
  assert.equal(money(1500), "$1,500");
});

test("dates stay ISO and local", () => {
  assert.equal(toIso(new Date(2026, 0, 5)), "2026-01-05");
  assert.equal(daysBetween("2026-03-01", "2026-06-29"), 120);
});

test("stay label summarises a window", () => {
  assert.match(stayLabel("2026-03-01", "2026-06-29"), /4 mo$/);
  assert.equal(stayLabel(), "Any dates");
});

test("addMonths clamps to the end of shorter months", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2026-11-15", 3), "2027-02-15");
});
