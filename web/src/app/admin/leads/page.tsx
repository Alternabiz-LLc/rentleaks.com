import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { leadsBulk } from "@/app/admin/_actions/desk";
import { Board, type BoardCard } from "@/components/admin/desk/Board";
import { BulkForm, SelectAll } from "@/components/admin/desk/BulkForm";
import { Donut, FunnelLanes, Kpi, RankedBars, TrendArea } from "@/components/admin/desk/charts";
import { DeskHeader } from "@/components/admin/desk/DeskHeader";
import { Composer } from "@/components/admin/desk/Drawer";
import { Icon } from "@/components/admin/desk/Icon";
import { LeadControls } from "@/components/admin/desk/LeadControls";
import { ago, Chip, Field, FilterCard, GradeChip, initials, Panel, ViewSwitch } from "@/components/admin/desk/parts";
import { RecordCards, type RecordCard } from "@/components/admin/desk/RecordCards";
import { RouteDrawer } from "@/components/admin/desk/RouteDrawer";
import { flashOf, qs, readParams, type SP } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";
import { nowMs } from "@/lib/admin/metrics";
import { leadReplyDraft, scoreLead } from "@/lib/admin/score";
import { KIND_LABEL, leadSummary, type LeadKind, type ViewingSlot } from "@/lib/leads";
import { prisma } from "@/lib/prisma";
import { appUrl, typeLabel } from "@/lib/site";

export const metadata = { title: "Leads — RentLeaks desk" };

const DAY = 86_400_000;

const SOURCE_LABEL: Record<string, string> = {
  fb_page: "Facebook Page",
  fb_button: "Facebook button",
  fb_post: "Facebook post",
  fb_ad: "Facebook ad",
  messenger: "Messenger",
  instagram: "Instagram",
  web: "Website",
};

const STATUS: Record<string, { label: string; tone: string }> = {
  new: { label: "New", tone: "brand" },
  contacted: { label: "Contacted", tone: "warn" },
  booked: { label: "Booked", tone: "good" },
  closed: { label: "Closed", tone: "ink" },
  spam: { label: "Spam", tone: "bad" },
};

function slotsOf(json: string): ViewingSlot[] {
  try {
    const v = JSON.parse(json) as unknown;
    return Array.isArray(v) ? (v as ViewingSlot[]) : [];
  } catch {
    return [];
  }
}

export default async function LeadsPage({ searchParams }: { searchParams: SP }) {
  await requireAdminPage("/admin/leads");
  const p = await readParams(searchParams);
  const t = nowMs();
  const view = p.view === "board" || p.view === "sheet" ? p.view : "cards";
  const showCharts = p.charts !== "0";
  const since30 = new Date(t - 30 * DAY);

  const and: Prisma.LeadWhereInput[] = [];
  if (p.q) {
    and.push({
      OR: [
        { name: { contains: p.q, mode: "insensitive" } },
        { email: { contains: p.q, mode: "insensitive" } },
        { phone: { contains: p.q } },
        { message: { contains: p.q, mode: "insensitive" } },
        { campaign: { contains: p.q, mode: "insensitive" } },
        { listing: { title: { contains: p.q, mode: "insensitive" } } },
      ],
    });
  }
  if (p.kind) and.push({ kind: p.kind });
  if (p.source) and.push({ source: p.source });
  if (p.city) and.push({ cityId: p.city });
  if (view !== "board") {
    if (p.status === "open") and.push({ status: { in: ["new", "contacted"] } });
    else if (p.status) and.push({ status: p.status });
    else and.push({ status: { not: "spam" } });
  } else {
    and.push({ status: { not: "spam" } });
  }
  const where: Prisma.LeadWhereInput = and.length ? { AND: and } : {};

  let rows: Awaited<ReturnType<typeof loadRows>> = [];
  let tableMissing = false;
  async function loadRows() {
    return prisma.lead.findMany({
      where,
      orderBy: { createdAt: p.sort === "oldest" ? "asc" : "desc" },
      take: view === "board" ? 400 : 300,
      include: { listing: { select: { id: true, title: true } } },
    });
  }
  try {
    rows = await loadRows();
  } catch (err) {
    console.error("[admin] leads unavailable:", err instanceof Error ? err.message : err);
    tableMissing = true;
  }

  const [byStatus, recent, cities, total] = await Promise.all([
    prisma.lead.groupBy({ by: ["status"], _count: { _all: true } }).catch(() => []),
    prisma.lead
      .findMany({ where: { createdAt: { gte: since30 } }, select: { createdAt: true, contactedAt: true, status: true, kind: true, source: true } })
      .catch(() => []),
    prisma.city.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.lead.count().catch(() => 0),
  ]);
  const cityName = new Map(cities.map((c) => [c.id, c.name]));
  const count = (s: string) => byStatus.find((b) => b.status === s)?._count._all ?? 0;
  const base = appUrl();

  const hours = recent
    .filter((l) => l.contactedAt)
    .map((l) => (l.contactedAt!.getTime() - l.createdAt.getTime()) / 3_600_000)
    .sort((a, b) => a - b);
  const median = hours.length ? hours[Math.floor(hours.length / 2)] : null;
  const waitingDay = rows.filter((l) => l.status === "new" && t - l.createdAt.getTime() > DAY).length;

  const scored = rows.map((l) => {
    const s = scoreLead(l, t);
    const kind = (l.kind in KIND_LABEL ? l.kind : "match") as LeadKind;
    const waitH = l.status === "new" ? (t - l.createdAt.getTime()) / 3_600_000 : null;
    return { l, s, kind, waitH };
  });
  if (p.sort === "score") scored.sort((a, b) => b.s.score - a.s.score);

  const self = (over: Record<string, string | number | undefined> = {}) => `/admin/leads${qs(p, { ok: undefined, err: undefined, open: undefined, ...over })}`;

  const draftFor = (l: (typeof rows)[number]) =>
    leadReplyDraft({ id: l.id, kind: l.kind, name: l.name, email: l.email, listingTitle: l.listing?.title, cityName: l.cityId ? cityName.get(l.cityId) : null, moveIn: l.moveIn, appUrl: base });

  const cards: RecordCard[] = scored.map(({ l, s, kind, waitH }) => ({
    id: l.id,
    title: l.name || l.email,
    sub: `${KIND_LABEL[kind]}${l.listing ? ` · ${l.listing.title}` : l.cityId ? ` · ${cityName.get(l.cityId) ?? l.cityId}` : ""}`,
    initials: initials(l.name, l.email),
    status: STATUS[l.status] ?? { label: l.status, tone: "ink" },
    score: s.score,
    scoreWhy: s.reasons.join(" · "),
    chips: [{ label: SOURCE_LABEL[l.source] ?? l.source }, ...(l.campaign ? [{ label: l.campaign, tone: "value" }] : [])],
    lines: [
      { k: "Email", v: l.email },
      ...(l.phone ? [{ k: "Mobile", v: l.phone }] : []),
      ...(l.moveIn || l.budgetMax
        ? [{ k: "Wants", v: [l.moveIn ? `from ${l.moveIn}` : "", l.budgetMax ? `≤ ${l.currency} ${l.budgetMax.toLocaleString("en-US")}` : "", l.housingType ? typeLabel(l.housingType) : ""].filter(Boolean).join(" · ") }]
        : []),
      waitH !== null && waitH >= 24
        ? { k: "Waiting", v: `${Math.floor(waitH / 24)}d ${Math.round(waitH % 24)}h — reply now`, tone: "bad" as const }
        : { k: "Received", v: ago(t - l.createdAt.getTime()) },
    ],
    accent: waitH !== null && waitH >= 24 ? "bad" : l.status === "new" ? "brand" : l.status === "booked" ? "good" : l.status === "contacted" ? "warn" : "ink",
    href: self({ open: l.id }),
    phone: l.phone,
    draft: l.status === "spam" ? undefined : draftFor(l),
  }));

  const boardCards: BoardCard[] = scored.map(({ l, s, kind, waitH }) => ({
    id: l.id,
    column: l.status,
    title: l.name || l.email,
    sub: `${KIND_LABEL[kind]} · ${SOURCE_LABEL[l.source] ?? l.source}`,
    initials: initials(l.name, l.email),
    score: s.score,
    lines: [l.listing?.title ?? (l.cityId ? cityName.get(l.cityId) ?? l.cityId : ""), l.moveIn ? `Moves ${l.moveIn}` : ""].filter(Boolean),
    alert: waitH !== null && waitH >= 24 ? `Waiting ${Math.floor(waitH / 24)}d ${Math.round(waitH % 24)}h` : undefined,
    href: self({ open: l.id }),
    phone: l.phone,
    draft: draftFor(l),
  }));

  /* Dossier */
  const open = p.open ? await prisma.lead.findUnique({ where: { id: p.open }, include: { listing: { select: { id: true, title: true } } } }).catch(() => null) : null;
  const openContact = open ? await prisma.contact.findUnique({ where: { email: open.email }, select: { id: true, stage: true } }).catch(() => null) : null;
  const openScore = open ? scoreLead(open, t) : null;

  /* Charts */
  const days = Array.from({ length: 30 }, (_, i) => new Date(t - (29 - i) * DAY).toISOString().slice(0, 10));
  const trend = days.map((d) => ({
    label: new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
    a: recent.filter((l) => l.createdAt.toISOString().slice(0, 10) === d).length,
    b: recent.filter((l) => l.contactedAt && l.contactedAt.toISOString().slice(0, 10) === d).length,
  }));
  const sources = [...new Set(recent.map((l) => l.source))]
    .map((s) => ({ key: s, label: SOURCE_LABEL[s] ?? s, value: recent.filter((l) => l.source === s).length, href: self({ source: p.source === s ? undefined : s }) }))
    .sort((a, b) => b.value - a.value);
  const real = recent.filter((l) => l.status !== "spam");

  return (
    <div className="dk-stack">
      <DeskHeader
        href="/admin/leads"
        flash={flashOf(p)}
        signals={[
          { label: "New", value: `${count("new")} leads`, tone: count("new") ? "live" : "ok", href: self({ status: "new", view: undefined }) },
          { label: "Waiting > 24h", value: waitingDay ? `${waitingDay} — reply now` : "none", tone: waitingDay ? "critical" : "ok", href: self({ status: "new", sort: "oldest" }) },
          { label: "Median reply", value: median === null ? "—" : median < 1 ? "under 1h" : `${Math.round(median)}h`, tone: median !== null && median > 24 ? "warn" : "ok" },
          { label: "Booked", value: `${count("booked")} of ${total}`, tone: "ok", href: self({ status: "booked" }) },
        ]}
        actions={
          <Link prefetch={false} className="dk-btn dk-btn--onink" href="/api/admin/export/leads">
            <Icon name="export" size={15} /> Export CSV
          </Link>
        }
      />

      <div className="dk-toolbar">
        <div className="dk-toolbar__group">
          <Link prefetch={false} className={`dk-btn${showCharts ? " dk-btn--primary" : ""}`} href={self({ charts: showCharts ? "0" : undefined })} scroll={false}>
            <Icon name="revenue" size={15} /> {showCharts ? "Hide analytics" : "Show analytics"}
          </Link>
          <ViewSwitch
            items={[
              { key: "cards", label: "Cards", href: self({ view: undefined }), on: view === "cards", icon: "overview" },
              { key: "board", label: "Board", href: self({ view: "board" }), on: view === "board", icon: "board" },
              { key: "sheet", label: "Spreadsheet", href: self({ view: "sheet" }), on: view === "sheet", icon: "list" },
            ]}
          />
        </div>
        <div className="dk-toolbar__group">
          <Link prefetch={false} className="dk-btn dk-btn--ghost" href="/admin/ads">
            Attribution →
          </Link>
        </div>
      </div>

      {showCharts ? (
        <>
          <div className="dk-kpis">
            <Kpi label="Open" value={count("new") + count("contacted")} sub="new + contacted" href={self({ status: p.status === "open" ? undefined : "open" })} active={p.status === "open"} />
            <Kpi label="New" value={count("new")} sub={`${waitingDay} waiting over a day`} href={self({ status: p.status === "new" ? undefined : "new" })} active={p.status === "new"} tone={waitingDay ? "alert" : undefined} />
            <Kpi label="Contacted" value={count("contacted")} href={self({ status: p.status === "contacted" ? undefined : "contacted" })} active={p.status === "contacted"} />
            <Kpi label="Booked" value={count("booked")} sub={total ? `${Math.round((count("booked") / total) * 100)}% of all leads` : undefined} href={self({ status: p.status === "booked" ? undefined : "booked" })} active={p.status === "booked"} tone="good" />
            <Kpi label="Closed" value={count("closed")} href={self({ status: p.status === "closed" ? undefined : "closed" })} active={p.status === "closed"} />
            <Kpi label="Spam" value={count("spam")} href={self({ status: p.status === "spam" ? undefined : "spam" })} active={p.status === "spam"} />
          </div>
          <div className="dk-grid dk-grid--2-1">
            <Panel title="Leads — last 30 days" sub={`${recent.length} received · ${recent.filter((l) => l.contactedAt).length} answered`}>
              <TrendArea points={trend} aLabel="received" bLabel="answered" height={170} />
            </Panel>
            <Panel title="By kind" sub="Last 30 days">
              <Donut
                items={(["stay", "viewing", "match"] as LeadKind[]).map((k) => ({ label: KIND_LABEL[k], value: recent.filter((l) => l.kind === k).length, href: self({ kind: p.kind === k ? undefined : k }) }))}
                centerLabel="30 DAYS"
                size={140}
              />
            </Panel>
          </div>
          <div className="dk-grid dk-grid--2">
            <Panel title="Where leads come from" sub="Last 30 days — click to filter.">
              <RankedBars rows={sources} activeKey={p.source || undefined} empty="No leads in the last 30 days." />
            </Panel>
            <Panel title="Funnel" sub="Last 30 days, spam excluded.">
              <FunnelLanes
                stages={[
                  { label: "Received", value: real.length },
                  { label: "Answered", value: real.filter((l) => l.status !== "new").length, href: self({ status: "contacted" }) },
                  { label: "Booked", value: real.filter((l) => l.status === "booked").length, href: self({ status: "booked" }) },
                ]}
              />
            </Panel>
          </div>
        </>
      ) : null}

      <FilterCard
        actions={
          <Link prefetch={false} href="/admin/leads" className="dk-btn dk-btn--ghost dk-btn--sm">
            Reset
          </Link>
        }
      >
        {view !== "cards" ? <input type="hidden" name="view" value={view} /> : null}
        {!showCharts ? <input type="hidden" name="charts" value="0" /> : null}
        <Field label="Search leads">
          <input name="q" defaultValue={p.q} placeholder="Name, email, phone, message, home or campaign" />
        </Field>
        <Field label="Kind">
          <select name="kind" defaultValue={p.kind}>
            <option value="">All kinds</option>
            <option value="stay">Booking requests</option>
            <option value="viewing">Viewing requests</option>
            <option value="match">Match requests</option>
          </select>
        </Field>
        {view !== "board" ? (
          <Field label="Status">
            <select name="status" defaultValue={p.status}>
              <option value="">All but spam</option>
              <option value="open">Open (new + contacted)</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="booked">Booked</option>
              <option value="closed">Closed</option>
              <option value="spam">Spam</option>
            </select>
          </Field>
        ) : null}
        <Field label="Source">
          <select name="source" defaultValue={p.source}>
            <option value="">Any source</option>
            {Object.entries(SOURCE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
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
        <Field label="Sort">
          <select name="sort" defaultValue={p.sort}>
            <option value="">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="score">Highest score</option>
          </select>
        </Field>
        <div className="dk-filters__go">
          <button className="dk-btn dk-btn--primary" type="submit">
            <Icon name="search" size={14} /> Apply
          </button>
        </div>
      </FilterCard>

      {tableMissing ? (
        <p className="dk-flash dk-flash--err">The leads table isn&rsquo;t in this database yet. Run the deploy script (it applies migrations).</p>
      ) : view === "board" ? (
        <Board
          mode="lead"
          columns={[
            { key: "new", label: "New", tone: "brand", hint: "Reply inside a day" },
            { key: "contacted", label: "Contacted", tone: "warn", hint: "Waiting on them or the host" },
            { key: "booked", label: "Booked", tone: "good", hint: "Host accepted" },
            { key: "closed", label: "Closed", tone: "ink", hint: "Found elsewhere, went quiet" },
            { key: "spam", label: "Spam", tone: "bad", hint: "Drop junk here" },
          ]}
          cards={boardCards}
          empty="Drop a lead here"
        />
      ) : (
        <Panel flush title={`${rows.length.toLocaleString("en-US")} lead${rows.length === 1 ? "" : "s"}`} sub={rows.length >= 300 ? "Showing the first 300 — narrow the filters to see the rest." : "Tick leads to change their status together."}>
          <BulkForm
            action={leadsBulk}
            returnTo={self()}
            noun="lead"
            ops={[
              { op: "contacted", label: "Mark contacted" },
              { op: "booked", label: "Mark booked" },
              { op: "closed", label: "Close" },
              { op: "new", label: "Back to new" },
              { op: "spam", label: "Mark spam", danger: true },
            ]}
          >
            {view === "cards" ? (
              <div style={{ padding: "16px 18px 18px" }}>
                <RecordCards cards={cards} empty={total ? "No leads match these filters." : "No leads yet — they arrive from rentleaks.com/facebook.html."} />
              </div>
            ) : (
              <div className="dk-tablewrap">
                <table className="dk-table">
                  <thead>
                    <tr>
                      <th>
                        <SelectAll />
                      </th>
                      <th>Lead</th>
                      <th>Kind</th>
                      <th>Home / city</th>
                      <th>Wants</th>
                      <th>Source</th>
                      <th>Status</th>
                      <th>Score</th>
                      <th className="dk-right">Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scored.map(({ l, s, kind, waitH }) => (
                      <tr key={l.id} data-row="">
                        <td>
                          <input type="checkbox" name="ids" value={l.id} aria-label={`Select ${l.name}`} />
                        </td>
                        <td className="dk-wrap">
                          <Link prefetch={false} href={self({ open: l.id })} scroll={false}>
                            <b>{l.name}</b>
                          </Link>
                          <div className="dk-dim">
                            {l.email}
                            {l.phone ? ` · ${l.phone}` : ""}
                          </div>
                        </td>
                        <td>{KIND_LABEL[kind]}</td>
                        <td className="dk-wrap">{l.listing?.title ?? (l.cityId ? cityName.get(l.cityId) ?? l.cityId : "—")}</td>
                        <td className="dk-dim">{[l.moveIn, l.budgetMax ? `≤ ${l.currency} ${l.budgetMax}` : ""].filter(Boolean).join(" · ") || "—"}</td>
                        <td>{SOURCE_LABEL[l.source] ?? l.source}</td>
                        <td>
                          <Chip tone={(STATUS[l.status]?.tone ?? "ink") as "brand"}>{STATUS[l.status]?.label ?? l.status}</Chip>
                        </td>
                        <td>
                          <GradeChip score={s.score} title={s.reasons.join(" · ")} />
                        </td>
                        <td className={`dk-right${waitH !== null && waitH >= 24 ? " dk-bad" : " dk-dim"}`}>{ago(t - l.createdAt.getTime())}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </BulkForm>
        </Panel>
      )}

      {open ? (
        <RouteDrawer closeHref={self({ open: undefined })} kicker={`${KIND_LABEL[(open.kind in KIND_LABEL ? open.kind : "match") as LeadKind]} · ${SOURCE_LABEL[open.source] ?? open.source}`} title={open.name || open.email} width={620}>
          <div className="dk-dossier">
            <div className="dk-chiprow">
              <Chip tone={(STATUS[open.status]?.tone ?? "ink") as "brand"}>{STATUS[open.status]?.label ?? open.status}</Chip>
              {openScore ? <GradeChip score={openScore.score} /> : null}
              <Chip>received {ago(t - open.createdAt.getTime())}</Chip>
              {open.campaign ? <Chip tone="value">{open.campaign}</Chip> : null}
              {openContact ? (
                <Link prefetch={false} className="dk-chip dk-chip--brand" href={`/admin/crm/${openContact.id}`}>
                  CRM · {openContact.stage} →
                </Link>
              ) : null}
            </div>
            <dl className="dk-dossier__facts">
              <div>
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${open.email}`}>{open.email}</a>
                </dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{open.phone ? <a href={`tel:${open.phone.replace(/[^\d+]/g, "")}`}>{open.phone}</a> : "—"}</dd>
              </div>
              <div>
                <dt>Home</dt>
                <dd>{open.listing ? <a href={`/listings/${open.listing.id}`}>{open.listing.title}</a> : open.cityId ? cityName.get(open.cityId) ?? open.cityId : "—"}</dd>
              </div>
              <div>
                <dt>Dates</dt>
                <dd>{[open.moveIn, open.moveOut].filter(Boolean).join(" → ") || (open.stayMonths ? `${open.stayMonths} months` : "—")}</dd>
              </div>
            </dl>
            <pre className="dk-dossier__summary">
              {leadSummary(
                {
                  kind: (open.kind in KIND_LABEL ? open.kind : "match") as LeadKind,
                  name: open.name,
                  cityId: open.cityId,
                  housingType: open.housingType,
                  budgetMax: open.budgetMax,
                  currency: open.currency,
                  moveIn: open.moveIn,
                  moveOut: open.moveOut,
                  stayMonths: open.stayMonths,
                  viewingSlots: slotsOf(open.viewingSlots),
                  viewingMode: open.viewingMode === "video" ? "video" : open.viewingMode ? "in-person" : null,
                  message: open.message,
                },
                open.listing ? { title: open.listing.title } : null,
              )}
            </pre>
            {openScore ? (
              <ul className="dk-why" aria-label="Why this score">
                {openScore.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : null}
            <LeadControls key={open.id} id={open.id} status={open.status} note={open.note ?? ""} />
            {open.status !== "spam" ? (
              <>
                <p className="dk-kicker">Reply</p>
                <Composer key={`c-${open.id}`} draft={draftFor(open)} />
              </>
            ) : null}
          </div>
        </RouteDrawer>
      ) : null}
    </div>
  );
}
