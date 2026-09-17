import Link from "next/link";
import type { Engagement, EngagementTask, ManagedProperty, OwnerStatement, ServiceRequest } from "@prisma/client";
import { engagementAction, enterpriseSettingsAction, requestAction, saveEngagement, saveProperty, saveStatement, statementAction } from "@/app/admin/_actions/enterprise";
import { Columns, Gauge } from "@/components/admin/desk/charts";
import { Icon } from "@/components/admin/desk/Icon";
import { RouteDrawer } from "@/components/admin/desk/RouteDrawer";
import { Chip, Empty, GradeChip, Panel, ago } from "@/components/admin/desk/parts";
import { when } from "@/components/admin/ui";
import { fmtCents } from "@/lib/books/core";
import {
  ADD_ONS,
  brokerComplete,
  brokerLine,
  CLIENT_ROLES,
  ENGAGEMENT_STAGE,
  ENGAGEMENT_STATUSES,
  FEE_LABEL,
  monthName,
  PACKAGE,
  PACKAGES,
  pctLabel,
  PROPERTY_KINDS,
  PROPERTY_STATUSES,
  REQUEST_STAGE,
  requestScore,
  SERVICE,
  SERVICES,
  statementMonth,
  suggestPackage,
  TIMELINES,
  TRACKS,
  type BrokerDetails,
  type EngagementStatus,
  type FeeModel,
  type ServiceId,
} from "@/lib/enterprise/catalog";
import { parseExpenseLines } from "@/lib/enterprise/data";

type Self = (over?: Record<string, string | undefined>) => string;

export type RequestRow = ServiceRequest & { serviceIds: ServiceId[]; addOnIds: string[]; assignedName: string | null };
export type EngagementRow = Engagement & {
  tasks: EngagementTask[];
  properties: Array<{ id: string; name: string; units: number; occupied: number; status: string }>;
  serviceIds: ServiceId[];
  value: { monthly: number; once: number };
  done: number;
  overdue: number;
};
export type PropertyRow = ManagedProperty & { statements: OwnerStatement[]; occ: number; due: boolean };

const label = <T extends { id: string; label: string }>(xs: readonly T[], id: string | null | undefined) => xs.find((x) => x.id === id)?.label ?? id ?? "—";
const cents = (c: number) => (c ? (c / 100).toFixed(2) : "");
const pctInput = (bp: number) => (bp ? String(bp / 100) : "");

function Hidden({ values }: { values: Record<string, string> }) {
  return (
    <>
      {Object.entries(values).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------------
   Request dossier
   ------------------------------------------------------------------------ */

export function RequestDrawer({
  r,
  self,
  now,
  contact,
  account,
  founder,
  me,
}: {
  r: RequestRow;
  self: Self;
  now: number;
  contact: { id: string; stage: string } | null;
  account: { id: string; role: string } | null;
  founder: boolean;
  me: { name: string };
}) {
  const score = requestScore({ ...r, services: r.serviceIds });
  const suggested = r.packageId ?? suggestPackage({ services: r.serviceIds, propertyKind: r.propertyKind, units: r.units, outOfState: r.outOfState });
  const pkg = PACKAGE.get(suggested);
  const back = self();
  const first = r.name.split(" ")[0];
  const where = r.address || r.market || "your property";
  const template =
    `Hi ${first},\n\nThanks for your request about ${where}. I'd like to understand the property and what you need — could we do a 20-minute call or a walk-through this week? Send me two times that suit you, or reply with a good number.\n\n` +
    (pkg ? `From what you sent, our ${pkg.name} package (${pkg.tagline.replace(/\.$/, "").toLowerCase()}) looks like the closest fit; we'll shape the proposal around the building.\n\n` : "") +
    `Best,\n${me.name}`;
  const stage = r.status in REQUEST_STAGE ? REQUEST_STAGE[r.status as keyof typeof REQUEST_STAGE] : null;
  return (
    <RouteDrawer closeHref={self({ open: undefined })} kicker={`Enterprise request · ${ago(now - r.createdAt.getTime())}`} title={r.company || r.name} width={660}>
      <div className="dk-dossier">
        <div className="dk-chiprow">
          <Chip tone={stage?.tone ?? "ink"}>{stage?.label ?? r.status}</Chip>
          <GradeChip score={score.score} title={score.parts.map((x) => x.label).join(" · ")} />
          {r.outOfState ? <Chip tone="value">out-of-state owner</Chip> : null}
          {r.ackSentAt ? <Chip tone="good">copy sent</Chip> : <Chip tone="warn">no copy sent</Chip>}
          {contact ? (
            <Link prefetch={false} className="dk-chip dk-chip--brand" href={`/admin/crm/${contact.id}`}>
              CRM · {contact.stage} →
            </Link>
          ) : null}
          {account ? (
            <Link prefetch={false} className="dk-chip dk-chip--value" href={`/admin/accounts/${account.id}`}>
              {account.role} account →
            </Link>
          ) : null}
          {r.engagementId ? (
            <Link prefetch={false} className="dk-chip dk-chip--good" href={self({ open: undefined, tab: "engagements", eng: r.engagementId })}>
              engagement →
            </Link>
          ) : null}
        </div>
        <dl className="dk-dossier__facts">
          <div>
            <dt>Contact</dt>
            <dd>
              {r.name} · <a href={`mailto:${r.email}`}>{r.email}</a>
              {r.phone ? (
                <>
                  {" "}
                  · <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`}>{r.phone}</a>
                </>
              ) : null}
            </dd>
          </div>
          <div>
            <dt>Who</dt>
            <dd>
              {label(CLIENT_ROLES, r.role)}
              {r.ownerLocation ? ` · based in ${r.ownerLocation}` : ""}
            </dd>
          </div>
          <div>
            <dt>Property</dt>
            <dd>
              {label(PROPERTY_KINDS, r.propertyKind)}
              {r.units ? ` · ${r.units} units` : ""}
              {r.buildings ? ` · ${r.buildings} buildings` : ""}
            </dd>
          </div>
          <div>
            <dt>Where</dt>
            <dd>{[r.address, r.market].filter(Boolean).join(", ") || "—"}</dd>
          </div>
          <div>
            <dt>Timeline</dt>
            <dd>{label(TIMELINES, r.timeline)}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>
              {r.source}
              {r.campaign ? ` · ${r.campaign}` : ""}
            </dd>
          </div>
        </dl>
        <div className="dk-chiprow">
          {r.serviceIds.map((s) => (
            <Chip key={s} tone={SERVICE.get(s)?.licensed ? "brand" : ""}>
              {SERVICE.get(s)?.title ?? s}
            </Chip>
          ))}
          {r.addOnIds.map((a) => (
            <Chip key={a} tone="ink">
              + {ADD_ONS.find((x) => x.id === a)?.label ?? a}
            </Chip>
          ))}
        </div>
        {r.message ? <pre className="dk-dossier__summary">{r.message}</pre> : null}
        <ul className="dk-why">
          {score.parts.map((x) => (
            <li key={x.label}>
              {x.label} (+{x.points})
            </li>
          ))}
        </ul>

        <Panel kicker={r.packageId ? "Their pick" : "Suggested package"} title={pkg ? `${TRACKS.find((x) => x.id === pkg.track)?.label} · ${pkg.name}` : "Custom scope"} sub={pkg ? `${pkg.tagline} ${pkg.basis}.` : undefined}>
          <div className="dk-inline">
            {r.engagementId ? null : (
              <Link prefetch={false} className="dk-btn dk-btn--primary dk-btn--sm" href={self({ open: undefined, tab: "engagements", new: "1", from: r.id, pkg: suggested })} scroll={false}>
                <Icon name="plus" size={13} /> Create the proposal
              </Link>
            )}
            <form action={requestAction}>
              <Hidden values={{ id: r.id, returnTo: back }} />
              <button className="dk-btn dk-btn--sm" name="op" value="contacted">
                <Icon name="phone" size={13} /> Called them
              </button>
            </form>
            {r.assignedName ? (
              <Chip>owner: {r.assignedName}</Chip>
            ) : (
              <form action={requestAction}>
                <Hidden values={{ id: r.id, returnTo: back }} />
                <button className="dk-btn dk-btn--ghost dk-btn--sm" name="op" value="mine">
                  Take it
                </button>
              </form>
            )}
          </div>
        </Panel>

        <form action={requestAction} className="dk-form">
          <Hidden values={{ id: r.id, returnTo: back, op: "reply" }} />
          <label className="dk-field dk-field--wide">
            <span>Reply by email (from you, reply-to your address)</span>
            <input name="subject" defaultValue={`Your ${label(PROPERTY_KINDS, r.propertyKind).toLowerCase()} — next steps with RentLeaks Enterprise`} />
          </label>
          <label className="dk-field dk-field--wide">
            <span>Message</span>
            <textarea name="body" rows={8} defaultValue={template} />
          </label>
          <button className="dk-btn dk-btn--primary">
            <Icon name="mail" size={14} /> Send reply
          </button>
        </form>

        <form action={requestAction} className="dk-form">
          <Hidden values={{ id: r.id, returnTo: back, op: "note" }} />
          <label className="dk-field dk-field--wide">
            <span>Private note</span>
            <textarea name="note" rows={2} defaultValue={r.note ?? ""} placeholder="What you learned on the call" />
          </label>
          <button className="dk-btn dk-btn--sm">Save note</button>
        </form>

        <form action={requestAction} className="dk-inline">
          <Hidden values={{ id: r.id, returnTo: back }} />
          <input name="reason" placeholder="Why lost? (price, timing, went with another firm…)" defaultValue={r.lostReason ?? ""} />
          <button className="dk-btn dk-btn--sm" name="op" value="lost">
            Mark lost
          </button>
          <button className="dk-btn dk-btn--ghost dk-btn--sm" name="op" value="spam">
            Spam
          </button>
          {founder ? (
            <button className="dk-btn dk-btn--ghost dk-btn--sm" name="op" value="delete">
              Delete
            </button>
          ) : null}
        </form>
        <p className="dk-hint">Received {when(r.createdAt)} UTC · first contact {r.contactedAt ? when(r.contactedAt) : "not yet"}.</p>
      </div>
    </RouteDrawer>
  );
}

/* ------------------------------------------------------------------------
   Engagement form (new or edit)
   ------------------------------------------------------------------------ */

function EngagementFields({ e, fromRequest, presetPackage }: { e?: EngagementRow; fromRequest?: RequestRow; presetPackage?: string }) {
  const pkgId = e?.packageId ?? (presetPackage && PACKAGE.has(presetPackage) ? presetPackage : "");
  const pkg = pkgId ? PACKAGE.get(pkgId) : undefined;
  const fee: FeeModel = (e?.feeModel as FeeModel) ?? pkg?.fee ?? "monthly";
  const services = e?.serviceIds ?? pkg?.services ?? fromRequest?.serviceIds ?? [];
  return (
    <>
      <fieldset className="dk-fieldset">
        <legend>1 · Client</legend>
        <div className="dk-form">
          <label className="dk-field">
            <span>Name</span>
            <input name="clientName" required defaultValue={e?.clientName ?? fromRequest?.name ?? ""} />
          </label>
          <label className="dk-field">
            <span>Email</span>
            <input name="clientEmail" type="email" required defaultValue={e?.clientEmail ?? fromRequest?.email ?? ""} />
          </label>
          <label className="dk-field">
            <span>Company</span>
            <input name="clientCompany" defaultValue={e?.clientCompany ?? fromRequest?.company ?? ""} />
          </label>
          <label className="dk-field">
            <span>Phone</span>
            <input name="clientPhone" defaultValue={e?.clientPhone ?? fromRequest?.phone ?? ""} />
          </label>
          <label className="dk-field">
            <span>Market</span>
            <input name="market" defaultValue={e?.market ?? fromRequest?.market ?? ""} placeholder="Brooklyn, NY" />
          </label>
          <label className="dk-field">
            <span>Address</span>
            <input name="address" defaultValue={e?.address ?? fromRequest?.address ?? ""} />
          </label>
          <label className="dk-field">
            <span>Owner is based in</span>
            <input name="ownerLocation" defaultValue={e?.ownerLocation ?? fromRequest?.ownerLocation ?? ""} placeholder="Texas" />
          </label>
          <label className="dk-field">
            <span>Units</span>
            <input name="units" type="number" min={0} defaultValue={e?.units ?? fromRequest?.units ?? ""} />
          </label>
        </div>
      </fieldset>
      <fieldset className="dk-fieldset">
        <legend>2 · Scope</legend>
        <div className="dk-form">
          <label className="dk-field">
            <span>Package</span>
            <select name="packageId" defaultValue={pkgId}>
              <option value="">Custom scope</option>
              {TRACKS.map((t) => (
                <optgroup key={t.id} label={t.label}>
                  {PACKAGES.filter((x) => x.track === t.id).map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="dk-field">
            <span>Track (for a custom scope)</span>
            <select name="track" defaultValue={e?.track ?? pkg?.track ?? "marketing"}>
              {TRACKS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="dk-field dk-field--wide">
            <span>Title (leave empty for “Client — Package”)</span>
            <input name="title" defaultValue={e?.title ?? ""} />
          </label>
          <div className="dk-chiprow">
            {SERVICES.map((s) => (
              <label key={s.id} className="dk-check">
                <input type="checkbox" name="services" value={s.id} defaultChecked={services.includes(s.id)} /> {s.title}
              </label>
            ))}
          </div>
        </div>
      </fieldset>
      <fieldset className="dk-fieldset">
        <legend>3 · Fee</legend>
        <div className="dk-form">
          <label className="dk-field">
            <span>How it&rsquo;s priced</span>
            <select name="feeModel" defaultValue={fee}>
              {(Object.keys(FEE_LABEL) as FeeModel[]).map((k) => (
                <option key={k} value={k}>
                  {FEE_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="dk-field">
            <span>Amount (USD) — flat, monthly or per unit; extra on % fees</span>
            <input name="amount" inputMode="decimal" defaultValue={e ? cents(e.amountCents) : ""} placeholder="1500" />
          </label>
          <label className="dk-field">
            <span>Percentage (for % of rent or commission)</span>
            <input name="pct" inputMode="decimal" defaultValue={e ? pctInput(e.pctBp) : ""} placeholder="8" />
          </label>
          <label className="dk-field">
            <span>Monthly rent it applies to (USD)</span>
            <input name="rentRoll" inputMode="decimal" defaultValue={e ? cents(e.rentRollCents) : ""} placeholder="42,000" />
          </label>
        </div>
      </fieldset>
      <fieldset className="dk-fieldset">
        <legend>4 · Agreement</legend>
        <div className="dk-form">
          <label className="dk-field">
            <span>Stage</span>
            <select name="status" defaultValue={e?.status ?? "proposal"}>
              {ENGAGEMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ENGAGEMENT_STAGE[s].label}
                </option>
              ))}
            </select>
          </label>
          <label className="dk-field">
            <span>Agreement signed on</span>
            <input name="agreementSignedOn" type="date" defaultValue={e?.agreementSignedOn ?? ""} />
          </label>
          <label className="dk-field dk-field--wide">
            <span>Where the signed agreement is kept</span>
            <input name="agreementRef" defaultValue={e?.agreementRef ?? ""} placeholder="E-sign envelope id, drive link or file name" />
          </label>
          <label className="dk-field">
            <span>Start</span>
            <input name="startDate" type="date" defaultValue={e?.startDate ?? ""} />
          </label>
          <label className="dk-field">
            <span>End (if fixed)</span>
            <input name="endDate" type="date" defaultValue={e?.endDate ?? ""} />
          </label>
          <label className="dk-field dk-field--wide">
            <span>Note</span>
            <textarea name="note" rows={2} defaultValue={e?.note ?? fromRequest?.note ?? ""} />
          </label>
          <p className="dk-hint">Brokerage, management and out-of-state work can only move to Signed or Active with a signing date. The deliverable checklist is added from the package when it does.</p>
        </div>
      </fieldset>
    </>
  );
}

export function EngagementForm({ self, fromRequest, presetPackage }: { self: Self; fromRequest?: RequestRow; presetPackage?: string }) {
  return (
    <RouteDrawer closeHref={self({ new: undefined, from: undefined, pkg: undefined })} kicker={fromRequest ? "From a request" : "New proposal"} title={fromRequest ? `Proposal for ${fromRequest.company || fromRequest.name}` : "Scope a new engagement"} width={720}>
      <form action={saveEngagement} className="dk-stack">
        <Hidden values={{ returnTo: self({ new: undefined, from: undefined, pkg: undefined }), requestId: fromRequest?.id ?? "" }} />
        <EngagementFields fromRequest={fromRequest} presetPackage={presetPackage} />
        <div className="dk-inline">
          <button className="dk-btn dk-btn--primary">
            <Icon name="check" size={14} /> Save engagement
          </button>
          <span className="dk-hint">Then send the proposal from the engagement.</span>
        </div>
      </form>
    </RouteDrawer>
  );
}

/* ------------------------------------------------------------------------
   Engagement dossier
   ------------------------------------------------------------------------ */

export function EngagementDrawer({
  e,
  self,
  today,
  invoices,
  canBooks,
  founder,
  contactId,
}: {
  e: EngagementRow;
  self: Self;
  today: string;
  invoices: Array<{ id: string; number: string; status: string; totalCents: number; currency: string; dueDate: string }>;
  canBooks: boolean;
  founder: boolean;
  contactId: string | null;
}) {
  const back = self();
  const pkg = e.packageId ? PACKAGE.get(e.packageId) : undefined;
  const stage = ENGAGEMENT_STAGE[e.status as EngagementStatus];
  const feeLine =
    e.feeModel === "percent"
      ? `${pctLabel(e.pctBp)} of ${fmtCents(e.rentRollCents, e.currency, { whole: true })}/mo rent${e.amountCents ? ` + ${fmtCents(e.amountCents, e.currency)}` : ""}`
      : e.feeModel === "commission"
        ? `${pctLabel(e.pctBp)} of first-year rent (${fmtCents(e.rentRollCents, e.currency, { whole: true })}/mo)`
        : e.feeModel === "per_unit"
          ? `${fmtCents(e.amountCents, e.currency)} × ${e.units} units`
          : fmtCents(e.amountCents, e.currency);
  const pct = e.tasks.length ? Math.round((e.done / e.tasks.length) * 100) : 0;
  return (
    <RouteDrawer closeHref={self({ eng: undefined })} kicker={`${TRACKS.find((x) => x.id === e.track)?.label ?? e.track} · ${pkg?.name ?? "Custom scope"}`} title={e.title} width={720}>
      <div className="dk-dossier">
        <div className="dk-chiprow">
          <Chip tone={stage?.tone ?? "ink"}>{stage?.label ?? e.status}</Chip>
          {e.value.monthly ? <Chip tone="value">{fmtCents(e.value.monthly, e.currency, { whole: true })} / month</Chip> : null}
          {e.value.once ? <Chip tone="value">{fmtCents(e.value.once, e.currency, { whole: true })} one-time</Chip> : null}
          {e.agreementSignedOn ? <Chip tone="good">signed {e.agreementSignedOn}</Chip> : <Chip tone="warn">not signed</Chip>}
          {e.proposalSentAt ? <Chip tone="ink">proposal emailed {when(e.proposalSentAt, false)}</Chip> : null}
          {e.userId ? (
            <Link prefetch={false} className="dk-chip dk-chip--value" href={`/admin/accounts/${e.userId}`}>
              client account →
            </Link>
          ) : null}
          {contactId ? (
            <Link prefetch={false} className="dk-chip dk-chip--brand" href={`/admin/crm/${contactId}`}>
              CRM →
            </Link>
          ) : null}
          {e.requestId ? (
            <Link prefetch={false} className="dk-chip" href={self({ eng: undefined, tab: undefined, open: e.requestId })}>
              original request →
            </Link>
          ) : null}
        </div>
        <dl className="dk-dossier__facts">
          <div>
            <dt>Client</dt>
            <dd>
              {e.clientName}
              {e.clientCompany ? ` · ${e.clientCompany}` : ""} · <a href={`mailto:${e.clientEmail}`}>{e.clientEmail}</a>
            </dd>
          </div>
          <div>
            <dt>Property</dt>
            <dd>{[e.address, e.market].filter(Boolean).join(", ") || "—"}</dd>
          </div>
          <div>
            <dt>Fee</dt>
            <dd>{e.feeModel === "percent" || e.feeModel === "commission" ? feeLine : `${FEE_LABEL[e.feeModel as FeeModel] ?? e.feeModel}: ${feeLine}`}</dd>
          </div>
          <div>
            <dt>Agreement</dt>
            <dd>{e.agreementRef || "—"}</dd>
          </div>
          <div>
            <dt>Dates</dt>
            <dd>{[e.startDate, e.endDate].filter(Boolean).join(" → ") || "—"}</dd>
          </div>
          <div>
            <dt>Client based in</dt>
            <dd>{e.ownerLocation || "—"}</dd>
          </div>
        </dl>

        <div className="dk-inline">
          <form action={engagementAction}>
            <Hidden values={{ id: e.id, returnTo: back }} />
            <button className="dk-btn dk-btn--primary dk-btn--sm" name="op" value="proposal">
              <Icon name="mail" size={13} /> {e.status === "proposal" ? "Email the proposal" : "Email the scope again"}
            </button>
          </form>
          {canBooks ? (
            <form action={engagementAction}>
              <Hidden values={{ id: e.id, returnTo: back }} />
              <button className="dk-btn dk-btn--value dk-btn--sm" name="op" value="bill">
                <Icon name="invoice" size={13} /> Draft an invoice
              </button>
            </form>
          ) : null}
          {e.track === "management" || e.track === "owners" ? (
            <Link prefetch={false} className="dk-btn dk-btn--sm" href={self({ eng: undefined, tab: "portfolio", newprop: "1", pe: e.id })} scroll={false}>
              <Icon name="plus" size={13} /> Add a managed property
            </Link>
          ) : null}
        </div>

        <Panel kicker={`${e.done} of ${e.tasks.length} done`} title="Deliverables" sub={e.tasks.length ? `${pct}% complete${e.overdue ? ` · ${e.overdue} late` : ""}` : "The checklist is added from the package when the engagement is signed."}>
          {e.tasks.length ? (
            <ul className="dk-checklist">
              {e.tasks.map((x) => {
                const late = !x.doneAt && x.dueDate && x.dueDate < today;
                return (
                  <li key={x.id} className={x.doneAt ? "is-ok" : late ? "is-bad" : undefined}>
                    <form action={engagementAction} style={{ display: "contents" }}>
                      <Hidden values={{ id: e.id, returnTo: back, taskId: x.id }} />
                      <button className="dk-iconbtn" name="op" value="task" aria-label={x.doneAt ? `Reopen ${x.title}` : `Mark ${x.title} done`} title={x.doneAt ? "Reopen" : "Mark done"}>
                        <Icon name={x.doneAt ? "check" : "clock"} size={15} />
                      </button>
                    </form>
                    <span style={{ flex: 1 }}>{x.title}</span>
                    <small>{x.doneAt ? `done ${when(x.doneAt, false)}` : x.dueDate ? `due ${x.dueDate}` : ""}</small>
                    <form action={engagementAction} style={{ display: "contents" }}>
                      <Hidden values={{ id: e.id, returnTo: back, taskId: x.id }} />
                      <button className="dk-iconbtn" name="op" value="deltask" aria-label={`Remove ${x.title}`} title="Remove">
                        <Icon name="close" size={13} />
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          ) : pkg ? (
            <form action={engagementAction}>
              <Hidden values={{ id: e.id, returnTo: back }} />
              <button className="dk-btn dk-btn--sm" name="op" value="seed">
                Add the {pkg.tasks.length} package steps now
              </button>
            </form>
          ) : null}
          <form action={engagementAction} className="dk-inline" style={{ marginTop: 10 }}>
            <Hidden values={{ id: e.id, returnTo: back, op: "addtask" }} />
            <input name="title" placeholder="Add a step" aria-label="New step" />
            <input name="dueDate" type="date" aria-label="Due date" />
            <button className="dk-btn dk-btn--sm">Add</button>
          </form>
        </Panel>

        {e.properties.length ? (
          <Panel kicker="Managed" title="Properties">
            <ul className="dk-feed">
              {e.properties.map((x) => (
                <li key={x.id}>
                  <span className="dk-feed__icon">
                    <Icon name="building" size={15} />
                  </span>
                  <div>
                    <Link prefetch={false} href={self({ eng: undefined, tab: "portfolio", prop: x.id })}>
                      <b>{x.name}</b>
                    </Link>
                    <p>
                      {x.occupied}/{x.units} occupied · {x.status}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}

        {canBooks ? (
          <Panel kicker="Books" title="Invoices" sub="Paid invoices land in the books as commissions, management fees or marketing services.">
            {invoices.length ? (
              <ul className="dk-feed">
                {invoices.map((i) => (
                  <li key={i.id}>
                    <span className={`dk-feed__icon${i.status === "paid" ? " dk-feed__icon--good" : i.status === "sent" && i.dueDate < today ? " dk-feed__icon--bad" : " dk-feed__icon--value"}`}>
                      <Icon name="invoice" size={15} />
                    </span>
                    <div>
                      <Link prefetch={false} href={`/admin/books?tab=invoices&open=${i.id}`}>
                        <b>{i.number}</b>
                      </Link>
                      <p>
                        {i.status} · due {i.dueDate}
                      </p>
                    </div>
                    <time className="dk-num">{fmtCents(i.totalCents, i.currency)}</time>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dk-hint">No invoices yet.</p>
            )}
          </Panel>
        ) : null}

        <details className="dk-details">
          <summary>Edit the engagement</summary>
          <form action={saveEngagement} className="dk-stack" style={{ marginTop: 12 }}>
            <Hidden values={{ id: e.id, returnTo: back }} />
            <EngagementFields e={e} />
            <button className="dk-btn dk-btn--primary">
              <Icon name="check" size={14} /> Save changes
            </button>
          </form>
        </details>
        {founder ? (
          <form action={engagementAction} className="dk-inline">
            <Hidden values={{ id: e.id, returnTo: back }} />
            <button className="dk-btn dk-btn--ghost dk-btn--sm" name="op" value="delete">
              Delete engagement
            </button>
          </form>
        ) : null}
      </div>
    </RouteDrawer>
  );
}

/* ------------------------------------------------------------------------
   Managed portfolio
   ------------------------------------------------------------------------ */

function PropertyFields({ pr, engagements, presetEngagement }: { pr?: PropertyRow; engagements: EngagementRow[]; presetEngagement?: string }) {
  const pe = presetEngagement ? engagements.find((x) => x.id === presetEngagement) : undefined;
  const pctDefault = pr ? pctInput(pr.pctBp) : pe && pe.feeModel === "percent" ? pctInput(pe.pctBp) : "";
  return (
    <div className="dk-form">
      <label className="dk-field">
        <span>Name</span>
        <input name="name" required defaultValue={pr?.name ?? (pe ? pe.address || pe.title : "")} placeholder="The Halsey, 12 units" />
      </label>
      <label className="dk-field">
        <span>Type</span>
        <select name="kind" defaultValue={pr?.kind ?? "building"}>
          {PROPERTY_KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      <label className="dk-field">
        <span>Address</span>
        <input name="address" defaultValue={pr?.address ?? pe?.address ?? ""} />
      </label>
      <label className="dk-field">
        <span>Market</span>
        <input name="market" defaultValue={pr?.market ?? pe?.market ?? ""} />
      </label>
      <label className="dk-field">
        <span>Units / rooms</span>
        <input name="units" type="number" min={1} required defaultValue={pr?.units ?? (pe?.units || 1)} />
      </label>
      <label className="dk-field">
        <span>Occupied</span>
        <input name="occupied" type="number" min={0} defaultValue={pr?.occupied ?? 0} />
      </label>
      <label className="dk-field">
        <span>Monthly rent roll (USD)</span>
        <input name="rentRoll" inputMode="decimal" defaultValue={pr ? cents(pr.rentRollCents) : pe ? cents(pe.rentRollCents) : ""} />
      </label>
      <label className="dk-field">
        <span>Management fee (% of rent collected)</span>
        <input name="pct" inputMode="decimal" defaultValue={pctDefault} placeholder="8" />
      </label>
      <label className="dk-field">
        <span>Flat monthly fee (USD, optional)</span>
        <input name="flatFee" inputMode="decimal" defaultValue={pr ? cents(pr.flatFeeCents) : ""} />
      </label>
      <label className="dk-field">
        <span>Status</span>
        <select name="status" defaultValue={pr?.status ?? "onboarding"}>
          {PROPERTY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="dk-field">
        <span>Owner name</span>
        <input name="ownerName" required defaultValue={pr?.ownerName ?? pe?.clientName ?? ""} />
      </label>
      <label className="dk-field">
        <span>Owner email (statements go here)</span>
        <input name="ownerEmail" type="email" required defaultValue={pr?.ownerEmail ?? pe?.clientEmail ?? ""} />
      </label>
      <label className="dk-field">
        <span>Owner is based in</span>
        <input name="ownerLocation" defaultValue={pr?.ownerLocation ?? pe?.ownerLocation ?? ""} />
      </label>
      <label className="dk-field">
        <span>Engagement</span>
        <select name="engagementId" defaultValue={pr?.engagementId ?? pe?.id ?? ""}>
          <option value="">None</option>
          {engagements
            .filter((x) => x.status !== "cancelled")
            .map((x) => (
              <option key={x.id} value={x.id}>
                {x.title}
              </option>
            ))}
        </select>
      </label>
      <label className="dk-field dk-field--wide">
        <span>RentLeaks listing ids for these units (comma separated)</span>
        <input name="listingIds" defaultValue={pr ? JSON.parse(pr.listingIds || "[]").join(", ") : ""} />
      </label>
      <label className="dk-field dk-field--wide">
        <span>Note (vendors, spending limit, access)</span>
        <textarea name="note" rows={2} defaultValue={pr?.note ?? ""} />
      </label>
    </div>
  );
}

export function PortfolioView({
  properties,
  engagements,
  self,
  showNew,
  presetEngagement,
  today,
}: {
  properties: PropertyRow[];
  engagements: EngagementRow[];
  self: Self;
  showNew: boolean;
  presetEngagement?: string;
  today: string;
}) {
  const active = properties.filter((x) => x.status === "active");
  const units = active.reduce((n, x) => n + x.units, 0);
  const occ = active.reduce((n, x) => n + Math.min(x.units, x.occupied), 0);
  const rent = active.reduce((n, x) => n + x.rentRollCents, 0);
  const fees = active.reduce((n, x) => n + Math.round((x.rentRollCents * x.pctBp) / 10_000) + x.flatFeeCents, 0);
  const month = statementMonth(today);
  return (
    <>
      <div className="dk-grid dk-grid--2-1">
        <Panel
          flush
          kicker={`${active.length} active · ${properties.length} in all`}
          title="Managed properties"
          actions={
            <>
              <Link prefetch={false} className="dk-btn dk-btn--ghost dk-btn--sm" href="/api/admin/export/statements">
                <Icon name="export" size={13} /> Statements CSV
              </Link>
              <Link prefetch={false} className="dk-btn dk-btn--primary dk-btn--sm" href={self({ newprop: "1", prop: undefined })} scroll={false}>
                <Icon name="plus" size={13} /> Add property
              </Link>
            </>
          }
        >
          {properties.length ? (
            <div className="dk-tablewrap">
              <table className="dk-table">
                <thead>
                  <tr>
                    <th>Property</th>
                    <th>Owner</th>
                    <th className="dk-right">Units</th>
                    <th>Occupancy</th>
                    <th className="dk-right">Rent roll</th>
                    <th className="dk-right">Fee</th>
                    <th>Statement</th>
                  </tr>
                </thead>
                <tbody>
                  {properties.map((x) => (
                    <tr key={x.id}>
                      <td className="dk-wrap">
                        <Link prefetch={false} href={self({ prop: x.id, newprop: undefined })} scroll={false}>
                          <b>{x.name}</b>
                        </Link>
                        <div className="dk-dim">
                          {label(PROPERTY_KINDS, x.kind)}
                          {x.market ? ` · ${x.market}` : ""} · {x.status}
                        </div>
                      </td>
                      <td className="dk-wrap">
                        {x.ownerName}
                        {x.ownerLocation ? <div className="dk-dim">{x.ownerLocation}</div> : null}
                      </td>
                      <td className="dk-right dk-num">{x.units}</td>
                      <td>
                        <span className="dk-occ" style={{ ["--p" as string]: `${x.occ}%` }}>
                          <i />
                        </span>{" "}
                        <small className="dk-num">{x.occ}%</small>
                      </td>
                      <td className="dk-right dk-num">{fmtCents(x.rentRollCents, x.currency, { whole: true })}</td>
                      <td className="dk-right dk-num">{x.pctBp ? pctLabel(x.pctBp) : x.flatFeeCents ? fmtCents(x.flatFeeCents, x.currency, { whole: true }) : "—"}</td>
                      <td>{x.due ? <Chip tone="warn">{month} due</Chip> : x.statements[0] ? <Chip tone={x.statements[0].sentAt ? "good" : "ink"}>{x.statements[0].month}{x.statements[0].sentAt ? " sent" : " draft"}</Chip> : <Chip>none yet</Chip>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="No managed properties yet.">Add a building, a multi-room home or a furnished portfolio — then send the owner a statement every month.</Empty>
          )}
        </Panel>
        <Panel kicker="Active buildings" title="Portfolio health">
          <Gauge pct={units ? (occ / units) * 100 : 0} label="Occupied" sub={`${occ} of ${units} units`} />
          <dl className="dk-dossier__facts" style={{ marginTop: 12 }}>
            <div>
              <dt>Rent under management</dt>
              <dd className="dk-num">{fmtCents(rent, "USD", { whole: true })}/mo</dd>
            </div>
            <div>
              <dt>Our fees at full collection</dt>
              <dd className="dk-num">{fmtCents(fees, "USD", { whole: true })}/mo</dd>
            </div>
          </dl>
          <p className="dk-hint">Owners&rsquo; rent is client money: keep it in the trust account. Only the fee goes in the books.</p>
        </Panel>
      </div>
      {showNew ? (
        <RouteDrawer closeHref={self({ newprop: undefined, pe: undefined })} kicker="Managed portfolio" title="Add a property" width={680}>
          <form action={saveProperty} className="dk-stack">
            <Hidden values={{ returnTo: self({ newprop: undefined, pe: undefined }) }} />
            <PropertyFields engagements={engagements} presetEngagement={presetEngagement} />
            <button className="dk-btn dk-btn--primary">
              <Icon name="check" size={14} /> Add property
            </button>
          </form>
        </RouteDrawer>
      ) : null}
    </>
  );
}

export function PropertyDrawer({ pr, self, today, canBooks, engagements }: { pr: PropertyRow; self: Self; today: string; canBooks: boolean; engagements: EngagementRow[] }) {
  const back = self();
  const month = statementMonth(today);
  const editing = pr.statements.find((s) => s.month === month) ?? null;
  const lines = editing ? parseExpenseLines(editing.expenseLines) : [];
  const rows = [...pr.statements].reverse().slice(-6);
  return (
    <RouteDrawer closeHref={self({ prop: undefined })} kicker={`${label(PROPERTY_KINDS, pr.kind)} · ${pr.status}`} title={pr.name} width={740}>
      <div className="dk-dossier">
        <div className="dk-grid dk-grid--2">
          <Gauge pct={pr.occ} label="Occupied" sub={`${pr.occupied} of ${pr.units}`} />
          <dl className="dk-dossier__facts">
            <div>
              <dt>Owner</dt>
              <dd>
                {pr.ownerName} · <a href={`mailto:${pr.ownerEmail}`}>{pr.ownerEmail}</a>
              </dd>
            </div>
            <div>
              <dt>Based in</dt>
              <dd>{pr.ownerLocation || "—"}</dd>
            </div>
            <div>
              <dt>Rent roll</dt>
              <dd className="dk-num">{fmtCents(pr.rentRollCents, pr.currency)}/mo</dd>
            </div>
            <div>
              <dt>Fee</dt>
              <dd>
                {pr.pctBp ? `${pctLabel(pr.pctBp)} of rent collected` : "—"}
                {pr.flatFeeCents ? ` + ${fmtCents(pr.flatFeeCents, pr.currency)}` : ""}
              </dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>{[pr.address, pr.market].filter(Boolean).join(", ") || "—"}</dd>
            </div>
            <div>
              <dt>Engagement</dt>
              <dd>
                {pr.engagementId ? (
                  <Link prefetch={false} href={self({ prop: undefined, tab: "engagements", eng: pr.engagementId })}>
                    {engagements.find((x) => x.id === pr.engagementId)?.title ?? "open"}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
        </div>

        {rows.length > 1 ? (
          <Panel kicker="Last statements" title="Net to the owner">
            <Columns fmt="usd" rows={rows.map((s) => ({ label: s.month.slice(2), value: Math.round(s.netCents / 100) }))} />
          </Panel>
        ) : null}

        <Panel kicker={pr.due ? "Due now" : "Monthly"} title={`Statement for ${monthName(month)}`} sub="Rent collected, what you paid for the owner, the fee (worked out for you) and the net.">
          <form action={saveStatement} className="dk-form">
            <Hidden values={{ propertyId: pr.id, returnTo: back }} />
            <label className="dk-field">
              <span>Month</span>
              <input name="month" type="month" defaultValue={month} required />
            </label>
            <label className="dk-field">
              <span>Rent collected (USD)</span>
              <input name="collected" inputMode="decimal" required defaultValue={editing ? cents(editing.collectedCents) : cents(Math.round((pr.rentRollCents * pr.occ) / 100))} />
            </label>
            <label className="dk-field">
              <span>Occupied units at month end</span>
              <input name="occupied" type="number" min={0} max={pr.units} defaultValue={editing?.occupied ?? pr.occupied} />
            </label>
            <fieldset className="dk-fieldset">
              <legend>Paid for the owner</legend>
              <div className="dk-items" style={{ gridTemplateColumns: "minmax(0,1fr) 140px" }}>
                <span>What</span>
                <span>Amount</span>
                {Array.from({ length: 5 }, (_, i) => [
                  <input key={`l${i}`} name="expLabel" aria-label={`Expense ${i + 1}`} placeholder={i === 0 ? "Plumber — unit 3B" : ""} defaultValue={lines[i]?.label ?? ""} />,
                  <input key={`a${i}`} name="expAmount" aria-label={`Expense ${i + 1} amount`} inputMode="decimal" placeholder={i === 0 ? "240.00" : ""} defaultValue={lines[i] ? cents(lines[i].amountCents) : ""} />,
                ])}
              </div>
            </fieldset>
            <label className="dk-field dk-field--wide">
              <span>Note to the owner</span>
              <textarea name="note" rows={2} defaultValue={editing?.note ?? ""} placeholder="Unit 2A renewed for 12 months; boiler service booked." />
            </label>
            <div className="dk-inline dk-field--wide">
              <button className="dk-btn">Save</button>
              <button className="dk-btn dk-btn--primary" name="send" value="1">
                <Icon name="mail" size={14} /> Save and email the owner
              </button>
            </div>
          </form>
        </Panel>

        <Panel flush kicker="History" title="Statements">
          {pr.statements.length ? (
            <div className="dk-tablewrap">
              <table className="dk-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th className="dk-right">Collected</th>
                    <th className="dk-right">Paid out</th>
                    <th className="dk-right">Fee</th>
                    <th className="dk-right">Net</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pr.statements.map((s) => (
                    <tr key={s.id}>
                      <td>
                        {monthName(s.month)}
                        <div className="dk-dim">{s.sentAt ? `sent ${when(s.sentAt, false)}` : "not sent"}</div>
                      </td>
                      <td className="dk-right dk-num">{fmtCents(s.collectedCents, pr.currency)}</td>
                      <td className="dk-right dk-num">{fmtCents(s.expensesCents, pr.currency)}</td>
                      <td className="dk-right dk-num">{fmtCents(s.feeCents, pr.currency)}</td>
                      <td className="dk-right dk-num">
                        <b>{fmtCents(s.netCents, pr.currency)}</b>
                      </td>
                      <td>
                        <form action={statementAction} className="dk-inline">
                          <Hidden values={{ id: s.id, returnTo: back }} />
                          <button className="dk-btn dk-btn--sm" name="op" value="send">
                            {s.sentAt ? "Resend" : "Send"}
                          </button>
                          {canBooks ? (
                            s.invoiceId ? (
                              <Link prefetch={false} className="dk-btn dk-btn--ghost dk-btn--sm" href={`/admin/books?tab=invoices&open=${s.invoiceId}`}>
                                Invoice
                              </Link>
                            ) : (
                              <button className="dk-btn dk-btn--ghost dk-btn--sm" name="op" value="bill" disabled={!s.feeCents}>
                                Bill fee
                              </button>
                            )
                          ) : null}
                          <button className="dk-btn dk-btn--ghost dk-btn--sm" name="op" value="delete" aria-label={`Delete ${s.month}`}>
                            <Icon name="close" size={12} />
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="No statements yet." />
          )}
        </Panel>

        <details className="dk-details">
          <summary>Edit the property</summary>
          <form action={saveProperty} className="dk-stack" style={{ marginTop: 12 }}>
            <Hidden values={{ id: pr.id, returnTo: back }} />
            <PropertyFields pr={pr} engagements={engagements} />
            <button className="dk-btn dk-btn--primary">
              <Icon name="check" size={14} /> Save property
            </button>
          </form>
        </details>
      </div>
    </RouteDrawer>
  );
}

/* ------------------------------------------------------------------------
   Catalogue & licence
   ------------------------------------------------------------------------ */

export function CatalogueView({ settings, founder, self }: { settings: { broker: BrokerDetails; prices: Record<string, string>; formOpen: boolean }; founder: boolean; self: Self }) {
  const b = settings.broker;
  const ok = brokerComplete(b);
  return (
    <>
      <Panel kicker="What rentleaks.com/enterprise/ shows" title="Packages" sub="The same list the public pages, the request form and proposals use. “From” prices appear only where you set one.">
        <div className="dk-ent-packs">
          {TRACKS.map((t) => (
            <section key={t.id}>
              <p className="dk-kicker">{t.label}</p>
              {PACKAGES.filter((x) => x.track === t.id).map((x) => (
                <article key={x.id} className={`dk-ent-pack${x.featured ? " is-featured" : ""}`}>
                  <header>
                    <b>{x.name}</b>
                    <Chip tone={settings.prices[x.id] ? "value" : "ink"}>{settings.prices[x.id] ?? "quote"}</Chip>
                  </header>
                  <small>{x.tagline}</small>
                  <ul>
                    {x.includes.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                  <small className="dk-dim">
                    {x.basis} · {x.tasks.length} deliverables
                  </small>
                </article>
              ))}
            </section>
          ))}
        </div>
      </Panel>

      <Panel kicker="On every enterprise page" title="Licence & prices" sub={ok ? brokerLine(b) : "Broker advertising must show the licensed broker's name, that they are a licensed real estate broker, and an address or phone number."}>
        {founder ? (
          <form action={enterpriseSettingsAction} className="dk-form">
            <Hidden values={{ returnTo: self() }} />
            <label className="dk-field">
              <span>Licensed broker or brokerage name</span>
              <input name="brokerName" defaultValue={b.name} placeholder="As it appears on the licence" />
            </label>
            <label className="dk-field">
              <span>Licence number</span>
              <input name="brokerLicence" defaultValue={b.licence} />
            </label>
            <label className="dk-field">
              <span>States (two letters, comma separated)</span>
              <input name="brokerStates" defaultValue={b.states} placeholder="NY, NJ" />
            </label>
            <label className="dk-field">
              <span>Office phone</span>
              <input name="brokerPhone" defaultValue={b.phone} />
            </label>
            <label className="dk-field dk-field--wide">
              <span>Office address</span>
              <input name="brokerAddress" defaultValue={b.address} />
            </label>
            <label className="dk-field">
              <span>Enterprise email (optional)</span>
              <input name="brokerEmail" type="email" defaultValue={b.email} />
            </label>
            <label className="dk-check">
              <input type="checkbox" name="formOpen" defaultChecked={settings.formOpen} /> Take requests on the public form
            </label>
            <fieldset className="dk-fieldset">
              <legend>“From” prices (optional — leave empty to show “Custom quote”)</legend>
              <div className="dk-form">
                {PACKAGES.map((x) => (
                  <label key={x.id} className="dk-field">
                    <span>
                      {TRACKS.find((t) => t.id === x.track)?.label} · {x.name}
                    </span>
                    <input name={`price_${x.id}`} defaultValue={settings.prices[x.id] ?? ""} placeholder={x.fee === "percent" ? "from 8% of rent" : x.fee === "commission" ? "from 8% of annual rent" : "from $1,500 / building"} />
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="dk-hint">New York licensees also get a link to the state&rsquo;s Housing and Anti-Discrimination Notice on every page. Check your own state&rsquo;s advertising rules too.</p>
            <button className="dk-btn dk-btn--primary">
              <Icon name="check" size={14} /> Save
            </button>
          </form>
        ) : (
          <p className="dk-hint">Only the account owner can change the licence details and prices.</p>
        )}
      </Panel>
    </>
  );
}
