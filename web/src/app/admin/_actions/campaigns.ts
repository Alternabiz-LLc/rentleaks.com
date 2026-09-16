"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { audit, requireAdminAction } from "@/lib/admin/guard";
import { back, field, fields } from "@/lib/admin/flash";
import {
  CAMPAIGN_KINDS,
  coerceAudience,
  EMAIL_RE,
  mergeFields,
  normaliseTags,
  renderEmail,
  unsubscribeToken,
} from "@/lib/marketing";
import { CAMPAIGN_REASON, mailingAddress, sendCampaignBatch, startCampaign } from "@/lib/outbox";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/site";
import { STARTER_TEMPLATES } from "@/lib/templates";
import { sendMail } from "@/lib/v1/mail";

/* --- templates ---------------------------------------------------------- */

export async function saveTemplate(fd: FormData) {
  const path = "/admin/outreach?tab=templates";
  const guard = await requireAdminAction();
  if (!guard.ok) back(path, "err", guard.error);
  const id = field(fd, "id", 60);
  const name = field(fd, "name", 120);
  const subject = field(fd, "subject", 200);
  const body = field(fd, "body", 20_000);
  const purpose = ["outreach", "newsletter", "bulk", "trial"].includes(field(fd, "purpose")) ? field(fd, "purpose") : "outreach";
  if (!name || !subject || !body) back(path, "err", "Name, subject and body are required.");
  if (id) await prisma.emailTemplate.update({ where: { id }, data: { name, subject, body, purpose } });
  else await prisma.emailTemplate.create({ data: { name, subject, body, purpose } });
  await audit(guard.user.id, id ? "template.edit" : "template.create", "template", id, { name });
  revalidatePath(path);
  back(path, "ok", `Template “${name}” saved.`);
}

export async function deleteTemplate(fd: FormData) {
  const path = "/admin/outreach?tab=templates";
  const guard = await requireAdminAction();
  if (!guard.ok) back(path, "err", guard.error);
  const id = field(fd, "id", 60);
  await prisma.emailTemplate.delete({ where: { id } }).catch(() => undefined);
  await audit(guard.user.id, "template.delete", "template", id);
  back(path, "ok", "Template deleted.");
}

export async function loadStarterTemplates() {
  const path = "/admin/outreach?tab=templates";
  const guard = await requireAdminAction();
  if (!guard.ok) back(path, "err", guard.error);
  const existing = new Set((await prisma.emailTemplate.findMany({ select: { name: true } })).map((t) => t.name));
  const fresh = STARTER_TEMPLATES.filter((t) => !existing.has(t.name));
  if (fresh.length) await prisma.emailTemplate.createMany({ data: fresh });
  await audit(guard.user.id, "template.starters", "template", "", { added: fresh.length });
  back(path, "ok", fresh.length ? `Added ${fresh.length} starter templates.` : "Starter templates are already loaded.");
}

/* --- campaigns ---------------------------------------------------------- */

function audienceFrom(fd: FormData, kind: string) {
  return coerceAudience(
    {
      kinds: fields(fd, "kinds"),
      stages: fields(fd, "stages"),
      tags: normaliseTags(field(fd, "tags", 300)),
      cityId: field(fd, "cityId", 60),
      consentOnly: fd.get("consentOnly") === "on",
    },
    kind,
  );
}

export async function createCampaign(fd: FormData) {
  const path = "/admin/campaigns";
  const guard = await requireAdminAction();
  if (!guard.ok) back(path, "err", guard.error);
  const kind = (CAMPAIGN_KINDS as readonly string[]).includes(field(fd, "kind")) ? field(fd, "kind") : "newsletter";
  let subject = field(fd, "subject", 200);
  let body = field(fd, "body", 50_000);
  const templateId = field(fd, "templateId", 60);
  let templateName = "";
  if (templateId) {
    const t = await prisma.emailTemplate.findUnique({ where: { id: templateId } });
    if (t) {
      subject ||= t.subject;
      body ||= t.body;
      templateName = `${t.name} · ${new Date().toISOString().slice(0, 10)}`;
    }
  }
  const name = field(fd, "name", 120) || templateName || subject || "Untitled campaign";
  const c = await prisma.campaign.create({
    data: {
      name,
      kind,
      subject: subject || "(no subject)",
      body: body || "Hi {{first_name}},\n\n",
      audience: audienceFrom(fd, kind) as Prisma.InputJsonValue,
      createdById: guard.user.id,
    },
  });
  await audit(guard.user.id, "campaign.create", "campaign", c.id, { name, kind });
  back(`/admin/campaigns/${c.id}`, "ok", "Draft created. Review the preview and audience, then send or schedule.");
}

export async function updateCampaign(fd: FormData) {
  const id = field(fd, "id", 60);
  const path = `/admin/campaigns/${id}`;
  const guard = await requireAdminAction();
  if (!guard.ok) back(path, "err", guard.error);
  const c = await prisma.campaign.findUnique({ where: { id } });
  if (!c) back("/admin/campaigns", "err", "That campaign no longer exists.");
  if (!["draft", "scheduled"].includes(c.status)) back(path, "err", "Only drafts can be edited.");
  const kind = (CAMPAIGN_KINDS as readonly string[]).includes(field(fd, "kind")) ? field(fd, "kind") : c.kind;
  await prisma.campaign.update({
    where: { id },
    data: {
      name: field(fd, "name", 120) || c.name,
      kind,
      subject: field(fd, "subject", 200) || c.subject,
      body: field(fd, "body", 50_000) || c.body,
      audience: audienceFrom(fd, kind) as Prisma.InputJsonValue,
    },
  });
  await audit(guard.user.id, "campaign.edit", "campaign", id);
  back(path, "ok", "Saved.");
}

export async function testCampaign(fd: FormData) {
  const id = field(fd, "id", 60);
  const path = `/admin/campaigns/${id}`;
  const guard = await requireAdminAction();
  if (!guard.ok) back(path, "err", guard.error);
  const to = (field(fd, "to", 160) || guard.user.email).toLowerCase();
  if (!EMAIL_RE.test(to)) back(path, "err", "Enter a valid address.");
  const c = await prisma.campaign.findUnique({ where: { id } });
  if (!c) back("/admin/campaigns", "err", "That campaign no longer exists.");
  const unsub = `${appUrl()}/u/${unsubscribeToken(to)}`;
  const data = { name: guard.user.name, email: to, city: "New York", app_url: appUrl(), unsubscribe_link: unsub };
  const { text, html } = renderEmail(mergeFields(c.body, data), {
    address: (await mailingAddress()) || "(mailing address not set — Admin → System)",
    reason: CAMPAIGN_REASON[c.kind] || CAMPAIGN_REASON.bulk,
    unsubscribeUrl: unsub,
  });
  const r = await sendMail({ to, subject: `[TEST] ${mergeFields(c.subject, data)}`, text, html, purpose: "bulk" });
  if (r.delivered) back(path, "ok", `Test sent to ${to}.`);
  back(path, "err", r.transport === "console" ? "No email provider configured yet (Admin → System)." : `Not delivered: ${r.error}`);
}

export async function scheduleCampaign(fd: FormData) {
  const id = field(fd, "id", 60);
  const path = `/admin/campaigns/${id}`;
  const guard = await requireAdminAction();
  if (!guard.ok) back(path, "err", guard.error);
  const op = field(fd, "op");
  const c = await prisma.campaign.findUnique({ where: { id } });
  if (!c) back("/admin/campaigns", "err", "That campaign no longer exists.");

  if (op === "cancel") {
    if (!["scheduled", "sending"].includes(c.status)) back(path, "err", "Nothing to cancel.");
    await prisma.$transaction([
      prisma.campaign.update({ where: { id }, data: { status: c.status === "scheduled" ? "draft" : "cancelled", scheduledAt: null } }),
      prisma.campaignSend.updateMany({ where: { campaignId: id, status: "queued" }, data: { status: "skipped", error: "cancelled" } }),
    ]);
    await audit(guard.user.id, "campaign.cancel", "campaign", id);
    back(path, "ok", c.status === "scheduled" ? "Unscheduled — back to draft." : "Stopped. Emails already sent can't be recalled.");
  }
  if (op === "batch") {
    if (c.status !== "sending") back(path, "err", "The campaign isn't sending.");
    const r = await sendCampaignBatch(25, id);
    back(path, "ok", `Sent ${r.sent}, failed ${r.failed}, skipped ${r.skipped}. ${r.remaining} still queued — the outbox sends the rest every 5 minutes.`);
  }
  if (!["draft", "scheduled"].includes(c.status)) back(path, "err", `The campaign is already ${c.status}.`);
  if (field(fd, "confirm") !== "SEND") back(path, "err", "Type SEND to confirm.");
  if (op === "schedule") {
    const when = new Date(field(fd, "at"));
    if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() + 60_000) back(path, "err", "Pick a time in the future.");
    if (!(await mailingAddress())) back(path, "err", "Add your mailing address in Admin → System first.");
    await prisma.campaign.update({ where: { id }, data: { status: "scheduled", scheduledAt: when } });
    await audit(guard.user.id, "campaign.schedule", "campaign", id, { at: when.toISOString() });
    back(path, "ok", `Scheduled for ${when.toISOString().replace("T", " ").slice(0, 16)} UTC.`);
  }
  if (op === "now") {
    const r = await startCampaign(id);
    if (!r.ok) back(path, "err", r.error);
    await audit(guard.user.id, "campaign.send", "campaign", id, { total: r.total });
    const b = await sendCampaignBatch(15, id);
    revalidatePath("/admin/campaigns");
    back(path, "ok", `Sending to ${r.total} people. First ${b.sent} sent; the outbox sends the rest every 5 minutes.`);
  }
  back(path, "err", "Unknown action.");
}

export async function duplicateCampaign(fd: FormData) {
  const id = field(fd, "id", 60);
  const guard = await requireAdminAction();
  if (!guard.ok) back(`/admin/campaigns/${id}`, "err", guard.error);
  const c = await prisma.campaign.findUnique({ where: { id } });
  if (!c) back("/admin/campaigns", "err", "That campaign no longer exists.");
  const copy = await prisma.campaign.create({
    data: {
      name: `${c.name} (copy)`,
      kind: c.kind,
      subject: c.subject,
      body: c.body,
      audience: c.audience as Prisma.InputJsonValue,
      createdById: guard.user.id,
    },
  });
  back(`/admin/campaigns/${copy.id}`, "ok", "Copied as a new draft.");
}
