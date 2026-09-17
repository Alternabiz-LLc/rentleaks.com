import { prisma } from "@/lib/prisma";
import { liveListingWhere } from "@/lib/billing";
import { fail, handle, ok } from "@/lib/v1/http";
import { hostStats } from "@/lib/v1/inbox";
import { toCard, toDetail } from "@/lib/v1/listing-view";
import { optionalSession, sessionCan } from "@/lib/v1/session";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const [row, session, live] = await Promise.all([
    prisma.listing.findUnique({
      where: { id },
      include: {
        city: true,
        operator: true,
        host: { select: { id: true, name: true, createdAt: true, identity: { select: { status: true } } } },
      },
    }),
    optionalSession(req),
    liveListingWhere(),
  ]);
  if (!row) return fail(404, "not_found", "This listing is no longer available.");

  /* A listing still in review, declined or paused is visible to its owner
     and the founder account — nobody else. */
  const isLive = await prisma.listing.count({ where: { AND: [{ id }, live] } });
  const user = session?.user ?? null;
  const reviewer = sessionCan(session, "listings");
  const privileged = !!user && (user.id === row.hostId || reviewer);
  if (!isLive && !privileged) return fail(404, "not_found", "This listing is no longer available.");

  const [peers, similar, stats, saved, convo] = await Promise.all([
    prisma.listing.findMany({
      where: { AND: [live, { housingType: row.housingType, allInUsd: { gt: 0 } }] },
      select: { allInUsd: true, housingType: true, cityId: true },
      take: 2000,
    }),
    prisma.listing.findMany({
      where: { AND: [live, { cityId: row.cityId, id: { not: row.id } }] },
      include: { city: true, operator: true },
      orderBy: [{ verified: "desc" }, { postedAt: "desc" }],
      take: 6,
    }),
    hostStats(row.hostId),
    user ? prisma.savedListing.count({ where: { userId: user.id, listingId: id } }) : Promise.resolve(0),
    user ? prisma.conversation.findFirst({ where: { listingId: id, renterId: user.id }, select: { id: true } }) : Promise.resolve(null),
  ]);

  return ok({
    listing: toDetail(row, peers, url.origin, stats),
    similar: similar.map((s) => toCard(s, url.origin)),
    viewer: {
      saved: saved > 0,
      conversationId: convo?.id ?? null,
      isOwner: !!user && user.id === row.hostId,
      canReview: reviewer,
    },
  });
});
