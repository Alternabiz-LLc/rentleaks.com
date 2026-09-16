import Link from "next/link";
import { createCampaign } from "@/app/admin/_actions/campaigns";
import { AudienceFields } from "@/components/admin/AudienceFields";
import { CAMPAIGN_TONE as TONE, Empty, flashOf, PageHead, Pill, readParams, Section, Stats, when, type SP } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { mailStatus } from "@/lib/v1/mail";

export const metadata = { title: "Email & newsletters — RentLeaks admin" };

export default async function CampaignsPage({ searchParams }: { searchParams: SP }) {
  await requireAdminPage();
  const p = await readParams(searchParams);
  const [campaigns, templates, cities, subscribers, pending, unsub] = await Promise.all([
    prisma.campaign.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.emailTemplate.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, purpose: true } }),
    prisma.city.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.contact.count({ where: { marketingConsent: true, confirmToken: null, unsubscribedAt: null } }),
    prisma.contact.count({ where: { confirmToken: { not: null } } }),
    prisma.emailSuppression.count(),
  ]);
  const mail = mailStatus();

  return (
    <>
      <PageHead
        title="Email & newsletters"
        sub="Newsletters to subscribers, announcements to accounts and outreach waves. Every email carries an unsubscribe link and your mailing address; the outbox sends them in paced batches."
        flash={flashOf(p)}
      />
      {!mail.resend && !mail.smtp ? (
        <p className="adm-flash adm-flash--err">No email provider is configured yet — drafts work, sending doesn&rsquo;t. See Admin → System.</p>
      ) : null}
      <Stats
        items={[
          { k: "Subscribers", v: subscribers, s: `${pending} awaiting confirmation` },
          { k: "Unsubscribed / suppressed", v: unsub },
          { k: "Campaigns", v: campaigns.length, s: `${campaigns.filter((c) => c.status === "sending").length} sending now` },
          { k: "Sign-up form", v: "API", s: "POST /api/newsletter from rentleaks.com" },
        ]}
      />

      <Section title="Campaigns">
        {campaigns.length === 0 ? (
          <Empty>No campaigns yet — create the first one below.</Empty>
        ) : (
          <div className="a-scroll">
            <table className="a-table adm-table">
              <thead>
                <tr><th>Name</th><th>Kind</th><th>Status</th><th>Sent</th><th>Failed</th><th>When</th></tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td className="adm-wrap"><Link href={`/admin/campaigns/${c.id}`}>{c.name}</Link><div className="a-dim">{c.subject}</div></td>
                    <td>{c.kind}</td>
                    <td><Pill tone={TONE[c.status]}>{c.status}</Pill></td>
                    <td>{c.sent}{c.total ? ` / ${c.total}` : ""}</td>
                    <td className={c.failed ? "a-bad" : undefined}>{c.failed || "—"}</td>
                    <td>{when(c.finishedAt || c.startedAt || c.scheduledAt || c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="New campaign" sub="Starts as a draft. You'll see a preview and the exact audience size before anything is sent.">
        <form action={createCampaign} className="adm-form">
          <div className="adm-row">
            <label>
              Kind
              <select name="kind" defaultValue="newsletter">
                <option value="newsletter">Newsletter (opted-in subscribers)</option>
                <option value="bulk">Announcement / bulk message</option>
                <option value="outreach">Outreach wave (prospects)</option>
              </select>
            </label>
            <label>
              Start from template
              <select name="templateId" defaultValue="">
                <option value="">— blank —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.purpose})</option>
                ))}
              </select>
            </label>
          </div>
          <label>Internal name<input name="name" placeholder="October newsletter" /></label>
          <label>Subject<input name="subject" placeholder="Leave empty to use the template's" /></label>
          <label>
            Message
            <textarea name="body" rows={6} placeholder={"# Heading\n\nHi {{first_name}},\n\n- bullet\n\n[Button text](https://rentleaks.com)\n\nLeave empty to use the template's."} />
          </label>
          <AudienceFields cities={cities} />
          <button className="btn btn--primary">Create draft</button>
          <small className="a-dim">
            Formatting: blank line = paragraph · “- ” bullets · “# ” heading · **bold** · [link](https://…). Merge fields: {"{{first_name}} {{name}} {{city}} {{app_url}}"}.{" "}
            <Link href="/admin/outreach">Manage templates</Link>
          </small>
        </form>
      </Section>
    </>
  );
}
