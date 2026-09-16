import { prisma } from "@/lib/prisma";
import { isHost } from "@/lib/roles";
import { fail, handle, ok, rateLimit, readJson } from "@/lib/v1/http";
import { createFromComposer } from "@/lib/v1/composer";
import { toCard } from "@/lib/v1/listing-view";
import { pushToUsers } from "@/lib/v1/push";
import { requireUser } from "@/lib/v1/session";

export const dynamic = "force-dynamic";

/** The seller dashboard: every listing this account owns, whatever its state. */
export const GET = handle(async (req: Request) => {
  const user = await requireUser(req);
  const url = new URL(req.url);
  const rows = await prisma.listing.findMany({
    where: { hostId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      city: true,
      operator: true,
      _count: { select: { conversations: true, savedBy: true } },
    },
    take: 200,
  });
  return ok({
    items: rows.map((r) => ({
      ...toCard(r, url.origin),
      status: r.status,
      moderation: r.moderation,
      moderationNote: r.moderationNote,
      enquiries: r._count.conversations,
      saves: r._count.savedBy,
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
});

/** Publish from the mobile composer. Always lands in review. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  if (!isHost(user)) {
    return fail(403, "not_host", "Switch your account to hosting to list a home.");
  }
  await rateLimit(`compose:${user.id}`, 10, 60 * 60_000);
  const body = await readJson(req);
  const result = await createFromComposer(user.id, body);
  if (!result.ok) return new Response(JSON.stringify({ error: { code: "gate", message: result.error }, checks: result.checks ?? [] }), {
    status: 422,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
  });

  const admins = await prisma.user.findMany({ where: { role: "admin" }, select: { id: true } });
  void pushToUsers(
    admins.map((a) => a.id),
    { title: "Listing waiting for review", body: String(body.title || "New listing"), data: { type: "review", listingId: result.id } },
  );
  return ok({ id: result.id, moderation: "pending" }, 201);
});
