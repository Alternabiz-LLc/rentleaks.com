/**
 * Shared helpers for the public JSON API.
 *
 * The static site (GitHub Pages) and the Next app are different origins, so
 * every response here is CORS-open and cacheable. The serialisers below are
 * the contract: they emit exactly the shape the static site's renderers
 * already expect from data.js, so hydrating from the API needs no changes to
 * any render code.
 */
import type { NextRequest } from "next/server";
import type { City, Listing, Operator } from "@prisma/client";

const ALLOWED = (process.env.API_ALLOWED_ORIGINS ||
  "https://rentleaks.com,https://www.rentleaks.com,https://altech237.github.io,http://localhost:8123,http://localhost:8080,http://localhost:8765")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  // Echo the origin when it is allow-listed; fall back to the canonical site.
  const allow = ALLOWED.includes(origin) ? origin : ALLOWED[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function json(req: NextRequest, body: unknown, init: { status?: number; maxAge?: number } = {}) {
  const { status = 200, maxAge = 60 } = init;
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${maxAge}, stale-while-revalidate=300`,
      ...corsHeaders(req),
    },
  });
}

export function preflight(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

/* ------------------------------------------------------------------ */
/* Serialisers — DB row -> the shape data.js produces                   */
/* ------------------------------------------------------------------ */

type Detail = Record<string, unknown>;

/** A listing row with its city joined in, as every route below queries it. */
export type ListingRow = Listing & { city?: City | null; operator?: Operator | null };

export function serializeListing(l: ListingRow) {
  const d = ((l.detail as unknown) as Detail) || {};
  const city = (l.city || {}) as Partial<City>;
  return {
    id: l.id,
    type: "rent",
    housingType: l.housingType,
    title: l.title,
    address: l.address,
    neighborhood: l.neighborhood,
    cityId: l.cityId,
    cityName: city.name ?? d.cityName ?? "",
    state: city.state ?? d.state ?? "",
    country: city.country ?? "US",
    countryName: city.countryName ?? "United States",
    price: l.price,
    priceSuffix: (d.priceSuffix as string) ?? "/mo",
    fees: d.fees ?? {},
    allIn: l.allIn,
    currency: l.currency,
    allInUsd: l.allInUsd,
    deposit: l.deposit,
    lastMonth: (d.lastMonth as number) ?? 0,
    beds: l.beds,
    baths: l.baths,
    sqft: l.sqft,
    lat: l.lat,
    lng: l.lng,
    specs: (d.specs as string) ?? "",
    privateBath: l.privateBath,
    roommates: (d.roommates as number) ?? 0,
    housemates: d.housemates ?? [],
    furnishedLevel: l.furnishedLevel,
    furniture: d.furniture ?? [],
    minStayMonths: l.minStayMonths,
    maxStayMonths: l.maxStayMonths,
    availableFrom: l.availableFrom,
    leaseEnd: l.leaseEnd,
    remainingMonths: l.remainingMonths,
    takeoverType: l.takeoverType,
    utilitiesIncluded: d.utilitiesIncluded ?? (l.utilitiesIncl ? ["utilities"] : []),
    amenities: safeParse(l.amenitiesJson, []),
    workplaceReady: l.workplaceReady,
    pets: l.petsPolicy,
    verified: l.verified,
    noFee: l.noFee,
    scamShield: l.scamShield,
    image: l.image,
    images: d.images ?? [l.image],
    imageAlt: (d.imageAlt as string) ?? l.title,
    videos: d.videos ?? [],
    description: l.description,
    commuteNote: (d.commuteNote as string) ?? "",
    neighborhoodScores: d.neighborhoodScores ?? {},
    host: d.host ?? {},
    building: d.building ?? null,
    operatorId: l.operatorId,
    operatorName: l.operator?.name ?? (d.operatorName as string) ?? null,
    operatorSlug: l.operator?.slug ?? null,
    operatorKind: l.operator?.kind ?? null,
    featured: l.featured,
    postedAt: l.postedAt instanceof Date ? l.postedAt.toISOString() : l.postedAt,
    path: (d.path as string) ?? null,
    cityPath: (d.cityPath as string) ?? null,
  };
}

export function serializeCity(c: City) {
  return {
    id: c.id,
    name: c.name,
    state: c.state,
    rank: c.rank,
    featured: c.featured,
    walk: c.walk,
    transit: c.transit,
    avgRoom: c.avgRoom,
    avgFurnished: c.avgFurnished,
    currency: c.currency,
    neighborhoods: (c.neighborhoods as unknown) ?? [],
    country: c.country,
    countryName: c.countryName,
    group: c.group,
    slug: c.slug,
    lat: c.lat,
    lng: c.lng,
  };
}

function safeParse<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string") return (raw as T) ?? fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/* ------------------------------------------------------------------ */
/* Query parsing — mirrors the browse page's filter state               */
/* ------------------------------------------------------------------ */

export function num(v: string | null): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function bool(v: string | null): boolean {
  return v === "1" || v === "true" || v === "yes";
}

export const MAX_PAGE_SIZE = 100;
