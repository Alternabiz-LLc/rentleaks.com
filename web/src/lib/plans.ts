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
