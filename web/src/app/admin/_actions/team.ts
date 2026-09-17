"use server";

import { revalidatePath } from "next/cache";
import { audit, requireAdminAction } from "@/lib/admin/guard";
import { back, field, fields, returnTo } from "@/lib/admin/flash";
import { ACCESS_LABEL, cleanAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/site";
import { resetTwoFactor } from "@/lib/security/two-factor";
import { sendMail } from "@/lib/v1/mail";
import { INVITE_HOURS, issueInviteToken } from "@/lib/v1/session";

const PATH = "/admin/team";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function sendInvite(user: { id: string; name: string; email: string; staffTitle: string | null; staffAccess: string[] }, from: string) {
  const token = await issueInviteToken(user.id);
  const link = `${appUrl().replace(/\/$/, "")}/join?token=${token}`;
  const areas = cleanAccess(user.staffAccess)
    .filter((k) => k !== "overview")
    .map((k) => ACCESS_LABEL[k])
    .join(", ");
  const first = user.name.split(/\s+/)[0] || "there";
  return sendMail({
    to: user.email,
    subject: `${from} invited you to the RentLeaks desk`,
    text:
      `Hi ${first},\n\n` +
      `${from} added you to the RentLeaks team${user.staffTitle ? ` as ${user.staffTitle}` : ""}.\n` +
      (areas ? `You'll have access to: ${areas}.\n` : "") +
      `\nSet your password here — the link works once and expires in ${INVITE_HOURS} hours:\n\n${link}\n\n` +
      `Then you'll turn on two-factor sign-in with an authenticator app on your phone (Google Authenticator, Microsoft Authenticator, 1Password or Authy). It takes a minute.\n\n` +
      `If you weren't expecting this, ignore this email.\n\nRentLeaks`,
  });
}

/** Step 1-2-3 invite: who, what they can open, send. */
export async function inviteStaff(fd: FormData) {
  const path = returnTo(fd, PATH);
  const guard = await requireAdminAction("team");
  if (!guard.ok) back(path, "err", guard.error);
  const name = field(fd, "name", 80);
  const email = field(fd, "email", 200).toLowerCase();
  const title = field(fd, "title", 60) || null;
  const access = cleanAccess(fields(fd, "access"));
  if (name.length < 2) back(path, "err", "Add their name.");
  if (!EMAIL.test(email)) back(path, "err", "That email address doesn't look right.");
  if (access.length < 2) back(path, "err", "Tick at least one area they can open.");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role === "staff" && !existing.staffJoinedAt) back(path, "err", `${existing.name} is already invited — use Resend invite on their card.`);
    if (existing.role === "staff") back(path, "err", `${existing.name} is already on the team.`);
    back(path, "err", "That email already has a RentLeaks account (a host, renter or founder). Use their work email instead.");
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      role: "staff",
      /* Unusable until they choose a password from the invitation. */
      passwordHash: "",
      staffAccess: access,
      staffTitle: title,
      staffInvitedAt: new Date(),
      invitedById: guard.user.id,
    },
  });
  const sent = await sendInvite(user, guard.user.name);
  await audit(guard.user.id, "staff.invite", "user", user.id, { email, access, delivered: sent.delivered });
  revalidatePath(PATH);
  back(
    `${PATH}?open=${user.id}`,
    sent.delivered ? "ok" : "err",
    sent.delivered ? `Invitation sent to ${email}. The link works for ${INVITE_HOURS} hours.` : `${name} was added, but the email didn't go out (${sent.error ?? sent.transport}). Fix email in System, then Resend invite.`,
  );
}

/** One action per button on a team member's card (name="op"). */
export async function teamAction(fd: FormData) {
  const path = returnTo(fd, PATH);
  const guard = await requireAdminAction("team");
  if (!guard.ok) back(path, "err", guard.error);
  const id = field(fd, "id", 60);
  const op = field(fd, "op", 30);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role !== "staff") back(path, "err", "That team member no longer exists.");
  const done = async (action: string, msg: string, detail: Record<string, unknown> = {}) => {
    await audit(guard.user.id, action, "user", id, detail);
    revalidatePath(PATH);
    back(path, "ok", msg);
  };

  switch (op) {
    case "access": {
      const access = cleanAccess(fields(fd, "access"));
      if (access.length < 2) back(path, "err", "Leave at least one area ticked, or deactivate the account instead.");
      const title = field(fd, "title", 60) || null;
      await prisma.user.update({ where: { id }, data: { staffAccess: access, staffTitle: title } });
      return done("staff.access", `${user.name}'s access is updated. It applies on their next click.`, { from: user.staffAccess, to: access });
    }
    case "resend": {
      if (user.staffJoinedAt) back(path, "err", `${user.name} already joined.`);
      const sent = await sendInvite(user, guard.user.name);
      if (!sent.delivered) back(path, "err", `The email didn't go out (${sent.error ?? sent.transport}).`);
      await prisma.user.update({ where: { id }, data: { staffInvitedAt: new Date() } });
      return done("staff.invite", `New invitation sent to ${user.email}. Older links stopped working.`, { resend: true });
    }
    case "reset2fa": {
      await resetTwoFactor(id, true);
      return done("staff.reset2fa", `Two-factor reset for ${user.name}. They're signed out and will set it up at their next sign-in.`);
    }
    case "signout": {
      const r = await prisma.session.deleteMany({ where: { userId: id, kind: "session" } });
      return done("staff.signout", `Signed ${user.name} out of ${r.count} device${r.count === 1 ? "" : "s"}.`);
    }
    case "deactivate": {
      await prisma.$transaction([
        prisma.user.update({ where: { id }, data: { suspendedAt: new Date(), suspendReason: "Removed from the team" } }),
        prisma.session.deleteMany({ where: { userId: id } }),
      ]);
      return done("staff.deactivate", `${user.name} can no longer sign in. Their history stays in the audit log.`);
    }
    case "reactivate": {
      await prisma.user.update({ where: { id }, data: { suspendedAt: null, suspendReason: null } });
      return done("staff.reactivate", `${user.name} can sign in again.`);
    }
    case "cancel": {
      if (user.staffJoinedAt || user.passwordHash) back(path, "err", `${user.name} already joined — deactivate instead.`);
      await prisma.user.delete({ where: { id } });
      await audit(guard.user.id, "staff.cancel", "user", id, { email: user.email });
      revalidatePath(PATH);
      back(PATH, "ok", `Invitation for ${user.email} cancelled.`);
    }
    default:
      back(path, "err", "Unknown action.");
  }
}
