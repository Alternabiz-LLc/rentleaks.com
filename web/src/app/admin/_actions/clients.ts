"use server";

import { revalidatePath } from "next/cache";
import { audit, requireAdminAction } from "@/lib/admin/guard";
import { back, field, returnTo } from "@/lib/admin/flash";
import { contactFromUser, logActivity } from "@/lib/crm";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/v1/mail";

const base = (id: string) => `/admin/accounts/${id}`;

/** Private notes on a client: add, pin, unpin, delete. */
export async function noteAction(fd: FormData) {
  const id = field(fd, "userId", 60);
  const path = returnTo(fd, base(id));
  const guard = await requireAdminAction("accounts");
  if (!guard.ok) back(path, "err", guard.error);
  const op = field(fd, "op", 10);
  if (op === "add") {
    const body = field(fd, "body", 2000);
    if (body.length < 2) back(path, "err", "Write the note first.");
    if (!(await prisma.user.findUnique({ where: { id }, select: { id: true } }))) back(path, "err", "That account no longer exists.");
    await prisma.clientNote.create({ data: { userId: id, body, pinned: field(fd, "pin", 3) === "yes", byId: guard.user.id } });
    await audit(guard.user.id, "client.note", "user", id);
    revalidatePath(base(id));
    back(path, "ok", "Note saved.");
  }
  const noteId = field(fd, "noteId", 60);
  const note = await prisma.clientNote.findUnique({ where: { id: noteId } });
  if (!note || note.userId !== id) back(path, "err", "That note no longer exists.");
  if (op === "pin" || op === "unpin") {
    await prisma.clientNote.update({ where: { id: noteId }, data: { pinned: op === "pin" } });
    revalidatePath(base(id));
    back(path, "ok", op === "pin" ? "Pinned to the top." : "Unpinned.");
  }
  if (op === "delete") {
    if (note.byId !== guard.user.id && !guard.founder) back(path, "err", "Only the author or the founder can delete a note.");
    await prisma.clientNote.delete({ where: { id: noteId } });
    await audit(guard.user.id, "client.note.delete", "user", id);
    revalidatePath(base(id));
    back(path, "ok", "Note deleted.");
  }
  back(path, "err", "Unknown action.");
}

/** A personal email from the client page, logged on the CRM timeline. */
export async function clientEmail(fd: FormData) {
  const id = field(fd, "userId", 60);
  const path = returnTo(fd, base(id));
  const guard = await requireAdminAction("accounts");
  if (!guard.ok) back(path, "err", guard.error);
  const subject = field(fd, "subject", 200);
  const body = field(fd, "body", 6000);
  if (subject.length < 3 || body.length < 5) back(path, "err", "Add a subject and a message.");
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, name: true, role: true } });
  if (!user) back(path, "err", "That account no longer exists.");
  const mail = await sendMail({ to: user.email, subject, text: body, purpose: "personal" });
  if (!mail.delivered && mail.transport !== "console") back(path, "err", `Not delivered: ${mail.error ?? mail.transport}`);
  const contact = await contactFromUser(user, "manual");
  if (contact) {
    await logActivity(contact.id, "email", subject, body, guard.user.id).catch(() => undefined);
    await prisma.contact.update({ where: { id: contact.id }, data: { lastContactedAt: new Date() } }).catch(() => undefined);
  }
  await audit(guard.user.id, "client.email", "user", id, { subject });
  revalidatePath(base(id));
  back(path, "ok", mail.delivered ? `Sent to ${user.email}.` : "Logged — email isn't configured, so nothing went out.");
}

/** Put the client in the CRM and set a follow-up date. */
export async function clientFollowUp(fd: FormData) {
  const id = field(fd, "userId", 60);
  const path = returnTo(fd, base(id));
  const guard = await requireAdminAction("accounts");
  if (!guard.ok) back(path, "err", guard.error);
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, name: true, role: true } });
  if (!user) back(path, "err", "That account no longer exists.");
  const contact = await contactFromUser(user, "manual");
  if (!contact) back(path, "err", "Could not add to the CRM.");
  const days = Math.min(90, Math.max(0, Math.round(Number(field(fd, "days", 3)) || 0)));
  const when = field(fd, "days", 3) === "" ? null : new Date(Date.now() + days * 86_400_000);
  if (when) await prisma.contact.update({ where: { id: contact.id }, data: { nextFollowUpAt: when } });
  await audit(guard.user.id, "client.followup", "user", id, { days });
  revalidatePath(base(id));
  back(path, "ok", when ? `In the CRM — follow-up ${days === 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`}.` : "Added to the CRM.");
}
