/**
 * Recovery codes: ten single-use codes shown once when two-factor is set up.
 * Format "xxxxx-xxxxx" in an alphabet without look-alikes (no 0/o, 1/l/i).
 */
import { createHash, randomBytes } from "crypto";

const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
export const RECOVERY_COUNT = 10;

export function newRecoveryCode() {
  const bytes = randomBytes(10);
  let s = "";
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return `${s.slice(0, 5)}-${s.slice(5)}`;
}

export function newRecoveryCodes(n = RECOVERY_COUNT) {
  const set = new Set<string>();
  while (set.size < n) set.add(newRecoveryCode());
  return [...set];
}

/** Lower case, separators removed: what gets hashed. */
export function normaliseRecovery(code: string) {
  return String(code || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function looksLikeRecovery(code: string) {
  const n = normaliseRecovery(code);
  return n.length === 10 && [...n].every((c) => ALPHABET.includes(c));
}

export function hashRecovery(code: string) {
  return createHash("sha256").update(`rentleaks:recovery:${normaliseRecovery(code)}`).digest("hex");
}
