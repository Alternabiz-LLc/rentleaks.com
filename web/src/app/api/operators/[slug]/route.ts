import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { json, preflight, serializeListing, num, MAX_PAGE_SIZE } from "@/lib/api";

export const dynamic = "force-dynamic";

export function OPTIONS(req: NextRequest) {
  return preflight(req);
}

/** One operator's boutique: profile, derived portfolio stats, paged homes. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const p = req.nextUrl.searchParams;
  const page = Math.max(1, num(p.get("page")) ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, num(p.get("pageSize")) ?? 24));

  try {
    const operator = await prisma.operator.findUnique({ where: { slug } });
    if (!operator) return json(req, { error: "not_found" }, { status: 404, maxAge: 0 });

    const where = { operatorId: operator.id };
    const [total, homes, agg, verifiedCount, noFeeCount, cityRows] = await Promise.all([
      prisma.listing.count({ where }),
      prisma.listing.findMany({
        where,
        orderBy: [{ allInUsd: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { city: true, operator: true },
      }),
      prisma.listing.aggregate({ where, _min: { allInUsd: true }, _avg: { allInUsd: true } }),
      prisma.listing.count({ where: { ...where, verified: true } }),
      prisma.listing.count({ where: { ...where, noFee: true } }),
      prisma.listing.findMany({
        where,
        distinct: ["cityId"],
        select: { city: { select: { id: true, name: true, slug: true, country: true } } },
      }),
    ]);

    // The cheapest home decides the "from" price, and it is reported in the
    // currency it was actually priced in — a portfolio can span several.
    const cheapest = await prisma.listing.findFirst({
      where,
      orderBy: [{ allInUsd: "asc" }],
      select: { allIn: true, currency: true, allInUsd: true },
    });
    const currencies = await prisma.listing.findMany({ where, distinct: ["currency"], select: { currency: true } });

    return json(req, {
      operator: {
        id: operator.id,
        slug: operator.slug,
        name: operator.name,
        kind: operator.kind,
        tagline: operator.tagline,
        since: operator.since,
        scope: operator.scope,
        count: total,
        verified: total > 0 && verifiedCount === total,
        noFeeAll: total > 0 && noFeeCount === total,
        fromAllIn: cheapest?.allIn ?? 0,
        fromAllInUsd: cheapest?.allInUsd ?? agg._min.allInUsd ?? 0,
        currency: cheapest?.currency ?? "USD",
        multiCurrency: currencies.length > 1,
        avgAllInUsd: Math.round(agg._avg.allInUsd ?? 0),
        cities: cityRows.map((r) => r.city).filter(Boolean),
      },
      items: homes.map(serializeListing),
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    });
  } catch (err) {
    console.error("[api/operators/:slug]", err);
    return json(req, { error: "operator_unavailable" }, { status: 503, maxAge: 0 });
  }
}
