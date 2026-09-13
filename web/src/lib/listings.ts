import { liveListingWhere } from "./billing";
import { listingGallery, type GalleryItem } from "./catalog";
import { prisma } from "./prisma";

export type { GalleryItem };

export type MapPin = {
  id: string;
  title: string;
  lat: number;
  lng: number;
  allIn: number;
  neighborhood: string;
  cityName: string;
  housingType: string;
  href: string;
  image: string;
};

export type BrowseListing = {
  id: string;
  title: string;
  address: string;
  neighborhood: string;
  allIn: number;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  lat: number;
  lng: number;
  image: string;
  housingType: string;
  availableFrom: string;
  furnishedLevel: string;
  verified: boolean;
  noFee: boolean;
  minStayMonths: number;
  amenities: string[];
  cityId: string;
  cityName: string;
  cityState: string;
  gallery: GalleryItem[];
  featured: boolean;
};

function parseAmenities(raw: string) {
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function toBrowseListing(listing: {
  id: string;
  title: string;
  address: string;
  neighborhood: string;
  allIn: number;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  lat: number;
  lng: number;
  image: string;
  housingType: string;
  availableFrom: string;
  furnishedLevel: string;
  verified: boolean;
  noFee: boolean;
  minStayMonths: number;
  amenitiesJson: string;
  cityId: string;
  city: { name: string; state: string };
  featured?: boolean;
}): BrowseListing {
  return {
    id: listing.id,
    title: listing.title,
    address: listing.address,
    neighborhood: listing.neighborhood,
    allIn: listing.allIn,
    price: listing.price,
    beds: listing.beds,
    baths: listing.baths,
    sqft: listing.sqft,
    lat: listing.lat,
    lng: listing.lng,
    image: listing.image,
    housingType: listing.housingType,
    availableFrom: listing.availableFrom,
    furnishedLevel: listing.furnishedLevel,
    verified: listing.verified,
    noFee: listing.noFee,
    minStayMonths: listing.minStayMonths,
    amenities: parseAmenities(listing.amenitiesJson),
    cityId: listing.cityId,
    cityName: listing.city.name,
    cityState: listing.city.state,
    featured: Boolean(listing.featured),
    gallery: listingGallery({
      id: listing.id,
      image: listing.image,
      title: listing.title,
      neighborhood: listing.neighborhood,
      cityName: listing.city.name,
    }),
  };
}

export function toMapPin(listing: BrowseListing | {
  id: string;
  title: string;
  lat: number;
  lng: number;
  allIn: number;
  neighborhood: string;
  housingType: string;
  image: string;
  city: { name: string };
}): MapPin {
  const cityName = "cityName" in listing ? listing.cityName : listing.city.name;
  return {
    id: listing.id,
    title: listing.title,
    lat: listing.lat,
    lng: listing.lng,
    allIn: listing.allIn,
    neighborhood: listing.neighborhood,
    cityName,
    housingType: listing.housingType,
    href: `/listings/${listing.id}`,
    image: listing.image,
  };
}

export function heroSlidePicks(listings: BrowseListing[], limit = 6) {
  const seenCity = new Set<string>();
  const seenType: Record<string, number> = {};
  const picks: BrowseListing[] = [];
  const editorial = listings.filter((listing) => !listing.featured);
  const pool = editorial.length >= limit ? editorial : listings;
  for (const listing of pool) {
    if (picks.length >= limit) break;
    if (!listing.image) continue;
    if (seenCity.has(listing.cityId)) continue;
    if ((seenType[listing.housingType] || 0) >= 2) continue;
    seenCity.add(listing.cityId);
    seenType[listing.housingType] = (seenType[listing.housingType] || 0) + 1;
    picks.push(listing);
  }
  for (const listing of pool) {
    if (picks.length >= limit) break;
    if (!picks.includes(listing) && listing.image) picks.push(listing);
  }
  return picks.slice(0, limit);
}

export type ListingFilters = {
  cityId?: string;
  housingType?: string;
  q?: string;
  max?: number;
  stay?: number;
  /** ISO dates. The window the renter actually needs. */
  from?: string;
  to?: string;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The stay-window filter — the question this catalogue exists to answer and
 * could not, until now.
 *
 * A mid-term renter does not browse, they arrive with two dates. "Free from
 * the 3rd of March until the end of June" has one correct answer set and every
 * other listing is noise. The columns to answer it have been here since the
 * composer shipped; nothing asked them.
 *
 * Three conditions, and the third is the one people get wrong:
 *   - the home is free by the date they move in,
 *   - it is still free on the date they leave (open-ended counts),
 *   - and their window is at least as long as the minimum stay. A 90-day
 *     minimum is not a match for a 45-day trip however well the dates overlap.
 *
 * Dates are stored as ISO text, so lexicographic comparison is date
 * comparison. That is only true while the format is exactly YYYY-MM-DD, which
 * is why anything else is dropped rather than passed to the database.
 */
export function stayWindowWhere(from?: string, to?: string) {
  const start = from && ISO.test(from) ? from : undefined;
  const end = to && ISO.test(to) ? to : undefined;
  if (!start && !end) return {};

  const clauses: Record<string, unknown>[] = [];
  if (start) clauses.push({ availableFrom: { lte: start } });
  if (end) clauses.push({ OR: [{ availableUntil: null }, { availableUntil: "" }, { availableUntil: { gte: end } }] });

  if (start && end) {
    const days = Math.round(
      (new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / 86_400_000,
    );
    if (days > 0) clauses.push({ minStayMonths: { lte: Math.max(1, Math.floor(days / 30)) } });
  }

  return clauses.length ? { AND: clauses } : {};
}

export async function publicListingCount() {
  return prisma.listing.count({ where: await liveListingWhere() });
}

export async function publicListings(filters?: ListingFilters) {
  const q = filters?.q?.trim();
  return prisma.listing.findMany({
    where: {
      AND: [
        await liveListingWhere(),
        {
          ...(filters?.cityId ? { cityId: filters.cityId } : {}),
          ...(filters?.housingType ? { housingType: filters.housingType } : {}),
          ...(filters?.max ? { allIn: { lte: filters.max } } : {}),
          ...(filters?.stay ? { minStayMonths: { lte: filters.stay } } : {}),
          ...stayWindowWhere(filters?.from, filters?.to),
          ...(q
            ? {
                OR: [
                  { neighborhood: { contains: q, mode: "insensitive" as const } },
                  { title: { contains: q, mode: "insensitive" as const } },
                  { address: { contains: q, mode: "insensitive" as const } },
                ],
              }
            : {}),
        },
      ],
    },
    include: { city: true, host: { select: { id: true, name: true } } },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
  });
}

export function pickDiverseFeatured<T extends { id: string; cityId: string; housingType: string }>(
  rows: T[],
  limit = 16,
) {
  const seenCity = new Set<string>();
  const typeCount: Record<string, number> = {};
  const picks: T[] = [];
  for (const row of rows) {
    if (picks.length >= limit) break;
    if (seenCity.has(row.cityId)) continue;
    if ((typeCount[row.housingType] || 0) >= 4) continue;
    seenCity.add(row.cityId);
    typeCount[row.housingType] = (typeCount[row.housingType] || 0) + 1;
    picks.push(row);
  }
  for (const row of rows) {
    if (picks.length >= limit) break;
    if (!picks.some((item) => item.id === row.id)) picks.push(row);
  }
  return picks;
}

export function sponsoredListings(listings: BrowseListing[], limit = 8) {
  return pickDiverseFeatured(
    listings.filter((listing) => listing.featured),
    limit,
  );
}

export async function markDemoSponsored(limit = 16) {
  const candidates = await prisma.listing.findMany({
    select: { id: true, cityId: true, housingType: true },
    orderBy: [{ verified: "desc" }, { postedAt: "desc" }],
  });
  const ids = pickDiverseFeatured(candidates, limit).map((row) => row.id);
  await prisma.$transaction([
    prisma.listing.updateMany({
      where: ids.length ? { id: { notIn: ids } } : {},
      data: { featured: false },
    }),
    ...(ids.length
      ? [
          prisma.listing.updateMany({
            where: { id: { in: ids } },
            data: { featured: true },
          }),
        ]
      : []),
  ]);
  return ids;
}
