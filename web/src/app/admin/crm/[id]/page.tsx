import Link from "next/link";
import { notFound } from "next/navigation";
import { addActivity, deleteContact, emailContact, updateContact } from "@/app/admin/_actions/crm";
import { DeskHeader } from "@/components/admin/desk/DeskHeader";
import { Composer } from "@/components/admin/desk/Drawer";
import { Icon } from "@/components/admin/desk/Icon";
import { ago, Avatar, Chip, GradeChip, Panel } from "@/components/admin/desk/parts";
import { flashOf, readParams, when, type SP } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";
import { nowMs } from "@/lib/admin/metrics";
import { followUpDraft, scoreContact } from "@/lib/admin/score";
import { KIND_LABEL, STAGE_LABEL } from "@/lib/crm";
import { CONTACT_KINDS, CONTACT_STAGES, parseTags } from "@/lib/marketing";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/site";
import { mailStatus } from "@/lib/v1/mail";

export const metadata = { title: "Contact — RentLeaks desk" };

const ICON: Record<string, "mail" | "phone" | "outreach" | "clock" | "crm" | "leads" | "ticket" | "accounts" | "check"> = {
  note: "check",
  email: "mail",
  call: "phone",
  sms: "outreach",
  meeting: "clock",
  stage: "crm",
  lead: "leads",
  campaign: "mail",
  trial: "ticket",
  signup: "accounts",
};

const STAGE_TONE: Record<string, "brand" | "warn" | "value" | "good" | "bad"> = { new: "brand", contacted: "warn", qualified: "value", customer: "good", lost: "bad" };

export default async function ContactPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  await requireAdminPage(`/admin/crm/${id}`);
  const p = await readParams(searchParams);
  const t = nowMs();
  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      activities: { orderBy: { createdAt: "desc" }, take: 100 },
      user: { select: { id: true, role: true, trialEndsAt: true, suspendedAt: true, _count: { select: { listings: true } } } },
      sends: { include: { campaign: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!contact) notFound();
  const [leads, invites, templates, cities] = await Promise.all([
    prisma.lead.findMany({ where: { email: contact.email }, orderBy: { createdAt: "desc" }, take: 10, include: { listing: { select: { title: true } } } }),
    prisma.trialInvite.findMany({ where: { email: contact.email }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.emailTemplate.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, purpose: true } }),
    prisma.city.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const mail = mailStatus();
  const consented = contact.marketingConsent && !contact.confirmToken && !contact.unsubscribedAt;
  const d = (x: Date | null) => (x ? x.toISOString().slice(0, 10) : "");
  const score = scoreContact({ ...contact, listings: contact.user?._count.listings ?? 0 }, t);
  const overdue = contact.nextFollowUpAt && contact.nextFollowUpAt.getTime() <= t;
  const cityName = contact.cityId ? cities.find((c) => c.id === contact.cityId)?.name : null;
  const touches = contact.activities.filter((a) => ["email", "call", "sms", "meeting"].includes(a.kind)).length;

  return (
    <div className="dk-stack">
      <DeskHeader
        href="/admin/crm"
        compact
        crumbs={[{ label: contact.name || contact.email }]}
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 14 }}>
            <Avatar name={contact.name} email={contact.email} />
            {contact.name || contact.email}
          </span>
        }
        flash={flashOf(p)}
        signals={[
          { label: "Stage", value: STAGE_LABEL[contact.stage] ?? contact.stage, tone: contact.stage === "lost" ? "warn" : "live" },
          { label: "Priority", value: `${score.score} / 100`, tone: score.score >= 62 ? "live" : "ok" },
          { label: "Follow up", value: contact.nextFollowUpAt ? when(contact.nextFollowUpAt, false) : "not set", tone: overdue ? "critical" : "ok" },
          { label: "Touches", value: `${touches} · last ${contact.lastContactedAt ? ago(t - contact.lastContactedAt.getTime()) : "never"}`, tone: "ok" },
        ]}
        actions={
          <>
            <a className="dk-btn dk-btn--onink" href={`mailto:${contact.email}`}>
              <Icon name="mail" size={15} /> Mail app
            </a>
            {contact.phone ? (
              <a className="dk-btn dk-btn--onink" href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}>
                <Icon name="phone" size={15} /> Call
              </a>
            ) : null}
          </>
        }
      />

      <div className="dk-chiprow">
        <Chip tone={STAGE_TONE[contact.stage] ?? "ink"}>{STAGE_LABEL[contact.stage] ?? contact.stage}</Chip>
        <GradeChip score={score.score} title={score.reasons.join(" · ")} />
        <Chip>{KIND_LABEL[contact.kind] || contact.kind}</Chip>
        <Chip>from {contact.source}</Chip>
        {cityName ? <Chip>{cityName}</Chip> : null}
        {contact.company ? <Chip>{contact.company}</Chip> : null}
        {consented ? <Chip tone="good">opted in</Chip> : contact.unsubscribedAt ? <Chip tone="bad">unsubscribed</Chip> : contact.confirmToken ? <Chip tone="warn">unconfirmed</Chip> : null}
        {parseTags(contact.tags).map((tg) => (
          <Link prefetch={false} key={tg} className="dk-chip dk-chip--brand" href={`/admin/crm?tag=${encodeURIComponent(tg)}`}>
            #{tg}
          </Link>
        ))}
        <span className="dk-hint">
          {contact.email}
          {contact.phone ? ` · ${contact.phone}` : ""} · added {when(contact.createdAt, false)}
        </span>
      </div>

      <div className="dk-grid dk-grid--2">
        <Panel kicker="Reply" title="Email" sub={`Sends ${mail.smtp ? `from your mailbox (${mail.smtp})` : mail.resend ? `through Resend as ${mail.from}` : "nowhere yet — no email provider is configured"}. Logged on the timeline.`}>
          {contact.unsubscribedAt ? (
            <p className="dk-flash dk-flash--warn">This person unsubscribed on {when(contact.unsubscribedAt, false)}. A one-to-one reply to something they asked is fine; marketing is not.</p>
          ) : null}
          <Composer draft={followUpDraft({ id: contact.id, name: contact.name, email: contact.email, kind: contact.kind, stage: contact.stage, appUrl: appUrl() })} />
          <details style={{ marginTop: 14 }}>
            <summary className="dk-hint" style={{ cursor: "pointer" }}>
              Send from a saved template instead
            </summary>
            <form action={emailContact} className="dk-form" style={{ marginTop: 12 }}>
              <input type="hidden" name="id" value={contact.id} />
              <label className="dk-field dk-field--wide">
                <span>Template</span>
                <select name="templateId" defaultValue="">
                  <option value="">— choose —</option>
                  {templates.map((tp) => (
                    <option key={tp.id} value={tp.id}>
                      {tp.name} ({tp.purpose})
                    </option>
                  ))}
                </select>
              </label>
              <label className="dk-field dk-field--wide">
                <span>Subject (optional — template&rsquo;s by default)</span>
                <input name="subject" />
              </label>
              <label className="dk-field dk-field--wide">
                <span>Message (optional — template&rsquo;s by default)</span>
                <textarea name="body" rows={4} />
              </label>
              <button className="dk-btn">Send template</button>
            </form>
          </details>
        </Panel>

        <Panel kicker="Profile" title="Details">
          <form action={updateContact} className="dk-form">
            <input type="hidden" name="id" value={contact.id} />
            <label className="dk-field">
              <span>Name</span>
              <input name="name" defaultValue={contact.name} />
            </label>
            <label className="dk-field">
              <span>Phone</span>
              <input name="phone" defaultValue={contact.phone ?? ""} />
            </label>
            <label className="dk-field">
              <span>Company</span>
              <input name="company" defaultValue={contact.company ?? ""} />
            </label>
            <label className="dk-field">
              <span>City</span>
              <select name="cityId" defaultValue={contact.cityId ?? ""}>
                <option value="">—</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="dk-field">
              <span>Kind</span>
              <select name="kind" defaultValue={contact.kind}>
                {CONTACT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="dk-field">
              <span>Stage</span>
              <select name="stage" defaultValue={contact.stage}>
                {CONTACT_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="dk-field">
              <span>Follow up on</span>
              <input name="followUp" type="date" defaultValue={d(contact.nextFollowUpAt)} />
            </label>
            <label className="dk-field">
              <span>Tags</span>
              <input name="tags" defaultValue={parseTags(contact.tags).join(", ")} />
            </label>
            <label className="dk-field dk-field--wide">
              <span>Private note</span>
              <textarea name="note" rows={3} defaultValue={contact.note ?? ""} />
            </label>
            <fieldset className="dk-fieldset">
              <legend>Marketing consent</legend>
              <label className="dk-check">
                <input type="checkbox" name="consent" defaultChecked={consented} /> Opted in to marketing email
              </label>
              <input name="consentSource" placeholder="How they opted in (kept for your records)" defaultValue={contact.consentSource ?? ""} />
              <small className="dk-hint">
                {contact.unsubscribedAt
                  ? `Unsubscribed ${when(contact.unsubscribedAt, false)}. Only tick this if they asked to be added back.`
                  : contact.confirmToken
                    ? "Newsletter sign-up waiting for email confirmation."
                    : consented
                      ? `Opted in ${when(contact.consentAt, false)} · ${contact.consentSource ?? ""}`
                      : "Not on the marketing list."}
              </small>
            </fieldset>
            <button className="dk-btn dk-btn--primary">Save</button>
          </form>
        </Panel>
      </div>

      <div className="dk-grid dk-grid--2">
        <Panel kicker="History" title="Timeline" sub={`${contact.activities.length} entries`}>
          <form action={addActivity} className="dk-form" style={{ marginBottom: 18 }}>
            <input type="hidden" name="id" value={contact.id} />
            <label className="dk-field">
              <span>Log a…</span>
              <select name="kind" defaultValue="call">
                <option value="call">Call</option>
                <option value="sms">Text / WhatsApp</option>
                <option value="meeting">Meeting / viewing</option>
                <option value="note">Note</option>
              </select>
            </label>
            <label className="dk-field">
              <span>Summary</span>
              <input name="subject" placeholder="Called about the Bushwick room" />
            </label>
            <label className="dk-field dk-field--wide">
              <span>Details</span>
              <textarea name="body" rows={2} required />
            </label>
            <label className="dk-field">
              <span>Next follow-up</span>
              <input name="followUp" type="date" />
            </label>
            <label className="dk-check" style={{ alignSelf: "end" }}>
              <input type="checkbox" name="clearFollowUp" /> clear follow-up
            </label>
            <button className="dk-btn">
              <Icon name="plus" size={14} /> Log it
            </button>
          </form>
          {contact.activities.length === 0 ? (
            <p className="dk-empty">Nothing yet.</p>
          ) : (
            <ol className="dk-timeline">
              {contact.activities.map((a) => (
                <li key={a.id}>
                  <span className="dk-timeline__icon">
                    <Icon name={ICON[a.kind] ?? "check"} size={15} />
                  </span>
                  <div>
                    <b>{a.subject || a.kind}</b> <span className="dk-dim">· {ago(t - a.createdAt.getTime())}</span>
                    {a.body ? <p>{a.body}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <div className="dk-stack">
          <Panel kicker="Connected" title="Related">
            <ul className="dk-feed">
              <li>
                <span className="dk-feed__icon">
                  <Icon name="accounts" size={15} />
                </span>
                <div>
                  <b>Account</b>
                  <p>
                    {contact.user ? (
                      <Link prefetch={false} href={`/admin/accounts/${contact.user.id}`}>
                        {contact.user.role} · {contact.user._count.listings} listings
                        {contact.user.trialEndsAt && contact.user.trialEndsAt.getTime() > t ? ` · trial until ${when(contact.user.trialEndsAt, false)}` : ""}
                        {contact.user.suspendedAt ? " · suspended" : ""}
                      </Link>
                    ) : (
                      "No account"
                    )}
                  </p>
                </div>
                <time />
              </li>
              {leads.map((l) => (
                <li key={l.id}>
                  <span className="dk-feed__icon dk-feed__icon--good">
                    <Icon name="leads" size={15} />
                  </span>
                  <div>
                    <Link prefetch={false} href={`/admin/leads?open=${l.id}`}>
                      <b>
                        Lead · {l.kind}
                        {l.listing ? ` · ${l.listing.title}` : ""}
                      </b>
                    </Link>
                    <p>{l.status}</p>
                  </div>
                  <time>{ago(t - l.createdAt.getTime())}</time>
                </li>
              ))}
              {invites.map((i) => (
                <li key={i.id}>
                  <span className="dk-feed__icon dk-feed__icon--value">
                    <Icon name="ticket" size={15} />
                  </span>
                  <div>
                    <Link prefetch={false} href="/admin/trials">
                      <b>Trial invite · {i.days} days</b>
                    </Link>
                    <p>{i.status}</p>
                  </div>
                  <time>{ago(t - i.createdAt.getTime())}</time>
                </li>
              ))}
              {contact.sends.map((s) => (
                <li key={s.id}>
                  <span className="dk-feed__icon">
                    <Icon name="mail" size={15} />
                  </span>
                  <div>
                    <Link prefetch={false} href={`/admin/campaigns/${s.campaign.id}`}>
                      <b>Campaign “{s.campaign.name}”</b>
                    </Link>
                    <p className={s.status === "failed" ? "dk-bad" : undefined}>{s.status}</p>
                  </div>
                  <time>{s.sentAt ? ago(t - s.sentAt.getTime()) : ""}</time>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel kicker="Score" title={`Why ${score.score}`}>
            <ul className="dk-why">
              {score.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <form action={deleteContact} className="dk-inline dk-danger">
              <input type="hidden" name="id" value={contact.id} />
              <input name="confirm" placeholder="Type DELETE" aria-label="Type DELETE to confirm" />
              <button className="dk-btn dk-btn--danger">Delete contact</button>
            </form>
          </Panel>
        </div>
      </div>
    </div>
  );
}
