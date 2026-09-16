"use server";

import { revalidatePath } from "next/cache";
import { audit, requireAdminAction } from "@/lib/admin/guard";
import { back, field } from "@/lib/admin/flash";
import { EMAIL_RE } from "@/lib/marketing";
import { prisma } from "@/lib/prisma";
import { createInvite, sendInvite } from "@/lib/trials";

const path = "/admin/trials";

async function templateFor(fd: FormData) {
  const id = field(fd, "templateId", 60);
  return id ? (await prisma.emailTemplate.findUnique({ where: { id }, select: { subject: true, body: true } })) ?? undefined : undefined;
}

/** "email" or "email, name" per line; also accepts comma/semicolon-separated emails. */
function parseRecipients(text: string) {
  const out = new Map<string, string>();
  for (const line of text.split(/\n/)) {
    const parts = line.split(/[,;\t]/).map((s) => s.trim()).filter(Boolean);
    const emails = parts.filter((s) => EMAIL_RE.test(s.toLowerCase()));
    if (emails.length === 1) {
      const name = parts.filter((s) => s !== emails[0]).join(" ");
      out.set(emails[0].toLowerCase(), name);
    } else for (const e of emails) out.set(e.toLowerCase(), "");
  }
  return [...out.entries()].map(([email, name]) => ({ email, name }));
}

export async function inviteHosts(fd: FormData) {
  const guard = await requireAdminAction();
  if (!guard.ok) back(path, "err", guard.error);
  const recipients = parseRecipients(field(fd, "recipients", 100_000));
  if (!recipients.length) back(path, "err", "Add at least one email address.");
  if (recipients.length > 200) back(path, "err", "Up to 200 at a time.");
  const days = Math.min(90, Math.max(1, Math.round(Number(field(fd, "days")) || 7)));
  const note = field(fd, "note", 500);
  const sendNow = fd.get("send") === "on";
  const template = await templateFor(fd);
  const suppressed = new Set(
    (await prisma.emailSuppression.findMany({ where: { email: { in: recipients.map((r) => r.email) } }, select: { email: true } })).map((s) => s.email),
  );
  let created = 0;
  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    if (suppressed.has(r.email)) continue;
    const invite = await createInvite({ email: r.email, name: r.name, days, note, createdById: guard.user.id });
    created += 1;
    if (sendNow) {
      const res = await sendInvite(invite, template, guard.user.id);
      if (res.delivered || res.transport === "console") sent += 1;
      else failed += 1;
    }
  }
  await audit(guard.user.id, "trial.invite", "invite", "", { created, sent, failed, days });
  revalidatePath(path);
  const skipped = recipients.length - created;
  back(
    path,
    failed ? "err" : "ok",
    `${created} invite${created === 1 ? "" : "s"} created${sendNow ? `, ${sent} emailed${failed ? `, ${failed} failed (check Admin → System)` : ""}` : " (not emailed — copy the links)"}${skipped ? `, ${skipped} skipped (unsubscribed)` : ""}.`,
  );
}

export async function inviteAction(fd: FormData) {
  const guard = await requireAdminAction();
  if (!guard.ok) back(path, "err", guard.error);
  const id = field(fd, "id", 60);
  const op = field(fd, "op");
  const invite = await prisma.trialInvite.findUnique({ where: { id } });
  if (!invite) back(path, "err", "That invite no longer exists.");
  if (op === "revoke") {
    if (invite.status === "redeemed") back(path, "err", "Already redeemed — end the trial from Accounts instead.");
    await prisma.trialInvite.update({ where: { id }, data: { status: "revoked" } });
  } else if (op === "resend") {
    if (!["pending", "sent", "expired"].includes(invite.status)) back(path, "err", `The invite is ${invite.status}.`);
    const expiresAt = invite.expiresAt < new Date() ? new Date(Date.now() + 30 * 86_400_000) : invite.expiresAt;
    await prisma.trialInvite.update({ where: { id }, data: { expiresAt, status: invite.status === "expired" ? "pending" : invite.status } });
    const r = await sendInvite({ ...invite }, await templateFor(fd), guard.user.id);
    if (!r.delivered && r.transport !== "console") back(path, "err", `Not delivered: ${r.error}`);
  } else back(path, "err", "Unknown action.");
  await audit(guard.user.id, `trial.${op}`, "invite", id);
  revalidatePath(path);
  back(path, "ok", op === "revoke" ? "Invite revoked." : "Invite sent again.");
}
