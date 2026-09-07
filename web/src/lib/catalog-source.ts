/**
 * Canonical catalog loader.
 *
 * The repo used to carry two independent catalogs: the root `data.js` that
 * the static site ships, and `buildSeedListings()` in catalog.ts which
 * regenerated a thinner copy of the same IDs. They drifted.
 *
 * This module makes the root `data.js` the single source of truth. It is a
 * browser IIFE that assigns `window.RENTLEAKS_DATA`, so we evaluate it with a
 * stub global and read the result back.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

export type SourceListing = Record<string, any>;
export type SourceCity = Record<string, any>;

export interface Catalog {
  listings: SourceListing[];
  cities: SourceCity[];
  housingTypes: Array<{ id: string; label: string; short: string; href: string; blurb: string }>;
}

export function loadCatalog(repoRoot = join(process.cwd(), "..")): Catalog {
  const code = readFileSync(join(repoRoot, "data.js"), "utf8");
  const sandbox: { window: Record<string, any> } = { window: {} };
  runInNewContext(code, sandbox, { timeout: 15_000 });

  const data = sandbox.window.RENTLEAKS_DATA;
  if (!data?.listings?.length) {
    throw new Error("data.js did not produce RENTLEAKS_DATA.listings");
  }
  return data as Catalog;
}

/** All-in rent, matching the static site's own accessor. */
export function allIn(l: SourceListing): number {
  if (typeof l.allIn === "number") return l.allIn;
  const fees = l.fees || {};
  return (
    Number(l.price || 0) +
    Object.values(fees).reduce((sum: number, v) => sum + Number(v || 0), 0)
  );
}

/** Split a source listing into DB columns + the presentational `detail` blob. */
export function toDbListing(l: SourceListing, hostId: string) {
  return {
    id: l.id,
    cityId: l.cityId,
    hostId,
    housingType: l.housingType,
    title: l.title,
    address: l.address ?? "",
    neighborhood: l.neighborhood ?? "",
    price: Math.round(Number(l.price) || 0),
    allIn: Math.round(allIn(l)),
    deposit: Math.round(Number(l.deposit) || 0),
    beds: Number(l.beds) || 0,
    baths: Number(l.baths) || 0,
    sqft: Number(l.sqft) || 0,
    lat: Number(l.lat) || 0,
    lng: Number(l.lng) || 0,
    image: l.image ?? (l.images?.[0] ?? ""),
    description: l.description ?? "",
    minStayMonths: Number(l.minStayMonths) || 1,
    maxStayMonths: Number(l.maxStayMonths) || 12,
    availableFrom: l.availableFrom ?? "",
    furnishedLevel: l.furnishedLevel ?? "none",
    verified: Boolean(l.verified),
    noFee: Boolean(l.noFee),
    scamShield: l.scamShield !== false,
    featured: Boolean(l.featured),
    privateBath: Boolean(l.privateBath),
    workplaceReady: Boolean(l.workplaceReady),
    petsPolicy: l.pets ?? "none",
    utilitiesIncl:
      Array.isArray(l.utilitiesIncluded)
        ? l.utilitiesIncluded.includes("utilities")
        : Number(l.fees?.utilities ?? 1) === 0,
    remainingMonths: l.remainingMonths ?? null,
    leaseEnd: l.leaseEnd ?? null,
    takeoverType: l.takeoverType ?? null,
    postedAt: l.postedAt ? new Date(l.postedAt) : new Date(),
    amenitiesJson: JSON.stringify(l.amenities ?? []),
    detail: {
      fees: l.fees ?? {},
      lastMonth: l.lastMonth ?? 0,
      priceSuffix: l.priceSuffix ?? "/mo",
      specs: l.specs ?? "",
      roommates: l.roommates ?? 0,
      housemates: l.housemates ?? [],
      furniture: l.furniture ?? [],
      utilitiesIncluded: l.utilitiesIncluded ?? [],
      images: l.images ?? [],
      imageAlt: l.imageAlt ?? "",
      videos: l.videos ?? [],
      commuteNote: l.commuteNote ?? "",
      neighborhoodScores: l.neighborhoodScores ?? {},
      host: l.host ?? {},
      building: l.building ?? null,
      path: l.path ?? null,
      cityPath: l.cityPath ?? null,
    },
  };
}

export function toDbCity(c: SourceCity) {
  return {
    id: c.id,
    name: c.name,
    state: c.state ?? "",
    rank: Number(c.rank) || 999,
    lat: Number(c.lat) || 0,
    lng: Number(c.lng) || 0,
    walk: Number(c.walk) || 0,
    transit: Number(c.transit) || 0,
    featured: Boolean(c.featured),
    avgRoom: Math.round(Number(c.avgRoom) || 0),
    avgFurnished: Math.round(Number(c.avgFurnished) || 0),
    country: c.country ?? "US",
    countryName: c.countryName ?? "United States",
    group: c.group ?? "United States",
    slug: c.slug ?? "",
    neighborhoods: c.neighborhoods ?? [],
  };
}
