/**
 * Playbooks: "when this happens, wait, then do that" — the desk's own
 * automations, in plain words. Each playbook fires at most once per target
 * (a PlaybookRun row claims it first), respects unsubscribes, and never
 * touches example listings or desk accounts.
 */
import { canAccess, type AccessKey } from "@/lib/access";
import { logActivity } from "@/lib/crm";
import { prisma } from "@/lib/prisma";
import { sampleCatalogIds } from "@/lib/sample-catalog";
import { appUrl } from "@/lib/site";
import { sendMail } from "@/lib/v1/mail";
import { SAFETY_NOTE } from "./shortlist";

const MIN = 60_000;
const DAY = 86_400_000;
/** A new playbook reaches back this far, not into the whole history. */
export const LOOKBACK_DAYS = 7;
const BATCH = 40;

export const TRIGGERS = {
  lead_waiting: {
    label: "A request has no personal reply",
    when: "after",
    unit: "after the request arrived",
    who: "renter",
    key: "leads" as AccessKey,
    defaultWait: 120,
  },
  shortlist_no_reply: {
    label: "A shortlist went out and nothing moved",
    when: "after",
    unit: "after the shortlist was sent",
    who: "renter",
    key: "leads" as AccessKey,
    defaultWait: 2 * 1440,
  },
  trial_ending: {
    label: "A host's free week is ending",
    when: "before",
    unit: "before the free week ends",
    who: "host",
    key: "trials" as AccessKey,
    defaultWait: 2 * 1440,
  },
  listing_declined: {
    label: "A listing was declined and not fixed",
    when: "after",
    unit: "after it was declined",
    who: "host",
    key: "listings" as AccessKey,
    defaultWait: 3 * 1440,
  },
  booking_moveout: {
    label: "A renter's stay is ending",
    when: "before",
    unit: "before move-out",
    who: "renter",
    key: "bookings" as AccessKey,
    defaultWait: 45 * 1440,
  },
  contact_quiet: {
    label: "A contacted lead in the CRM went quiet",
    when: "after",
    unit: "after the last contact",
    who: "contact",
    key: "crm" as AccessKey,
    defaultWait: 14 * 1440,
  },
} as const;
export type TriggerKey = keyof typeof TRIGGERS;

export const ACTIONS = {
  send_email: { label: "Email them", hint: "Uses your subject and message, with merge fields." },
  notify_team: { label: "Alert the team", hint: "Emails everyone who can open that page." },
  set_follow_up: { label: "Put it on the Next-best board", hint: "Sets a CRM follow-up for today." },
} as const;
export type ActionKey = keyof typeof ACTIONS;

export const MERGE_FIELDS = ["{{first_name}}", "{{name}}", "{{city}}", "{{home}}", "{{date}}", "{{link}}"] as const;

export function isTrigger(v: string): v is TriggerKey {
  return Object.prototype.hasOwnProperty.call(TRIGGERS, v);
}
export function isAction(v: string): v is ActionKey {
  return Object.prototype.hasOwnProperty.call(ACTIONS, v);
}

/** Ready-made recipes: one click adds them (off until switched on). */
export const RECIPES: Array<{ id: string; name: string; trigger: TriggerKey; waitMinutes: number; action: ActionKey; subject: string; body: string; pitch: string }> = [
  {
    id: "two-hour-alarm",
    name: "Two-hour alarm",
    trigger: "lead_waiting",
    waitMinutes: 120,
    action: "notify_team",
    subject: "Still waiting: {{name}} ({{city}})",
    body: "{{name}} asked about {{home}} two hours ago and hasn't had a personal reply yet.",
    pitch: "No renter waits past two hours unseen.",
  },
  {
    id: "shortlist-check-in",
    name: "Shortlist check-in",
    trigger: "shortlist_no_reply",
    waitMinutes: 2 * 1440,
    action: "send_email",
    subject: "Did any of these homes fit, {{first_name}}?",
    body: "Hi {{first_name}},\n\nA couple of days ago we sent you homes in {{city}}. Did any of them catch your eye? Reply with the one you like and we'll set up a viewing — in person or on a live video call.\n\nNone quite right? Tell us what to change (area, budget, dates) and we'll look again.\n\n" + SAFETY_NOTE + "\n\nRentLeaks",
    pitch: "Turns silent shortlists into viewings.",
  },
  {
    id: "trial-last-call",
    name: "Free-week last call",
    trigger: "trial_ending",
    waitMinutes: 2 * 1440,
    action: "send_email",
    subject: "Your free week ends {{date}}",
    body: "Hi {{first_name}},\n\nYour RentLeaks free week ends on {{date}}. To keep your listing live, pick the weekly or monthly plan in your account: {{link}}\n\nAnything holding you back? Just reply.\n\nRentLeaks",
    pitch: "Converts trials before they lapse.",
  },
  {
    id: "declined-rescue",
    name: "Declined-listing rescue",
    trigger: "listing_declined",
    waitMinutes: 3 * 1440,
    action: "send_email",
    subject: "Your listing “{{home}}” is one fix away",
    body: "Hi {{first_name}},\n\nYour listing “{{home}}” is close. Once the note from our review is fixed it comes straight back for a quick check: {{link}}\n\nReply if anything is unclear — happy to help.\n\nRentLeaks",
    pitch: "Recovers supply you already had.",
  },
  {
    id: "renewal-heads-up",
    name: "Renewal heads-up",
    trigger: "booking_moveout",
    waitMinutes: 45 * 1440,
    action: "send_email",
    subject: "Staying on after {{date}}?",
    body: "Hi {{first_name}},\n\nYour stay at {{home}} ends on {{date}}. Would you like to extend? Reply with how many more months and we'll check with the host.\n\nMoving on? Tell us what you need next and we'll send homes that fit.\n\nRentLeaks",
    pitch: "Keeps renters instead of re-finding them.",
  },
  {
    id: "quiet-contact",
    name: "Quiet-contact follow-up",
    trigger: "contact_quiet",
    waitMinutes: 14 * 1440,
    action: "set_follow_up",
    subject: "",
    body: "",
    pitch: "Nobody in the CRM goes cold unnoticed.",
  },
];

export function waitLabel(mins: number) {
  if (mins < 60) return `${mins} min`;
  if (mins < 1440) return `${Math.round(mins / 60)} h`;
  const d = Math.round(mins / 1440);
  return `${d} day${d === 1 ? "" : "s"}`;
}

/** Pure: fills {{fields}}; unknown fields are left blank, never shown raw. */
export function merge(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, k: string) => vars[k] ?? "");
}

type Target = { id: string; type: "lead" | "user" | "listing" | "booking" | "contact"; email: string; name: string; vars: Record<string, string>; desk: string };

const first = (n: string) => n.trim().split(/\s+/)[0] || "there";
const day = (d: Date | string) => (typeof d === "string" ? new Date(`${d}T12:00:00Z`) : d).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });

/** Who is due for a playbook right now. */
export async function candidates(pb: { trigger: string; waitMinutes: number; createdAt: Date }, now: Date): Promise<Target[]> {
  const t = now.getTime();
  const wait = Math.max(0, pb.waitMinutes) * MIN;
  const floor = new Date(Math.max(pb.createdAt.getTime() - LOOKBACK_DAYS * DAY, t - 60 * DAY));
  const base = appUrl().replace(/\/$/, "");
  const cities = new Map((await prisma.city.findMany({ select: { id: true, name: true } })).map((c) => [c.id, c.name]));
  const vars = (name: string, extra: Record<string, string>) => ({ first_name: first(name), name, city: "", home: "", date: "", link: base, ...extra });

  switch (pb.trigger) {
    case "lead_waiting": {
      const rows = await prisma.lead.findMany({
        where: { status: "new", createdAt: { lte: new Date(t - wait), gte: floor } },
        orderBy: { createdAt: "asc" },
        take: BATCH,
        include: { listing: { select: { title: true } } },
      });
      return rows.map((l) => ({
        id: l.id,
        type: "lead",
        email: l.email,
        name: l.name,
        desk: `${base}/admin/leads?open=${l.id}`,
        vars: vars(l.name, { city: l.cityId ? cities.get(l.cityId) ?? "" : "", home: l.listing?.title ?? "a home", link: `${base}/stays` }),
      }));
    }
    case "shortlist_no_reply": {
      const rows = await prisma.lead.findMany({
        where: { status: { in: ["new", "contacted"] }, matchesSentAt: { lte: new Date(t - wait), gte: floor } },
        orderBy: { matchesSentAt: "asc" },
        take: BATCH,
      });
      const booked = new Set((await prisma.booking.findMany({ where: { leadId: { in: rows.map((r) => r.id) } }, select: { leadId: true } })).map((b) => b.leadId));
      return rows
        .filter((l) => !booked.has(l.id))
        .map((l) => ({
          id: l.id,
          type: "lead" as const,
          email: l.email,
          name: l.name,
          desk: `${base}/admin/match?lead=${l.id}`,
          vars: vars(l.name, { city: l.cityId ? cities.get(l.cityId) ?? "your city" : "your city", link: `${base}/stays` }),
        }));
    }
    case "trial_ending": {
      const rows = await prisma.user.findMany({
        where: { trialEndsAt: { gt: now, lte: new Date(t + wait) }, suspendedAt: null, role: { notIn: ["admin", "staff"] } },
        take: BATCH,
        select: { id: true, name: true, email: true, trialEndsAt: true, createdAt: true },
      });
      return rows
        .filter((u) => u.trialEndsAt!.getTime() - wait >= floor.getTime())
        .map((u) => ({ id: u.id, type: "user" as const, email: u.email, name: u.name, desk: `${base}/admin/trials`, vars: vars(u.name, { date: day(u.trialEndsAt!), link: `${base}/account` }) }));
    }
    case "listing_declined": {
      let sample: Set<string>;
      try {
        sample = await sampleCatalogIds();
      } catch {
        return [];
      }
      const rows = await prisma.listing.findMany({
        where: { moderation: "declined", moderatedAt: { lte: new Date(t - wait), gte: floor }, host: { role: { notIn: ["admin", "staff"] }, suspendedAt: null } },
        take: BATCH,
        select: { id: true, title: true, cityId: true, host: { select: { name: true, email: true } } },
      });
      return rows
        .filter((l) => !sample.has(l.id))
        .map((l) => ({
          id: l.id,
          type: "listing" as const,
          email: l.host.email,
          name: l.host.name,
          desk: `${base}/admin/listings?edit=${l.id}`,
          vars: vars(l.host.name, { home: l.title, city: cities.get(l.cityId) ?? "", link: `${base}/account` }),
        }));
    }
    case "booking_moveout": {
      const rows = await prisma.booking.findMany({ where: { stage: { in: ["signed", "moved_in"] }, moveOut: { not: null } }, take: 500 });
      const due = rows.filter((b) => {
        const end = Date.parse(`${b.moveOut}T00:00:00Z`);
        return Number.isFinite(end) && end > t && end - wait <= t && end - wait >= floor.getTime();
      });
      const titles = new Map(
        (await prisma.listing.findMany({ where: { id: { in: due.map((b) => b.listingId).filter((x): x is string => !!x) } }, select: { id: true, title: true } })).map((l) => [l.id, l.title]),
      );
      return due.slice(0, BATCH).map((b) => ({
        id: b.id,
        type: "booking" as const,
        email: b.renterEmail,
        name: b.renterName,
        desk: `${base}/admin/bookings?open=${b.id}`,
        vars: vars(b.renterName, { home: (b.listingId && titles.get(b.listingId)) || "your home", date: day(b.moveOut!), link: base }),
      }));
    }
    case "contact_quiet": {
      const rows = await prisma.contact.findMany({
        where: { stage: "contacted", unsubscribedAt: null, nextFollowUpAt: null, lastContactedAt: { lte: new Date(t - wait), gte: floor } },
        orderBy: { lastContactedAt: "asc" },
        take: BATCH,
      });
      return rows.map((c) => ({
        id: c.id,
        type: "contact" as const,
        email: c.email,
        name: c.name || c.email.split("@")[0],
        desk: `${base}/admin/crm/${c.id}`,
        vars: vars(c.name || "", { city: c.cityId ? cities.get(c.cityId) ?? "" : "" }),
      }));
    }
  }
  return [];
}

async function blocked(email: string) {
  const e = email.toLowerCase();
  const [s, c] = await Promise.all([prisma.emailSuppression.findUnique({ where: { email: e } }), prisma.contact.findUnique({ where: { email: e }, select: { unsubscribedAt: true } })]);
  return !!s || !!c?.unsubscribedAt;
}

type PB = { id: string; name: string; trigger: string; waitMinutes: number; action: string; subject: string; body: string; createdAt: Date };

async function alertDigest(pb: PB, targets: Target[]) {
  const key = isTrigger(pb.trigger) ? TRIGGERS[pb.trigger].key : "leads";
  const team = (
    await prisma.user.findMany({ where: { role: { in: ["admin", "staff"] }, suspendedAt: null, NOT: { passwordHash: "" } }, select: { email: true, role: true, staffAccess: true } })
  ).filter((u) => canAccess(u, key));
  const one = targets.length === 1;
  const subject = one ? merge(pb.subject || `${pb.name}: {{name}}`, targets[0].vars) : `${pb.name}: ${targets.length} need a look`;
  const lines = targets.map((t) => `• ${merge(pb.body || "{{name}} needs a look.", t.vars)}\n  ${t.desk}`);
  const text = `${lines.join("\n\n")}\n\n— Playbook “${pb.name}”`;
  const sent = await Promise.allSettled(team.map((u) => sendMail({ to: u.email, subject, text })));
  return sent.length;
}

async function act(pb: PB, target: Target, now: Date): Promise<{ status: "done" | "skipped" | "failed"; detail: string }> {
  if (pb.action === "send_email") {
    if (await blocked(target.email)) return { status: "skipped", detail: "unsubscribed" };
    const mail = await sendMail({ to: target.email, subject: merge(pb.subject, target.vars), text: merge(pb.body, target.vars), purpose: "personal" });
    if (!mail.delivered && mail.transport !== "console") return { status: "failed", detail: mail.error ?? mail.transport };
    const contact = await prisma.contact.findUnique({ where: { email: target.email.toLowerCase() }, select: { id: true } });
    if (contact) {
      await logActivity(contact.id, "email", `Playbook: ${pb.name}`, merge(pb.subject, target.vars)).catch(() => undefined);
      await prisma.contact.update({ where: { id: contact.id }, data: { lastContactedAt: now } }).catch(() => undefined);
    }
    return { status: "done", detail: mail.transport === "console" ? "recorded (email not configured)" : `emailed ${target.email}` };
  }
  if (pb.action === "notify_team") {
    // Collected by runPlaybooks and sent as one digest per teammate.
    return { status: "done", detail: "on the team alert" };
  }
  if (pb.action === "set_follow_up") {
    const contact = await prisma.contact.findUnique({ where: { email: target.email.toLowerCase() }, select: { id: true } });
    if (!contact) return { status: "skipped", detail: "no CRM contact" };
    await prisma.contact.update({ where: { id: contact.id }, data: { nextFollowUpAt: now } });
    return { status: "done", detail: "follow-up set for today" };
  }
  return { status: "failed", detail: "unknown action" };
}

/** Cron: runs every enabled playbook once over its due targets. */
export async function runPlaybooks(now = new Date()) {
  const books = await prisma.playbook.findMany({ where: { enabled: true }, orderBy: { createdAt: "asc" } });
  let fired = 0;
  for (const pb of books) {
    if (!isTrigger(pb.trigger) || !isAction(pb.action)) continue;
    const list = await candidates(pb, now).catch((err) => {
      console.error("[playbooks]", pb.name, err instanceof Error ? err.message : err);
      return [] as Target[];
    });
    if (!list.length) continue;
    const done = new Set(
      (await prisma.playbookRun.findMany({ where: { playbookId: pb.id, targetId: { in: list.map((x) => x.id) } }, select: { targetId: true } })).map((r) => r.targetId),
    );
    let n = 0;
    const alerts: Array<{ target: Target; runId: string }> = [];
    for (const target of list.filter((x) => !done.has(x.id))) {
      // Claim first: a second cron tick racing this one hits the unique key and skips.
      const claim = await prisma.playbookRun.create({ data: { playbookId: pb.id, targetType: target.type, targetId: target.id, status: "running" } }).catch(() => null);
      if (!claim) continue;
      if (pb.action === "notify_team") {
        alerts.push({ target, runId: claim.id });
        continue;
      }
      const r = await act(pb, target, now).catch((err) => ({ status: "failed" as const, detail: err instanceof Error ? err.message.slice(0, 200) : "error" }));
      await prisma.playbookRun.update({ where: { id: claim.id }, data: { status: r.status, detail: `${target.name} — ${r.detail}`.slice(0, 300) } });
      if (r.status === "done") n++;
    }
    if (alerts.length) {
      const people = await alertDigest(pb, alerts.map((a) => a.target)).catch(() => -1);
      const status = people >= 0 ? "done" : "failed";
      for (const a of alerts) {
        await prisma.playbookRun.update({
          where: { id: a.runId },
          data: { status, detail: `${a.target.name} — ${people >= 0 ? `in one alert to ${people} teammate${people === 1 ? "" : "s"}` : "alert failed"}`.slice(0, 300) },
        });
      }
      if (status === "done") n += alerts.length;
    }
    if (n) await prisma.playbook.update({ where: { id: pb.id }, data: { runs: { increment: n }, lastRunAt: now } });
    fired += n;
  }
  return fired;
}

/** Dry run for the editor: who would be touched right now (not already done). */
export async function preview(pb: { id?: string; trigger: string; waitMinutes: number; createdAt?: Date }, now = new Date()) {
  if (!isTrigger(pb.trigger)) return [];
  const list = await candidates({ ...pb, createdAt: pb.createdAt ?? now }, now).catch(() => [] as Target[]);
  if (!pb.id || !list.length) return list.map((x) => ({ id: x.id, name: x.name, desk: x.desk }));
  const done = new Set(
    (await prisma.playbookRun.findMany({ where: { playbookId: pb.id, targetId: { in: list.map((x) => x.id) } }, select: { targetId: true } })).map((r) => r.targetId),
  );
  return list.filter((x) => !done.has(x.id)).map((x) => ({ id: x.id, name: x.name, desk: x.desk }));
}
