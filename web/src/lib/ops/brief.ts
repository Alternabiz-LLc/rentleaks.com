/**
 * Morning brief: one email per desk member, at the hour they picked (New York
 * time), with the day's numbers and the top moves they are allowed to make.
 */
import { accessKeyForPath, canAccess } from "@/lib/access";
import { loadNextActions } from "@/lib/admin/copilot";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/site";
import { sendMail } from "@/lib/v1/mail";
import { renewalDue } from "./bookings";

const ZONE = "America/New_York";
const DAY = 86_400_000;

/** Hour (0–23) and calendar date in New York for a moment. */
export function nyClock(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: ZONE, hour: "numeric", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { hour: Number(get("hour")) % 24, date: `${get("year")}-${get("month")}-${get("day")}` };
}

/** Due when the picked hour has come and nothing went out that NY day. */
export function briefDue(u: { briefHour: number | null; briefLastSentAt: Date | null }, now: Date) {
  if (u.briefHour === null || u.briefHour === undefined) return false;
  const clock = nyClock(now);
  if (clock.hour < u.briefHour || clock.hour > u.briefHour + 2) return false;
  return !u.briefLastSentAt || nyClock(u.briefLastSentAt).date !== clock.date;
}

const count = <T,>(p: Promise<T>) => p.catch(() => null);

export async function sendBrief(userId: string, now = new Date(), force = false): Promise<false | "sent" | "logged"> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, staffAccess: true, suspendedAt: true, briefHour: true, briefLastSentAt: true },
  });
  if (!user || user.suspendedAt || (user.role !== "admin" && user.role !== "staff")) return false;
  if (!force && !briefDue(user, now)) return false;

  const can = (k: Parameters<typeof canAccess>[1]) => canAccess(user, k);
  const t = now.getTime();
  const dayStart = new Date(`${nyClock(now).date}T00:00:00Z`);
  const [newLeads, waiting, viewings, activeStays, pending, stale, actions] = await Promise.all([
    can("leads") ? count(prisma.lead.count({ where: { createdAt: { gte: new Date(t - DAY) }, status: { not: "spam" } } })) : null,
    can("leads") ? count(prisma.lead.count({ where: { status: "new", createdAt: { lte: new Date(t - 3_600_000) } } })) : null,
    can("bookings")
      ? count(prisma.booking.count({ where: { viewingAt: { gte: dayStart, lt: new Date(dayStart.getTime() + DAY) }, stage: { not: "lost" } } }))
      : null,
    can("bookings") ? count(prisma.booking.findMany({ where: { stage: { in: ["signed", "moved_in"] }, renewalRemindedAt: null }, select: { stage: true, moveOut: true }, take: 500 })) : null,
    can("listings") ? count(prisma.listing.count({ where: { moderation: "pending" } })) : null,
    can("listings") ? count(prisma.listing.count({ where: { status: "active", OR: [{ confirmedAt: null, postedAt: { lt: new Date(t - 30 * DAY) } }, { confirmedAt: { lt: new Date(t - 30 * DAY) } }] } })) : null,
    loadNextActions(now).catch(() => []),
  ]);
  const mine = actions.filter((a) => {
    const key = accessKeyForPath(a.href.split("?")[0]);
    return !key || can(key);
  });
  const renewals = activeStays ? activeStays.filter((b) => renewalDue(b, t, 60)).length : null;

  const base = appUrl().replace(/\/$/, "");
  const numbers = [
    newLeads !== null ? `New requests (24h): ${newLeads}` : null,
    waiting !== null ? `Waiting over an hour: ${waiting}` : null,
    viewings !== null ? `Viewings today: ${viewings}` : null,
    renewals !== null ? `Stays ending within 60 days, no renewal offer yet: ${renewals}` : null,
    pending !== null ? `Listings to review: ${pending}` : null,
    stale !== null ? `Live listings not confirmed in 30 days: ${stale}` : null,
  ].filter(Boolean) as string[];
  const top = mine.slice(0, 5);
  const moves = top.length ? top.map((a, i) => `${i + 1}. ${a.title}\n   ${a.reason}\n   ${base}${a.href}`).join("\n\n") : "Nothing urgent — a good morning to recruit hosts (Demand map).";
  const first = user.name.trim().split(/\s+/)[0] || "there";
  const date = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: ZONE });

  const text =
    `Good morning ${first} — here's ${date}.\n\n` +
    `THE NUMBERS\n${numbers.map((n) => `• ${n}`).join("\n") || "• —"}\n\n` +
    `YOUR TOP ${top.length || ""} MOVES\n${moves}\n\n` +
    `Open the desk: ${base}/admin\nChange or stop this brief: ${base}/admin/security#brief\n\nRentLeaks desk`;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const html =
    `<div style="font-family:system-ui,sans-serif;max-width:560px;color:#12212b">` +
    `<p style="font-size:15px">Good morning ${esc(first)} — here's <b>${esc(date)}</b>.</p>` +
    `<table style="border-collapse:collapse;width:100%;margin:12px 0">${numbers
      .map((n) => {
        const [k, v] = n.split(": ");
        return `<tr><td style="padding:6px 0;border-bottom:1px solid #e5e9ec">${esc(k)}</td><td style="padding:6px 0;border-bottom:1px solid #e5e9ec;text-align:right;font-weight:700">${esc(v)}</td></tr>`;
      })
      .join("")}</table>` +
    `<h3 style="margin:18px 0 8px;font-size:14px">Your top moves</h3>` +
    (top.length
      ? `<ol style="padding-left:18px">${top
          .map((a) => `<li style="margin-bottom:10px"><a href="${esc(base + a.href)}" style="color:#0b6e69;font-weight:600">${esc(a.title)}</a><br><span style="color:#56666f;font-size:13px">${esc(a.reason)}</span></li>`)
          .join("")}</ol>`
      : `<p>Nothing urgent — a good morning to recruit hosts.</p>`) +
    `<p><a href="${esc(base)}/admin" style="background:#0b6e69;color:#fff;padding:9px 14px;border-radius:8px;text-decoration:none">Open the desk</a></p>` +
    `<p style="color:#8a979e;font-size:12px">Change or stop this brief in <a href="${esc(base)}/admin/security#brief">Security</a>.</p></div>`;

  const mail = await sendMail({ to: user.email, subject: `Morning brief — ${top.length} move${top.length === 1 ? "" : "s"}${waiting ? `, ${waiting} waiting` : ""}`, text, html, purpose: "personal" });
  const ok = mail.delivered || mail.transport === "console";
  if (ok && !force) await prisma.user.update({ where: { id: user.id }, data: { briefLastSentAt: now } });
  return !ok ? false : mail.delivered ? "sent" : "logged";
}

/** Cron: every desk member whose hour has come. */
export async function sendDueBriefs(now = new Date()) {
  const users = await prisma.user.findMany({
    where: { role: { in: ["admin", "staff"] }, suspendedAt: null, briefHour: { not: null } },
    select: { id: true, briefHour: true, briefLastSentAt: true },
  });
  let sent = 0;
  for (const u of users.filter((x) => briefDue(x, now))) if (await sendBrief(u.id, now).catch(() => false)) sent++;
  return sent;
}
