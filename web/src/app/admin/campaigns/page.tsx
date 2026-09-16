import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { createCampaign } from "@/app/admin/_actions/campaigns";
import { CampaignWizard, type AudiencePreset } from "@/components/admin/desk/CampaignWizard";
import { Columns, Gauge, Kpi } from "@/components/admin/desk/charts";
import { DeskHeader } from "@/components/admin/desk/DeskHeader";
import { Icon } from "@/components/admin/desk/Icon";
import { Chip, Empty, Panel, ViewSwitch } from "@/components/admin/desk/parts";
import { CAMPAIGN_TONE, flashOf, qs, readParams, when, type SP } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";
import { nowMs } from "@/lib/admin/metrics";
import { KIND_LABEL, STAGE_LABEL } from "@/lib/crm";
import { audienceWhere, CONTACT_KINDS, CONTACT_STAGES, coerceAudience } from "@/lib/marketing";
import { prisma } from "@/lib/prisma";
import { mailStatus } from "@/lib/v1/mail";

export const metadata = { title: "Email & newsletters — RentLeaks desk" };

const DAY = 86_400_000;

export default async function CampaignsPage({ searchParams }: { searchParams: SP }) {
  await requireAdminPage("/admin/campaigns");
  const p = await readParams(searchParams);
  const t = nowMs();
  const filter = ["draft", "scheduled", "sending", "sent"].includes(p.status) ? p.status : "";
  const presetDefs: Array<Omit<AudiencePreset, "reach">> = [
    { key: "subs", kicker: "Newsletter", title: "All subscribers", kind: "newsletter", kinds: [], stages: [], tags: "", consentOnly: true },
    { key: "hosts-new", kicker: "Highest intent", title: "New host prospects", kind: "outreach", kinds: ["host", "operator"], stages: ["new"], tags: "", consentOnly: false },
    { key: "hosts-warm", kicker: "Recovery", title: "Contacted, not converted", kind: "outreach", kinds: ["host", "operator"], stages: ["contacted", "qualified"], tags: "", consentOnly: false },
    { key: "renters", kicker: "Best potential", title: "Opted-in renters", kind: "bulk", kinds: ["renter"], stages: [], tags: "", consentOnly: true },
  ];
  const [campaigns, templates, cities, subscribers, pending, unsub, sends, reaches] = await Promise.all([
    prisma.campaign.findMany({ where: filter ? { status: filter } : {}, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.emailTemplate.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, purpose: true, subject: true, body: true } }),
    prisma.city.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.contact.count({ where: { marketingConsent: true, confirmToken: null, unsubscribedAt: null } }),
    prisma.contact.count({ where: { confirmToken: { not: null } } }),
    prisma.emailSuppression.count(),
    prisma.campaignSend.findMany({ where: { sentAt: { gte: new Date(t - 30 * DAY) } }, select: { sentAt: true } }),
    Promise.all(presetDefs.map((d) => prisma.contact.count({ where: audienceWhere(coerceAudience(d, d.kind)) as Prisma.ContactWhereInput }))),
  ]);
  const [counts, totals] = await Promise.all([
    prisma.campaign.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.campaign.aggregate({ _sum: { sent: true, failed: true, total: true } }),
  ]);
  const presets: AudiencePreset[] = presetDefs.map((d, i) => ({ ...d, reach: reaches[i] }));
  const mail = mailStatus();
  const providerReady = mail.resend || Boolean(mail.smtp);
  const n = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const sent = totals._sum.sent ?? 0;
  const failed = totals._sum.failed ?? 0;
  const days = Array.from({ length: 30 }, (_, i) => new Date(t - (29 - i) * DAY).toISOString().slice(0, 10));
  const perDay = days.map((d) => ({ label: d.slice(8), value: sends.filter((s) => s.sentAt?.toISOString().slice(0, 10) === d).length }));
  const self = (over: Record<string, string | undefined> = {}) => `/admin/campaigns${qs(p, { ok: undefined, err: undefined, ...over })}`;

  return (
    <div className="dk-stack">
      <DeskHeader
        href="/admin/campaigns"
        flash={flashOf(p)}
        signals={[
          { label: "Subscribers", value: `${subscribers} opted in`, tone: "live" },
          { label: "Going out", value: `${n("sending")} sending · ${n("scheduled")} scheduled`, tone: n("sending") ? "live" : "ok", href: self({ status: "sending" }) },
          { label: "Delivered", value: `${sent.toLocaleString("en-US")} emails`, tone: "ok" },
          { label: "Email provider", value: providerReady ? (mail.resend ? "Resend ready" : "SMTP ready") : "not set up", tone: providerReady ? "ok" : "critical", href: "/admin/system" },
        ]}
        actions={
          <>
            <Link prefetch={false} className="dk-btn dk-btn--onink" href="/admin/outreach?tab=templates">
              <Icon name="mail" size={15} /> Templates
            </Link>
            <Link prefetch={false} className="dk-btn dk-btn--light" href="#new">
              <Icon name="plus" size={15} /> New campaign
            </Link>
          </>
        }
      />
      {!providerReady ? (
        <p className="dk-flash dk-flash--warn">No email provider is connected yet — drafts work, sending waits. Add the Resend key with the deploy script, then send a test from System.</p>
      ) : null}

      <div className="dk-kpis">
        <Kpi label="Subscribers" value={subscribers} sub={`${pending} awaiting confirmation`} href="/admin/crm?consent=yes" tone="good" />
        <Kpi label="Suppressed" value={unsub} sub="unsubscribed or blocked" href="/admin/system#suppress" />
        <Kpi label="Drafts" value={n("draft")} href={self({ status: filter === "draft" ? undefined : "draft" })} active={filter === "draft"} />
        <Kpi label="Scheduled" value={n("scheduled")} href={self({ status: filter === "scheduled" ? undefined : "scheduled" })} active={filter === "scheduled"} />
        <Kpi label="Sending" value={n("sending")} href={self({ status: filter === "sending" ? undefined : "sending" })} active={filter === "sending"} tone="value" />
        <Kpi label="Sent" value={n("sent")} sub={`${failed} failed deliveries`} href={self({ status: filter === "sent" ? undefined : "sent" })} active={filter === "sent"} />
      </div>

      <div className="dk-grid dk-grid--2-1">
        <Panel title="Emails delivered per day" sub="Campaign sends, last 30 days.">
          <Columns rows={perDay} height={140} />
        </Panel>
        <Panel>
          <Gauge pct={sent + failed ? (sent / (sent + failed)) * 100 : 0} label="Delivery rate" sub={`${sent.toLocaleString("en-US")} delivered · ${failed} failed`} />
        </Panel>
      </div>

      <Panel id="new" kicker="Bulk messaging" title="New campaign" sub="Three steps: who gets it, what it says, and a check before the draft is saved. Sending is confirmed on the next screen.">
        <CampaignWizard
          action={createCampaign}
          templates={templates}
          cities={cities.map((c) => ({ value: c.id, label: c.name }))}
          kinds={CONTACT_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))}
          stages={CONTACT_STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }))}
          presets={presets}
          providerReady={providerReady}
          initialTemplateId={p.template}
        />
      </Panel>

      <Panel
        flush
        title="Campaigns"
        actions={
          <ViewSwitch
            label="Status"
            items={[
              { key: "", label: "All", href: self({ status: undefined }), on: !filter },
              { key: "draft", label: "Drafts", href: self({ status: "draft" }), on: filter === "draft" },
              { key: "scheduled", label: "Scheduled", href: self({ status: "scheduled" }), on: filter === "scheduled" },
              { key: "sending", label: "Sending", href: self({ status: "sending" }), on: filter === "sending" },
              { key: "sent", label: "Sent", href: self({ status: "sent" }), on: filter === "sent" },
            ]}
          />
        }
      >
        {campaigns.length === 0 ? (
          <div style={{ padding: 20 }}>
            <Empty title={filter ? `No ${filter} campaigns.` : "No campaigns yet."}>Start one above — a newsletter to subscribers, an announcement, or an outreach wave to host prospects.</Empty>
          </div>
        ) : (
          <div className="dk-tablewrap">
            <table className="dk-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Kind</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th className="dk-right">Failed</th>
                  <th className="dk-right">When</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const pct = c.total ? Math.round((c.sent / c.total) * 100) : 0;
                  return (
                    <tr key={c.id}>
                      <td className="dk-wrap">
                        <Link prefetch={false} href={`/admin/campaigns/${c.id}`}>
                          <b>{c.name}</b>
                        </Link>
                        <div className="dk-dim">{c.subject}</div>
                      </td>
                      <td>
                        <Chip tone={c.kind === "newsletter" ? "good" : c.kind === "outreach" ? "brand" : "ink"}>{c.kind}</Chip>
                      </td>
                      <td>
                        <Chip tone={(CAMPAIGN_TONE[c.status] || "ink") as "brand"}>{c.status}</Chip>
                      </td>
                      <td style={{ minWidth: 160 }}>
                        {c.total ? (
                          <>
                            <span className="dk-rank__track" style={{ display: "block" }}>
                              <span className="dk-rank__fill" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #1c5b69, #7cc6d3)" }} />
                            </span>
                            <span className="dk-dim">
                              {c.sent} / {c.total} · {pct}%
                            </span>
                          </>
                        ) : (
                          <span className="dk-dim">—</span>
                        )}
                      </td>
                      <td className={`dk-right${c.failed ? " dk-bad" : ""}`}>{c.failed || "—"}</td>
                      <td className="dk-right dk-dim">{when(c.finishedAt || c.startedAt || c.scheduledAt || c.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
