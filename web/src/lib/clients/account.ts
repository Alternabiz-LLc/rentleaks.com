/**
 * Client accounts: one 360° view per host or renter. The pure part (health,
 * suggestions, timeline ordering) is exported for the tests; `loadClient`
 * gathers everything the desk knows about one account.
 */
import { prisma } from "@/lib/prisma";
import { invoiceState, type InvoiceState } from "@/lib/books/core";
import { booksToday } from "@/lib/books/data";
import { loadScorecards, type Scorecard } from "@/lib/ops/hosts";

const DAY = 86_400_000;
const PAID = ["paid", "succeeded", "complete"];

export type Suggestion = { id: string; tone: "bad" | "warn" | "info" | "good"; title: string; body: string; href?: string; cta?: string; key?: string };

export type ClientFacts = {
  role: string;
  suspended: boolean;
  verified: boolean;
  daysSinceJoin: number;
  daysSinceSignIn: number | null;
  trialDaysLeft: number | null;
  listings: number;
  live: number;
  pending: number;
  declined: number;
  grade: string | null;
  weakest: string | null;
  overdueInvoices: number;
  openLeads: number;
  unansweredLeads: number;
  bookingsActive: number;
  renewalSoon: boolean;
  flaggedMessages: number;
  openReports: number;
  lifetimeCents: number;
  hasContact: boolean;
  lastTouchDays: number | null;
};

/** 0–100: how healthy the relationship looks. Transparent parts, no hidden weights. */
export function clientHealth(f: ClientFacts) {
  const parts: Array<{ label: string; points: number }> = [];
  const add = (label: string, points: number) => points && parts.push({ label, points });
  if (f.suspended) return { score: 0, parts: [{ label: "Suspended", points: -100 }] };
  add("Verified", f.verified ? 15 : 0);
  if (f.daysSinceSignIn !== null) add(f.daysSinceSignIn <= 14 ? "Active in the last 2 weeks" : f.daysSinceSignIn <= 60 ? "Active in the last 2 months" : "Quiet for 2+ months", f.daysSinceSignIn <= 14 ? 20 : f.daysSinceSignIn <= 60 ? 10 : -5);
  if (f.role === "host") {
    add("Has live listings", f.live ? 20 : f.listings ? 5 : 0);
    if (f.grade) add(`Host grade ${f.grade}`, { A: 25, B: 15, C: 5, D: -10 }[f.grade] ?? 0);
    add("Paying customer", f.lifetimeCents > 0 ? 15 : 0);
  } else {
    add("Asked for homes", f.openLeads || f.bookingsActive ? 20 : 0);
    add("Booked with us", f.bookingsActive ? 25 : 0);
  }
  add("Overdue invoice", f.overdueInvoices ? -20 : 0);
  add("Flagged messages", f.flaggedMessages ? -25 : 0);
  add("Open reports", f.openReports ? -20 : 0);
  add("In the CRM", f.hasContact ? 5 : 0);
  const score = Math.max(0, Math.min(100, 30 + parts.reduce((n, p) => n + p.points, 0)));
  return { score, parts };
}

export function clientSuggestions(f: ClientFacts, id: string, email: string): Suggestion[] {
  const out: Suggestion[] = [];
  const q = encodeURIComponent(email);
  if (f.openReports || f.flaggedMessages) {
    out.push({ id: "trust", tone: "bad", title: "Check this account on the trust radar", body: `${f.openReports ? `${f.openReports} open report${f.openReports === 1 ? "" : "s"}` : ""}${f.openReports && f.flaggedMessages ? " and " : ""}${f.flaggedMessages ? `${f.flaggedMessages} flagged message${f.flaggedMessages === 1 ? "" : "s"}` : ""}.`, href: f.openReports ? "/admin/reports" : "/admin/trust?kind=messages", cta: "Review", key: "trust" });
  }
  if (f.overdueInvoices) {
    out.push({ id: "invoice", tone: "bad", title: `${f.overdueInvoices} overdue invoice${f.overdueInvoices === 1 ? "" : "s"}`, body: "Send a reminder or record the payment.", href: "/admin/books?tab=invoices&state=overdue", cta: "Open invoices", key: "books" });
  }
  if (f.unansweredLeads) {
    out.push({ id: "lead", tone: "warn", title: "Waiting for a reply", body: `${f.unansweredLeads} request${f.unansweredLeads === 1 ? "" : "s"} with no personal answer yet.`, href: `/admin/leads?q=${q}`, cta: "Answer", key: "leads" });
  }
  if (f.role === "host") {
    if (f.trialDaysLeft !== null && f.trialDaysLeft >= 0 && f.trialDaysLeft <= 3) {
      out.push({ id: "trial", tone: "warn", title: `Free week ends in ${f.trialDaysLeft} day${f.trialDaysLeft === 1 ? "" : "s"}`, body: "A personal note now converts better than the automatic one.", href: `/admin/crm?q=${q}`, cta: "Write", key: "crm" });
    }
    if (!f.listings && f.daysSinceJoin >= 2) {
      out.push({ id: "nolisting", tone: "warn", title: "Signed up but never listed", body: "Offer help with photos and the all-in price — or a free week.", href: `/admin/trials#invite`, cta: "Invite", key: "trials" });
    }
    if (f.declined && !f.live) {
      out.push({ id: "declined", tone: "warn", title: "Their listing was declined", body: "Tell them the one thing to fix; most come back within a day.", href: `/admin/listings?q=${q}&moderation=declined`, cta: "See why", key: "listings" });
    }
    if (f.pending) {
      out.push({ id: "pending", tone: "info", title: `${f.pending} listing${f.pending === 1 ? "" : "s"} waiting for review`, body: "Fast reviews keep hosts listing.", href: `/admin/listings?q=${q}&moderation=pending`, cta: "Review", key: "listings" });
    }
    if (f.grade === "C" || f.grade === "D") {
      out.push({ id: "nudge", tone: "info", title: `Host grade ${f.grade}`, body: `Weakest point: ${f.weakest ?? "several"}. One nudge usually moves it.`, href: `/admin/hosts?open=${id}`, cta: "Nudge", key: "hosts" });
    }
    if (f.grade === "A" && f.live) {
      out.push({ id: "sponsor", tone: "good", title: "Top host — offer a sponsored spot", body: "Grade A hosts convert sponsored placements best.", href: `/admin/hosts?open=${id}`, cta: "Offer", key: "hosts" });
    }
  } else {
    if (f.renewalSoon) {
      out.push({ id: "renewal", tone: "info", title: "Stay ends soon", body: "Offer a renewal before they look elsewhere.", href: "/admin/bookings?view=renewals", cta: "Renewals", key: "bookings" });
    }
    if (f.openLeads && !f.bookingsActive) {
      out.push({ id: "match", tone: "info", title: "Send homes that fit", body: "A shortlist with three homes is the fastest way to a viewing.", href: "/admin/match", cta: "Match", key: "leads" });
    }
  }
  if (!f.verified && (f.live || f.bookingsActive)) {
    out.push({ id: "verify", tone: "info", title: "Not verified yet", body: "Verified accounts get more replies and fewer reports." });
  }
  if (!f.hasContact) {
    out.push({ id: "crm", tone: "info", title: "Not in the CRM", body: "Add them to track calls, follow-ups and emails in one place.", cta: "Add to CRM" });
  } else if (f.lastTouchDays !== null && f.lastTouchDays > 45 && (f.live || f.bookingsActive)) {
    out.push({ id: "touch", tone: "info", title: `No contact in ${f.lastTouchDays} days`, body: "A two-line check-in keeps good customers.", key: "crm" });
  }
  const order = { bad: 0, warn: 1, info: 2, good: 3 };
  return out.sort((a, b) => order[a.tone] - order[b.tone]);
}

export type TimelineEvent = { at: Date; kind: string; title: string; detail?: string; href?: string };

export function mergeTimeline(groups: TimelineEvent[][], limit = 80) {
  return groups
    .flat()
    .filter((e) => e.at instanceof Date && !Number.isNaN(e.at.getTime()))
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, limit);
}

export async function loadClient(id: string, now = new Date()) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { identity: { select: { status: true, verifiedAt: true } }, contact: { select: { id: true, stage: true, kind: true, lastContactedAt: true, nextFollowUpAt: true, tags: true } } },
  });
  if (!user) return null;
  const email = user.email.toLowerCase();
  const today = booksToday(now);
  const [listings, payments, invoices, ledger, leadsAsRenter, bookingsAsRenter, notes, audit, activities, flagged, reports, conversations, savedSearches, lastSession] = await Promise.all([
    prisma.listing.findMany({
      where: { hostId: id },
      select: { id: true, title: true, status: true, moderation: true, moderationNote: true, sponsored: true, allIn: true, currency: true, cityId: true, housingType: true, postedAt: true, confirmedAt: true, image: true, city: { select: { name: true } } },
      orderBy: { postedAt: "desc" },
      take: 100,
    }),
    prisma.payment.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 100, include: { listing: { select: { title: true } } } }),
    prisma.invoice.findMany({ where: { OR: [{ userId: id }, { billToEmail: email }] }, orderBy: { issueDate: "desc" }, take: 100 }),
    prisma.ledgerEntry.findMany({ where: { userId: id }, orderBy: { date: "desc" }, take: 200 }),
    prisma.lead.findMany({ where: { email: { equals: email, mode: "insensitive" } }, orderBy: { createdAt: "desc" }, take: 50, include: { listing: { select: { title: true } } } }),
    prisma.booking.findMany({ where: { renterEmail: email }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.clientNote.findMany({ where: { userId: id }, orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take: 50 }),
    prisma.adminAction.findMany({ where: { targetId: id }, orderBy: { createdAt: "desc" }, take: 40 }),
    user.contact ? prisma.contactActivity.findMany({ where: { contactId: user.contact.id }, orderBy: { createdAt: "desc" }, take: 40 }) : Promise.resolve([]),
    prisma.message.count({ where: { senderId: id, NOT: { flags: "[]" } } }),
    prisma.report.findMany({ where: { OR: [{ subjectUserId: id }, { listing: { hostId: id } }] }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, reason: true, status: true, createdAt: true, note: true } }),
    prisma.conversation.findMany({
      where: { OR: [{ renterId: id }, { hostId: id }] },
      orderBy: { lastMessageAt: "desc" },
      take: 20,
      select: { id: true, lastMessageAt: true, renterId: true, hostId: true, listing: { select: { title: true } }, _count: { select: { messages: true } } },
    }),
    prisma.savedSearch.count({ where: { userId: id } }),
    prisma.session.findFirst({ where: { userId: id }, orderBy: { createdAt: "desc" }, select: { createdAt: true, userAgent: true } }),
  ]);
  const listingIds = listings.map((l) => l.id);
  const [leadsOnListings, bookingsOnListings, scorecard] = await Promise.all([
    listingIds.length ? prisma.lead.findMany({ where: { listingId: { in: listingIds } }, orderBy: { createdAt: "desc" }, take: 50, include: { listing: { select: { title: true } } } }) : Promise.resolve([]),
    listingIds.length ? prisma.booking.findMany({ where: { listingId: { in: listingIds } }, orderBy: { createdAt: "desc" }, take: 50 }) : Promise.resolve([]),
    user.role === "host" ? loadScorecards(now.getTime(), [id]).then((r) => r.cards[0] ?? null).catch(() => null) : Promise.resolve(null as Scorecard | null),
  ]);

  const invoiceStates = invoices.map((i) => ({ ...i, state: invoiceState(i, today) as InvoiceState }));
  const paidPayments = payments.filter((p) => PAID.includes(p.status));
  const lifetimeCents = paidPayments.reduce((n, p) => n + p.amount, 0) + invoiceStates.filter((i) => i.state === "paid").reduce((n, i) => n + i.totalCents, 0);
  const openBalance = invoiceStates.filter((i) => ["sent", "due_soon", "overdue"].includes(i.state)).reduce((n, i) => n + i.totalCents, 0);
  const leads = user.role === "host" ? leadsOnListings : leadsAsRenter;
  const bookings = user.role === "host" ? bookingsOnListings : bookingsAsRenter;
  const activeBookings = bookings.filter((b) => ["viewing", "application", "approved", "signed", "moved_in"].includes(b.stage));
  const renewalSoon = bookings.some((b) => (b.stage === "signed" || b.stage === "moved_in") && b.moveOut && Date.parse(`${b.moveOut}T00:00:00Z`) - now.getTime() < 60 * DAY && Date.parse(`${b.moveOut}T00:00:00Z`) > now.getTime());
  const signIn = user.lastSignInAt ?? lastSession?.createdAt ?? null;
  const lastTouch = [user.contact?.lastContactedAt, ...activities.map((a) => a.createdAt)].filter((d): d is Date => Boolean(d)).sort((a, b) => b.getTime() - a.getTime())[0];

  const facts: ClientFacts = {
    role: user.role,
    suspended: Boolean(user.suspendedAt),
    verified: user.identity?.status === "verified",
    daysSinceJoin: Math.floor((now.getTime() - user.createdAt.getTime()) / DAY),
    daysSinceSignIn: signIn ? Math.floor((now.getTime() - signIn.getTime()) / DAY) : null,
    trialDaysLeft: user.trialEndsAt ? Math.ceil((user.trialEndsAt.getTime() - now.getTime()) / DAY) : null,
    listings: listings.length,
    live: listings.filter((l) => l.moderation === "approved" && l.status !== "paused").length,
    pending: listings.filter((l) => l.moderation === "pending").length,
    declined: listings.filter((l) => l.moderation === "declined").length,
    grade: scorecard?.grade ?? null,
    weakest: scorecard?.weakest ?? null,
    overdueInvoices: invoiceStates.filter((i) => i.state === "overdue").length,
    openLeads: leads.filter((l) => l.status === "new" || l.status === "contacted").length,
    unansweredLeads: leads.filter((l) => l.status === "new").length,
    bookingsActive: activeBookings.length,
    renewalSoon,
    flaggedMessages: flagged,
    openReports: reports.filter((r) => r.status === "open").length,
    lifetimeCents,
    hasContact: Boolean(user.contact),
    lastTouchDays: lastTouch ? Math.floor((now.getTime() - lastTouch.getTime()) / DAY) : null,
  };

  const timeline = mergeTimeline([
    [{ at: user.createdAt, kind: "signup", title: `Joined as ${user.role}` }],
    signIn ? [{ at: signIn, kind: "signin", title: "Last signed in" }] : [],
    listings.map((l) => ({ at: l.postedAt, kind: "listing", title: `Listed “${l.title}”`, detail: `${l.moderation} · ${l.status}`, href: `/admin/listings?q=${l.id}` })),
    payments.map((p) => ({ at: p.createdAt, kind: "payment", title: `Payment ${p.status}: ${(p.amount / 100).toFixed(2)} ${p.currency.toUpperCase()}`, detail: `${p.kind}${p.listing ? ` · ${p.listing.title}` : ""}` })),
    invoices.flatMap((i) => [
      { at: i.createdAt, kind: "invoice", title: `Invoice ${i.number} created`, detail: `${(i.totalCents / 100).toFixed(2)} ${i.currency}`, href: `/admin/books?tab=invoices&open=${i.id}` },
      ...(i.paidAt ? [{ at: i.paidAt, kind: "paid", title: `Invoice ${i.number} paid`, href: `/admin/books?tab=invoices&open=${i.id}` }] : []),
    ]),
    leads.map((l) => ({ at: l.createdAt, kind: "lead", title: `${user.role === "host" ? `${l.name} asked about` : "Asked about"} ${l.listing?.title ?? "a home"}`, detail: `${l.kind} · ${l.status}`, href: `/admin/leads?open=${l.id}` })),
    bookings.map((b) => ({ at: b.createdAt, kind: "booking", title: `Booking · ${b.renterName}`, detail: b.stage, href: `/admin/bookings?open=${b.id}` })),
    reports.map((r) => ({ at: r.createdAt, kind: "report", title: `Report: ${r.reason}`, detail: r.status, href: "/admin/reports" })),
    activities.map((a) => ({ at: a.createdAt, kind: a.kind, title: a.subject || a.kind, detail: a.body.slice(0, 140) })),
    audit.map((a) => ({ at: a.createdAt, kind: "desk", title: a.action.replace(/\./g, " · ") })),
    notes.map((n) => ({ at: n.createdAt, kind: "note", title: "Note", detail: n.body.slice(0, 140) })),
  ]);

  return {
    user,
    today,
    facts,
    health: clientHealth(facts),
    suggestions: clientSuggestions(facts, id, email),
    listings,
    payments,
    invoices: invoiceStates,
    ledger,
    leads,
    bookings,
    notes,
    reports,
    conversations,
    savedSearches,
    scorecard,
    lifetimeCents,
    openBalance,
    timeline,
    lastSession,
  };
}
