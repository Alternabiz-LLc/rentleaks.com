import Link from "next/link";
import { notFound } from "next/navigation";
import { addActivity, deleteContact, emailContact, updateContact } from "@/app/admin/_actions/crm";
import { flashOf, PageHead, Pill, readParams, Section, when, type SP } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";
import { KIND_LABEL, STAGE_LABEL } from "@/lib/crm";
import { CONTACT_KINDS, CONTACT_STAGES, parseTags } from "@/lib/marketing";
import { prisma } from "@/lib/prisma";
import { mailStatus } from "@/lib/v1/mail";

export const metadata = { title: "Contact — RentLeaks admin" };

const ICON: Record<string, string> = {
  note: "✎", email: "✉", call: "☎", sms: "💬", meeting: "◷", stage: "→", lead: "★", campaign: "✉", trial: "🎟", signup: "＋",
};

export default async function ContactPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  await requireAdminPage();
  const { id } = await params;
  const p = await readParams(searchParams);
  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      activities: { orderBy: { createdAt: "desc" }, take: 100 },
      user: { select: { id: true, role: true, trialEndsAt: true, suspendedAt: true, _count: { select: { listings: true } } } },
      sends: { include: { campaign: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!contact) notFound();
  const [leads, invites, templates, cities] = await Promise.all([
    prisma.lead.findMany({ where: { email: contact.email }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.trialInvite.findMany({ where: { email: contact.email }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.emailTemplate.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, purpose: true } }),
    prisma.city.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const mail = mailStatus();
  const consented = contact.marketingConsent && !contact.confirmToken && !contact.unsubscribedAt;
  const d = (x: Date | null) => (x ? x.toISOString().slice(0, 10) : "");

  return (
    <>
      <PageHead
        title={contact.name || contact.email}
        sub={
          <>
            {contact.email}
            {contact.phone ? ` · ${contact.phone}` : ""} · {KIND_LABEL[contact.kind] || contact.kind} · added {when(contact.createdAt, false)} from {contact.source}
          </>
        }
        flash={flashOf(p)}
      >
        <Link className="btn btn--ghost" href="/admin/crm">← All contacts</Link>
        <a className="btn btn--outline" href={`mailto:${contact.email}`}>Open in mail app</a>
        {contact.phone ? <a className="btn btn--outline" href={`tel:${contact.phone}`}>Call</a> : null}
      </PageHead>

      <div className="a-cols">
        <Section title="Details">
          <form action={updateContact} className="adm-form">
            <input type="hidden" name="id" value={contact.id} />
            <div className="adm-row">
              <label>Name<input name="name" defaultValue={contact.name} /></label>
              <label>Phone<input name="phone" defaultValue={contact.phone ?? ""} /></label>
            </div>
            <div className="adm-row">
              <label>Company<input name="company" defaultValue={contact.company ?? ""} /></label>
              <label>
                City
                <select name="cityId" defaultValue={contact.cityId ?? ""}>
                  <option value="">—</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="adm-row">
              <label>
                Kind
                <select name="kind" defaultValue={contact.kind}>
                  {CONTACT_KINDS.map((k) => (
                    <option key={k} value={k}>{KIND_LABEL[k]}</option>
                  ))}
                </select>
              </label>
              <label>
                Stage
                <select name="stage" defaultValue={contact.stage}>
                  {CONTACT_STAGES.map((s) => (
                    <option key={s} value={s}>{STAGE_LABEL[s]}</option>
                  ))}
                </select>
              </label>
              <label>Follow up on<input name="followUp" type="date" defaultValue={d(contact.nextFollowUpAt)} /></label>
            </div>
            <label>Tags<input name="tags" defaultValue={parseTags(contact.tags).join(", ")} /></label>
            <label>Private note<textarea name="note" rows={3} defaultValue={contact.note ?? ""} /></label>
            <fieldset className="adm-fieldset">
              <label className="adm-check">
                <input type="checkbox" name="consent" defaultChecked={consented} /> Opted in to marketing email
              </label>
              <input name="consentSource" placeholder="How they opted in (required for your records)" defaultValue={contact.consentSource ?? ""} />
              <small className="a-dim">
                {contact.unsubscribedAt
                  ? `Unsubscribed ${when(contact.unsubscribedAt, false)}. Only tick this if they asked to be added back.`
                  : contact.confirmToken
                    ? "Newsletter sign-up waiting for email confirmation."
                    : consented
                      ? `Opted in ${when(contact.consentAt, false)} · ${contact.consentSource ?? ""}`
                      : "Not on the marketing list."}
              </small>
            </fieldset>
            <button className="btn btn--primary">Save</button>
          </form>
        </Section>

        <Section title="Email">
          <form action={emailContact} className="adm-form">
            <input type="hidden" name="id" value={contact.id} />
            <label>
              Template
              <select name="templateId" defaultValue="">
                <option value="">— write below —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.purpose})</option>
                ))}
              </select>
            </label>
            <label>Subject<input name="subject" placeholder="Leave empty to use the template's" /></label>
            <label>
              Message
              <textarea name="body" rows={8} placeholder={"Hi {{first_name}},\n\n…\n\nMerge fields: {{name}} {{first_name}} {{city}} {{app_url}}"} />
            </label>
            <button className="btn btn--primary">Send email</button>
            <small className="a-dim">
              Sends {mail.smtp ? `from your mailbox (${mail.smtp})` : mail.resend ? `through Resend as ${mail.from}` : "nowhere yet — no email provider is configured"}. Logged on the timeline.
            </small>
          </form>

          <h3 className="adm-h3">Log an interaction</h3>
          <form action={addActivity} className="adm-form">
            <input type="hidden" name="id" value={contact.id} />
            <div className="adm-row">
              <label>
                Type
                <select name="kind" defaultValue="call">
                  <option value="call">Call</option>
                  <option value="sms">Text / WhatsApp</option>
                  <option value="meeting">Meeting / viewing</option>
                  <option value="note">Note</option>
                </select>
              </label>
              <label>Summary<input name="subject" placeholder="Called about Bushwick room" /></label>
            </div>
            <label>Details<textarea name="body" rows={3} required /></label>
            <div className="adm-row">
              <label>Next follow-up<input name="followUp" type="date" /></label>
              <label className="adm-check"><input type="checkbox" name="clearFollowUp" /> clear follow-up</label>
            </div>
            <button className="btn btn--outline">Log it</button>
          </form>
        </Section>
      </div>

      <div className="a-cols">
        <Section title="Timeline">
          {contact.activities.length === 0 ? (
            <p className="v-note">Nothing yet.</p>
          ) : (
            <ol className="adm-timeline">
              {contact.activities.map((a) => (
                <li key={a.id}>
                  <span className="adm-timeline__icon" aria-hidden="true">{ICON[a.kind] || "•"}</span>
                  <div>
                    <b>{a.subject || a.kind}</b> <span className="a-dim">{when(a.createdAt)}</span>
                    {a.body ? <p>{a.body}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Section>

        <Section title="Related">
          <ul className="adm-list">
            <li>
              Account:{" "}
              {contact.user ? (
                <Link href={`/admin/accounts?q=${encodeURIComponent(contact.email)}`}>
                  {contact.user.role} · {contact.user._count.listings} listings
                  {contact.user.trialEndsAt && contact.user.trialEndsAt > new Date() ? ` · trial until ${when(contact.user.trialEndsAt, false)}` : ""}
                  {contact.user.suspendedAt ? " · suspended" : ""}
                </Link>
              ) : (
                "none"
              )}
            </li>
            {leads.map((l) => (
              <li key={l.id}>
                Lead {when(l.createdAt, false)} · {l.kind} · <Pill>{l.status}</Pill> · <Link href="/admin/leads">inbox</Link>
              </li>
            ))}
            {invites.map((i) => (
              <li key={i.id}>
                Trial invite {when(i.createdAt, false)} · {i.days} days · <Pill>{i.status}</Pill>
              </li>
            ))}
            {contact.sends.map((s) => (
              <li key={s.id}>
                Campaign “{s.campaign.name}” · <Pill tone={s.status === "failed" ? "bad" : ""}>{s.status}</Pill> {when(s.sentAt, false)}
              </li>
            ))}
          </ul>
          <form action={deleteContact} className="adm-inline adm-danger">
            <input type="hidden" name="id" value={contact.id} />
            <input name="confirm" placeholder="Type DELETE" aria-label="Type DELETE to confirm" />
            <button className="btn btn--danger">Delete contact</button>
          </form>
        </Section>
      </div>
    </>
  );
}
