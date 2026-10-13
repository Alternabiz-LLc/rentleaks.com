import {
  FEATURED_MONTHLY,
  FEATURED_WEEKLY,
  MONTHLY_PLAN,
  WEEKLY_PLAN,
  listingFeeWaived,
  pickBillingPlan,
  type BillingPlanId,
} from "@/lib/billing";
import { discountedCents, introOffPercent, listingPrice } from "@/lib/plans";
import { getStripe, stripeEnabled } from "@/lib/stripe";
import { appUrl } from "@/lib/site";

export type CheckoutLine = {
  planId: string;
  kind: "listing" | "sponsored";
  label: string;
  amountCents: number;
  priceId?: string;
};

export function hostCheckoutLines(input: {
  housingType: string;
  plan: string;
  sponsored: boolean;
  trialEndsAt?: Date | null;
  /** How many billable listings this host already has, not counting the one being charged. */
  priorListings?: number;
}): CheckoutLine[] {
  if (listingFeeWaived({ trialEndsAt: input.trialEndsAt })) return [];

  const planId = pickBillingPlan(input.plan);
  const listing = listingPrice(input.housingType, planId);
  const off = input.housingType === "lease-break" ? 0 : introOffPercent(input.priorListings ?? 0);
  const offNote = off > 0 ? ` (${off}% off)` : "";
  const lines: CheckoutLine[] = [
    {
      planId: listing.id,
      kind: "listing",
      label: `Listing · ${listing.label}${offNote}`,
      amountCents: discountedCents(listing.amountCents, off),
      priceId: off > 0 ? undefined : priceEnv(listing.id),
    },
  ];

  if (input.sponsored) {
    const promo = planId === MONTHLY_PLAN.id ? FEATURED_MONTHLY : FEATURED_WEEKLY;
    lines.push({
      planId: promo.id,
      kind: "sponsored",
      label: `Sponsored · ${promo.label}${offNote}`,
      amountCents: discountedCents(promo.amountCents, off),
      priceId: off > 0 ? undefined : priceEnv(promo.id),
    });
  }

  return lines;
}

function priceEnv(planId: string) {
  switch (planId) {
    case "lease-break-week":
      return process.env.STRIPE_PRICE_LEASE_BREAK_WEEK || undefined;
    case "lease-break-month":
      return process.env.STRIPE_PRICE_LEASE_BREAK_MONTH || undefined;
    case WEEKLY_PLAN.id:
      return process.env.STRIPE_PRICE_LISTING_WEEK || undefined;
    case MONTHLY_PLAN.id:
      return process.env.STRIPE_PRICE_LISTING_MONTH || undefined;
    case FEATURED_WEEKLY.id:
      return process.env.STRIPE_PRICE_SPONSORED_WEEK || undefined;
    case FEATURED_MONTHLY.id:
      return process.env.STRIPE_PRICE_SPONSORED_MONTH || undefined;
    default:
      return undefined;
  }
}

export async function createListingCheckoutSession(input: {
  userId: string;
  email: string;
  listingId: string;
  lines: CheckoutLine[];
}) {
  const stripe = getStripe();
  if (!stripe) return null;
  if (!input.lines.length) return null;

  const origin = appUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: input.email,
    client_reference_id: input.listingId,
    success_url: `${origin}/listings/${input.listingId}?paid=1`,
    cancel_url: `${origin}/account?checkout=cancelled&listing=${input.listingId}`,
    metadata: {
      listingId: input.listingId,
      userId: input.userId,
      plans: input.lines.map((line) => line.planId).join(","),
    },
    line_items: input.lines.map((line) =>
      line.priceId
        ? { price: line.priceId, quantity: 1 }
        : {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: line.amountCents,
              product_data: {
                name: line.label,
                metadata: { rentleaks_plan: line.planId, kind: line.kind },
              },
            },
          },
    ),
  });

  return session;
}

export function billingPlanFromCheckout(planCsv: string | null | undefined): BillingPlanId {
  const ids = String(planCsv || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.includes(MONTHLY_PLAN.id) || ids.includes("lease-break-month") || ids.includes(FEATURED_MONTHLY.id)) return MONTHLY_PLAN.id;
  return WEEKLY_PLAN.id;
}

export function wantsSponsoredFromCheckout(planCsv: string | null | undefined) {
  const ids = String(planCsv || "")
    .split(",")
    .map((s) => s.trim());
  return ids.includes(FEATURED_WEEKLY.id) || ids.includes(FEATURED_MONTHLY.id);
}

export { stripeEnabled };
