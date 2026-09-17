import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ACCESS_KEYS,
  accessKeyForPath,
  accessList,
  canAccess,
  cleanAccess,
  EXPORT_ACCESS,
  FOUNDER_ONLY,
  GRANTABLE,
  PRESETS,
  presetOf,
} from "../src/lib/access";
import { DESK_ACTIONS, DESK_MODULES, groupsFor, moduleByHref } from "../src/lib/admin/nav";
import { safePath } from "../src/lib/site";
import { deviceLabel } from "../src/lib/security/device";
import { hashRecovery, looksLikeRecovery, newRecoveryCodes, normaliseRecovery } from "../src/lib/security/recovery";
import { seal, SealError, sealingReady, unseal } from "../src/lib/security/seal";
import { base32Decode, base32Encode, hotp, newTotpSecret, otpauthUrl, stepAt, totpAt, verifyTotp } from "../src/lib/security/totp";

/* RFC 4226 appendix D / RFC 6238 appendix B (SHA-1, 8 digits trimmed to 6). */
const RFC_KEY = Buffer.from("12345678901234567890");

test("HOTP matches the RFC 4226 test vectors", () => {
  const want = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"];
  want.forEach((code, i) => assert.equal(hotp(RFC_KEY, i), code));
});

test("TOTP matches the RFC 6238 SHA-1 vectors", () => {
  const b32 = base32Encode(RFC_KEY);
  const vectors: Array<[number, string]> = [
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
  ];
  for (const [sec, eight] of vectors) {
    assert.equal(totpAt(b32, sec * 1000), eight.slice(-6), `t=${sec}`);
    assert.equal(hotp(RFC_KEY, stepAt(sec * 1000), 8), eight, `8 digits t=${sec}`);
  }
});

test("base32 round-trips and tolerates spacing", () => {
  const secret = newTotpSecret();
  assert.equal(secret.length, 32);
  assert.deepEqual(base32Decode(secret.replace(/(.{4})/g, "$1 ").toLowerCase()), base32Decode(secret));
  assert.equal(base32Encode(base32Decode(secret)), secret);
  assert.throws(() => base32Decode("not!base32"));
});

test("verifyTotp accepts ±1 step, refuses the rest, and returns the step", () => {
  const b32 = newTotpSecret();
  const now = Date.parse("2026-09-16T15:00:10Z");
  const step = stepAt(now);
  assert.equal(verifyTotp(b32, totpAt(b32, now), now), step);
  assert.equal(verifyTotp(b32, totpAt(b32, now - 30_000), now), step - 1);
  assert.equal(verifyTotp(b32, totpAt(b32, now + 30_000), now), step + 1);
  assert.equal(verifyTotp(b32, totpAt(b32, now - 90_000), now), null);
  const code = totpAt(b32, now);
  assert.equal(verifyTotp(b32, `${code.slice(0, 3)} ${code.slice(3)}`, now), step, "spaces are ignored");
  assert.equal(verifyTotp(b32, "12345", now), null);
  assert.equal(verifyTotp(b32, "abcdef", now), null);
});

test("otpauth link carries issuer, account and parameters", () => {
  const url = new URL(otpauthUrl("JBSWY3DPEHPK3PXP", "founder@rentleaks.com"));
  assert.equal(url.protocol, "otpauth:");
  assert.equal(url.host, "totp");
  assert.equal(decodeURIComponent(url.pathname), "/RentLeaks:founder@rentleaks.com");
  assert.equal(url.searchParams.get("secret"), "JBSWY3DPEHPK3PXP");
  assert.equal(url.searchParams.get("issuer"), "RentLeaks");
  assert.equal(url.searchParams.get("digits"), "6");
  assert.equal(url.searchParams.get("period"), "30");
});

test("sealed secrets round-trip, detect tampering and a changed AUTH_SECRET", () => {
  const env = { NODE_ENV: "production", AUTH_SECRET: "a".repeat(64) } as unknown as NodeJS.ProcessEnv;
  const sealed = seal("JBSWY3DPEHPK3PXP", env);
  assert.ok(!sealed.includes("JBSWY3DPEHPK3PXP"));
  assert.notEqual(seal("JBSWY3DPEHPK3PXP", env), sealed, "a fresh IV every time");
  assert.equal(unseal(sealed, env), "JBSWY3DPEHPK3PXP");
  const parts = sealed.split(".");
  parts[3] = Buffer.from("tampered").toString("base64url");
  assert.throws(() => unseal(parts.join("."), env));
  const other = { NODE_ENV: "production", AUTH_SECRET: "b".repeat(64) } as unknown as NodeJS.ProcessEnv;
  assert.throws(() => unseal(sealed, other), SealError);
});

test("production refuses to seal without a strong AUTH_SECRET; development has a fallback", () => {
  const prod = { NODE_ENV: "production" } as unknown as NodeJS.ProcessEnv;
  assert.equal(sealingReady(prod), false);
  assert.throws(() => seal("x", prod), SealError);
  assert.equal(sealingReady({ NODE_ENV: "production", AUTH_SECRET: "short" } as unknown as NodeJS.ProcessEnv), false);
  const dev = { NODE_ENV: "development" } as unknown as NodeJS.ProcessEnv;
  assert.equal(unseal(seal("x", dev), dev), "x");
});

test("recovery codes: ten unique, readable, hashed case- and dash-insensitively", () => {
  const codes = newRecoveryCodes();
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  for (const c of codes) {
    assert.match(c, /^[2-9a-z]{5}-[2-9a-z]{5}$/);
    assert.doesNotMatch(c, /[01ilo]/);
    assert.ok(looksLikeRecovery(c));
    assert.equal(hashRecovery(c), hashRecovery(c.toUpperCase().replace("-", " ")));
  }
  assert.equal(normaliseRecovery("AbCdE-FgHjK"), "abcdefghjk");
  assert.equal(looksLikeRecovery("123456"), false);
  assert.notEqual(hashRecovery(codes[0]), hashRecovery(codes[1]));
});

test("founder opens everything; staff only what was granted; others nothing", () => {
  const founder = { role: "admin", staffAccess: [] };
  const sales = { role: "staff", staffAccess: PRESETS.sales.access };
  const host = { role: "host", staffAccess: [...ACCESS_KEYS] };
  for (const k of ACCESS_KEYS) {
    assert.equal(canAccess(founder, k), true, k);
    assert.equal(canAccess(host, k), false, k);
  }
  assert.equal(canAccess(sales, "leads"), true);
  assert.equal(canAccess(sales, "listings"), false);
  assert.equal(canAccess(sales, "overview"), true);
  assert.equal(canAccess(null, "overview"), false);
});

test("founder-only areas can never be granted to staff", () => {
  const greedy = { role: "staff", staffAccess: [...ACCESS_KEYS, "anything"] };
  for (const k of FOUNDER_ONLY) assert.equal(canAccess(greedy, k), false, k);
  assert.deepEqual(cleanAccess([...ACCESS_KEYS, "bogus"]), [...GRANTABLE]);
  assert.ok(!GRANTABLE.includes("team") && !GRANTABLE.includes("revenue") && !GRANTABLE.includes("system"));
  assert.deepEqual(accessList(greedy), [...GRANTABLE]);
});

test("cleanAccess always keeps Overview and canonical order; presets round-trip", () => {
  assert.deepEqual(cleanAccess(["crm", "leads"]), ["overview", "leads", "crm"]);
  assert.deepEqual(cleanAccess(null), ["overview"]);
  for (const [key, p] of Object.entries(PRESETS)) assert.equal(presetOf(p.access), key);
  assert.equal(presetOf(["leads"]), null);
});

test("every admin path maps to the right access key", () => {
  assert.equal(accessKeyForPath("/admin"), "overview");
  assert.equal(accessKeyForPath("/admin/"), "overview");
  assert.equal(accessKeyForPath("/admin/crm/abc123"), "crm");
  assert.equal(accessKeyForPath("/admin/campaigns/xyz?tab=1"), "campaigns");
  assert.equal(accessKeyForPath("/admin/team"), "team");
  assert.equal(accessKeyForPath("/admin/security"), null);
  for (const m of DESK_MODULES) assert.equal(accessKeyForPath(m.href), m.key, m.href);
  for (const a of DESK_ACTIONS) {
    if (a.key === "any" || a.href.startsWith("/api/")) continue;
    assert.equal(accessKeyForPath(a.href), a.key, a.href);
  }
  for (const a of DESK_ACTIONS.filter((x) => x.href.startsWith("/api/admin/export/"))) {
    assert.equal(EXPORT_ACCESS[a.href.split("/").pop()!], a.key, a.href);
  }
});

test("the rail shows only granted modules and drops empty groups", () => {
  const groups = groupsFor(["overview", "leads"]);
  assert.deepEqual(
    groups.flatMap((g) => g.modules.map((m) => m.key)),
    ["overview", "leads"],
  );
  assert.equal(groups.length, 1);
  assert.equal(groupsFor(ACCESS_KEYS).flatMap((g) => g.modules).length, DESK_MODULES.length);
  assert.equal(moduleByHref("/admin/security").code, "ME-01");
  assert.equal(moduleByHref("/admin/team").key, "team");
});

test("safePath refuses open redirects", () => {
  assert.equal(safePath("/admin/leads?x=1"), "/admin/leads?x=1");
  assert.equal(safePath("//evil.example"), "/");
  assert.equal(safePath("/\\evil.example"), "/");
  assert.equal(safePath("https://evil.example"), "/");
  assert.equal(safePath("/admin\n/x", "/admin"), "/admin");
});

test("device labels are recognisable", () => {
  assert.equal(deviceLabel("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36"), "Chrome on Mac");
  assert.equal(deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"), "Safari on iPhone");
  assert.equal(deviceLabel("RentLeaks app"), "RentLeaks app on iPhone");
  assert.equal(deviceLabel(null), "Unknown device");
});
