/**
 * The automation clock, called by the five-minute cron after the outbox.
 * Every step is independent: one failing never stops the others.
 */
import { canAccess } from "@/lib/access";
import { runNetwork } from "@/lib/network/engine";
import { prisma } from "@/lib/prisma";
import { setSetting, SETTING_KEYS } from "@/lib/settings";
import { appUrl } from "@/lib/site";
import { sendMail } from "@/lib/v1/mail";
import { escalateWaiting } from "./autopilot";
import { renewalDue } from "./bookings";
import { nyClock, sendDueBriefs } from "./brief";
import { askFreshness, freshnessOn, pauseSilent } from "./freshness";
import { runBooks } from "@/lib/books/data";
import { runPlaybooks } from "./playbooks";
import { sendWeeklyReport } from "./report";

/** Daily jobs run in the first tick of this New York hour. */
export const DAILY_HOUR = { freshness: 10, renewals: 9 } as const;

export function firstTickOf(hour: number, now: Date) {
  return nyClock(now).hour === hour && now.getUTCMinutes() < 5;
}

async function step<T>(name: string, fn: () => Promise<T>): Promise<T | string> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[ops:${name}]`, err instanceof Error ? err.message : err);
    return "error";
  }
}

async function renewalNotice(now: Date) {
  const rows = await prisma.booking.findMany({ where: { stage: { in: ["signed", "moved_in"] }, renewalRemindedAt: null, moveOut: { not: null } }, take: 500 });
  const due = rows.filter((b) => renewalDue(b, now.getTime(), 60));
  if (!due.length) return 0;
  const team = (
    await prisma.user.findMany({ where: { role: { in: ["admin", "staff"] }, suspendedAt: null, NOT: { passwordHash: "" } }, select: { email: true, role: true, staffAccess: true } })
  ).filter((u) => canAccess(u, "bookings"));
  const base = appUrl().replace(/\/$/, "");
  const lines = due.slice(0, 20).map((b) => `• ${b.renterName} — stay ends ${b.moveOut}\n  ${base}/admin/bookings?open=${b.id}`);
  await Promise.allSettled(
    team.map((u) =>
      sendMail({
        to: u.email,
        subject: `${due.length} stay${due.length === 1 ? "" : "s"} ending soon — no renewal offer yet`,
        text: `These renters haven't been asked about staying on:\n\n${lines.join("\n")}\n\nOne click from Bookings → Renewals: ${base}/admin/bookings?view=renewals\n\nRentLeaks desk`,
      }),
    ),
  );
  return due.length;
}

export async function runOps(now = new Date()) {
  const out: Record<string, unknown> = {};
  out.escalated = await step("escalate", () => escalateWaiting(now));
  if (await freshnessOn().catch(() => false)) {
    out.paused = await step("pause", () => pauseSilent(now));
    if (firstTickOf(DAILY_HOUR.freshness, now)) out.asked = await step("ask", () => askFreshness({ now }));
  }
  if (firstTickOf(DAILY_HOUR.renewals, now)) out.renewals = await step("renewals", () => renewalNotice(now));
  out.briefs = await step("briefs", () => sendDueBriefs(now));
  out.playbooks = await step("playbooks", () => runPlaybooks(now));
  out.books = await step("books", () => runBooks(now));
  out.network = await step("network", () => runNetwork(now));
  out.weekly = await step("weekly", () => sendWeeklyReport(now));
  await setSetting(SETTING_KEYS.opsHeartbeat, now.toISOString()).catch(() => undefined);
  return out;
}
