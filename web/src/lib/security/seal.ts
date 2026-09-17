/**
 * Sealing small secrets (authenticator keys) before they reach the database.
 *
 * AES-256-GCM with a key derived from AUTH_SECRET. The deploy script creates
 * AUTH_SECRET once (openssl rand); a database dump alone therefore does not
 * give anyone the second factor. The sealed form carries a key id so a missing
 * or changed secret is reported clearly instead of producing garbage.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const DEV_SECRET = "rentleaks-development-only-auth-secret";

function secret(env: NodeJS.ProcessEnv = process.env): string | null {
  const s = env.AUTH_SECRET?.trim();
  if (s && s.length >= 32) return s;
  return env.NODE_ENV === "production" ? null : DEV_SECRET;
}

export function sealingReady(env: NodeJS.ProcessEnv = process.env) {
  return secret(env) !== null;
}

function keyOf(s: string) {
  const key = createHash("sha256").update(`rentleaks:seal:v1:${s}`).digest();
  const kid = createHash("sha256").update(key).digest("hex").slice(0, 8);
  return { key, kid };
}

export class SealError extends Error {}

export function seal(plain: string, env: NodeJS.ProcessEnv = process.env) {
  const s = secret(env);
  if (!s) throw new SealError("AUTH_SECRET is not set on the server. Run the deploy script once more — it creates it.");
  const { key, kid } = keyOf(s);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", kid, iv.toString("base64url"), body.toString("base64url"), tag.toString("base64url")].join(".");
}

export function unseal(sealed: string, env: NodeJS.ProcessEnv = process.env) {
  const s = secret(env);
  if (!s) throw new SealError("AUTH_SECRET is not set on the server.");
  const [v, kid, iv, body, tag] = sealed.split(".");
  if (v !== "v1" || !iv || !body || !tag) throw new SealError("Unreadable two-factor secret.");
  const k = keyOf(s);
  if (k.kid !== kid) throw new SealError("AUTH_SECRET changed since this authenticator was set up. Reset two-factor for this account.");
  const decipher = createDecipheriv("aes-256-gcm", k.key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
}
