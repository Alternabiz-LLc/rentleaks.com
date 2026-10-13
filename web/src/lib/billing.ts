import { FEATURED_MONTHLY, FEATURED_WEEKLY, MONTHLY_PLAN, WEEKLY_PLAN } from "./plans";

import { prisma } from "./prisma";

export { FEATURED_MONTHLY, FEATURED_WEEKLY, MONTHLY_PLAN, WEEKLY_PLAN };

export type BillingPlanId = typeof WEEKLY_PLAN.id | typeof MONTHLY_PLAN.id;

export function listingPlan(id: string) {
  switch (id) {
    case "month":
      return MONTHLY_PLAN;
    case "week":
      return WEEKLY_PLAN;
    default: {
      const _exhaustive: never = id as never;
      void _exhaustive;
      return WEEKLY_PLAN;
    }
  }
}

export function pickBillingPlan(id: string): BillingPlanId {
  return id === MONTHLY_PLAN.id ? MONTHLY_PLAN.id : WEEKLY_PLAN.id;
}

export function paidUntilFrom(planId: BillingPlanId, from = new Date()) {
  const plan = listingPlan(planId);
  return new Date(from.getTime() + plan.days * 24 * 60 * 60 * 1000);
}

/** Always require review approval. A missing schema must fail closed, never expose unreviewed rows. */
export async function liveListingWhere() {
  return { moderation: "approved", status: { not: "paused" }, OR: [
    { bankSubscription: { is: null } },
    { bankSubscription: { is: { status: "checkout_pending" } } },
    { bankSubscription: { is: { access: "active", paidThrough: { gt: new Date() } } } },
  ] };
}

export function isListingLive(listing: {
  housingType: string;
  paidUntil: Date | null;
  pausedAt: Date | null;
}) {
  if (listing.pausedAt) return false;
  return Boolean(listing.paidUntil && listing.paidUntil > new Date());
}

/**
 * True while an account's free trial (granted by an invite or by the founder)
 * is running. Any checkout that charges listing fees must skip the charge
 * while this is true.
 */
export function listingFeeWaived(user: { trialEndsAt?: Date | null } | null | undefined, now = new Date()) {
  return Boolean(user?.trialEndsAt && user.trialEndsAt > now);
}

/** Listings that use an intro-pricing slot. Lease-breaks have fixed pricing and do not use an intro-discount slot. */
export function billableListingCount(hostId: string, exceptId?: string) {
  return prisma.listing.count({
    where: {
      hostId,
      housingType: { not: "lease-break" },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
  });
}
