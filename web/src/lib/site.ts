export function catalogOrigin() {
  return (
    process.env.NEXT_PUBLIC_CATALOG_ORIGIN ||
    process.env.CATALOG_ORIGIN ||
    "http://localhost:8765"
  );
}

export function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3100";
}

export function typeLabel(type: string) {
  const labels: Record<string, string> = {
    room: "Room",
    coliving: "Co-living",
    furnished: "Furnished",
    "short-term": "1-month+",
    "lease-break": "Lease-break",
  };
  return labels[type] || type;
}

export function money(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

/**
 * The same number in the market's own currency. `money()` is USD-only, which
 * is right for the cross-market comparisons that run on allInUsd and wrong
 * everywhere else — a €900 room rendered as "$900" is not a rounding problem,
 * it is a different price.
 */
export function fmtMoney(n: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Math.round(n) || 0);
  } catch {
    return `${Math.round(n) || 0} ${currency}`;
  }
}

export function formatDate(iso: string) {
  if (!iso) return "Flexible";
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function listingSpecs(listing: {
  housingType: string;
  beds: number;
  baths: number;
  sqft: number;
}) {
  if (listing.housingType === "room" || listing.housingType === "coliving") {
    return `${listing.baths >= 1 ? "Private bath" : "Shared bath"} · ${listing.sqft} sqft`;
  }
  return `${listing.beds} bed · ${listing.baths} bath · ${listing.sqft} sqft`;
}

export function remainingMonths(title: string, housingType: string, minStayMonths: number) {
  if (housingType !== "lease-break") return null;
  const match = title.match(/(\d+)-month/);
  if (match) return Number(match[1]);
  return minStayMonths || null;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function safePath(path: string, fallback = "/") {
  if (path.startsWith("/") && !path.startsWith("//")) return path;
  return fallback;
}
