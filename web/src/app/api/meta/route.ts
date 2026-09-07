import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { json, preflight } from "@/lib/api";

export const dynamic = "force-dynamic";

export function OPTIONS(req: NextRequest) {
  return preflight(req);
}

/** Powers the homepage Market Pulse panel and the stat rail. */
export async function GET(req: NextRequest) {
  try {
    const [listings, cities, noFee, rooms, breaks] = await Promise.all([
      prisma.listing.count(),
      prisma.city.count(),
      prisma.listing.count({ where: { noFee: true } }),
      prisma.listing.aggregate({
        where: { housingType: { in: ["room", "coliving"] } },
        _avg: { allInUsd: true },
        _count: true,
      }),
      prisma.listing.aggregate({
        where: { housingType: "lease-break" },
        _avg: { remainingMonths: true },
        _count: true,
      }),
    ]);

    return json(
      req,
      {
        listings,
        cities,
        noFeePct: listings ? Math.round((noFee / listings) * 100) : 0,
        avgRoomAllInUsd: Math.round(rooms._avg?.allInUsd ?? 0),
        leaseBreaks: breaks._count,
        avgRemainingMonths: Math.round(breaks._avg?.remainingMonths ?? 0),
        updatedAt: new Date().toISOString(),
      },
      { maxAge: 120 }
    );
  } catch (err) {
    console.error("[api/meta]", err);
    return json(req, { error: "meta_unavailable" }, { status: 503, maxAge: 0 });
  }
}
