import { prisma } from "@/lib/prisma";
import { liveListingWhere } from "@/lib/billing";
import { handle, int, ok } from "@/lib/v1/http";
import { toCard } from "@/lib/v1/listing-view";
import { parseSearch, searchOrder, searchWhere } from "@/lib/v1/search";
import { optionalUser } from "@/lib/v1/session";
import { pageSlots, rotateSponsors, sponsorSeed } from "@/lib/sponsored-placement";

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
  const include = { city: true, operator: true } as const;

  /* Sponsored placement applies to every list search, with or without a city,
     and never to the map. The sponsors come from the same filtered set — so a
     city search only ever promotes that city's listings (brief §4.6) — open
     the first page, then appear once every few results across pages. */
  const placing = !map;
  const paid = { OR: [{ sponsored: true }, { featured: true }] };
  const organicWhere = placing ? { AND: [where, { NOT: paid }] } : where;

  const [organicTotal, sponsorsRaw] = await Promise.all([
    prisma.listing.count({ where: organicWhere }),
    placing
      ? prisma.listing.findMany({ where: { AND: [where, paid] }, include, orderBy: { id: "asc" }, take: 60 })
      : Promise.resolve([]),
  ]);
  const sponsors = rotateSponsors(sponsorsRaw, sponsorSeed(s.city));
  const layout = pageSlots(page, pageSize, organicTotal, sponsors.length);

  const organicRows = layout.organicTake
    ? await prisma.listing.findMany({
        where: organicWhere,
        orderBy: searchOrder(s),
        skip: layout.organicSkip,
        take: layout.organicTake,
        include,
      })
    : [];
  const rows = layout.slots
    .map((slot) => (slot.kind === "sponsored" ? sponsors[slot.index] : organicRows[slot.index - layout.organicSkip]))
    .filter((row): row is (typeof organicRows)[number] => Boolean(row));
  const total = layout.total;
  const signedIn = await optionalUser(req);

  let saved = new Set<string>();
  if (signedIn && rows.length) {
    const marks = await prisma.savedListing.findMany({
      where: { userId: signedIn.id, listingId: { in: rows.map((r) => r.id) } },
      select: { listingId: true },
    });
    saved = new Set(marks.map((m) => m.listingId));
  }

  return ok({
    items: rows.map((r) => ({ ...toCard(r, url.origin), saved: saved.has(r.id) })),
    total,
    page,
    pageSize,
    hasMore: layout.hasMore,
  });
});
