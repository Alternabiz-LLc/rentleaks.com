import Link from "next/link";
import { notFound } from "next/navigation";
import { duplicateCampaign, scheduleCampaign, testCampaign, updateCampaign } from "@/app/admin/_actions/campaigns";
import { AudienceFields } from "@/components/admin/AudienceFields";
import { CAMPAIGN_TONE, flashOf, PageHead, Pill, readParams, Section, Stats, when, type SP } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";
import { nowMs } from "@/lib/admin/metrics";
import { audienceWhere, coerceAudience, describeAudience, mergeFields, renderEmail } from "@/lib/marketing";
import { CAMPAIGN_REASON, mailingAddress } from "@/lib/outbox";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/site";

export const metadata = { title: "Campaign — RentLeaks admin" };

export default async function CampaignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const me = await requireAdminPage();
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

  return (
    <>
      <PageHead title={c.name} sub={<>{c.kind} · <Pill tone={CAMPAIGN_TONE[c.status]}>{c.status}</Pill> · created {when(c.createdAt)}</>} flash={flashOf(p)}>
        <Link className="btn btn--ghost" href="/admin/campaigns">← Campaigns</Link>
        <form action={duplicateCampaign}>
          <input type="hidden" name="id" value={c.id} />
          <button className="btn btn--outline">Duplicate</button>
        </form>
        {c.total ? <Link className="btn btn--outline" href={`/api/admin/export/campaign?id=${c.id}`}>Recipients CSV</Link> : null}
      </PageHead>

      <Stats
        items={[
          { k: editable ? "Will reach" : "Recipients", v: editable ? reach : c.total, s: describeAudience(audience) },
          { k: "Sent", v: count("sent") },
          { k: "Queued", v: count("queued") },
          { k: "Failed / skipped", v: `${count("failed")} / ${count("skipped")}` },
          { k: "Schedule", v: c.scheduledAt ? when(c.scheduledAt) : "—", s: c.finishedAt ? `finished ${when(c.finishedAt)}` : c.startedAt ? `started ${when(c.startedAt)}` : "UTC" },
        ]}
      />
      {failures.length ? (
        <p className="adm-flash adm-flash--err">
          Failures: {failures.map((f) => `${f.email} (${f.error})`).join(" · ")}
        </p>
      ) : null}

      <div className="a-cols">
        <Section title={editable ? "Edit" : "Content"}>
          <form action={updateCampaign} className="adm-form">
            <input type="hidden" name="id" value={c.id} />
            <div className="adm-row">
              <label>Name<input name="name" defaultValue={c.name} disabled={!editable} /></label>
              <label>
                Kind
                <select name="kind" defaultValue={c.kind} disabled={!editable}>
                  <option value="newsletter">Newsletter</option>
                  <option value="bulk">Announcement / bulk</option>
                  <option value="outreach">Outreach wave</option>
                </select>
              </label>
            </div>
            <label>Subject<input name="subject" defaultValue={c.subject} disabled={!editable} /></label>
            <label>Message<textarea name="body" rows={14} defaultValue={c.body} disabled={!editable} /></label>
            <AudienceFields audience={audience} cities={cities} kind={c.kind} />
            {editable ? <button className="btn btn--primary">Save draft</button> : null}
          </form>
        </Section>

        <Section title="Preview" sub={<>Subject: <b>{mergeFields(c.subject, { name: me.name, city: "New York" })}</b></>}>
          <iframe className="adm-preview" title="Email preview" sandbox="" srcDoc={preview.html} />
          <form action={testCampaign} className="adm-inline">
            <input type="hidden" name="id" value={c.id} />
            <input name="to" type="email" defaultValue={me.email} aria-label="Send test to" />
            <button className="btn btn--outline">Send me a test</button>
          </form>

          {editable ? (
            <div className="adm-card adm-send">
              <h3 className="adm-h3">Send</h3>
              {!address ? <p className="adm-flash adm-flash--err">Add your mailing address in Admin → System before sending.</p> : null}
              <form action={scheduleCampaign} className="adm-form">
                <input type="hidden" name="id" value={c.id} />
                <label>Type SEND to confirm<input name="confirm" autoComplete="off" /></label>
                <div className="adm-row">
                  <button className="btn btn--primary" name="op" value="now">Send now to {reach}</button>
                </div>
                <div className="adm-row">
                  <label>…or at (UTC)<input name="at" type="datetime-local" defaultValue={soon} /></label>
                  <button className="btn btn--outline" name="op" value="schedule">Schedule</button>
                </div>
              </form>
            </div>
          ) : null}
          {c.status === "scheduled" || c.status === "sending" ? (
            <form action={scheduleCampaign} className="adm-inline">
              <input type="hidden" name="id" value={c.id} />
              {c.status === "sending" ? <button className="btn btn--outline" name="op" value="batch">Send next batch now</button> : null}
              <button className="btn btn--danger" name="op" value="cancel">{c.status === "scheduled" ? "Unschedule" : "Stop sending"}</button>
            </form>
          ) : null}
        </Section>
      </div>
    </>
  );
}
