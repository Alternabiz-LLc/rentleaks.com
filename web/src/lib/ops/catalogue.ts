/**
 * Catalogue health: compliance (the publication gate re-run over what is
 * stored) and freshness (is this home still available?).
 *
 * The gate already encodes the rules that matter — every fee itemised (NYC's
 * FARE Act), no broker fee charged to the renter, the 30-day floor, deposit
 * caps, fair-housing wording — so the desk shows where stored listings fall
 * short and asks hosts to fix them.
 */
import type { Fee } from "@/lib/listing-rules";
import { checkListing } from "@/lib/listing-rules";
import { mediaFromDetail } from "@/lib/media";

export const CHECK_LABEL: Record<string, string> = {
  basics: "Title, area and address",
  photos: "Four real photos",
  fees: "Every fee in the listing",
  minstay: "Minimum-stay floor",
  window: "End date set",
  deposit: "Deposit within the cap",
  broker: "No broker fee to renter",
  movein: "No move-in / admin fee",
  wording: "Fair-housing wording",
  description: "Useful description",
  registration: "Registration number",
  leaseend: "Lease end date",
  consent: "Landlord consent",
};

export type AuditRow = {
  id: string;
  listedBy: string;
  housingType: string;
  cityId: string;
  city: { slug: string; name: string; state: string; country: string };
  title: string;
  neighborhood: string;
  address: string;
  description: string;
  price: number;
  deposit: number;
  feesJson: string;
  availableFrom: string;
  availableUntil: string | null;
  minStayMonths: number;
  maxStayMonths: number;
  leaseEnd: string | null;
  consentStatus: string | null;
  registrationNumber: string | null;
  image: string;
  detail: unknown;
};

export function parseFeesJson(raw: string): Fee[] {
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? (v as Fee[]) : [];
  } catch {
    return [];
  }
}

export type Audit = { failing: Array<{ id: string; title: string; why: string; blocking: boolean }>; blocking: number; score: number };

/** Runs the gate over a stored listing. Score = share of checks passed. */
export function auditListing(l: AuditRow): Audit {
  const photos = mediaFromDetail(l.detail).photos.length;
  const checks = checkListing({
    role: l.listedBy,
    housingType: l.housingType,
    cityId: l.cityId,
    citySlug: l.city.slug,
    cityName: l.city.name,
    state: l.city.state,
    country: l.city.country,
    title: l.title,
    neighborhood: l.neighborhood,
    address: l.address,
    description: l.description,
    price: l.price,
    deposit: l.deposit,
    fees: parseFeesJson(l.feesJson),
    availableFrom: l.availableFrom,
    availableUntil: l.availableUntil || "",
    minStayMonths: l.minStayMonths,
    maxStayMonths: l.maxStayMonths,
    leaseEnd: l.leaseEnd || undefined,
    consentStatus: l.consentStatus || undefined,
    registrationNumber: l.registrationNumber || "",
    photoCount: photos || (l.image ? 1 : 0),
  } as Parameters<typeof checkListing>[0]);
  const failing = checks.filter((c) => !c.ok).map((c) => ({ id: c.id, title: CHECK_LABEL[c.id] ?? c.title, why: c.why, blocking: c.blocking }));
  return { failing, blocking: failing.filter((f) => f.blocking).length, score: checks.length ? Math.round(((checks.length - failing.length) / checks.length) * 100) : 100 };
}

/* ---- freshness ----------------------------------------------------------- */

export const FRESH_DAYS = 14;
export const STALE_DAYS = 30;
export const ANSWER_DAYS = 7;
const DAY = 86_400_000;

/** fresh → due (2 weeks) → stale (a month); asked → silent (no answer in a week: auto-pause). */
export type Freshness = "fresh" | "due" | "asked" | "stale" | "silent";

export function freshnessOf(l: { postedAt: Date; confirmedAt: Date | null; freshnessAskedAt: Date | null; updatedAt: Date }, now = Date.now()): { state: Freshness; days: number } {
  const last = Math.max(l.confirmedAt?.getTime() ?? 0, l.postedAt.getTime());
  const days = Math.floor((now - last) / DAY);
  const askedAfter = l.freshnessAskedAt && l.freshnessAskedAt.getTime() > last;
  if (askedAfter && now - l.freshnessAskedAt!.getTime() > ANSWER_DAYS * DAY) return { state: "silent", days };
  if (askedAfter) return { state: "asked", days };
  if (days >= STALE_DAYS) return { state: "stale", days };
  if (days >= FRESH_DAYS) return { state: "due", days };
  return { state: "fresh", days };
}
