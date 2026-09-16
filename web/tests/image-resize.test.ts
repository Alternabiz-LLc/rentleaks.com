import assert from "node:assert/strict";
import { test } from "node:test";
import { fitWithin, shrinkPhoto } from "../src/lib/image-resize";

test("fitWithin caps the longest side and keeps the aspect ratio", () => {
  assert.deepEqual(fitWithin(4032, 3024), { width: 1920, height: 1440 });
  assert.deepEqual(fitWithin(3024, 4032), { width: 1440, height: 1920 });
  assert.deepEqual(fitWithin(1200, 800), { width: 1200, height: 800 });
  assert.deepEqual(fitWithin(1920, 1080), { width: 1920, height: 1080 });
  assert.deepEqual(fitWithin(10000, 3), { width: 1920, height: 1 });
});

test("shrinkPhoto leaves files alone outside a browser", async () => {
  const f = new File([new Uint8Array(10)], "a.jpg", { type: "image/jpeg" });
  assert.equal(await shrinkPhoto(f), f);
});
