import assert from "node:assert/strict";
import { test } from "node:test";
import { HttpError, rateLimit } from "../src/lib/v1/http";

test("in-memory limiter allows up to the limit, then 429s", async () => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  const key = `t-${Math.random()}`;
  for (let i = 0; i < 3; i++) await rateLimit(key, 3, 60_000);
  await assert.rejects(rateLimit(key, 3, 60_000), (e: unknown) => e instanceof HttpError && e.status === 429);
});

test("Upstash limiter atomically expires its shared counter and uses a bounded development fallback", async () => {
  const realFetch = globalThis.fetch;
  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
  let count = 0;
  let body = "";
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    body = String(init.body);
    count += 1;
    return Response.json({ result: count });
  }) as typeof fetch;
  try {
    await rateLimit("k", 1, 1000);
    const command = JSON.parse(body);
    assert.equal(command[0], "EVAL");
    assert.match(command[1], /INCR.*PTTL.*PEXPIRE/);
    assert.match(command[3], /^rl:[a-f0-9]{64}$/);
    assert.equal(command[4], "1000");
    await assert.rejects(rateLimit("k", 1, 1000), (e: unknown) => e instanceof HttpError && e.status === 429);
    globalThis.fetch = (async () => new Response("down", { status: 500 })) as typeof fetch;
    await rateLimit("k", 1, 1000); // Development fallback remains limited
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  }
});
