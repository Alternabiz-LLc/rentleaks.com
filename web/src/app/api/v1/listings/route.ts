import { prisma } from "@/lib/prisma";
import { liveListingWhere } from "@/lib/billing";
import { handle, int, ok } from "@/lib/v1/http";
import { toCard } from "@/lib/v1/listing-view";
import { parseSearch, searchOrder, searchWhere } from "@/lib/v1/search";
import { optionalUser } from "@/lib/v1/session";

export const dynamic = "force-dynamic";

/**
 * Browse. Only live listings — approved by review and not paused — ever leave
 * this endpoint. `view=map` returns up to 400 rows for pins in one call.
 */
export const GET = handle(async (req: Request) => {
  const url = new URL(req.url);
  const p = url.searchParams;
  const s = parseSearch(p);
  const map = p.get("view") === "map";
  const pageSize = map ? 400 : int(p.get("pageSize"), 20, 1, 50);
  const page = map ? 1 : int(p.get("page"), 1, 1, 500);

  const where = searchWhere(s, await liveListingWhere());
  const [total, rows, user] = await Promise.all([
    prisma.listing.count({ where }),
    prisma.listing.findMany({
      where,
      orderBy: searchOrder(s),
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { city: true, operator: true },
    }),
    optionalUser(req),
  ]);

  let saved = new Set<string>();
  if (user && rows.length) {
    const marks = await prisma.savedListing.findMany({
      where: { userId: user.id, listingId: { in: rows.map((r) => r.id) } },
      select: { listingId: true },
    });
    saved = new Set(marks.map((m) => m.listingId));
  }

  return ok({
    items: rows.map((r) => ({ ...toCard(r, url.origin), saved: saved.has(r.id) })),
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  });
});
