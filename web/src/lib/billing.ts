import { prisma } from "./prisma";

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

export const FEATURED_WEEKLY = {
  id: "featured-week" as const,
  label: "+$10/week",
  blurb: "Sponsored under the homepage hero and in stay results",
  amountCents: 1000,
  days: 7,
  interval: "week" as const,
};

export const FEATURED_MONTHLY = {
  id: "featured-month" as const,
  label: "+$35/month",
  blurb: "Sponsored under the homepage hero and in stay results",
  amountCents: 3500,
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

/**
 * What the public is allowed to see.
 *
 * Two gates, and they belong to different people. `moderation` is ours — a
 * listing reaches the catalogue when a human has approved it, and a seller
 * cannot get past a decline by toggling their own switches. `status` is the
 * seller's, and a paused listing was served to renters until now, which meant
 * the pause button on the dashboard was decoration.
 *
 * The moderation half is applied only once the column is actually there.
 * A schema change and the code that depends on it land in the same commit but
 * not at the same moment: the dev server recompiles the instant a file is
 * saved, and the migration runs whenever someone gets round to it. In that
 * window every public query throws and the whole site is a stack trace, which
 * is a bad trade for a filter that — before the migration — has nothing to
 * filter, since no row can be unapproved when no row has the column.
 *
 * So: probe once, cache, and say loudly what is missing. This is not a
 * substitute for the migration; it is what stops a pending migration from
 * being an outage.
 */
let moderationReady: boolean | null = null;

async function hasModerationColumn() {
  if (moderationReady !== null) return moderationReady;
  try {
    /* Catches both halves of the problem in one query: a generated client
       that predates the field rejects it here, and a database missing the
       column errors here too. */
    await prisma.listing.findFirst({ where: { moderation: "approved" }, select: { id: true } });
    moderationReady = true;
  } catch {
    moderationReady = false;
    console.warn(
      "[rentleaks] Listing.moderation is not available, so the review gate is inactive and every listing is public.\n" +
        "           Run:  npx prisma migrate deploy && npx prisma generate  (then restart the dev server).",
    );
  }
  return moderationReady;
}

export async function liveListingWhere() {
  const gated = await hasModerationColumn();
  return gated ? { moderation: "approved", status: { not: "paused" } } : { status: { not: "paused" } };
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
