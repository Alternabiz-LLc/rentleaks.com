import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { canAccess } from "./access";
import { prisma } from "./prisma";
import { seal, unseal } from "./security/seal";
import { currentMailTransport, sendMail, type Mail } from "./v1/mail";

type Store = Pick<Prisma.TransactionClient, "notificationDelivery">;
type Options = { key?: string; audience?: "external" | "network_admin" | "owner_admin"; targetType?: string; targetId?: string };
const MAX_ATTEMPTS = 6;
const LEASE_MS = 2 * 60_000;

/** Immutable encrypted payload and stable provider key, optionally in the caller's transaction. */
export async function enqueueMail(mail: Mail, options: Options = {}, store: Store = prisma) {
  const key = createHash("sha256").update(options.key ?? JSON.stringify(mail)).digest("hex");
  return store.notificationDelivery.upsert({ where: { dedupeKey: key }, update: {}, create: {
    dedupeKey: key, payload: seal(JSON.stringify(mail)), audience: options.audience ?? "external",
    targetType: options.targetType ?? "", targetId: options.targetId ?? "",
  } });
}

export function retryAt(attempts: number, now: Date) {
  return new Date(now.getTime() + Math.min(60, 5 * 2 ** Math.max(0, attempts - 1)) * 60_000);
}

/** Reconcile callbacks after the sender persists its provider id, including early callbacks. */
export async function reconcileEmailReceipts(providerId?: string) {
  const pending = providerId ? [] : await prisma.notificationDelivery.findMany({ where: { status: "accepted", transport: "resend", providerId: { not: null } }, select: { providerId: true }, take: 200 });
  const ids = providerId ? [providerId] : pending.flatMap((p) => p.providerId ? [p.providerId] : []);
  if (!ids.length) return;
  const receipts = await prisma.emailWebhookReceipt.findMany({ where: { providerId: { in: ids } }, orderBy: { occurredAt: "desc" }, take: 1000 });
  for (const event of receipts) {
    const status = event.type === "email.delivered" ? "delivered" : event.type === "email.bounced" ? "bounced" : event.type === "email.complained" ? "complained" : "failed";
    await prisma.notificationDelivery.updateMany({ where: { providerId: event.providerId, transport: "resend", OR: [{ providerEventAt: null }, { providerEventAt: { lt: event.occurredAt } }] }, data: {
      status, providerEventAt: event.occurredAt, ...(status === "delivered" ? { deliveredAt: event.occurredAt } : { lastError: event.type }),
    } });
  }
}

export async function processNotifications(limit = 30, now = new Date()) {
  // A non-idempotent transport might have accepted a message before a worker died.
  // Require operator reconciliation rather than automatically sending it again.
  await prisma.notificationDelivery.updateMany({ where: { status: "processing", leaseUntil: { lt: now }, transport: { not: "resend" } }, data: { status: "needs_review", leaseToken: null, leaseUntil: null, lastError: "delivery_outcome_unknown" } });
  const rows = await prisma.notificationDelivery.findMany({ where: { attempts: { lt: MAX_ATTEMPTS }, OR: [
    { status: "queued", nextAttemptAt: { lte: now } },
    { status: "processing", transport: "resend", leaseUntil: { lt: now } },
  ] }, orderBy: { createdAt: "asc" }, take: Math.min(100, Math.max(1, limit)) });
  const result = { accepted: 0, retrying: 0, failed: 0, cancelled: 0 };
  for (const row of rows) {
    const leaseToken = randomBytes(18).toString("hex");
    let mail: Mail;
    try { mail = JSON.parse(unseal(row.payload)) as Mail; }
    catch { await prisma.notificationDelivery.updateMany({ where: { id: row.id, status: row.status, updatedAt: row.updatedAt }, data: { status: "failed", lastError: "payload_unreadable" } }); result.failed++; continue; }
    const transport = currentMailTransport(mail.purpose);
    if (row.attempts && row.transport && !["blocked", "console", "queued"].includes(row.transport) && row.transport !== transport) {
      // A retry with another provider cannot reuse the original provider's key.
      await prisma.notificationDelivery.updateMany({ where: { id: row.id, status: row.status, updatedAt: row.updatedAt }, data: { status: "needs_review", leaseToken: null, leaseUntil: null, lastError: "transport_changed_after_attempt" } });
      result.failed++; continue;
    }
    const claimed = await prisma.notificationDelivery.updateMany({ where: { id: row.id, status: row.status, updatedAt: row.updatedAt }, data: {
      status: "processing", transport, leaseToken, leaseUntil: new Date(now.getTime() + LEASE_MS), attempts: { increment: 1 },
    } });
    if (!claimed.count) continue;
    if (mail.queueGuard) {
      const signer = await prisma.agreementSigner.findUnique({ where: { id: mail.queueGuard.signerId }, include: { agreement: true } });
      if (!signer || signer.tokenHash !== mail.queueGuard.tokenHash || !["pending", "viewed"].includes(signer.status) || !["sent", "partial"].includes(signer.agreement.status) || signer.agreement.expiresAt < now) {
        await prisma.notificationDelivery.updateMany({ where: { id: row.id, leaseToken }, data: { status: "cancelled", leaseToken: null, leaseUntil: null, lastError: "signing_link_superseded" } }); result.cancelled++; continue;
      }
    }
    if (row.audience === "network_admin" || row.audience === "owner_admin") {
      const user = await prisma.user.findUnique({ where: { email: mail.to.toLowerCase() }, select: { role: true, staffAccess: true, suspendedAt: true, passwordHash: true } });
      if (!user || user.suspendedAt || !user.passwordHash || (row.audience === "owner_admin" ? user.role !== "admin" : !canAccess(user, "network"))) {
        await prisma.notificationDelivery.updateMany({ where: { id: row.id, leaseToken }, data: { status: "cancelled", leaseToken: null, leaseUntil: null, lastError: "recipient_permission_revoked" } }); result.cancelled++; continue;
      }
    }
    const attempts = row.attempts + 1;
    // Resend retains idempotency keys for 24 hours. Never replay an ambiguous send beyond that boundary.
    if (row.attempts && row.transport === "resend" && now.getTime() - row.createdAt.getTime() >= 23 * 60 * 60_000) {
      await prisma.notificationDelivery.updateMany({ where: { id: row.id, leaseToken }, data: { status: "needs_review", leaseToken: null, leaseUntil: null, lastError: "idempotency_window_expired" } }); result.failed++; continue;
    }
    const sent = await sendMail({ ...mail, idempotencyKey: `notification/${row.id}` });
    const status = sent.delivered ? "accepted" : sent.transport === "cloudflare" || sent.transport === "smtp" ? "needs_review" : attempts >= MAX_ATTEMPTS ? "failed" : "queued";
    await prisma.notificationDelivery.updateMany({ where: { id: row.id, leaseToken }, data: {
      status, transport: sent.transport, providerId: sent.providerId ?? null,
      acceptedAt: sent.delivered ? now : null, leaseToken: null, leaseUntil: null,
      nextAttemptAt: retryAt(attempts, now), lastError: sent.delivered ? null : "transport_unavailable",
    } });
    if (sent.delivered) result.accepted++; else if (status === "failed" || status === "needs_review") result.failed++; else result.retrying++;
  }
  // Surface exhausted claims instead of leaving them stuck as processing forever.
  await prisma.notificationDelivery.updateMany({ where: { status: "processing", leaseUntil: { lt: now }, attempts: { gte: MAX_ATTEMPTS } }, data: { status: "needs_review", leaseToken: null, leaseUntil: null, lastError: "attempt_limit_reached" } });
  await reconcileEmailReceipts();
  await prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date(now.getTime() - 60 * 60_000) } } });
  return result;
}
