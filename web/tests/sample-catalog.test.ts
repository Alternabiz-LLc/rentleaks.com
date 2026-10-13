import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
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
    const catalog = JSON.parse(await readFile(resolve(process.cwd(), "..", "listings.json"), "utf8"));
    assert.deepEqual([...ids].sort(), [...new Set(catalog.listings.map((l: { id: string }) => l.id))].sort());
  } finally {
    globalThis.fetch = realFetch;
  }
});
