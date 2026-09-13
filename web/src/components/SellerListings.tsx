"use client";

/**
 * The seller's own listings, with the controls that belong to the owner rather
 * than to the renter: status, plan, and paid placement.
 *
 * Each row also carries what a renter would see on it — whether it is
 * verified, whether it accepts vouchers, whether it has an availability
 * window. A listing with no window cannot answer a date-range search, which is
 * the single most common way a mid-term listing quietly gets no enquiries, so
 * the dashboard says so rather than leaving the seller to wonder.
 */

import { useState, useTransition } from "react";
import Link from "next/link";
import { setListingPlan, setListingSponsored, setListingStatus } from "@/app/actions/listing-admin";

export type SellerListing = {
  id: string;
  title: string;
  cityName: string;
  cityId: string;
  housingType: string;
  typeLabel: string;
  allIn: number;
  currency: string;
  status: string;
  sponsored: boolean;
  plan: string;
  verified: boolean;
  vouchersAccepted: boolean;
  availableFrom: string;
  availableUntil: string | null;
  photoCount: number;
  href: string;
};

const PLAN_COST = {
  week: { listing: 14, sponsored: 45, per: "week" },
  month: { listing: 60, sponsored: 120, per: "month" },
} as const;

export default function SellerListings({ listings }: { listings: SellerListing[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState(listings);

  const run = (id: string, patch: Partial<SellerListing>, fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    /* Optimistic, then reconciled — the controls should feel immediate, but a
       refusal has to actually roll the row back rather than leave the screen
       lying about what is live. */
    const before = rows;
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setRows(before);
        setError(res.error);
      }
    });
  };

  const money = (n: number, currency: string) => {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
    } catch {
      return `${currency} ${n}`;
    }
  };

  if (!rows.length) {
    return (
      <div className="s-empty">
        <h2>No listings yet</h2>
        <p>
          Nothing here is on the map until it is in the database. The composer walks you through it and will not let you
          publish something that breaches your market&rsquo;s rules — which is the point of it.
        </p>
        <Link className="btn btn--primary" href="/list">List a place</Link>
      </div>
    );
  }

  const monthlyTotal = rows
    .filter((r) => r.status !== "paused" && r.housingType !== "lease-break")
    .reduce((sum, r) => {
      const p = PLAN_COST[r.plan === "month" ? "month" : "week"];
      const per = p.listing + (r.sponsored ? p.sponsored : 0);
      return sum + (r.plan === "month" ? per : per * 4.33);
    }, 0);

  return (
    <div className="s-wrap">
      {error && <div className="x-guard is-on"><b>Not changed.</b> {error}</div>}

      <div className="s-summary">
        <div>
          <span className="s-summary__k">Listings</span>
          <b>{rows.length}</b>
          <small>{rows.filter((r) => r.status === "active").length} live · {rows.filter((r) => r.status === "paused").length} paused</small>
        </div>
        <div>
          <span className="s-summary__k">Sponsored</span>
          <b>{rows.filter((r) => r.sponsored).length}</b>
          <small>promoted only in their own market</small>
        </div>
        <div>
          <span className="s-summary__k">Roughly per month</span>
          <b>${Math.round(monthlyTotal)}</b>
          <small>lease-breaks and paused listings cost nothing</small>
        </div>
      </div>

      <ul className="s-list">
        {rows.map((l) => {
          const plan = PLAN_COST[l.plan === "month" ? "month" : "week"];
          const noWindow = !l.availableUntil;
          return (
            <li className="s-row" key={l.id} data-status={l.status}>
              <div className="s-row__main">
                <Link href={l.href} className="s-row__title">{l.title}</Link>
                <p className="s-row__meta">
                  {l.typeLabel} · {l.cityName} · {money(l.allIn, l.currency)} all-in /mo
                </p>
                <div className="x-chiprow">
                  {l.verified
                    ? <span className="x-chip" style={{ background: "var(--success-soft)", color: "var(--success)" }}>Verified</span>
                    : <Link href="/verify" className="x-chip" style={{ background: "var(--value-soft)", color: "var(--value)" }}>Verify to rank</Link>}
                  {l.vouchersAccepted && <span className="x-chip x-chip--voucher">Vouchers ok</span>}
                  {l.sponsored && <span className="x-chip" style={{ background: "var(--ochre-100)", color: "var(--ochre-700)" }}>Sponsored in {l.cityName}</span>}
                  {l.photoCount < 4 && <span className="x-chip" style={{ background: "var(--alert-soft)", color: "var(--alert)" }}>{l.photoCount} photos</span>}
                  {noWindow && <span className="x-chip" style={{ background: "var(--alert-soft)", color: "var(--alert)" }}>No end date</span>}
                </div>
                {noWindow && (
                  <p className="s-row__warn">
                    Without an end date this cannot answer a date-range search — someone looking for March to June will
                    never see it. Add one in the composer.
                  </p>
                )}
              </div>

              <div className="s-row__controls">
                <label className="s-ctl">
                  <span>Status</span>
                  <select
                    value={l.status}
                    disabled={pending}
                    onChange={(e) => run(l.id, { status: e.target.value }, () => setListingStatus(l.id, e.target.value))}
                  >
                    <option value="active">Live</option>
                    <option value="coming-soon">Coming soon</option>
                    <option value="paused">Paused</option>
                  </select>
                </label>

                <label className="s-ctl">
                  <span>Billing</span>
                  <select
                    value={l.plan}
                    disabled={pending}
                    onChange={(e) => run(l.id, { plan: e.target.value }, () => setListingPlan(l.id, e.target.value))}
                  >
                    <option value="week">Weekly — ${PLAN_COST.week.listing}</option>
                    <option value="month">Monthly — ${PLAN_COST.month.listing}</option>
                  </select>
                </label>

                <label className="s-ctl s-ctl--toggle">
                  <input
                    type="checkbox"
                    checked={l.sponsored}
                    disabled={pending}
                    onChange={(e) => run(l.id, { sponsored: e.target.checked }, () => setListingSponsored(l.id, e.target.checked))}
                  />
                  <span>
                    Sponsored <b>+${plan.sponsored}/{plan.per}</b>
                    <small>Top of results in {l.cityName} only. Buys position, not a badge.</small>
                  </span>
                </label>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
