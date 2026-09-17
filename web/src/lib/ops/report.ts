/**
 * The Monday owner report: last week in one email to the founders — demand,
 * speed, conversion, money and the advisor's top moves. Sent once per week
 * (Monday 08:00 New York), switchable in Playbooks & autopilot.
 */
import { pnl, fmtCents } from "@/lib/books/core";
import { booksToday } from "@/lib/books/data";
import { prisma } from "@/lib/prisma";
import { getSetting, setSetting, SETTING_KEYS } from "@/lib/settings";
import { appUrl } from "@/lib/site";
import { sendMail } from "@/lib/v1/mail";
import { loadAdvice } from "./advisor";
import { nyClock } from "./brief";
import { median } from "./sla";

const DAY = 86_400_000;

export type WeekNumbers = {
  leads: number;
  leadsBefore: number;
  replyMins: number | null;
  shortlists: number;
  opened: number;
  bookingsSigned: number;
  newHosts: number;
  newListings: number;
  income: number;
  expenses: number;
  net: number;
  netBefore: number;
  /** Enterprise requests and newly signed engagements, when the module is in use. */
  enterprise?: { requests: number; signed: number };
};

const change = (a: number, b: number) => (b ? `${a >= b ? "▲" : "▼"} ${Math.abs(Math.round(((a - b) / b) * 100))}%` : a ? "new" : "—");

/** Pure: the lines of the report, so the tests can read them. */
export function reportLines(n: WeekNumbers) {
  return [
    ["Requests", `${n.leads} (${change(n.leads, n.leadsBefore)} vs the week before)`],
    ["Typical first reply", n.replyMins === null ? "—" : n.replyMins < 60 ? `${n.replyMins} min` : `${Math.round(n.replyMins / 60)} h`],
    ["Shortlists sent", `${n.shortlists}${n.shortlists ? ` · ${n.opened} opened` : ""}`],
    ["Leases signed", String(n.bookingsSigned)],
    ["New hosts / new listings", `${n.newHosts} / ${n.newListings}`],
    ...(n.enterprise ? [["Enterprise requests / signed", `${n.enterprise.requests} / ${n.enterprise.signed}`]] : []),
    ["Income", fmtCents(n.income, "USD", { whole: true })],
    ["Expenses", fmtCents(n.expenses, "USD", { whole: true })],
    ["Net", `${fmtCents(n.net, "USD", { whole: true })} (${change(n.net, n.netBefore)})`],
  ] as Array<[string, string]>;
}

/** ISO-like week key for "already sent this week". */
export function weekKey(now: Date) {
  const d = new Date(`${booksToday(now)}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - day * DAY).toISOString().slice(0, 10);
}

export async function weeklyNumbers(now = new Date()): Promise<WeekNumbers> {
  const t = now.getTime();
  const from = new Date(t - 7 * DAY);
  const before = new Date(t - 14 * DAY);
  const today = booksToday(now);
  const d7 = booksToday(new Date(t - 6 * DAY));
  const d14 = booksToday(new Date(t - 13 * DAY));
  const d8 = booksToday(new Date(t - 7 * DAY));
  const [leads, leadsBefore, answered, shortlists, signed, hosts, listings, lines] = await Promise.all([
    prisma.lead.count({ where: { createdAt: { gte: from }, status: { not: "spam" } } }),
    prisma.lead.count({ where: { createdAt: { gte: before, lt: from }, status: { not: "spam" } } }),
    prisma.lead.findMany({ where: { createdAt: { gte: from }, contactedAt: { not: null } }, select: { createdAt: true, contactedAt: true } }),
    prisma.lead.findMany({ where: { matchesSentAt: { gte: from } }, select: { shortlistOpenedAt: true } }),
    prisma.booking.count({ where: { stage: { in: ["signed", "moved_in"] }, updatedAt: { gte: from } } }),
    prisma.user.count({ where: { role: "host", createdAt: { gte: from } } }),
    prisma.listing.count({ where: { createdAt: { gte: from } } }),
    prisma.ledgerEntry.findMany({ where: { date: { gte: d14 } }, select: { date: true, kind: true, category: true, amountCents: true, voidedAt: true } }).catch(() => []),
  ]);
  const [entRequests, entSigned] = await Promise.all([
    prisma.serviceRequest.count({ where: { createdAt: { gte: from }, status: { not: "spam" } } }).catch(() => null),
    prisma.engagement.count({ where: { agreementSignedOn: { gte: d7 } } }).catch(() => null),
  ]);
  const now7 = pnl(lines, { from: d7, to: today });
  const prev7 = pnl(lines, { from: d14, to: d8 });
  const mins = median(answered.map((l) => (l.contactedAt!.getTime() - l.createdAt.getTime()) / 60_000).filter((m) => m >= 0));
  return {
    leads,
    leadsBefore,
    replyMins: mins === null ? null : Math.round(mins),
    shortlists: shortlists.length,
    opened: shortlists.filter((s) => s.shortlistOpenedAt).length,
    bookingsSigned: signed,
    newHosts: hosts,
    newListings: listings,
    income: now7.income,
    expenses: now7.expenses,
    net: now7.net,
    netBefore: prev7.net,
    enterprise: entRequests === null || entSigned === null || entRequests + entSigned === 0 ? undefined : { requests: entRequests, signed: entSigned },
  };
}

export async function sendWeeklyReport(now = new Date(), force = false) {
  if (!force) {
    const clock = nyClock(now);
    const monday = new Date(`${clock.date}T12:00:00Z`).getUTCDay() === 1;
    if (!monday || clock.hour < 8 || clock.hour > 11) return 0;
    if ((await getSetting(SETTING_KEYS.weeklyReport, "on")) === "off") return 0;
    if ((await getSetting(SETTING_KEYS.weeklyReportAt, "")) === weekKey(now)) return 0;
  }
  const founders = await prisma.user.findMany({ where: { role: "admin", suspendedAt: null }, select: { id: true, name: true, email: true, role: true, staffAccess: true, briefHour: true } });
  if (!founders.length) return 0;
  const n = await weeklyNumbers(now);
  const lines = reportLines(n);
  const advice = await loadAdvice(founders[0], now, 4).catch(() => []);
  const base = appUrl().replace(/\/$/, "");
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  let sent = 0;
  for (const f of founders) {
    const first = f.name.trim().split(/\s+/)[0] || "there";
    const text =
      `Good morning ${first} — here is last week at RentLeaks.\n\n${lines.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n` +
      `${advice.length ? `THIS WEEK'S MOVES\n${advice.map((a, i) => `${i + 1}. ${a.title} — ${a.body}\n   ${base}${a.href}`).join("\n")}\n\n` : ""}` +
      `Open the desk: ${base}/admin\nBooks: ${base}/admin/books\nStop this report: ${base}/admin/playbooks#settings\n\nRentLeaks desk`;
    const html =
      `<div style="font-family:system-ui,sans-serif;max-width:560px;color:#0f2328"><p>Good morning ${esc(first)} — here is <b>last week</b> at RentLeaks.</p>` +
      `<table style="border-collapse:collapse;width:100%">${lines.map(([k, v]) => `<tr><td style="padding:7px 0;border-bottom:1px solid #e3ecee">${esc(k)}</td><td style="padding:7px 0;border-bottom:1px solid #e3ecee;text-align:right;font-weight:700">${esc(v)}</td></tr>`).join("")}</table>` +
      (advice.length ? `<h3 style="font-size:14px;margin:20px 0 8px">This week's moves</h3><ol style="padding-left:18px">${advice.map((a) => `<li style="margin-bottom:8px"><a href="${esc(base + a.href)}" style="color:#00809a;font-weight:600">${esc(a.title)}</a><br><span style="color:#56696f;font-size:13px">${esc(a.body)}</span></li>`).join("")}</ol>` : "") +
      `<p><a href="${esc(base)}/admin" style="background:#1c5b69;color:#fff;padding:9px 14px;border-radius:8px;text-decoration:none">Open the desk</a></p><p style="color:#7d8f94;font-size:12px">Stop this report in Playbooks &amp; autopilot.</p></div>`;
    const mail = await sendMail({ to: f.email, subject: `Last week: ${n.leads} requests · net ${fmtCents(n.net, "USD", { whole: true })}`, text, html, purpose: "personal" });
    if (mail.delivered || mail.transport === "console") sent++;
  }
  if (!force) await setSetting(SETTING_KEYS.weeklyReportAt, weekKey(now));
  return sent;
}
