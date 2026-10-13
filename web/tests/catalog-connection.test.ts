import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

test("public catalog connects to the app API while local preview stays local", async () => {
  const script = await readFile(resolve(process.cwd(), "..", "data-source.js"), "utf8");
  for (const [hostname, expected] of [["rentleaks.com", "https://app.rentleaks.com/api/meta"], ["localhost", "http://localhost:3100/api/meta"], ["127.0.0.1", "http://127.0.0.1:3100/api/meta"]]) {
    const urls: string[] = [];
    const context = {
      window: {}, location: { hostname }, setTimeout, clearTimeout, AbortController,
      document: { querySelector: () => null, querySelectorAll: () => [], dispatchEvent: () => undefined },
      CustomEvent: class { constructor(public type: string, public detail: unknown) {} },
      fetch: async (url: string) => { urls.push(url); return Response.json({ listings: 3, cities: 2 }); },
    };
    runInNewContext(script, context);
    await new Promise<void>((done) => setImmediate(done));
    assert.deepEqual(urls, [expected]);
  }
});
