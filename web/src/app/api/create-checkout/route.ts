import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { billableListingCount } from "@/lib/billing";
import { hostCheckoutLines } from "@/lib/checkout";
import { bankQuote, chargebeeConfig, chargebeeRequest, checkoutForm, safeHostedUrl, type BankQuote } from "@/lib/chargebee/client";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/site";
import { handle, HttpError, ok, rateLimit, readJson, str } from "@/lib/v1/http";

export const dynamic = "force-dynamic";
export const POST = handle(async (req: Request) => {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "unauthorized", "Sign in to subscribe.");
  if (req.headers.get("origin") !== new URL(req.url).origin) throw new HttpError(403, "origin", "Open billing from your account to subscribe.");
  const config = chargebeeConfig();
  if (!config) throw new HttpError(503, "billing_unavailable", "Bank billing is not configured.");
  await rateLimit(`bank-checkout:${user.id}`, 5, 10 * 60_000);
  const body = await readJson(req), listingId = str(body.listingId, 100);
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.hostId !== user.id) throw new HttpError(404, "not_found", "Listing not found.");
  const detail = (listing.detail ?? {}) as { pendingSponsored?: boolean };
  const lines = hostCheckoutLines({ housingType: listing.housingType, plan: listing.plan, sponsored: listing.sponsored || detail.pendingSponsored === true, trialEndsAt: user.trialEndsAt, priorListings: await billableListingCount(user.id, listing.id) });
  if (!lines.length) throw new HttpError(409, "no_charge", "This listing does not require payment right now.");
  const quote = bankQuote(lines);
  const row = await prisma.$transaction(async (tx) => {
    const existing = await tx.bankSubscription.findUnique({ where: { listingId } });
    if (existing) {
      const saved = existing.quote as BankQuote;
      const sameQuote = saved.length === quote.length && saved.every((line, i) => line.itemPriceId === quote[i].itemPriceId && line.amountCents === quote[i].amountCents && line.planId === quote[i].planId);
      if (existing.userId !== user.id || existing.status !== "checkout_pending" || !sameQuote) throw new HttpError(409, "subscription_exists", "A bank subscription already exists. Manage it from Billing before changing plans.");
      return existing;
    }
    const id = randomUUID();
    return tx.bankSubscription.create({ data: { id, providerId: `rl_${id}`, userId: user.id, listingId, planId: listing.plan === "month" ? "month" : "week", sponsored: lines.some((l) => l.kind === "sponsored"), quote: quote as Prisma.InputJsonValue, amountCents: quote.reduce((sum, l) => sum + l.amountCents, 0) } });
  }, { isolationLevel: "Serializable" });
  if (row.hostedUrl && row.checkoutExpiresAt && row.checkoutExpiresAt > new Date()) return ok({ url: row.hostedUrl });
  const result = await chargebeeRequest<{ hosted_page: { id: string; url: string; expires_at: number } }>("/hosted_pages/checkout_new_for_items", checkoutForm({ id: row.providerId, email: user.email, quote: row.quote as BankQuote, origin: appUrl() }), `checkout-${row.id}`);
  const hosted = result.hosted_page, url = safeHostedUrl(hosted.url, config.site);
  const expiresAt = new Date(hosted.expires_at * 1000);
  if (!hosted.id || !Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date()) throw new HttpError(502, "checkout_expired", "The checkout session expired. Please contact support to renew it.");
  await prisma.bankSubscription.update({ where: { id: row.id }, data: { hostedPageId: hosted.id, hostedUrl: url, checkoutExpiresAt: expiresAt } });
  return ok({ url });
});
