import assert from "node:assert/strict";
import { test } from "node:test";
import { sha256Hex, signV4 } from "../src/lib/storage/sigv4";

/* AWS's worked example: "Example: PUT Object" in the S3 SigV4 header docs. */
test("SigV4 matches AWS's published PUT Object example", () => {
  const body = "Welcome to Amazon S3.";
  const payloadHash = sha256Hex(body);
  assert.equal(payloadHash, "44ce7dd67c959e0d3524ffac1771dfbba87d2b6b4b4e99e42034a8b803f8b072");
  const { signature, signedHeaders } = signV4({
    method: "PUT",
    host: "examplebucket.s3.amazonaws.com",
    path: "/test$file.text",
    headers: {
      date: "Fri, 24 May 2013 00:00:00 GMT",
      "x-amz-date": "20130524T000000Z",
      "x-amz-storage-class": "REDUCED_REDUNDANCY",
      "x-amz-content-sha256": payloadHash,
    },
    payloadHash,
    region: "us-east-1",
    accessKeyId: "AKIAIOSFODNN7EXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    amzDate: "20130524T000000Z",
  });
  assert.equal(signedHeaders, "date;host;x-amz-content-sha256;x-amz-date;x-amz-storage-class");
  assert.equal(signature, "98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd");
});

test("storeUpload PUTs to the bucket and returns the public URL", async () => {
  const saved = { ...process.env };
  const realFetch = globalThis.fetch;
  Object.assign(process.env, {
    S3_ENDPOINT: "https://acct.r2.cloudflarestorage.com",
    S3_BUCKET: "rentleaks-media",
    S3_ACCESS_KEY_ID: "id",
    S3_SECRET_ACCESS_KEY: "secret",
    S3_PUBLIC_URL: "https://media.rentleaks.com/",
  });
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response("", { status: 200 });
  }) as typeof fetch;
  try {
    const { storeUpload } = await import("../src/lib/storage");
    const url = await storeUpload("user_1", Buffer.from("x"), "image/png", "png");
    assert.match(url, /^https:\/\/media\.rentleaks\.com\/uploads\/user_1\/[a-z0-9]+-[a-f0-9]{12}\.png$/);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /^https:\/\/acct\.r2\.cloudflarestorage\.com\/rentleaks-media\/uploads\/user_1\//);
    const h = calls[0].init.headers as Record<string, string>;
    assert.match(h.authorization, /^AWS4-HMAC-SHA256 Credential=id\/\d{8}\/auto\/s3\/aws4_request, SignedHeaders=cache-control;content-type;host;x-amz-content-sha256;x-amz-date, Signature=[a-f0-9]{64}$/);
    assert.equal(h["content-type"], "image/png");
  } finally {
    globalThis.fetch = realFetch;
    process.env = saved;
  }
});

test("storeUpload refuses on a hosted server without a bucket", async () => {
  const saved = { ...process.env };
  for (const k of Object.keys(process.env)) if (k.startsWith("S3_")) delete process.env[k];
  process.env.VERCEL = "1";
  try {
    const { storeUpload, StorageNotConfigured } = await import("../src/lib/storage");
    await assert.rejects(storeUpload("u", Buffer.from("x"), "image/png", "png"), StorageNotConfigured);
  } finally {
    process.env = saved;
  }
});
