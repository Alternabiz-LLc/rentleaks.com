/**
 * The desk advisor: a handful of plain-words recommendations that look across
 * modules — the moves that change the business this week, not a to-do list
 * (Next best actions handles individual records). Pure `advise` for the tests;
 * `loadAdvice` gathers the numbers, only for the pages the viewer can open.
 */
import { canAccess, isFounder, type AccessCarrier, type AccessKey } from "@/lib/access";
import { adSpendGap, booksToday, unsyncedPayments } from "@/lib/books/data";
import { invoiceState } from "@/lib/books/core";
import { prisma } from "@/lib/prisma";
import { getSettings, SETTING_KEYS } from "@/lib/settings";
import { mailStatus } from "@/lib/v1/mail";
import { enterpriseFacts } from "@/lib/enterprise/data";
import { loadDemand } from "./demand";
import { loadScorecards } from "./hosts";
import { median } from "./sla";

const DAY = 86_400_000;

export type Advice = { id: string; key: AccessKey; impact: number; tone: "bad" | "warn" | "info" | "good"; title: string; body: string; href: string; cta: string };

export type AdvisorFacts = Partial<{
  emailReady: boolean;
  autopilot: boolean;
  freshness: boolean;
  playbooksOn: number;
  medianReplyMins: number | null;
  shortlistsSent: number;
  shortlistsOpened: number;
  topGap: { label: string; gap: number } | null;
  hostsCD: number;
  hostsANoSponsor: number;
  overdueInvoices: number;
  unsyncedPayments: number;
  adGapCents: number;
  expensesThisMonth: number;
  lostTopReason: { reason: string; count: number } | null;
  staleListings: number;
  briefOff: boolean;
  trialsEnding: number;
  enterpriseWaiting: number;
  brokerMissing: boolean;
  statementsDue: number;
  statementMonth: string;
  engagementStepsLate: number;
}>;

export function advise(f: AdvisorFacts): Advice[] {
  const out: Advice[] = [];
  if (f.emailReady === false) {
    out.push({ id: "email", key: "system", impact: 100, tone: "bad", title: "Email isn't connected", body: "Instant replies, shortlists, invoices and reminders are only logged until email is set up.", href: "/admin/system", cta: "Connect email" });
  }
  if (f.enterpriseWaiting) {
    out.push({
      id: "enterprise",
      key: "enterprise",
      impact: 92,
      tone: "bad",
      title: `${f.enterpriseWaiting} enterprise request${f.enterpriseWaiting === 1 ? "" : "s"} waiting over a day`,
      body: "Building owners compare firms fast — a same-day call wins the walk-through.",
      href: "/admin/enterprise?status=new",
      cta: "Reply",
    });
  }
  if (f.brokerMissing) {
    out.push({ id: "licence", key: "enterprise", impact: 80, tone: "warn", title: "Licence details missing on the enterprise pages", body: "Broker ads must name the licensed broker and show an address or phone. Add them before you promote the pages.", href: "/admin/enterprise?tab=catalogue", cta: "Add" });
  }
  if (f.statementsDue) {
    out.push({ id: "statements", key: "enterprise", impact: 62, tone: "warn", title: `${f.statementsDue} owner statement${f.statementsDue === 1 ? "" : "s"} due for ${f.statementMonth ?? "last month"}`, body: "Out-of-state owners judge you by the statement. Send it by the 10th.", href: "/admin/enterprise?tab=portfolio", cta: "Send" });
  }
  if (f.engagementStepsLate) {
    out.push({ id: "steps", key: "enterprise", impact: 48, tone: "info", title: `${f.engagementStepsLate} engagement step${f.engagementStepsLate === 1 ? "" : "s"} past due`, body: "Tick them off or move the date — the client sees the pace.", href: "/admin/enterprise?tab=engagements", cta: "Review" });
  }
  if (f.overdueInvoices) {
    out.push({ id: "overdue", key: "books", impact: 90, tone: "bad", title: `${f.overdueInvoices} invoice${f.overdueInvoices === 1 ? "" : "s"} overdue`, body: "Money you've earned and not collected.", href: "/admin/books?tab=invoices&state=overdue", cta: "Chase" });
  }
  if (f.medianReplyMins !== null && f.medianReplyMins !== undefined && f.medianReplyMins > 60) {
    out.push({
      id: "speed",
      key: "leads",
      impact: 85,
      tone: "warn",
      title: `Renters wait ${f.medianReplyMins >= 120 ? `${Math.round(f.medianReplyMins / 60)} hours` : `${f.medianReplyMins} minutes`} for a first reply`,
      body: f.playbooksOn ? "Send shortlists from Match & send the moment a request lands." : "Turn on the two-hour alarm playbook and answer from Match & send.",
      href: f.playbooksOn ? "/admin/match" : "/admin/playbooks",
      cta: f.playbooksOn ? "Match & send" : "Add the alarm",
    });
  }
  if (f.autopilot === false) {
    out.push({ id: "autopilot", key: "automation", impact: 70, tone: "warn", title: "Instant reply is off", body: "Renters get a plain confirmation instead of three matching homes.", href: "/admin/playbooks#settings", cta: "Turn on" });
  }
  if (f.topGap && f.topGap.gap >= 2) {
    out.push({ id: "gap", key: "markets", impact: 65, tone: "info", title: `${f.topGap.gap} renters want ${f.topGap.label} you can't offer`, body: "Recruit hosts for exactly that gap — outreach, a free week or a host ad.", href: "/admin/demand", cta: "Recruit" });
  }
  if (f.unsyncedPayments || (f.adGapCents ?? 0) > 0) {
    out.push({ id: "books", key: "books", impact: 60, tone: "warn", title: "The books are behind", body: `${f.unsyncedPayments ? `${f.unsyncedPayments} Stripe payment${f.unsyncedPayments === 1 ? "" : "s"}` : ""}${f.unsyncedPayments && f.adGapCents ? " and " : ""}${f.adGapCents ? `$${Math.round((f.adGapCents ?? 0) / 100).toLocaleString("en-US")} of ad spend` : ""} not recorded.`, href: "/admin/books#sync", cta: "Sync" });
  }
  if (f.expensesThisMonth === 0) {
    out.push({ id: "expenses", key: "books", impact: 40, tone: "info", title: "No expenses recorded this month", body: "Add subscriptions once as monthly repeats — the books copy them every month.", href: "/admin/books?tab=ledger&add=expense", cta: "Record one" });
  }
  if (f.hostsCD) {
    out.push({ id: "hosts", key: "hosts", impact: 55, tone: "info", title: `${f.hostsCD} host${f.hostsCD === 1 ? "" : "s"} graded C or D`, body: "Slow replies and stale homes cost bookings. One nudge each, aimed at the weakest point.", href: "/admin/hosts?grade=D", cta: "Nudge" });
  }
  if (f.hostsANoSponsor) {
    out.push({ id: "sponsor", key: "hosts", impact: 50, tone: "good", title: `${f.hostsANoSponsor} top host${f.hostsANoSponsor === 1 ? "" : "s"} could sponsor`, body: "Grade A hosts without a sponsored spot are your easiest upsell.", href: "/admin/hosts?grade=A", cta: "Offer" });
  }
  if (f.staleListings && f.staleListings >= 3 && f.freshness === false) {
    out.push({ id: "fresh", key: "listings", impact: 45, tone: "warn", title: `${f.staleListings} live homes not confirmed in a month`, body: "Stale listings are the top renter complaint. Switch the weekly freshness check back on.", href: "/admin/playbooks#settings", cta: "Turn on" });
  }
  if ((f.shortlistsSent ?? 0) >= 5 && (f.shortlistsOpened ?? 0) / (f.shortlistsSent ?? 1) < 0.3) {
    out.push({ id: "opens", key: "leads", impact: 35, tone: "info", title: "Few renters open their shortlists", body: `${f.shortlistsOpened} of ${f.shortlistsSent} opened. Try a subject with the city and the price, and send within the hour.`, href: "/admin/match", cta: "Open Match" });
  }
  if (f.lostTopReason && f.lostTopReason.count >= 2) {
    out.push({ id: "lost", key: "bookings", impact: 30, tone: "info", title: `Most lost bookings: “${f.lostTopReason.reason}”`, body: `${f.lostTopReason.count} times in 90 days — worth a fix upstream.`, href: "/admin/bookings?view=board", cta: "See board" });
  }
  if (f.trialsEnding) {
    out.push({ id: "trials", key: "trials", impact: 50, tone: "warn", title: `${f.trialsEnding} free week${f.trialsEnding === 1 ? "" : "s"} end in 3 days`, body: "A personal note converts better than the automatic reminder.", href: "/admin/trials", cta: "Write" });
  }
  if ((f.playbooksOn ?? 0) === 0) {
    out.push({ id: "playbooks", key: "automation", impact: 25, tone: "info", title: "No playbooks running", body: "Six ready recipes: shortlist check-in, free-week last call, renewal heads-up…", href: "/admin/playbooks", cta: "Pick one" });
  }
  if (f.briefOff) {
    out.push({ id: "brief", key: "overview", impact: 10, tone: "info", title: "Get a morning brief", body: "One email with the day's numbers and your top five moves.", href: "/admin/security#brief", cta: "Set time" });
  }
  return out.sort((a, b) => b.impact - a.impact);
}

const safe = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback);

export async function loadAdvice(me: AccessCarrier & { id: string; briefHour?: number | null }, now = new Date(), limit = 6) {
  const can = (k: AccessKey) => canAccess(me, k);
  const t = now.getTime();
  const today = booksToday(now);
  const monthStart = `${today.slice(0, 7)}-01`;
  const settings = await safe(getSettings([SETTING_KEYS.autopilot, SETTING_KEYS.freshness]), {} as Record<string, string>);
  const [answered, playbooksOn, shortlists, demand, cards, invoices, unsynced, adGap, expenses, lost, stale, trialsEnding, ent] = await Promise.all([
    can("leads") ? safe(prisma.lead.findMany({ where: { createdAt: { gte: new Date(t - 30 * DAY) }, contactedAt: { not: null } }, select: { createdAt: true, contactedAt: true }, take: 500 }), []) : [],
    can("automation") || can("leads") ? safe(prisma.playbook.count({ where: { enabled: true } }), 0) : 0,
    can("leads") ? safe(prisma.lead.findMany({ where: { matchesSentAt: { gte: new Date(t - 30 * DAY) } }, select: { shortlistOpenedAt: true }, take: 1000 }), []) : [],
    can("markets") ? safe(loadDemand(90), null) : null,
    can("hosts") ? safe(loadScorecards(t), { cards: [], unavailable: true }) : { cards: [], unavailable: true },
    can("books") ? safe(prisma.invoice.findMany({ where: { status: "sent" }, select: { status: true, dueDate: true } }), []) : [],
    can("books") ? safe(unsyncedPayments(), 0) : 0,
    can("books") ? safe(adSpendGap(), 0) : 0,
    can("books") ? safe(prisma.ledgerEntry.count({ where: { kind: "expense", date: { gte: monthStart }, voidedAt: null } }), 0) : -1,
    can("bookings") ? safe(prisma.booking.findMany({ where: { stage: "lost", updatedAt: { gte: new Date(t - 90 * DAY) } }, select: { lostReason: true } }), []) : [],
    can("listings") ? safe(prisma.listing.count({ where: { status: "active", moderation: "approved", OR: [{ confirmedAt: null, postedAt: { lt: new Date(t - 30 * DAY) } }, { confirmedAt: { lt: new Date(t - 30 * DAY) } }] } }), 0) : 0,
    can("trials") ? safe(prisma.user.count({ where: { trialEndsAt: { gt: now, lte: new Date(t + 3 * DAY) } } }), 0) : 0,
    can("enterprise") ? safe(enterpriseFacts(now), null) : null,
  ]);
  const replyMins = median(answered.map((l) => (l.contactedAt!.getTime() - l.createdAt.getTime()) / 60_000).filter((m) => m >= 0));
  const cities = demand ? new Map((await safe(prisma.city.findMany({ select: { id: true, name: true } }), [])).map((c) => [c.id, c.name])) : new Map<string, string>();
  const gap = demand?.cells.find((c) => c.gap > 0);
  const reasons = new Map<string, number>();
  for (const b of lost) if (b.lostReason && b.lostReason !== "Moved to lost from the board") reasons.set(b.lostReason, (reasons.get(b.lostReason) ?? 0) + 1);
  const topReason = [...reasons.entries()].sort((a, b) => b[1] - a[1])[0];
  const facts: AdvisorFacts = {
    emailReady: can("system") ? (() => {
      const m = mailStatus();
      return m.resend || Boolean(m.smtp);
    })() : undefined,
    autopilot: can("automation") ? settings[SETTING_KEYS.autopilot] !== "off" : undefined,
    freshness: can("listings") ? settings[SETTING_KEYS.freshness] !== "off" : undefined,
    playbooksOn: can("automation") ? playbooksOn : 1,
    medianReplyMins: replyMins === null ? null : Math.round(replyMins),
    shortlistsSent: shortlists.length,
    shortlistsOpened: shortlists.filter((s) => s.shortlistOpenedAt).length,
    topGap: gap ? { label: `${gap.type === "any" ? "homes" : gap.type} in ${cities.get(gap.cityId) ?? gap.cityId}`, gap: gap.gap } : null,
    hostsCD: cards.cards.filter((c) => c.grade === "C" || c.grade === "D").length,
    hostsANoSponsor: cards.cards.filter((c) => c.grade === "A" && c.live > 0 && c.sponsored === 0).length,
    overdueInvoices: invoices.filter((i) => invoiceState(i, today) === "overdue").length,
    unsyncedPayments: unsynced,
    adGapCents: adGap,
    expensesThisMonth: expenses < 0 ? undefined : expenses,
    lostTopReason: topReason ? { reason: topReason[0], count: topReason[1] } : null,
    staleListings: stale,
    briefOff: me.briefHour === null || me.briefHour === undefined,
    trialsEnding,
    enterpriseWaiting: ent?.requestsWaiting,
    brokerMissing: ent && isFounder(me) ? ent.brokerMissing : undefined,
    statementsDue: ent?.statementsDue,
    statementMonth: ent?.statementMonth,
    engagementStepsLate: ent?.overdueTasks,
  };
  return advise(facts)
    .filter((a) => can(a.key) || a.key === "overview")
    .slice(0, limit);
}
