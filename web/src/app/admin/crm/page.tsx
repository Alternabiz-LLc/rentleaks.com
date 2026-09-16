import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { addContact, contactsBulk, importContacts } from "@/app/admin/_actions/crm";
import { Empty, flashOf, PageHead, Pager, Pill, qs, readParams, Section, Stats, when, type SP } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";
import { KIND_LABEL, STAGE_LABEL } from "@/lib/crm";
import { CONTACT_KINDS, CONTACT_STAGES, parseTags } from "@/lib/marketing";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "CRM — RentLeaks admin" };

const PAGE = 50;

export default async function CrmPage({ searchParams }: { searchParams: SP }) {
  await requireAdminPage();
  const p = await readParams(searchParams);
  const page = Math.max(1, Number(p.page) || 1);
  const now = new Date();
  const and: Prisma.ContactWhereInput[] = [];
  if (p.q) {
    and.push({
      OR: [
        { email: { contains: p.q, mode: "insensitive" } },
        { name: { contains: p.q, mode: "insensitive" } },
        { company: { contains: p.q, mode: "insensitive" } },
        { phone: { contains: p.q } },
      ],
    });
  }
  if (p.kind) and.push({ kind: p.kind });
  if (p.stage) and.push({ stage: p.stage });
  if (p.tag) and.push({ tags: { contains: JSON.stringify(p.tag.toLowerCase()) } });
  if (p.due) and.push({ nextFollowUpAt: { lte: now } });
  if (p.consent === "yes") and.push({ marketingConsent: true, confirmToken: null, unsubscribedAt: null });
  if (p.consent === "unsub") and.push({ unsubscribedAt: { not: null } });
  const where: Prisma.ContactWhereInput = and.length ? { AND: and } : {};

  const [total, contacts, stages, due, subscribers] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.contact.findMany({
      where,
      orderBy: p.due ? [{ nextFollowUpAt: "asc" }] : [{ updatedAt: "desc" }],
      skip: (page - 1) * PAGE,
      take: PAGE,
    }),
    prisma.contact.groupBy({ by: ["stage"], _count: { _all: true } }),
    prisma.contact.count({ where: { nextFollowUpAt: { lte: now } } }),
    prisma.contact.count({ where: { marketingConsent: true, confirmToken: null, unsubscribedAt: null } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const self = `/admin/crm${qs(p, { ok: undefined, err: undefined })}`;
  const stage = (s: string) => stages.find((x) => x.stage === s)?._count._all ?? 0;

  return (
    <>
      <PageHead
        title="CRM"
        sub="Everyone the business talks to. Leads and sign-ups are added automatically; prospects are added or imported here."
        flash={flashOf(p)}
      >
        <Link className="btn btn--outline" href="/api/admin/export/contacts">Export CSV</Link>
      </PageHead>
      <Stats
        items={CONTACT_STAGES.map((s) => ({
          k: STAGE_LABEL[s],
          v: <Link href={`/admin/crm?stage=${s}`}>{stage(s)}</Link>,
        })).concat([
          { k: "Follow-ups due", v: <Link href="/admin/crm?due=1">{due}</Link> },
          { k: "Newsletter list", v: <Link href="/admin/crm?consent=yes">{subscribers}</Link> },
        ])}
      />

      <form className="adm-filters" method="get">
        <input name="q" placeholder="Name, email, company, phone" defaultValue={p.q} />
        <select name="kind" defaultValue={p.kind}>
          <option value="">All kinds</option>
          {CONTACT_KINDS.map((k) => (
            <option key={k} value={k}>{KIND_LABEL[k]}</option>
          ))}
        </select>
        <select name="stage" defaultValue={p.stage}>
          <option value="">All stages</option>
          {CONTACT_STAGES.map((s) => (
            <option key={s} value={s}>{STAGE_LABEL[s]}</option>
          ))}
        </select>
        <input name="tag" placeholder="Tag" defaultValue={p.tag} />
        <select name="consent" defaultValue={p.consent}>
          <option value="">Any consent</option>
          <option value="yes">Opted in to marketing</option>
          <option value="unsub">Unsubscribed</option>
        </select>
        <label className="adm-check"><input type="checkbox" name="due" value="1" defaultChecked={Boolean(p.due)} /> follow-up due</label>
        <button className="btn btn--primary" type="submit">Filter</button>
        <Link className="btn btn--ghost" href="/admin/crm">Reset</Link>
      </form>

      {contacts.length === 0 ? (
        <Empty>No contacts match.</Empty>
      ) : (
        <form action={contactsBulk}>
          <input type="hidden" name="returnTo" value={self} />
          <div className="adm-bulk">
            <select name="op" defaultValue="">
              <option value="" disabled>Bulk action…</option>
              <option value="stage">Set stage (type it)</option>
              <option value="kind">Set kind (type it)</option>
              <option value="tag">Add tag</option>
              <option value="untag">Remove tag</option>
              <option value="followup">Follow up on date (YYYY-MM-DD)</option>
              <option value="invite">Send free-trial invite (days, default 7)</option>
            </select>
            <input name="value" placeholder="stage / kind / tag / date / days" />
            <button className="btn btn--primary" type="submit">Apply to ticked</button>
          </div>
          <div className="a-scroll">
            <table className="a-table adm-table">
              <thead>
                <tr><th /><th>Contact</th><th>Kind</th><th>Stage</th><th>Tags</th><th>Last contact</th><th>Follow up</th><th>Marketing</th></tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id}>
                    <td><input type="checkbox" name="ids" value={c.id} aria-label={`Select ${c.email}`} /></td>
                    <td className="adm-wrap">
                      <Link href={`/admin/crm/${c.id}`}><b>{c.name || c.email}</b></Link>
                      <div className="a-dim">{c.email}{c.company ? ` · ${c.company}` : ""}</div>
                    </td>
                    <td>{KIND_LABEL[c.kind] || c.kind}</td>
                    <td><Pill tone={c.stage === "customer" ? "good" : c.stage === "lost" ? "bad" : c.stage === "new" ? "brand" : ""}>{c.stage}</Pill></td>
                    <td className="adm-wrap a-dim">{parseTags(c.tags).join(", ") || "—"}</td>
                    <td>{when(c.lastContactedAt, false)}</td>
                    <td className={c.nextFollowUpAt && c.nextFollowUpAt <= now ? "a-bad" : undefined}>{when(c.nextFollowUpAt, false)}</td>
                    <td>
                      {c.unsubscribedAt ? <Pill tone="bad">unsubscribed</Pill> : c.confirmToken ? <Pill tone="warn">unconfirmed</Pill> : c.marketingConsent ? <Pill tone="good">opted in</Pill> : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </form>
      )}
      <Pager page={page} pages={pages} href={(n) => `/admin/crm${qs(p, { page: n, ok: undefined, err: undefined })}`} />

      <div className="a-cols">
        <Section title="Add a contact">
          <form action={addContact} className="adm-form">
            <div className="adm-row">
              <label>Email<input name="email" type="email" required /></label>
              <label>Name<input name="name" /></label>
            </div>
            <div className="adm-row">
              <label>Phone<input name="phone" /></label>
              <label>Company<input name="company" /></label>
            </div>
            <div className="adm-row">
              <label>
                Kind
                <select name="kind" defaultValue="host">
                  {CONTACT_KINDS.map((k) => (
                    <option key={k} value={k}>{KIND_LABEL[k]}</option>
                  ))}
                </select>
              </label>
              <label>Tags<input name="tags" placeholder="brooklyn, landlord" /></label>
            </div>
            <label>Note<textarea name="note" rows={2} /></label>
            <button className="btn btn--primary">Add contact</button>
          </form>
        </Section>
        <Section title="Import from CSV" sub="Header row required: email, name, phone, company, kind, stage, tags, city, consent. Only mark consent=yes for people who actually opted in to marketing email.">
          <form action={importContacts} className="adm-form">
            <label>CSV file<input name="file" type="file" accept=".csv,text/csv" /></label>
            <label>…or paste CSV<textarea name="csv" rows={4} placeholder={"email,name,kind,tags\njane@example.com,Jane Doe,host,brooklyn"} /></label>
            <label>Add these tags to every row<input name="tags" placeholder="import-sept" /></label>
            <label>Where consent came from (if any rows say yes)<input name="consentSource" placeholder="e.g. Typeform waitlist, Sept 2026" /></label>
            <button className="btn btn--primary">Import</button>
          </form>
        </Section>
      </div>
    </>
  );
}
