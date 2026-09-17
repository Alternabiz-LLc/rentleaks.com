/**
 * Time-based one-time passwords (RFC 6238 over RFC 4226), the codes an
 * authenticator app shows: HMAC-SHA1, 6 digits, 30-second steps.
 *
 * Pure functions on node:crypto, so they run the same in the Worker, in
 * scripts and in tests (tests/security.test.ts checks the RFC vectors).
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const STEP_SECONDS = 30;
export const DIGITS = 6;

export function base32Encode(buf: Uint8Array) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string) {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of clean) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error("Not a base32 secret.");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** A fresh 160-bit secret, base32 — what the QR code carries. */
export function newTotpSecret() {
  return base32Encode(randomBytes(20));
}

export function hotp(secret: Buffer, counter: number, digits = DIGITS) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", secret).update(msg).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const bin = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export function stepAt(ms: number) {
  return Math.floor(ms / 1000 / STEP_SECONDS);
}

export function totpAt(secretB32: string, ms: number) {
  return hotp(base32Decode(secretB32), stepAt(ms));
}

/** Digits only, spaces and dashes removed. */
export function normaliseCode(code: string) {
  return String(code || "").replace(/[\s-]/g, "");
}

/**
 * Checks a code against the current step and one step either side (clocks
 * drift). Returns the matching step, or null. The caller must refuse a step
 * that is not greater than the last one it accepted — that is the replay guard.
 */
export function verifyTotp(secretB32: string, code: string, ms: number, window = 1): number | null {
  const c = normaliseCode(code);
  if (!/^\d{6}$/.test(c)) return null;
  const key = base32Decode(secretB32);
  const now = stepAt(ms);
  const want = Buffer.from(c);
  for (let d = -window; d <= window; d++) {
    const got = Buffer.from(hotp(key, now + d));
    if (timingSafeEqual(got, want)) return now + d;
  }
  return null;
}

/** The otpauth:// link an authenticator app reads from the QR code. */
export function otpauthUrl(secretB32: string, account: string, issuer = "RentLeaks") {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const q = new URLSearchParams({ secret: secretB32, issuer, algorithm: "SHA1", digits: String(DIGITS), period: String(STEP_SECONDS) });
  return `otpauth://totp/${label}?${q.toString()}`;
}

/** "ABCD EFGH …" for typing the secret by hand. */
export function groupSecret(secretB32: string) {
  return secretB32.replace(/(.{4})/g, "$1 ").trim();
}
