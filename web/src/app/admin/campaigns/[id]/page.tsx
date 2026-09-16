import Link from "next/link";
import { notFound } from "next/navigation";
import { duplicateCampaign, scheduleCampaign, testCampaign, updateCampaign } from "@/app/admin/_actions/campaigns";
import { AudienceFields } from "@/components/admin/AudienceFields";
import { Kpi } from "@/components/admin/desk/charts";
import { DeskHeader } from "@/components/admin/desk/DeskHeader";
import { Icon } from "@/components/admin/desk/Icon";
import { Chip, Panel, Steps } from "@/components/admin/desk/parts";
import { CAMPAIGN_TONE, flashOf, readParams, when, type SP } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";
import { nowMs } from "@/lib/admin/metrics";
import { audienceWhere, coerceAudience, describeAudience, mergeFields, renderEmail } from "@/lib/marketing";
import { CAMPAIGN_REASON, mailingAddress } from "@/lib/outbox";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/site";

export const metadata = { title: "Campaign — RentLeaks desk" };

export default async function CampaignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const me = await requireAdminPage("/admin/campaigns");
  const { id } = await params;
  const p = await readParams(searchParams);
  const c = await prisma.campaign.findUnique({ where: { id } });
  if (!c) notFound();
  const audience = coerceAudience(c.audience, c.kind);
  const editable = c.status === "draft" || c.status === "scheduled";
  const [reach, cities, counts, failures, address] = await Promise.all([
    prisma.contact.count({ where: audienceWhere(audience) }),
    prisma.city.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.campaignSend.groupBy({ by: ["status"], where: { campaignId: id }, _count: { _all: true } }),
    prisma.campaignSend.findMany({ where: { campaignId: id, status: "failed" }, take: 10, select: { email: true, error: true } }),
    mailingAddress(),
  ]);
  const count = (s: string) => counts.find((x) => x.status === s)?._count._all ?? 0;
  const preview = renderEmail(
    mergeFields(c.body, { name: me.name, email: me.email, city: "New York", app_url: appUrl(), unsubscribe_link: `${appUrl()}/u/preview` }),
    { address: address || "⚠ mailing address not set (Admin → System)", reason: CAMPAIGN_REASON[c.kind] || CAMPAIGN_REASON.bulk, unsubscribeUrl: `${appUrl()}/u/preview` },
  );
  const soon = new Date(nowMs() + 3_600_000).toISOString().slice(0, 16);

  const stepState = (i: number): "done" | "on" | "todo" => {
    const at = c.status === "draft" ? 1 : c.status === "scheduled" || c.status === "sending" ? 2 : 3;
    return i < at ? "done" : i === at ? "on" : "todo";
  };

  return (
    <div className="dk-stack">
      <DeskHeader
        href="/admin/campaigns"
        compact
        crumbs={[{ label: c.name }]}
        title={c.name}
        flash={flashOf(p)}
        signals={[
          { label: "Status", value: c.status, tone: c.status === "sending" ? "live" : c.status === "cancelled" ? "warn" : "ok" },
          { label: editable ? "Will reach" : "Recipients", value: `${(editable ? reach : c.total).toLocaleString("en-US")}`, tone: "live" },
          { label: "Sent", value: `${count("sent")} · ${count("queued")} queued`, tone: "ok" },
          { label: "Schedule (UTC)", value: c.scheduledAt ? when(c.scheduledAt) : "—", tone: "ok" },
        ]}
        actions={
          <>
            <form action={duplicateCampaign}>
              <input type="hidden" name="id" value={c.id} />
              <button className="dk-btn dk-btn--onink">
                <Icon name="copy" size={15} /> Duplicate
              </button>
            </form>
            {c.total ? (
              <Link prefetch={false} className="dk-btn dk-btn--onink" href={`/api/admin/export/campaign?id=${c.id}`}>
                <Icon name="export" size={15} /> Recipients CSV
              </Link>
            ) : null}
          </>
        }
      />

      <Steps
        steps={[
          { label: "Audience & content", state: stepState(0) },
          { label: "Draft review", state: stepState(1) },
          { label: "Sending", state: stepState(2) },
          { label: "Done", state: stepState(3) },
        ]}
      />

      <div className="dk-kpis">
        <Kpi label={editable ? "Will reach" : "Recipients"} value={editable ? reach : c.total} sub={describeAudience(audience)} />
        <Kpi label="Sent" value={count("sent")} tone="good" />
        <Kpi label="Queued" value={count("queued")} tone="value" />
        <Kpi label="Failed" value={count("failed")} tone={count("failed") ? "alert" : undefined} />
        <Kpi label="Skipped" value={count("skipped")} sub="unsubscribed since" />
      </div>
      {failures.length ? (
        <p className="dk-flash dk-flash--err">
          Failures: {failures.map((f) => `${f.email} (${f.error})`).join(" · ")}
        </p>
      ) : null}

      <div className="dk-grid dk-grid--2">
        <Panel kicker={c.kind} title={editable ? "Edit" : "Content"} actions={<Chip tone={(CAMPAIGN_TONE[c.status] || "ink") as "brand"}>{c.status}</Chip>}>
          <form action={updateCampaign} className="dk-form">
            <input type="hidden" name="id" value={c.id} />
            <label className="dk-field">
              <span>Name</span>
              <input name="name" defaultValue={c.name} disabled={!editable} />
            </label>
            <label className="dk-field">
              <span>Kind</span>
              <select name="kind" defaultValue={c.kind} disabled={!editable}>
                <option value="newsletter">Newsletter</option>
                <option value="bulk">Announcement / bulk</option>
                <option value="outreach">Outreach wave</option>
              </select>
            </label>
            <label className="dk-field dk-field--wide">
              <span>Subject</span>
              <input name="subject" defaultValue={c.subject} disabled={!editable} />
            </label>
            <label className="dk-field dk-field--wide">
              <span>Message</span>
              <textarea name="body" rows={14} defaultValue={c.body} disabled={!editable} />
            </label>
            <div className="dk-field--wide">
              <AudienceFields audience={audience} cities={cities} kind={c.kind} />
            </div>
            {editable ? <button className="dk-btn dk-btn--primary">Save draft</button> : null}
          </form>
        </Panel>

        <div className="dk-stack">
          <Panel title="Preview" sub={<>Subject: <b>{mergeFields(c.subject, { name: me.name, city: "New York" })}</b></>}>
            <div className="dk-mail">
              <iframe title="Email preview" sandbox="" srcDoc={preview.html} />
            </div>
            <form action={testCampaign} className="dk-inline">
              <input type="hidden" name="id" value={c.id} />
              <input name="to" type="email" defaultValue={me.email} aria-label="Send test to" />
              <button className="dk-btn">
                <Icon name="mail" size={14} /> Send me a test
              </button>
            </form>
          </Panel>

          {editable ? (
            <Panel kicker="Step 3" title="Send">
              {!address ? <p className="dk-flash dk-flash--err">Add your mailing address in System before sending.</p> : null}
              <form action={scheduleCampaign} className="dk-form">
                <input type="hidden" name="id" value={c.id} />
                <label className="dk-field dk-field--wide">
                  <span>Type SEND to confirm</span>
                  <input name="confirm" autoComplete="off" placeholder="SEND" />
                </label>
                <button className="dk-btn dk-btn--primary" name="op" value="now">
                  Send now to {reach.toLocaleString("en-US")}
                </button>
                <label className="dk-field">
                  <span>…or at (UTC)</span>
                  <input name="at" type="datetime-local" defaultValue={soon} />
                </label>
                <div className="dk-field" style={{ alignSelf: "end" }}>
                  <button className="dk-btn" name="op" value="schedule">
                    <Icon name="clock" size={14} /> Schedule
                  </button>
                </div>
              </form>
            </Panel>
          ) : null}
          {c.status === "scheduled" || c.status === "sending" ? (
            <Panel title="Controls">
              <form action={scheduleCampaign} className="dk-inline">
                <input type="hidden" name="id" value={c.id} />
                {c.status === "sending" ? (
                  <button className="dk-btn" name="op" value="batch">
                    Send next batch now
                  </button>
                ) : null}
                <button className="dk-btn dk-btn--danger" name="op" value="cancel">
                  {c.status === "scheduled" ? "Unschedule" : "Stop sending"}
                </button>
              </form>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
