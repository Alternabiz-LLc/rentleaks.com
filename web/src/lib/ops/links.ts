/**
 * Signed one-tap links in emails: shortlist clicks and "still available?"
 * answers. HMAC-signed, so nobody can forge a click or pause someone else's
 * listing by editing a URL. Expiring, so an old email stops working.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { appUrl } from "@/lib/site";

function key() {
  return process.env.AUTH_SECRET || process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || "rentleaks-dev-links";
}

function b64(buf: Buffer) {
  return buf.toString("base64url");
}

export function signLink(payload: string[], expiresAt: Date, secret = key()) {
  const body = [...payload, String(Math.floor(expiresAt.getTime() / 1000))].join("|");
  const sig = createHmac("sha256", secret).update(`link:${body}`).digest();
  return `${b64(Buffer.from(body))}.${b64(sig).slice(0, 32)}`;
}

/** The payload parts, or null when forged or expired. */
export function readLink(token: string, now = Date.now(), secret = key()): string[] | null {
  const [head, sig] = String(token || "").split(".");
  if (!head || !sig || head.length > 400) return null;
  let body: string;
  try {
    body = Buffer.from(head, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = b64(createHmac("sha256", secret).update(`link:${body}`).digest()).slice(0, 32);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const parts = body.split("|");
  const exp = Number(parts.pop());
  if (!Number.isFinite(exp) || exp * 1000 < now) return null;
  return parts;
}

const DAY = 86_400_000;

/** A tracked shortlist link: records the open, then shows the home. */
export function shortlistLink(leadId: string, listingId: string) {
  return `${appUrl().replace(/\/$/, "")}/go/s/${signLink(["s", leadId, listingId], new Date(Date.now() + 60 * DAY))}`;
}

export type FreshAnswer = "available" | "rented" | "pause";

/**
 * A host's freshness answer. The link opens a page with one button (a POST),
 * so mail scanners that pre-open links can't answer on the host's behalf.
 */
export function freshnessLink(listingId: string, answer: FreshAnswer) {
  return `${appUrl().replace(/\/$/, "")}/go/f/${signLink(["f", listingId, answer], new Date(Date.now() + 21 * DAY))}`;
}
