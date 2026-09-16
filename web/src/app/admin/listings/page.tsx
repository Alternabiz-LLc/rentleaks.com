import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { listingEdit, listingsBulk } from "@/app/admin/_actions/listings";
import { Board, type BoardCard } from "@/components/admin/desk/Board";
import { BulkForm, SelectAll } from "@/components/admin/desk/BulkForm";
import { Donut, Kpi, RankedBars } from "@/components/admin/desk/charts";
import { DeskHeader } from "@/components/admin/desk/DeskHeader";
import { Icon } from "@/components/admin/desk/Icon";
import { ago, Chip, Empty, Field, FilterCard, Panel, ViewSwitch } from "@/components/admin/desk/parts";
import { RouteDrawer } from "@/components/admin/desk/RouteDrawer";
import { flashOf, qs, readParams, type SP } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";
import { nowMs } from "@/lib/admin/metrics";
import { prisma } from "@/lib/prisma";
import { fmtMoney, typeLabel } from "@/lib/site";

export const metadata = { title: "Listings — RentLeaks desk" };

const PAGE = 50;
const TYPES = ["room", "coliving", "furnished", "short-term", "aparthotel", "lease-break"];
const MOD_TONE: Record<string, "good" | "warn" | "bad"> = { approved: "good", pending: "warn", declined: "bad" };

function photoOf(l: { image: string | null; detail: unknown }) {
  const d = (l.detail ?? {}) as { photos?: unknown; images?: unknown };
  const list = Array.isArray(d.photos) ? d.photos : Array.isArray(d.images) ? d.images : [];
  const first = list.find((x): x is string => typeof x === "string");
  return first ?? l.image ?? null;
}

export default async function ListingsAdmin({ searchParams }: { searchParams: SP }) {
  await requireAdminPage("/admin/listings");
  const p = await readParams(searchParams);
  const t = nowMs();
  const view = p.view === "board" ? "board" : "sheet";
  const page = Math.max(1, Number(p.page) || 1);

  const and: Prisma.ListingWhereInput[] = [];
  if (p.q) {
    and.push({
      OR: [
        { id: { contains: p.q, mode: "insensitive" } },
        { title: { contains: p.q, mode: "insensitive" } },
        { neighborhood: { contains: p.q, mode: "insensitive" } },
        { host: { email: { contains: p.q, mode: "insensitive" } } },
        { host: { name: { contains: p.q, mode: "insensitive" } } },
      ],
    });
  }
  if (p.city) and.push({ cityId: p.city });
  if (p.type) and.push({ housingType: p.type });
  if (p.moderation && view !== "board") and.push({ moderation: p.moderation });
  if (p.status) and.push({ status: p.status });
  if (p.sponsored) and.push({ sponsored: p.sponsored === "yes" });
  if (p.host) and.push({ hostId: p.host });
  const where: Prisma.ListingWhereInput = and.length ? { AND: and } : {};

  const include = {
    city: { select: { name: true } },
    host: { select: { id: true, name: true, email: true, identity: { select: { status: true } } } },
    _count: { select: { leads: true, reports: true } },
  } as const;

  const [total, rows, cities, modCounts, statusCounts, byCity, byType, sponsoredCount] = await Promise.all([
    prisma.listing.count({ where }),
    view === "sheet"
      ? prisma.listing.findMany({ where, include, orderBy: [{ createdAt: "desc" }], skip: (page - 1) * PAGE, take: PAGE })
      : Promise.resolve([]),
    prisma.city.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.listing.groupBy({ by: ["moderation"], _count: { _all: true } }),
    prisma.listing.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.listing.groupBy({ by: ["cityId"], where, _count: { _all: true }, orderBy: { _count: { cityId: "desc" } }, take: 8 }),
    prisma.listing.groupBy({ by: ["housingType"], where, _count: { _all: true } }),
    prisma.listing.count({ where: { sponsored: true } }),
  ]);
  const cityName = new Map(cities.map((c) => [c.id, c.name]));
  const mod = (m: string) => modCounts.find((c) => c.moderation === m)?._count._all ?? 0;
  const st = (s: string) => statusCounts.find((c) => c.status === s)?._count._all ?? 0;
  const self = (over: Record<string, string | number | undefined> = {}) => `/admin/listings${qs(p, { ok: undefined, err: undefined, edit: undefined, ...over })}`;

  /* The review board: every pending and declined listing, plus the recent approvals. */
  let boardCards: BoardCard[] = [];
  let approvedMore = 0;
  if (view === "board") {
    const [pending, declined, approved, approvedTotal] = await Promise.all([
      prisma.listing.findMany({ where: { AND: [...and, { moderation: "pending" }] }, include, orderBy: { createdAt: "asc" }, take: 150 }),
      prisma.listing.findMany({ where: { AND: [...and, { moderation: "declined" }] }, include, orderBy: { moderatedAt: "desc" }, take: 80 }),
      prisma.listing.findMany({ where: { AND: [...and, { moderation: "approved" }] }, include, orderBy: [{ moderatedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }], take: 12 }),
      prisma.listing.count({ where: { AND: [...and, { moderation: "approved" }] } }),
    ]);
    approvedMore = Math.max(0, approvedTotal - approved.length);
    boardCards = [...pending, ...declined, ...approved].map((l) => {
      const waitH = (t - l.createdAt.getTime()) / 3_600_000;
      return {
        id: l.id,
        column: l.moderation,
        title: l.title,
        sub: `${l.city.name} · ${typeLabel(l.housingType)}`,
        image: photoOf(l),
        chips: [
          { label: `${fmtMoney(l.allIn, l.currency)} all-in`, tone: "value" },
          { label: l.host.identity?.status === "verified" ? "host verified" : "host unverified", tone: l.host.identity?.status === "verified" ? "good" : "warn" },
          ...(l.sponsored ? [{ label: "sponsored", tone: "brand" }] : []),
        ],
        lines: [`by ${l.host.name}`, l.moderation === "declined" && l.moderationNote ? `Reason: ${l.moderationNote}` : `Submitted ${ago(t - l.createdAt.getTime())}`],
        alert: l.moderation === "pending" && waitH > 48 ? `Waiting ${Math.round(waitH / 24)} days` : l._count.reports ? `${l._count.reports} report${l._count.reports === 1 ? "" : "s"}` : undefined,
        href: self({ view: undefined, q: l.id }),
        external: `/listings/${l.id}`,
      };
    });
  }

  const editing = p.edit ? await prisma.listing.findUnique({ where: { id: p.edit }, include: { host: { select: { email: true, name: true } }, city: { select: { name: true } } } }) : null;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div className="dk-stack">
      <DeskHeader
        href="/admin/listings"
        flash={flashOf(p)}
        signals={[
          { label: "Awaiting review", value: `${mod("pending")} listings`, tone: mod("pending") ? "warn" : "live", href: "/admin/listings?view=board" },
          { label: "Live", value: `${st("active")} active`, tone: "live", href: "/admin/listings?status=active" },
          { label: "Declined", value: `${mod("declined")}`, tone: "ok", href: "/admin/listings?moderation=declined" },
          { label: "Sponsored", value: `${sponsoredCount}`, tone: "ok", href: "/admin/listings?sponsored=yes" },
        ]}
        actions={
          <>
            <Link prefetch={false} className="dk-btn dk-btn--onink" href={`/api/admin/export/listings${qs(p, { page: undefined, ok: undefined, err: undefined, edit: undefined, view: undefined })}`}>
              <Icon name="export" size={15} /> Export CSV
            </Link>
            <Link prefetch={false} className="dk-btn dk-btn--light" href="/list">
              <Icon name="plus" size={15} /> New listing
            </Link>
          </>
        }
      />

      <div className="dk-kpis">
        <Kpi label="All listings" value={mod("approved") + mod("pending") + mod("declined")} href={self({ moderation: undefined, status: undefined, page: undefined })} active={!p.moderation && !p.status} />
        <Kpi label="Pending review" value={mod("pending")} href={self({ moderation: p.moderation === "pending" ? undefined : "pending", page: undefined })} active={p.moderation === "pending"} tone={mod("pending") ? "alert" : undefined} />
        <Kpi label="Approved" value={mod("approved")} href={self({ moderation: p.moderation === "approved" ? undefined : "approved", page: undefined })} active={p.moderation === "approved"} tone="good" />
        <Kpi label="Declined" value={mod("declined")} href={self({ moderation: p.moderation === "declined" ? undefined : "declined", page: undefined })} active={p.moderation === "declined"} />
        <Kpi label="Paused" value={st("paused")} href={self({ status: p.status === "paused" ? undefined : "paused", page: undefined })} active={p.status === "paused"} />
        <Kpi label="Sponsored" value={sponsoredCount} href={self({ sponsored: p.sponsored === "yes" ? undefined : "yes", page: undefined })} active={p.sponsored === "yes"} tone="value" />
      </div>

      <div className="dk-grid dk-grid--2">
        <Panel title="By market" sub="In the current filter — click to narrow.">
          <RankedBars
            rows={byCity.map((c) => ({ key: c.cityId, label: cityName.get(c.cityId) ?? c.cityId, value: c._count._all, href: self({ city: p.city === c.cityId ? undefined : c.cityId, page: undefined }) }))}
            activeKey={p.city || undefined}
          />
        </Panel>
        <Panel title="By type" sub="In the current filter.">
          <Donut
            items={TYPES.map((ty) => ({ label: typeLabel(ty).replace(/ \(.*\)/, ""), value: byType.find((b) => b.housingType === ty)?._count._all ?? 0, href: self({ type: p.type === ty ? undefined : ty, page: undefined }) })).filter((i) => i.value)}
            centerLabel="LISTINGS"
          />
        </Panel>
      </div>

      <div className="dk-toolbar">
        <ViewSwitch
          items={[
            { key: "sheet", label: "Spreadsheet", href: self({ view: undefined }), on: view === "sheet", icon: "list" },
            { key: "board", label: "Review board", href: self({ view: "board", page: undefined }), on: view === "board", icon: "board", count: mod("pending") },
          ]}
        />
        <span className="dk-hint">{view === "board" ? "Drag to Approved or Declined — declining asks for the reason the seller will see." : `${total.toLocaleString("en-US")} matching`}</span>
      </div>

      <FilterCard
        actions={
          <Link prefetch={false} href={view === "board" ? "/admin/listings?view=board" : "/admin/listings"} className="dk-btn dk-btn--ghost dk-btn--sm">
            Reset
          </Link>
        }
      >
        {view === "board" ? <input type="hidden" name="view" value="board" /> : null}
        <Field label="Search">
          <input name="q" placeholder="Title, id, area, host name or email" defaultValue={p.q} />
        </Field>
        <Field label="City">
          <select name="city" defaultValue={p.city}>
            <option value="">All cities</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Type">
          <select name="type" defaultValue={p.type}>
            <option value="">All types</option>
            {TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {typeLabel(ty)}
              </option>
            ))}
          </select>
        </Field>
        {view === "sheet" ? (
          <Field label="Review">
            <select name="moderation" defaultValue={p.moderation}>
              <option value="">Any review state</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="declined">Declined</option>
            </select>
          </Field>
        ) : null}
        <Field label="Status">
          <select name="status" defaultValue={p.status}>
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="coming-soon">Coming soon</option>
            <option value="paused">Paused</option>
          </select>
        </Field>
        <Field label="Sponsored">
          <select name="sponsored" defaultValue={p.sponsored}>
            <option value="">Either</option>
            <option value="yes">Sponsored</option>
            <option value="no">Not sponsored</option>
          </select>
        </Field>
        <div className="dk-filters__go">
          <button className="dk-btn dk-btn--primary" type="submit">
            <Icon name="search" size={14} /> Apply
          </button>
        </div>
      </FilterCard>

      {view === "board" ? (
        <Board
          mode="listing"
          columns={[
            { key: "pending", label: "Pending review", tone: "warn", hint: "Oldest first" },
            { key: "approved", label: "Approved", tone: "good", hint: "Most recent", more: approvedMore ? { count: approvedMore, href: "/admin/listings?moderation=approved" } : undefined },
            { key: "declined", label: "Declined", tone: "bad", hint: "The seller sees the reason" },
          ]}
          cards={boardCards}
          empty="Nothing here"
        />
      ) : rows.length === 0 ? (
        <Empty title="No listings match." />
      ) : (
        <Panel flush title={`Page ${page} of ${pages}`} sub="Tick rows for bulk actions — approve, decline with a reason, pause, sponsor, feature, verify.">
          <BulkForm
            action={listingsBulk}
            returnTo={self()}
            noun="listing"
            ops={[
              { op: "approve", label: "Approve" },
              { op: "decline", label: "Decline (with reason)", needs: "note", danger: true },
              { op: "pending", label: "Send back to review" },
              { op: "pause", label: "Pause" },
              { op: "activate", label: "Activate" },
              { op: "sponsor", label: "Sponsor" },
              { op: "unsponsor", label: "Remove sponsorship" },
              { op: "feature", label: "Feature" },
              { op: "unfeature", label: "Unfeature" },
              { op: "verify", label: "Mark verified" },
              { op: "unverify", label: "Remove verified" },
            ]}
          >
            <div className="dk-tablewrap">
              <table className="dk-table">
                <thead>
                  <tr>
                    <th>
                      <SelectAll />
                    </th>
                    <th>Listing</th>
                    <th>Market</th>
                    <th className="dk-right">All-in</th>
                    <th>Host</th>
                    <th>Review</th>
                    <th>Status</th>
                    <th className="dk-right">Leads</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((l) => (
                    <tr key={l.id} data-row="">
                      <td>
                        <input type="checkbox" name="ids" value={l.id} aria-label={`Select ${l.title}`} />
                      </td>
                      <td className="dk-wrap">
                        <a href={`/listings/${l.id}`} target="_blank" rel="noreferrer">
                          <b>{l.title}</b>
                        </a>
                        <div className="dk-dim">
                          {typeLabel(l.housingType)} · <span className="dk-mono">{l.id}</span>
                        </div>
                        <div className="dk-chiprow dk-chiprow--tight">
                          {l.sponsored ? <Chip tone="brand">sponsored</Chip> : null}
                          {l.featured ? <Chip tone="value">featured</Chip> : null}
                          {l.verified ? <Chip tone="good">verified</Chip> : null}
                        </div>
                      </td>
                      <td>{l.city.name}</td>
                      <td className="dk-right" style={{ color: "var(--dk-ochre)", fontWeight: 650 }}>
                        {fmtMoney(l.allIn, l.currency)}
                      </td>
                      <td className="dk-wrap">
                        <Link prefetch={false} href={`/admin/accounts?q=${encodeURIComponent(l.host.email)}`}>{l.host.name}</Link>
                        <div className="dk-dim">{l.host.identity?.status ?? "unverified"}</div>
                      </td>
                      <td>
                        <Chip tone={MOD_TONE[l.moderation] ?? "ink"}>{l.moderation}</Chip>
                        {l.moderation === "declined" && l.moderationNote ? <div className="dk-dim">{l.moderationNote}</div> : null}
                      </td>
                      <td>
                        <Chip tone={l.status === "paused" ? "bad" : l.status === "active" ? "good" : "ink"}>{l.status}</Chip>
                      </td>
                      <td className="dk-right">
                        {l._count.leads || "—"}
                        {l._count.reports ? <div className="dk-bad">{l._count.reports} reports</div> : null}
                      </td>
                      <td>
                        <Link prefetch={false} className="dk-btn dk-btn--sm" href={self({ edit: l.id })} scroll={false}>
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

      {editing ? (
        <RouteDrawer closeHref={self()} kicker={`${editing.city.name} · ${editing.id}`} title={`Edit “${editing.title}”`}>
          <form action={listingEdit} className="dk-form">
            <input type="hidden" name="id" value={editing.id} />
            <input type="hidden" name="returnTo" value={self()} />
            <label className="dk-field dk-field--wide">
              <span>Title</span>
              <input name="title" defaultValue={editing.title} required />
            </label>
            <label className="dk-field">
              <span>Rent ({editing.currency})</span>
              <input name="price" type="number" min={0} defaultValue={editing.price} />
            </label>
            <label className="dk-field">
              <span>All-in ({editing.currency})</span>
              <input name="allIn" type="number" min={0} defaultValue={editing.allIn} />
            </label>
            <label className="dk-field">
              <span>Billing plan</span>
              <select name="plan" defaultValue={editing.plan}>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
              </select>
            </label>
            <label className="dk-field">
              <span>Move to host (email)</span>
              <input name="hostEmail" type="email" placeholder={editing.host.email} />
            </label>
            <p className="dk-hint">Currently hosted by {editing.host.name} ({editing.host.email}). All-in must be at least the rent.</p>
            <div className="dk-compose__actions dk-field--wide">
              <button className="dk-btn dk-btn--primary" type="submit">
                Save listing
              </button>
              <a className="dk-btn" href={`/listings/${editing.id}`} target="_blank" rel="noreferrer">
                <Icon name="external" size={14} /> Public page
              </a>
            </div>
          </form>
        </RouteDrawer>
      ) : null}
    </div>
  );
}
