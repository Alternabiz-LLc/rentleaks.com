import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/roles";
import { fail, handle, ok, readJson, str } from "@/lib/v1/http";
import { pushToUsers } from "@/lib/v1/push";
import { requireUser } from "@/lib/v1/session";

export const dynamic = "force-dynamic";

/** Same rules as app/actions/moderation.ts: admin only, a decline needs a reason. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  if (!isAdmin(user)) return fail(403, "forbidden", "Reviewing listings is a founder-account action.");
  const { id } = await ctx.params;
  const body = await readJson(req);
  const decision = String(body.decision);
  if (!["approved", "declined", "pending"].includes(decision)) return fail(400, "decision", "Unknown decision.");
  const note = str(body.note, 600);
  if (decision === "declined" && note.length < 8) {
    return fail(400, "reason", "Say why, in a sentence. The seller is shown this and will otherwise resubmit the same listing.");
  }

  const listing = await prisma.listing.findUnique({ where: { id }, select: { id: true, hostId: true, title: true } });
  if (!listing) return fail(404, "not_found", "That listing no longer exists.");

  await prisma.listing.update({
    where: { id },
    data: {
      moderation: decision,
      moderationNote: decision === "declined" ? note : note || null,
      moderatedAt: new Date(),
      moderatedById: user.id,
    },
  });

  if (decision !== "pending") {
    void pushToUsers([listing.hostId], {
      title: decision === "approved" ? "Your listing is live" : "Your listing needs changes",
      body: decision === "approved" ? listing.title : `${listing.title}: ${note}`,
      data: { type: "moderation", listingId: id },
    });
  }
  return ok({ ok: true });
});
