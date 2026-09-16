/**
 * Listing shapes shared by server code and client components. No server
 * imports here, so the browser bundle never pulls in the database client.
 */
import type { GalleryItem } from "./catalog";

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
