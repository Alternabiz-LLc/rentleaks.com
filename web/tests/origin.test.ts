import assert from "node:assert/strict";
import { test } from "node:test";
import { applicationOrigin, containsDevelopmentUrl } from "../src/lib/origin";

test("production origins preserve the deployed application host and query routing", () => {
  const origin = applicationOrigin({ NODE_ENV: "production", APP_URL: "https://app.rentleaks.com/", NEXT_PUBLIC_APP_URL: "http://localhost:3100" });
  const url = new URL("/admin/referrals?tab=partners&partner=test-id", origin);
  assert.equal(url.href, "https://app.rentleaks.com/admin/referrals?tab=partners&partner=test-id");
  assert.equal(applicationOrigin({ NODE_ENV: "production" }), "https://app.rentleaks.com");
  assert.equal(applicationOrigin({ NODE_ENV: "development" }), "http://localhost:3100");
});

test("production rejects unsafe and malformed deployment origins", () => {
  for (const APP_URL of ["http://localhost:3100", "http://127.0.0.1:3100", "https://evil.test", "https://rentleaks.com.evil.test", "https://user:pass@app.rentleaks.com", "https://app.rentleaks.com/admin", "https://app.rentleaks.com?x=1", "https://app.rentleaks.com#x", "https://app.rentleaks.com:3100", "file:///tmp", "garbage"]) {
    assert.throws(() => applicationOrigin({ NODE_ENV: "production", APP_URL }), APP_URL);
  }
});

test("production message guard detects text and HTML development URLs", () => {
  for (const url of ["http://localhost:3100/admin", "https://dev.localhost/a", "http://127.0.0.1/a", "http://127.1/a", "http://[::1]:3100/a", "http://0.0.0.0/a", "http://2130706433/a"]) {
    assert.equal(containsDevelopmentUrl(`Open: ${url}`), true, url);
    assert.equal(containsDevelopmentUrl(`<a href="${url}">Open</a>`), true, url);
  }
  assert.equal(containsDevelopmentUrl("https://app.rentleaks.com/admin/referrals?tab=partners&partner=test-id"), false);
});
