import { prisma } from "@/lib/prisma";
import { HOUSING_TYPES } from "@/lib/catalog";
import { FX_PER_USD, FX_UPDATED } from "@/lib/listing-rules";
import { liveListingWhere } from "@/lib/billing";
import { handle, ok } from "@/lib/v1/http";
import book from "@/lib/rules.json";

export const dynamic = "force-dynamic";

/** App bootstrap: markets, types, FX and the rules version the app bundles. */
export const GET = handle(async () => {
  const live = await liveListingWhere();
  const [cities, counts, total] = await Promise.all([
    prisma.city.findMany({ orderBy: [{ rank: "asc" }, { name: "asc" }] }),
    prisma.listing.groupBy({ by: ["cityId"], where: live, _count: true }),
    prisma.listing.count({ where: live }),
  ]);
  const byCity = new Map(counts.map((c) => [c.cityId, c._count]));
  return ok({
    listings: total,
    rulesVersion: (book as { version?: string }).version ?? null,
    fx: { perUsd: FX_PER_USD, updated: FX_UPDATED },
    housingTypes: [...HOUSING_TYPES, { id: "aparthotel", label: "Aparthotels" }],
    cities: cities.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      state: c.state,
      country: c.country,
      countryName: c.countryName,
      group: c.group,
      currency: c.currency,
      lat: c.lat,
      lng: c.lng,
      featured: c.featured,
      neighborhoods: Array.isArray(c.neighborhoods) ? c.neighborhoods : [],
      listingCount: byCity.get(c.id) ?? 0,
      avgRoom: c.avgRoom,
      avgFurnished: c.avgFurnished,
    })),
  });
});
