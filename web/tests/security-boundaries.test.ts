import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { verifyEmailWebhook } from "../src/lib/security/email-webhook";
import { trustedClientIp } from "../src/lib/security/request";
import { HttpError, readJson, readText, rateLimit } from "../src/lib/v1/http";
import { db } from "../src/lib/prisma";

test("mail callbacks reject forged, modified and stale delivery evidence", () => {
  const now = 1_800_000_000_000, raw = '{"type":"email.delivered"}';
  const key = Buffer.alloc(32, 7), secret = `whsec_${key.toString("base64")}`;
  const timestamp = String(now / 1000);
  const signature = createHmac("sha256", key).update(`test-id.${timestamp}.${raw}`).digest("base64");
  const headers = new Headers({ "svix-id": "test-id", "svix-timestamp": timestamp, "svix-signature": `v1,${signature}` });
  assert.equal(verifyEmailWebhook(raw, headers, secret, now), true);
  assert.equal(verifyEmailWebhook(raw + " ", headers, secret, now), false);
  assert.equal(verifyEmailWebhook(raw, headers, secret, now + 301_000), false);
  headers.set("svix-signature", "v1,forged");
  assert.equal(verifyEmailWebhook(raw, headers, secret, now), false);
});

test("untrusted forwarded headers cannot select the rate-limit identity", () => {
  const headers = new Headers({ "x-forwarded-for": "192.0.2.10", "cf-connecting-ip": "192.0.2.20" });
  assert.equal(trustedClientIp(headers, {}, false), null);
  assert.equal(trustedClientIp(headers, { TRUSTED_PROXY_HEADER: "x-forwarded-for" }, false), "192.0.2.10");
  assert.equal(trustedClientIp(headers, {}, true), "192.0.2.20");
  headers.set("cf-connecting-ip", "spoofed");
  assert.equal(trustedClientIp(headers, {}, true), null);
});

test("body limits apply to streamed bytes without Content-Length", async () => {
  const req = new Request("https://example.test", { method: "POST", body: "ééé" });
  await assert.rejects(readText(req, 5), (e: unknown) => e instanceof HttpError && e.status === 413);
  await assert.rejects(readJson(new Request("https://example.test", { method: "POST", body: "[]" })), (e: unknown) => e instanceof HttpError && e.status === 400);
});

test("production refuses requests when distributed protection cannot persist", async () => {
  const env = process.env as Record<string, string | undefined>;
  const saved = { mode: env.NODE_ENV, url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN };
  const client = db(), query = client.$queryRaw;
  env.NODE_ENV = "production";
  delete env.UPSTASH_REDIS_REST_URL; delete env.UPSTASH_REDIS_REST_TOKEN;
  client.$queryRaw = (async () => { throw new Error("offline"); }) as typeof query;
  try { await assert.rejects(rateLimit("security-test", 3, 1000), (e: unknown) => e instanceof HttpError && e.status === 503); }
  finally {
    client.$queryRaw = query;
    for (const [key, value] of Object.entries({ NODE_ENV: saved.mode, UPSTASH_REDIS_REST_URL: saved.url, UPSTASH_REDIS_REST_TOKEN: saved.token })) {
      if (value === undefined) delete env[key]; else env[key] = value;
    }
    await client.$disconnect();
  }
});
