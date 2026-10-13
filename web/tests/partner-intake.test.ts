import assert from "node:assert/strict";
import { test } from "node:test";
import { db } from "../src/lib/prisma";
import { applyPartner } from "../src/lib/network/engine";
import { unseal } from "../src/lib/security/seal";
import { sendMail } from "../src/lib/v1/mail";
import type { PartnerInput } from "../src/lib/network/core";

const input: PartnerInput = { name: "Test Broker", email: "broker@example.test", phone: "2125550199", brokerage: "Test", licenseType: "broker", licenseNumber: "TEST123", licenseState: "NY", licenseExpires: null, supervisorName: null, supervisorEmail: null, markets: ["New York"], specialties: ["apartments"], languages: ["English"], bio: "", website: null, capacity: 5 };

test("duplicate intake returns no credential and makes no writes or notifications", async () => {
  const client = db();
  const settings = client.appSetting.findMany;
  const user = client.user.findFirst;
  const team = client.user.findMany;
  const transaction = client.$transaction;
  const fetch = globalThis.fetch;
  client.appSetting.findMany = (async () => []) as typeof settings;
  client.user.findFirst = (async () => null) as typeof user;
  client.user.findMany = (async () => []) as typeof team;
  let calls = 0;
  globalThis.fetch = (async () => { throw new Error("No network permitted"); }) as typeof fetch;
  client.$transaction = (async (fn: (tx: unknown) => unknown, options: { isolationLevel: string }) => {
    calls++;
    assert.equal(options.isolationLevel, "Serializable");
    return fn({ networkPartner: { findUnique: async () => ({ id: "existing", status: "applied" }) } });
  }) as typeof transaction;
  try {
    assert.deepEqual(await applyPartner(input, "web"), { signLink: null });
    assert.equal(calls, 1);
    client.$transaction = (async () => { throw new Error("Persistence failed"); }) as typeof transaction;
    await assert.rejects(applyPartner(input, "web"), /Persistence failed/);
  } finally {
    client.appSetting.findMany = settings; client.user.findFirst = user; client.user.findMany = team; client.$transaction = transaction; globalThis.fetch = fetch;
    await client.$disconnect();
  }
});

test("production sendMail refuses a localhost link before contacting a transport", async () => {
  const env = process.env as Record<string, string | undefined>;
  const previous = env.NODE_ENV;
  const fetch = globalThis.fetch;
  env.NODE_ENV = "production";
  globalThis.fetch = (async () => { throw new Error("Transport must not be contacted"); }) as typeof fetch;
  try {
    const result = await sendMail({ to: "broker@example.test", subject: "Test", text: "http://localhost:3100/admin/referrals?tab=partners&partner=test" });
    assert.equal(result.delivered, false);
    assert.match(result.error!, /development URL/);
  } finally {
    if (previous === undefined) delete env.NODE_ENV; else env.NODE_ENV = previous;
    globalThis.fetch = fetch;
  }
});

test("new intake atomically queues encrypted signing and authorized team notifications", async () => {
  const client = db();
  const saved = { settings: client.appSetting.findMany, user: client.user.findFirst, team: client.user.findMany, transaction: client.$transaction, event: client.agreementEvent.create, contact: client.contact.findUnique };
  const env = process.env as Record<string, string | undefined>;
  const previous = Object.fromEntries(["NODE_ENV", "APP_URL", "RESEND_API_KEY", "AUTH_SECRET"].map((key) => [key, env[key]]));
  Object.assign(env, { NODE_ENV: "production", APP_URL: "https://app.rentleaks.com", RESEND_API_KEY: "test-only", AUTH_SECRET: "test-signing-secret-only-32-characters-long" });
  const fetch = globalThis.fetch;
  let linked = false;
  const messages: Array<{ to: string[]; text: string }> = [];
  globalThis.fetch = (async (_url: unknown, options: RequestInit) => {
    assert.equal(linked, true, "notifications must follow persistence");
    void options;
    throw new Error("Intake must not contact a transport");
    return Response.json({ id: "test-delivery" });
  }) as typeof fetch;
  client.appSetting.findMany = (async () => []) as unknown as typeof saved.settings;
  client.user.findFirst = (async () => ({ name: "Test Admin", email: "admin@example.test" })) as unknown as typeof saved.user;
  client.user.findMany = (async () => [{ role: "admin", email: "admin@example.test", staffAccess: [] }, { role: "staff", email: "unauthorized@example.test", staffAccess: [] }]) as unknown as typeof saved.team;
  client.contact.findUnique = (async () => { throw new Error("CRM unavailable"); }) as unknown as typeof saved.contact;
  client.agreementEvent.create = (async () => ({})) as unknown as typeof saved.event;
  client.$transaction = (async (fn: (tx: unknown) => unknown) => fn({
    networkPartner: {
      findUnique: async () => null, findFirst: async () => null,
      create: async () => ({ ...input, id: "test-partner" }),
      update: async ({ data }: { data: { agreementId: string } }) => { assert.equal(data.agreementId, "test-agreement"); linked = true; return { ...input, id: "test-partner" }; },
    },
    agreement: { create: async ({ data }: { data: { title: string; expiresAt: Date; signers: { create: Array<{ role: string; name: string; email: string; tokenHash: string }> } } }) => ({ ...data, id: "test-agreement", signers: data.signers.create.map((s, i) => ({ ...s, id: `test-signer-${i}` })) }) },
    agreementEvent: { create: async () => ({}) },
    notificationDelivery: { upsert: async ({ create }: { create: { payload: string; dedupeKey: string } }) => {
      assert.equal(linked, true);
      assert.ok(!create.payload.includes("broker@example.test"));
      const content = JSON.parse(unseal(create.payload));
      messages.push({ ...content, to: [content.to] });
      return { ...create, id: `notification-${messages.length}` };
    } },
  })) as unknown as typeof saved.transaction;
  try {
    assert.deepEqual(await applyPartner(input, "web"), { signLink: null });
    assert.deepEqual(messages.flatMap((m) => m.to).sort(), ["admin@example.test", "broker@example.test"]);
    assert.ok(messages.some((m) => m.text.includes("https://app.rentleaks.com/admin/referrals?tab=partners&partner=test-partner")));
    assert.ok(messages.some((m) => m.to.includes(input.email) && m.text.includes("https://app.rentleaks.com/sign/")));
    assert.ok(messages.every((m) => !m.text.includes("localhost")));
  } finally {
    client.appSetting.findMany = saved.settings; client.user.findFirst = saved.user; client.user.findMany = saved.team;
    client.$transaction = saved.transaction; client.agreementEvent.create = saved.event; client.contact.findUnique = saved.contact;
    globalThis.fetch = fetch;
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete env[key]; else env[key] = value; }
    await client.$disconnect();
  }
});
