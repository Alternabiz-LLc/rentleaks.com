import { prisma } from "@/lib/prisma";
import { fail, handle, int, ok, rateLimit, readJson, str } from "@/lib/v1/http";
import { isBlockedBetween, ownConversation } from "@/lib/v1/inbox";
import { absolute } from "@/lib/v1/listing-view";
import { pushToUsers } from "@/lib/v1/push";
import { scanMessage, signalsFromFlags } from "@/lib/v1/scam-guard";
import { requireUser } from "@/lib/v1/session";

export const dynamic = "force-dynamic";

/** A thread. Reading it marks it read for the caller's side. */
export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const convo = await ownConversation(id, user.id);
  const asRenter = convo.renterId === user.id;
  const before = url.searchParams.get("before");

  const messages = await prisma.message.findMany({
    where: { conversationId: id, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
    orderBy: { createdAt: "desc" },
    take: int(url.searchParams.get("limit"), 50, 1, 100),
  });

  await prisma.conversation.update({
    where: { id },
    data: asRenter ? { renterReadAt: new Date() } : { hostReadAt: new Date() },
  });

  const other = asRenter ? convo.host : convo.renter;
  const blocked = await isBlockedBetween(convo.renterId, convo.hostId);
  /* When the other side last opened the thread — the app shows "Seen" under
     the caller's last message if it came before this. */
  const theirReadAt = asRenter ? convo.hostReadAt : convo.renterReadAt;

  return ok({
    id: convo.id,
    role: asRenter ? "renter" : "host",
    blocked,
    archived: convo.status === "archived",
    theirReadAt: theirReadAt ? theirReadAt.toISOString() : null,
    listing: {
      id: convo.listing.id,
      title: convo.listing.title,
      image: absolute(url.origin, convo.listing.image),
      neighborhood: convo.listing.neighborhood,
      cityName: convo.listing.city.name,
      allIn: convo.listing.allIn,
      currency: convo.listing.currency,
      deposit: convo.listing.deposit,
      verified: convo.listing.verified,
    },
    counterpart: {
      id: other.id,
      firstName: other.name.split(/\s+/)[0] || "Member",
      identity: other.identity?.status ?? "unverified",
    },
    messages: messages.reverse().map((m) => ({
      id: m.id,
      body: m.body,
      mine: m.senderId === user.id,
      at: m.createdAt.toISOString(),
      /* Warnings are shown to the recipient only. The sender is not told
         which phrase tripped them, which would just teach rewording. */
      signals: m.senderId === user.id ? [] : signalsFromFlags(m.flags),
    })),
  });
});

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  await rateLimit(`msg:${user.id}`, 60, 10 * 60_000);
  const { id } = await ctx.params;
  const convo = await ownConversation(id, user.id);
  const body = await readJson(req);
  const text = str(body.body, 4000);
  if (text.length < 1) return fail(400, "empty", "Write a message first.");
  if (await isBlockedBetween(convo.renterId, convo.hostId)) {
    return fail(403, "blocked", "Messages are turned off in this conversation.");
  }

  const asRenter = convo.renterId === user.id;
  const now = new Date();
  const flags = scanMessage(text).map((s) => s.key);
  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: { conversationId: id, senderId: user.id, body: text, flags: JSON.stringify(flags) },
    }),
    prisma.conversation.update({
      where: { id },
      data: { lastMessageAt: now, status: "open", ...(asRenter ? { renterReadAt: now } : { hostReadAt: now }) },
    }),
  ]);

  const recipient = asRenter ? convo.hostId : convo.renterId;
  void pushToUsers([recipient], {
    title: `${user.name.split(/\s+/)[0]} · ${convo.listing.title}`,
    body: text,
    data: { type: "message", conversationId: id },
  });

  return ok({ id: message.id, body: message.body, mine: true, at: message.createdAt.toISOString(), signals: [] }, 201);
});

/** Archive for the caller (hides from inbox until a new message arrives). */
export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  const { id } = await ctx.params;
  await ownConversation(id, user.id);
  const body = await readJson(req);
  await prisma.conversation.update({ where: { id }, data: { status: body.archived === true ? "archived" : "open" } });
  return ok({ ok: true });
});
