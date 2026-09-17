import Link from "next/link";
import { booksSettingsAction, entryAction, invoiceAction, saveEntry, saveInvoice, syncAction } from "@/app/admin/_actions/books";
import { BulkForm, SelectAll } from "@/components/admin/desk/BulkForm";
import { Kpi, RankedBars } from "@/components/admin/desk/charts";
import { DeskHeader } from "@/components/admin/desk/DeskHeader";
import { CashChart } from "@/components/admin/desk/finance";
import { Icon } from "@/components/admin/desk/Icon";
import { PrintButton } from "@/components/admin/desk/PrintButton";
import { RangeBar } from "@/components/admin/desk/RangeBar";
import { RouteDrawer } from "@/components/admin/desk/RouteDrawer";
import { Chip, Empty, Panel, ViewSwitch, type ChipTone } from "@/components/admin/desk/parts";
import { flashOf, qs, readParams, when, type SP } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import {
  bookInsights,
  CATEGORIES,
  CATEGORY,
  delta,
  fmtCents,
  invoiceState,
  METHODS,
  monthLabel,
  monthly,
  monthsBetween,
  nextTaxDate,
  parseItems,
  pnl,
  previousRange,
  rangeOf,
  scheduleC,
  setAside,
  type Insight,
  type InvoiceState,
} from "@/lib/books/core";
import { adSpendGap, booksSettings, booksToday, renderInvoice, unsyncedPayments } from "@/lib/books/data";

export const metadata = { title: "Books & accounting — RentLeaks desk" };

const TABS = ["overview", "ledger", "invoices", "tax", "reports"] as const;
type Tab = (typeof TABS)[number];
const STATE: Record<InvoiceState, { label: string; tone: ChipTone }> = {
  draft: { label: "Draft", tone: "ink" },
  sent: { label: "Sent", tone: "brand" },
  due_soon: { label: "Due soon", tone: "warn" },
  overdue: { label: "Overdue", tone: "bad" },
  paid: { label: "Paid", tone: "good" },
  void: { label: "Void", tone: "" },
};
const INSIGHT_TONE: Record<Insight["tone"], string> = { bad: "is-bad", warn: "is-warn", info: "is-info", good: "is-good" };
const pct = (d: number | null) => (d === null ? "new" : d === 0 ? "no change" : `${d > 0 ? "▲" : "▼"} ${Math.abs(Math.round(d * 100))}%`);
const usd = (c: number) => fmtCents(c, "USD", { whole: true });

/**
 * Books: 1 see the money (period P&L, cash by month, suggestions), 2 record it
 * (ledger, invoices, Stripe and ad sync), 3 hand it over (tax view, printable
 * P&L, CSV exports).
 */
export default async function BooksPage({ searchParams }: { searchParams: SP }) {
  await requireAdminPage("/admin/books");
  const p = await readParams(searchParams);
  const tab: Tab = (TABS as readonly string[]).includes(p.tab ?? "") ? (p.tab as Tab) : "overview";
  const today = booksToday();
  const range = rangeOf(p.range ?? "mtd", today, { from: p.from, to: p.to });
  const prev = previousRange(range);
  const self = (over: Record<string, string | undefined> = {}) => `/admin/books${qs(p, { ok: undefined, err: undefined, ...over })}`;
  const keep = { tab: p.tab, range: p.range, from: p.from, to: p.to, kind: p.kind, category: p.category, q: p.q, state: p.state };
  const year = Number(p.year) >= 2020 && Number(p.year) <= Number(today.slice(0, 4)) ? Number(p.year) : Number(today.slice(0, 4));
  const chartMonths = monthsBetween(`${Number(today.slice(0, 4)) - 1}-${today.slice(5, 7)}-01`, today).slice(-12);
  const earliest = [prev.from, `${chartMonths[0]}-01`, `${year}-01-01`, `${Number(today.slice(0, 4))}-01-01`].sort()[0];

  const [lines, invoices, settings, unsynced, adGap, leadsNow, leadsBefore, clients] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where: { date: { gte: earliest } },
      select: { id: true, date: true, kind: true, category: true, amountCents: true, voidedAt: true, deductible: true },
      take: 50_000,
    }),
    prisma.invoice.findMany({ orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }], take: 500 }),
    booksSettings(),
    unsyncedPayments().catch(() => 0),
    adSpendGap().catch(() => 0),
    prisma.lead.count({ where: { createdAt: { gte: new Date(`${range.from}T00:00:00Z`), lte: new Date(`${range.to}T23:59:59Z`) }, status: { not: "spam" } } }),
    prisma.lead.count({ where: { createdAt: { gte: new Date(`${prev.from}T00:00:00Z`), lte: new Date(`${prev.to}T23:59:59Z`) }, status: { not: "spam" } } }),
    prisma.user.findMany({ where: { role: { in: ["host", "renter"] } }, select: { id: true, name: true, email: true }, orderBy: { createdAt: "desc" }, take: 400 }),
  ]);
  const clientName = new Map(clients.map((c) => [c.id, c.name]));

  const now = pnl(lines, range);
  const before = pnl(lines, prev);
  const months = monthly(lines, chartMonths).map((m) => ({ ...m, label: monthLabel(m.month) }));
  const ytd = scheduleC(lines, Number(today.slice(0, 4)));
  const reserve = setAside(ytd.profit, settings.taxRate);
  const states = invoices.map((i) => ({ i, s: invoiceState(i, today) }));
  const overdue = states.filter((x) => x.s === "overdue");
  const open = states.filter((x) => x.s === "sent" || x.s === "due_soon" || x.s === "overdue");
  const outstanding = open.reduce((n, x) => n + x.i.totalCents, 0);
  const uncategorised = lines.filter((l) => !l.voidedAt && l.category === "other_expense").length;
  const insights = bookInsights({
    now,
    before,
    today,
    overdue: { count: overdue.length, cents: overdue.reduce((n, x) => n + x.i.totalCents, 0) },
    drafts: states.filter((x) => x.s === "draft").length,
    uncategorised,
    unsyncedPayments: unsynced,
    adSpendUnbooked: adGap,
    leadsNow,
    leadsBefore,
    setAsideCents: reserve,
    taxRate: settings.taxRate,
    months: months.slice(-3),
  });

  return (
    <div className="dk-stack">
      <DeskHeader
        href="/admin/books"
        flash={flashOf(p)}
        signals={[
          { label: `Net · ${range.label.toLowerCase()}`, value: `${fmtCents(now.net, "USD", { whole: true })} · ${pct(delta(now.net, before.net))}`, tone: now.net >= 0 ? "live" : "warn" },
          { label: "Owed to you", value: `${usd(outstanding)} · ${overdue.length} overdue`, tone: overdue.length ? "critical" : "ok", href: self({ tab: "invoices", state: "open" }) },
          { label: "Tax set-aside (YTD)", value: `${usd(reserve)} at ${settings.taxRate}%`, tone: "ok", href: self({ tab: "tax" }) },
        ]}
        actions={
          <>
            <Link prefetch={false} className="dk-btn dk-btn--onink" href={self({ tab: "ledger", add: "expense", edit: undefined })} scroll={false}>
              <Icon name="plus" size={15} /> Expense
            </Link>
            <Link prefetch={false} className="dk-btn dk-btn--onink" href={self({ tab: "ledger", add: "income", edit: undefined })} scroll={false}>
              <Icon name="plus" size={15} /> Income
            </Link>
            <Link prefetch={false} className="dk-btn dk-btn--light" href={self({ tab: "invoices", new: "1" })} scroll={false}>
              <Icon name="invoice" size={15} /> New invoice
            </Link>
          </>
        }
      />

      <ViewSwitch
        label="Books"
        items={[
          { key: "overview", label: "Overview", href: self({ tab: undefined, add: undefined, edit: undefined, open: undefined, new: undefined }), on: tab === "overview", icon: "overview" },
          { key: "ledger", label: "Ledger", href: self({ tab: "ledger", open: undefined, new: undefined }), on: tab === "ledger", icon: "list" },
          { key: "invoices", label: "Invoices", href: self({ tab: "invoices", add: undefined, edit: undefined }), on: tab === "invoices", icon: "invoice", count: overdue.length || undefined },
          { key: "tax", label: "Tax", href: self({ tab: "tax", add: undefined, edit: undefined, open: undefined, new: undefined }), on: tab === "tax", icon: "flag" },
          { key: "reports", label: "Reports & settings", href: self({ tab: "reports", add: undefined, edit: undefined, open: undefined, new: undefined }), on: tab === "reports", icon: "export" },
        ]}
      />

      {tab !== "invoices" && tab !== "tax" ? <RangeBar path="/admin/books" range={range} keep={keep} compare={`${prev.from} → ${prev.to}`} /> : null}

      {tab === "overview" ? (
        <>
          <div className="dk-kpis">
            <Kpi label="Income" value={Math.round(now.income / 100)} fmt="usd" sub={`${pct(delta(now.income, before.income))} vs previous`} tone="value" href={self({ tab: "ledger", kind: "income" })} />
            <Kpi label="Expenses" value={Math.round(now.expenses / 100)} fmt="usd" sub={`${pct(delta(now.expenses, before.expenses))} vs previous`} href={self({ tab: "ledger", kind: "expense" })} />
            <Kpi label="Net profit" value={Math.round(now.net / 100)} fmt="usd" sub={now.margin === null ? "no income yet" : `${Math.round(now.margin * 100)}% margin`} tone={now.net >= 0 ? "good" : "alert"} />
            <Kpi label="Owed to you" value={Math.round(outstanding / 100)} fmt="usd" sub={`${open.length} open invoice${open.length === 1 ? "" : "s"}`} tone={overdue.length ? "alert" : undefined} href={self({ tab: "invoices", state: "open" })} />
            <Kpi label="Ad spend per lead" value={leadsNow ? Math.round((now.byCategory.find((c) => c.key === "advertising")?.cents ?? 0) / 100 / leadsNow) : 0} fmt="usd" sub={`${leadsNow} lead${leadsNow === 1 ? "" : "s"} this period`} />
          </div>

          <div className="dk-grid dk-grid--2-1 dk-grid--top">
            <Panel kicker="1 · See" title="Cash by month" sub="Income and expenses side by side; the line is what was left. Last 12 months.">
              <CashChart rows={months} />
            </Panel>
            <Panel kicker="Suggestions" title={insights.length ? `${insights.length} thing${insights.length === 1 ? "" : "s"} to look at` : "All clear"} sub="Read from your books, invoices, Stripe and Paid ads.">
              {insights.length ? (
                <ul className="dk-insights">
                  {insights.map((i) => (
                    <li key={i.id} className={INSIGHT_TONE[i.tone]}>
                      <Icon name={i.tone === "good" ? "check" : i.tone === "info" ? "idea" : "flag"} size={16} />
                      <div>
                        <b>{i.title}</b>
                        <p>{i.body}</p>
                      </div>
                      {i.href ? (
                        <Link prefetch={false} className="dk-btn dk-btn--sm" href={i.href.startsWith("?") ? `/admin/books${i.href}` : i.href.startsWith("#") ? self({ tab: undefined }) + i.href : i.href} scroll={false}>
                          {i.cta ?? "Open"}
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty title="Nothing needs you.">Books are synced, invoices are current and spending is steady.</Empty>
              )}
            </Panel>
          </div>

          <div className="dk-grid dk-grid--2">
            <Panel title="Where the money comes from" sub={range.label}>
              <RankedBars
                fmt="usd"
                empty="No income in this period."
                rows={now.byCategory.filter((c) => c.kind === "income").map((c) => ({ key: c.key, label: c.label, value: Math.round(c.cents / 100), hint: `${Math.round(c.share * 100)}%`, href: self({ tab: "ledger", category: c.key }) }))}
              />
            </Panel>
            <Panel title="Where it goes" sub={range.label}>
              <RankedBars
                fmt="usd"
                empty="No expenses in this period."
                rows={now.byCategory.filter((c) => c.kind === "expense").map((c) => ({ key: c.key, label: c.label, value: Math.round(c.cents / 100), hint: `${Math.round(c.share * 100)}%`, href: self({ tab: "ledger", category: c.key }) }))}
              />
            </Panel>
          </div>

          <div className="dk-grid dk-grid--2">
            <Panel kicker="2 · Record" title="Quick expense" sub="Three fields. Everything else can wait.">
              <EntryForm kind="expense" today={today} returnTo={self()} compact clients={clients} />
            </Panel>
            <Panel id="sync" kicker="Automatic" title="Sync" sub="Runs on its own every five minutes; press to run now.">
              <ul className="dk-synclist">
                <li>
                  <Icon name="revenue" size={16} />
                  <div>
                    <b>Stripe payments</b>
                    <small>{unsynced ? `${unsynced} payment${unsynced === 1 ? "" : "s"} not in the books yet` : "Up to date"}</small>
                  </div>
                  <form action={syncAction}>
                    <input type="hidden" name="what" value="payments" />
                    <input type="hidden" name="returnTo" value={self()} />
                    <button className="dk-btn dk-btn--sm" disabled={!unsynced}>
                      Sync
                    </button>
                  </form>
                </li>
                <li>
                  <Icon name="ads" size={16} />
                  <div>
                    <b>Ad spend from Paid ads</b>
                    <small>{adGap ? `${usd(adGap)} recorded there, not booked here` : "Books match Paid ads"} · skip this if you enter ad bills by hand</small>
                  </div>
                  <form action={syncAction}>
                    <input type="hidden" name="what" value="ads" />
                    <input type="hidden" name="returnTo" value={self()} />
                    <button className="dk-btn dk-btn--sm" disabled={!adGap}>
                      Book it
                    </button>
                  </form>
                </li>
                <li>
                  <Icon name="clock" size={16} />
                  <div>
                    <b>Monthly repeats and invoice reminders</b>
                    <small>Repeating lines are copied into each new month; overdue invoices get reminders on day 1, 7 and 14.</small>
                  </div>
                  <form action={syncAction}>
                    <input type="hidden" name="what" value="all" />
                    <input type="hidden" name="returnTo" value={self()} />
                    <button className="dk-btn dk-btn--sm">Run all</button>
                  </form>
                </li>
              </ul>
            </Panel>
          </div>
        </>
      ) : null}

      {tab === "ledger" ? <Ledger p={p} range={range} self={self} today={today} clients={clients} clientName={clientName} /> : null}
      {tab === "invoices" ? <Invoices p={p} states={states} self={self} today={today} terms={settings.terms} clients={clients} /> : null}

      {tab === "tax" ? (
        <TaxView lines={lines} year={year} today={today} rate={settings.taxRate} self={self} />
      ) : null}

      {tab === "reports" ? (
        <>
          <Panel kicker="3 · Hand over" title={`Profit & loss · ${range.label}`} sub={`${range.from} to ${range.to}, compared with ${prev.from} to ${prev.to}. Voided lines are left out.`} className="dk-print" actions={<PrintButton />}>
            <table className="dk-table dk-pnl">
              <thead>
                <tr>
                  <th />
                  <th className="dk-right">This period</th>
                  <th className="dk-right">Previous</th>
                  <th className="dk-right">Change</th>
                </tr>
              </thead>
              <tbody>
                {(["income", "expense"] as const).map((k) => {
                  const keys = [...new Set([...now.byCategory, ...before.byCategory].filter((c) => c.kind === k).map((c) => c.key))];
                  const val = (x: typeof now, key: string) => x.byCategory.find((c) => c.key === key)?.cents ?? 0;
                  const total = k === "income" ? [now.income, before.income] : [now.expenses, before.expenses];
                  return [
                    <tr key={`${k}-h`} className="dk-pnl__section">
                      <th colSpan={4}>{k === "income" ? "Income" : "Expenses"}</th>
                    </tr>,
                    ...keys.map((key) => (
                      <tr key={`${k}-${key}`}>
                        <td>{CATEGORY.get(key)?.label ?? key}</td>
                        <td className="dk-right">{fmtCents(val(now, key))}</td>
                        <td className="dk-right dk-dim">{fmtCents(val(before, key))}</td>
                        <td className="dk-right dk-dim">{pct(delta(val(now, key), val(before, key)))}</td>
                      </tr>
                    )),
                    <tr key={`${k}-t`} className="dk-pnl__total">
                      <td>Total {k === "income" ? "income" : "expenses"}</td>
                      <td className="dk-right">{fmtCents(total[0])}</td>
                      <td className="dk-right">{fmtCents(total[1])}</td>
                      <td className="dk-right">{pct(delta(total[0], total[1]))}</td>
                    </tr>,
                  ];
                })}
                <tr className="dk-pnl__net">
                  <td>Net profit</td>
                  <td className="dk-right">{fmtCents(now.net)}</td>
                  <td className="dk-right">{fmtCents(before.net)}</td>
                  <td className="dk-right">{pct(delta(now.net, before.net))}</td>
                </tr>
              </tbody>
            </table>
            <p className="dk-hint dk-print__foot">Prepared from the RentLeaks books on {today}. Cash basis: income counts when received, expenses when paid.</p>
          </Panel>

          <div className="dk-grid dk-grid--2">
            <Panel title="Exports" sub="CSV files open in Excel, Numbers and Google Sheets; formulas are neutralised.">
              <ul className="dk-synclist">
                {[
                  { href: `/api/admin/export/ledger?from=${range.from}&to=${range.to}`, label: "Ledger", sub: `Every line from ${range.from} to ${range.to}` },
                  { href: `/api/admin/export/pnl?from=${range.from}&to=${range.to}`, label: "Profit & loss", sub: "By category with Schedule C line hints" },
                  { href: "/api/admin/export/ledger", label: "Full ledger", sub: "All time, including voided lines" },
                  { href: "/api/admin/export/invoices", label: "Invoices", sub: "Every invoice with its state" },
                  { href: "/api/admin/export/payments", label: "Stripe payments", sub: "As recorded by checkout" },
                ].map((x) => (
                  <li key={x.href}>
                    <Icon name="export" size={16} />
                    <div>
                      <b>{x.label}</b>
                      <small>{x.sub}</small>
                    </div>
                    <a className="dk-btn dk-btn--sm" href={x.href}>
                      Download CSV
                    </a>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Settings" sub="Used for invoices and the tax set-aside.">
              <form action={booksSettingsAction} className="dk-form">
                <input type="hidden" name="returnTo" value={self()} />
                <label className="dk-field">
                  <span>Tax set-aside rate (%)</span>
                  <input name="taxRate" type="number" min={0} max={60} step={0.5} defaultValue={settings.taxRate} />
                </label>
                <label className="dk-field">
                  <span>Invoice terms (days)</span>
                  <input name="terms" type="number" min={0} max={120} defaultValue={settings.terms} />
                </label>
                <label className="dk-field dk-field--wide">
                  <span>How clients pay (printed on every invoice)</span>
                  <textarea name="payInstructions" rows={4} defaultValue={settings.payInstructions} placeholder={"Zelle: billing@rentleaks.com\nACH: Bank name · routing · account (last 4 on request)"} />
                </label>
                <p className="dk-hint">Never put full card numbers here. The sender name and mailing address come from System.</p>
                <button className="dk-btn dk-btn--primary">Save settings</button>
              </form>
            </Panel>
          </div>
        </>
      ) : null}
    </div>
  );
}

type Client = { id: string; name: string; email: string };

function EntryForm({
  kind,
  today,
  returnTo,
  compact = false,
  entry,
  clients,
}: {
  kind: "income" | "expense";
  today: string;
  returnTo: string;
  compact?: boolean;
  clients: Client[];
  entry?: {
    id: string;
    kind: string;
    category: string;
    amountCents: number;
    date: string;
    description: string;
    counterparty: string;
    method: string;
    reference: string | null;
    receiptUrl: string | null;
    deductible: boolean;
    repeatMonthly: boolean;
    repeatedFromId: string | null;
    sourceKey: string | null;
    userId: string | null;
  };
}) {
  const k = (entry?.kind as "income" | "expense") ?? kind;
  const cats = CATEGORIES.filter((c) => c.kind === k);
  const client = entry?.userId ? clients.find((c) => c.id === entry.userId)?.email ?? "" : "";
  return (
    <form action={saveEntry} className="dk-form">
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="kind" value={k} />
      {entry ? <input type="hidden" name="id" value={entry.id} /> : null}
      <label className="dk-field">
        <span>Amount (USD)</span>
        <input name="amount" inputMode="decimal" required placeholder="49.99" defaultValue={entry ? (entry.amountCents / 100).toFixed(2) : ""} readOnly={Boolean(entry?.sourceKey)} autoFocus={!compact} />
      </label>
      <label className="dk-field">
        <span>Category</span>
        <select name="category" defaultValue={entry?.category ?? (k === "income" ? "other_income" : "software")}>
          {cats.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label} — {c.hint}
            </option>
          ))}
        </select>
      </label>
      <label className="dk-field">
        <span>Date</span>
        <input name="date" type="date" required defaultValue={entry?.date ?? today} />
      </label>
      <label className="dk-field">
        <span>{k === "income" ? "From" : "Paid to"}</span>
        <input name="counterparty" placeholder={k === "income" ? "Client or source" : "Vendor, e.g. Cloudflare"} defaultValue={entry?.counterparty ?? ""} />
      </label>
      {compact ? null : (
        <>
          <label className="dk-field dk-field--wide">
            <span>What for</span>
            <input name="description" placeholder="Short description" defaultValue={entry?.description ?? ""} />
          </label>
          <label className="dk-field">
            <span>Paid by</span>
            <select name="method" defaultValue={entry?.method || (k === "income" ? "bank" : "card")}>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="dk-field">
            <span>Reference (optional)</span>
            <input name="reference" placeholder="Receipt or order number" defaultValue={entry?.reference ?? ""} />
          </label>
          <label className="dk-field dk-field--wide">
            <span>Receipt link (optional)</span>
            <input name="receiptUrl" type="url" placeholder="https://drive.google.com/…" defaultValue={entry?.receiptUrl ?? ""} />
          </label>
          <label className="dk-field">
            <span>Client account (optional)</span>
            <input name="client" type="email" list="bk-clients" placeholder="client@email.com" defaultValue={client} />
          </label>
          {k === "expense" ? (
            <label className="dk-field">
              <span>Deductible?</span>
              <select name="deductible" defaultValue={entry && !entry.deductible ? "no" : "yes"}>
                <option value="yes">Yes — business expense</option>
                <option value="no">No — keep out of the tax summary</option>
              </select>
            </label>
          ) : null}
          {entry?.repeatedFromId ? null : (
            <label className="dk-check dk-field--wide">
              <input type="checkbox" name="repeat" value="yes" defaultChecked={entry?.repeatMonthly} /> Repeats every month (subscriptions, rent) — copied into each new month automatically
            </label>
          )}
          <datalist id="bk-clients">
            {clients.map((c) => (
              <option key={c.id} value={c.email}>
                {c.name}
              </option>
            ))}
          </datalist>
        </>
      )}
      <button className="dk-btn dk-btn--primary">
        <Icon name="check" size={14} /> {entry ? "Save" : `Add ${k}`}
      </button>
    </form>
  );
}

async function Ledger({
  p,
  range,
  self,
  today,
  clients,
  clientName,
}: {
  p: Record<string, string>;
  range: { from: string; to: string; label: string };
  self: (o?: Record<string, string | undefined>) => string;
  today: string;
  clients: Client[];
  clientName: Map<string, string>;
}) {
  const kind = p.kind === "income" || p.kind === "expense" ? p.kind : undefined;
  const category = p.category && CATEGORY.has(p.category) ? p.category : undefined;
  const q = (p.q ?? "").trim();
  const rows = await prisma.ledgerEntry.findMany({
    where: {
      date: { gte: range.from, lte: range.to },
      ...(kind ? { kind } : {}),
      ...(category ? { category } : {}),
      ...(p.voided === "1" ? {} : { voidedAt: null }),
      ...(q ? { OR: [{ description: { contains: q, mode: "insensitive" } }, { counterparty: { contains: q, mode: "insensitive" } }, { reference: { contains: q, mode: "insensitive" } }] } : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 400,
  });
  const editing = p.edit ? await prisma.ledgerEntry.findUnique({ where: { id: p.edit } }) : null;
  const adding = p.add === "income" || p.add === "expense" ? p.add : null;
  const totalIn = rows.filter((r) => r.kind === "income" && !r.voidedAt).reduce((n, r) => n + r.amountCents, 0);
  const totalOut = rows.filter((r) => r.kind === "expense" && !r.voidedAt).reduce((n, r) => n + r.amountCents, 0);

  return (
    <>
      <form className="dk-filters" action="/admin/books" method="get">
        <input type="hidden" name="tab" value="ledger" />
        {p.range ? <input type="hidden" name="range" value={p.range} /> : null}
        {p.from ? <input type="hidden" name="from" value={p.from} /> : null}
        {p.to ? <input type="hidden" name="to" value={p.to} /> : null}
        <select name="kind" defaultValue={kind ?? ""} aria-label="Kind">
          <option value="">Income and expenses</option>
          <option value="income">Income only</option>
          <option value="expense">Expenses only</option>
        </select>
        <select name="category" defaultValue={category ?? ""} aria-label="Category">
          <option value="">Every category</option>
          {CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.kind === "income" ? "↑" : "↓"} {c.label}
            </option>
          ))}
        </select>
        <input name="q" defaultValue={q} placeholder="Search vendor, note, reference" aria-label="Search" />
        <label className="dk-check">
          <input type="checkbox" name="voided" value="1" defaultChecked={p.voided === "1"} /> show voided
        </label>
        <button className="dk-btn">Filter</button>
        <a className="dk-btn dk-btn--ghost" href={`/api/admin/export/ledger?from=${range.from}&to=${range.to}`}>
          <Icon name="export" size={14} /> CSV
        </a>
      </form>

      <Panel
        flush
        title={`${rows.length} line${rows.length === 1 ? "" : "s"} · ${range.label}`}
        sub={`In ${fmtCents(totalIn)} · out ${fmtCents(totalOut)} · net ${fmtCents(totalIn - totalOut)}`}
        actions={
          <Link prefetch={false} className="dk-btn dk-btn--primary dk-btn--sm" href={self({ add: "expense", edit: undefined })} scroll={false}>
            <Icon name="plus" size={13} /> Add a line
          </Link>
        }
      >
        {rows.length === 0 ? (
          <Empty title="No lines here yet." action={<Link className="dk-btn dk-btn--primary" href={self({ add: "expense" })}>Record an expense</Link>}>
            Stripe payments and ad spend come in on their own; add bills and other income by hand.
          </Empty>
        ) : (
          <BulkForm
            action={entryAction}
            returnTo={self()}
            noun="line"
            ops={[
              { op: "recategorise", label: "Move to category", needs: "value", options: CATEGORIES.map((c) => ({ value: c.key, label: `${c.kind === "income" ? "↑" : "↓"} ${c.label}` })) },
              { op: "void", label: "Void", danger: true },
              { op: "restore", label: "Restore" },
            ]}
          >
            <div className="dk-tablewrap">
              <table className="dk-table dk-ledger">
                <thead>
                  <tr>
                    <th>
                      <SelectAll />
                    </th>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Details</th>
                    <th className="dk-right">Amount</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} data-row="" className={r.voidedAt ? "is-void" : undefined}>
                      <td>
                        <input type="checkbox" name="ids" value={r.id} aria-label={`Select ${r.description || r.category}`} />
                      </td>
                      <td className="dk-nowrap">{r.date}</td>
                      <td>
                        <span className={`dk-kind dk-kind--${r.kind}`}>{r.kind === "income" ? "↑" : "↓"}</span> {CATEGORY.get(r.category)?.label ?? r.category}
                      </td>
                      <td>
                        <b>{r.counterparty || "—"}</b>
                        <div className="dk-dim">
                          {r.description}
                          {r.userId ? (
                            <>
                              {" · "}
                              <Link prefetch={false} href={`/admin/accounts/${r.userId}`}>
                                {clientName.get(r.userId) ?? "client"}
                              </Link>
                            </>
                          ) : null}
                        </div>
                        <div className="dk-chiprow">
                          {r.sourceKey ? <Chip tone="brand">{r.sourceKey.startsWith("pay:") || r.sourceKey.startsWith("refund:") ? "Stripe" : r.sourceKey.startsWith("ad:") ? "Paid ads" : "invoice"}</Chip> : null}
                          {r.repeatMonthly ? <Chip tone="value">repeats monthly</Chip> : null}
                          {r.repeatedFromId ? <Chip>monthly copy</Chip> : null}
                          {!r.deductible ? <Chip tone="warn">not deductible</Chip> : null}
                          {r.voidedAt ? <Chip tone="bad">void</Chip> : null}
                          {r.receiptUrl ? (
                            <a className="dk-chip" href={r.receiptUrl} target="_blank" rel="noopener noreferrer">
                              receipt ↗
                            </a>
                          ) : null}
                        </div>
                      </td>
                      <td className={`dk-right dk-nowrap dk-amt dk-amt--${r.kind}`}>{fmtCents(r.kind === "expense" ? -r.amountCents : r.amountCents)}</td>
                      <td className="dk-nowrap">
                        <Link prefetch={false} className="dk-btn dk-btn--ghost dk-btn--sm" href={self({ edit: r.id, add: undefined })} scroll={false}>
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </BulkForm>
        )}
      </Panel>

      {adding || editing ? (
        <RouteDrawer
          closeHref={self({ add: undefined, edit: undefined })}
          kicker={editing ? `${editing.kind} · added ${when(editing.createdAt, false)}${editing.sourceKey ? " · synced" : ""}` : "New line"}
          title={editing ? `${CATEGORY.get(editing.category)?.label ?? editing.category} · ${fmtCents(editing.amountCents)}` : adding === "income" ? "Record income" : "Record an expense"}
          width={620}
        >
          {editing?.sourceKey ? <p className="dk-flash dk-flash--warn">This line came from a sync — the amount is locked. You can still fix its category, date and notes.</p> : null}
          <EntryForm kind={adding ?? "expense"} today={today} returnTo={self({ add: undefined, edit: undefined })} entry={editing ?? undefined} clients={clients} />
          {editing ? (
            <form action={entryAction} className="dk-inline" style={{ marginTop: 16 }}>
              <input type="hidden" name="id" value={editing.id} />
              <input type="hidden" name="returnTo" value={self({ edit: undefined })} />
              <button className="dk-btn" name="op" value="duplicate">
                <Icon name="copy" size={13} /> Copy to today
              </button>
              <button className="dk-btn dk-btn--ghost" name="op" value={editing.voidedAt ? "restore" : "void"}>
                {editing.voidedAt ? "Restore" : "Void"}
              </button>
            </form>
          ) : null}
        </RouteDrawer>
      ) : null}
    </>
  );
}

type InvoiceRow = Awaited<ReturnType<typeof prisma.invoice.findMany>>[number];

async function Invoices({
  p,
  states,
  self,
  today,
  terms,
  clients,
}: {
  p: Record<string, string>;
  states: Array<{ i: InvoiceRow; s: InvoiceState }>;
  self: (o?: Record<string, string | undefined>) => string;
  today: string;
  terms: number;
  clients: Client[];
}) {
  const filter = p.state ?? "";
  const shown = states.filter((x) => (filter === "open" ? ["sent", "due_soon", "overdue"].includes(x.s) : filter ? x.s === filter : true));
  const count = (s: InvoiceState) => states.filter((x) => x.s === s).length;
  const sum = (list: typeof states) => list.reduce((n, x) => n + x.i.totalCents, 0);
  const paidThisYear = sum(states.filter((x) => x.s === "paid" && (x.i.paidAt?.toISOString().slice(0, 4) ?? "") === today.slice(0, 4)));
  const open = p.open ? states.find((x) => x.i.id === p.open) : undefined;
  const editing = p.editInv ? states.find((x) => x.i.id === p.editInv)?.i : undefined;
  const preset = p.client ? clients.find((c) => c.id === p.client) : undefined;
  const preview = open ? await renderInvoice(open.i, { reminder: open.s === "overdue" ? open.i.reminders + 1 : 0, today }) : null;
  const due = new Date(Date.parse(`${today}T00:00:00Z`) + terms * 86_400_000).toISOString().slice(0, 10);

  return (
    <>
      <div className="dk-kpis">
        <Kpi label="Owed to you" value={Math.round(sum(states.filter((x) => ["sent", "due_soon", "overdue"].includes(x.s))) / 100)} fmt="usd" tone="value" href={self({ state: "open" })} active={filter === "open"} />
        <Kpi label="Overdue" value={count("overdue")} sub={usd(sum(states.filter((x) => x.s === "overdue")))} tone={count("overdue") ? "alert" : undefined} href={self({ state: "overdue" })} active={filter === "overdue"} />
        <Kpi label="Due in 3 days" value={count("due_soon")} href={self({ state: "due_soon" })} active={filter === "due_soon"} />
        <Kpi label="Drafts" value={count("draft")} href={self({ state: "draft" })} active={filter === "draft"} />
        <Kpi label={`Paid in ${today.slice(0, 4)}`} value={Math.round(paidThisYear / 100)} fmt="usd" tone="good" href={self({ state: "paid" })} active={filter === "paid"} />
      </div>

      <Panel
        flush
        title={filter ? `${shown.length} ${STATE[filter as InvoiceState]?.label.toLowerCase() ?? "open"} invoice${shown.length === 1 ? "" : "s"}` : `${states.length} invoice${states.length === 1 ? "" : "s"}`}
        sub="Reminders go out on their own on day 1, 7 and 14 after the due date."
        actions={
          <>
            {filter ? (
              <Link prefetch={false} className="dk-btn dk-btn--ghost dk-btn--sm" href={self({ state: undefined })}>
                Show all
              </Link>
            ) : null}
            <Link prefetch={false} className="dk-btn dk-btn--primary dk-btn--sm" href={self({ new: "1", open: undefined })} scroll={false}>
              <Icon name="plus" size={13} /> New invoice
            </Link>
          </>
        }
      >
        {shown.length === 0 ? (
          <Empty title={states.length ? "Nothing in this view." : "No invoices yet."} action={<Link className="dk-btn dk-btn--primary" href={self({ new: "1" })}>Create the first one</Link>}>
            Invoice operators, partners and sponsorship deals. Paid invoices land in the books as income.
          </Empty>
        ) : (
          <div className="dk-tablewrap">
            <table className="dk-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Client</th>
                  <th>Due</th>
                  <th className="dk-right">Total</th>
                  <th>State</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map(({ i, s }) => (
                  <tr key={i.id} className={open?.i.id === i.id ? "is-on" : undefined}>
                    <td>
                      <Link prefetch={false} href={self({ open: i.id, new: undefined, editInv: undefined })} scroll={false}>
                        <b className="dk-mono">{i.number}</b>
                      </Link>
                      <div className="dk-dim">issued {i.issueDate}</div>
                    </td>
                    <td>
                      {i.userId ? (
                        <Link prefetch={false} href={`/admin/accounts/${i.userId}`}>
                          {i.billToName}
                        </Link>
                      ) : (
                        i.billToName
                      )}
                      <div className="dk-dim">{i.billToEmail}</div>
                    </td>
                    <td className="dk-nowrap">{i.dueDate}</td>
                    <td className="dk-right dk-nowrap">
                      <b>{fmtCents(i.totalCents, i.currency)}</b>
                    </td>
                    <td>
                      <Chip tone={STATE[s].tone}>{s === "overdue" ? `${STATE[s].label} · ${Math.max(1, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${i.dueDate}T00:00:00Z`)) / 86_400_000))}d` : STATE[s].label}</Chip>
                      {i.reminders ? <div className="dk-dim">{i.reminders} reminder{i.reminders === 1 ? "" : "s"}</div> : null}
                    </td>
                    <td className="dk-nowrap">
                      <form action={invoiceAction} className="dk-inline">
                        <input type="hidden" name="id" value={i.id} />
                        <input type="hidden" name="returnTo" value={self()} />
                        {s === "draft" ? (
                          <button className="dk-btn dk-btn--primary dk-btn--sm" name="op" value="send">
                            Send
                          </button>
                        ) : null}
                        {s === "overdue" ? (
                          <button className="dk-btn dk-btn--sm" name="op" value="remind">
                            Remind
                          </button>
                        ) : null}
                        {["sent", "due_soon", "overdue"].includes(s) ? (
                          <button className="dk-btn dk-btn--sm" name="op" value="paid">
                            Paid
                          </button>
                        ) : null}
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {open && preview ? (
        <RouteDrawer closeHref={self({ open: undefined })} kicker={`${STATE[open.s].label} · ${open.i.billToEmail}`} title={`${open.i.number} · ${fmtCents(open.i.totalCents, open.i.currency)}`} width={660}>
          <div className="dk-dossier">
            <div className="dk-chiprow">
              <Chip tone={STATE[open.s].tone}>{STATE[open.s].label}</Chip>
              <Chip>issued {open.i.issueDate}</Chip>
              <Chip tone={open.s === "overdue" ? "bad" : ""}>due {open.i.dueDate}</Chip>
              {open.i.sentAt ? <Chip tone="brand">sent {when(open.i.sentAt, false)}</Chip> : null}
              {open.i.paidAt ? <Chip tone="good">paid {when(open.i.paidAt, false)} · {open.i.paidMethod}</Chip> : null}
              {open.i.userId ? (
                <Link prefetch={false} className="dk-chip dk-chip--brand" href={`/admin/accounts/${open.i.userId}`}>
                  client account →
                </Link>
              ) : null}
            </div>
            <div className="dk-invoice">
              <p className="dk-kicker">{open.s === "overdue" ? "The reminder they'll get" : "What they'll get"}</p>
              <b>{preview.subject}</b>
              <pre>{preview.text}</pre>
            </div>
            <form action={invoiceAction} className="dk-form">
              <input type="hidden" name="id" value={open.i.id} />
              <input type="hidden" name="returnTo" value={self()} />
              <div className="dk-inline dk-field--wide">
                {open.s === "draft" ? (
                  <button className="dk-btn dk-btn--primary" name="op" value="send">
                    <Icon name="mail" size={14} /> Send invoice
                  </button>
                ) : null}
                {["sent", "due_soon", "overdue"].includes(open.s) ? (
                  <button className="dk-btn" name="op" value={open.s === "overdue" ? "remind" : "send"}>
                    <Icon name="mail" size={14} /> {open.s === "overdue" ? "Send reminder now" : "Send again"}
                  </button>
                ) : null}
                {open.s !== "paid" && open.s !== "void" ? (
                  <Link prefetch={false} className="dk-btn" href={self({ editInv: open.i.id, open: undefined })} scroll={false}>
                    Edit
                  </Link>
                ) : null}
                <button className="dk-btn dk-btn--ghost" name="op" value="duplicate">
                  <Icon name="copy" size={14} /> Duplicate
                </button>
              </div>
              {["sent", "due_soon", "overdue", "draft"].includes(open.s) ? (
                <fieldset className="dk-fieldset dk-field--wide">
                  <legend>Record payment</legend>
                  <div className="dk-inline">
                    <input type="date" name="paidDate" defaultValue={today} aria-label="Paid on" />
                    <select name="method" defaultValue="bank" aria-label="Paid by">
                      {METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <button className="dk-btn dk-btn--primary" name="op" value="paid">
                      <Icon name="check" size={14} /> Mark paid
                    </button>
                  </div>
                </fieldset>
              ) : null}
              <div className="dk-inline dk-field--wide">
                {open.s === "paid" ? (
                  <button className="dk-btn dk-btn--ghost" name="op" value="unpaid">
                    Mark unpaid
                  </button>
                ) : null}
                {open.s !== "paid" && open.s !== "void" ? (
                  <button className="dk-btn dk-btn--ghost" name="op" value="void">
                    Void invoice
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        </RouteDrawer>
      ) : null}

      {p.new === "1" || editing ? (
        <RouteDrawer closeHref={self({ new: undefined, editInv: undefined })} kicker={editing ? `Editing ${editing.number}` : "New invoice"} title={editing ? editing.billToName : "Bill a client"} width={700}>
          <form action={saveInvoice} className="dk-form">
            <input type="hidden" name="returnTo" value={self({ new: undefined, editInv: undefined })} />
            {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
            <fieldset className="dk-fieldset dk-field--wide">
              <legend>1 · Who</legend>
              <div className="dk-form">
                <label className="dk-field">
                  <span>Name or company</span>
                  <input name="billToName" required defaultValue={editing?.billToName ?? preset?.name ?? ""} />
                </label>
                <label className="dk-field">
                  <span>Email</span>
                  <input name="billToEmail" type="email" required list="inv-clients" defaultValue={editing?.billToEmail ?? preset?.email ?? ""} />
                </label>
                <label className="dk-field">
                  <span>Issued</span>
                  <input name="issueDate" type="date" defaultValue={editing?.issueDate ?? today} />
                </label>
                <label className="dk-field">
                  <span>Due (terms: {terms} days)</span>
                  <input name="dueDate" type="date" defaultValue={editing?.dueDate ?? due} />
                </label>
              </div>
            </fieldset>
            <fieldset className="dk-fieldset dk-field--wide">
              <legend>2 · What</legend>
              <div className="dk-items">
                <span>Description</span>
                <span>Qty</span>
                <span>Price (USD)</span>
                {Array.from({ length: 5 }, (_, n) => {
                  const it = editing ? parseItems(editing.itemsJson)[n] : undefined;
                  return [
                    <input key={`d${n}`} name="itemDesc" aria-label={`Line ${n + 1} description`} placeholder={n === 0 ? "Sponsored placement — Brooklyn, October" : ""} defaultValue={it?.description ?? ""} required={n === 0} />,
                    <input key={`q${n}`} name="itemQty" aria-label={`Line ${n + 1} quantity`} inputMode="decimal" defaultValue={it ? String(it.quantity) : "1"} />,
                    <input key={`u${n}`} name="itemUnit" aria-label={`Line ${n + 1} price`} inputMode="decimal" placeholder={n === 0 ? "350.00" : ""} defaultValue={it ? (it.unitCents / 100).toFixed(2) : ""} required={n === 0} />,
                  ];
                })}
              </div>
              <div className="dk-form">
                <label className="dk-field">
                  <span>Sales tax (%) — leave 0 if none applies</span>
                  <input name="taxPct" type="number" min={0} max={25} step={0.001} defaultValue={editing && editing.subtotalCents ? Math.round((editing.taxCents / editing.subtotalCents) * 100000) / 1000 : 0} />
                </label>
                <label className="dk-field dk-field--wide">
                  <span>Note on the invoice (optional)</span>
                  <textarea name="note" rows={2} defaultValue={editing?.note ?? ""} placeholder="Thank you for your business." />
                </label>
              </div>
            </fieldset>
            <datalist id="inv-clients">
              {clients.map((c) => (
                <option key={c.id} value={c.email}>
                  {c.name}
                </option>
              ))}
            </datalist>
            <div className="dk-inline dk-field--wide">
              <button className="dk-btn">Save draft</button>
              <button className="dk-btn dk-btn--primary" name="send" value="1">
                <Icon name="mail" size={14} /> 3 · Save and send
              </button>
            </div>
          </form>
        </RouteDrawer>
      ) : null}
    </>
  );
}

function TaxView({
  lines,
  year,
  today,
  rate,
  self,
}: {
  lines: Array<{ date: string; kind: string; category: string; amountCents: number; voidedAt: Date | null; deductible: boolean }>;
  year: number;
  today: string;
  rate: number;
  self: (o?: Record<string, string | undefined>) => string;
}) {
  const s = scheduleC(lines, year);
  const thisYear = Number(today.slice(0, 4));
  const quarters = [1, 2, 3, 4].map((q) => {
    const from = `${year}-${String((q - 1) * 3 + 1).padStart(2, "0")}-01`;
    const to = new Date(Date.UTC(year, q * 3, 0)).toISOString().slice(0, 10);
    const r = pnl(lines.filter((l) => l.deductible !== false || l.kind === "income"), { from, to });
    return { q, from, to, profit: r.net, reserve: setAside(r.net, rate), future: from > today };
  });
  return (
    <>
      <nav className="dk-seg" aria-label="Tax year">
        {[thisYear, thisYear - 1, thisYear - 2].map((y) => (
          <Link key={y} prefetch={false} scroll={false} href={self({ year: String(y) })} className={y === year ? "is-on" : undefined}>
            {y}
          </Link>
        ))}
      </nav>
      <div className="dk-kpis">
        <Kpi label={`Gross receipts ${year}`} value={Math.round(s.gross / 100)} fmt="usd" tone="value" />
        <Kpi label="Deductible expenses" value={Math.round(s.deductible / 100)} fmt="usd" />
        <Kpi label="Profit" value={Math.round(s.profit / 100)} fmt="usd" tone={s.profit >= 0 ? "good" : "alert"} />
        <Kpi label={`Set aside at ${rate}%`} value={Math.round(setAside(s.profit, rate) / 100)} fmt="usd" sub={year === thisYear ? `next estimated date ${nextTaxDate(today)}` : "for that year"} />
      </div>
      <div className="dk-grid dk-grid--2-1">
        <Panel title={`Expense summary for ${year}`} sub="Grouped by where each category usually lands on Schedule C (Form 1040). A starting point for your accountant, not tax advice.">
          {s.lines.length ? (
            <table className="dk-table">
              <thead>
                <tr>
                  <th>Line</th>
                  <th>Categories</th>
                  <th className="dk-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="dk-mono">1</td>
                  <td>Gross receipts</td>
                  <td className="dk-right">
                    <b>{fmtCents(s.gross)}</b>
                  </td>
                </tr>
                {s.lines.map((l) => (
                  <tr key={l.line}>
                    <td className="dk-mono">{l.line}</td>
                    <td>{l.labels.join(", ")}</td>
                    <td className="dk-right">{fmtCents(l.cents)}</td>
                  </tr>
                ))}
                <tr className="dk-pnl__net">
                  <td />
                  <td>Profit before tax</td>
                  <td className="dk-right">{fmtCents(s.profit)}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <Empty title={`No expenses booked for ${year}.`} />
          )}
          <p className="dk-hint" style={{ marginTop: 10 }}>
            Refunds are listed under line 2 (returns and allowances). Lines marked “not deductible” are left out. Download the ledger in Reports for the full detail.
          </p>
        </Panel>
        <Panel title="Quarter by quarter" sub={`Profit and a ${rate}% set-aside. Change the rate in Reports & settings.`}>
          <ul className="dk-quarters">
            {quarters.map((q) => (
              <li key={q.q} className={q.future ? "is-future" : undefined}>
                <b>Q{q.q}</b>
                <span>{q.future ? "not started" : fmtCents(q.profit, "USD", { whole: true })}</span>
                <em>{q.future ? "—" : `set aside ${fmtCents(q.reserve, "USD", { whole: true })}`}</em>
              </li>
            ))}
          </ul>
          <p className="dk-hint" style={{ marginTop: 10 }}>
            Federal estimated payments are usually due {`${year}-04-15, ${year}-06-15, ${year}-09-15 and ${year + 1}-01-15`}. Your accountant sets the real amounts.
          </p>
        </Panel>
      </div>
    </>
  );
}
