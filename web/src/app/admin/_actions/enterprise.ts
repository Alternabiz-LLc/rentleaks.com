"use server";

import { revalidatePath } from "next/cache";
import { canAccess } from "@/lib/access";
import { audit, requireAdminAction } from "@/lib/admin/guard";
import { back, field, fields, returnTo } from "@/lib/admin/flash";
import { fmtCents, invoiceTotals, ISO, parseMoney, type InvoiceItem } from "@/lib/books/core";
import { booksSettings, booksToday, nextInvoiceNumber } from "@/lib/books/data";
import { logActivity, upsertContact } from "@/lib/crm";
import {
  ENGAGEMENT_STAGE,
  ENGAGEMENT_STATUSES,
  engagementValue,
  FEE_LABEL,
  isFeeModel,
  monthName,
  PACKAGE,
  parsePct,
  pctLabel,
  PROPERTY_KINDS,
  PROPERTY_STATUSES,
  REQUEST_STAGE,
  REQUEST_STATUSES,
  SERVICE,
  statementTotals,
  TRACKS,
  brokerLine,
  type EngagementStatus,
  type RequestStatus,
  type ServiceId,
  type TrackId,
} from "@/lib/enterprise/catalog";
import { engagementTitle, enterpriseSettings, seedTasks, sendStatement, type ExpenseLine } from "@/lib/enterprise/data";
import { prisma } from "@/lib/prisma";
import { setSetting, SETTING_KEYS } from "@/lib/settings";
import { sendMail } from "@/lib/v1/mail";

type DeskResult = { ok: true; message?: string } | { ok: false; error: string };

const PATH = "/admin/enterprise";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

async function timeline(email: string, kind: string, subject: string, body: string, actorId: string) {
  const c = await prisma.contact.findUnique({ where: { email: email.toLowerCase() }, select: { id: true } });
  if (c) await logActivity(c.id, kind, subject, body, actorId).catch(() => undefined);
}

function listOf(json: string): string[] {
  try {
    const v = JSON.parse(json) as unknown;
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------------
   Requests
   ------------------------------------------------------------------------ */

/** Board drag: move a request along the pipeline. */
export async function moveRequest(id: string, status: string): Promise<DeskResult> {
  const guard = await requireAdminAction("enterprise");
  if (!guard.ok) return guard;
  if (!(REQUEST_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "Unknown stage." };
  const r = await prisma.serviceRequest.findUnique({ where: { id } });
  if (!r) return { ok: false, error: "That request no longer exists." };
  if (status === "won" && !r.engagementId) return { ok: false, error: "Create the engagement from the request first — it moves to Won by itself." };
  await prisma.serviceRequest.update({
    where: { id },
    data: { status, contactedAt: r.contactedAt ?? (status !== "new" ? new Date() : null), lostReason: status === "lost" ? (r.lostReason ?? "Moved to lost from the board") : r.lostReason },
  });
  await timeline(r.email, "stage", `Enterprise request: ${REQUEST_STAGE[status as Exclude<RequestStatus, "spam">]?.label ?? status}`, "", guard.user.id);
  await audit(guard.user.id, "enterprise.request.stage", "serviceRequest", id, { from: r.status, to: status });
  revalidatePath(PATH);
  return { ok: true, message: `moved to ${REQUEST_STAGE[status as Exclude<RequestStatus, "spam">]?.label ?? status}` };
}

export async function requestAction(fd: FormData) {
  const path = returnTo(fd, PATH);
  const guard = await requireAdminAction("enterprise");
  if (!guard.ok) back(path, "err", guard.error);
  const id = field(fd, "id", 60);
  const op = field(fd, "op", 20);
  const r = await prisma.serviceRequest.findUnique({ where: { id } });
  if (!r) back(path, "err", "That request no longer exists.");
  const me = guard.user;
  switch (op) {
    case "note":
      await prisma.serviceRequest.update({ where: { id }, data: { note: field(fd, "note", 2000) || null } });
      return back(path, "ok", "Note saved.");
    case "mine":
      await prisma.serviceRequest.update({ where: { id }, data: { assignedToId: me.id } });
      return back(path, "ok", "It's yours.");
    case "contacted":
      await prisma.serviceRequest.update({ where: { id }, data: { status: r.status === "new" ? "contacted" : r.status, contactedAt: r.contactedAt ?? new Date() } });
      await timeline(r.email, "call", "Enterprise request: contacted", "", me.id);
      revalidatePath(PATH);
      return back(path, "ok", "Marked as contacted.");
    case "lost": {
      const reason = field(fd, "reason", 200);
      if (!reason) back(path, "err", "Say why it was lost — it's how the menu gets better.");
      await prisma.serviceRequest.update({ where: { id }, data: { status: "lost", lostReason: reason } });
      await timeline(r.email, "stage", "Enterprise request lost", reason, me.id);
      await audit(me.id, "enterprise.request.lost", "serviceRequest", id, { reason });
      revalidatePath(PATH);
      return back(path, "ok", "Marked lost.");
    }
    case "spam":
      await prisma.serviceRequest.update({ where: { id }, data: { status: "spam" } });
      await audit(me.id, "enterprise.request.spam", "serviceRequest", id);
      revalidatePath(PATH);
      return back(path.replace(/([?&])open=[^&#]*&?/, "$1"), "ok", "Marked as spam.");
    case "reply": {
      const subject = field(fd, "subject", 200);
      const body = String(fd.get("body") ?? "").trim().slice(0, 8000);
      if (!subject || body.length < 10) back(path, "err", "Write a subject and a message.");
      const { broker } = await enterpriseSettings();
      const sig = brokerLine(broker);
      const mail = await sendMail({ to: r.email, subject, text: `${body}${sig ? `\n\n—\n${sig}` : ""}`, replyTo: me.email, purpose: "personal" });
      if (!mail.delivered && mail.transport !== "console") back(path, "err", mail.error ?? "Not delivered.");
      await prisma.serviceRequest.update({ where: { id }, data: { status: r.status === "new" ? "contacted" : r.status, contactedAt: r.contactedAt ?? new Date() } });
      await timeline(r.email, "email", subject, body, me.id);
      await audit(me.id, "enterprise.request.reply", "serviceRequest", id);
      revalidatePath(PATH);
      return back(path, "ok", mail.delivered ? `Sent to ${r.email}.` : "Logged — email isn't configured, so nothing went out.");
    }
    case "delete":
      if (!guard.founder) back(path, "err", "Only the account owner can delete requests.");
      await prisma.serviceRequest.delete({ where: { id } });
      await audit(me.id, "enterprise.request.delete", "serviceRequest", id);
      revalidatePath(PATH);
      return back(PATH, "ok", "Request deleted.");
  }
  return back(path, "err", "Unknown action.");
}

/* ------------------------------------------------------------------------
   Engagements
   ------------------------------------------------------------------------ */

export async function moveEngagement(id: string, status: string): Promise<DeskResult> {
  const guard = await requireAdminAction("enterprise");
  if (!guard.ok) return guard;
  if (!(ENGAGEMENT_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "Unknown stage." };
  const e = await prisma.engagement.findUnique({ where: { id } });
  if (!e) return { ok: false, error: "That engagement no longer exists." };
  if ((status === "signed" || status === "active") && isLicensedTrack(e.track) && !e.agreementSignedOn) {
    return { ok: false, error: "Licensed work starts only with a signed agreement — add the signing date in the engagement first." };
  }
  await prisma.engagement.update({ where: { id }, data: { status, startDate: e.startDate ?? (status === "active" || status === "signed" ? booksToday() : null) } });
  if (status === "signed" || status === "active") await seedTasks(id, e.packageId);
  await timeline(e.clientEmail, "stage", `Engagement: ${ENGAGEMENT_STAGE[status as EngagementStatus].label}`, e.title, guard.user.id);
  await audit(guard.user.id, "enterprise.engagement.stage", "engagement", id, { from: e.status, to: status });
  revalidatePath(PATH);
  return { ok: true, message: `moved to ${ENGAGEMENT_STAGE[status as EngagementStatus].label}` };
}

function isLicensedTrack(track: string) {
  return track === "brokerage" || track === "management" || track === "owners";
}

export async function saveEngagement(fd: FormData) {
  const path = returnTo(fd, PATH);
  const guard = await requireAdminAction("enterprise");
  if (!guard.ok) back(path, "err", guard.error);
  const id = field(fd, "id", 60);
  const requestId = field(fd, "requestId", 60) || null;
  const req = requestId ? await prisma.serviceRequest.findUnique({ where: { id: requestId } }) : null;
  const clientName = field(fd, "clientName", 120) || req?.name || "";
  const clientEmail = (field(fd, "clientEmail", 200) || req?.email || "").toLowerCase();
  if (clientName.length < 2 || !EMAIL.test(clientEmail)) back(path, "err", "Add the client's name and email.");
  const packageId = PACKAGE.has(field(fd, "packageId", 40)) ? field(fd, "packageId", 40) : null;
  const pkg = packageId ? PACKAGE.get(packageId)! : null;
  const trackRaw = field(fd, "track", 20);
  const track: TrackId = pkg?.track ?? (TRACKS.some((t) => t.id === trackRaw) ? (trackRaw as TrackId) : "marketing");
  const feeRaw = field(fd, "feeModel", 20);
  const feeModel = isFeeModel(feeRaw) ? feeRaw : (pkg?.fee ?? "monthly");
  const amountRaw = field(fd, "amount", 20);
  const amount = amountRaw ? parseMoney(amountRaw) : 0;
  if (amount === null || amount < 0) back(path, "err", "The amount should look like 1500 or 1,500.00.");
  const pctRaw = field(fd, "pct", 8);
  const pct = pctRaw ? parsePct(pctRaw) : 0;
  if (pct === null) back(path, "err", "The percentage should look like 8 or 8.5.");
  if ((feeModel === "percent" || feeModel === "commission") && !pct) back(path, "err", `${FEE_LABEL[feeModel]} needs a percentage.`);
  const rentRaw = field(fd, "rentRoll", 20);
  const rentRoll = rentRaw ? parseMoney(rentRaw) : 0;
  if (rentRoll === null || rentRoll < 0) back(path, "err", "Monthly rent should look like 12,400.");
  const units = Math.max(0, Math.min(100_000, Math.round(Number(field(fd, "units", 8)) || req?.units || 0)));
  const statusRaw = field(fd, "status", 20);
  const status = (ENGAGEMENT_STATUSES as readonly string[]).includes(statusRaw) ? statusRaw : "proposal";
  const signedOn = ISO.test(field(fd, "agreementSignedOn", 10)) ? field(fd, "agreementSignedOn", 10) : null;
  if ((status === "signed" || status === "active") && isLicensedTrack(track) && !signedOn) {
    return back(path, "err", "Licensed work starts only with a signed agreement — add the date it was signed.");
  }
  const services = fields(fd, "services").filter((s): s is ServiceId => SERVICE.has(s as ServiceId));
  const company = field(fd, "clientCompany", 120) || req?.company || null;
  const user = await prisma.user.findUnique({ where: { email: clientEmail }, select: { id: true } });
  const data = {
    title: field(fd, "title", 160) || engagementTitle(clientName, company, packageId),
    clientName,
    clientEmail,
    clientCompany: company,
    clientPhone: field(fd, "clientPhone", 40) || req?.phone || null,
    userId: user?.id ?? null,
    track,
    packageId,
    services: JSON.stringify(services.length ? services : (pkg?.services ?? listOf(req?.services ?? "[]"))),
    status,
    feeModel,
    amountCents: amount ?? 0,
    pctBp: pct ?? 0,
    units,
    rentRollCents: rentRoll ?? 0,
    market: field(fd, "market", 80) || req?.market || null,
    address: field(fd, "address", 200) || req?.address || null,
    ownerLocation: field(fd, "ownerLocation", 80) || req?.ownerLocation || null,
    agreementRef: field(fd, "agreementRef", 300) || null,
    agreementSignedOn: signedOn,
    startDate: ISO.test(field(fd, "startDate", 10)) ? field(fd, "startDate", 10) : status === "signed" || status === "active" ? booksToday() : null,
    endDate: ISO.test(field(fd, "endDate", 10)) ? field(fd, "endDate", 10) : null,
    note: field(fd, "note", 2000) || null,
  };
  let saved;
  if (id) {
    saved = await prisma.engagement.update({ where: { id }, data });
  } else {
    saved = await prisma.engagement.create({ data: { ...data, requestId, ownerId: guard.user.id } });
    if (req) await prisma.serviceRequest.update({ where: { id: req.id }, data: { engagementId: saved.id, status: status === "proposal" ? "proposal" : "won", contactedAt: req.contactedAt ?? new Date() } });
    try {
      const c = await upsertContact({ email: clientEmail, name: clientName, company, phone: data.clientPhone, kind: "partner", source: "manual", tags: ["enterprise", `track:${track}`] });
      await prisma.contact.update({ where: { id: c.id }, data: { stage: status === "proposal" ? "qualified" : "customer" } });
    } catch {
      /* the CRM is best effort */
    }
  }
  if (id && saved.requestId && (status === "signed" || status === "active" || status === "completed")) {
    await prisma.serviceRequest.update({ where: { id: saved.requestId }, data: { status: "won" } }).catch(() => undefined);
  }
  if (status === "signed" || status === "active") {
    await seedTasks(saved.id, packageId, saved.startDate ?? booksToday());
    await prisma.contact.updateMany({ where: { email: clientEmail }, data: { stage: "customer" } }).catch(() => undefined);
  }
  await timeline(clientEmail, "stage", id ? "Engagement updated" : "Engagement created", `${saved.title} · ${ENGAGEMENT_STAGE[status as EngagementStatus].label}`, guard.user.id);
  await audit(guard.user.id, id ? "enterprise.engagement.edit" : "enterprise.engagement.create", "engagement", saved.id, { status, feeModel, value: engagementValue(saved) });
  revalidatePath(PATH);
  return back(`${PATH}?tab=engagements&eng=${saved.id}`, "ok", id ? "Engagement saved." : "Engagement created.");
}

export async function engagementAction(fd: FormData) {
  const path = returnTo(fd, PATH);
  const guard = await requireAdminAction("enterprise");
  if (!guard.ok) back(path, "err", guard.error);
  const id = field(fd, "id", 60);
  const op = field(fd, "op", 20);
  const e = await prisma.engagement.findUnique({ where: { id }, include: { tasks: true } });
  if (!e) back(path, "err", "That engagement no longer exists.");
  const me = guard.user;
  switch (op) {
    case "task": {
      const taskId = field(fd, "taskId", 60);
      const t = e.tasks.find((x) => x.id === taskId);
      if (!t) back(path, "err", "That step no longer exists.");
      await prisma.engagementTask.update({ where: { id: t.id }, data: t.doneAt ? { doneAt: null, doneById: null } : { doneAt: new Date(), doneById: me.id } });
      if (!t.doneAt) await timeline(e.clientEmail, "note", `Done: ${t.title}`, e.title, me.id);
      revalidatePath(PATH);
      return back(path, "ok", t.doneAt ? "Step reopened." : `Done: ${t.title}`);
    }
    case "addtask": {
      const title = field(fd, "title", 160);
      if (title.length < 3) back(path, "err", "Name the step.");
      const due = ISO.test(field(fd, "dueDate", 10)) ? field(fd, "dueDate", 10) : null;
      await prisma.engagementTask.create({ data: { engagementId: e.id, title, dueDate: due, position: e.tasks.length } });
      revalidatePath(PATH);
      return back(path, "ok", "Step added.");
    }
    case "deltask": {
      const taskId = field(fd, "taskId", 60);
      await prisma.engagementTask.deleteMany({ where: { id: taskId, engagementId: e.id } });
      revalidatePath(PATH);
      return back(path, "ok", "Step removed.");
    }
    case "seed": {
      const n = await seedTasks(e.id, e.packageId, e.startDate ?? booksToday());
      revalidatePath(PATH);
      return back(path, n ? "ok" : "err", n ? `${n} steps added from the package.` : "The checklist already has steps, or there's no package.");
    }
    case "proposal": {
      const { broker } = await enterpriseSettings();
      const pkg = e.packageId ? PACKAGE.get(e.packageId) : undefined;
      const v = engagementValue(e);
      const fee =
        e.feeModel === "percent"
          ? `${pctLabel(e.pctBp)} of rent collected${e.amountCents ? ` plus ${fmtCents(e.amountCents, e.currency)} a month` : ""}`
          : e.feeModel === "commission"
            ? `${pctLabel(e.pctBp)} of first-year rent per lease, paid by the owner${e.amountCents ? `, plus ${fmtCents(e.amountCents, e.currency)}` : ""}`
            : e.feeModel === "per_unit"
              ? `${fmtCents(e.amountCents, e.currency)} per unit per month (${e.units} units: ${fmtCents(v.monthly, e.currency)} a month)`
              : e.feeModel === "monthly"
                ? `${fmtCents(e.amountCents, e.currency)} a month`
                : `${fmtCents(e.amountCents, e.currency)}, one time`;
      const first = e.clientName.split(" ")[0];
      const scope = pkg ? pkg.includes.map((x) => `• ${x}`).join("\n") : listOf(e.services).map((s) => `• ${SERVICE.get(s as ServiceId)?.title ?? s}`).join("\n");
      const steps = (e.tasks.length ? e.tasks.map((t) => t.title) : (pkg?.tasks ?? [])).slice(0, 8).map((t, i) => `${i + 1}. ${t}`).join("\n");
      const licensed = isLicensedTrack(e.track);
      const text =
        `Hi ${first},\n\nThank you for the time. Here is what we propose for ${e.address || e.market || "your property"}.\n\n` +
        `${pkg ? `${pkg.name} — ${pkg.tagline}\n` : ""}${scope}\n\nFee: ${fee}.\n\nHow we'd start:\n${steps || "1. Kick-off call"}\n\n` +
        (licensed ? "Brokerage and management work begins once the agreement is signed. We work for you, the owner; renters are never charged a fee for our leasing work.\n\n" : "") +
        `Reply to this email with any questions, or to go ahead.\n\n${me.name}\n${broker.name || "RentLeaks Enterprise"}${brokerLine(broker) ? `\n${brokerLine(broker)}` : ""}`;
      const mail = await sendMail({ to: e.clientEmail, subject: `Proposal: ${e.title}`, text, replyTo: me.email, purpose: "personal" });
      if (!mail.delivered && mail.transport !== "console") back(path, "err", mail.error ?? "Not delivered.");
      await prisma.engagement.update({ where: { id: e.id }, data: { proposalSentAt: new Date() } });
      await timeline(e.clientEmail, "email", `Proposal sent: ${e.title}`, text, me.id);
      if (e.requestId) await prisma.serviceRequest.update({ where: { id: e.requestId }, data: { status: "proposal" } }).catch(() => undefined);
      await audit(me.id, "enterprise.engagement.proposal", "engagement", e.id);
      revalidatePath(PATH);
      return back(path, "ok", mail.delivered ? `Proposal sent to ${e.clientEmail}.` : "Logged — email isn't configured, so nothing went out.");
    }
    case "bill": {
      if (!canAccess(me, "books")) back(path, "err", "Billing needs Books access.");
      const v = engagementValue(e);
      const month = monthName(booksToday().slice(0, 7));
      const pkg = e.packageId ? PACKAGE.get(e.packageId) : undefined;
      const name = pkg ? pkg.name : "Services";
      let items: InvoiceItem[];
      if (e.feeModel === "per_unit") items = [{ description: `${name} — ${month} (${e.units} units)`, quantity: e.units, unitCents: e.amountCents }];
      else if (e.feeModel === "monthly" || e.feeModel === "percent") items = [{ description: `${name} — ${month}`, quantity: 1, unitCents: v.monthly }];
      else if (e.feeModel === "commission") items = [{ description: `Leasing commission — ${e.address || e.market || e.title}`, quantity: 1, unitCents: v.once }];
      else items = [{ description: `${name} — ${e.address || e.market || e.title}`, quantity: 1, unitCents: e.amountCents }];
      items = items.filter((i) => i.unitCents > 0 && i.quantity > 0);
      if (!items.length) back(path, "err", "Set the fee (and the rent it applies to) before billing.");
      const invId = await draftInvoice(e.clientName, e.clientEmail, items, e.id, me.id, `${e.title}`);
      if (!invId) back(path, "err", "Couldn't number the invoice — try again.");
      await audit(me.id, "enterprise.engagement.bill", "engagement", e.id, { invoice: invId });
      revalidatePath(PATH);
      return back(`/admin/books?tab=invoices&open=${invId}`, "ok", "Draft invoice created — check it and send.");
    }
    case "delete": {
      if (!guard.founder) back(path, "err", "Only the account owner can delete engagements.");
      await prisma.engagement.delete({ where: { id: e.id } });
      if (e.requestId) await prisma.serviceRequest.update({ where: { id: e.requestId }, data: { engagementId: null, status: "contacted" } }).catch(() => undefined);
      await audit(me.id, "enterprise.engagement.delete", "engagement", e.id);
      revalidatePath(PATH);
      return back(`${PATH}?tab=engagements`, "ok", "Engagement deleted.");
    }
  }
  return back(path, "err", "Unknown action.");
}

async function draftInvoice(name: string, email: string, items: InvoiceItem[], engagementId: string, actorId: string, note: string) {
  const s = await booksSettings();
  const today = booksToday();
  const t = invoiceTotals(items, 0);
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true } });
  const due = new Date(Date.parse(`${today}T00:00:00Z`) + s.terms * 86_400_000).toISOString().slice(0, 10);
  for (let attempt = 0; attempt < 4; attempt++) {
    const number = await nextInvoiceNumber(Number(today.slice(0, 4)));
    const made = await prisma.invoice
      .create({
        data: {
          number: attempt ? `${number}-${attempt}` : number,
          billToName: name,
          billToEmail: email.toLowerCase(),
          userId: user?.id ?? null,
          issueDate: today,
          dueDate: due,
          itemsJson: JSON.stringify(items),
          subtotalCents: t.subtotal,
          taxCents: t.tax,
          totalCents: t.total,
          note: note.slice(0, 1000),
          engagementId,
          createdById: actorId,
        },
      })
      .catch(() => null);
    if (made) return made.id;
  }
  return null;
}

/* ------------------------------------------------------------------------
   Managed properties and owner statements
   ------------------------------------------------------------------------ */

export async function saveProperty(fd: FormData) {
  const path = returnTo(fd, PATH);
  const guard = await requireAdminAction("enterprise");
  if (!guard.ok) back(path, "err", guard.error);
  const id = field(fd, "id", 60);
  const name = field(fd, "name", 120);
  const ownerName = field(fd, "ownerName", 120);
  const ownerEmail = field(fd, "ownerEmail", 200).toLowerCase();
  if (name.length < 2) back(path, "err", "Name the property.");
  if (ownerName.length < 2 || !EMAIL.test(ownerEmail)) back(path, "err", "Add the owner's name and email — statements go there.");
  const units = Math.max(1, Math.min(100_000, Math.round(Number(field(fd, "units", 8)) || 1)));
  const occupied = Math.max(0, Math.min(units, Math.round(Number(field(fd, "occupied", 8)) || 0)));
  const rent = parseMoney(field(fd, "rentRoll", 20) || "0");
  const flat = parseMoney(field(fd, "flatFee", 20) || "0");
  const pct = parsePct(field(fd, "pct", 8) || "0");
  if (rent === null || rent < 0 || flat === null || flat < 0 || pct === null) back(path, "err", "Check the rent, fee and percentage.");
  const engagementId = field(fd, "engagementId", 60) || null;
  if (engagementId && !(await prisma.engagement.findUnique({ where: { id: engagementId }, select: { id: true } }))) back(path, "err", "That engagement doesn't exist.");
  const kindRaw = field(fd, "kind", 20);
  const statusRaw = field(fd, "status", 20);
  const listingIds = field(fd, "listingIds", 2000)
    .split(/[\s,]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 200);
  const known = listingIds.length ? new Set((await prisma.listing.findMany({ where: { id: { in: listingIds } }, select: { id: true } })).map((l) => l.id)) : new Set<string>();
  const data = {
    name,
    address: field(fd, "address", 200),
    market: field(fd, "market", 80) || null,
    kind: PROPERTY_KINDS.some((k) => k.id === kindRaw) ? kindRaw : "building",
    units,
    occupied,
    rentRollCents: rent ?? 0,
    pctBp: pct ?? 0,
    flatFeeCents: flat ?? 0,
    ownerName,
    ownerEmail,
    ownerLocation: field(fd, "ownerLocation", 80) || null,
    status: (PROPERTY_STATUSES as readonly string[]).includes(statusRaw) ? statusRaw : "onboarding",
    listingIds: JSON.stringify(listingIds.filter((x) => known.has(x))),
    engagementId,
    note: field(fd, "note", 2000) || null,
  };
  const saved = id ? await prisma.managedProperty.update({ where: { id }, data }) : await prisma.managedProperty.create({ data });
  if (!id) {
    try {
      await upsertContact({ email: ownerEmail, name: ownerName, kind: "partner", source: "manual", tags: ["enterprise", "owner"] });
    } catch {
      /* best effort */
    }
  }
  await audit(guard.user.id, id ? "enterprise.property.edit" : "enterprise.property.create", "managedProperty", saved.id, { units, status: data.status });
  revalidatePath(PATH);
  const dropped = listingIds.length - known.size;
  return back(`${PATH}?tab=portfolio&prop=${saved.id}`, "ok", `${id ? "Property saved." : "Property added."}${dropped ? ` ${dropped} listing id${dropped === 1 ? "" : "s"} not found and skipped.` : ""}`);
}

function readExpenseLines(fd: FormData): ExpenseLine[] | null {
  const labels = fd.getAll("expLabel").map((x) => String(x).trim().slice(0, 120));
  const amounts = fd.getAll("expAmount").map((x) => String(x).trim());
  const out: ExpenseLine[] = [];
  for (let i = 0; i < labels.length; i++) {
    if (!labels[i] && !amounts[i]) continue;
    const c = parseMoney(amounts[i] ?? "");
    if (!labels[i] || c === null || c < 0) return null;
    out.push({ label: labels[i], amountCents: c });
  }
  return out;
}

export async function saveStatement(fd: FormData) {
  const path = returnTo(fd, PATH);
  const guard = await requireAdminAction("enterprise");
  if (!guard.ok) back(path, "err", guard.error);
  const propertyId = field(fd, "propertyId", 60);
  const p = await prisma.managedProperty.findUnique({ where: { id: propertyId } });
  if (!p) back(path, "err", "That property no longer exists.");
  const month = field(fd, "month", 7);
  if (!MONTH.test(month)) back(path, "err", "Pick the month.");
  const collected = parseMoney(field(fd, "collected", 20));
  if (collected === null || collected < 0) back(path, "err", "Enter the rent collected, like 12,400.");
  const lines = readExpenseLines(fd);
  if (lines === null) back(path, "err", "Each expense needs a description and an amount.");
  const expenses = lines.reduce((n, l) => n + l.amountCents, 0);
  const occupied = Math.max(0, Math.min(p.units, Math.round(Number(field(fd, "occupied", 8)) || p.occupied)));
  const { fee, net } = statementTotals({ collectedCents: collected, expensesCents: expenses, pctBp: p.pctBp, flatFeeCents: p.flatFeeCents });
  const data = { collectedCents: collected, expensesCents: expenses, feeCents: fee, netCents: net, occupied, expenseLines: JSON.stringify(lines), note: field(fd, "note", 1000) };
  const saved = await prisma.ownerStatement.upsert({
    where: { propertyId_month: { propertyId, month } },
    update: data,
    create: { ...data, propertyId, month, createdById: guard.user.id },
  });
  await prisma.managedProperty.update({ where: { id: p.id }, data: { occupied } });
  await audit(guard.user.id, "enterprise.statement.save", "ownerStatement", saved.id, { month, net });
  revalidatePath(PATH);
  const at = `${PATH}?tab=portfolio&prop=${p.id}`;
  if (field(fd, "send", 1) === "1") {
    const r = await sendStatement(saved.id);
    if (!r.ok) back(at, "err", `Saved, but not sent: ${r.error}`);
    await audit(guard.user.id, "enterprise.statement.send", "ownerStatement", saved.id);
    return back(at, "ok", r.logged ? "Saved and marked sent — email isn't configured, so it was only logged." : `Statement sent to ${p.ownerEmail}.`);
  }
  return back(at, "ok", `Statement for ${monthName(month)} saved — net ${fmtCents(net, p.currency)}.`);
}

export async function statementAction(fd: FormData) {
  const path = returnTo(fd, PATH);
  const guard = await requireAdminAction("enterprise");
  if (!guard.ok) back(path, "err", guard.error);
  const id = field(fd, "id", 60);
  const op = field(fd, "op", 20);
  const st = await prisma.ownerStatement.findUnique({ where: { id }, include: { property: true } });
  if (!st) back(path, "err", "That statement no longer exists.");
  if (op === "send") {
    const r = await sendStatement(id);
    if (!r.ok) back(path, "err", r.error);
    await audit(guard.user.id, "enterprise.statement.send", "ownerStatement", id);
    revalidatePath(PATH);
    return back(path, "ok", r.logged ? "Marked sent — email isn't configured, so it was only logged." : `Sent to ${st.property.ownerEmail}.`);
  }
  if (op === "bill") {
    if (!canAccess(guard.user, "books")) back(path, "err", "Billing needs Books access.");
    if (st.invoiceId) back(`/admin/books?tab=invoices&open=${st.invoiceId}`, "ok", "This fee is already on an invoice.");
    if (st.feeCents <= 0) back(path, "err", "There's no fee on this statement.");
    const p = st.property;
    const engagementId = p.engagementId ?? (await prisma.engagement.create({ data: { title: engagementTitle(p.ownerName, null, null), clientName: p.ownerName, clientEmail: p.ownerEmail, track: "management", status: "active", feeModel: "percent", pctBp: p.pctBp, amountCents: p.flatFeeCents, units: p.units, rentRollCents: p.rentRollCents, address: p.address, market: p.market, ownerId: guard.user.id, agreementSignedOn: booksToday() } })).id;
    if (!p.engagementId) await prisma.managedProperty.update({ where: { id: p.id }, data: { engagementId } });
    const invId = await draftInvoice(p.ownerName, p.ownerEmail, [{ description: `Management fee — ${p.name}, ${monthName(st.month)}`, quantity: 1, unitCents: st.feeCents }], engagementId, guard.user.id, "Management fee as shown on your owner statement.");
    if (!invId) back(path, "err", "Couldn't number the invoice — try again.");
    await prisma.ownerStatement.update({ where: { id }, data: { invoiceId: invId } });
    await audit(guard.user.id, "enterprise.statement.bill", "ownerStatement", id, { invoice: invId });
    revalidatePath(PATH);
    return back(`/admin/books?tab=invoices&open=${invId}`, "ok", "Draft invoice for the fee created — check it and send.");
  }
  if (op === "delete") {
    await prisma.ownerStatement.delete({ where: { id } });
    await audit(guard.user.id, "enterprise.statement.delete", "ownerStatement", id);
    revalidatePath(PATH);
    return back(path, "ok", "Statement deleted.");
  }
  return back(path, "err", "Unknown action.");
}

/* ------------------------------------------------------------------------
   Settings (founder): the licence on every page, "from" prices, the form
   ------------------------------------------------------------------------ */

export async function enterpriseSettingsAction(fd: FormData) {
  const path = returnTo(fd, `${PATH}?tab=catalogue`);
  const guard = await requireAdminAction("enterprise");
  if (!guard.ok) back(path, "err", guard.error);
  if (!guard.founder) back(path, "err", "Only the account owner can change the licence details and prices.");
  const states = field(fd, "brokerStates", 60)
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter((s) => /^[A-Z]{2}$/.test(s));
  const values: Array<[string, string]> = [
    [SETTING_KEYS.brokerName, field(fd, "brokerName", 120)],
    [SETTING_KEYS.brokerLicence, field(fd, "brokerLicence", 60)],
    [SETTING_KEYS.brokerStates, [...new Set(states)].join(", ")],
    [SETTING_KEYS.brokerPhone, field(fd, "brokerPhone", 40)],
    [SETTING_KEYS.brokerAddress, field(fd, "brokerAddress", 200)],
    [SETTING_KEYS.brokerEmail, EMAIL.test(field(fd, "brokerEmail", 200)) ? field(fd, "brokerEmail", 200).toLowerCase() : ""],
  ];
  const prices: Record<string, string> = {};
  for (const [id] of PACKAGE) {
    const v = field(fd, `price_${id}`, 60);
    if (v) prices[id] = v;
  }
  for (const [k, v] of values) await setSetting(k as (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS], v);
  await setSetting(SETTING_KEYS.enterprisePrices, JSON.stringify(prices));
  await setSetting(SETTING_KEYS.enterpriseForm, field(fd, "formOpen", 3) === "on" ? "on" : "off");
  await audit(guard.user.id, "enterprise.settings", "setting", "ent", { states, prices: Object.keys(prices).length });
  revalidatePath(PATH);
  return back(path, "ok", "Saved — the enterprise pages pick this up within five minutes.");
}
