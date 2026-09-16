import { prisma } from "@/lib/prisma";
import { fail, handle, ok, rateLimit, readJson, str } from "@/lib/v1/http";
import { pushToUsers } from "@/lib/v1/push";
import { requireUser } from "@/lib/v1/session";

export const dynamic = "force-dynamic";

const REASONS = ["scam", "misleading", "discriminatory", "unavailable", "abusive", "other"];

export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  await rateLimit(`report:${user.id}`, 20, 60 * 60_000);
  const body = await readJson(req);
  const reason = REASONS.includes(String(body.reason)) ? String(body.reason) : null;
  if (!reason) return fail(400, "reason", "Choose what is wrong.");
  const listingId = str(body.listingId, 200) || null;
  const subjectUserId = str(body.userId, 64) || null;
  const messageId = str(body.messageId, 64) || null;
  if (!listingId && !subjectUserId && !messageId) return fail(400, "subject", "Nothing to report.");

  if (listingId && !(await prisma.listing.count({ where: { id: listingId } }))) {
    return fail(404, "not_found", "That listing no longer exists.");
  }

  await prisma.report.create({
    data: { reporterId: user.id, reason, note: str(body.note, 1000), listingId, subjectUserId, messageId },
  });

  const admins = await prisma.user.findMany({ where: { role: "admin" }, select: { id: true } });
  void pushToUsers(
    admins.map((a) => a.id),
    { title: `Report: ${reason}`, body: str(body.note, 120) || "A member filed a report.", data: { type: "report" } },
  );

  return ok({ ok: true }, 201);
});
