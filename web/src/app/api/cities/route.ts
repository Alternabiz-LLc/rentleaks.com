import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { json, preflight, serializeCity, bool } from "@/lib/api";

export const dynamic = "force-dynamic";

export function OPTIONS(req: NextRequest) {
  return preflight(req);
}

export async function GET(req: NextRequest) {
  const featuredOnly = bool(req.nextUrl.searchParams.get("featured"));
  try {
    const cities = await prisma.city.findMany({
      where: featuredOnly ? { featured: true } : undefined,
      orderBy: [{ rank: "asc" }, { name: "asc" }],
      include: { _count: { select: { listings: true } } },
    });
    return json(req, {
      items: cities.map((c) => ({ ...serializeCity(c), listingCount: c._count.listings })),
      total: cities.length,
    });
  } catch (err) {
    console.error("[api/cities]", err);
    return json(req, { error: "cities_unavailable", items: [] }, { status: 503, maxAge: 0 });
  }
}
