import Link from "next/link";
import { Board, type BoardCard } from "@/components/admin/desk/Board";
import { Donut, FunnelLanes, Kpi, RankedBars } from "@/components/admin/desk/charts";
import { DeskHeader, type Signal } from "@/components/admin/desk/DeskHeader";
import { Icon } from "@/components/admin/desk/Icon";
import { Chip, CommandRail, Empty, MarkTile, Panel } from "@/components/admin/desk/parts";
import { flashOf, qs, readParams, type SP } from "@/components/admin/ui";
import { canAccess, isFounder } from "@/lib/access";
import { requireAdminPage } from "@/lib/admin/guard";
import { nowMs } from "@/lib/admin/metrics";
import { fmtCents } from "@/lib/books/core";
import { booksToday } from "@/lib/books/data";
import {
  brokerComplete,
  ENGAGEMENT_STAGE,
  engagementValue,
  occupancy,
  PACKAGE,
  REQUEST_STAGE,
  requestScore,
  SERVICE,
  SERVICE_SHORT,
  SERVICES,
  statementDue,
  statementMonth,
  type EngagementStatus,
  type ServiceId,
} from "@/lib/enterprise/catalog";
import { enterpriseSettings } from "@/lib/enterprise/data";
import { prisma } from "@/lib/prisma";
import { CatalogueView, EngagementDrawer, EngagementForm, PortfolioView, PropertyDrawer, RequestDrawer, type EngagementRow, type PropertyRow, type RequestRow } from "./views";

export const metadata = { title: "Enterprise services — RentLeaks desk" };

const DAY = 86_400_000;
const TABS = ["pipeline", "engagements", "portfolio", "catalogue"] as const;
type Tab = (typeof TABS)[number];
const PUBLIC_URL = "https://rentleaks.com/enterprise/";

const PROPERTY_LABEL: Record<string, string> = {
  building: "Building",
  complex: "Complex",
  portfolio: "Portfolio",
  multi_room: "Multi-room home",
  furnished: "Furnished",
  single: "Single home",
  development: "New development",
};

const listOf = (json: string) => {
  try {
    const v = JSON.parse(json) as unknown;
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
};

/**
 * Enterprise: the desk side of rentleaks.com/enterprise/. Requests come in on
 * a pipeline; a proposal becomes an engagement with a deliverable checklist;
 * managed buildings get a monthly owner statement; the catalogue tab holds the
 * licence strip and the optional "from" prices the public pages show.
 */
export default async function EnterprisePage({ searchParams }: { searchParams: SP }) {
  const me = await requireAdminPage("/admin/enterprise");
  const p = await readParams(searchParams);
  const t = nowMs();
  const today = booksToday(new Date(t));
  const tab: Tab = (TABS as readonly string[]).includes(p.tab) ? (p.tab as Tab) : "pipeline";
  const self = (over: Record<string, string | undefined> = {}) => `/admin/enterprise${qs(p, { ok: undefined, err: undefined, ...over })}`;
  const founder = isFounder(me);
  const canBooks = canAccess(me, "books");

  const safe = <T,>(q: Promise<T>, f: T) =>
    q.then(
      (v) => ({ v, failed: false }),
      (err: unknown) => {
        console.error("[admin/enterprise]", err instanceof Error ? err.message : err);
        return { v: f, failed: true };
      },
    );
  const [requestsRes, engagementsRes, propertiesRes, settings, team] = await Promise.all([
    safe(prisma.serviceRequest.findMany({ where: { status: { not: "spam" } }, orderBy: { createdAt: "desc" }, take: 400 }), []),
    safe(
      prisma.engagement.findMany({
        orderBy: { updatedAt: "desc" },
        take: 300,
        include: { tasks: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] }, properties: { select: { id: true, name: true, units: true, occupied: true, status: true } } },
      }),
      [],
    ),
    safe(prisma.managedProperty.findMany({ orderBy: { name: "asc" }, take: 300, include: { statements: { orderBy: { month: "desc" }, take: 12 } } }), []),
    enterpriseSettings().catch(() => ({ broker: { name: "", licence: "", states: "", phone: "", address: "", email: "" }, prices: {} as Record<string, string>, formOpen: true })),
    prisma.user.findMany({ where: { role: { in: ["admin", "staff"] } }, select: { id: true, name: true } }).catch(() => []),
  ]);
  const pending = requestsRes.failed || engagementsRes.failed || propertiesRes.failed;
  const [requestsRaw, engagementsRaw, propertiesRaw] = [requestsRes.v, engagementsRes.v, propertiesRes.v];
  const staff = new Map(team.map((u) => [u.id, u.name]));

  const requests: RequestRow[] = requestsRaw.map((r) => ({ ...r, serviceIds: listOf(r.services) as ServiceId[], addOnIds: listOf(r.addOns), assignedName: r.assignedToId ? (staff.get(r.assignedToId) ?? null) : null }));
  const engagements: EngagementRow[] = engagementsRaw.map((e) => {
    const v = engagementValue(e);
    const done = e.tasks.filter((x) => x.doneAt).length;
    const overdue = e.tasks.filter((x) => !x.doneAt && x.dueDate && x.dueDate < today).length;
    return { ...e, serviceIds: listOf(e.services) as ServiceId[], value: v, done, overdue };
  });
  const properties: PropertyRow[] = propertiesRaw.map((pr) => ({
    ...pr,
    occ: occupancy(pr.units, pr.occupied),
    due: statementDue({ status: pr.status, lastMonth: pr.statements[0]?.month ?? null }, today),
  }));

  /* ---- numbers ---- */
  const open = requests.filter((r) => ["new", "contacted", "proposal"].includes(r.status));
  const fresh = requests.filter((r) => r.status === "new");
  const waiting = fresh.filter((r) => t - r.createdAt.getTime() > DAY);
  const r90 = requests.filter((r) => t - r.createdAt.getTime() < 90 * DAY);
  const won90 = r90.filter((r) => r.status === "won").length;
  const closed90 = r90.filter((r) => r.status === "won" || r.status === "lost").length;
  const live = engagements.filter((e) => e.status === "signed" || e.status === "active");
  const mrr = live.reduce((n, e) => n + e.value.monthly, 0);
  const pipelineOnce = engagements.filter((e) => e.status === "proposal").reduce((n, e) => n + e.value.once + e.value.monthly * 12, 0);
  const activeProps = properties.filter((x) => x.status === "active");
  const unitsManaged = activeProps.reduce((n, x) => n + x.units, 0);
  const occupiedUnits = activeProps.reduce((n, x) => n + Math.min(x.units, x.occupied), 0);
  const statementsDue = properties.filter((x) => x.due);
  const overdueTasks = live.reduce((n, e) => n + e.overdue, 0);
  const brokerOk = brokerComplete(settings.broker);

  const signals: Signal[] = [
    {
      label: "Requests",
      value: fresh.length ? `${fresh.length} new${waiting.length ? ` · ${waiting.length} over a day` : ""}` : "all answered",
      tone: waiting.length ? "critical" : fresh.length ? "warn" : "ok",
      href: self({ tab: undefined, status: "new", open: undefined }),
    },
    {
      label: "Licence on the pages",
      value: brokerOk ? `${settings.broker.states || "set"}` : "missing",
      tone: brokerOk ? "ok" : "critical",
      href: self({ tab: "catalogue", open: undefined }),
    },
    {
      label: `Statements for ${statementMonth(today)}`,
      value: statementsDue.length ? `${statementsDue.length} to send` : activeProps.length ? "all sent" : "no managed buildings",
      tone: statementsDue.length ? "warn" : "ok",
      href: self({ tab: "portfolio", open: undefined }),
    },
  ];

  /* ---- board cards ---- */
  const statusFilter = p.status && p.status in REQUEST_STAGE ? p.status : "";
  const requestCards: BoardCard[] = requests
    .filter((r) => (statusFilter ? r.status === statusFilter : true))
    .filter((r) => r.status !== "lost" || t - r.updatedAt.getTime() < 60 * DAY)
    .map((r) => {
      const s = requestScore({ ...r, services: r.serviceIds, message: r.message });
      return {
        id: r.id,
        column: r.status,
        title: r.company || r.name,
        sub: [PROPERTY_LABEL[r.propertyKind] ?? r.propertyKind, r.units ? `${r.units} units` : "", r.market ?? r.address ?? ""].filter(Boolean).join(" · "),
        initials: (r.company || r.name).slice(0, 2).toUpperCase(),
        score: s.score,
        chips: [
          ...(r.outOfState ? [{ label: "out of state", tone: "value" }] : []),
          ...(r.timeline === "now" ? [{ label: "needs it now", tone: "bad" }] : []),
          ...r.serviceIds
            .filter((x) => !(r.outOfState && x === "remote"))
            .slice(0, 2)
            .map((x) => ({ label: SERVICE_SHORT[x] ?? x, tone: SERVICE.get(x)?.licensed ? "brand" : "" })),
        ],
        lines: [r.packageId ? `Package: ${PACKAGE.get(r.packageId)?.name ?? r.packageId}` : "", r.lostReason && r.status === "lost" ? `Lost: ${r.lostReason}` : "", r.assignedName ? `Owner: ${r.assignedName}` : ""].filter(Boolean),
        alert: r.status === "new" && t - r.createdAt.getTime() > DAY ? "Waiting over a day" : undefined,
        href: self({ open: r.id }),
      };
    });

  const engagementCards: BoardCard[] = engagements
    .filter((e) => e.status !== "cancelled")
    .map((e) => ({
      id: e.id,
      column: e.status,
      title: e.title,
      sub: `${e.clientName}${e.clientCompany ? ` · ${e.clientCompany}` : ""}`,
      initials: (e.clientCompany || e.clientName).slice(0, 2).toUpperCase(),
      chips: [
        ...(e.value.monthly ? [{ label: `${fmtCents(e.value.monthly, e.currency, { whole: true })}/mo`, tone: "value" }] : []),
        ...(e.value.once ? [{ label: `${fmtCents(e.value.once, e.currency, { whole: true })} once`, tone: "value" }] : []),
        ...(e.tasks.length ? [{ label: `${e.done}/${e.tasks.length} steps`, tone: e.done === e.tasks.length ? "good" : "" }] : []),
        ...(e.overdue ? [{ label: `${e.overdue} late`, tone: "bad" }] : []),
      ],
      lines: [e.address || e.market || "", e.properties.length ? `${e.properties.length} managed propert${e.properties.length === 1 ? "y" : "ies"}` : ""].filter(Boolean),
      href: self({ tab: "engagements", eng: e.id }),
    }));

  /* ---- charts ---- */
  const byService = SERVICES.map((s) => ({ label: SERVICE_SHORT[s.id], value: r90.filter((r) => r.serviceIds.includes(s.id)).length })).filter((x) => x.value > 0);
  const byMarket = new Map<string, number>();
  for (const r of r90) {
    const k = (r.market || "Unspecified").trim();
    byMarket.set(k, (byMarket.get(k) ?? 0) + (r.units ?? 0));
  }

  const openRequest = p.open ? requests.find((r) => r.id === p.open) : undefined;
  const openEngagement = p.eng ? engagements.find((e) => e.id === p.eng) : undefined;
  const openProperty = p.prop ? properties.find((x) => x.id === p.prop) : undefined;
  const fromRequest = p.from ? requests.find((r) => r.id === p.from) : undefined;
  const lookups = await Promise.all([
    openRequest ? prisma.contact.findUnique({ where: { email: openRequest.email }, select: { id: true, stage: true } }).catch(() => null) : null,
    openRequest && canAccess(me, "accounts") ? prisma.user.findUnique({ where: { email: openRequest.email }, select: { id: true, role: true } }).catch(() => null) : null,
    openEngagement && canBooks ? prisma.invoice.findMany({ where: { engagementId: openEngagement.id }, orderBy: { issueDate: "desc" }, take: 20, select: { id: true, number: true, status: true, totalCents: true, currency: true, dueDate: true } }).catch(() => []) : [],
    openEngagement ? prisma.contact.findUnique({ where: { email: openEngagement.clientEmail }, select: { id: true } }).catch(() => null) : null,
  ]);
  const [reqContact, reqAccount, engInvoices, engContact] = lookups;

  return (
    <div className="dk-stack">
      <DeskHeader
        href="/admin/enterprise"
        flash={flashOf(p)}
        signals={signals}
        actions={
          <>
            <a className="dk-btn dk-btn--onink" href={PUBLIC_URL} target="_blank" rel="noopener noreferrer">
              <Icon name="external" size={15} /> Public pages
            </a>
            <Link prefetch={false} className="dk-btn dk-btn--onink" href="/api/admin/export/requests">
              <Icon name="export" size={15} /> Export
            </Link>
            <Link prefetch={false} className="dk-btn dk-btn--light" href={self({ tab: "engagements", new: "1", open: undefined })} scroll={false}>
              <Icon name="plus" size={15} /> New proposal
            </Link>
          </>
        }
      />

      {pending ? (
        <div className="dk-flash dk-flash--warn" role="status">
          The enterprise tables aren&rsquo;t in this database yet — run the latest migration (the deploy script does it), then reload.
        </div>
      ) : null}
      {!brokerOk ? (
        <div className="dk-flash dk-flash--warn" role="status">
          Add the broker&rsquo;s name, licence number, states and a phone or address before promoting the enterprise pages — broker ads must show them.{" "}
          {founder ? (
            <Link prefetch={false} href={self({ tab: "catalogue" })}>
              Add them now →
            </Link>
          ) : (
            "Ask the account owner to add them."
          )}
        </div>
      ) : null}

      <div className="dk-kpis">
        <Kpi label="Open requests" value={open.length} sub={`${fresh.length} new · ${open.filter((r) => r.status === "proposal").length} with a proposal`} href={self({ tab: undefined, status: undefined })} tone={waiting.length ? "alert" : undefined} />
        <Kpi label="Win rate · 90 days" value={closed90 ? `${Math.round((won90 / closed90) * 100)}%` : "—"} sub={`${won90} won of ${closed90} decided`} />
        <Kpi label="Signed & active" value={live.length} sub={overdueTasks ? `${overdueTasks} steps late` : "on schedule"} tone={overdueTasks ? "alert" : "good"} href={self({ tab: "engagements" })} />
        <Kpi label="Monthly recurring" value={Math.round(mrr / 100)} fmt="usd" sub={`plus ${fmtCents(pipelineOnce, "USD", { whole: true })} proposed`} tone="value" />
        <Kpi label="Units under management" value={unitsManaged} sub={unitsManaged ? `${occupancy(unitsManaged, occupiedUnits)}% occupied` : "no active buildings yet"} href={self({ tab: "portfolio" })} />
      </div>

      <div className="dk-grid dk-grid--rail">
        <CommandRail
          title="Enterprise"
          sub="Request · propose · deliver · report"
          tabs={[
            { key: "pipeline", label: "Request pipeline", href: self({ tab: undefined, eng: undefined, prop: undefined, new: undefined }), on: tab === "pipeline", count: fresh.length || undefined },
            { key: "engagements", label: "Engagements", href: self({ tab: "engagements", open: undefined, prop: undefined }), on: tab === "engagements", count: live.length || undefined },
            { key: "portfolio", label: "Managed portfolio", href: self({ tab: "portfolio", open: undefined, eng: undefined, new: undefined }), on: tab === "portfolio", count: statementsDue.length || undefined },
            { key: "catalogue", label: "Packages & licence", href: self({ tab: "catalogue", open: undefined, eng: undefined, prop: undefined, new: undefined }), on: tab === "catalogue" },
          ]}
          quick={{
            title: "Jump to",
            items: [
              {
                label: `${fresh.length} to answer`,
                href: self({ tab: undefined, status: "new" }),
                mark: (
                  <MarkTile bg={fresh.length ? "#a93a28" : undefined}>
                    <Icon name="mail" size={14} />
                  </MarkTile>
                ),
              },
              {
                label: `${statementsDue.length} statements due`,
                href: self({ tab: "portfolio" }),
                mark: (
                  <MarkTile bg="#c4892a">
                    <Icon name="invoice" size={14} />
                  </MarkTile>
                ),
              },
              {
                label: "Add a managed property",
                href: self({ tab: "portfolio", newprop: "1" }),
                mark: (
                  <MarkTile bg="#2b6b55">
                    <Icon name="plus" size={14} />
                  </MarkTile>
                ),
              },
            ],
          }}
        />

        <div className="dk-stack">
          {tab === "pipeline" ? (
            <>
              {statusFilter ? (
                <div className="dk-inline">
                  <Chip tone="brand">Showing: {REQUEST_STAGE[statusFilter as keyof typeof REQUEST_STAGE].label}</Chip>
                  <Link prefetch={false} className="dk-btn dk-btn--ghost dk-btn--sm" href={self({ status: undefined })} scroll={false}>
                    Show every stage
                  </Link>
                </div>
              ) : null}
              {requestCards.length ? (
                <Board
                  mode="request"
                  columns={(Object.keys(REQUEST_STAGE) as Array<keyof typeof REQUEST_STAGE>)
                    .filter((k) => !statusFilter || k === statusFilter)
                    .map((k) => ({ key: k, label: REQUEST_STAGE[k].label, hint: REQUEST_STAGE[k].hint, tone: REQUEST_STAGE[k].tone }))}
                  cards={requestCards}
                  empty="Drop a request here"
                />
              ) : (
                <Panel>
                  <Empty title="No enterprise requests yet.">
                    They arrive from the form on rentleaks.com/enterprise/. Share the page with landlords, property companies and out-of-state owners — or start a proposal by hand.
                    <div className="dk-inline" style={{ marginTop: 12 }}>
                      <a className="dk-btn dk-btn--primary" href={PUBLIC_URL} target="_blank" rel="noopener noreferrer">
                        <Icon name="external" size={14} /> Open the public page
                      </a>
                      <Link prefetch={false} className="dk-btn" href={self({ tab: "engagements", new: "1" })}>
                        <Icon name="plus" size={14} /> New proposal
                      </Link>
                    </div>
                  </Empty>
                </Panel>
              )}
              <div className="dk-grid dk-grid--2">
                <Panel kicker="90 days" title="From request to signed">
                  <FunnelLanes
                    stages={[
                      { label: "Requests", value: r90.length },
                      { label: "Talking", value: r90.filter((r) => ["contacted", "proposal", "won"].includes(r.status)).length },
                      { label: "Proposal", value: r90.filter((r) => ["proposal", "won"].includes(r.status)).length },
                      { label: "Won", value: won90 },
                    ]}
                  />
                </Panel>
                <Panel kicker="90 days" title="What owners ask for">
                  <Donut items={byService} centerLabel="ASKS" />
                </Panel>
              </div>
              <Panel kicker="90 days" title="Units asked about, by market" sub="Where the portfolio could grow — recruit partners or open the licence there.">
                <RankedBars
                  rows={[...byMarket.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 8)
                    .map(([k, v]) => ({ key: k, label: k, value: v }))}
                  empty="No units asked about yet."
                />
              </Panel>
            </>
          ) : null}

          {tab === "engagements" ? (
            <>
              {engagementCards.length ? (
                <Board
                  mode="engagement"
                  columns={(["proposal", "signed", "active", "paused", "completed"] as EngagementStatus[]).map((k) => ({
                    key: k,
                    label: ENGAGEMENT_STAGE[k].label,
                    hint: ENGAGEMENT_STAGE[k].hint,
                    tone: ENGAGEMENT_STAGE[k].tone,
                  }))}
                  cards={engagementCards}
                  empty="Drop an engagement here"
                />
              ) : (
                <Panel>
                  <Empty title="No engagements yet.">
                    Create one from a request (it carries the details over), or start a proposal by hand.
                    <div style={{ marginTop: 12 }}>
                      <Link prefetch={false} className="dk-btn dk-btn--primary" href={self({ new: "1" })} scroll={false}>
                        <Icon name="plus" size={14} /> New proposal
                      </Link>
                    </div>
                  </Empty>
                </Panel>
              )}
              <Panel
                kicker="Signed & active"
                title="Revenue by package"
                sub="Recurring monthly value at the agreed fee."
                actions={
                  <Link prefetch={false} className="dk-btn dk-btn--ghost dk-btn--sm" href="/api/admin/export/engagements">
                    <Icon name="export" size={13} /> Engagements CSV
                  </Link>
                }
              >
                <RankedBars
                  fmt="usd"
                  rows={[...live.reduce((m, e) => m.set(e.packageId ? (PACKAGE.get(e.packageId)?.name ?? e.packageId) : "Custom", (m.get(e.packageId ? (PACKAGE.get(e.packageId)?.name ?? e.packageId) : "Custom") ?? 0) + Math.round(e.value.monthly / 100)), new Map<string, number>())]
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, v]) => ({ key: k, label: k, value: v }))}
                  empty="Nothing recurring yet."
                />
              </Panel>
            </>
          ) : null}

          {tab === "portfolio" ? <PortfolioView properties={properties} engagements={engagements} self={self} showNew={p.newprop === "1"} presetEngagement={p.pe} today={today} /> : null}

          {tab === "catalogue" ? <CatalogueView settings={settings} founder={founder} self={self} /> : null}
        </div>
      </div>

      {openRequest ? <RequestDrawer r={openRequest} self={self} now={t} contact={reqContact} account={reqAccount} founder={founder} me={{ name: me.name }} /> : null}
      {openEngagement ? <EngagementDrawer e={openEngagement} self={self} today={today} invoices={engInvoices} canBooks={canBooks} founder={founder} contactId={engContact?.id ?? null} /> : null}
      {openProperty ? <PropertyDrawer pr={openProperty} self={self} today={today} canBooks={canBooks} engagements={engagements} /> : null}
      {p.new === "1" ? <EngagementForm self={self} fromRequest={fromRequest} presetPackage={p.pkg} /> : null}
    </div>
  );
}
