/**
 * Host scorecards: how good is each host to rent from? Four things renters
 * feel — listing quality, freshness, replying at all, replying fast — rolled
 * into one grade the desk can act on (nudge the weak, reward the strong).
 */
import { prisma } from "@/lib/prisma";
import { sampleCatalogIds } from "@/lib/sample-catalog";
import { auditListing, freshnessOf } from "./catalogue";

const DAY = 86_400_000;
export const WINDOW_DAYS = 90;

export type Grade = "A" | "B" | "C" | "D";
export const GRADE_TONE: Record<Grade, "good" | "brand" | "warn" | "bad"> = { A: "good", B: "brand", C: "warn", D: "bad" };

export type Scorecard = {
  id: string;
  name: string;
  email: string;
  role: string;
  since: Date;
  live: number;
  listings: number;
  quality: number;
  freshPct: number;
  threads: number;
  replyRate: number | null;
  replyMins: number | null;
  leads: number;
  booked: number;
  sponsored: number;
  score: number;
  grade: Grade;
  weakest: Weak | null;
  homes: Array<{ id: string; title: string; live: boolean; quality: number; fresh: string; failing: string[] }>;
};

export type Weak = "quality" | "freshness" | "replies" | "speed";

/** Reply speed → 0–100. No data counts as neutral. */
export function speedScore(mins: number | null) {
  if (mins === null) return 60;
  if (mins <= 60) return 100;
  if (mins <= 240) return 85;
  if (mins <= 720) return 65;
  if (mins <= 1440) return 45;
  return 20;
}

export function gradeOf(score: number): Grade {
  return score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : "D";
}

/** Pure: the weighted score and the part to fix first. */
export function scoreHost(p: { quality: number; freshPct: number; replyRate: number | null; replyMins: number | null }) {
  const parts: Record<Weak, number> = {
    quality: p.quality,
    freshness: p.freshPct,
    replies: p.replyRate === null ? 60 : p.replyRate,
    speed: speedScore(p.replyMins),
  };
  const score = Math.round(parts.quality * 0.3 + parts.freshness * 0.25 + parts.replies * 0.3 + parts.speed * 0.15);
  const low = (Object.entries(parts) as Array<[Weak, number]>).sort((a, b) => a[1] - b[1])[0];
  return { score, grade: gradeOf(score), weakest: low[1] < 80 ? low[0] : null, parts };
}

/**
 * Pure: first host reply after the renter's first message, per thread.
 * Returns the reply rate (%) and the median minutes, or nulls without threads.
 */
export function replyStats(threads: Array<{ hostId: string; messages: Array<{ senderId: string; createdAt: Date }> }>) {
  const waits: number[] = [];
  let asked = 0;
  for (const t of threads) {
    const msgs = [...t.messages].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const firstAsk = msgs.find((m) => m.senderId !== t.hostId);
    if (!firstAsk) continue;
    asked++;
    const reply = msgs.find((m) => m.senderId === t.hostId && m.createdAt >= firstAsk.createdAt);
    if (reply) waits.push((reply.createdAt.getTime() - firstAsk.createdAt.getTime()) / 60_000);
  }
  if (!asked) return { threads: 0, replyRate: null, replyMins: null };
  const s = waits.sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  const median = s.length ? (s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2) : null;
  return { threads: asked, replyRate: Math.round((waits.length / asked) * 100), replyMins: median === null ? null : Math.round(median) };
}

export async function loadScorecards(now = Date.now(), only?: string[]) {
  let sample: Set<string>;
  try {
    sample = await sampleCatalogIds();
  } catch {
    return { cards: [] as Scorecard[], unavailable: true };
  }
  const since = new Date(now - WINDOW_DAYS * DAY);
  const listings = await prisma.listing.findMany({
    where: { moderation: { not: "declined" }, host: { role: { notIn: ["admin", "staff"] } }, ...(only ? { hostId: { in: only } } : {}) },
    select: {
      id: true, hostId: true, listedBy: true, housingType: true, cityId: true, title: true, neighborhood: true, address: true, description: true, price: true, deposit: true,
      feesJson: true, availableFrom: true, availableUntil: true, minStayMonths: true, maxStayMonths: true, leaseEnd: true, consentStatus: true, registrationNumber: true,
      image: true, detail: true, status: true, moderation: true, sponsored: true, postedAt: true, confirmedAt: true, freshnessAskedAt: true, updatedAt: true,
      city: { select: { slug: true, name: true, state: true, country: true } },
    },
    take: 5000,
  });
  const real = listings.filter((l) => !sample.has(l.id));
  const hostIds = [...new Set(real.map((l) => l.hostId))];
  if (!hostIds.length) return { cards: [], unavailable: false };
  const ids = real.map((l) => l.id);
  const [hosts, threads, leads, bookings] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: hostIds } }, select: { id: true, name: true, email: true, role: true, createdAt: true, suspendedAt: true } }),
    prisma.conversation.findMany({
      where: { hostId: { in: hostIds }, createdAt: { gte: since } },
      select: { hostId: true, messages: { select: { senderId: true, createdAt: true }, orderBy: { createdAt: "asc" }, take: 20 } },
      take: 5000,
    }),
    prisma.lead.findMany({ where: { listingId: { in: ids }, createdAt: { gte: since }, status: { not: "spam" } }, select: { listingId: true, status: true } }),
    prisma.booking.findMany({ where: { listingId: { in: ids }, stage: { in: ["signed", "moved_in", "moved_out"] }, updatedAt: { gte: since } }, select: { listingId: true } }),
  ]);
  const hostOf = new Map(real.map((l) => [l.id, l.hostId]));
  const cards: Scorecard[] = [];
  for (const h of hosts) {
    if (h.suspendedAt) continue;
    const mine = real.filter((l) => l.hostId === h.id);
    const homes = mine.map((l) => {
      const a = auditListing(l);
      const f = freshnessOf(l, now);
      return { id: l.id, title: l.title, live: l.status !== "paused" && l.moderation === "approved", quality: a.score, fresh: f.state, failing: a.failing.map((x) => x.title), sponsored: l.sponsored };
    });
    const live = homes.filter((x) => x.live);
    const quality = homes.length ? Math.round(homes.reduce((n, x) => n + x.quality, 0) / homes.length) : 0;
    const freshPct = live.length ? Math.round((live.filter((x) => x.fresh === "fresh").length / live.length) * 100) : 0;
    const r = replyStats(threads.filter((t) => t.hostId === h.id));
    const s = scoreHost({ quality, freshPct, replyRate: r.replyRate, replyMins: r.replyMins });
    const myLeads = leads.filter((l) => l.listingId && hostOf.get(l.listingId) === h.id);
    const bookedLeads = myLeads.filter((l) => l.status === "booked").length;
    const bookedDeals = bookings.filter((b) => b.listingId && hostOf.get(b.listingId) === h.id).length;
    cards.push({
      id: h.id,
      name: h.name,
      email: h.email,
      role: h.role,
      since: h.createdAt,
      live: live.length,
      listings: homes.length,
      quality,
      freshPct,
      threads: r.threads,
      replyRate: r.replyRate,
      replyMins: r.replyMins,
      leads: myLeads.length,
      booked: Math.max(bookedLeads, bookedDeals),
      sponsored: homes.filter((x) => x.sponsored && x.live).length,
      score: s.score,
      grade: s.grade,
      weakest: s.weakest,
      homes: homes.map((x) => ({ id: x.id, title: x.title, live: x.live, quality: x.quality, fresh: x.fresh, failing: x.failing })),
    });
  }
  cards.sort((a, b) => b.score - a.score || b.live - a.live);
  return { cards, unavailable: false };
}

export function minsLabel(m: number | null) {
  if (m === null) return "—";
  if (m < 60) return `${m} min`;
  if (m < 48 * 60) return `${Math.round(m / 60)} h`;
  return `${Math.round(m / 1440)} days`;
}

/** The nudge a host gets, aimed at their weakest part. About the listing, never the renter. */
export function nudgeDraft(c: Pick<Scorecard, "name" | "weakest" | "homes" | "replyMins" | "replyRate">, base: string) {
  const first = c.name.trim().split(/\s+/)[0] || "there";
  const fix = c.homes.filter((h) => h.failing.length).slice(0, 5);
  const tip: Record<Weak, string> = {
    quality: `A few details are missing on your listings — renters skip homes without them:\n\n${fix.map((h) => `• ${h.title}: ${h.failing.join(", ")}`).join("\n") || "• photos and itemised fees"}\n\nEdit them here: ${base}/account`,
    freshness: `Renters trust homes confirmed as available recently. Please confirm yours (one tap each) or pause what's taken: ${base}/account`,
    replies: `Some renters who messaged you haven't had an answer yet${c.replyRate !== null ? ` (you replied to ${c.replyRate}% in the last 90 days)` : ""}. A quick "yes, still available" keeps them with you: ${base}/account`,
    speed: `Renters book the first home that answers. Your typical reply takes ${minsLabel(c.replyMins)} — replying within the hour keeps them with you. Your messages are here: ${base}/account`,
  };
  const body = c.weakest
    ? `Hi ${first},\n\nThanks for listing with RentLeaks. One thing would get you more bookings:\n\n${tip[c.weakest]}\n\nReply if you need a hand.\n\nRentLeaks`
    : `Hi ${first},\n\nYour listings are in great shape — thank you. Renters notice.\n\nRentLeaks`;
  const subject = c.weakest === "quality" ? "Quick fixes for more bookings" : c.weakest === "freshness" ? "Are your homes still available?" : c.weakest ? "Renters are waiting for you" : "Thank you from RentLeaks";
  return { subject, body };
}

export function sponsorDraft(c: Pick<Scorecard, "name" | "grade" | "live">, base: string, price: string) {
  const first = c.name.trim().split(/\s+/)[0] || "there";
  return {
    subject: "Your homes qualify for a sponsored spot",
    body:
      `Hi ${first},\n\nYour listings are among the best rated on RentLeaks (grade ${c.grade}) — complete, confirmed and quick to answer.\n\n` +
      `That makes ${c.live === 1 ? "your home" : "your homes"} a good fit for a sponsored spot under the homepage hero and at the top of stay results in your city (${price}).\n\n` +
      `Switch it on per listing in your account: ${base}/account\n\nRentLeaks`,
  };
}
