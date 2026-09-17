"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { audit, requireAdminAction } from "@/lib/admin/guard";
import { back, field } from "@/lib/admin/flash";
import { prisma } from "@/lib/prisma";

export async function resolveReport(fd: FormData) {
  const path = "/admin/reports";
  const guard = await requireAdminAction("reports");
  if (!guard.ok) back(path, "err", guard.error);
  const id = field(fd, "id", 60);
  const op = field(fd, "op", 30);
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) back(path, "err", "That report no longer exists.");
  if (report.status !== "open" && op !== "reopen") back(path, "err", "Already resolved.");
  const now = new Date();

  if (op === "reopen") {
    await prisma.report.update({ where: { id }, data: { status: "open", resolvedAt: null } });
  } else if (op === "dismiss") {
    await prisma.report.update({ where: { id }, data: { status: "dismissed", resolvedAt: now } });
  } else if (op === "unpublish" || op === "suspend") {
    const tx: Prisma.PrismaPromise<unknown>[] = [prisma.report.update({ where: { id }, data: { status: "actioned", resolvedAt: now } })];
    if (op === "unpublish") {
      if (!report.listingId) back(path, "err", "This report isn't about a listing.");
      tx.push(
        prisma.listing.update({
          where: { id: report.listingId },
          data: {
            moderation: "declined",
            moderationNote: `Removed after a member report (${report.reason}).`,
            moderatedAt: now,
            moderatedById: guard.user.id,
          },
        }),
      );
    }
    if (op === "suspend") {
      let target = report.subjectUserId;
      if (!target && report.listingId) {
        target = (await prisma.listing.findUnique({ where: { id: report.listingId }, select: { hostId: true } }))?.hostId ?? null;
      }
      if (!target && report.messageId) {
        target = (await prisma.message.findUnique({ where: { id: report.messageId }, select: { senderId: true } }))?.senderId ?? null;
      }
      if (!target) back(path, "err", "No account to suspend on this report.");
      if (target === guard.user.id) back(path, "err", "That's your own account.");
      tx.push(
        prisma.user.update({ where: { id: target }, data: { suspendedAt: now, suspendReason: `Member report: ${report.reason}` } }),
        prisma.session.deleteMany({ where: { userId: target } }),
        prisma.listing.updateMany({ where: { hostId: target }, data: { status: "paused" } }),
      );
    }
    await prisma.$transaction(tx);
  } else back(path, "err", "Unknown action.");

  await audit(guard.user.id, `report.${op}`, "report", id, { reason: report.reason });
  revalidatePath("/admin", "layout");
  back(path, "ok", op === "dismiss" ? "Report dismissed." : op === "reopen" ? "Report reopened." : "Report actioned.");
}
