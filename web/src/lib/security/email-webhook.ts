import { createHmac, timingSafeEqual } from "node:crypto";

/** Resend/Svix signatures cover the unmodified body, message id and attempt timestamp. */
export function verifyEmailWebhook(raw: string, headers: Headers, secret: string, now = Date.now()) {
  const id = headers.get("svix-id") ?? "";
  const timestamp = headers.get("svix-timestamp") ?? "";
  if (!id || id.length > 200 || !/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300 || !secret.startsWith("whsec_")) return false;
  const key = Buffer.from(secret.slice(6), "base64");
  if (key.length < 16) return false;
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${raw}`).digest();
  return (headers.get("svix-signature") ?? "").split(" ").some((signature) => {
    const [version, encoded] = signature.split(",");
    if (version !== "v1" || !encoded) return false;
    const received = Buffer.from(encoded, "base64");
    return received.length === expected.length && timingSafeEqual(received, expected);
  });
}
