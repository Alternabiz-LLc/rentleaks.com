import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { json, preflight, serializeListing, num, bool, MAX_PAGE_SIZE } from "@/lib/api";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export function OPTIONS(req: NextRequest) {
  return preflight(req);
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;

  const where: Prisma.ListingWhereInput = {};
  const and: Prisma.ListingWhereInput[] = [];

  const city = p.get("city");
  if (city) where.cityId = city;

  const type = p.get("type");
  if (type) where.housingType = type;

  const operator = p.get("operator");
  if (operator) where.operator = { is: { slug: operator } };

  // Free-text across the fields the client-side search covers.
  const q = (p.get("q") || "").trim();
  if (q) {
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { neighborhood: { contains: q, mode: "insensitive" } },
        { address: { contains: q, mode: "insensitive" } },
        { city: { is: { name: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }

  const min = num(p.get("min"));
  const max = num(p.get("max"));
  // min/max arrive already converted to USD by the client, because listings
  // live in many currencies and allIn is not comparable across them.
  if (min != null || max != null) {
    where.allInUsd = {
      ...(min != null ? { gte: min } : {}),
      ...(max != null ? { lte: max } : {}),
    };
  }

  const beds = num(p.get("beds"));
  if (beds != null) where.beds = { gte: beds };

  // "stay" is the longest commitment the renter will make, so a listing
  // qualifies when its minimum stay fits inside that window.
  const stay = num(p.get("stay"));
  if (stay != null) where.minStayMonths = { lte: stay };

  const moveIn = p.get("moveIn");
  if (moveIn) where.availableFrom = { lte: moveIn };

  if (bool(p.get("furnished"))) where.furnishedLevel = "fully";
  if (bool(p.get("bath"))) where.privateBath = true;
  if (bool(p.get("work"))) where.workplaceReady = true;
  if (bool(p.get("nofee"))) where.noFee = true;
  if (bool(p.get("utils"))) where.utilitiesIncl = true;
  if (bool(p.get("verified"))) where.verified = true;
  if (bool(p.get("featured"))) where.featured = true;
  if (bool(p.get("pets"))) and.push({ NOT: { petsPolicy: "none" } });

  if (and.length) where.AND = and;

  const orderBy = sortToOrderBy(p.get("sort"));

  const page = Math.max(1, num(p.get("page")) ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, num(p.get("pageSize")) ?? 24));

  try {
    const [total, rows] = await Promise.all([
      prisma.listing.count({ where }),
      prisma.listing.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { city: true, operator: true },
      }),
    ]);

    return json(req, {
      items: rows.map(serializeListing),
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    });
  } catch (err) {
    // A failure here must not blank the site — the client falls back to its
    // bundled catalog when the API is unavailable.
    console.error("[api/listings]", err);
    return json(req, { error: "listings_unavailable", items: [], total: 0 }, { status: 503, maxAge: 0 });
  }
}

function sortToOrderBy(sort: string | null): Prisma.ListingOrderByWithRelationInput[] {
  switch (sort) {
    case "price-asc":
      return [{ allInUsd: "asc" }, { id: "asc" }];
    case "price-desc":
      return [{ allInUsd: "desc" }, { id: "asc" }];
    case "move-in":
      return [{ availableFrom: "asc" }, { id: "asc" }];
    default:
      // "newest" — and the fallback for client-only sorts like Stay DNA,
      // which re-ranks in the browser after fetching.
      return [{ featured: "desc" }, { postedAt: "desc" }, { id: "asc" }];
  }
}
