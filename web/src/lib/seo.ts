export const SITE = "https://rentleaks.com";
export const OG_IMAGE = `${SITE}/images/og-default.jpg`;

export const DEFAULT_TITLE = "RentLeaks — Rooms, co-living, furnished apartments & lease-breaks";
export const DEFAULT_DESCRIPTION =
  "Find rooms, co-living buildings, furnished apartments, 1-month+ stays, and lease-breaks in the U.S. and major European cities. All-in rent. 30-day minimum.";
export const DEFAULT_KEYWORDS = [
  "rooms for rent",
  "coliving",
  "furnished apartments",
  "short term apartment 1 month",
  "lease break",
  "lease takeover",
  "NYC rooms",
  "London rooms",
  "Paris coliving",
  "flexible housing",
];

export function pageTitle(title?: string) {
  if (!title) return DEFAULT_TITLE;
  if (title.includes("RentLeaks")) return title;
  return `${title} | RentLeaks`;
}

export function absoluteUrl(path = "/") {
  if (path.startsWith("http")) return path;
  return SITE + (path.startsWith("/") ? path : `/${path}`);
}
