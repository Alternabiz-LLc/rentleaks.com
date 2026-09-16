/** Numbers shared by the overview and the revenue page. */

/** Current time in ms (kept out of components for the purity lint). */
export const nowMs = () => Date.now();

export const LISTING_WEEKLY = 14;
export const LISTING_MONTHLY = 60;
export const PROMO_WEEKLY = 45;
export const PROMO_MONTHLY = 120;

/** Recurring revenue at posted rates. Lease-breaks publish free; paused listings are not billed. */
export function recurringMonthly(listings: Array<{ status: string; housingType: string; plan: string; sponsored: boolean }>) {
  return listings
    .filter((l) => l.status !== "paused" && l.housingType !== "lease-break")
    .reduce((sum, l) => {
      const weekly = l.plan !== "month";
      const listing = weekly ? LISTING_WEEKLY : LISTING_MONTHLY;
      const promo = l.sponsored ? (weekly ? PROMO_WEEKLY : PROMO_MONTHLY) : 0;
      return sum + (weekly ? (listing + promo) * 4.33 : listing + promo);
    }, 0);
}

/** Monday (UTC) of the week containing `d`, as YYYY-MM-DD. */
export function weekKey(d: Date) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day);
  return t.toISOString().slice(0, 10);
}

export function lastWeeks(n: number, now = new Date()) {
  const out: string[] = [];
  const start = new Date(`${weekKey(now)}T00:00:00Z`);
  for (let i = n - 1; i >= 0; i--) out.push(new Date(start.getTime() - i * 7 * 86_400_000).toISOString().slice(0, 10));
  return out;
}

export function bucketWeeks(dates: Date[], weeks: string[]) {
  const counts = new Map(weeks.map((w) => [w, 0]));
  for (const d of dates) {
    const k = weekKey(d);
    if (counts.has(k)) counts.set(k, (counts.get(k) || 0) + 1);
  }
  return weeks.map((w) => ({ week: w, count: counts.get(w) || 0 }));
}

export function monthKey(d: Date) {
  return d.toISOString().slice(0, 7);
}
