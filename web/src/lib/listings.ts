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
  for (const listing of listings) {
    if (picks.length >= limit) break;
    if (!listing.image) continue;
    if (seenCity.has(listing.cityId)) continue;
    if ((seenType[listing.housingType] || 0) >= 2) continue;
    seenCity.add(listing.cityId);
    seenType[listing.housingType] = (seenType[listing.housingType] || 0) + 1;
    picks.push(listing);
  }
  for (const listing of listings) {
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
};

export async function publicListingCount() {
  return prisma.listing.count({ where: liveListingWhere() });
}

export async function publicListings(filters?: ListingFilters) {
  const q = filters?.q?.trim();
  return prisma.listing.findMany({
    where: {
      AND: [
        liveListingWhere(),
        {
          ...(filters?.cityId ? { cityId: filters.cityId } : {}),
          ...(filters?.housingType ? { housingType: filters.housingType } : {}),
          ...(filters?.max ? { allIn: { lte: filters.max } } : {}),
          ...(filters?.stay ? { minStayMonths: { lte: filters.stay } } : {}),
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
    orderBy: { createdAt: "desc" },
  });
}
