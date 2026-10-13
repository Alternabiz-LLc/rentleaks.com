import assert from "node:assert/strict";
import { test } from "node:test";
import { bankQuote, chargebeeConfig, checkoutForm, safeHostedUrl, webhookAuthorized } from "../src/lib/chargebee/client";
import { bankAccess, type ProviderEvent, type ProviderInvoice, type ProviderSubscription } from "../src/lib/chargebee/state";
import { hostCheckoutLines } from "../src/lib/checkout";

const quote = [{ itemPriceId: "test-month", amountCents: 4800, planId: "month" }];
const now = new Date("2026-10-13T00:00:00Z");
const sub: ProviderSubscription = { id: "sub-test", customer_id: "customer-test", status: "active", currency_code: "USD", current_term_start: now.getTime() / 1000 - 1000, current_term_end: now.getTime() / 1000 + 1000, resource_version: 1, subscription_items: [{ item_price_id: "test-month", quantity: 1, unit_price: 4800 }] };
const invoice: ProviderInvoice = { id: "invoice-test", subscription_id: sub.id, status: "paid", currency_code: "USD", total: 4800, amount_due: 0, date: now.getTime() / 1000 - 900, resource_version: 1 };
const event = (type: string, seconds = now.getTime() / 1000): ProviderEvent => ({ id: "event-test", api_version: "v2", event_type: type, occurred_at: seconds, content: { subscription: { id: sub.id }, invoice: { id: invoice.id } } });

test("bank checkout uses existing discounted app prices and server-controlled recurring items", () => {
  const lines = hostCheckoutLines({ housingType: "apartment", plan: "month", sponsored: true, priorListings: 0 });
  const mapped = bankQuote(lines, { CHARGEBEE_PRICE_LISTING_MONTH: "test-month", CHARGEBEE_PRICE_SPONSORED_MONTH: "test-sponsored" });
  assert.deepEqual(mapped.map((l) => l.amountCents), [4800, 10400]);
  const form = checkoutForm({ id: "sub-test", email: "test@example.test", quote: mapped, origin: "https://app.rentleaks.com" });
  assert.equal(form.get("subscription_items[unit_price][0]"), "4800");
  assert.equal(form.get("subscription_items[unit_price][1]"), "10400");
  assert.equal(form.get("embed"), "false");
  assert.equal(form.get("layout"), "full_page");
  assert.throws(() => bankQuote(lines, {}), /not configured/);
});

test("provider URL and webhook authentication cannot be redirected or spoofed", () => {
  assert.equal(chargebeeConfig({ CHARGEBEE_SITE: "test", CHARGEBEE_API_KEY: "key" }), null);
  assert.equal(chargebeeConfig({ CHARGEBEE_BANK_ENABLED: "true", CHARGEBEE_SITE: "evil.test/path", CHARGEBEE_API_KEY: "key" }), null);
  assert.throws(() => safeHostedUrl("https://test.chargebee.com.evil.test/checkout", "test"));
  assert.throws(() => safeHostedUrl("http://test.chargebee.com/checkout", "test"));
  const env = { CHARGEBEE_WEBHOOK_USER: "webhook", CHARGEBEE_WEBHOOK_PASSWORD: "test-only-password-32-characters-long" };
  assert.equal(webhookAuthorized(`Basic ${Buffer.from(`webhook:${env.CHARGEBEE_WEBHOOK_PASSWORD}`).toString("base64")}`, env), true);
  assert.equal(webhookAuthorized("Basic forged", env), false);
});

test("bank entitlements wait for payment, fail closed and cannot be revived by stale evidence", () => {
  assert.equal(bankAccess(sub, invoice, quote, event("subscription_created"), null, now).access, "basic");
  assert.equal(bankAccess(sub, invoice, quote, event("payment_succeeded"), null, now).access, "active");
  assert.equal(bankAccess(sub, { ...invoice, status: "payment_due" }, quote, event("payment_initiated"), null, now).access, "basic");
  assert.equal(bankAccess(sub, invoice, quote, event("payment_failed"), null, now).access, "read_only");
  assert.equal(bankAccess(sub, invoice, quote, event("payment_refunded"), null, now).access, "read_only");
  const previous = { access: "read_only", invoiceId: invoice.id };
  assert.equal(bankAccess(sub, invoice, quote, event("invoice_updated"), now, now, previous).access, "read_only");
  assert.equal(bankAccess(sub, invoice, quote, event("payment_succeeded", now.getTime() / 1000 - 1), now, now, previous).access, "read_only");
  assert.equal(bankAccess(sub, invoice, quote, event("payment_succeeded", now.getTime() / 1000 + 1), now, now, previous).access, "active");
  for (const bad of [{ ...invoice, currency_code: "EUR" }, { ...invoice, total: 1 }, { ...invoice, amount_due: 1 }, { ...invoice, subscription_id: "other" }]) assert.notEqual(bankAccess(sub, bad, quote, event("payment_succeeded"), null, now).access, "active");
  assert.notEqual(bankAccess({ ...sub, current_term_end: now.getTime() / 1000 - 1 }, invoice, quote, event("payment_succeeded"), null, now).access, "active");
});

test("lease-break bank checkout maps its own weekly and monthly prices", () => {
  const env = { CHARGEBEE_PRICE_LEASE_BREAK_WEEK: "lease-break-weekly-usd", CHARGEBEE_PRICE_LEASE_BREAK_MONTH: "lease-break-monthly-usd" };
  for (const [plan, id, amount] of [["week", "lease-break-weekly-usd", 1500], ["month", "lease-break-monthly-usd", 6000]] as const) {
    const lines = hostCheckoutLines({ housingType: "lease-break", plan, sponsored: false, priorListings: 0 });
    const mapped = bankQuote(lines, env);
    assert.equal(mapped[0].itemPriceId, id);
    assert.equal(mapped[0].amountCents, amount);
    assert.deepEqual(hostCheckoutLines({ housingType: "lease-break", plan, sponsored: false, trialEndsAt: new Date(Date.now() + 60000) }), []);
  }
});
