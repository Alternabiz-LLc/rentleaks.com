/**
 * Match & Send: which live homes fit a renter's request, and why.
 *
 * Pure scoring, so the desk, the instant reply and the tests agree. Hard
 * rules first (wrong city, far over budget, not free in time), then points
 * for what makes a shortlist worth opening. Only facts about the home and the
 * request are used — never anything about the person.
 */
import { toUsd } from "@/lib/listing-rules";

export type MatchRequest = {
  cityId: string | null;
  housingType: string | null;
  budgetMax: number | null;
  currency: string;
  moveIn: string | null;
  moveOut: string | null;
  stayMonths: number | null;
};

export type MatchHome = {
  id: string;
  cityId: string;
  housingType: string;
  allInUsd: number;
  availableFrom: string;
  availableUntil: string | null;
  minStayMonths: number;
  maxStayMonths: number;
  verified: boolean;
  sponsored: boolean;
  postedAt: Date;
  confirmedAt?: Date | null;
};

export type Match = { id: string; score: number; reasons: string[] };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86_400_000;

function days(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
}

/** Months the renter wants: explicit, or from the two dates. */
export function wantedMonths(r: MatchRequest): number | null {
  if (r.stayMonths && r.stayMonths > 0) return r.stayMonths;
  if (r.moveIn && r.moveOut && ISO.test(r.moveIn) && ISO.test(r.moveOut)) {
    const d = days(r.moveIn, r.moveOut);
    return d > 0 ? Math.max(1, Math.round(d / 30)) : null;
  }
  return null;
}

export function scoreMatch(r: MatchRequest, h: MatchHome, now = Date.now()): Match | null {
  const reasons: string[] = [];
  let score = 0;

  if (r.cityId && h.cityId !== r.cityId) return null;
  if (!h.allInUsd || h.allInUsd <= 0) return null;

  /* Budget: up to 10% over is still shown, flagged. */
  if (r.budgetMax && r.budgetMax > 0) {
    const budget = toUsd(r.budgetMax, r.currency || "USD");
    const ratio = h.allInUsd / budget;
    if (ratio > 1.1) return null;
    if (ratio <= 1) {
      score += 30 + Math.round((1 - ratio) * 20);
      reasons.push(ratio < 0.85 ? "well under budget" : "within budget");
    } else {
      score += 8;
      reasons.push(`${Math.round((ratio - 1) * 100)}% over budget`);
    }
  } else {
    score += 15;
  }

  /* Type: the asked-for type scores; anything else is a fallback. */
  if (r.housingType) {
    if (h.housingType === r.housingType) {
      score += 25;
      reasons.push("the type asked for");
    } else {
      score -= 5;
      reasons.push("similar type");
    }
  }

  /* Dates: free by move-in (or within two weeks), still free at move-out. */
  if (r.moveIn && ISO.test(r.moveIn)) {
    if (ISO.test(h.availableFrom) && h.availableFrom > r.moveIn) {
      const late = days(r.moveIn, h.availableFrom);
      if (late > 14) return null;
      score += 6;
      reasons.push(`free ${late} day${late === 1 ? "" : "s"} after move-in`);
    } else {
      score += 20;
      reasons.push("free by move-in");
    }
  }
  if (r.moveOut && ISO.test(r.moveOut) && h.availableUntil && ISO.test(h.availableUntil) && h.availableUntil < r.moveOut) {
    return null;
  }

  /* Stay length inside the home's minimum and maximum. */
  const months = wantedMonths(r);
  if (months) {
    if (months < h.minStayMonths) return null;
    if (h.maxStayMonths && months > h.maxStayMonths) {
      score -= 10;
      reasons.push(`max stay ${h.maxStayMonths} months`);
    } else {
      score += 10;
      reasons.push(`${months}-month stay fits`);
    }
  }

  if (h.verified) {
    score += 5;
    reasons.push("verified host");
  }
  if (h.sponsored) score += 2;
  const fresh = (h.confirmedAt ?? h.postedAt).getTime();
  if (now - fresh < 14 * DAY) {
    score += 5;
    reasons.push("recently confirmed");
  }

  return { id: h.id, score: Math.max(0, Math.min(100, score)), reasons };
}

export function rankMatches(r: MatchRequest, homes: MatchHome[], limit = 3, now = Date.now()): Match[] {
  return homes
    .map((h) => scoreMatch(r, h, now))
    .filter((m): m is Match => m !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
