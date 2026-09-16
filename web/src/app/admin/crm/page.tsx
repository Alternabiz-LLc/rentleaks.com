import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { addContact, contactsBulk, importContacts } from "@/app/admin/_actions/crm";
import { Board, type BoardCard } from "@/components/admin/desk/Board";
import { BulkForm, SelectAll } from "@/components/admin/desk/BulkForm";
import { Donut, FunnelLanes, Kpi } from "@/components/admin/desk/charts";
import { DeskHeader } from "@/components/admin/desk/DeskHeader";
import { Icon } from "@/components/admin/desk/Icon";
import { ago, Chip, Field, FilterCard, GradeChip, initials, Panel, ViewSwitch } from "@/components/admin/desk/parts";
import { RecordCards, type RecordCard } from "@/components/admin/desk/RecordCards";
import { flashOf, qs, readParams, when, type SP } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";
import { nowMs } from "@/lib/admin/metrics";
import { followUpDraft, scoreContact } from "@/lib/admin/score";
import { KIND_LABEL, STAGE_LABEL } from "@/lib/crm";
import { CONTACT_KINDS, CONTACT_STAGES, parseTags } from "@/lib/marketing";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/site";

export const metadata = { title: "CRM — RentLeaks desk" };

const PAGE = 60;

const STAGE_TONE: Record<string, string> = { new: "brand", contacted: "warn", qualified: "value", customer: "good", lost: "bad" };

export default async function CrmPage({ searchParams }: { searchParams: SP }) {
  await requireAdminPage("/admin/crm");
  const p = await readParams(searchParams);
  const t = nowMs();
  const now = new Date(t);
  const view = p.view === "board" || p.view === "sheet" ? p.view : "cards";
  const page = Math.max(1, Number(p.page) || 1);

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
  if (p.stage && view !== "board") and.push({ stage: p.stage });
  if (p.tag) and.push({ tags: { contains: JSON.stringify(p.tag.toLowerCase()) } });
  if (p.city) and.push({ cityId: p.city });
  if (p.due) and.push({ nextFollowUpAt: { lte: now } });
  if (p.consent === "yes") and.push({ marketingConsent: true, confirmToken: null, unsubscribedAt: null });
  if (p.consent === "unsub") and.push({ unsubscribedAt: { not: null } });
  if (p.source) and.push({ source: p.source });
  const where: Prisma.ContactWhereInput = and.length ? { AND: and } : {};

  const take = view === "board" ? 400 : PAGE;
  const [total, contacts, stages, kinds, due, subscribers, cities, sources] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.contact.findMany({
      where,
      orderBy: p.due ? [{ nextFollowUpAt: "asc" }] : [{ updatedAt: "desc" }],
      skip: view === "board" ? 0 : (page - 1) * PAGE,
      take,
      include: { user: { select: { _count: { select: { listings: true } } } } },
    }),
    prisma.contact.groupBy({ by: ["stage"], _count: { _all: true } }),
    prisma.contact.groupBy({ by: ["kind"], _count: { _all: true } }),
    prisma.contact.count({ where: { nextFollowUpAt: { lte: now } } }),
    prisma.contact.count({ where: { marketingConsent: true, confirmToken: null, unsubscribedAt: null } }),
    prisma.city.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.contact.groupBy({ by: ["source"], _count: { _all: true } }),
  ]);
  const cityName = new Map(cities.map((c) => [c.id, c.name]));
  const stage = (s: string) => stages.find((x) => x.stage === s)?._count._all ?? 0;
  const all = stages.reduce((n, s) => n + s._count._all, 0);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const base = appUrl();
  const self = (over: Record<string, string | number | undefined> = {}) => `/admin/crm${qs(p, { ok: undefined, err: undefined, ...over })}`;

  const scored = contacts.map((c) => ({ c, s: scoreContact({ ...c, listings: c.user?._count.listings ?? 0 }, t) }));
  if (p.sort === "score") scored.sort((a, b) => b.s.score - a.s.score);

  const lineFor = (c: (typeof contacts)[number]) => {
    const overdue = c.nextFollowUpAt && c.nextFollowUpAt <= now;
    return [
      { k: "Email", v: c.email },
      ...(c.phone ? [{ k: "Mobile", v: c.phone }] : []),
      overdue
        ? { k: "Follow up", v: `due ${when(c.nextFollowUpAt, false)}`, tone: "bad" as const }
        : c.nextFollowUpAt
          ? { k: "Follow up", v: when(c.nextFollowUpAt, false) }
          : { k: "Last touch", v: c.lastContactedAt ? ago(t - c.lastContactedAt.getTime()) : "Never" },
    ];
  };

  const cards: RecordCard[] = scored.map(({ c, s }) => {
    const tags = parseTags(c.tags);
    const overdue = Boolean(c.nextFollowUpAt && c.nextFollowUpAt <= now);
    return {
      id: c.id,
      title: c.name || c.email,
      sub: [c.company, KIND_LABEL[c.kind] ?? c.kind, c.cityId ? cityName.get(c.cityId) ?? c.cityId : ""].filter(Boolean).join(" · "),
      initials: initials(c.name, c.email),
      status: { label: STAGE_LABEL[c.stage] ?? c.stage, tone: STAGE_TONE[c.stage] ?? "ink" },
      score: s.score,
      scoreWhy: s.reasons.join(" · "),
      chips: [
        ...(c.unsubscribedAt ? [{ label: "unsubscribed", tone: "bad" }] : c.marketingConsent && !c.confirmToken ? [{ label: "opted in", tone: "good" }] : []),
        ...tags.slice(0, 2).map((tg) => ({ label: tg })),
      ],
      lines: lineFor(c),
      accent: overdue ? "bad" : c.stage === "qualified" ? "warn" : c.stage === "customer" ? "good" : c.stage === "new" ? "brand" : "ink",
      href: `/admin/crm/${c.id}`,
      phone: c.phone,
      draft: c.unsubscribedAt ? undefined : followUpDraft({ id: c.id, name: c.name, email: c.email, kind: c.kind, stage: c.stage, appUrl: base }),
    };
  });

  const boardCards: BoardCard[] = scored.map(({ c, s }) => ({
    id: c.id,
    column: c.stage,
    title: c.name || c.email,
    sub: [c.company, KIND_LABEL[c.kind] ?? c.kind].filter(Boolean).join(" · "),
    initials: initials(c.name, c.email),
    score: s.score,
    chips: parseTags(c.tags)
      .slice(0, 2)
      .map((tg) => ({ label: tg })),
    lines: [c.lastContactedAt ? `Last touch ${ago(t - c.lastContactedAt.getTime())}` : "Never contacted"],
    alert: c.nextFollowUpAt && c.nextFollowUpAt <= now ? `Follow-up due ${when(c.nextFollowUpAt, false)}` : undefined,
    href: `/admin/crm/${c.id}`,
    phone: c.phone,
    draft: c.unsubscribedAt ? undefined : followUpDraft({ id: c.id, name: c.name, email: c.email, kind: c.kind, stage: c.stage, appUrl: base }),
  }));

  return (
    <div className="dk-stack">
      <DeskHeader
        href="/admin/crm"
        flash={flashOf(p)}
        signals={[
          { label: "Follow-ups due", value: `${due}`, tone: due ? "critical" : "live", href: self({ due: "1", view: undefined, page: undefined }) },
          { label: "Qualified", value: `${stage("qualified")} prospects`, tone: "live", href: self({ stage: "qualified", view: undefined }) },
          { label: "Customers", value: `${stage("customer")}`, tone: "ok", href: self({ stage: "customer", view: undefined }) },
          { label: "Newsletter list", value: `${subscribers} opted in`, tone: "ok", href: self({ consent: "yes" }) },
        ]}
        actions={
          <>
            <Link prefetch={false} className="dk-btn dk-btn--onink" href="/api/admin/export/contacts">
              <Icon name="export" size={15} /> Export CSV
            </Link>
            <Link prefetch={false} className="dk-btn dk-btn--light" href="#add">
              <Icon name="plus" size={15} /> Add contact
            </Link>
          </>
        }
      />

      <div className="dk-kpis">
        {CONTACT_STAGES.map((s) => (
          <Kpi
            key={s}
            label={STAGE_LABEL[s]}
            value={stage(s)}
            href={self({ stage: p.stage === s ? undefined : s, view: view === "board" ? undefined : p.view, page: undefined })}
            active={p.stage === s}
            tone={s === "customer" ? "good" : s === "qualified" ? "value" : s === "lost" ? "alert" : undefined}
          />
        ))}
        <Kpi label="Follow-ups due" value={due} href={self({ due: p.due ? undefined : "1", page: undefined })} active={Boolean(p.due)} tone={due ? "alert" : undefined} />
      </div>

      <div className="dk-grid dk-grid--2">
        <Panel title="Pipeline" sub="Everyone in the book, by stage.">
          <FunnelLanes stages={["new", "contacted", "qualified", "customer"].map((s) => ({ label: STAGE_LABEL[s], value: stage(s), href: self({ stage: s, view: undefined }) }))} />
          <p className="dk-hint" style={{ marginTop: 12 }}>
            {stage("lost")} lost · {all.toLocaleString("en-US")} contacts in total · from {sources.length} sources
          </p>
        </Panel>
        <Panel title="Who is in the book" sub="Click a kind to filter.">
          <Donut items={kinds.map((k) => ({ label: KIND_LABEL[k.kind] ?? k.kind, value: k._count._all, href: self({ kind: p.kind === k.kind ? undefined : k.kind, page: undefined }) }))} centerLabel="CONTACTS" />
        </Panel>
      </div>

      <div className="dk-toolbar">
        <ViewSwitch
          items={[
            { key: "cards", label: "Cards", href: self({ view: undefined }), on: view === "cards", icon: "overview" },
            { key: "board", label: "Board", href: self({ view: "board", page: undefined, stage: undefined }), on: view === "board", icon: "board" },
            { key: "sheet", label: "Spreadsheet", href: self({ view: "sheet" }), on: view === "sheet", icon: "list" },
          ]}
        />
        <span className="dk-hint">{view === "board" ? "Drag a contact to change its stage — it's logged on their timeline." : `${total.toLocaleString("en-US")} matching`}</span>
      </div>

      <FilterCard
        actions={
          <Link prefetch={false} href="/admin/crm" className="dk-btn dk-btn--ghost dk-btn--sm">
            Reset
          </Link>
        }
      >
        {view !== "cards" ? <input type="hidden" name="view" value={view} /> : null}
        <Field label="Search contacts">
          <input name="q" placeholder="Name, email, company, phone" defaultValue={p.q} />
        </Field>
        <Field label="Kind">
          <select name="kind" defaultValue={p.kind}>
            <option value="">All kinds</option>
            {CONTACT_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </Field>
        {view !== "board" ? (
          <Field label="Stage">
            <select name="stage" defaultValue={p.stage}>
              <option value="">All stages</option>
              {CONTACT_STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label="Tag">
          <input name="tag" placeholder="e.g. brooklyn" defaultValue={p.tag} />
        </Field>
        <Field label="City">
          <select name="city" defaultValue={p.city}>
            <option value="">Any city</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Marketing">
          <select name="consent" defaultValue={p.consent}>
            <option value="">Any consent</option>
            <option value="yes">Opted in</option>
            <option value="unsub">Unsubscribed</option>
          </select>
        </Field>
        <Field label="Sort">
          <select name="sort" defaultValue={p.sort}>
            <option value="">Recently updated</option>
            <option value="score">Highest score</option>
          </select>
        </Field>
        <label className="dk-check">
          <input type="checkbox" name="due" value="1" defaultChecked={Boolean(p.due)} /> Follow-up due
        </label>
        <div className="dk-filters__go">
          <button className="dk-btn dk-btn--primary" type="submit">
            <Icon name="search" size={14} /> Apply
          </button>
        </div>
      </FilterCard>

      {view === "board" ? (
        <>
          <Board
            mode="contact"
            columns={CONTACT_STAGES.map((s) => ({ key: s, label: STAGE_LABEL[s], tone: (STAGE_TONE[s] ?? "ink") as "brand" }))}
            cards={boardCards}
            empty="Drop a contact here"
          />
          {total > take ? <p className="dk-hint">Showing the {take} most recently updated of {total.toLocaleString("en-US")}. Filter to see the rest.</p> : null}
        </>
      ) : (
        <Panel flush title={`${total.toLocaleString("en-US")} contact${total === 1 ? "" : "s"}`} sub="Tick contacts to set stage or kind, tag them, book a follow-up or send a free-trial invite.">
          <BulkForm
            action={contactsBulk}
            returnTo={self()}
            noun="contact"
            ops={[
              { op: "stage", label: "Set stage", needs: "value", options: CONTACT_STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] })) },
              { op: "kind", label: "Set kind", needs: "value", options: CONTACT_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] })) },
              { op: "tag", label: "Add tag", needs: "value", placeholder: "tag" },
              { op: "untag", label: "Remove tag", needs: "value", placeholder: "tag" },
              { op: "followup", label: "Follow up on date", needs: "value", placeholder: "YYYY-MM-DD" },
              { op: "invite", label: "Send free-trial invite", needs: "value", placeholder: "Days (default 7)" },
            ]}
          >
            {view === "cards" ? (
              <div style={{ padding: "16px 18px 18px" }}>
                <RecordCards cards={cards} empty="No contacts match." />
              </div>
            ) : (
              <div className="dk-tablewrap">
                <table className="dk-table">
                  <thead>
                    <tr>
                      <th>
                        <SelectAll />
                      </th>
                      <th>Contact</th>
                      <th>Kind</th>
                      <th>Stage</th>
                      <th>Score</th>
                      <th>Tags</th>
                      <th>Last contact</th>
                      <th>Follow up</th>
                      <th>Marketing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scored.map(({ c, s }) => (
                      <tr key={c.id} data-row="">
                        <td>
                          <input type="checkbox" name="ids" value={c.id} aria-label={`Select ${c.email}`} />
                        </td>
                        <td className="dk-wrap">
                          <Link prefetch={false} href={`/admin/crm/${c.id}`}>
                            <b>{c.name || c.email}</b>
                          </Link>
                          <div className="dk-dim">
                            {c.email}
                            {c.company ? ` · ${c.company}` : ""}
                          </div>
                        </td>
                        <td>{KIND_LABEL[c.kind] || c.kind}</td>
                        <td>
                          <Chip tone={(STAGE_TONE[c.stage] ?? "ink") as "brand"}>{STAGE_LABEL[c.stage] ?? c.stage}</Chip>
                        </td>
                        <td>
                          <GradeChip score={s.score} title={s.reasons.join(" · ")} />
                        </td>
                        <td className="dk-wrap dk-dim">{parseTags(c.tags).join(", ") || "—"}</td>
                        <td className="dk-dim">{c.lastContactedAt ? ago(t - c.lastContactedAt.getTime()) : "never"}</td>
                        <td className={c.nextFollowUpAt && c.nextFollowUpAt <= now ? "dk-bad" : undefined}>{when(c.nextFollowUpAt, false)}</td>
                        <td>
                          {c.unsubscribedAt ? <Chip tone="bad">unsubscribed</Chip> : c.confirmToken ? <Chip tone="warn">unconfirmed</Chip> : c.marketingConsent ? <Chip tone="good">opted in</Chip> : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </BulkForm>
          <nav className="dk-pager" aria-label="Pages">
            {page > 1 ? <Link prefetch={false} href={self({ page: page - 1 })}>← Previous</Link> : <span />}
            <span>
              Page {page} of {pages}
            </span>
            {page < pages ? <Link prefetch={false} href={self({ page: page + 1 })}>Next →</Link> : <span />}
          </nav>
        </Panel>
      )}

      <div className="dk-grid dk-grid--2">
        <Panel id="add" title="Add a contact" sub="A prospect, a partner, a host you met — they land on the board as New.">
          <form action={addContact} className="dk-form">
            <label className="dk-field">
              <span>Email</span>
              <input name="email" type="email" required />
            </label>
            <label className="dk-field">
              <span>Name</span>
              <input name="name" />
            </label>
            <label className="dk-field">
              <span>Phone</span>
              <input name="phone" />
            </label>
            <label className="dk-field">
              <span>Company</span>
              <input name="company" />
            </label>
            <label className="dk-field">
              <span>Kind</span>
              <select name="kind" defaultValue="host">
                {CONTACT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="dk-field">
              <span>Tags</span>
              <input name="tags" placeholder="brooklyn, landlord" />
            </label>
            <label className="dk-field dk-field--wide">
              <span>Note</span>
              <textarea name="note" rows={2} />
            </label>
            <button className="dk-btn dk-btn--primary">
              <Icon name="plus" size={14} /> Add contact
            </button>
          </form>
        </Panel>
        <Panel title="Import from CSV" sub="Header row required: email, name, phone, company, kind, stage, tags, city, consent. Only mark consent=yes for people who really opted in.">
          <form action={importContacts} className="dk-form">
            <label className="dk-field dk-field--wide">
              <span>CSV file</span>
              <input name="file" type="file" accept=".csv,text/csv" />
            </label>
            <label className="dk-field dk-field--wide">
              <span>…or paste CSV</span>
              <textarea name="csv" rows={4} placeholder={"email,name,kind,tags\njane@example.com,Jane Doe,host,brooklyn"} />
            </label>
            <label className="dk-field">
              <span>Tag every row</span>
              <input name="tags" placeholder="import-sept" />
            </label>
            <label className="dk-field">
              <span>Where consent came from</span>
              <input name="consentSource" placeholder="Typeform waitlist, Sept 2026" />
            </label>
            <button className="dk-btn dk-btn--primary">
              <Icon name="export" size={14} /> Import
            </button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
