import assert from "node:assert/strict";
import { test } from "node:test";
import { pageSlots, placeSponsored, rotateSponsors, slots, sponsorSeed } from "../src/lib/sponsored-placement";

const kinds = (o: number, s: number) =>
  [...slots(o, s)].map((x) => (x.kind === "sponsored" ? `S${x.index}` : `o${x.index}`)).join(" ");

test("three sponsored open the results, then one after every six", () => {
  assert.equal(
    kinds(14, 6),
    "S0 S1 S2 o0 o1 o2 o3 o4 o5 S3 o6 o7 o8 o9 o10 o11 S4 o12 o13 S5",
  );
});

test("fewer sponsors than slots, none at all, or no regular results", () => {
  assert.equal(kinds(8, 1), "S0 o0 o1 o2 o3 o4 o5 o6 o7");
  assert.equal(kinds(3, 0), "o0 o1 o2");
  assert.equal(kinds(0, 4), "S0 S1 S2 S3");
  assert.equal(kinds(6, 4), "S0 S1 S2 o0 o1 o2 o3 o4 o5 S3");
});

test("every item appears exactly once", () => {
  const out = placeSponsored(["a", "b", "c", "d", "e", "f", "g"], ["X", "Y", "Z", "W", "V"]);
  assert.deepEqual(out.map((x) => x.item).sort(), ["V", "W", "X", "Y", "Z", "a", "b", "c", "d", "e", "f", "g"]);
  assert.deepEqual(out.filter((x) => x.sponsored).map((x) => x.item), ["X", "Y", "Z", "W", "V"]);
});

test("pages stitch together into the same stream", () => {
  const all = [...slots(45, 9)];
  const stitched = [];
  let page = 1;
  for (;;) {
    const p = pageSlots(page, 20, 45, 9);
    stitched.push(...p.slots);
    const organic = p.slots.filter((s) => s.kind === "organic");
    if (organic.length) {
      assert.equal(p.organicSkip, organic[0].index);
      assert.equal(p.organicTake, organic.length);
      organic.forEach((s, i) => assert.equal(s.index, p.organicSkip + i));
    }
    assert.equal(p.total, 54);
    if (!p.hasMore) break;
    page++;
  }
  assert.equal(page, 3);
  assert.deepEqual(stitched, all);
});

test("rotation is stable for a seed and changes with it", () => {
  const items = ["l1", "l2", "l3", "l4", "l5", "l6"].map((id) => ({ id }));
  const a = rotateSponsors(items, "2026-09-16:nyc").map((x) => x.id);
  assert.deepEqual(rotateSponsors(items, "2026-09-16:nyc").map((x) => x.id), a);
  assert.deepEqual([...a].sort(), ["l1", "l2", "l3", "l4", "l5", "l6"]);
  const days = new Set(["01", "02", "03", "04", "05", "06", "07"].map((d) => rotateSponsors(items, `2026-09-${d}:nyc`)[0].id));
  assert.ok(days.size > 1, "the first slot should change across days");
});

test("the rotation seed is per day and per city, with 'all' when no city is chosen", () => {
  const day = new Date("2026-09-16T23:59:00Z");
  assert.equal(sponsorSeed("nyc", day), "2026-09-16:nyc");
  assert.equal(sponsorSeed("", day), "2026-09-16:all");
  assert.equal(sponsorSeed(undefined, day), "2026-09-16:all");
  assert.equal(sponsorSeed(null, new Date("2026-09-17T00:00:00Z")), "2026-09-17:all");
});
