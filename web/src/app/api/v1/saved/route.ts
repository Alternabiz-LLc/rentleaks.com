import { prisma } from "@/lib/prisma";
import { liveListingWhere } from "@/lib/billing";
import { fail, handle, ok, readJson, str } from "@/lib/v1/http";
import { toCard } from "@/lib/v1/listing-view";
import { requireUser } from "@/lib/v1/session";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const user = await requireUser(req);
  const url = new URL(req.url);
  const live = await liveListingWhere();
  const rows = await prisma.savedListing.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { listing: { include: { city: true, operator: true } } },
    take: 200,
  });
  const liveIds = new Set(
    (
      await prisma.listing.findMany({
        where: { AND: [live, { id: { in: rows.map((r) => r.listingId) } }] },
        select: { id: true },
      })
    ).map((r) => r.id),
  );
  return ok({
    items: rows.map((r) => ({
      ...toCard(r.listing, url.origin),
      saved: true,
      savedAt: r.createdAt.toISOString(),
      /* Kept in the list so the renter sees it went, rather than vanishing. */
      available: liveIds.has(r.listingId),
    })),
  });
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  const body = await readJson(req);
  const listingId = str(body.listingId, 200);
  const exists = await prisma.listing.count({ where: { id: listingId } });
  if (!exists) return fail(404, "not_found", "That listing no longer exists.");
  await prisma.savedListing.upsert({
    where: { userId_listingId: { userId: user.id, listingId } },
    create: { userId: user.id, listingId },
    update: {},
  });
  return ok({ ok: true, saved: true });
});
