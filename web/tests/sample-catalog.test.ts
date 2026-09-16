import assert from "node:assert/strict";
import { test } from "node:test";
import { sampleCatalogIds } from "../src/lib/sample-catalog";

test("sample catalogue IDs come from the site's listings.json", async () => {
  const realFetch = globalThis.fetch;
  let asked = "";
  globalThis.fetch = (async (url: string) => {
    asked = String(url);
    return Response.json({ listings: [{ id: "a1" }, { id: "b2" }, { title: "no id" }] });
  }) as typeof fetch;
  process.env.CATALOG_ORIGIN = "https://rentleaks.com/";
  try {
    const ids = await sampleCatalogIds();
    assert.equal(asked, "https://rentleaks.com/listings.json");
    assert.deepEqual([...ids].sort(), ["a1", "b2"]);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.CATALOG_ORIGIN;
  }
});

test("falls back to the repo copy when the site is unreachable", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("offline");
  }) as typeof fetch;
  try {
    const ids = await sampleCatalogIds();
    assert.ok(ids.size > 100, `expected the repo catalogue, got ${ids.size} ids`);
  } finally {
    globalThis.fetch = realFetch;
  }
});
