import { Prisma } from "@prisma/client";
import { chargebeeConfig, chargebeeRequest, webhookAuthorized, type BankQuote } from "@/lib/chargebee/client";
import { bankAccess, type ProviderEvent, type ProviderInvoice, type ProviderSubscription } from "@/lib/chargebee/state";
import { prisma } from "@/lib/prisma";
import { handle, HttpError, ok, readJson, str } from "@/lib/v1/http";

export const dynamic = "force-dynamic";
export const POST = handle(async (req: Request) => {
  if (!chargebeeConfig() || !process.env.CHARGEBEE_WEBHOOK_USER || (process.env.CHARGEBEE_WEBHOOK_PASSWORD?.length ?? 0) < 32) throw new HttpError(503, "billing_unavailable", "Webhook is not configured.");
  if (!webhookAuthorized(req.headers.get("authorization"))) throw new HttpError(401, "unauthorized", "Invalid webhook authentication.");
  const body = await readJson(req), id = str(body.id, 41);
  if (!/^[A-Za-z0-9_.-]{1,40}$/.test(id)) throw new HttpError(400, "bad_event", "Missing event identifier.");
  if (await prisma.bankBillingEvent.findUnique({ where: { id } })) return ok({ received: true });
  // Authenticate the event against Chargebee, not merely against caller-supplied JSON.
  const { event } = await chargebeeRequest<{ event: ProviderEvent }>(`/events/${encodeURIComponent(id)}`);
  if (!event || event.id !== id || event.api_version !== "v2" || !Number.isSafeInteger(event.occurred_at)) throw new HttpError(400, "bad_event", "Invalid provider event.");
  let providerId = event.content.subscription?.id || event.content.invoice?.subscription_id || event.content.transaction?.subscription_id;
  if (!providerId && event.content.transaction?.linked_invoices?.[0]?.invoice_id) {
    const linked = await chargebeeRequest<{ invoice: ProviderInvoice }>(`/invoices/${encodeURIComponent(event.content.transaction.linked_invoices[0].invoice_id)}`);
    providerId = linked.invoice.subscription_id;
  }
  if (!providerId) return ok({ received: true });
  const row = await prisma.bankSubscription.findUnique({ where: { providerId } });
  if (!row) return ok({ received: true });
  const [{ subscription }, invoices] = await Promise.all([
    chargebeeRequest<{ subscription: ProviderSubscription }>(`/subscriptions/${encodeURIComponent(providerId)}`),
    chargebeeRequest<{ list: Array<{ invoice: ProviderInvoice }> }>(`/invoices?${new URLSearchParams({ "subscription_id[is]": providerId, "sort_by[desc]": "date", limit: "1" })}`),
  ]);
  if (subscription.id !== providerId || (row.customerId && subscription.customer_id !== row.customerId)) throw new HttpError(409, "billing_mismatch", "Provider subscription does not match this account.");
  const invoice = invoices.list?.[0]?.invoice ?? null;
  const versions = [subscription.resource_version, invoice?.resource_version ?? 0];
  if (versions.some((v) => !Number.isSafeInteger(v) || v < 0)) throw new HttpError(502, "bad_snapshot", "Invalid billing snapshot.");
  const version = BigInt(Math.max(...versions));
  const state = bankAccess(subscription, invoice, row.quote as BankQuote, event, row.lastEventAt, new Date(), row);
  const occurredAt = new Date(event.occurred_at * 1000);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.bankBillingEvent.create({ data: { id, type: event.event_type, providerId: providerId!, occurredAt } });
      if (version < row.snapshotVersion || (version === row.snapshotVersion && row.lastEventAt && occurredAt < row.lastEventAt)) return;
      await tx.bankSubscription.update({ where: { id: row.id, updatedAt: row.updatedAt }, data: { ...state, customerId: subscription.customer_id, invoiceId: invoice?.id ?? null, snapshotVersion: version, lastEventAt: row.lastEventAt && row.lastEventAt > occurredAt ? row.lastEventAt : occurredAt } });
      // Payment changes cannot approve a listing or change its verification status.
      if (state.access === "active") await tx.listing.update({ where: { id: row.listingId, hostId: row.userId }, data: { plan: row.planId, sponsored: row.sponsored, featured: row.sponsored } });
      else await tx.listing.update({ where: { id: row.listingId, hostId: row.userId }, data: { sponsored: false, featured: false } });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && await prisma.bankBillingEvent.findUnique({ where: { id } })) return ok({ received: true });
    throw error;
  }
  return ok({ received: true });
});
