import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { json, preflight } from "@/lib/api";
import { liveListingWhere } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { sampleCatalogIds } from "@/lib/sample-catalog";
import { appUrl, typeLabel } from "@/lib/site";

export const dynamic = "force-dynamic";

export function OPTIONS(req: NextRequest) {
  return preflight(req);
}

/**
 * Homes that can actually be viewed or booked from the Facebook landing page:
 * live, approved, and not part of the sample catalogue. Sponsored first, then
 * the newest. If the sample list can't be read, nothing is offered rather than
 * risking an example home being shown as bookable.
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const city = (p.get("city") || "").trim();
  const type = (p.get("type") || "").trim();

  const samples = await sampleCatalogIds().catch(() => null);
  if (!samples) return json(req, { items: [], total: 0 }, { maxAge: 30 });

  const and: Prisma.ListingWhereInput[] = [await liveListingWhere(), { id: { notIn: [...samples] } }];
  if (city) and.push({ cityId: city });
  if (type) and.push({ housingType: type });

  const rows = await prisma.listing.findMany({
    where: { AND: and },
    include: { city: true },
    orderBy: [{ sponsored: "desc" }, { featured: "desc" }, { postedAt: "desc" }],
    take: 24,
  });

  return json(
    req,
    {
      total: rows.length,
      items: rows.map((l) => ({
        id: l.id,
        title: l.title,
        cityId: l.cityId,
        cityName: l.city?.name ?? "",
        neighborhood: l.neighborhood,
        housingType: l.housingType,
        typeLabel: typeLabel(l.housingType),
        allIn: l.allIn,
        currency: l.currency,
        image: l.image,
        beds: l.beds,
        minStayMonths: l.minStayMonths,
        maxStayMonths: l.maxStayMonths,
        availableFrom: l.availableFrom,
        availableUntil: l.availableUntil,
        sponsored: l.sponsored || l.featured,
        url: `${appUrl()}/listings/${l.id}`,
      })),
    },
    { maxAge: 60 },
  );
}
