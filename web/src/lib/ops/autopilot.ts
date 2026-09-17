/**
 * Speed-to-lead autopilot.
 *
 * 1. The instant reply: the renter's confirmation carries up to three live
 *    homes that fit, the moment the request arrives (on by default; System →
 *    Autopilot switches it off).
 * 2. The team alert: everyone whose access includes Leads hears about a new
 *    request — not only the founder.
 * 3. The one-hour escalation: a request still unanswered after an hour is
 *    sent to the team again, once.
 */
import { canAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getSetting, SETTING_KEYS } from "@/lib/settings";
import { appUrl } from "@/lib/site";
import { sendMail } from "@/lib/v1/mail";
import { SAFETY_NOTE, matchesFor, sendShortlist } from "./shortlist";

const MIN = 60_000;

export async function autopilotOn() {
  return (await getSetting(SETTING_KEYS.autopilot, "on")) !== "off";
}

/** Desk members who work leads (founder included), active and set up. */
export async function leadTeam() {
  const users = await prisma.user.findMany({
    where: { role: { in: ["admin", "staff"] }, suspendedAt: null, NOT: { passwordHash: "" } },
    select: { id: true, email: true, name: true, role: true, staffAccess: true },
  });
  return users.filter((u) => canAccess(u, "leads"));
}

type NewLead = {
  id: string;
  kind: string;
  name: string;
  email: string;
  listingId: string | null;
  cityId: string | null;
  housingType: string | null;
  budgetMax: number | null;
  currency: string;
  moveIn: string | null;
  moveOut: string | null;
  stayMonths: number | null;
};

/**
 * The renter's instant reply. Returns false when the autopilot is off or
 * nothing could be sent, so the caller falls back to the plain confirmation.
 */
export async function instantReply(lead: NewLead, subject: string, confirmation: string): Promise<boolean> {
  if (!(await autopilotOn())) return false;
  const offer = lead.kind === "match" || !lead.listingId;
  const matches = offer ? await matchesFor(lead, 3).catch(() => []) : [];
  const first = lead.name.trim().split(/\s+/)[0] || "there";
  if (matches.length) {
    const body =
      `Hi ${first},\n\nThanks for reaching out — we have your request:\n\n${confirmation}\n\n` +
      `While we look personally, here ${matches.length === 1 ? "is a home" : `are ${matches.length} homes`} that already fit (all-in monthly prices, no broker fee):\n\n{{homes}}\n\n` +
      `Reply to this email to see any of them — in person or on a live video call. A person from our team follows up within one business day either way.\n\n${SAFETY_NOTE}\n\nRentLeaks`;
    const r = await sendShortlist({ leadId: lead.id, listingIds: matches.map((m) => m.home.id), subject: `We got your request — ${subject}`, body, actorId: null, auto: true });
    if (r.ok) return true;
  }
  const mail = await sendMail({
    to: lead.email,
    subject: `We got your request — ${subject}`,
    text: `Hi ${first},\n\nThanks for reaching out. Here is what you sent:\n\n${confirmation}\n\nA person from our team replies within one business day, usually much sooner.\n\n${SAFETY_NOTE}\n\nRentLeaks`,
  });
  await prisma.lead.update({ where: { id: lead.id }, data: { ackSentAt: new Date() } }).catch(() => undefined);
  return mail.delivered || mail.transport === "console";
}

/** Emails every lead-desk member about a new request. */
export async function alertTeam(subject: string, text: string, exclude: string[] = []) {
  const team = await leadTeam();
  const skip = new Set(exclude.map((e) => e.toLowerCase()));
  await Promise.allSettled(team.filter((u) => !skip.has(u.email.toLowerCase())).map((u) => sendMail({ to: u.email, subject, text })));
  return team.map((u) => u.email);
}

/** Requests unanswered for an hour → one reminder to the team (cron). */
export async function escalateWaiting(now = new Date()) {
  const waiting = await prisma.lead.findMany({
    where: {
      status: "new",
      escalatedAt: null,
      createdAt: { lte: new Date(now.getTime() - 60 * MIN), gte: new Date(now.getTime() - 7 * 24 * 60 * MIN) },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: { id: true, name: true, kind: true, createdAt: true },
  });
  if (!waiting.length) return 0;
  const base = appUrl().replace(/\/$/, "");
  const lines = waiting.map((l) => `• ${l.name} — ${l.kind}, waiting ${Math.round((now.getTime() - l.createdAt.getTime()) / 3_600_000)}h\n  ${base}/admin/leads?open=${l.id}`);
  const team = await leadTeam();
  await Promise.allSettled(
    team.map((u) =>
      sendMail({
        to: u.email,
        subject: `${waiting.length} request${waiting.length === 1 ? "" : "s"} waiting over an hour`,
        text: `Hi ${u.name.split(/\s+/)[0]},\n\nThese renters haven't had a personal reply yet:\n\n${lines.join("\n")}\n\nThe fastest way: open Match & Send and send a shortlist — ${base}/admin/match\n\nRentLeaks desk`,
      }),
    ),
  );
  await prisma.lead.updateMany({ where: { id: { in: waiting.map((l) => l.id) } }, data: { escalatedAt: now } });
  return waiting.length;
}
