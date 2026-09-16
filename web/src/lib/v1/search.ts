/**
 * The browse query, as one pure builder.
 *
 * Used by GET /api/v1/listings and by the saved-search alert job, so "a new
 * listing matches your saved search" means exactly what the search screen
 * would have shown.
 */
import type { Prisma } from "@prisma/client";
import { stayWindowWhere } from "@/lib/listings";

export const HOUSING = ["room", "coliving", "furnished", "short-term", "aparthotel", "lease-break"] as const;

export type SearchQuery = {
  city?: string;
  type?: string;
  q?: string;
  moveIn?: string;
  moveOut?: string;
  minUsd?: number;
  maxUsd?: number;
  beds?: number;
  furnished?: boolean;
  privateBath?: boolean;
  work?: boolean;
  noFee?: boolean;
  utilities?: boolean;
  verified?: boolean;
  pets?: boolean;
  vouchers?: boolean;
  sort?: string;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function flag(v: string | null) {
  return v === "1" || v === "true";
}

function n(v: string | null) {
  if (v == null || v === "") return undefined;
  const x = Number(v);
  return Number.isFinite(x) ? x : undefined;
}

export function parseSearch(p: URLSearchParams): SearchQuery {
  const type = p.get("type") || undefined;
  return {
    city: p.get("city")?.slice(0, 64) || undefined,
    type: type && (HOUSING as readonly string[]).includes(type) ? type : undefined,
    q: p.get("q")?.trim().slice(0, 80) || undefined,
    moveIn: ISO.test(p.get("moveIn") || "") ? (p.get("moveIn") as string) : undefined,
    moveOut: ISO.test(p.get("moveOut") || "") ? (p.get("moveOut") as string) : undefined,
    minUsd: n(p.get("minUsd")),
    maxUsd: n(p.get("maxUsd")),
    beds: n(p.get("beds")),
    furnished: flag(p.get("furnished")),
    privateBath: flag(p.get("privateBath")),
    work: flag(p.get("work")),
    noFee: flag(p.get("noFee")),
    utilities: flag(p.get("utilities")),
    verified: flag(p.get("verified")),
    pets: flag(p.get("pets")),
    vouchers: flag(p.get("vouchers")),
    sort: p.get("sort") || undefined,
  };
}

/** Normalise an arbitrary stored object back into a SearchQuery. */
export function coerceSearch(raw: unknown): SearchQuery {
  const p = new URLSearchParams();
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (v === undefined || v === null || v === "" || v === false) continue;
      p.set(k, v === true ? "1" : String(v));
    }
  }
  return parseSearch(p);
}

export function searchWhere(s: SearchQuery, live: Prisma.ListingWhereInput): Prisma.ListingWhereInput {
  const and: Prisma.ListingWhereInput[] = [live];

  if (s.city) and.push({ cityId: s.city });
  if (s.type) and.push({ housingType: s.type });
  if (s.q) {
    and.push({
      OR: [
        { title: { contains: s.q, mode: "insensitive" } },
        { neighborhood: { contains: s.q, mode: "insensitive" } },
        { city: { is: { name: { contains: s.q, mode: "insensitive" } } } },
      ],
    });
  }
  if (s.minUsd != null || s.maxUsd != null) {
    and.push({
      allInUsd: {
        ...(s.minUsd != null ? { gte: Math.max(0, Math.round(s.minUsd)) } : {}),
        ...(s.maxUsd != null ? { lte: Math.max(0, Math.round(s.maxUsd)) } : {}),
      },
    });
  }
  if (s.beds != null && s.beds > 0) and.push({ beds: { gte: Math.round(s.beds) } });
  if (s.furnished) and.push({ furnishedLevel: "fully" });
  if (s.privateBath) and.push({ privateBath: true });
  if (s.work) and.push({ workplaceReady: true });
  if (s.noFee) and.push({ noFee: true });
  if (s.utilities) and.push({ utilitiesIncl: true });
  if (s.verified) and.push({ verified: true });
  if (s.pets) and.push({ NOT: { petsPolicy: "none" } });
  if (s.vouchers) and.push({ vouchersAccepted: true });

  const window = stayWindowWhere(s.moveIn, s.moveOut) as Prisma.ListingWhereInput;
  if (Object.keys(window).length) and.push(window);

  /* A stay longer than the host will allow is not a match either — the
     mirror image of the minimum-stay rule. */
  if (s.moveIn && s.moveOut) {
    const days = Math.round((Date.parse(`${s.moveOut}T00:00:00Z`) - Date.parse(`${s.moveIn}T00:00:00Z`)) / 86_400_000);
    if (days > 0) and.push({ maxStayMonths: { gte: Math.max(1, Math.floor(days / 31)) } });
  }

  return { AND: and };
}

/**
 * Order of regular results. Sponsored listings are not sorted in here: the
 * list endpoint places them itself (lib/sponsored-placement), and only when
 * the search resolves to one market (brief §4.6), so a paid New York slot
 * never surfaces in a Berlin search.
 */
export function searchOrder(s: SearchQuery): Prisma.ListingOrderByWithRelationInput[] {
  switch (s.sort) {
    case "price-asc":
      return [{ allInUsd: "asc" }, { id: "asc" }];
    case "price-desc":
      return [{ allInUsd: "desc" }, { id: "asc" }];
    case "move-in":
      return [{ availableFrom: "asc" }, { id: "asc" }];
    default:
      return [{ verified: "desc" }, { postedAt: "desc" }, { id: "asc" }];
  }
}
