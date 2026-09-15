/**
 * Conversation helpers shared by the inbox routes and /me.
 */
import { prisma } from "@/lib/prisma";
import { HttpError } from "./http";

export async function unreadCount(userId: string) {
  const convos = await prisma.conversation.findMany({
    where: { OR: [{ renterId: userId }, { hostId: userId }] },
    select: { renterId: true, renterReadAt: true, hostReadAt: true, lastMessageAt: true },
    take: 200,
    orderBy: { lastMessageAt: "desc" },
  });
  let n = 0;
  for (const c of convos) {
    const read = c.renterId === userId ? c.renterReadAt : c.hostReadAt;
    if (!read || read < c.lastMessageAt) n += 1;
  }
  return n;
}

export async function isBlockedBetween(a: string, b: string) {
  const row = await prisma.userBlock.findFirst({
    where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
    select: { id: true },
  });
  return !!row;
}

/** Loads a conversation and proves the caller is one of its two parties. */
export async function ownConversation(id: string, userId: string) {
  const convo = await prisma.conversation.findUnique({
    where: { id },
    include: {
      listing: { include: { city: true } },
      renter: { select: { id: true, name: true, identity: { select: { status: true } } } },
      host: { select: { id: true, name: true, identity: { select: { status: true } } } },
    },
  });
  if (!convo || (convo.renterId !== userId && convo.hostId !== userId)) {
    throw new HttpError(404, "not_found", "That conversation does not exist.");
  }
  return convo;
}

/**
 * Host responsiveness, measured from real threads: the share of enquiries in
 * the last 90 days the host answered, and the median hours to that answer.
 * Null when there is too little to say — the same rule the price panel
 * follows for thin comparables.
 */
export async function hostStats(hostId: string) {
  const since = new Date(Date.now() - 90 * 86_400_000);
  const [listings, convos] = await Promise.all([
    prisma.listing.count({ where: { hostId, moderation: "approved" } }),
    prisma.conversation.findMany({
      where: { hostId, createdAt: { gte: since } },
      select: {
        createdAt: true,
        messages: { select: { senderId: true, createdAt: true }, orderBy: { createdAt: "asc" }, take: 20 },
      },
      take: 60,
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (convos.length < 3) return { listings, responseRate: null, medianReplyHours: null };
  const hours: number[] = [];
  let answered = 0;
  for (const c of convos) {
    const first = c.messages.find((m) => m.senderId !== hostId);
    const reply = c.messages.find((m) => m.senderId === hostId && (!first || m.createdAt >= first.createdAt));
    if (reply) {
      answered += 1;
      if (first) hours.push((reply.createdAt.getTime() - first.createdAt.getTime()) / 3_600_000);
    }
  }
  hours.sort((a, b) => a - b);
  return {
    listings,
    responseRate: Math.round((answered / convos.length) * 100),
    medianReplyHours: hours.length ? Math.round(hours[Math.floor(hours.length / 2)] * 10) / 10 : null,
  };
}
