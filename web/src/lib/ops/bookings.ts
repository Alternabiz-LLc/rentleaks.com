/**
 * Bookings: a renter's path from viewing to move-out. Pure helpers shared by
 * the board, the calendar, the renewal list and the tests.
 */
export const BOOKING_STAGES = ["viewing", "application", "approved", "signed", "moved_in", "moved_out", "lost"] as const;
export type BookingStage = (typeof BOOKING_STAGES)[number];

export const STAGE_META: Record<BookingStage, { label: string; tone: "brand" | "value" | "warn" | "good" | "ink" | "bad"; hint: string }> = {
  viewing: { label: "Viewing", tone: "brand", hint: "Booked or requested" },
  application: { label: "Application", tone: "value", hint: "Documents with the host" },
  approved: { label: "Approved", tone: "warn", hint: "Waiting for signatures" },
  signed: { label: "Lease signed", tone: "good", hint: "Move-in coming" },
  moved_in: { label: "Moved in", tone: "good", hint: "Check in at 30 days" },
  moved_out: { label: "Moved out", tone: "ink", hint: "Done" },
  lost: { label: "Lost", tone: "bad", hint: "Say why — it teaches the funnel" },
};

export const BOARD_STAGES: BookingStage[] = ["viewing", "application", "approved", "signed", "moved_in", "lost"];

export function isStage(v: string): v is BookingStage {
  return (BOOKING_STAGES as readonly string[]).includes(v);
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86_400_000;

/** Days until the stay ends, or null without a valid end date. */
export function daysToMoveOut(moveOut: string | null | undefined, now = Date.now()) {
  if (!moveOut || !ISO.test(moveOut)) return null;
  return Math.ceil((Date.parse(`${moveOut}T00:00:00Z`) - now) / DAY);
}

/** Renewal window: an active stay ending within `days` (default 90). */
export function renewalDue(b: { stage: string; moveOut: string | null }, now = Date.now(), days = 90) {
  if (b.stage !== "signed" && b.stage !== "moved_in") return false;
  const d = daysToMoveOut(b.moveOut, now);
  return d !== null && d >= 0 && d <= days;
}

export type SlotRequest = { date: string; window: string };

/** Viewing slots a renter asked for (stored as JSON on the lead). */
export function parseSlots(json: string): SlotRequest[] {
  try {
    const v = JSON.parse(json) as unknown;
    return Array.isArray(v)
      ? v.filter((s): s is SlotRequest => !!s && typeof s === "object" && ISO.test(String((s as SlotRequest).date))).map((s) => ({ date: s.date, window: String(s.window || "") }))
      : [];
  } catch {
    return [];
  }
}

/** "2026-09-20T14:30" (wall clock of the home) → Date stored as that UTC time. */
export function wallClock(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function wallLabel(d: Date) {
  return d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" });
}
