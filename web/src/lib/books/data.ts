/**
 * Books: the database side. Syncs Stripe payments and ad spend into the
 * ledger, repeats monthly lines, numbers and sends invoices, and chases the
 * overdue ones. Every automatic line has a unique `sourceKey`, so running a
 * sync twice never books anything twice.
 */
import { prisma } from "@/lib/prisma";
import { getSettings, SETTING_KEYS } from "@/lib/settings";
import { appUrl } from "@/lib/site";
import { sendMail } from "@/lib/v1/mail";
import { mailingAddress } from "@/lib/outbox";
import { ORPHAN_HOURS } from "./receipts";
import { daysLate, fmtCents, invoiceNumber, parseItems, reminderDue, repeatDates } from "./core";

const PAID = ["paid", "succeeded", "complete"];

/** Today's date in New York, where the business keeps its books. */
export function booksToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export async function booksSettings() {
  const s = await getSettings([SETTING_KEYS.taxRate, SETTING_KEYS.invoiceTerms, SETTING_KEYS.payInstructions, SETTING_KEYS.senderName]);
  const rate = Number(s[SETTING_KEYS.taxRate]);
  const terms = Number(s[SETTING_KEYS.invoiceTerms]);
  return {
    taxRate: Number.isFinite(rate) && rate >= 0 && rate <= 60 ? rate : 25,
    terms: Number.isFinite(terms) && terms >= 0 && terms <= 120 ? Math.round(terms) : 14,
    payInstructions: s[SETTING_KEYS.payInstructions] || "",
    sender: s[SETTING_KEYS.senderName] || "RentLeaks",
  };
}

function categoryForPayment(kind: string, planId: string | null) {
  const k = `${kind} ${planId ?? ""}`.toLowerCase();
  return /feature|sponsor|promot/.test(k) ? "sponsorship" : "listing_fees";
}

/** Paid Stripe payments that have no line in the books yet. */
export async function unsyncedPayments() {
  const pays = await prisma.payment.findMany({ where: { status: { in: [...PAID, "refunded"] } }, select: { id: true, status: true }, take: 5000 });
  if (!pays.length) return 0;
  const keys = new Set(
    (await prisma.ledgerEntry.findMany({ where: { sourceKey: { in: pays.flatMap((p) => [`pay:${p.id}`, `refund:${p.id}`]) } }, select: { sourceKey: true } })).map(
      (x) => x.sourceKey,
    ),
  );
  return pays.filter((p) => !keys.has(`pay:${p.id}`) || (p.status === "refunded" && !keys.has(`refund:${p.id}`))).length;
}

export async function syncPayments(actorId: string | null = null) {
  const pays = await prisma.payment.findMany({
    where: { status: { in: [...PAID, "refunded"] } },
    include: { user: { select: { email: true, name: true } }, listing: { select: { title: true } } },
    orderBy: { createdAt: "asc" },
    take: 5000,
  });
  const have = new Set(
    (await prisma.ledgerEntry.findMany({ where: { sourceKey: { in: pays.flatMap((p) => [`pay:${p.id}`, `refund:${p.id}`]) } }, select: { sourceKey: true } })).map(
      (x) => x.sourceKey,
    ),
  );
  let added = 0;
  for (const p of pays) {
    if (have.has(`pay:${p.id}`) && (p.status !== "refunded" || have.has(`refund:${p.id}`))) continue;
    const base = {
      date: booksToday(p.createdAt),
      amountCents: p.amount,
      currency: p.currency.toUpperCase(),
      counterparty: p.user.email,
      method: "stripe",
      userId: p.userId,
      reference: p.stripeSessionId,
      createdById: actorId,
    };
    const made = have.has(`pay:${p.id}`)
      ? 0
      : await prisma.ledgerEntry
          .create({
            data: {
              ...base,
              kind: "income",
              category: categoryForPayment(p.kind, p.planId),
              description: `${p.kind}${p.planId ? ` · ${p.planId}` : ""}${p.listing ? ` · ${p.listing.title}` : ""}`.slice(0, 300),
              sourceKey: `pay:${p.id}`,
            },
          })
          .then(() => 1)
          .catch(() => 0);
    added += made;
    if (p.status === "refunded" && !have.has(`refund:${p.id}`)) {
      added += await prisma.ledgerEntry
        .create({ data: { ...base, date: booksToday(p.updatedAt), kind: "expense", category: "refunds", description: `Refund · ${p.kind}`, sourceKey: `refund:${p.id}` } })
        .then(() => 1)
        .catch(() => 0);
    }
  }
  return added;
}

/** Ad spend recorded in Paid ads (USD) that the books don't show as advertising yet. */
export async function adSpendGap() {
  const [ads, booked] = await Promise.all([
    prisma.adCampaign.findMany({ where: { currency: "USD" }, select: { spend: true } }),
    prisma.ledgerEntry.aggregate({ where: { category: "advertising", voidedAt: null }, _sum: { amountCents: true } }),
  ]);
  const total = ads.reduce((n, a) => n + a.spend * 100, 0);
  return Math.max(0, total - (booked._sum.amountCents ?? 0));
}

/** Books the ad-spend gap, one line per campaign that has grown since its last sync. */
export async function bookAdSpend(actorId: string | null, today = booksToday()) {
  let gap = await adSpendGap();
  if (!gap) return 0;
  const ads = await prisma.adCampaign.findMany({ where: { currency: "USD", spend: { gt: 0 } }, select: { id: true, name: true, platform: true, spend: true } });
  let added = 0;
  for (const a of ads) {
    if (gap <= 0) break;
    const synced = await prisma.ledgerEntry.aggregate({ where: { sourceKey: { startsWith: `ad:${a.id}:` }, voidedAt: null }, _sum: { amountCents: true } });
    const amount = Math.min(gap, a.spend * 100 - (synced._sum.amountCents ?? 0));
    if (amount <= 0) continue;
    const ok = await prisma.ledgerEntry
      .create({
        data: {
          date: today,
          kind: "expense",
          category: "advertising",
          amountCents: amount,
          description: `Ad spend · ${a.name}`,
          counterparty: a.platform,
          method: "card",
          sourceKey: `ad:${a.id}:${a.spend}`,
          createdById: actorId,
        },
      })
      .then(() => true)
      .catch(() => false);
    if (ok) {
      added++;
      gap -= amount;
    }
  }
  return added;
}

/** Copies monthly lines into every month that has come since. */
export async function runRepeats(today = booksToday()) {
  const src = await prisma.ledgerEntry.findMany({ where: { repeatMonthly: true, voidedAt: null, repeatedFromId: null }, take: 500 });
  let made = 0;
  for (const l of src) {
    const dates = repeatDates(l.date, today);
    if (!dates.length) continue;
    const done = new Set((await prisma.ledgerEntry.findMany({ where: { repeatedFromId: l.id }, select: { date: true } })).map((x) => x.date));
    for (const date of dates.filter((d) => !done.has(d))) {
      made += await prisma.ledgerEntry
        .create({
          data: {
            date,
            kind: l.kind,
            category: l.category,
            amountCents: l.amountCents,
            currency: l.currency,
            description: l.description,
            counterparty: l.counterparty,
            method: l.method,
            deductible: l.deductible,
            userId: l.userId,
            repeatedFromId: l.id,
            createdById: l.createdById,
          },
        })
        .then(() => 1)
        .catch(() => 0);
    }
  }
  return made;
}

export async function nextInvoiceNumber(year: number) {
  const n = await prisma.invoice.count({ where: { number: { startsWith: `INV-${year}-` } } });
  return invoiceNumber(year, n + 1);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

type Inv = {
  number: string;
  billToName: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  itemsJson: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  note: string;
};

export async function renderInvoice(inv: Inv, opts: { reminder?: number; today?: string } = {}) {
  const s = await booksSettings();
  const address = await mailingAddress().catch(() => "");
  const items = parseItems(inv.itemsJson);
  const money = (c: number) => fmtCents(c, inv.currency);
  const first = inv.billToName.trim().split(/\s+/)[0] || "there";
  const late = opts.reminder ? daysLate(inv.dueDate, opts.today ?? booksToday()) : 0;
  const intro = opts.reminder
    ? `A friendly reminder: invoice ${inv.number} for ${money(inv.totalCents)} was due on ${inv.dueDate}${late ? ` (${late} day${late === 1 ? "" : "s"} ago)` : ""}. If it's already paid, thank you — just reply and we'll update our records.`
    : `Here is invoice ${inv.number} for ${money(inv.totalCents)}, due on ${inv.dueDate}.`;
  const lines = items.map((i) => `• ${i.description} — ${i.quantity} × ${money(i.unitCents)} = ${money(Math.round(i.quantity * i.unitCents))}`);
  const pay = s.payInstructions ? `\n\nHow to pay:\n${s.payInstructions}` : "\n\nReply to this email for payment details.";
  const text =
    `Hi ${first},\n\n${intro}\n\n${lines.join("\n")}\n\nSubtotal: ${money(inv.subtotalCents)}${inv.taxCents ? `\nTax: ${money(inv.taxCents)}` : ""}\nTotal due: ${money(inv.totalCents)}` +
    `${inv.note ? `\n\n${inv.note}` : ""}${pay}\n\nThank you,\n${s.sender}${address ? `\n${address}` : ""}\n${appUrl().replace(/\/$/, "")}`;
  const row = (a: string, b: string, bold = false) =>
    `<tr><td style="padding:6px 0;border-bottom:1px solid #e3ecee${bold ? ";font-weight:700" : ""}">${a}</td><td style="padding:6px 0;border-bottom:1px solid #e3ecee;text-align:right${bold ? ";font-weight:700" : ""}">${b}</td></tr>`;
  const html =
    `<!doctype html><html><body style="margin:0;background:#f2f6f6"><div style="max-width:600px;margin:0 auto;padding:28px;background:#fff;font:15px/1.55 -apple-system,Segoe UI,Arial,sans-serif;color:#0f2328">` +
    `<table width="100%" role="presentation"><tr><td><b style="font-size:18px">${esc(s.sender)}</b></td><td style="text-align:right;color:#56696f">${opts.reminder ? "Payment reminder" : "Invoice"}<br><b style="color:#0f2328">${esc(inv.number)}</b></td></tr></table>` +
    `<p style="margin:22px 0 6px">Hi ${esc(first)},</p><p style="margin:0 0 18px">${esc(intro)}</p>` +
    `<table width="100%" role="presentation" style="border-collapse:collapse;font-size:14px">` +
    `<tr><td style="color:#56696f">Billed to</td><td style="text-align:right">${esc(inv.billToName)}</td></tr><tr><td style="color:#56696f">Issued</td><td style="text-align:right">${esc(inv.issueDate)}</td></tr><tr><td style="color:#56696f">Due</td><td style="text-align:right"><b>${esc(inv.dueDate)}</b></td></tr></table>` +
    `<table width="100%" role="presentation" style="border-collapse:collapse;margin:18px 0;font-size:14px">${items
      .map((i) => row(`${esc(i.description)}<br><span style="color:#7d8f94">${i.quantity} × ${esc(money(i.unitCents))}</span>`, esc(money(Math.round(i.quantity * i.unitCents)))))
      .join(
        "",
      )}${row("Subtotal", esc(money(inv.subtotalCents)))}${inv.taxCents ? row("Tax", esc(money(inv.taxCents))) : ""}${row("Total due", esc(money(inv.totalCents)), true)}</table>` +
    `${inv.note ? `<p style="white-space:pre-line">${esc(inv.note)}</p>` : ""}` +
    `<p style="white-space:pre-line;padding:12px 14px;border-radius:10px;background:#f2f6f6">${esc(s.payInstructions ? `How to pay:\n${s.payInstructions}` : "Reply to this email for payment details.")}</p>` +
    `<p style="color:#7d8f94;font-size:12px;margin-top:24px">${esc(s.sender)}${address ? ` · ${esc(address)}` : ""}</p></div></body></html>`;
  const subject = opts.reminder
    ? `Reminder: invoice ${inv.number} (${money(inv.totalCents)}) was due ${inv.dueDate}`
    : `Invoice ${inv.number} from ${s.sender} — ${money(inv.totalCents)} due ${inv.dueDate}`;
  return { subject, text, html };
}

export async function sendInvoice(id: string, reminder = false, today = booksToday()) {
  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv || inv.status === "void" || inv.status === "paid") return { ok: false as const, error: "That invoice can't be sent." };
  const r = await renderInvoice(inv, { reminder: reminder ? inv.reminders + 1 : 0, today });
  const mail = await sendMail({ to: inv.billToEmail, subject: r.subject, text: r.text, html: r.html, purpose: "transactional" });
  if (!mail.delivered && mail.transport !== "console") return { ok: false as const, error: mail.error ?? `Not delivered (${mail.transport}).` };
  await prisma.invoice.update({
    where: { id },
    data: reminder ? { reminders: { increment: 1 }, lastReminderAt: new Date() } : { status: "sent", sentAt: new Date() },
  });
  const contact = await prisma.contact.findUnique({ where: { email: inv.billToEmail.toLowerCase() }, select: { id: true } });
  if (contact) {
    await prisma.contactActivity
      .create({ data: { contactId: contact.id, kind: "email", subject: reminder ? `Invoice reminder ${inv.number}` : `Invoice ${inv.number} sent`, body: r.subject } })
      .catch(() => undefined);
  }
  return { ok: true as const, logged: !mail.delivered };
}

export async function markInvoicePaid(id: string, method: string, date: string, actorId: string | null) {
  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv || inv.status === "void") return false;
  await prisma.invoice.update({ where: { id }, data: { status: "paid", paidAt: new Date(`${date}T12:00:00Z`), paidMethod: method } });
  await prisma.ledgerEntry
    .upsert({
      where: { sourceKey: `inv:${inv.id}` },
      update: { voidedAt: null, date, method, amountCents: inv.totalCents },
      create: {
        date,
        kind: "income",
        category: "invoices",
        amountCents: inv.totalCents,
        currency: inv.currency,
        description: `Invoice ${inv.number}`,
        counterparty: inv.billToEmail,
        method,
        userId: inv.userId,
        invoiceId: inv.id,
        reference: inv.number,
        sourceKey: `inv:${inv.id}`,
        createdById: actorId,
      },
    })
    .catch(() => undefined);
  return true;
}

/** Cron: overdue reminders on day 1, 7 and 14. */
export async function remindOverdue(now = new Date()) {
  const today = booksToday(now);
  const due = await prisma.invoice.findMany({ where: { status: "sent", dueDate: { lt: today }, reminders: { lt: 3 } }, take: 100 });
  let sent = 0;
  for (const inv of due) {
    if (!reminderDue(inv, today, now.getTime())) continue;
    const r = await sendInvoice(inv.id, true, today).catch(() => ({ ok: false as const }));
    if (r.ok) sent++;
  }
  return sent;
}

/** Cron: everything the books do on their own. */
export async function runBooks(now = new Date()) {
  const today = booksToday(now);
  const [payments, repeats, reminders] = [await syncPayments(null), await runRepeats(today), await remindOverdue(now)];
  const orphans = await prisma.receipt
    .deleteMany({ where: { entryId: null, createdAt: { lt: new Date(now.getTime() - ORPHAN_HOURS * 3_600_000) } } })
    .then((r) => r.count)
    .catch(() => 0);
  return { payments, repeats, reminders, orphans };
}
