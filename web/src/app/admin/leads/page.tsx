import Link from "next/link";
import LeadsInbox from "@/components/LeadsInbox";
import { Bars, PageHead, Section, Stats } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";
import { nowMs } from "@/lib/admin/metrics";
import { loadLeads } from "@/lib/admin/leads";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Leads — RentLeaks admin" };

export default async function LeadsPage() {
  await requireAdminPage();
  const leads = await loadLeads();
  const since = new Date(nowMs() - 30 * 86_400_000);
  const [bySource, byStatus, answered] = await Promise.all([
    prisma.lead.groupBy({ by: ["source"], where: { createdAt: { gte: since } }, _count: { _all: true } }).catch(() => []),
    prisma.lead.groupBy({ by: ["status"], _count: { _all: true } }).catch(() => []),
    prisma.lead
      .findMany({ where: { contactedAt: { not: null }, createdAt: { gte: since } }, select: { createdAt: true, contactedAt: true } })
      .catch(() => []),
  ]);
  const hours = answered.map((l) => (l.contactedAt!.getTime() - l.createdAt.getTime()) / 3_600_000).sort((a, b) => a - b);
  const median = hours.length ? hours[Math.floor(hours.length / 2)] : null;
  const count = (s: string) => byStatus.find((b) => b.status === s)?._count._all ?? 0;
  const total = byStatus.reduce((n, b) => n + b._count._all, 0);

  return (
    <>
      <PageHead
        title="Leads"
        sub="Requests from the Facebook landing page and the other public forms. Reply within a day — a renter who waits books elsewhere."
      >
        <Link className="btn btn--outline" href="/api/admin/export/leads">Export CSV</Link>
      </PageHead>
      <Stats
        items={[
          { k: "New", v: count("new"), s: `${total} all time` },
          { k: "Contacted", v: count("contacted") },
          { k: "Booked", v: count("booked"), s: total ? `${Math.round((count("booked") / total) * 100)}% of all leads` : undefined },
          { k: "Median reply", v: median === null ? "—" : median < 1 ? "<1h" : `${Math.round(median)}h`, s: "last 30 days" },
        ]}
      />
      {leads ? (
        <LeadsInbox leads={leads} />
      ) : (
        <p className="v-note">The leads table isn&rsquo;t in this database yet. Run <code>npx prisma migrate deploy</code> in web/.</p>
      )}
      <Section title="Where leads come from" sub="Last 30 days, by the source the landing page recorded.">
        <Bars rows={bySource.map((b) => ({ label: b.source, value: b._count._all })).sort((a, b) => b.value - a.value)} />
      </Section>
    </>
  );
}
