/**
 * Books: the pure part. Categories, money, periods, profit & loss, invoice
 * maths, the tax set-aside and the plain-words insights — everything the page,
 * the exports and the tests share. No database in here.
 */

export type Kind = "income" | "expense";

export type Category = { key: string; label: string; kind: Kind; hint: string; line?: string };

/**
 * Where a line usually lands on a US Schedule C is only a hint for the
 * accountant; the desk never decides tax treatment.
 */
export const CATEGORIES: Category[] = [
  { key: "listing_fees", label: "Listing fees", kind: "income", hint: "Weekly and monthly listing plans", line: "1" },
  { key: "sponsorship", label: "Sponsorship", kind: "income", hint: "Sponsored and featured placements", line: "1" },
  { key: "invoices", label: "Invoiced services", kind: "income", hint: "Operators, partners, custom deals", line: "1" },
  { key: "other_income", label: "Other income", kind: "income", hint: "Anything else that came in", line: "6" },
  { key: "advertising", label: "Advertising", kind: "expense", hint: "Meta, Google, TikTok, flyers", line: "8" },
  { key: "fees", label: "Payment & bank fees", kind: "expense", hint: "Stripe, bank and card fees", line: "10" },
  { key: "contractors", label: "Contractors", kind: "expense", hint: "Freelancers, photographers, VAs", line: "11" },
  { key: "insurance", label: "Insurance", kind: "expense", hint: "Business insurance", line: "15" },
  { key: "legal", label: "Legal & accounting", kind: "expense", hint: "Lawyers, accountants, filings", line: "17" },
  { key: "office", label: "Office & supplies", kind: "expense", hint: "Supplies, printing, postage", line: "18" },
  { key: "rent", label: "Rent & coworking", kind: "expense", hint: "Office or desk space", line: "20b" },
  { key: "licenses", label: "Taxes & licenses", kind: "expense", hint: "Business licenses, registrations", line: "23" },
  { key: "travel", label: "Travel", kind: "expense", hint: "Transit, rides, trips for viewings", line: "24a" },
  { key: "meals", label: "Meals", kind: "expense", hint: "Business meals (often only partly deductible)", line: "24b" },
  { key: "utilities", label: "Phone & internet", kind: "expense", hint: "Phone lines, internet", line: "25" },
  { key: "wages", label: "Wages", kind: "expense", hint: "Payroll for employees", line: "26" },
  { key: "software", label: "Software & hosting", kind: "expense", hint: "Cloudflare, Neon, email, apps", line: "27a" },
  { key: "refunds", label: "Refunds", kind: "expense", hint: "Money returned to customers", line: "2" },
  { key: "other_expense", label: "Other expense", kind: "expense", hint: "Needs a better category", line: "27a" },
];

export const CATEGORY = new Map(CATEGORIES.map((c) => [c.key, c]));
export const METHODS = ["card", "bank", "stripe", "cash", "other"] as const;

export function isCategory(key: string, kind?: Kind) {
  const c = CATEGORY.get(key);
  return Boolean(c && (!kind || c.kind === kind));
}

/** "1,234.50" / "$1234" / "1234.5" → 123450 cents; null when it isn't money. */
export function parseMoney(raw: string): number | null {
  const s = String(raw ?? "").replace(/[\s$,]/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  const cents = Math.round(Number(s) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

export function fmtCents(cents: number, currency = "USD", opts: { sign?: boolean; whole?: boolean } = {}) {
  const v = cents / 100;
  const s = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: opts.whole ? 0 : 2,
    maximumFractionDigits: opts.whole ? 0 : 2,
  }).format(Math.abs(v));
  return `${v < 0 ? "−" : opts.sign && v > 0 ? "+" : ""}${s}`;
}

/* ---- periods ------------------------------------------------------------- */

export const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86_400_000;

export type Range = { from: string; to: string; label: string; key: string };
export const RANGE_KEYS = ["mtd", "last_month", "qtd", "ytd", "last_year", "30d", "90d", "12m", "custom"] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

/** A named period ending today (or a custom one), inclusive on both ends. */
export function rangeOf(key: string, today: string, custom?: { from?: string; to?: string }): Range {
  const t = new Date(`${today}T00:00:00Z`);
  const y = t.getUTCFullYear();
  const m = t.getUTCMonth();
  switch (key) {
    case "last_month":
      return { key, label: "Last month", from: iso(utc(y, m - 1, 1)), to: iso(utc(y, m, 0)) };
    case "qtd":
      return { key, label: "Quarter to date", from: iso(utc(y, Math.floor(m / 3) * 3, 1)), to: today };
    case "ytd":
      return { key, label: "Year to date", from: `${y}-01-01`, to: today };
    case "last_year":
      return { key, label: String(y - 1), from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    case "30d":
      return { key, label: "Last 30 days", from: iso(new Date(t.getTime() - 29 * DAY)), to: today };
    case "90d":
      return { key, label: "Last 90 days", from: iso(new Date(t.getTime() - 89 * DAY)), to: today };
    case "12m":
      return { key, label: "Last 12 months", from: iso(utc(y, m - 11, 1)), to: today };
    case "custom": {
      const from = custom?.from && ISO.test(custom.from) ? custom.from : iso(utc(y, m, 1));
      const to = custom?.to && ISO.test(custom.to) && custom.to >= from ? custom.to : today;
      return { key, label: `${from} → ${to}`, from, to };
    }
    default:
      return { key: "mtd", label: "Month to date", from: iso(utc(y, m, 1)), to: today };
  }
}

/** The same-length period just before a range, for the comparison column. */
export function previousRange(r: Range): Range {
  const from = new Date(`${r.from}T00:00:00Z`).getTime();
  const to = new Date(`${r.to}T00:00:00Z`).getTime();
  const len = to - from + DAY;
  return { key: "prev", label: "Previous period", from: iso(new Date(from - len)), to: iso(new Date(from - DAY)) };
}

export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const endY = Number(to.slice(0, 4));
  const endM = Number(to.slice(5, 7));
  while ((y < endY || (y === endY && m <= endM)) && out.length < 120) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export function monthLabel(key: string) {
  const d = new Date(`${key}-01T00:00:00Z`);
  return `${d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })} ’${key.slice(2, 4)}`;
}

/* ---- profit & loss ---------------------------------------------------------- */

export type Line = { date: string; kind: string; category: string; amountCents: number; voidedAt?: Date | null; deductible?: boolean };

const live = (l: Line) => !l.voidedAt;
const within = (l: Line, r: { from: string; to: string }) => l.date >= r.from && l.date <= r.to;

export type Pnl = {
  income: number;
  expenses: number;
  net: number;
  margin: number | null;
  byCategory: Array<{ key: string; label: string; kind: Kind; cents: number; share: number }>;
};

export function pnl(lines: Line[], r: { from: string; to: string }): Pnl {
  const rows = lines.filter((l) => live(l) && within(l, r));
  const sum = new Map<string, number>();
  let income = 0;
  let expenses = 0;
  for (const l of rows) {
    sum.set(l.category, (sum.get(l.category) ?? 0) + l.amountCents);
    if (l.kind === "income") income += l.amountCents;
    else expenses += l.amountCents;
  }
  const byCategory = [...sum.entries()]
    .map(([key, cents]) => {
      const c = CATEGORY.get(key);
      const kind: Kind = c?.kind ?? (rows.find((x) => x.category === key)?.kind === "income" ? "income" : "expense");
      const base = kind === "income" ? income : expenses;
      return { key, label: c?.label ?? key, kind, cents, share: base ? cents / base : 0 };
    })
    .sort((a, b) => (a.kind === b.kind ? b.cents - a.cents : a.kind === "income" ? -1 : 1));
  return { income, expenses, net: income - expenses, margin: income ? (income - expenses) / income : null, byCategory };
}

export function monthly(lines: Line[], months: string[]) {
  const idx = new Map(months.map((m, i) => [m, i]));
  const rows = months.map((m) => ({ month: m, income: 0, expenses: 0, net: 0 }));
  for (const l of lines) {
    if (!live(l)) continue;
    const i = idx.get(l.date.slice(0, 7));
    if (i === undefined) continue;
    if (l.kind === "income") rows[i].income += l.amountCents;
    else rows[i].expenses += l.amountCents;
  }
  for (const r of rows) r.net = r.income - r.expenses;
  return rows;
}

/** Change against the previous period, as a fraction; null when there is nothing to compare. */
export function delta(now: number, before: number) {
  if (!before) return now ? null : 0;
  return (now - before) / Math.abs(before);
}

/** Schedule C style roll-up for a year: lines by hint, deductible expenses only. */
export function scheduleC(lines: Line[], year: number) {
  const r = { from: `${year}-01-01`, to: `${year}-12-31` };
  const rows = lines.filter((l) => live(l) && within(l, r));
  const byLine = new Map<string, { line: string; labels: Set<string>; cents: number }>();
  let gross = 0;
  let deductible = 0;
  for (const l of rows) {
    const c = CATEGORY.get(l.category);
    if (l.kind === "income") {
      gross += l.amountCents;
      continue;
    }
    if (l.deductible === false) continue;
    deductible += l.amountCents;
    const key = c?.line ?? "27a";
    const cur = byLine.get(key) ?? { line: key, labels: new Set<string>(), cents: 0 };
    cur.labels.add(c?.label ?? l.category);
    cur.cents += l.amountCents;
    byLine.set(key, cur);
  }
  const lineOrder = (x: string) => parseFloat(x) + (/[a-z]$/.test(x) ? 0.1 : 0);
  return {
    gross,
    deductible,
    profit: gross - deductible,
    lines: [...byLine.values()].sort((a, b) => lineOrder(a.line) - lineOrder(b.line)).map((x) => ({ line: x.line, labels: [...x.labels], cents: x.cents })),
  };
}

/** US federal estimated-tax due dates for a tax year (the 15th, or the next business day in practice). */
export function estimatedTaxDates(year: number) {
  return [`${year}-04-15`, `${year}-06-15`, `${year}-09-15`, `${year + 1}-01-15`];
}

export function nextTaxDate(today: string) {
  const y = Number(today.slice(0, 4));
  return [...estimatedTaxDates(y - 1), ...estimatedTaxDates(y)].find((d) => d >= today) ?? `${y + 1}-01-15`;
}

/** The set-aside at the owner's chosen rate. A savings habit, not a tax calculation. */
export function setAside(profitCents: number, ratePct: number) {
  if (profitCents <= 0 || !Number.isFinite(ratePct) || ratePct <= 0) return 0;
  return Math.round((profitCents * Math.min(60, ratePct)) / 100);
}

/* ---- invoices --------------------------------------------------------------- */

export type InvoiceItem = { description: string; quantity: number; unitCents: number };

export function parseItems(json: string): InvoiceItem[] {
  try {
    const v = JSON.parse(json) as unknown;
    if (!Array.isArray(v)) return [];
    return v
      .map((x) => x as Partial<InvoiceItem>)
      .filter((x) => typeof x.description === "string" && Number.isFinite(x.quantity) && Number.isFinite(x.unitCents))
      .map((x) => ({ description: String(x.description).slice(0, 200), quantity: Number(x.quantity), unitCents: Math.round(Number(x.unitCents)) }));
  } catch {
    return [];
  }
}

export function invoiceTotals(items: InvoiceItem[], taxPct = 0) {
  const subtotal = items.reduce((n, i) => n + Math.round(i.quantity * i.unitCents), 0);
  const tax = Math.round((subtotal * Math.max(0, Math.min(25, taxPct))) / 100);
  return { subtotal, tax, total: subtotal + tax };
}

export type InvoiceState = "draft" | "sent" | "due_soon" | "overdue" | "paid" | "void";

export function invoiceState(inv: { status: string; dueDate: string }, today: string): InvoiceState {
  if (inv.status === "paid" || inv.status === "void" || inv.status === "draft") return inv.status;
  if (inv.dueDate < today) return "overdue";
  const days = (Date.parse(`${inv.dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY;
  return days <= 3 ? "due_soon" : "sent";
}

export function daysLate(dueDate: string, today: string) {
  return Math.max(0, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`)) / DAY));
}

/** "INV-2026-0007" from the year and how many exist that year. */
export function invoiceNumber(year: number, seq: number) {
  return `INV-${year}-${String(seq).padStart(4, "0")}`;
}

/** Overdue reminders go out on day 1, 7 and 14 — never more than three. */
export function reminderDue(inv: { status: string; dueDate: string; reminders: number; lastReminderAt: Date | null }, today: string, now = Date.now()) {
  if (invoiceState(inv, today) !== "overdue" || inv.reminders >= 3) return false;
  const late = daysLate(inv.dueDate, today);
  const step = [1, 7, 14][inv.reminders];
  if (late < step) return false;
  return !inv.lastReminderAt || now - inv.lastReminderAt.getTime() > 5 * DAY;
}

/** Monthly repeats: the dates a repeating line still needs, up to this month. */
export function repeatDates(date: string, today: string) {
  if (!ISO.test(date)) return [];
  const day = Number(date.slice(8, 10));
  return monthsBetween(date.slice(0, 7), today.slice(0, 7))
    .slice(1)
    .map((m) => {
      const last = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).getUTCDate();
      return `${m}-${String(Math.min(day, last)).padStart(2, "0")}`;
    })
    .filter((d) => d <= today);
}

/* ---- insights --------------------------------------------------------------- */

export type Insight = { id: string; tone: "good" | "warn" | "bad" | "info"; title: string; body: string; href?: string; cta?: string };

export function bookInsights(f: {
  now: Pnl;
  before: Pnl;
  today: string;
  overdue: { count: number; cents: number };
  drafts: number;
  uncategorised: number;
  unsyncedPayments: number;
  adSpendUnbooked: number;
  leadsNow: number;
  leadsBefore: number;
  setAsideCents: number;
  taxRate: number;
  months: Array<{ income: number; expenses: number }>;
}): Insight[] {
  const out: Insight[] = [];
  const cat = (p: Pnl, key: string) => p.byCategory.find((c) => c.key === key)?.cents ?? 0;
  if (f.overdue.count) {
    out.push({ id: "overdue", tone: "bad", title: `${f.overdue.count} invoice${f.overdue.count === 1 ? "" : "s"} overdue · ${fmtCents(f.overdue.cents, "USD", { whole: true })}`, body: "Send a reminder today. Reminders repeat the full invoice in the email, and go out on their own on day 1, 7 and 14.", href: "?tab=invoices&state=overdue", cta: "See overdue" });
  }
  if (f.unsyncedPayments) {
    out.push({ id: "sync", tone: "warn", title: `${f.unsyncedPayments} Stripe payment${f.unsyncedPayments === 1 ? "" : "s"} not in the books`, body: "Bring them in so income matches what Stripe collected.", href: "#sync", cta: "Sync now" });
  }
  if (f.adSpendUnbooked > 0) {
    out.push({ id: "ads", tone: "warn", title: `${fmtCents(f.adSpendUnbooked, "USD", { whole: true })} of ad spend not booked`, body: "Paid ads records more spend than the books show as Advertising.", href: "#sync", cta: "Book it" });
  }
  if (f.uncategorised) {
    out.push({ id: "uncat", tone: "warn", title: `${f.uncategorised} line${f.uncategorised === 1 ? "" : "s"} in “Other expense”`, body: "Give them a real category so the year-end summary is clean for your accountant.", href: "?tab=ledger&category=other_expense", cta: "Tidy up" });
  }
  if (f.drafts) {
    out.push({ id: "drafts", tone: "info", title: `${f.drafts} draft invoice${f.drafts === 1 ? "" : "s"} not sent`, body: "Drafts don't get paid.", href: "?tab=invoices&state=draft", cta: "Open drafts" });
  }
  const adsNow = cat(f.now, "advertising");
  const adsBefore = cat(f.before, "advertising");
  if (adsNow > 0 && adsBefore > 0 && f.leadsBefore > 0) {
    const cplNow = f.leadsNow ? adsNow / f.leadsNow : Infinity;
    const cplBefore = adsBefore / f.leadsBefore;
    if (cplNow > cplBefore * 1.3) {
      out.push({ id: "cpl", tone: "warn", title: "Each lead costs more than last period", body: `Ad spend per lead went from ${fmtCents(cplBefore, "USD", { whole: true })} to ${Number.isFinite(cplNow) ? fmtCents(cplNow, "USD", { whole: true }) : "no leads"}. Pause the weakest campaign in Paid ads.`, href: "/admin/ads?tab=attribution", cta: "Compare campaigns" });
    } else if (cplNow < cplBefore * 0.8) {
      out.push({ id: "cpl-good", tone: "good", title: "Leads got cheaper", body: `Ad spend per lead fell to ${fmtCents(cplNow, "USD", { whole: true })} (was ${fmtCents(cplBefore, "USD", { whole: true })}). Consider moving budget to the best campaign.`, href: "/admin/ads", cta: "Open Paid ads" });
    }
  }
  const d = delta(f.now.expenses, f.before.expenses);
  if (d !== null && d > 0.25 && f.now.expenses - f.before.expenses > 20_000) {
    const grew = f.now.byCategory
      .filter((c) => c.kind === "expense")
      .map((c) => ({ ...c, up: c.cents - cat(f.before, c.key) }))
      .sort((a, b) => b.up - a.up)[0];
    out.push({ id: "spend", tone: "warn", title: `Spending up ${Math.round(d * 100)}%`, body: grew && grew.up > 0 ? `Mostly ${grew.label.toLowerCase()} (+${fmtCents(grew.up, "USD", { whole: true })}).` : "Check the biggest categories below." });
  }
  if (f.now.income > 0 && f.before.income > 0) {
    const gi = delta(f.now.income, f.before.income) ?? 0;
    if (gi >= 0.15) out.push({ id: "growth", tone: "good", title: `Income up ${Math.round(gi * 100)}%`, body: "Against the previous period of the same length." });
    if (gi <= -0.15) out.push({ id: "drop", tone: "bad", title: `Income down ${Math.round(-gi * 100)}%`, body: "Check trial conversions and listings that paused.", href: "/admin/trials", cta: "Open trials" });
  }
  const recent = f.months.slice(-3);
  if (recent.length === 3 && recent.every((m) => m.expenses > m.income) && recent.some((m) => m.expenses > 0)) {
    const burn = Math.round(recent.reduce((n, m) => n + (m.expenses - m.income), 0) / 3);
    out.push({ id: "burn", tone: "info", title: `Spending ${fmtCents(burn, "USD", { whole: true })} a month more than comes in`, body: "Normal while growing — keep an eye on cash." });
  }
  if (f.setAsideCents > 0) {
    out.push({ id: "tax", tone: "info", title: `Set aside ${fmtCents(f.setAsideCents, "USD", { whole: true })} for taxes`, body: `At your ${f.taxRate}% set-aside rate on this year's profit so far. Next estimated-payment date: ${nextTaxDate(f.today)} — confirm amounts with your accountant.`, href: "?tab=tax", cta: "Tax view" });
  }
  const order = { bad: 0, warn: 1, info: 2, good: 3 };
  return out.sort((a, b) => order[a.tone] - order[b.tone]);
}

/* ---- CSV-safe ledger rows ------------------------------------------------ */

export function ledgerRow(l: Line & { description?: string; counterparty?: string; method?: string; reference?: string | null; currency?: string }) {
  const c = CATEGORY.get(l.category);
  return [l.date, l.kind, c?.label ?? l.category, c?.line ?? "", (l.kind === "expense" ? -l.amountCents : l.amountCents) / 100, l.currency ?? "USD", l.counterparty ?? "", l.description ?? "", l.method ?? "", l.reference ?? "", l.deductible === false ? "no" : "yes", l.voidedAt ? "void" : ""];
}
export const LEDGER_HEADERS = ["date", "kind", "category", "schedule_c_line", "amount", "currency", "counterparty", "description", "method", "reference", "deductible", "void"];
