import { createHash, timingSafeEqual } from "node:crypto";
import { HttpError } from "../v1/http";
import type { CheckoutLine } from "../checkout";

export function chargebeeConfig(env: Record<string, string | undefined> = process.env) {
  const site = env.CHARGEBEE_SITE?.trim(), key = env.CHARGEBEE_API_KEY?.trim();
  if (!site || !/^[a-z0-9][a-z0-9-]{0,49}$/.test(site) || !key || env.CHARGEBEE_BANK_ENABLED !== "true") return null;
  return { site, key, origin: `https://${site}.chargebee.com` };
}

const PRICE_KEYS: Record<string, string> = { "lease-break-week": "CHARGEBEE_PRICE_LEASE_BREAK_WEEK", "lease-break-month": "CHARGEBEE_PRICE_LEASE_BREAK_MONTH", week: "CHARGEBEE_PRICE_LISTING_WEEK", month: "CHARGEBEE_PRICE_LISTING_MONTH", "featured-week": "CHARGEBEE_PRICE_SPONSORED_WEEK", "featured-month": "CHARGEBEE_PRICE_SPONSORED_MONTH" };
export function bankQuote(lines: CheckoutLine[], env: Record<string, string | undefined> = process.env) {
  return lines.map((line) => {
    const itemPriceId = env[PRICE_KEYS[line.planId]]?.trim();
    if (!itemPriceId || !/^[A-Za-z0-9_.-]{1,100}$/.test(itemPriceId)) throw new HttpError(503, "billing_unavailable", "Bank billing for this plan is not configured.");
    return { itemPriceId, amountCents: line.amountCents, planId: line.planId };
  });
}
export type BankQuote = ReturnType<typeof bankQuote>;

export async function chargebeeRequest<T>(path: string, form?: URLSearchParams, idempotencyKey?: string): Promise<T> {
  const config = chargebeeConfig();
  if (!config) throw new HttpError(503, "billing_unavailable", "Bank billing is not configured.");
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Invalid provider path");
  const response = await fetch(`${config.origin}/api/v2${path}`, {
    method: form ? "POST" : "GET", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15_000),
    headers: { Authorization: `Basic ${Buffer.from(`${config.key}:`).toString("base64")}`, ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}), ...(idempotencyKey ? { "chargebee-idempotency-key": idempotencyKey } : {}) },
    ...(form ? { body: form.toString() } : {}),
  });
  if (!response.ok) throw new HttpError(502, "provider_unavailable", "The billing provider could not complete this request. Please retry.");
  return await response.json() as T;
}

export function webhookAuthorized(header: string | null, env: Record<string, string | undefined> = process.env) {
  const username = env.CHARGEBEE_WEBHOOK_USER, password = env.CHARGEBEE_WEBHOOK_PASSWORD;
  if (!username || !password || password.length < 32 || !header?.startsWith("Basic ")) return false;
  const expected = createHash("sha256").update(`Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`).digest();
  const received = createHash("sha256").update(header).digest();
  return timingSafeEqual(expected, received);
}

export function safeHostedUrl(value: string, site: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== `${site}.chargebee.com` || url.username || url.password || url.port) throw new Error("Unexpected billing checkout URL");
  return url.toString();
}

export function checkoutForm(input: { id: string; email: string; quote: BankQuote; origin: string }) {
  const form = new URLSearchParams({ "subscription[id]": input.id, "customer[email]": input.email, layout: "full_page", embed: "false", redirect_url: `${input.origin}/billing?checkout=pending`, cancel_url: `${input.origin}/billing?checkout=cancelled` });
  input.quote.forEach((line, i) => {
    form.set(`subscription_items[item_price_id][${i}]`, line.itemPriceId);
    form.set(`subscription_items[quantity][${i}]`, "1");
    form.set(`subscription_items[unit_price][${i}]`, String(line.amountCents));
  });
  return form;
}
