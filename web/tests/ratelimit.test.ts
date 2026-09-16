import assert from "node:assert/strict";
import { test } from "node:test";
import { HttpError, rateLimit } from "../src/lib/v1/http";

test("in-memory limiter allows up to the limit, then 429s", async () => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  const key = `t-${Math.random()}`;
  for (let i = 0; i < 3; i++) await rateLimit(key, 3, 60_000);
  await assert.rejects(rateLimit(key, 3, 60_000), (e: unknown) => e instanceof HttpError && e.status === 429);
});

test("Upstash limiter uses the shared counter and fails open", async () => {
  const realFetch = globalThis.fetch;
  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
  let count = 0;
  let body = "";
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    body = String(init.body);
    count += 1;
    return Response.json([{ result: count }, { result: 1 }]);
  }) as typeof fetch;
  try {
    await rateLimit("k", 1, 1000);
    assert.deepEqual(JSON.parse(body), [["INCR", "rl:k"], ["PEXPIRE", "rl:k", "1000", "NX"]]);
    await assert.rejects(rateLimit("k", 1, 1000), (e: unknown) => e instanceof HttpError && e.status === 429);
    globalThis.fetch = (async () => new Response("down", { status: 500 })) as typeof fetch;
    await rateLimit("k", 1, 1000); // Redis down: allowed
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  }
});
