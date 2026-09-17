import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bookInsights,
  CATEGORIES,
  daysLate,
  delta,
  fmtCents,
  invoiceNumber,
  invoiceState,
  invoiceTotals,
  isCategory,
  ledgerRow,
  monthly,
  monthsBetween,
  nextTaxDate,
  parseItems,
  parseMoney,
  pnl,
  previousRange,
  rangeOf,
  reminderDue,
  repeatDates,
  scheduleC,
  setAside,
  type Line,
} from "../src/lib/books/core";
import { cleanFileName, contentDisposition, receiptHeaders, sameOrigin, sniffReceipt } from "../src/lib/books/receipts";

const TODAY = "2026-09-20";
const L = (date: string, kind: "income" | "expense", category: string, dollars: number, extra: Partial<Line> = {}): Line => ({ date, kind, category, amountCents: Math.round(dollars * 100), ...extra });

test("books: money parses safely and formats with a real minus sign", () => {
  assert.equal(parseMoney("1,234.50"), 123450);
  assert.equal(parseMoney("$19"), 1900);
  assert.equal(parseMoney("0.1"), 10);
  assert.equal(parseMoney("12.345"), null);
  assert.equal(parseMoney("abc"), null);
  assert.equal(parseMoney(""), null);
  assert.equal(fmtCents(123450), "$1,234.50");
  assert.equal(fmtCents(-500, "USD", { whole: true }), "−$5");
  assert.equal(fmtCents(500, "USD", { sign: true }), "+$5.00");
});

test("books: categories are unique and typed", () => {
  assert.equal(new Set(CATEGORIES.map((c) => c.key)).size, CATEGORIES.length);
  assert.ok(isCategory("advertising", "expense"));
  assert.ok(!isCategory("advertising", "income"));
  assert.ok(!isCategory("__proto__"));
});

test("books: ranges are inclusive and the comparison period has the same length", () => {
  assert.deepEqual(rangeOf("mtd", TODAY), { key: "mtd", label: "Month to date", from: "2026-09-01", to: TODAY });
  assert.equal(rangeOf("last_month", TODAY).from, "2026-08-01");
  assert.equal(rangeOf("last_month", TODAY).to, "2026-08-31");
  assert.equal(rangeOf("qtd", TODAY).from, "2026-07-01");
  assert.equal(rangeOf("ytd", TODAY).from, "2026-01-01");
  assert.equal(rangeOf("last_year", TODAY).to, "2025-12-31");
  assert.equal(rangeOf("30d", TODAY).from, "2026-08-22");
  assert.equal(rangeOf("12m", TODAY).from, "2025-10-01");
  assert.equal(rangeOf("custom", TODAY, { from: "2026-05-01", to: "2026-04-01" }).to, TODAY, "an inverted range falls back to today");
  assert.equal(rangeOf("nonsense", TODAY).key, "mtd");
  const prev = previousRange(rangeOf("mtd", TODAY));
  assert.deepEqual([prev.from, prev.to], ["2026-08-12", "2026-08-31"]);
  assert.deepEqual(monthsBetween("2025-11-15", "2026-02-01"), ["2025-11", "2025-12", "2026-01", "2026-02"]);
});

test("books: P&L ignores voided lines and other periods", () => {
  const lines = [
    L("2026-09-02", "income", "listing_fees", 100),
    L("2026-09-03", "income", "sponsorship", 50),
    L("2026-09-04", "expense", "advertising", 40),
    L("2026-09-05", "expense", "software", 10, { voidedAt: new Date() }),
    L("2026-08-30", "expense", "advertising", 999),
  ];
  const p = pnl(lines, rangeOf("mtd", TODAY));
  assert.equal(p.income, 15000);
  assert.equal(p.expenses, 4000);
  assert.equal(p.net, 11000);
  assert.ok(Math.abs((p.margin ?? 0) - 11 / 15) < 1e-9);
  assert.deepEqual(
    p.byCategory.map((c) => c.key),
    ["listing_fees", "sponsorship", "advertising"],
  );
  assert.equal(pnl([], rangeOf("mtd", TODAY)).margin, null);
  const m = monthly(lines, ["2026-08", "2026-09"]);
  assert.deepEqual(m[0], { month: "2026-08", income: 0, expenses: 99900, net: -99900 });
  assert.equal(m[1].net, 11000);
  assert.equal(delta(150, 100), 0.5);
  assert.equal(delta(5, 0), null);
  assert.equal(delta(0, 0), 0);
});

test("books: Schedule C roll-up groups by line and skips non-deductible spend", () => {
  const s = scheduleC(
    [
      L("2026-02-01", "income", "listing_fees", 1000),
      L("2026-03-01", "expense", "advertising", 200),
      L("2026-03-02", "expense", "software", 30),
      L("2026-03-03", "expense", "other_expense", 20),
      L("2026-03-04", "expense", "meals", 80, { deductible: false }),
      L("2025-12-31", "expense", "advertising", 500),
    ],
    2026,
  );
  assert.equal(s.gross, 100000);
  assert.equal(s.deductible, 25000);
  assert.equal(s.profit, 75000);
  assert.deepEqual(
    s.lines.map((l) => [l.line, l.cents]),
    [
      ["8", 20000],
      ["27a", 5000],
    ],
  );
  assert.deepEqual(s.lines[1].labels.sort(), ["Other expense", "Software & hosting"]);
});

test("books: tax set-aside is a simple, capped percentage and dates roll forward", () => {
  assert.equal(setAside(100000, 25), 25000);
  assert.equal(setAside(-5, 25), 0);
  assert.equal(setAside(100000, 90), 60000);
  assert.equal(nextTaxDate("2026-09-20"), "2027-01-15");
  assert.equal(nextTaxDate("2026-09-10"), "2026-09-15");
  assert.equal(nextTaxDate("2026-01-10"), "2026-01-15");
});

test("invoices: items, totals, states, numbering and reminder schedule", () => {
  const items = parseItems('[{"description":"Sponsored slot","quantity":2,"unitCents":3500},{"bad":1}]');
  assert.equal(items.length, 1);
  assert.deepEqual(parseItems("nope"), []);
  assert.deepEqual(invoiceTotals(items, 8.875), { subtotal: 7000, tax: 621, total: 7621 });
  assert.equal(invoiceTotals(items, 99).tax, 1750, "tax is capped at 25%");
  assert.equal(invoiceState({ status: "sent", dueDate: "2026-09-19" }, TODAY), "overdue");
  assert.equal(invoiceState({ status: "sent", dueDate: "2026-09-22" }, TODAY), "due_soon");
  assert.equal(invoiceState({ status: "sent", dueDate: "2026-10-22" }, TODAY), "sent");
  assert.equal(invoiceState({ status: "paid", dueDate: "2026-01-01" }, TODAY), "paid");
  assert.equal(invoiceNumber(2026, 7), "INV-2026-0007");
  assert.equal(daysLate("2026-09-13", TODAY), 7);
  const now = Date.parse(`${TODAY}T12:00:00Z`);
  const inv = (dueDate: string, reminders: number, last: Date | null = null) => ({ status: "sent", dueDate, reminders, lastReminderAt: last });
  assert.ok(reminderDue(inv("2026-09-19", 0), TODAY, now), "day 1");
  assert.ok(!reminderDue(inv("2026-09-19", 1), TODAY, now), "second reminder waits for day 7");
  assert.ok(reminderDue(inv("2026-09-13", 1, new Date(now - 6 * 86_400_000)), TODAY, now));
  assert.ok(!reminderDue(inv("2026-09-13", 1, new Date(now - 2 * 86_400_000)), TODAY, now), "not twice in five days");
  assert.ok(!reminderDue(inv("2026-08-01", 3), TODAY, now), "three at most");
  assert.ok(!reminderDue({ ...inv("2026-08-01", 0), status: "paid" }, TODAY, now));
});

test("books: monthly repeats fill each month once, clamped to the month's last day", () => {
  assert.deepEqual(repeatDates("2026-06-30", TODAY), ["2026-07-30", "2026-08-30"]);
  assert.deepEqual(repeatDates("2026-01-31", "2026-03-31"), ["2026-02-28", "2026-03-31"]);
  assert.deepEqual(repeatDates("2026-09-01", TODAY), []);
  assert.deepEqual(repeatDates("bad", TODAY), []);
});

test("books: insights put money problems first and stay quiet when all is well", () => {
  const empty = pnl([], rangeOf("mtd", TODAY));
  const base = { now: empty, before: empty, today: TODAY, overdue: { count: 0, cents: 0 }, drafts: 0, uncategorised: 0, unsyncedPayments: 0, adSpendUnbooked: 0, leadsNow: 0, leadsBefore: 0, setAsideCents: 0, taxRate: 25, months: [] };
  assert.deepEqual(bookInsights(base), []);
  const busy = bookInsights({ ...base, overdue: { count: 2, cents: 70000 }, unsyncedPayments: 3, setAsideCents: 5000 });
  assert.deepEqual(
    busy.map((i) => i.id),
    ["overdue", "sync", "tax"],
  );
  const adsNow = pnl([L(TODAY, "expense", "advertising", 300)], rangeOf("mtd", TODAY));
  const adsBefore = pnl([L("2026-08-20", "expense", "advertising", 300)], { from: "2026-08-01", to: "2026-08-31" });
  const cpl = bookInsights({ ...base, now: adsNow, before: adsBefore, leadsNow: 5, leadsBefore: 10 });
  assert.ok(cpl.some((i) => i.id === "cpl"), "cost per lead doubled");
  const burn = bookInsights({ ...base, months: [{ income: 0, expenses: 100 }, { income: 10, expenses: 100 }, { income: 0, expenses: 100 }] });
  assert.ok(burn.some((i) => i.id === "burn"));
});

test("books: CSV rows sign expenses negative and mark voids", () => {
  const row = ledgerRow({ ...L(TODAY, "expense", "advertising", 12.5), voidedAt: new Date(), description: "=HYPERLINK()" });
  assert.equal(row[4], -12.5);
  assert.equal(row[3], "8");
  assert.equal(row[11], "void");
});


test("receipts: the type comes from the bytes, not the name", () => {
  const pad = (head: number[] | string) => {
    const a = new Uint8Array(32);
    const bytes = typeof head === "string" ? [...head].map((c) => c.charCodeAt(0)) : head;
    a.set(bytes);
    return a;
  };
  assert.equal(sniffReceipt(pad([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(sniffReceipt(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assert.equal(sniffReceipt(pad("RIFF\0\0\0\0WEBPVP8 ")), "image/webp");
  assert.equal(sniffReceipt(pad("\0\0\0\x18ftypheic")), "image/heic");
  assert.equal(sniffReceipt(pad("%PDF-1.7\n")), "application/pdf");
  assert.equal(sniffReceipt(pad("<svg xmlns=")), null, "SVG can carry scripts");
  assert.equal(sniffReceipt(pad("<!doctype html>")), null);
  assert.equal(sniffReceipt(pad("GIF89a")), null);
  assert.equal(sniffReceipt(new Uint8Array(4)), null);
});

test("receipts: names are cleaned and served safely", () => {
  assert.equal(cleanFileName("../../etc/passwd", "application/pdf"), "passwd.pdf");
  assert.equal(cleanFileName('C:\\Users\\me\\Uber "Sept".HEIC', "image/heic"), "Uber Sept.heic");
  assert.equal(cleanFileName("", "image/jpeg"), "receipt.jpg");
  assert.equal(cleanFileName("invoice.pdf.exe", "application/pdf"), "invoice.pdf.pdf");
  assert.equal(contentDisposition("Café reçu.pdf", false), `inline; filename="Caf_ re_u.pdf"; filename*=UTF-8''Caf%C3%A9%20re%C3%A7u.pdf`);
  const img = receiptHeaders({ contentType: "image/png", fileName: "a.png", size: 10 }, true);
  assert.equal(img["X-Content-Type-Options"], "nosniff");
  assert.equal(img["Cache-Control"], "private, no-store");
  assert.match(img["Content-Disposition"], /^attachment;/);
  assert.match(img["Content-Security-Policy"], /default-src 'none'/);
  assert.equal(receiptHeaders({ contentType: "application/pdf", fileName: "a.pdf", size: 10 }, false)["Content-Security-Policy"], undefined);
});

test("receipts: uploads must come from the desk's own origin", () => {
  const req = (h: Record<string, string>) => new Request("https://app.rentleaks.com/api/admin/receipts", { method: "POST", headers: h });
  assert.ok(sameOrigin(req({ origin: "https://app.rentleaks.com", host: "app.rentleaks.com" })));
  assert.ok(!sameOrigin(req({ origin: "https://evil.example", host: "app.rentleaks.com" })));
  assert.ok(!sameOrigin(req({ origin: "null", host: "app.rentleaks.com" })));
  assert.ok(!sameOrigin(req({ host: "app.rentleaks.com" })));
  assert.ok(sameOrigin(req({ host: "app.rentleaks.com", "sec-fetch-site": "same-origin" })));
});
