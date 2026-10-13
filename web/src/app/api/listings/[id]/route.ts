import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { json, preflight, serializeListing } from "@/lib/api";
import { liveListingWhere } from "@/lib/billing";

export const dynamic = "force-dynamic";

export function OPTIONS(req: NextRequest) {
  return preflight(req);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const live = await liveListingWhere();
    const listing = await prisma.listing.findFirst({
      where: { AND: [{ id }, live] },
      include: { city: true, operator: true },
    });
    if (!listing) return json(req, { error: "not_found" }, { status: 404, maxAge: 0 });

    const similar = await prisma.listing.findMany({
      where: { AND: [live, { cityId: listing.cityId, housingType: listing.housingType, NOT: { id } }] },
      take: 3,
      include: { city: true, operator: true },
    });

    return json(req, {
      listing: serializeListing(listing),
      similar: similar.map(serializeListing),
    });
  } catch (err) {
    console.error("[api/listings/:id]", err);
    return json(req, { error: "listing_unavailable" }, { status: 503, maxAge: 0 });
  }
}
