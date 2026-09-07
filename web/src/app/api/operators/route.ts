import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { json, preflight } from "@/lib/api";

export const dynamic = "force-dynamic";

export function OPTIONS(req: NextRequest) {
  return preflight(req);
}

/**
 * Operator directory. Counts, price floors and reply times are derived here
 * rather than stored on the row, so they cannot drift as listings change.
 * Two queries total, not one per operator.
 */
export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get("kind");
  try {
    const [operators, stats] = await Promise.all([
      prisma.operator.findMany({
        where: kind ? { kind } : undefined,
        orderBy: [{ name: "asc" }],
      }),
      prisma.listing.groupBy({
        by: ["operatorId"],
        _count: { _all: true },
        _min: { allInUsd: true },
        _avg: { allInUsd: true },
      }),
    ]);

    const byId = new Map(stats.map((s) => [s.operatorId, s]));
    const items = operators
      .map((o) => {
        const s = byId.get(o.id);
        return {
          id: o.id,
          slug: o.slug,
          name: o.name,
          kind: o.kind,
          tagline: o.tagline,
          since: o.since,
          scope: o.scope,
          count: s?._count._all ?? 0,
          fromAllInUsd: s?._min.allInUsd ?? 0,
          path: `operators/${o.slug}.html`,
        };
      })
      .filter((o) => o.count > 0)
      .sort((a, b) => b.count - a.count);

    return json(req, { items, total: items.length });
  } catch (err) {
    console.error("[api/operators]", err);
    return json(req, { error: "operators_unavailable", items: [] }, { status: 503, maxAge: 0 });
  }
}
