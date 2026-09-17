"use server";

import { revalidatePath } from "next/cache";
import { audit, requireAdminAction } from "@/lib/admin/guard";
import { back, field, fields, returnTo } from "@/lib/admin/flash";
import { prisma } from "@/lib/prisma";
import { setSetting, SETTING_KEYS } from "@/lib/settings";
import { CATEGORY, invoiceTotals, ISO, isCategory, METHODS, parseMoney, type InvoiceItem, type Kind } from "@/lib/books/core";
import { RECEIPTS_PER_LINE } from "@/lib/books/receipts";
import { bookAdSpend, booksSettings, booksToday, markInvoicePaid, nextInvoiceNumber, runRepeats, sendInvoice, syncPayments } from "@/lib/books/data";

const PATH = "/admin/books";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanUrl(raw: string) {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString().slice(0, 500) : null;
  } catch {
    return null;
  }
}

/** Add or edit a ledger line. */
export async function saveEntry(fd: FormData) {
  const path = returnTo(fd, PATH);
  const guard = await requireAdminAction("books");
  if (!guard.ok) back(path, "err", guard.error);
  const id = field(fd, "id", 60);
  const kind = (field(fd, "kind", 10) === "income" ? "income" : "expense") as Kind;
  const category = field(fd, "category", 40);
  const amount = parseMoney(field(fd, "amount", 20));
  const date = field(fd, "date", 10);
  if (!isCategory(category, kind)) back(path, "err", `Pick a ${kind} category.`);
  if (amount === null || amount <= 0) back(path, "err", "Enter an amount above zero, like 49.99.");
  if (!ISO.test(date)) back(path, "err", "Pick a date.");
  const receipt = field(fd, "receiptUrl", 500);
  const receiptUrl = receipt ? cleanUrl(receipt) : null;
  if (receipt && !receiptUrl) back(path, "err", "The receipt link must start with https://");
  const method = field(fd, "method", 10);
  let userId: string | null = field(fd, "userId", 60) || null;
  const client = field(fd, "client", 200).toLowerCase();
  if (!userId && client && EMAIL.test(client)) userId = (await prisma.user.findUnique({ where: { email: client }, select: { id: true } }))?.id ?? null;
  const data = {
    kind,
    category,
    amountCents: amount,
    date,
    description: field(fd, "description", 300),
    counterparty: field(fd, "counterparty", 120),
    method: (METHODS as readonly string[]).includes(method) ? method : "",
    reference: field(fd, "reference", 80) || null,
    receiptUrl,
    deductible: kind === "income" ? true : field(fd, "deductible", 3) !== "no",
    repeatMonthly: field(fd, "repeat", 3) === "yes",
    userId,
  };
  let entryId = id;
  if (id) {
    const cur = await prisma.ledgerEntry.findUnique({ where: { id } });
    if (!cur) back(path, "err", "That line no longer exists.");
    if (cur.sourceKey && (cur.amountCents !== amount || cur.kind !== kind)) back(path, "err", "Synced lines keep their amount — void it and add a manual line instead.");
    await prisma.ledgerEntry.update({ where: { id }, data: { ...data, repeatMonthly: cur.repeatedFromId ? false : data.repeatMonthly } });
  } else {
    entryId = (await prisma.ledgerEntry.create({ data: { ...data, createdById: guard.user.id }, select: { id: true } })).id;
  }
  /* Receipts uploaded while the form was open wait unattached; claim them now. */
  const receiptIds = fields(fd, "receiptIds").slice(0, RECEIPTS_PER_LINE);
  if (receiptIds.length) {
    const room = RECEIPTS_PER_LINE - (await prisma.receipt.count({ where: { entryId } }));
    const mine = await prisma.receipt.findMany({ where: { id: { in: receiptIds }, entryId: null, uploadedById: guard.user.id }, select: { id: true }, take: Math.max(0, room) });
    if (mine.length) await prisma.receipt.updateMany({ where: { id: { in: mine.map((r) => r.id) } }, data: { entryId } });
  }
  if (data.repeatMonthly) await runRepeats(booksToday());
  await audit(guard.user.id, id ? "books.edit" : "books.add", "ledger", id || category, { kind, amount, date });
  revalidatePath(PATH);
  const after = new URL(path, "http://desk.local");
  after.searchParams.delete("add");
  after.searchParams.delete("edit");
  back(`${after.pathname}${after.search}`, "ok", `${id ? "Saved" : "Added"}: ${CATEGORY.get(category)?.label ?? category} ${(amount / 100).toFixed(2)}.`);
}

export async function entryAction(fd: FormData) {
  const path = returnTo(fd, PATH);
  const guard = await requireAdminAction("books");
  if (!guard.ok) back(path, "err", guard.error);
  const op = field(fd, "op", 20);
  const ids = fields(fd, "ids").slice(0, 200);
  const id = field(fd, "id", 60);
  const targets = ids.length ? ids : id ? [id] : [];
  if (!targets.length) back(path, "err", "Tick at least one line.");
  if (op === "void" || op === "restore") {
    const r = await prisma.ledgerEntry.updateMany({ where: { id: { in: targets } }, data: { voidedAt: op === "void" ? new Date() : null } });
    if (op === "void") await prisma.ledgerEntry.updateMany({ where: { id: { in: targets } }, data: { repeatMonthly: false } });
    await audit(guard.user.id, `books.${op}`, "ledger", targets.join(",").slice(0, 200), { count: r.count });
    revalidatePath(PATH);
    back(path, "ok", `${r.count} line${r.count === 1 ? "" : "s"} ${op === "void" ? "voided (kept for the audit trail)" : "restored"}.`);
  }
  if (op === "recategorise") {
    const category = field(fd, "category", 40) || field(fd, "value", 40);
    const c = CATEGORY.get(category);
    if (!c) back(path, "err", "Pick a category.");
    const r = await prisma.ledgerEntry.updateMany({ where: { id: { in: targets }, kind: c.kind }, data: { category } });
    await audit(guard.user.id, "books.recategorise", "ledger", targets.join(",").slice(0, 200), { category, count: r.count });
    revalidatePath(PATH);
    back(path, "ok", `${r.count} line${r.count === 1 ? "" : "s"} moved to ${c.label}.`);
  }
  if (op === "duplicate" && id) {
    const cur = await prisma.ledgerEntry.findUnique({ where: { id } });
    if (!cur) back(path, "err", "That line no longer exists.");
    const copy = await prisma.ledgerEntry.create({
      data: {
        kind: cur.kind,
        category: cur.category,
        amountCents: cur.amountCents,
        currency: cur.currency,
        date: booksToday(),
        description: cur.description,
        counterparty: cur.counterparty,
        method: cur.method,
        deductible: cur.deductible,
        userId: cur.userId,
        createdById: guard.user.id,
      },
    });
    await audit(guard.user.id, "books.add", "ledger", copy.id, { copyOf: id });
    revalidatePath(PATH);
    back(`${PATH}?tab=ledger&edit=${copy.id}`, "ok", "Copied to today — adjust and save.");
  }
  back(path, "err", "Unknown action.");
}

export async function syncAction(fd: FormData) {
  const path = returnTo(fd, PATH);
  const guard = await requireAdminAction("books");
  if (!guard.ok) back(path, "err", guard.error);
  const what = field(fd, "what", 20);
  const today = booksToday();
  const [pays, ads, reps] = await Promise.all([
    what === "ads" ? 0 : syncPayments(guard.user.id),
    what === "payments" ? 0 : bookAdSpend(guard.user.id, today),
    what === "all" ? runRepeats(today) : 0,
  ]);
  await audit(guard.user.id, "books.sync", "ledger", what, { pays, ads, reps });
  revalidatePath(PATH);
  const parts = [pays ? `${pays} Stripe line${pays === 1 ? "" : "s"}` : "", ads ? `${ads} ad-spend line${ads === 1 ? "" : "s"}` : "", reps ? `${reps} monthly repeat${reps === 1 ? "" : "s"}` : ""].filter(Boolean);
  back(path, "ok", parts.length ? `Booked ${parts.join(", ")}.` : "Everything was already in the books.");
}

function readItems(fd: FormData): InvoiceItem[] {
  const desc = fd.getAll("itemDesc").map(String);
  const qty = fd.getAll("itemQty").map(String);
  const unit = fd.getAll("itemUnit").map(String);
  const out: InvoiceItem[] = [];
  for (let i = 0; i < Math.min(desc.length, 20); i++) {
    const d = desc[i].trim().slice(0, 200);
    const q = Number(qty[i]);
    const u = parseMoney(unit[i] ?? "");
    if (!d && !unit[i]) continue;
    if (!d || !Number.isFinite(q) || q <= 0 || q > 10_000 || u === null || u < 0) return [];
    out.push({ description: d, quantity: Math.round(q * 100) / 100, unitCents: u });
  }
  return out;
}

export async function saveInvoice(fd: FormData) {
  const path = returnTo(fd, PATH);
  const guard = await requireAdminAction("books");
  if (!guard.ok) back(path, "err", guard.error);
  const id = field(fd, "id", 60);
  const items = readItems(fd);
  if (!items.length) back(path, "err", "Add at least one line with a description, quantity and price.");
  const email = field(fd, "billToEmail", 200).toLowerCase();
  const name = field(fd, "billToName", 120);
  if (!EMAIL.test(email) || name.length < 2) back(path, "err", "Add who it's for: a name and an email.");
  const s = await booksSettings();
  const today = booksToday();
  const issueDate = ISO.test(field(fd, "issueDate", 10)) ? field(fd, "issueDate", 10) : today;
  const due = field(fd, "dueDate", 10);
  const dueDate = ISO.test(due) && due >= issueDate ? due : new Date(Date.parse(`${issueDate}T00:00:00Z`) + s.terms * 86_400_000).toISOString().slice(0, 10);
  const taxPct = Number(field(fd, "taxPct", 6)) || 0;
  const t = invoiceTotals(items, taxPct);
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  const data = {
    billToName: name,
    billToEmail: email,
    userId: user?.id ?? null,
    issueDate,
    dueDate,
    itemsJson: JSON.stringify(items),
    subtotalCents: t.subtotal,
    taxCents: t.tax,
    totalCents: t.total,
    note: field(fd, "note", 1000),
  };
  let invId = id;
  if (id) {
    const cur = await prisma.invoice.findUnique({ where: { id } });
    if (!cur) back(path, "err", "That invoice no longer exists.");
    if (cur.status === "paid" || cur.status === "void") back(path, "err", "Paid and void invoices can't be edited — duplicate it instead.");
    await prisma.invoice.update({ where: { id }, data });
  } else {
    const year = Number(issueDate.slice(0, 4));
    for (let attempt = 0; attempt < 4 && !invId; attempt++) {
      const number = await nextInvoiceNumber(year);
      const made = await prisma.invoice.create({ data: { ...data, number: attempt ? `${number}-${attempt}` : number, createdById: guard.user.id } }).catch(() => null);
      if (made) invId = made.id;
    }
    if (!invId) back(path, "err", "Couldn't number the invoice — try again.");
  }
  await audit(guard.user.id, id ? "invoice.edit" : "invoice.create", "invoice", invId, { total: t.total });
  if (field(fd, "send", 1) === "1") {
    const r = await sendInvoice(invId);
    revalidatePath(PATH);
    if (!r.ok) back(`${PATH}?tab=invoices&open=${invId}`, "err", `Saved, but not sent: ${r.error}`);
    await audit(guard.user.id, "invoice.send", "invoice", invId);
    back(`${PATH}?tab=invoices&open=${invId}`, "ok", r.logged ? "Saved and marked sent — email isn't configured, so it was only logged." : `Sent to ${email}.`);
  }
  revalidatePath(PATH);
  back(`${PATH}?tab=invoices&open=${invId}`, "ok", id ? "Invoice saved." : "Draft invoice created.");
}

export async function invoiceAction(fd: FormData) {
  const path = returnTo(fd, PATH);
  const guard = await requireAdminAction("books");
  if (!guard.ok) back(path, "err", guard.error);
  const id = field(fd, "id", 60);
  const op = field(fd, "op", 20);
  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv) back(path, "err", "That invoice no longer exists.");
  if (op === "send" || op === "remind") {
    const r = await sendInvoice(id, op === "remind");
    if (!r.ok) back(path, "err", r.error);
    await audit(guard.user.id, `invoice.${op}`, "invoice", id);
    revalidatePath(PATH);
    back(path, "ok", r.logged ? "Recorded — email isn't configured, so nothing went out." : op === "remind" ? `Reminder sent to ${inv.billToEmail}.` : `Invoice sent to ${inv.billToEmail}.`);
  }
  if (op === "paid") {
    const method = field(fd, "method", 10);
    const date = ISO.test(field(fd, "paidDate", 10)) ? field(fd, "paidDate", 10) : booksToday();
    await markInvoicePaid(id, (METHODS as readonly string[]).includes(method) ? method : "bank", date, guard.user.id);
    await audit(guard.user.id, "invoice.paid", "invoice", id, { method, date });
    revalidatePath(PATH);
    back(path, "ok", `${inv.number} marked paid — ${(inv.totalCents / 100).toFixed(2)} booked as income.`);
  }
  if (op === "unpaid") {
    await prisma.invoice.update({ where: { id }, data: { status: inv.sentAt ? "sent" : "draft", paidAt: null, paidMethod: null } });
    await prisma.ledgerEntry.updateMany({ where: { sourceKey: `inv:${id}` }, data: { voidedAt: new Date() } });
    await audit(guard.user.id, "invoice.unpaid", "invoice", id);
    revalidatePath(PATH);
    back(path, "ok", `${inv.number} is open again; its income line was voided.`);
  }
  if (op === "void") {
    if (inv.status === "paid") back(path, "err", "Mark it unpaid first.");
    await prisma.invoice.update({ where: { id }, data: { status: "void" } });
    await audit(guard.user.id, "invoice.void", "invoice", id);
    revalidatePath(PATH);
    back(path, "ok", `${inv.number} voided.`);
  }
  if (op === "duplicate") {
    const today = booksToday();
    const s = await booksSettings();
    const number = await nextInvoiceNumber(Number(today.slice(0, 4)));
    const copy = await prisma.invoice.create({
      data: {
        number,
        userId: inv.userId,
        billToName: inv.billToName,
        billToEmail: inv.billToEmail,
        issueDate: today,
        dueDate: new Date(Date.parse(`${today}T00:00:00Z`) + s.terms * 86_400_000).toISOString().slice(0, 10),
        currency: inv.currency,
        itemsJson: inv.itemsJson,
        subtotalCents: inv.subtotalCents,
        taxCents: inv.taxCents,
        totalCents: inv.totalCents,
        note: inv.note,
        createdById: guard.user.id,
      },
    });
    await audit(guard.user.id, "invoice.create", "invoice", copy.id, { copyOf: id });
    revalidatePath(PATH);
    back(`${PATH}?tab=invoices&open=${copy.id}`, "ok", `Draft ${number} created from ${inv.number}.`);
  }
  back(path, "err", "Unknown action.");
}

export async function booksSettingsAction(fd: FormData) {
  const path = returnTo(fd, PATH);
  const guard = await requireAdminAction("books");
  if (!guard.ok) back(path, "err", guard.error);
  const rate = Number(field(fd, "taxRate", 5));
  const terms = Number(field(fd, "terms", 4));
  if (!Number.isFinite(rate) || rate < 0 || rate > 60) back(path, "err", "The set-aside rate must be between 0 and 60%.");
  if (!Number.isFinite(terms) || terms < 0 || terms > 120) back(path, "err", "Payment terms must be between 0 and 120 days.");
  await setSetting(SETTING_KEYS.taxRate, String(Math.round(rate * 10) / 10));
  await setSetting(SETTING_KEYS.invoiceTerms, String(Math.round(terms)));
  await setSetting(SETTING_KEYS.payInstructions, field(fd, "payInstructions", 800));
  await audit(guard.user.id, "books.settings", "setting", "books", { rate, terms });
  revalidatePath(PATH);
  back(path, "ok", "Books settings saved.");
}
