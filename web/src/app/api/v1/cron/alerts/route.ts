import { prisma } from "@/lib/prisma";
import { liveListingWhere } from "@/lib/billing";
import { fail, handle, ok } from "@/lib/v1/http";
import { pushToUsers } from "@/lib/v1/push";
import { coerceSearch, searchWhere } from "@/lib/v1/search";

export const dynamic = "force-dynamic";

/**
 * Saved-search alerts. Run on a schedule (Vercel Cron, GitHub Actions, or any
 * scheduler) with `Authorization: Bearer $CRON_SECRET`. For each saved search
 * with alerts on, counts live listings approved since it was last checked and
 * sends one push per search — never one per listing.
 */
export const GET = handle(async (req: Request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return fail(401, "unauthorized", "Missing or wrong cron secret.");
  }

  const live = await liveListingWhere();
  const searches = await prisma.savedSearch.findMany({ where: { alerts: true }, take: 5000 });
  let sent = 0;

  for (const s of searches) {
    const since = s.lastCheckedAt;
    const where = searchWhere(coerceSearch(s.query), live);
    const fresh = await prisma.listing.findMany({
      where: { AND: [where, { OR: [{ moderatedAt: { gt: since } }, { AND: [{ moderatedAt: null }, { createdAt: { gt: since } }] }] }] },
      select: { id: true, title: true },
      orderBy: { postedAt: "desc" },
      take: 5,
    });
    await prisma.savedSearch.update({ where: { id: s.id }, data: { lastCheckedAt: new Date() } });
    if (!fresh.length) continue;
    sent += 1;
    await pushToUsers([s.userId], {
      title: fresh.length === 1 ? `New match · ${s.label}` : `${fresh.length}+ new matches · ${s.label}`,
      body: fresh[0].title,
      data: { type: "search", searchId: s.id, listingId: fresh[0].id },
    });
  }

  return ok({ checked: searches.length, notified: sent });
});
