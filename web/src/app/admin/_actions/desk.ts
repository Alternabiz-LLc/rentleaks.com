"use server";

import { revalidatePath } from "next/cache";
import { audit, requireAdminAction } from "@/lib/admin/guard";
import { back, field, fields, returnTo } from "@/lib/admin/flash";
import { contactFromLead, logActivity } from "@/lib/crm";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/leads";
import { CONTACT_STAGES, EMAIL_RE, mergeFields, renderEmail, textToPlain } from "@/lib/marketing";
import { prisma } from "@/lib/prisma";
import { getSetting, SETTING_KEYS } from "@/lib/settings";
import { appUrl } from "@/lib/site";
import { sendMail } from "@/lib/v1/mail";

/**
 * Actions the interactive desk calls directly (boards, drawers, the
 * Next-best board). They return a result instead of redirecting so the card
 * that called them can show what happened in place. Every one checks the
 * founder account first: a server action is a public endpoint.
 */

export type DeskResult = { ok: true; message?: string } | { ok: false; error: string };

const DAY = 86_400_000;

/** Lead board: drag a card to another column. */
export async function moveLead(id: string, status: string): Promise<DeskResult> {
  const guard = await requireAdminAction("leads");
  if (!guard.ok) return guard;
  if (!LEAD_STATUSES.includes(status as LeadStatus)) return { ok: false, error: "Unknown status." };
  const lead = await prisma.lead.findUnique({ where: { id }, select: { id: true, status: true, contactedAt: true, email: true } });
  if (!lead) return { ok: false, error: "That lead no longer exists." };
  if (lead.status === status) return { ok: true };
  await prisma.lead.update({
    where: { id },
    data: { status, ...(status !== "new" && !lead.contactedAt ? { contactedAt: new Date() } : {}) },
  });
  const contact = await prisma.contact.findUnique({ where: { email: lead.email }, select: { id: true } });
  if (contact) await logActivity(contact.id, "stage", `Lead moved ${lead.status} → ${status}`, "", guard.user.id).catch(() => undefined);
  await audit(guard.user.id, "lead.move", "lead", id, { from: lead.status, to: status });
  revalidatePath("/admin", "layout");
  return { ok: true, message: `Moved to ${status}.` };
}

export async function saveLeadNote(id: string, note: string): Promise<DeskResult> {
  const guard = await requireAdminAction("leads");
  if (!guard.ok) return guard;
  await prisma.lead.update({ where: { id }, data: { note: note.trim().slice(0, 1000) || null } }).catch(() => null);
  revalidatePath("/admin/leads");
  return { ok: true, message: "Note saved." };
}

/** CRM board: drag a contact to another stage. */
export async function moveContact(id: string, stage: string): Promise<DeskResult> {
  const guard = await requireAdminAction("crm");
  if (!guard.ok) return guard;
  if (!(CONTACT_STAGES as readonly string[]).includes(stage)) return { ok: false, error: "Unknown stage." };
  const c = await prisma.contact.findUnique({ where: { id }, select: { stage: true } });
  if (!c) return { ok: false, error: "That contact no longer exists." };
  if (c.stage === stage) return { ok: true };
  await prisma.contact.update({ where: { id }, data: { stage } });
  await logActivity(id, "stage", `Stage ${c.stage} → ${stage}`, "", guard.user.id);
  await audit(guard.user.id, "contact.stage", "contact", id, { from: c.stage, to: stage });
  revalidatePath("/admin", "layout");
  return { ok: true, message: `Moved to ${stage}.` };
}

/** Push a follow-up out by some days (the "snooze" on a Next-best card). */
export async function snoozeContact(id: string, days: number): Promise<DeskResult> {
  const guard = await requireAdminAction("crm");
  if (!guard.ok) return guard;
  const d = Math.min(60, Math.max(1, Math.round(days) || 2));
  const at = new Date(Date.now() + d * DAY);
  at.setUTCHours(13, 0, 0, 0);
  const r = await prisma.contact.update({ where: { id }, data: { nextFollowUpAt: at } }).catch(() => null);
  if (!r) return { ok: false, error: "That contact no longer exists." };
  await logActivity(id, "note", `Follow-up moved to ${at.toISOString().slice(0, 10)}`, "", guard.user.id);
  revalidatePath("/admin", "layout");
  return { ok: true, message: `Snoozed until ${at.toISOString().slice(0, 10)}.` };
}

/** Listings board: approve / decline / send back, with the same reason rule as the queue. */
export async function reviewFromBoard(id: string, decision: string, note: string): Promise<DeskResult> {
  const guard = await requireAdminAction("listings");
  if (!guard.ok) return guard;
  if (!["approved", "declined", "pending"].includes(decision)) return { ok: false, error: "Unknown decision." };
  const reason = note.trim().slice(0, 600);
  if (decision === "declined" && reason.length < 8) {
    return { ok: false, error: "Say why, in a sentence. The seller is shown this and will otherwise resubmit the same listing." };
  }
  const listing = await prisma.listing.findUnique({ where: { id }, select: { id: true } });
  if (!listing) return { ok: false, error: "That listing no longer exists." };
  await prisma.listing.update({
    where: { id },
    data: {
      moderation: decision,
      moderationNote: decision === "declined" ? reason : reason || null,
      moderatedAt: new Date(),
      moderatedById: guard.user.id,
    },
  });
  await audit(guard.user.id, `listing.${decision}`, "listing", id, { note: reason || undefined });
  revalidatePath("/admin", "layout");
  revalidatePath("/stays");
  revalidatePath(`/listings/${id}`);
  return { ok: true, message: decision === "approved" ? "Approved — it's live for renters." : decision === "declined" ? "Declined — the seller sees your reason." : "Sent back to review." };
}

/**
 * Send an edited draft from a Next-best card, a lead drawer or a contact.
 * Personal mail: from the founder's mailbox when SMTP is set, Resend
 * otherwise. Logged on the contact's timeline; a lead moves to contacted.
 */
export async function sendDraft(input: { kind: "lead" | "contact"; id: string; subject: string; body: string }): Promise<DeskResult> {
  const guard = await requireAdminAction(input.kind === "lead" ? "leads" : "crm");
  if (!guard.ok) return guard;
  const subject = String(input.subject || "").trim().slice(0, 200);
  const body = String(input.body || "").trim().slice(0, 20_000);
  if (!subject || !body) return { ok: false, error: "Add a subject and a message." };

  let contactId: string | null = null;
  let to = "";
  let name = "";
  let cityId: string | null = null;
  let leadId: string | null = null;

  if (input.kind === "lead") {
    const lead = await prisma.lead.findUnique({ where: { id: input.id } });
    if (!lead) return { ok: false, error: "That lead no longer exists." };
    leadId = lead.id;
    to = lead.email;
    name = lead.name;
    cityId = lead.cityId;
    const c =
      (await prisma.contact.findUnique({ where: { email: lead.email }, select: { id: true } })) ??
      (await contactFromLead({ ...lead, summary: lead.message || `Lead: ${lead.kind}` }));
    contactId = c?.id ?? null;
  } else {
    const c = await prisma.contact.findUnique({ where: { id: input.id } });
    if (!c) return { ok: false, error: "That contact no longer exists." };
    contactId = c.id;
    to = c.email;
    name = c.name;
    cityId = c.cityId;
  }
  if (!EMAIL_RE.test(to)) return { ok: false, error: `${to || "This person"} has no valid email address.` };

  const city = cityId ? (await prisma.city.findUnique({ where: { id: cityId }, select: { name: true } }))?.name : undefined;
  const data = { name, email: to, city, app_url: appUrl() };
  const finalBody = mergeFields(body, data);
  const finalSubject = mergeFields(subject, data);
  const address = await getSetting(SETTING_KEYS.mailingAddress, "RentLeaks");
  const { text, html } = renderEmail(finalBody, { address, reason: "Sent to you personally by the RentLeaks founder." });
  const r = await sendMail({ to, subject: finalSubject, text, html, purpose: "personal" });
  const delivered = r.delivered;

  if (contactId) {
    await logActivity(contactId, "email", `${delivered ? "Emailed" : "Email not sent"}: ${finalSubject}`, delivered ? textToPlain(finalBody) : r.error || "no email provider", guard.user.id);
    if (delivered) {
      const cur = await prisma.contact.findUnique({ where: { id: contactId }, select: { stage: true, nextFollowUpAt: true } });
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          lastContactedAt: new Date(),
          ...(cur?.stage === "new" ? { stage: "contacted" } : {}),
          // A sent follow-up clears the due date and books the next one.
          ...(cur?.nextFollowUpAt && cur.nextFollowUpAt <= new Date() ? { nextFollowUpAt: new Date(Date.now() + 4 * DAY) } : {}),
        },
      });
    }
  }
  if (delivered && leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { status: true, contactedAt: true } });
    if (lead) {
      await prisma.lead.update({
        where: { id: leadId },
        data: { ...(lead.status === "new" ? { status: "contacted" } : {}), ...(lead.contactedAt ? {} : { contactedAt: new Date() }) },
      });
    }
  }
  await audit(guard.user.id, "desk.email", input.kind, input.id, { transport: r.transport, delivered });
  revalidatePath("/admin", "layout");

  if (delivered) return { ok: true, message: `Sent to ${to} via ${r.transport}.` };
  if (r.transport === "console") return { ok: false, error: "No email provider is set up yet, so nothing was sent. Add the Resend key (Admin → System)." };
  return { ok: false, error: `Not delivered: ${r.error}` };
}

/** Accounts: the floating bulk bar. */
export async function accountsBulk(fd: FormData) {
  const path = returnTo(fd, "/admin/accounts");
  const guard = await requireAdminAction("accounts");
  if (!guard.ok) back(path, "err", guard.error);
  const op = field(fd, "op", 20);
  const picked = fields(fd, "ids")
    .filter((id) => id !== guard.user.id)
    .slice(0, 500);
  /* Desk accounts (founder, staff) are never touched by bulk actions. */
  const ids = (await prisma.user.findMany({ where: { id: { in: picked }, role: { notIn: ["admin", "staff"] } }, select: { id: true } })).map((u) => u.id);
  if (!ids.length) back(path, "err", "Tick at least one account. Your own and team accounts are skipped.");
  const now = new Date();
  let count = 0;
  if (op === "verify" || op === "unverify") {
    const status = op === "verify" ? "verified" : "unverified";
    for (const userId of ids) {
      await prisma.identityVerification.upsert({
        where: { userId },
        update: { status, verifiedAt: op === "verify" ? now : null, provider: "manual" },
        create: { userId, status, provider: "manual", verifiedAt: op === "verify" ? now : null },
      });
      count += 1;
    }
  } else if (op === "trial") {
    const days = Math.min(90, Math.max(1, Math.round(Number(field(fd, "value")) || 7)));
    const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, trialEndsAt: true } });
    for (const u of users) {
      const base = u.trialEndsAt && u.trialEndsAt > now ? u.trialEndsAt : now;
      await prisma.user.update({ where: { id: u.id }, data: { trialEndsAt: new Date(base.getTime() + days * DAY) } });
      count += 1;
    }
  } else if (op === "signout") {
    count = (await prisma.session.deleteMany({ where: { userId: { in: ids } } })).count;
  } else if (op === "host" || op === "renter") {
    count = (await prisma.user.updateMany({ where: { id: { in: ids }, role: { notIn: ["admin", "staff"] } }, data: { role: op } })).count;
  } else {
    back(path, "err", "Choose an action.");
  }
  await audit(guard.user.id, `account.bulk.${op}`, "user", "", { ids: ids.slice(0, 50), count });
  revalidatePath("/admin", "layout");
  back(path, "ok", `${op}: ${count} updated.`);
}

/** Leads: the floating bulk bar (set status). */
export async function leadsBulk(fd: FormData) {
  const path = returnTo(fd, "/admin/leads");
  const guard = await requireAdminAction("leads");
  if (!guard.ok) back(path, "err", guard.error);
  const ids = fields(fd, "ids").slice(0, 500);
  const op = field(fd, "op", 20);
  if (!ids.length) back(path, "err", "Tick at least one lead.");
  if (!LEAD_STATUSES.includes(op as LeadStatus)) back(path, "err", "Choose a status.");
  const r = await prisma.lead.updateMany({ where: { id: { in: ids } }, data: { status: op } });
  if (op !== "new") await prisma.lead.updateMany({ where: { id: { in: ids }, contactedAt: null }, data: { contactedAt: new Date() } });
  await audit(guard.user.id, `lead.bulk.${op}`, "lead", "", { ids: ids.slice(0, 50), count: r.count });
  revalidatePath("/admin", "layout");
  back(path, "ok", `${r.count} lead${r.count === 1 ? "" : "s"} marked ${op}.`);
}
