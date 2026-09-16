import Link from "next/link";
import { Columns, Donut, FunnelLanes, Gauge, Kpi, RankedBars, TrendArea } from "@/components/admin/desk/charts";
import { DeskHeader } from "@/components/admin/desk/DeskHeader";
import { Icon } from "@/components/admin/desk/Icon";
import { Chip, Empty, Panel, ViewSwitch } from "@/components/admin/desk/parts";
import { qs, readParams, when, type SP } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";
import { bucketWeeks, lastWeeks, LISTING_MONTHLY, LISTING_WEEKLY, monthKey, nowMs, PROMO_MONTHLY, PROMO_WEEKLY, recurringMonthly } from "@/lib/admin/metrics";
import { prisma } from "@/lib/prisma";
import { typeLabel } from "@/lib/site";

export const metadata = { title: "Revenue & analytics — RentLeaks desk" };

const money = (cents: number, currency = "usd") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: 0 }).format(cents / 100);

export default async function RevenueAdmin({ searchParams }: { searchParams: SP }) {
  await requireAdminPage("/admin/revenue");
  const p = await readParams(searchParams);
  const now = new Date(nowMs());
  const span = p.weeks === "26" ? 26 : p.weeks === "52" ? 52 : 12;
  const weeks = lastWeeks(span, now);
  const since = new Date(`${weeks[0]}T00:00:00Z`);
  const [payments, listings, signups, leads, newListings, stages, trials, campaigns, ads, cities] = await Promise.all([
    prisma.payment.findMany({
      include: { user: { select: { name: true, email: true } }, listing: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.listing.findMany({ select: { status: true, housingType: true, plan: true, sponsored: true, cityId: true, moderation: true } }),
    prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, role: true } }),
    prisma.lead.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, status: true, source: true, campaign: true, contactedAt: true } }),
    prisma.listing.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.contact.groupBy({ by: ["stage"], _count: { _all: true } }),
    prisma.trialInvite.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.campaign.aggregate({ _sum: { sent: true, failed: true }, _count: { _all: true } }),
    prisma.adCampaign.findMany({ select: { name: true, utmCampaign: true, spend: true, currency: true } }),
    prisma.city.findMany({ select: { id: true, name: true } }),
  ]);
  const cityName = new Map(cities.map((c) => [c.id, c.name]));

  const paid = payments.filter((x) => x.status === "paid" || x.status === "succeeded" || x.status === "complete");
  const byMonth = new Map<string, number>();
  for (const x of paid) byMonth.set(monthKey(x.createdAt), (byMonth.get(monthKey(x.createdAt)) || 0) + x.amount);
  const thisMonth = byMonth.get(monthKey(now)) || 0;
  const lifetime = paid.reduce((n, x) => n + x.amount, 0);
  const byKind = new Map<string, number>();
  for (const x of paid) byKind.set(x.kind, (byKind.get(x.kind) || 0) + x.amount);
  const billable = listings.filter((l) => l.moderation === "approved");
  const recurring = recurringMonthly(billable);
  const sponsoredMrr = recurringMonthly(billable.filter((l) => l.sponsored)) - recurringMonthly(billable.filter((l) => l.sponsored).map((l) => ({ ...l, sponsored: false })));

  // Recurring by market, at posted rates.
  const mrrByCity = new Map<string, number>();
  for (const l of billable) mrrByCity.set(l.cityId, (mrrByCity.get(l.cityId) || 0) + recurringMonthly([l]));
  const mrrByType = new Map<string, number>();
  for (const l of billable) mrrByType.set(l.housingType, (mrrByType.get(l.housingType) || 0) + recurringMonthly([l]));

  const signupWeeks = bucketWeeks(signups.map((s) => s.createdAt), weeks);
  const hostWeeks = bucketWeeks(signups.filter((s) => s.role === "host").map((s) => s.createdAt), weeks);
  const leadWeeks = bucketWeeks(leads.map((l) => l.createdAt), weeks);
  const answeredWeeks = bucketWeeks(leads.filter((l) => l.contactedAt).map((l) => l.createdAt), weeks);
  const listingWeeks = bucketWeeks(newListings.map((l) => l.createdAt), weeks);
  const leadStatus = (s: string) => leads.filter((l) => l.status === s).length;
  const trialCount = (s: string) => trials.find((x) => x.status === s)?._count._all ?? 0;
  const invited = trials.reduce((n, x) => n + x._count._all, 0);
  const adSpend = ads.reduce((n, a) => n + a.spend, 0);
  const adLeads = leads.filter((l) => l.campaign && ads.some((a) => a.utmCampaign === l.campaign)).length;
  const real = leads.filter((l) => l.status !== "spam").length;
  const self = (over: Record<string, string | undefined> = {}) => `/admin/revenue${qs(p, over)}`;
  const wk = (w: string) => w.slice(5);

  return (
    <div className="dk-stack">
      <DeskHeader
        href="/admin/revenue"
        signals={[
          { label: "Collected this month", value: money(thisMonth), tone: thisMonth ? "live" : "ok" },
          { label: "Recurring (posted rates)", value: `$${Math.round(recurring).toLocaleString("en-US")}/mo`, tone: "live" },
          { label: "Lifetime collected", value: money(lifetime), tone: "ok" },
          { label: "Ad spend", value: `$${adSpend.toLocaleString("en-US")}${adLeads ? ` · $${Math.round(adSpend / adLeads)}/lead` : ""}`, tone: "ok", href: "/admin/ads" },
        ]}
        actions={
          <>
            <Link prefetch={false} className="dk-btn dk-btn--onink" href="/api/admin/export/payments">
              <Icon name="export" size={15} /> Payments CSV
            </Link>
            <Link prefetch={false} className="dk-btn dk-btn--onink" href="/api/admin/export/contacts">
              <Icon name="export" size={15} /> Contacts CSV
            </Link>
          </>
        }
      />

      <div className="dk-toolbar">
        <ViewSwitch
          label="Range"
          items={[
            { key: "12", label: "12 weeks", href: self({ weeks: undefined }), on: span === 12 },
            { key: "26", label: "26 weeks", href: self({ weeks: "26" }), on: span === 26 },
            { key: "52", label: "52 weeks", href: self({ weeks: "52" }), on: span === 52 },
          ]}
        />
        <span className="dk-hint">
          Posted rates: listing ${LISTING_WEEKLY}/wk or ${LISTING_MONTHLY}/mo · promotion ${PROMO_WEEKLY}/wk or ${PROMO_MONTHLY}/mo · lease-breaks list free
        </span>
      </div>

      <div className="dk-kpis">
        <Kpi label="Collected this month" value={Math.round(thisMonth / 100)} fmt="usd" sub={`${money(lifetime)} lifetime`} tone="value" />
        <Kpi label="Recurring" value={Math.round(recurring)} fmt="usd" sub="per month if every live listing pays" tone="value" spark={listingWeeks.map((w) => w.count)} />
        <Kpi label="From sponsorship" value={Math.round(sponsoredMrr)} fmt="usd" sub="of recurring, per month" href="/admin/listings?sponsored=yes" />
        <Kpi label="Pending payments" value={payments.filter((x) => x.status === "pending").length} />
        <Kpi label={`New accounts · ${span}w`} value={signups.length} sub={`${signups.filter((s) => s.role === "host").length} hosts`} spark={signupWeeks.map((w) => w.count)} href="/admin/accounts" />
        <Kpi label={`Leads · ${span}w`} value={leads.length} sub={`${leadStatus("booked")} booked`} spark={leadWeeks.map((w) => w.count)} href="/admin/leads" />
      </div>

      <div className="dk-grid dk-grid--2-1">
        <Panel title="Leads per week" sub="Received vs answered.">
          <TrendArea points={leadWeeks.map((w, i) => ({ label: wk(w.week), a: w.count, b: answeredWeeks[i].count }))} aLabel="received" bLabel="answered" />
        </Panel>
        <Panel title="Lead funnel" sub={`${span} weeks, spam excluded.`}>
          <FunnelLanes
            stages={[
              { label: "Received", value: real, href: "/admin/leads" },
              { label: "Contacted+", value: leadStatus("contacted") + leadStatus("booked") + leadStatus("closed"), href: "/admin/leads?status=contacted" },
              { label: "Booked", value: leadStatus("booked"), href: "/admin/leads?status=booked" },
            ]}
          />
          <div style={{ marginTop: 18 }}>
            <Gauge pct={real ? (leadStatus("booked") / real) * 100 : 0} label="Lead → booking" />
          </div>
        </Panel>
      </div>

      <div className="dk-grid dk-grid--3">
        <Panel title="New accounts per week">
          <Columns rows={signupWeeks.map((w) => ({ label: wk(w.week), value: w.count }))} height={150} />
        </Panel>
        <Panel title="New listings per week">
          <Columns rows={listingWeeks.map((w) => ({ label: wk(w.week), value: w.count }))} height={150} />
        </Panel>
        <Panel title="Host sign-ups per week">
          <Columns rows={hostWeeks.map((w) => ({ label: wk(w.week), value: w.count }))} height={150} />
        </Panel>
      </div>

      <div className="dk-grid dk-grid--2">
        <Panel title="Recurring by market" sub="Per month at posted rates, approved listings.">
          <RankedBars
            fmt="usd"
            rows={[...mrrByCity.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10)
              .map(([id, v]) => ({ key: id, label: cityName.get(id) ?? id, value: Math.round(v), href: `/admin/listings?city=${id}` }))}
          />
        </Panel>
        <Panel title="Recurring by type" sub="Lease-breaks list free, so they add nothing here.">
          <Donut
            items={[...mrrByType.entries()]
              .filter(([, v]) => v > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([ty, v]) => ({ label: typeLabel(ty).replace(/ \(.*\)/, ""), value: Math.round(v), href: `/admin/listings?type=${ty}` }))}
            centerLabel="$ / MONTH"
          />
        </Panel>
      </div>

      <div className="dk-grid dk-grid--3">
        <Panel title="Collected by month">
          {byMonth.size ? <Columns rows={[...byMonth.entries()].sort().slice(-12).map(([m, v]) => ({ label: m.slice(2), value: Math.round(v / 100) }))} fmt="usd" height={150} /> : <Empty title="No payments yet.">They appear once checkout (Stripe) is switched on.</Empty>}
        </Panel>
        <Panel title="CRM pipeline">
          <FunnelLanes stages={["new", "contacted", "qualified", "customer"].map((s) => ({ label: s, value: stages.find((x) => x.stage === s)?._count._all ?? 0, href: `/admin/crm?stage=${s}` }))} />
        </Panel>
        <Panel title="Growth programs">
          <RankedBars
            rows={[
              { key: "inv", label: "Trial invites", value: invited, href: "/admin/trials" },
              { key: "red", label: "Trials redeemed", value: trialCount("redeemed"), hint: invited ? `${Math.round((trialCount("redeemed") / invited) * 100)}%` : undefined, href: "/admin/trials?state=redeemed" },
              { key: "cmp", label: "Campaigns", value: campaigns._count._all, href: "/admin/campaigns" },
              { key: "sent", label: "Emails sent", value: campaigns._sum.sent ?? 0, href: "/admin/campaigns?status=sent" },
            ]}
          />
          {byKind.size ? (
            <p className="dk-hint" style={{ marginTop: 12 }}>
              By product: {[...byKind.entries()].map(([k, v]) => `${k} ${money(v)}`).join(" · ")}
            </p>
          ) : null}
        </Panel>
      </div>

      <Panel flush title="Latest payments">
        {payments.length === 0 ? (
          <div style={{ padding: 20 }}>
            <Empty title="No payments yet.">They appear here once checkout (Stripe) is switched on. RentLeaks never takes renter money — only listing and promotion fees from hosts.</Empty>
          </div>
        ) : (
          <div className="dk-tablewrap">
            <table className="dk-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Account</th>
                  <th>Product</th>
                  <th>Listing</th>
                  <th className="dk-right">Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.slice(0, 50).map((x) => (
                  <tr key={x.id}>
                    <td className="dk-dim">{when(x.createdAt)}</td>
                    <td>
                      <Link prefetch={false} href={`/admin/accounts?q=${encodeURIComponent(x.user.email)}`}>{x.user.name}</Link>
                    </td>
                    <td>
                      {x.kind}
                      {x.planId ? ` · ${x.planId}` : ""}
                    </td>
                    <td className="dk-wrap">{x.listing ? <Link prefetch={false} href={`/admin/listings?q=${x.listing.id}`}>{x.listing.title}</Link> : "—"}</td>
                    <td className="dk-right" style={{ color: "var(--dk-ochre)", fontWeight: 650 }}>
                      {money(x.amount, x.currency)}
                    </td>
                    <td>
                      <Chip tone={x.status === "pending" ? "warn" : x.status === "failed" ? "bad" : "good"}>{x.status}</Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
