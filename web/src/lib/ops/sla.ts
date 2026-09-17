/**
 * Speed-to-lead timers. A renter who is answered within five minutes is far
 * more likely to be reached than one answered after half an hour, and most
 * expect a reply within a day — so the desk shows every open lead's age
 * against those three marks.
 */
export type Sla = { label: string; tone: "good" | "warn" | "bad" | "ink"; minutes: number; stage: "answered" | "fresh" | "hour" | "day" | "late" };

export const SLA_MARKS = { fresh: 5, hour: 60, day: 24 * 60 } as const;

export function ageLabel(minutes: number) {
  if (minutes < 1) return "now";
  if (minutes < 60) return `${Math.floor(minutes)}m`;
  if (minutes < 48 * 60) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
}

export function slaOf(lead: { status: string; createdAt: Date; contactedAt: Date | null; ackSentAt?: Date | null }, now = Date.now()): Sla {
  if (lead.status !== "new") {
    const took = lead.contactedAt ? Math.max(0, (lead.contactedAt.getTime() - lead.createdAt.getTime()) / 60_000) : 0;
    return { label: lead.contactedAt ? `answered in ${ageLabel(took)}` : lead.status, tone: "ink", minutes: took, stage: "answered" };
  }
  const minutes = Math.max(0, (now - lead.createdAt.getTime()) / 60_000);
  if (minutes <= SLA_MARKS.fresh) return { label: `${ageLabel(minutes)} · on time`, tone: "good", minutes, stage: "fresh" };
  if (minutes <= SLA_MARKS.hour) return { label: `${ageLabel(minutes)} waiting`, tone: "warn", minutes, stage: "hour" };
  if (minutes <= SLA_MARKS.day) return { label: `${ageLabel(minutes)} waiting`, tone: "bad", minutes, stage: "day" };
  return { label: `${ageLabel(minutes)} — overdue`, tone: "bad", minutes, stage: "late" };
}

export function median(values: number[]) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
