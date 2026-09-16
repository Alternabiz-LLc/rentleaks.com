import Link from "next/link";
import { Bars, Empty, PageHead, Pill, Section, Stats, when } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";
import { bucketWeeks, lastWeeks, monthKey, recurringMonthly } from "@/lib/admin/metrics";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Revenue & analytics — RentLeaks admin" };

const money = (cents: number, currency = "usd") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: 0 }).format(cents / 100);

export default async function RevenueAdmin() {
  await requireAdminPage();
  const now = new Date();
  const weeks = lastWeeks(12, now);
  const since = new Date(`${weeks[0]}T00:00:00Z`);
  const [payments, listings, signups, leads, newListings, stages, trials, campaigns, ads] = await Promise.all([
    prisma.payment.findMany({
      include: { user: { select: { name: true, email: true } }, listing: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.listing.findMany({ select: { status: true, housingType: true, plan: true, sponsored: true } }),
    prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, role: true } }),
    prisma.lead.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, status: true, source: true, campaign: true } }),
    prisma.listing.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.contact.groupBy({ by: ["stage"], _count: { _all: true } }),
    prisma.trialInvite.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.campaign.aggregate({ _sum: { sent: true, failed: true }, _count: { _all: true } }),
    prisma.adCampaign.findMany({ select: { name: true, utmCampaign: true, spend: true, currency: true } }),
  ]);

  const paid = payments.filter((p) => p.status === "paid" || p.status === "succeeded" || p.status === "complete");
  const byMonth = new Map<string, number>();
  for (const p of paid) byMonth.set(monthKey(p.createdAt), (byMonth.get(monthKey(p.createdAt)) || 0) + p.amount);
  const thisMonth = byMonth.get(monthKey(now)) || 0;
  const lifetime = paid.reduce((n, p) => n + p.amount, 0);
  const byKind = new Map<string, number>();
  for (const p of paid) byKind.set(p.kind, (byKind.get(p.kind) || 0) + p.amount);
  const recurring = recurringMonthly(listings);

  const signupWeeks = bucketWeeks(signups.map((s) => s.createdAt), weeks);
  const leadWeeks = bucketWeeks(leads.map((l) => l.createdAt), weeks);
  const listingWeeks = bucketWeeks(newListings.map((l) => l.createdAt), weeks);
  const leadStatus = (s: string) => leads.filter((l) => l.status === s).length;
  const trialCount = (s: string) => trials.find((t) => t.status === s)?._count._all ?? 0;
  const invited = trials.reduce((n, t) => n + t._count._all, 0);
  const adSpend = ads.reduce((n, a) => n + a.spend, 0);
  const adLeads = leads.filter((l) => l.campaign && ads.some((a) => a.utmCampaign === l.campaign)).length;

  return (
    <>
      <PageHead title="Revenue & analytics" sub="Payments recorded by checkout, recurring revenue at posted rates, and the growth funnel for the last 12 weeks.">
        <Link className="btn btn--outline" href="/api/admin/export/payments">Payments CSV</Link>
        <Link className="btn btn--outline" href="/api/admin/export/contacts">Contacts CSV</Link>
      </PageHead>
      <Stats
        items={[
          { k: "Collected this month", v: money(thisMonth), s: `${money(lifetime)} lifetime` },
          { k: "Recurring (posted rates)", v: `$${Math.round(recurring).toLocaleString("en-US")}`, s: "per month if every live listing pays" },
          { k: "Pending payments", v: payments.filter((p) => p.status === "pending").length },
          { k: "Ad spend", v: `$${adSpend.toLocaleString("en-US")}`, s: adLeads ? `$${Math.round(adSpend / adLeads)} per lead` : "no attributed leads yet" },
        ]}
      />

      <div className="a-cols">
        <Section title="Collected by month">
          <Bars rows={[...byMonth.entries()].sort().slice(-12).map(([m, v]) => ({ label: m, value: Math.round(v / 100) }))} unit="$" />
        </Section>
        <Section title="Collected by product">
          <Bars rows={[...byKind.entries()].map(([k, v]) => ({ label: k, value: Math.round(v / 100) }))} unit="$" />
        </Section>
      </div>

      <div className="a-cols">
        <Section title="New accounts per week">
          <Bars rows={signupWeeks.map((w) => ({ label: w.week.slice(5), value: w.count }))} />
        </Section>
        <Section title="Leads per week">
          <Bars rows={leadWeeks.map((w) => ({ label: w.week.slice(5), value: w.count }))} />
        </Section>
        <Section title="New listings per week">
          <Bars rows={listingWeeks.map((w) => ({ label: w.week.slice(5), value: w.count }))} />
        </Section>
      </div>

      <div className="a-cols">
        <Section title="Lead funnel (12 weeks)">
          <Bars
            rows={[
              { label: "Received", value: leads.length },
              { label: "Contacted+", value: leadStatus("contacted") + leadStatus("booked") + leadStatus("closed") },
              { label: "Booked", value: leadStatus("booked") },
            ]}
          />
        </Section>
        <Section title="CRM pipeline">
          <Bars rows={["new", "contacted", "qualified", "customer", "lost"].map((s) => ({ label: s, value: stages.find((x) => x.stage === s)?._count._all ?? 0 }))} />
        </Section>
        <Section title="Growth programs">
          <Bars
            rows={[
              { label: "Trial invites", value: invited },
              { label: "Trials redeemed", value: trialCount("redeemed"), hint: invited ? `${Math.round((trialCount("redeemed") / invited) * 100)}%` : "" },
              { label: "Campaigns", value: campaigns._count._all },
              { label: "Emails sent", value: campaigns._sum.sent ?? 0 },
            ]}
          />
        </Section>
      </div>

      <Section title="Latest payments">
        {payments.length === 0 ? (
          <Empty>No payments yet. They appear here once checkout (Stripe) is switched on.</Empty>
        ) : (
          <div className="a-scroll">
            <table className="a-table">
              <thead>
                <tr><th>Date</th><th>Account</th><th>Product</th><th>Listing</th><th>Amount</th><th>Status</th></tr>
              </thead>
              <tbody>
                {payments.slice(0, 50).map((p) => (
                  <tr key={p.id}>
                    <td>{when(p.createdAt)}</td>
                    <td><Link href={`/admin/accounts?q=${encodeURIComponent(p.user.email)}`}>{p.user.name}</Link></td>
                    <td>{p.kind}{p.planId ? ` · ${p.planId}` : ""}</td>
                    <td className="adm-wrap">{p.listing ? <Link href={`/listings/${p.listing.id}`}>{p.listing.title}</Link> : "—"}</td>
                    <td>{money(p.amount, p.currency)}</td>
                    <td><Pill tone={p.status === "pending" ? "warn" : p.status === "failed" ? "bad" : "good"}>{p.status}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
