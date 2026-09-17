"use server";

import { revalidatePath } from "next/cache";
import { audit, requireAdminAction } from "@/lib/admin/guard";
import { back, field, returnTo } from "@/lib/admin/flash";
import { contactFromUser, logActivity } from "@/lib/crm";
import { prisma } from "@/lib/prisma";
import { normaliseRole } from "@/lib/roles";

/** One action per submit button: name="op" on the button. */
export async function accountAction(fd: FormData) {
  const path = returnTo(fd, "/admin/accounts");
  const guard = await requireAdminAction("accounts");
  if (!guard.ok) back(path, "err", guard.error);
  const id = field(fd, "id", 60);
  const op = field(fd, "op", 30);
  const user = await prisma.user.findUnique({ where: { id }, include: { identity: true } });
  if (!user) back(path, "err", "That account no longer exists.");
  const self = user.id === guard.user.id;
  /* Desk accounts are managed from Team & access, by the founder only. */
  if (user.role === "staff") back(path, "err", `${user.name} is on the team — manage them in Team & access.`);
  if (user.role === "admin" && !guard.founder) back(path, "err", "Only the account owner can change a founder account.");
  const done = async (msg: string, detail: Record<string, unknown> = {}) => {
    await audit(guard.user.id, `account.${op}`, "user", id, detail);
    revalidatePath("/admin", "layout");
    back(path, "ok", msg);
  };

  switch (op) {
    case "role": {
      const role = normaliseRole(field(fd, "role"));
      if (self && role !== "admin") back(path, "err", "You can't remove your own founder access.");
      if (role === "staff") back(path, "err", "Add team members from Team & access, so they get an invite and two-factor.");
      if (role === "admin" && !guard.founder) back(path, "err", "Only the account owner can grant founder access.");
      await prisma.user.update({ where: { id }, data: { role } });
      return done(`${user.name} is now ${role}.`, { from: user.role, to: role });
    }
    case "suspend": {
      if (self) back(path, "err", "You can't suspend your own account.");
      const reason = field(fd, "reason", 300);
      if (reason.length < 4) back(path, "err", "Add a short reason for the suspension.");
      await prisma.$transaction([
        prisma.user.update({ where: { id }, data: { suspendedAt: new Date(), suspendReason: reason } }),
        prisma.session.deleteMany({ where: { userId: id } }),
        prisma.listing.updateMany({ where: { hostId: id }, data: { status: "paused" } }),
      ]);
      return done(`${user.name} is suspended, signed out and their listings are paused.`, { reason });
    }
    case "unsuspend": {
      await prisma.user.update({ where: { id }, data: { suspendedAt: null, suspendReason: null } });
      return done(`${user.name} can sign in again. Their listings stay paused until they (or you) reactivate them.`);
    }
    case "signout": {
      const r = await prisma.session.deleteMany({ where: { userId: id } });
      return done(`Signed ${user.name} out of ${r.count} session${r.count === 1 ? "" : "s"}.`);
    }
    case "verify":
    case "unverify": {
      const status = op === "verify" ? "verified" : "unverified";
      await prisma.identityVerification.upsert({
        where: { userId: id },
        update: { status, verifiedAt: op === "verify" ? new Date() : null, provider: "manual" },
        create: { userId: id, status, provider: "manual", verifiedAt: op === "verify" ? new Date() : null },
      });
      return done(`${user.name} is now ${status}.`);
    }
    case "trial": {
      const days = Math.min(90, Math.max(1, Math.round(Number(field(fd, "days")) || 7)));
      const base = user.trialEndsAt && user.trialEndsAt > new Date() ? user.trialEndsAt : new Date();
      const trialEndsAt = new Date(base.getTime() + days * 86_400_000);
      await prisma.user.update({ where: { id }, data: { trialEndsAt } });
      const contact = await contactFromUser(user, "manual");
      if (contact) await logActivity(contact.id, "trial", `Granted ${days} free days`, `until ${trialEndsAt.toISOString().slice(0, 10)}`, guard.user.id);
      return done(`${user.name}'s free trial now runs until ${trialEndsAt.toISOString().slice(0, 10)}.`, { days });
    }
    case "endtrial": {
      await prisma.user.update({ where: { id }, data: { trialEndsAt: null } });
      return done(`${user.name}'s trial ended.`);
    }
    case "crm": {
      const contact = await contactFromUser(user, "manual");
      if (!contact) back(path, "err", "Could not add to the CRM.");
      await audit(guard.user.id, "account.crm", "user", id);
      back(`/admin/crm/${contact.id}`, "ok", "Contact ready.");
    }
    default:
      back(path, "err", "Unknown action.");
  }
}
