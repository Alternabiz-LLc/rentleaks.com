import { prisma } from "@/lib/prisma";
import { liveListingWhere } from "@/lib/billing";
import { clientKey, fail, handle, ok, rateLimit, readJson, str } from "@/lib/v1/http";
import { isBlockedBetween } from "@/lib/v1/inbox";
import { absolute } from "@/lib/v1/listing-view";
import { pushToUsers } from "@/lib/v1/push";
import { scanMessage, signalsFromFlags } from "@/lib/v1/scam-guard";
import { requireUser } from "@/lib/v1/session";

export const dynamic = "force-dynamic";

/** Inbox — both sides of the marketplace in one list, newest first. */
export const GET = handle(async (req: Request) => {
  const user = await requireUser(req);
  const url = new URL(req.url);
  const rows = await prisma.conversation.findMany({
    where: { OR: [{ renterId: user.id }, { hostId: user.id }], status: { not: "archived" } },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    include: {
      listing: { select: { id: true, title: true, image: true, neighborhood: true, allIn: true, currency: true } },
      renter: { select: { id: true, name: true } },
      host: { select: { id: true, name: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return ok({
    items: rows.map((c) => {
      const asRenter = c.renterId === user.id;
      const other = asRenter ? c.host : c.renter;
      const read = asRenter ? c.renterReadAt : c.hostReadAt;
      const last = c.messages[0];
      return {
        id: c.id,
        role: asRenter ? "renter" : "host",
        listing: { ...c.listing, image: absolute(url.origin, c.listing.image) },
        counterpart: { id: other.id, firstName: other.name.split(/\s+/)[0] || "Member" },
        lastMessage: last
          ? {
              body: last.body.slice(0, 140),
              mine: last.senderId === user.id,
              at: last.createdAt.toISOString(),
              flagged: last.senderId !== user.id && signalsFromFlags(last.flags).length > 0,
            }
          : null,
        unread: !read || read < c.lastMessageAt,
        lastMessageAt: c.lastMessageAt.toISOString(),
      };
    }),
  });
});

/**
 * Start (or continue) an enquiry about a listing. One thread per renter per
 * listing — the schema enforces it — so asking twice lands in the same place.
 */
export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  rateLimit(`enquiry:${user.id}`, 20, 60 * 60_000);
  rateLimit(`enquiry-ip:${clientKey(req)}`, 40, 60 * 60_000);
  const body = await readJson(req);
  const listingId = str(body.listingId, 200);
  const text = str(body.body, 4000);
  if (text.length < 2) return fail(400, "empty", "Write a message first.");

  const live = await liveListingWhere();
  const listing = await prisma.listing.findFirst({
    where: { AND: [live, { id: listingId }] },
    select: { id: true, hostId: true, title: true },
  });
  if (!listing) return fail(404, "not_found", "This listing is no longer taking enquiries.");
  if (listing.hostId === user.id) return fail(400, "own_listing", "This is your own listing.");
  if (await isBlockedBetween(user.id, listing.hostId)) {
    return fail(403, "blocked", "You can’t message this host.");
  }

  const flags = scanMessage(text).map((s) => s.key);
  const now = new Date();
  const convo = await prisma.conversation.upsert({
    where: { listingId_renterId: { listingId, renterId: user.id } },
    create: { listingId, renterId: user.id, hostId: listing.hostId, lastMessageAt: now, renterReadAt: now },
    update: { lastMessageAt: now, renterReadAt: now, status: "open" },
  });
  await prisma.message.create({
    data: { conversationId: convo.id, senderId: user.id, body: text, flags: JSON.stringify(flags) },
  });

  void pushToUsers([listing.hostId], {
    title: `New enquiry · ${listing.title}`,
    body: `${user.name.split(/\s+/)[0]}: ${text}`,
    data: { type: "message", conversationId: convo.id },
  });

  return ok({ conversationId: convo.id }, 201);
});
