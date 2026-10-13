import assert from "node:assert/strict";
import { test } from "node:test";
import { db } from "../../src/lib/prisma";
import { applyPartner } from "../../src/lib/network/engine";
import { databaseHit } from "../../src/lib/v1/http";
import type { PartnerInput } from "../../src/lib/network/core";
import { enqueueMail, processNotifications } from "../../src/lib/notifications";
import { NextRequest } from "next/server";
import { POST as contactPost } from "../../src/app/api/contact/route";

const url = new URL(process.env.DATABASE_URL!);
if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || !/^\/rentleaks_security_test_[a-f0-9]+$/.test(url.pathname)) throw new Error("Refusing non-isolated database.");
const input: PartnerInput = { name: "Security Test", email: "first@example.test", phone: "2125550199", brokerage: "Test", licenseType: "pending", licenseNumber: "", licenseState: "", licenseExpires: null, supervisorName: null, supervisorEmail: null, markets: ["Providence"], specialties: ["apartments"], languages: ["English"], bio: "", website: null, capacity: 5 };

test("isolated migrations, atomic intake rollback, optional licences and concurrent counters", async () => {
  const prisma = db();
  try {
    await prisma.$executeRawUnsafe(`CREATE FUNCTION reject_notification_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected queue failure'; END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER reject_notification_test BEFORE INSERT ON "NotificationDelivery" FOR EACH ROW EXECUTE FUNCTION reject_notification_test()`);
    await assert.rejects(applyPartner(input, "isolated-test"));
    assert.equal(await prisma.networkPartner.count(), 0, "queue failure must roll back the application");
    assert.equal(await prisma.agreement.count(), 0);
    await prisma.$executeRawUnsafe(`DROP TRIGGER reject_notification_test ON "NotificationDelivery"`);
    await applyPartner(input, "isolated-test");
    await applyPartner({ ...input, email: "second@example.test" }, "isolated-test");
    assert.equal(await prisma.networkPartner.count(), 2, "blank licences must not collide");
    assert.equal(await prisma.agreement.count(), 0, "licence-free intake must not generate an approval agreement");
    assert.equal(await prisma.notificationDelivery.count(), 2);
    const partner = await prisma.networkPartner.findUniqueOrThrow({ where: { email: input.email } });
    assert.equal(partner.status, "applied");
    assert.equal(partner.verifiedAt, null);
    assert.equal(partner.emailVerifiedAt, null);
    await applyPartner({ ...input, name: "Attempted overwrite" }, "isolated-test");
    assert.equal((await prisma.networkPartner.findUniqueOrThrow({ where: { email: input.email } })).name, input.name);
    const counts = await Promise.all(Array.from({ length: 12 }, () => databaseHit("concurrency-test", 60_000)));
    assert.deepEqual(counts.sort((a, b) => a - b), Array.from({ length: 12 }, (_, i) => i + 1));
    assert.equal((await prisma.notificationDelivery.findFirstOrThrow()).payload.includes(input.email), false);
    await prisma.notificationDelivery.deleteMany();
    const revoked = await enqueueMail({ to: "removed-admin@example.test", subject: "Test", text: "Private application" }, { key: "revoked-admin", audience: "network_admin" });
    const stale = await enqueueMail({ to: "broker@example.test", subject: "Test", text: "Expired invitation", queueGuard: { signerId: "missing-signer", tokenHash: "old-token" } }, { key: "stale-signer" });
    const ambiguous = await enqueueMail({ to: "broker@example.test", subject: "Test", text: "Ambiguous send" }, { key: "ambiguous-send" });
    const changed = await enqueueMail({ to: "broker@example.test", subject: "Test", text: "Changed transport" }, { key: "changed-transport" });
    await prisma.notificationDelivery.update({ where: { id: changed.id }, data: { status: "processing", transport: "resend", attempts: 1, leaseUntil: new Date(Date.now() - 60_000), leaseToken: "expired" } });
    await prisma.notificationDelivery.update({ where: { id: ambiguous.id }, data: { status: "processing", transport: "cloudflare", attempts: 1, leaseUntil: new Date(Date.now() - 60_000), leaseToken: "expired" } });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => { throw new Error("No external dispatch allowed in isolated verification"); }) as typeof fetch;
    try { await Promise.all([processNotifications(), processNotifications()]); }
    finally { globalThis.fetch = originalFetch; }
    assert.equal((await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: revoked.id } })).status, "cancelled");
    assert.equal((await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: stale.id } })).status, "cancelled");
    assert.equal((await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: ambiguous.id } })).status, "needs_review", "ambiguous non-idempotent sends must never automatically replay");
    assert.equal((await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: changed.id } })).status, "needs_review", "an ambiguous Resend send must not replay through another provider");
    const contactRequest = (message: string) => new NextRequest("http://localhost:3100/api/contact", { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost:8079" }, body: JSON.stringify({ name: "Test Contact", email: "contact@example.test", topic: "Partner application", message }) });
    assert.equal((await contactPost(contactRequest("No recipient configured yet."))).status, 503);
    await prisma.user.create({ data: { name: "Isolated owner", email: "owner@example.test", passwordHash: "test-only-non-login-hash", role: "admin" } });
    const contactResult = await contactPost(contactRequest("Contact message must be saved and queued."));
    assert.equal(contactResult.status, 201);
    assert.deepEqual(await contactResult.json(), { ok: true });
    assert.equal(await prisma.notificationDelivery.count({ where: { targetType: "contact", audience: "owner_admin", status: "queued" } }), 1);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER reject_notification_test BEFORE INSERT ON "NotificationDelivery" FOR EACH ROW EXECUTE FUNCTION reject_notification_test()`);
    assert.equal((await contactPost(contactRequest("Injected persistence failure must not show success."))).status, 503);
    assert.equal(await prisma.notificationDelivery.count({ where: { targetType: "contact" } }), 1);
  } finally { await prisma.$disconnect(); }
});
