export const WEEKLY_PLAN = {
  id: "week" as const,
  label: "$14/week",
  blurb: "$2/day billed weekly",
  amountCents: 1400,
  days: 7,
  interval: "week" as const,
};

export const MONTHLY_PLAN = {
  id: "month" as const,
  label: "$60/month",
  blurb: "$2/day billed monthly",
  amountCents: 6000,
  days: 30,
  interval: "month" as const,
};

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

export function liveListingWhere() {
  return {};
}

export function isListingLive(listing: {
  housingType: string;
  paidUntil: Date | null;
  pausedAt: Date | null;
}) {
  if (listing.pausedAt) return false;
  if (listing.housingType === "lease-break") return true;
  return Boolean(listing.paidUntil && listing.paidUntil > new Date());
}
