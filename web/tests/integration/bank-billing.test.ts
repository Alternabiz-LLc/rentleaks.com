import assert from "node:assert/strict";
import { test } from "node:test";
import { db } from "../../src/lib/prisma";
import { POST } from "../../src/app/api/chargebee-webhooks/route";
import { liveListingWhere } from "../../src/lib/billing";
import type { ProviderEvent } from "../../src/lib/chargebee/state";

const dbUrl = new URL(process.env.DATABASE_URL!);
if (!["localhost", "127.0.0.1", "[::1]"].includes(dbUrl.hostname) || !/^\/rentleaks_security_test_[a-f0-9]+$/.test(dbUrl.pathname)) throw new Error("Refusing non-isolated database.");

test("bank webhook authenticates provider evidence, persists replay guards and controls public access", async () => {
  const prisma = db(), originalFetch = globalThis.fetch;
  const env = process.env as Record<string, string | undefined>;
  const values = { CHARGEBEE_BANK_ENABLED: "true", CHARGEBEE_SITE: "isolated-test", CHARGEBEE_API_KEY: "never-sent-test-key", CHARGEBEE_WEBHOOK_USER: "test", CHARGEBEE_WEBHOOK_PASSWORD: "test-only-secret-with-at-least-32-characters" };
  const saved = Object.fromEntries(Object.keys(values).map((key) => [key, env[key]]));
  Object.assign(env, values);
  const auth = `Basic ${Buffer.from(`test:${values.CHARGEBEE_WEBHOOK_PASSWORD}`).toString("base64")}`;
  const now = Math.floor(Date.now() / 1000);
  let event: ProviderEvent = { id: "created-test", api_version: "v2", event_type: "subscription_created", occurred_at: now, content: { subscription: { id: "provider-test" }, invoice: { id: "invoice-test" } } };
  let version = Date.now(), calls = 0;
  globalThis.fetch = (async (url: string | URL | Request) => {
    calls++;
    const u = new URL(String(url));
    assert.equal(u.hostname, "isolated-test.chargebee.com");
    if (u.pathname.includes("/events/")) return Response.json({ event });
    if (u.pathname.includes("/subscriptions/")) return Response.json({ subscription: { id: "provider-test", customer_id: "customer-test", status: "active", currency_code: "USD", current_term_start: now - 100, current_term_end: now + 86400, resource_version: version, subscription_items: [{ item_price_id: "test-month", unit_price: 4800, quantity: 1 }] } });
    if (u.pathname.endsWith("/invoices")) return Response.json({ list: [{ invoice: { id: "invoice-test", subscription_id: "provider-test", status: "paid", currency_code: "USD", total: 4800, amount_due: 0, date: now - 10, resource_version: version } }] });
    throw new Error("Unexpected provider request");
  }) as typeof fetch;
  const request = (authorized = true) => new Request("http://localhost:3100/api/chargebee-webhooks", { method: "POST", headers: { authorization: authorized ? auth : "Basic forged", "content-type": "application/json" }, body: JSON.stringify({ id: event.id, event_type: "payment_succeeded", content: { subscription: { id: "forged-other" } } }) });
  try {
    const host = await prisma.user.create({ data: { email: "bank-host@example.test", name: "Bank Test", passwordHash: "test-only", role: "host" } });
    await prisma.city.create({ data: { id: "bank-test-city", name: "Test City", state: "NY", rank: 1, lat: 0, lng: 0, walk: 1, transit: 1 } });
    await prisma.listing.create({ data: { id: "bank-test-listing", hostId: host.id, cityId: "bank-test-city", housingType: "apartment", title: "Isolated test listing", address: "Test", neighborhood: "Test", price: 1000, allIn: 1000, deposit: 0, beds: 1, baths: 1, sqft: 500, lat: 0, lng: 0, image: "", description: "Test", minStayMonths: 1, availableFrom: "2026-10-13", furnishedLevel: "none", amenitiesJson: "[]", moderation: "approved", verified: false } });
    await prisma.bankSubscription.create({ data: { id: "bank-row-test", providerId: "provider-test", userId: host.id, listingId: "bank-test-listing", planId: "month", amountCents: 4800, quote: [{ itemPriceId: "test-month", amountCents: 4800, planId: "month" }] } });
    assert.equal((await POST(request(false))).status, 401);
    assert.equal(calls, 0);
    assert.equal((await POST(request())).status, 200);
    assert.equal((await prisma.bankSubscription.findUniqueOrThrow({ where: { id: "bank-row-test" } })).access, "basic", "forged payload must not override retrieved provider event");
    assert.equal(await prisma.listing.count({ where: { AND: [{ id: "bank-test-listing" }, await liveListingWhere()] } }), 0);
    event = { ...event, id: "paid-test", event_type: "payment_succeeded", occurred_at: now + 1 }; version++;
    assert.equal((await POST(request())).status, 200);
    assert.equal(await prisma.listing.count({ where: { AND: [{ id: "bank-test-listing" }, await liveListingWhere()] } }), 1);
    assert.equal((await prisma.listing.findUniqueOrThrow({ where: { id: "bank-test-listing" } })).verified, false);
    const beforeReplay = calls;
    assert.equal((await POST(request())).status, 200);
    assert.equal(calls, beforeReplay, "replayed event must not contact the provider or mutate entitlements");
    event = { ...event, id: "failed-test", event_type: "payment_failed", occurred_at: now + 2 }; version++;
    assert.equal((await POST(request())).status, 200);
    assert.equal(await prisma.listing.count({ where: { AND: [{ id: "bank-test-listing" }, await liveListingWhere()] } }), 0);
    event = { ...event, id: "stale-success-test", event_type: "payment_succeeded", occurred_at: now + 1 };
    assert.equal((await POST(request())).status, 200);
    assert.equal((await prisma.bankSubscription.findUniqueOrThrow({ where: { id: "bank-row-test" } })).access, "read_only");
    event = { ...event, id: "invoice-updated-test", event_type: "invoice_updated", occurred_at: now + 3 }; version++;
    assert.equal((await POST(request())).status, 200);
    assert.equal((await prisma.bankSubscription.findUniqueOrThrow({ where: { id: "bank-row-test" } })).access, "read_only");
    event = { ...event, id: "recovered-test", event_type: "payment_succeeded", occurred_at: now + 4 }; version++;
    assert.equal((await POST(request())).status, 200);
    assert.equal((await prisma.bankSubscription.findUniqueOrThrow({ where: { id: "bank-row-test" } })).access, "active");
    assert.equal(await prisma.bankBillingEvent.count({ where: { providerId: "provider-test" } }), 6);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete env[key]; else env[key] = value; }
    await prisma.$disconnect();
  }
});
