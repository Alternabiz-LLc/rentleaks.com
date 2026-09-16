import Link from "next/link";
import { deleteTemplate, loadStarterTemplates, saveTemplate } from "@/app/admin/_actions/campaigns";
import { Empty, flashOf, PageHead, Pill, readParams, Section, Stats, when, type SP } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";
import { KIND_LABEL } from "@/lib/crm";
import { prisma } from "@/lib/prisma";
import { mailStatus } from "@/lib/v1/mail";

export const metadata = { title: "Outreach — RentLeaks admin" };

export default async function OutreachPage({ searchParams }: { searchParams: SP }) {
  await requireAdminPage();
  const p = await readParams(searchParams);
  const now = new Date();
  const [templates, due, prospects, contactedWeek, editing] = await Promise.all([
    prisma.emailTemplate.findMany({ orderBy: [{ purpose: "asc" }, { name: "asc" }] }),
    prisma.contact.findMany({ where: { nextFollowUpAt: { lte: now } }, orderBy: { nextFollowUpAt: "asc" }, take: 30 }),
    prisma.contact.groupBy({ by: ["kind"], where: { kind: { in: ["host", "operator", "partner"] }, stage: { in: ["new", "contacted", "qualified"] } }, _count: { _all: true } }),
    prisma.contactActivity.count({ where: { kind: { in: ["email", "call", "sms", "meeting"] }, createdAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } } }),
    p.edit ? prisma.emailTemplate.findUnique({ where: { id: p.edit } }) : null,
  ]);
  const mail = mailStatus();
  const open = (k: string) => prospects.find((x) => x.kind === k)?._count._all ?? 0;

  return (
    <>
      <PageHead
        title="Outreach"
        sub="Recruit hosts and operators: templates, follow-ups due, and one-to-one or wave sends. One-to-one emails go from your own mailbox when SMTP is set up."
        flash={flashOf(p)}
      >
        <Link className="btn btn--outline" href="/admin/crm?kind=host&stage=new">New host prospects</Link>
        <Link className="btn btn--primary" href="/admin/campaigns">Start an outreach wave</Link>
      </PageHead>
      <Stats
        items={[
          { k: "Open host prospects", v: <Link href="/admin/crm?kind=host">{open("host")}</Link> },
          { k: "Open operator prospects", v: <Link href="/admin/crm?kind=operator">{open("operator")}</Link> },
          { k: "Touches this week", v: contactedWeek, s: "emails, calls, texts, meetings" },
          { k: "Your mailbox", v: mail.smtp ? "Connected" : "Not set", s: mail.smtp || "SMTP_HOST / SMTP_USER / SMTP_PASS" },
        ]}
      />

      <div className="a-cols">
        <Section title={`Follow-ups due · ${due.length}`}>
          {due.length === 0 ? (
            <Empty>Nothing due. Set follow-up dates on contacts to see them here.</Empty>
          ) : (
            <ul className="adm-list">
              {due.map((c) => (
                <li key={c.id}>
                  <Link href={`/admin/crm/${c.id}`}><b>{c.name || c.email}</b></Link> · {KIND_LABEL[c.kind] || c.kind} · <Pill>{c.stage}</Pill>{" "}
                  <span className="a-bad">due {when(c.nextFollowUpAt, false)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={editing ? "Edit template" : "New template"} sub="Merge fields: {{first_name}} {{name}} {{city}} {{app_url}} {{invite_link}} {{days}}">
          <form action={saveTemplate} className="adm-form">
            <input type="hidden" name="id" value={editing?.id ?? ""} />
            <div className="adm-row">
              <label>Name<input name="name" defaultValue={editing?.name} required /></label>
              <label>
                Used for
                <select name="purpose" defaultValue={editing?.purpose ?? "outreach"}>
                  <option value="outreach">Outreach</option>
                  <option value="newsletter">Newsletter</option>
                  <option value="bulk">Announcement</option>
                  <option value="trial">Trial invite</option>
                </select>
              </label>
            </div>
            <label>Subject<input name="subject" defaultValue={editing?.subject} required /></label>
            <label>Body<textarea name="body" rows={10} defaultValue={editing?.body} required /></label>
            <div className="adm-row">
              <button className="btn btn--primary">Save template</button>
              {editing ? <Link className="btn btn--ghost" href="/admin/outreach">Cancel</Link> : null}
            </div>
          </form>
        </Section>
      </div>

      <Section title={`Templates · ${templates.length}`}>
        {templates.length === 0 ? (
          <form action={loadStarterTemplates} className="adm-inline">
            <Empty>No templates yet.</Empty>
            <button className="btn btn--primary">Load 6 starter templates</button>
          </form>
        ) : (
          <>
            <table className="a-table adm-table">
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id}>
                    <td><Pill>{t.purpose}</Pill></td>
                    <td className="adm-wrap"><b>{t.name}</b><div className="a-dim">{t.subject}</div></td>
                    <td>{when(t.updatedAt, false)}</td>
                    <td><Link href={`/admin/outreach?edit=${t.id}`}>Edit</Link></td>
                    <td>
                      <form action={deleteTemplate}>
                        <input type="hidden" name="id" value={t.id} />
                        <button className="btn btn--ghost">Delete</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <form action={loadStarterTemplates} className="adm-inline">
              <button className="btn btn--ghost">Add any missing starter templates</button>
            </form>
          </>
        )}
      </Section>
    </>
  );
}
