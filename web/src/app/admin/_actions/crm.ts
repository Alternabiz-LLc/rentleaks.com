"use server";

import { revalidatePath } from "next/cache";
import { audit, requireAdminAction } from "@/lib/admin/guard";
import { back, field, fields, returnTo } from "@/lib/admin/flash";
import { logActivity, upsertContact } from "@/lib/crm";
import { csvObjects } from "@/lib/csv";
import {
  CONTACT_KINDS,
  CONTACT_STAGES,
  EMAIL_RE,
  mergeFields,
  normaliseTags,
  parseTags,
  renderEmail,
  textToPlain,
} from "@/lib/marketing";
import { prisma } from "@/lib/prisma";
import { getSetting, SETTING_KEYS } from "@/lib/settings";
import { appUrl } from "@/lib/site";
import { sendMail } from "@/lib/v1/mail";

const kindOf = (v: string) => ((CONTACT_KINDS as readonly string[]).includes(v) ? v : "other");
const stageOf = (v: string) => ((CONTACT_STAGES as readonly string[]).includes(v) ? v : "new");
const dateOf = (v: string) => {
  if (!v) return null;
  const d = new Date(v.length === 10 ? `${v}T09:00:00` : v);
  return Number.isNaN(d.getTime()) ? null : d;
};

export async function addContact(fd: FormData) {
  const path = "/admin/crm";
  const guard = await requireAdminAction();
  if (!guard.ok) back(path, "err", guard.error);
  const email = field(fd, "email", 160).toLowerCase();
  if (!EMAIL_RE.test(email)) back(path, "err", "Enter a valid email.");
  const contact = await upsertContact({
    email,
    name: field(fd, "name", 120),
    phone: field(fd, "phone", 40) || null,
    company: field(fd, "company", 120) || null,
    kind: kindOf(field(fd, "kind")),
    source: "manual",
    tags: normaliseTags(field(fd, "tags", 300)),
    note: field(fd, "note", 1000) || null,
  });
  await logActivity(contact.id, "note", "Added to CRM", field(fd, "note", 1000), guard.user.id);
  await audit(guard.user.id, "contact.add", "contact", contact.id);
  back(`/admin/crm/${contact.id}`, "ok", "Contact saved.");
}

/**
 * CSV import. Columns (any order, header row required): email, name, phone,
 * company, kind, stage, tags, city, consent. `consent` = yes only when the
 * person really opted in to marketing, e.g. an export from a signup form.
 */
export async function importContacts(fd: FormData) {
  const path = "/admin/crm";
  const guard = await requireAdminAction();
  if (!guard.ok) back(path, "err", guard.error);
  let text = field(fd, "csv", 2_000_000);
  const file = fd.get("file");
  if (file instanceof File && file.size) {
    if (file.size > 2_000_000) back(path, "err", "Keep the CSV under 2 MB.");
    text = await file.text();
  }
  const rows = csvObjects(text);
  if (!rows.length) back(path, "err", "No rows found. Include a header row with at least an email column.");
  const extraTags = normaliseTags(field(fd, "tags", 200));
  const consentSource = field(fd, "consentSource", 200);
  let added = 0;
  let skipped = 0;
  for (const r of rows.slice(0, 5000)) {
    const email = (r.email || r.e_mail || r.email_address || "").toLowerCase();
    if (!EMAIL_RE.test(email)) {
      skipped += 1;
      continue;
    }
    const contact = await upsertContact({
      email,
      name: r.name || [r.first_name, r.last_name].filter(Boolean).join(" "),
      phone: r.phone || null,
      company: r.company || null,
      kind: kindOf((r.kind || r.type || "").toLowerCase()),
      source: "import",
      cityId: r.city ? r.city.toLowerCase().replace(/[^a-z0-9-]/g, "") : null,
      tags: [...normaliseTags(r.tags || ""), ...extraTags],
    });
    const consent = /^(yes|true|1|y)$/i.test(r.consent || r.marketing_consent || "");
    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        ...(r.stage ? { stage: stageOf(r.stage.toLowerCase()) } : {}),
        ...(consent && !contact.unsubscribedAt
          ? { marketingConsent: true, consentAt: new Date(), consentSource: consentSource || "import" }
          : {}),
      },
    });
    added += 1;
  }
  await audit(guard.user.id, "contact.import", "contact", "", { added, skipped });
  revalidatePath(path);
  back(path, "ok", `Imported ${added} contact${added === 1 ? "" : "s"}${skipped ? `, skipped ${skipped} without a valid email` : ""}.`);
}

export async function contactsBulk(fd: FormData) {
  const path = returnTo(fd, "/admin/crm");
  const guard = await requireAdminAction();
  if (!guard.ok) back(path, "err", guard.error);
  const ids = fields(fd, "ids").slice(0, 1000);
  const op = field(fd, "op");
  const value = field(fd, "value", 200);
  if (!ids.length) back(path, "err", "Tick at least one contact.");
  if (op === "stage") {
    await prisma.contact.updateMany({ where: { id: { in: ids } }, data: { stage: stageOf(value) } });
  } else if (op === "tag" || op === "untag") {
    const tags = normaliseTags(value);
    if (!tags.length) back(path, "err", "Type a tag in the box.");
    const rows = await prisma.contact.findMany({ where: { id: { in: ids } }, select: { id: true, tags: true } });
    for (const r of rows) {
      const cur = parseTags(r.tags);
      const next = op === "tag" ? normaliseTags([...cur, ...tags]) : cur.filter((t) => !tags.includes(t));
      await prisma.contact.update({ where: { id: r.id }, data: { tags: JSON.stringify(next) } });
    }
  } else if (op === "followup") {
    const at = dateOf(value);
    if (!at) back(path, "err", "Type a date like 2026-10-01 in the box.");
    await prisma.contact.updateMany({ where: { id: { in: ids } }, data: { nextFollowUpAt: at } });
  } else if (op === "kind") {
    await prisma.contact.updateMany({ where: { id: { in: ids } }, data: { kind: kindOf(value) } });
  } else if (op === "invite") {
    const { createInvite, sendInvite } = await import("@/lib/trials");
    const rows = await prisma.contact.findMany({ where: { id: { in: ids }, unsubscribedAt: null }, select: { email: true, name: true } });
    let sent = 0;
    for (const r of rows.slice(0, 50)) {
      const inv = await createInvite({ email: r.email, name: r.name, days: Number(value) || 7, createdById: guard.user.id });
      const res = await sendInvite(inv, undefined, guard.user.id);
      if (res.delivered || res.transport === "console") sent += 1;
    }
    await audit(guard.user.id, "contact.bulk.invite", "contact", "", { count: rows.length });
    back(path, "ok", `${sent} trial invite${sent === 1 ? "" : "s"} sent${rows.length > 50 ? " (first 50 — run again for the rest)" : ""}.`);
  } else back(path, "err", "Choose an action.");
  await audit(guard.user.id, `contact.bulk.${op}`, "contact", "", { count: ids.length, value });
  revalidatePath("/admin", "layout");
  back(path, "ok", `${ids.length} contact${ids.length === 1 ? "" : "s"} updated.`);
}

export async function updateContact(fd: FormData) {
  const id = field(fd, "id", 60);
  const path = `/admin/crm/${id}`;
  const guard = await requireAdminAction();
  if (!guard.ok) back(path, "err", guard.error);
  const contact = await prisma.contact.findUnique({ where: { id } });
  if (!contact) back("/admin/crm", "err", "That contact no longer exists.");
  const stage = stageOf(field(fd, "stage"));
  const consentNow = fd.get("consent") === "on";
  const consentSource = field(fd, "consentSource", 200) || "recorded by founder";
  const data = {
    name: field(fd, "name", 120),
    phone: field(fd, "phone", 40) || null,
    company: field(fd, "company", 120) || null,
    kind: kindOf(field(fd, "kind")),
    stage,
    tags: JSON.stringify(normaliseTags(field(fd, "tags", 300))),
    cityId: field(fd, "cityId", 60) || null,
    note: field(fd, "note", 2000) || null,
    nextFollowUpAt: dateOf(field(fd, "followUp")),
    ...(consentNow !== (contact.marketingConsent && !contact.confirmToken)
      ? consentNow
        ? { marketingConsent: true, consentAt: new Date(), consentSource, confirmToken: null, unsubscribedAt: null }
        : { marketingConsent: false }
      : {}),
  };
  await prisma.contact.update({ where: { id }, data });
  if (stage !== contact.stage) await logActivity(id, "stage", `Stage: ${contact.stage} → ${stage}`, "", guard.user.id);
  if (consentNow && !contact.marketingConsent) {
    await logActivity(id, "note", "Marketing consent recorded", consentSource, guard.user.id);
    await prisma.emailSuppression.delete({ where: { email: contact.email } }).catch(() => undefined);
  }
  await audit(guard.user.id, "contact.edit", "contact", id);
  revalidatePath("/admin", "layout");
  back(path, "ok", "Saved.");
}

export async function addActivity(fd: FormData) {
  const id = field(fd, "id", 60);
  const path = `/admin/crm/${id}`;
  const guard = await requireAdminAction();
  if (!guard.ok) back(path, "err", guard.error);
  const kind = ["note", "call", "sms", "meeting"].includes(field(fd, "kind")) ? field(fd, "kind") : "note";
  const body = field(fd, "body", 5000);
  if (!body) back(path, "err", "Write something first.");
  await logActivity(id, kind, field(fd, "subject", 200) || kind, body, guard.user.id);
  const followUp = dateOf(field(fd, "followUp"));
  await prisma.contact.update({
    where: { id },
    data: {
      ...(kind !== "note" ? { lastContactedAt: new Date() } : {}),
      ...(followUp ? { nextFollowUpAt: followUp } : fd.get("clearFollowUp") === "on" ? { nextFollowUpAt: null } : {}),
    },
  });
  revalidatePath("/admin", "layout");
  back(path, "ok", "Logged.");
}

/** One-to-one email from the founder's mailbox (SMTP first, Resend otherwise). */
export async function emailContact(fd: FormData) {
  const id = field(fd, "id", 60);
  const path = `/admin/crm/${id}`;
  const guard = await requireAdminAction();
  if (!guard.ok) back(path, "err", guard.error);
  const contact = await prisma.contact.findUnique({ where: { id } });
  if (!contact) back("/admin/crm", "err", "That contact no longer exists.");
  let subject = field(fd, "subject", 200);
  let body = field(fd, "body", 20_000);
  const templateId = field(fd, "templateId", 60);
  if (templateId && (!subject || !body)) {
    const t = await prisma.emailTemplate.findUnique({ where: { id: templateId } });
    if (t) {
      subject ||= t.subject;
      body ||= t.body;
    }
  }
  if (!subject || !body) back(path, "err", "Add a subject and a message (or pick a template).");
  const city = contact.cityId ? (await prisma.city.findUnique({ where: { id: contact.cityId }, select: { name: true } }))?.name : undefined;
  const data = { name: contact.name, email: contact.email, city, app_url: appUrl() };
  const address = await getSetting(SETTING_KEYS.mailingAddress, "RentLeaks");
  const finalBody = mergeFields(body, data);
  const { text, html } = renderEmail(finalBody, { address, reason: "Sent to you personally by the RentLeaks founder." });
  const r = await sendMail({ to: contact.email, subject: mergeFields(subject, data), text, html, purpose: "personal" });
  const ok = r.delivered || r.transport === "console";
  await logActivity(id, "email", `${ok ? "Emailed" : "Email failed"}: ${mergeFields(subject, data)}`, ok ? textToPlain(finalBody) : r.error || "", guard.user.id);
  if (ok) {
    await prisma.contact.update({
      where: { id },
      data: { lastContactedAt: new Date(), ...(contact.stage === "new" ? { stage: "contacted" } : {}) },
    });
  }
  await audit(guard.user.id, "contact.email", "contact", id, { transport: r.transport, delivered: r.delivered });
  revalidatePath("/admin", "layout");
  if (r.delivered) back(path, "ok", `Sent via ${r.transport}.`);
  if (r.transport === "console") back(path, "err", "No email provider is configured, so nothing was sent (logged only). See Admin → System.");
  back(path, "err", `Not delivered: ${r.error}`);
}

export async function deleteContact(fd: FormData) {
  const id = field(fd, "id", 60);
  const guard = await requireAdminAction();
  if (!guard.ok) back(`/admin/crm/${id}`, "err", guard.error);
  if (field(fd, "confirm") !== "DELETE") back(`/admin/crm/${id}`, "err", "Type DELETE to confirm.");
  const c = await prisma.contact.delete({ where: { id } }).catch(() => null);
  await audit(guard.user.id, "contact.delete", "contact", id, { email: c?.email });
  revalidatePath("/admin", "layout");
  back("/admin/crm", "ok", "Contact deleted. Their leads and account (if any) are untouched.");
}
