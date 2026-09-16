/**
 * Priority scores for the desk — rules, not a model.
 *
 * Every point is explained in `reasons`, so the A–D chip on a card can always
 * answer "why is this one above that one?". Scores rank what to work first;
 * they say nothing about whether a person is a good tenant and must never
 * read anything about who someone is (fair housing) — only what they asked
 * for, how complete the request is and how long it has waited.
 *
 * No server imports: the same rules run in tests.
 */

export type Scored = { score: number; reasons: string[] };

const DAY = 86_400_000;
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export type LeadForScore = {
  kind: string;
  status: string;
  phone: string | null;
  listingId: string | null;
  budgetMax: number | null;
  moveIn: string | null;
  moveOut: string | null;
  stayMonths: number | null;
  viewingSlots: string;
  message: string;
  createdAt: Date;
};

export function scoreLead(l: LeadForScore, now = Date.now()): Scored {
  const reasons: string[] = [];
  if (l.status === "spam") return { score: 0, reasons: ["Marked as spam"] };
  if (l.status === "closed") return { score: 5, reasons: ["Closed"] };

  let s = l.kind === "stay" ? 40 : l.kind === "viewing" ? 34 : 22;
  reasons.push(l.kind === "stay" ? "Asked to book a stay (+40)" : l.kind === "viewing" ? "Asked for a viewing (+34)" : "Asked to be matched (+22)");

  if (l.listingId) {
    s += 8;
    reasons.push("Named a specific home (+8)");
  }
  if (l.phone) {
    s += 8;
    reasons.push("Left a phone number (+8)");
  }
  if (l.budgetMax) {
    s += 5;
    reasons.push("Gave a budget (+5)");
  }
  if (l.moveIn) {
    const days = (Date.parse(`${l.moveIn}T12:00:00Z`) - now) / DAY;
    if (Number.isFinite(days) && days <= 45 && days > -7) {
      s += 10;
      reasons.push("Moves within 45 days (+10)");
    } else if (Number.isFinite(days) && days <= 90 && days > -7) {
      s += 5;
      reasons.push("Moves within 90 days (+5)");
    }
  }
  if (l.moveOut || l.stayMonths) {
    s += 4;
    reasons.push("Knows how long (+4)");
  }
  let slots = 0;
  try {
    const v = JSON.parse(l.viewingSlots || "[]") as unknown;
    slots = Array.isArray(v) ? v.length : 0;
  } catch {
    slots = 0;
  }
  if (slots) {
    s += 4;
    reasons.push("Offered viewing times (+4)");
  }
  if (l.message.trim().length > 20) {
    s += 3;
    reasons.push("Wrote a message (+3)");
  }

  const ageH = (now - l.createdAt.getTime()) / 3_600_000;
  if (ageH < 24) {
    s += 12;
    reasons.push("Arrived in the last day (+12)");
  } else if (ageH < 72) {
    s += 8;
    reasons.push("Arrived in the last 3 days (+8)");
  } else if (ageH < 24 * 7) {
    s += 4;
    reasons.push("Arrived this week (+4)");
  } else if (l.status === "new") {
    s -= 10;
    reasons.push("Unanswered for over a week (−10)");
  }
  if (l.status === "booked") {
    s = Math.max(s, 85);
    reasons.push("Booked");
  }
  return { score: clamp(s), reasons };
}

export type ContactForScore = {
  kind: string;
  stage: string;
  phone: string | null;
  company: string | null;
  marketingConsent: boolean;
  unsubscribedAt: Date | null;
  lastContactedAt: Date | null;
  nextFollowUpAt: Date | null;
  createdAt: Date;
  listings?: number;
};

const KIND_POINTS: Record<string, number> = { operator: 30, host: 26, partner: 18, renter: 14, press: 10, other: 8 };
const STAGE_POINTS: Record<string, number> = { qualified: 25, customer: 15, contacted: 12, new: 8, lost: -30 };

export function scoreContact(c: ContactForScore, now = Date.now()): Scored {
  const reasons: string[] = [];
  let s = KIND_POINTS[c.kind] ?? 8;
  reasons.push(`${c.kind} (+${KIND_POINTS[c.kind] ?? 8})`);
  const st = STAGE_POINTS[c.stage] ?? 0;
  s += st;
  reasons.push(`Stage ${c.stage} (${st >= 0 ? "+" : "−"}${Math.abs(st)})`);
  if (c.phone) {
    s += 6;
    reasons.push("Has a phone (+6)");
  }
  if (c.company) {
    s += 6;
    reasons.push("Has a company (+6)");
  }
  if (c.listings) {
    s += 10;
    reasons.push(`${c.listings} listing${c.listings === 1 ? "" : "s"} on RentLeaks (+10)`);
  }
  if (c.nextFollowUpAt && c.nextFollowUpAt.getTime() <= now) {
    const late = (now - c.nextFollowUpAt.getTime()) / DAY;
    s += late > 3 ? 16 : 12;
    reasons.push(late > 3 ? "Follow-up overdue by more than 3 days (+16)" : "Follow-up due (+12)");
  }
  if (!c.lastContactedAt && c.stage === "new" && now - c.createdAt.getTime() < 14 * DAY) {
    s += 10;
    reasons.push("New and never contacted (+10)");
  }
  if (c.lastContactedAt && c.stage === "contacted" && now - c.lastContactedAt.getTime() > 21 * DAY) {
    s += 8;
    reasons.push("Going quiet — 3 weeks since the last touch (+8)");
  }
  if (c.marketingConsent && !c.unsubscribedAt) {
    s += 3;
    reasons.push("On the marketing list (+3)");
  }
  if (c.unsubscribedAt) {
    s -= 10;
    reasons.push("Unsubscribed (−10)");
  }
  return { score: clamp(s), reasons };
}

/* --- next-best actions -------------------------------------------------- */

export type ActionCategory =
  | "new-lead"
  | "waiting-lead"
  | "follow-up"
  | "going-quiet"
  | "review"
  | "trial-ending"
  | "invite-idle"
  | "declined"
  | "report"
  | "post-due"
  | "upsell"
  | "qualified";

export const CATEGORY_META: Record<ActionCategory, { label: string; tone: "bad" | "warn" | "brand" | "good" | "value" | "ink"; lane: "today" | "week" | "opportunity" }> = {
  "waiting-lead": { label: "Waiting on you", tone: "bad", lane: "today" },
  "new-lead": { label: "New lead", tone: "good", lane: "today" },
  report: { label: "Safety report", tone: "bad", lane: "today" },
  review: { label: "Awaiting review", tone: "warn", lane: "today" },
  "follow-up": { label: "Follow-up due", tone: "warn", lane: "today" },
  "trial-ending": { label: "Trial ending", tone: "value", lane: "today" },
  "post-due": { label: "Post due", tone: "brand", lane: "today" },
  "going-quiet": { label: "Going quiet", tone: "brand", lane: "week" },
  "invite-idle": { label: "Invite not used", tone: "ink", lane: "week" },
  declined: { label: "Declined, not fixed", tone: "ink", lane: "week" },
  upsell: { label: "Sponsor upsell", tone: "value", lane: "opportunity" },
  qualified: { label: "Qualified prospect", tone: "good", lane: "opportunity" },
};

export type Draft = { to: string; subject: string; body: string; kind: "lead" | "contact"; id: string };

export type NextAction = {
  id: string;
  category: ActionCategory;
  priority: number;
  title: string;
  reason: string;
  href: string;
  cta: string;
  who?: { name: string; email?: string; phone?: string | null };
  context?: string;
  at?: string;
  draft?: Draft;
};

export function laneOf(a: NextAction): "today" | "week" | "opportunity" {
  const lane = CATEGORY_META[a.category].lane;
  if (lane === "opportunity") return lane;
  return a.priority >= 70 ? "today" : lane === "today" && a.priority >= 55 ? "today" : "week";
}

export function rankActions(actions: NextAction[]) {
  return [...actions].sort((a, b) => b.priority - a.priority || (a.at ?? "").localeCompare(b.at ?? ""));
}

const first = (name: string) => (name || "").trim().split(/\s+/)[0] || "there";

/** A reply to a lead. About the home and the dates — never about the person. */
export function leadReplyDraft(l: {
  id: string;
  kind: string;
  name: string;
  email: string;
  listingTitle?: string | null;
  cityName?: string | null;
  moveIn?: string | null;
  appUrl: string;
}): Draft {
  const home = l.listingTitle ? `“${l.listingTitle}”` : l.cityName ? `a place in ${l.cityName}` : "a place";
  const when = l.moveIn ? ` from ${l.moveIn}` : "";
  const subject =
    l.kind === "viewing"
      ? `Your viewing request — ${l.listingTitle ?? "RentLeaks"}`
      : l.kind === "stay"
        ? `Your booking request — ${l.listingTitle ?? "RentLeaks"}`
        : `Homes for you${l.cityName ? ` in ${l.cityName}` : ""} — RentLeaks`;
  const ask =
    l.kind === "viewing"
      ? `Thanks for asking to see ${home}. I'm confirming a time with the host now — which of the times you offered suits you best, and would a video walkthrough work if the in-person slots fill up?`
      : l.kind === "stay"
        ? `Thanks for your request to stay at ${home}${when}. I've passed it to the host and will come back to you within a day with their answer. Every price on RentLeaks is all-in, and you never pay RentLeaks anything.`
        : `Thanks for telling us what you're looking for${when}. I'm pulling together homes that fit your dates and budget — you'll have a shortlist from me shortly.`;
  return {
    kind: "lead",
    id: l.id,
    to: l.email,
    subject,
    body: `Hi ${first(l.name)},\n\n${ask}\n\nYou can browse everything that's live here: ${l.appUrl}/stays\n\nBest,\nRentLeaks`,
  };
}

export function followUpDraft(c: { id: string; name: string; email: string; kind: string; stage: string; appUrl: string }): Draft {
  const host = c.kind === "host" || c.kind === "operator";
  return {
    kind: "contact",
    id: c.id,
    to: c.email,
    subject: host ? "Following up — listing your homes on RentLeaks" : "Following up from RentLeaks",
    body: host
      ? `Hi ${first(c.name)},\n\nFollowing up on my last note. RentLeaks brings renters looking for rooms, furnished and 1-month+ stays, with all-in pricing so there are no surprises at viewing time.\n\nListing takes about ten minutes: ${c.appUrl}/list\n\nHappy to set it up with you on a quick call this week if that's easier.\n\nBest,\nRentLeaks`
      : `Hi ${first(c.name)},\n\nJust checking in — are you still looking for a place? New homes go live on RentLeaks every day: ${c.appUrl}/stays\n\nReply with your dates and budget and I'll send you a shortlist.\n\nBest,\nRentLeaks`,
  };
}

export function trialEndingDraft(u: { contactId: string; name: string; email: string; listings: number; ends: string; appUrl: string }): Draft {
  return {
    kind: "contact",
    id: u.contactId,
    to: u.email,
    subject: u.listings ? "Your free week ends soon — keep your listing live" : "Your free week ends soon — list your place today",
    body: u.listings
      ? `Hi ${first(u.name)},\n\nYour RentLeaks free week ends on ${u.ends}. Your listing stays live after that on the weekly or monthly plan — you can choose in your account: ${u.appUrl}/account\n\nIf anything held you back, reply and tell me.\n\nBest,\nRentLeaks`
      : `Hi ${first(u.name)},\n\nYour RentLeaks free week ends on ${u.ends}, and there's still time to put your place in front of renters for free: ${u.appUrl}/list\n\nIt takes about ten minutes. Reply if you'd like a hand.\n\nBest,\nRentLeaks`,
  };
}

export function declinedDraft(c: { contactId: string; name: string; email: string; title: string; note: string; appUrl: string }): Draft {
  return {
    kind: "contact",
    id: c.contactId,
    to: c.email,
    subject: `Getting “${c.title}” live on RentLeaks`,
    body: `Hi ${first(c.name)},\n\nYour listing “${c.title}” is close. The one thing holding it back: ${c.note}\n\nOnce that's fixed in your account it comes straight back to me for review: ${c.appUrl}/account\n\nBest,\nRentLeaks`,
  };
}

export function upsellDraft(c: { contactId: string; name: string; email: string; live: number; appUrl: string }): Draft {
  return {
    kind: "contact",
    id: c.contactId,
    to: c.email,
    subject: "Put your homes at the top of RentLeaks search",
    body: `Hi ${first(c.name)},\n\nYou have ${c.live} homes live on RentLeaks. Sponsoring them puts them first in their city's results and on the map, clearly labelled as sponsored.\n\nYou can switch it on per listing in your account: ${c.appUrl}/account\n\nBest,\nRentLeaks`,
  };
}
