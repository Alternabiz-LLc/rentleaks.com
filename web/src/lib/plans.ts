/** Listing plans and prices. No server imports: safe for client components. */
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
  label: "+$35/week",
  blurb: "Sponsored under the homepage hero and in stay results",
  amountCents: 3500,
  days: 7,
  interval: "week" as const,
};

/** Off the listing fee and the sponsored add-on: first listing, second, third. Later listings pay the posted rate. */
export const INTRO_OFF_PERCENT = [20, 15, 12] as const;

const INTRO_WHICH = ["first", "second", "third"] as const;

export function introOffPercent(priorListings: number) {
  const n = Number.isFinite(priorListings) ? Math.max(0, Math.floor(priorListings)) : 0;
  return INTRO_OFF_PERCENT[n] ?? 0;
}

export function introOffLabel(priorListings: number) {
  const percent = introOffPercent(priorListings);
  if (!percent) return null;
  const which = INTRO_WHICH[Math.max(0, Math.floor(priorListings))];
  return which ? `${percent}% off your ${which} listing` : null;
}

export function discountedCents(amountCents: number, percent: number) {
  if (percent <= 0) return amountCents;
  return Math.round((amountCents * (100 - percent)) / 100);
}

export function formatUsd(cents: number) {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

export const FEATURED_MONTHLY = {
  id: "featured-month" as const,
  label: "+$130/month",
  blurb: "Sponsored under the homepage hero and in stay results",
  amountCents: 13000,
  days: 30,
  interval: "month" as const,
};

/** Lease-break listings use their own posted prices; existing room prices stay unchanged. */
export const LEASE_BREAK_WEEKLY = { ...WEEKLY_PLAN, id: "lease-break-week" as const, label: "$15/week", blurb: "Billed weekly", amountCents: 1500 };
export const LEASE_BREAK_MONTHLY = { ...MONTHLY_PLAN, id: "lease-break-month" as const };
export function listingPrice(housingType: string, plan: string) {
  return housingType === "lease-break"
    ? plan === "month" ? LEASE_BREAK_MONTHLY : LEASE_BREAK_WEEKLY
    : plan === "month" ? MONTHLY_PLAN : WEEKLY_PLAN;
}
