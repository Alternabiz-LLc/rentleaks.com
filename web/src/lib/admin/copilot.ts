/**
 * The Next-best board: everything on the desk that wants a move, ranked.
 *
 * Reads the book and turns it into actions — reply to this lead, review that
 * listing, nudge this host before their free week ends — each with a reason in
 * plain words and, where the move is an email, a draft ready to edit and send.
 */
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/site";
import { CHANNEL_LABEL, canAutoPublish } from "@/lib/social";
import {
  declinedDraft,
  followUpDraft,
  leadReplyDraft,
  rankActions,
  scoreContact,
  scoreLead,
  trialEndingDraft,
  upsellDraft,
  type NextAction,
} from "./score";

const DAY = 86_400_000;
const safe = <T,>(p: Promise<T>, fallback: T) => p.catch((err) => {
  console.error("[copilot]", err instanceof Error ? err.message : err);
  return fallback;
});

function hoursSince(d: Date, now: number) {
  return Math.max(0, (now - d.getTime()) / 3_600_000);
}

function waited(h: number) {
  return h < 1 ? "under an hour" : h < 48 ? `${Math.round(h)}h` : `${Math.round(h / 24)} days`;
}

export async function loadNextActions(now = new Date()): Promise<NextAction[]> {
  const t = now.getTime();
  const base = appUrl();
  const [leads, due, quiet, pending, trials, idleInvites, declined, reports, posts, bigHosts, qualified, cities] = await Promise.all([
    safe(
      prisma.lead.findMany({
        where: { status: "new" },
        orderBy: { createdAt: "asc" },
        take: 80,
        include: { listing: { select: { title: true } } },
      }),
      [],
    ),
    safe(prisma.contact.findMany({ where: { nextFollowUpAt: { lte: now } }, orderBy: { nextFollowUpAt: "asc" }, take: 40 }), []),
    safe(
      prisma.contact.findMany({
        where: { stage: "contacted", lastContactedAt: { lt: new Date(t - 21 * DAY) }, nextFollowUpAt: null, unsubscribedAt: null },
        orderBy: { lastContactedAt: "asc" },
        take: 20,
      }),
      [],
    ),
    safe(
      prisma.listing.findMany({
        where: { moderation: "pending" },
        orderBy: { createdAt: "asc" },
        take: 40,
        select: { id: true, title: true, createdAt: true, city: { select: { name: true } }, host: { select: { name: true } } },
      }),
      [],
    ),
    safe(
      prisma.user.findMany({
        where: { trialEndsAt: { gt: now, lte: new Date(t + 3 * DAY) } },
        select: { id: true, name: true, email: true, trialEndsAt: true, contact: { select: { id: true } }, _count: { select: { listings: true } } },
        take: 30,
      }),
      [],
    ),
    safe(
      prisma.trialInvite.findMany({
        where: { status: "sent", sentAt: { lt: new Date(t - 3 * DAY) }, expiresAt: { gt: now } },
        orderBy: { sentAt: "asc" },
        take: 20,
      }),
      [],
    ),
    safe(
      prisma.listing.findMany({
        where: { moderation: "declined", moderatedAt: { lt: new Date(t - 3 * DAY) } },
        orderBy: { moderatedAt: "asc" },
        take: 15,
        select: { id: true, title: true, moderationNote: true, moderatedAt: true, host: { select: { name: true, email: true, contact: { select: { id: true } } } } },
      }),
      [],
    ),
    safe(prisma.report.findMany({ where: { status: "open" }, orderBy: { createdAt: "asc" }, take: 20, select: { id: true, reason: true, createdAt: true, note: true } }), []),
    safe(prisma.socialPost.findMany({ where: { status: "scheduled", scheduledAt: { lte: now } }, orderBy: { scheduledAt: "asc" }, take: 20 }), []),
    safe(
      prisma.listing.groupBy({
        by: ["hostId"],
        where: { status: "active", sponsored: false, moderation: "approved" },
        _count: { _all: true },
        having: { hostId: { _count: { gte: 3 } } },
        orderBy: { _count: { hostId: "desc" } },
        take: 10,
      }),
      [],
    ),
    safe(
      prisma.contact.findMany({
        where: {
          stage: "qualified",
          kind: { in: ["host", "operator", "partner"] },
          unsubscribedAt: null,
          OR: [{ lastContactedAt: null }, { lastContactedAt: { lt: new Date(t - 7 * DAY) } }],
        },
        take: 15,
      }),
      [],
    ),
    safe(prisma.city.findMany({ select: { id: true, name: true } }), []),
  ]);
  const cityName = new Map(cities.map((c) => [c.id, c.name]));

  const actions: NextAction[] = [];

  for (const l of leads) {
    const h = hoursSince(l.createdAt, t);
    const { score } = scoreLead(l, t);
    const late = h >= 24;
    actions.push({
      id: `lead-${l.id}`,
      category: late ? "waiting-lead" : "new-lead",
      priority: Math.min(99, score + (late ? 20 : 8)),
      title: `Reply to ${l.name || l.email}`,
      reason: `${l.kind === "stay" ? "Booking request" : l.kind === "viewing" ? "Viewing request" : "Match request"}${l.listing ? ` for “${l.listing.title}”` : l.cityId ? ` in ${cityName.get(l.cityId) ?? l.cityId}` : ""} — waiting ${waited(h)}. A renter who waits a day books elsewhere.`,
      href: `/admin/leads?open=${l.id}`,
      cta: "Reply",
      who: { name: l.name, email: l.email, phone: l.phone },
      context: [l.budgetMax ? `up to ${l.currency} ${l.budgetMax}` : "", l.moveIn ? `from ${l.moveIn}` : ""].filter(Boolean).join(" · "),
      at: l.createdAt.toISOString(),
      draft: leadReplyDraft({
        id: l.id,
        kind: l.kind,
        name: l.name,
        email: l.email,
        listingTitle: l.listing?.title,
        cityName: l.cityId ? cityName.get(l.cityId) : null,
        moveIn: l.moveIn,
        appUrl: base,
      }),
    });
  }

  for (const c of due) {
    const { score } = scoreContact(c, t);
    const lateDays = Math.floor((t - (c.nextFollowUpAt?.getTime() ?? t)) / DAY);
    actions.push({
      id: `due-${c.id}`,
      category: "follow-up",
      priority: Math.min(95, 50 + Math.round(score / 3) + Math.min(15, lateDays * 3)),
      title: `Follow up with ${c.name || c.email}`,
      reason: `${c.kind} · ${c.stage} — follow-up ${lateDays > 0 ? `overdue by ${lateDays} day${lateDays === 1 ? "" : "s"}` : "due today"}.`,
      href: `/admin/crm/${c.id}`,
      cta: "Draft email",
      who: { name: c.name, email: c.email, phone: c.phone },
      context: c.company ?? undefined,
      at: c.nextFollowUpAt?.toISOString(),
      draft: followUpDraft({ id: c.id, name: c.name, email: c.email, kind: c.kind, stage: c.stage, appUrl: base }),
    });
  }

  for (const c of quiet) {
    const days = Math.floor((t - (c.lastContactedAt?.getTime() ?? t)) / DAY);
    actions.push({
      id: `quiet-${c.id}`,
      category: "going-quiet",
      priority: 40 + Math.round(scoreContact(c, t).score / 4),
      title: `${c.name || c.email} has gone quiet`,
      reason: `Contacted ${days} days ago and nothing since. One more note now beats a cold restart later.`,
      href: `/admin/crm/${c.id}`,
      cta: "Draft nudge",
      who: { name: c.name, email: c.email, phone: c.phone },
      at: c.lastContactedAt?.toISOString(),
      draft: followUpDraft({ id: c.id, name: c.name, email: c.email, kind: c.kind, stage: c.stage, appUrl: base }),
    });
  }

  for (const l of pending) {
    const h = hoursSince(l.createdAt, t);
    actions.push({
      id: `review-${l.id}`,
      category: "review",
      priority: Math.min(92, 55 + Math.round(h / 6)),
      title: `Review “${l.title}”`,
      reason: `${l.city.name} · by ${l.host.name} — waiting ${waited(h)}. Nothing reaches renters until it is approved.`,
      href: `/admin/listings?moderation=pending&view=board`,
      cta: "Review",
      at: l.createdAt.toISOString(),
    });
  }

  for (const u of trials) {
    const ends = u.trialEndsAt!;
    const hoursLeft = (ends.getTime() - t) / 3_600_000;
    const action: NextAction = {
      id: `trial-${u.id}`,
      category: "trial-ending",
      priority: u._count.listings ? 62 : 74,
      title: `${u.name}'s free week ends ${hoursLeft < 24 ? "today" : `in ${Math.ceil(hoursLeft / 24)} days`}`,
      reason: u._count.listings
        ? `${u._count.listings} listing${u._count.listings === 1 ? "" : "s"} live — make sure they keep them up.`
        : "Hasn't listed anything yet — the free week is wasted unless they do.",
      href: `/admin/accounts?q=${encodeURIComponent(u.email)}`,
      cta: "Draft email",
      who: { name: u.name, email: u.email },
      at: ends.toISOString(),
    };
    if (u.contact) {
      action.draft = trialEndingDraft({
        contactId: u.contact.id,
        name: u.name,
        email: u.email,
        listings: u._count.listings,
        ends: ends.toISOString().slice(0, 10),
        appUrl: base,
      });
    }
    actions.push(action);
  }

  const inviteContacts = idleInvites.length
    ? await safe(prisma.contact.findMany({ where: { email: { in: idleInvites.map((i) => i.email) } }, select: { id: true, email: true } }), [])
    : [];
  const contactByEmail = new Map(inviteContacts.map((c) => [c.email, c.id]));
  for (const i of idleInvites) {
    const days = Math.floor((t - (i.sentAt?.getTime() ?? t)) / DAY);
    const cid = contactByEmail.get(i.email);
    actions.push({
      id: `invite-${i.id}`,
      category: "invite-idle",
      priority: 48,
      title: `${i.name || i.email} hasn't used their invite`,
      reason: `${i.days}-day free trial sent ${days} days ago. A short personal nudge usually does it.`,
      href: `/admin/trials`,
      cta: cid ? "Draft nudge" : "Resend",
      who: { name: i.name || i.email, email: i.email },
      at: i.sentAt?.toISOString(),
      draft: cid
        ? {
            kind: "contact",
            id: cid,
            to: i.email,
            subject: `Your free ${i.days} days on RentLeaks are still waiting`,
            body: `Hi ${(i.name || "").split(" ")[0] || "there"},\n\nA quick nudge — your invitation to list on RentLeaks free for ${i.days} days is still open: ${base}/invite/${i.code}\n\nIt takes about ten minutes, and I'm happy to help you set it up.\n\nBest,\nRentLeaks`,
          }
        : undefined,
    });
  }

  for (const l of declined) {
    const cid = l.host.contact?.id;
    actions.push({
      id: `declined-${l.id}`,
      category: "declined",
      priority: 44,
      title: `“${l.title}” was declined and not fixed`,
      reason: `Declined ${Math.floor((t - (l.moderatedAt?.getTime() ?? t)) / DAY)} days ago: ${l.moderationNote || "no reason recorded"}.`,
      href: `/admin/listings?q=${encodeURIComponent(l.id)}`,
      cta: cid ? "Draft help" : "Open",
      who: { name: l.host.name, email: l.host.email },
      at: l.moderatedAt?.toISOString(),
      draft: cid
        ? declinedDraft({ contactId: cid, name: l.host.name, email: l.host.email, title: l.title, note: l.moderationNote || "a detail in the listing", appUrl: base })
        : undefined,
    });
  }

  for (const r of reports) {
    const h = hoursSince(r.createdAt, t);
    actions.push({
      id: `report-${r.id}`,
      category: "report",
      priority: Math.min(98, (r.reason === "scam" || r.reason === "discriminatory" ? 85 : 70) + Math.round(h / 12)),
      title: `Open report: ${r.reason}`,
      reason: `${r.note ? `“${r.note.slice(0, 90)}” — ` : ""}filed ${waited(h)} ago.`,
      href: `/admin/reports`,
      cta: "Resolve",
      at: r.createdAt.toISOString(),
    });
  }

  for (const p of posts) {
    if (canAutoPublish(p.channel)) continue;
    actions.push({
      id: `post-${p.id}`,
      category: "post-due",
      priority: 58,
      title: `Post to ${CHANNEL_LABEL[p.channel] ?? p.channel}`,
      reason: `Scheduled for ${p.scheduledAt?.toISOString().slice(0, 16).replace("T", " ")} UTC — copy it and mark it posted.`,
      href: `/admin/social?tab=queue`,
      cta: "Open",
      context: p.body.slice(0, 90),
      at: p.scheduledAt?.toISOString(),
    });
  }

  if (bigHosts.length) {
    const hosts = await safe(
      prisma.user.findMany({
        where: { id: { in: bigHosts.map((h) => h.hostId) }, role: { not: "admin" } },
        select: { id: true, name: true, email: true, contact: { select: { id: true } } },
      }),
      [],
    );
    for (const h of hosts) {
      const live = bigHosts.find((b) => b.hostId === h.id)?._count._all ?? 0;
      actions.push({
        id: `upsell-${h.id}`,
        category: "upsell",
        priority: 40 + Math.min(30, live * 2),
        title: `Offer sponsorship to ${h.name}`,
        reason: `${live} live homes, none sponsored. Sponsored listings lead their city's results.`,
        href: `/admin/listings?host=${h.id}`,
        cta: h.contact ? "Draft offer" : "Open",
        who: { name: h.name, email: h.email },
        draft: h.contact ? upsellDraft({ contactId: h.contact.id, name: h.name, email: h.email, live, appUrl: base }) : undefined,
      });
    }
  }

  for (const c of qualified) {
    actions.push({
      id: `qualified-${c.id}`,
      category: "qualified",
      priority: scoreContact(c, t).score,
      title: `Move ${c.name || c.email} forward`,
      reason: `Qualified ${c.kind}${c.company ? ` at ${c.company}` : ""} — ${c.lastContactedAt ? "no touch in a week" : "not contacted yet"}.`,
      href: `/admin/crm/${c.id}`,
      cta: "Draft email",
      who: { name: c.name, email: c.email, phone: c.phone },
      draft: followUpDraft({ id: c.id, name: c.name, email: c.email, kind: c.kind, stage: c.stage, appUrl: base }),
    });
  }

  return rankActions(actions);
}
