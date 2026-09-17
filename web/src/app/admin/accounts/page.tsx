import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { accountsBulk } from "@/app/admin/_actions/desk";
import { accountAction } from "@/app/admin/_actions/accounts";
import { BulkForm, SelectAll } from "@/components/admin/desk/BulkForm";
import { Columns, Donut, Kpi } from "@/components/admin/desk/charts";
import { DeskHeader } from "@/components/admin/desk/DeskHeader";
import { Icon } from "@/components/admin/desk/Icon";
import { ago, Avatar, Chip, Empty, Field, FilterCard, Panel } from "@/components/admin/desk/parts";
import { RouteDrawer } from "@/components/admin/desk/RouteDrawer";
import { flashOf, qs, readParams, when, type SP } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";
import { isFounder } from "@/lib/access";
import { bucketWeeks, lastWeeks, nowMs } from "@/lib/admin/metrics";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Accounts — RentLeaks desk" };

const PAGE = 40;

export default async function AccountsAdmin({ searchParams }: { searchParams: SP }) {
  const me = await requireAdminPage("/admin/accounts");
  const p = await readParams(searchParams);
  const page = Math.max(1, Number(p.page) || 1);
  const now = new Date();
  const t = nowMs();
  const and: Prisma.UserWhereInput[] = [];
  if (p.q) and.push({ OR: [{ email: { contains: p.q, mode: "insensitive" } }, { name: { contains: p.q, mode: "insensitive" } }] });
  if (p.role) and.push({ role: p.role });
  if (p.state === "suspended") and.push({ suspendedAt: { not: null } });
  if (p.state === "trial") and.push({ trialEndsAt: { gt: now } });
  if (p.state === "unverified") and.push({ OR: [{ identity: null }, { identity: { status: { not: "verified" } } }] });
  if (p.state === "verified") and.push({ identity: { status: "verified" } });
  const where: Prisma.UserWhereInput = and.length ? { AND: and } : {};
  const weeks = lastWeeks(12, now);

  const [total, users, roles, suspended, onTrial, verified, recentSignups] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      include: {
        identity: { select: { status: true } },
        contact: { select: { id: true, stage: true } },
        _count: { select: { listings: true, sessions: true, reportsFiled: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
    }),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.user.count({ where: { suspendedAt: { not: null } } }),
    prisma.user.count({ where: { trialEndsAt: { gt: now } } }),
    prisma.identityVerification.count({ where: { status: "verified" } }),
    prisma.user.findMany({ where: { createdAt: { gte: new Date(`${weeks[0]}T00:00:00Z`) } }, select: { createdAt: true, role: true } }),
  ]);
  const reportedAgainst = users.length
    ? await prisma.report.groupBy({ by: ["subjectUserId"], where: { subjectUserId: { in: users.map((u) => u.id) } }, _count: { _all: true } })
    : [];
  const reportsOn = new Map(reportedAgainst.map((r) => [r.subjectUserId, r._count._all]));
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const roleCount = (r: string) => roles.find((x) => x.role === r)?._count._all ?? 0;
  const all = roles.reduce((n, r) => n + r._count._all, 0);
  const self = (over: Record<string, string | number | undefined> = {}) => `/admin/accounts${qs(p, { ok: undefined, err: undefined, manage: undefined, ...over })}`;
  const hostWeeks = bucketWeeks(recentSignups.filter((u) => u.role === "host").map((u) => u.createdAt), weeks);
  const allWeeks = bucketWeeks(recentSignups.map((u) => u.createdAt), weeks);

  const managing = p.manage
    ? await prisma.user.findUnique({
        where: { id: p.manage },
        include: { identity: { select: { status: true } }, contact: { select: { id: true, stage: true } }, _count: { select: { listings: true, sessions: true } } },
      })
    : null;

  return (
    <div className="dk-stack">
      <DeskHeader
        href="/admin/accounts"
        flash={flashOf(p)}
        signals={[
          { label: "Hosts", value: `${roleCount("host")}`, tone: "live", href: "/admin/accounts?role=host" },
          { label: "Renters", value: `${roleCount("renter")}`, tone: "ok", href: "/admin/accounts?role=renter" },
          { label: "On a free trial", value: `${onTrial}`, tone: onTrial ? "live" : "ok", href: "/admin/accounts?state=trial" },
          { label: "Suspended", value: `${suspended}`, tone: suspended ? "warn" : "ok", href: "/admin/accounts?state=suspended" },
        ]}
        actions={
          <Link prefetch={false} className="dk-btn dk-btn--onink" href="/api/admin/export/accounts">
            <Icon name="export" size={15} /> Export CSV
          </Link>
        }
      />

      <div className="dk-kpis">
        <Kpi label="All accounts" value={all} href={self({ role: undefined, state: undefined, page: undefined })} active={!p.role && !p.state} />
        <Kpi label="Hosts" value={roleCount("host")} href={self({ role: p.role === "host" ? undefined : "host", page: undefined })} active={p.role === "host"} spark={hostWeeks.map((w) => w.count)} />
        <Kpi label="Renters" value={roleCount("renter")} href={self({ role: p.role === "renter" ? undefined : "renter", page: undefined })} active={p.role === "renter"} />
        <Kpi label="Founders" value={roleCount("admin")} href={self({ role: p.role === "admin" ? undefined : "admin", page: undefined })} active={p.role === "admin"} />
        <Kpi label="Unverified" value={Math.max(0, all - verified)} href={self({ state: p.state === "unverified" ? undefined : "unverified", page: undefined })} active={p.state === "unverified"} tone="value" />
        <Kpi label="On trial" value={onTrial} href={self({ state: p.state === "trial" ? undefined : "trial", page: undefined })} active={p.state === "trial"} tone="good" />
      </div>

      <div className="dk-grid dk-grid--2-1">
        <Panel title="New accounts per week" sub={`Last 12 weeks · ${recentSignups.length} in total`}>
          <Columns rows={allWeeks.map((w) => ({ label: w.week.slice(5), value: w.count }))} height={160} />
        </Panel>
        <Panel title="Verification" sub="Status only — documents are never stored.">
          <Donut
            items={[
              { label: "Verified", value: verified, href: self({ state: "verified", page: undefined }) },
              { label: "Not verified", value: Math.max(0, all - verified), href: self({ state: "unverified", page: undefined }) },
            ]}
            centerLabel="ACCOUNTS"
            size={140}
          />
        </Panel>
      </div>

      <FilterCard
        actions={
          <Link prefetch={false} href="/admin/accounts" className="dk-btn dk-btn--ghost dk-btn--sm">
            Reset
          </Link>
        }
      >
        <Field label="Search">
          <input name="q" placeholder="Name or email" defaultValue={p.q} />
        </Field>
        <Field label="Role">
          <select name="role" defaultValue={p.role}>
            <option value="">All roles</option>
            <option value="host">Hosts</option>
            <option value="renter">Renters</option>
            <option value="admin">Founders</option>
            <option value="staff">Team</option>
          </select>
        </Field>
        <Field label="State">
          <select name="state" defaultValue={p.state}>
            <option value="">Any state</option>
            <option value="trial">On free trial</option>
            <option value="verified">Verified</option>
            <option value="unverified">Not verified</option>
            <option value="suspended">Suspended</option>
          </select>
        </Field>
        <div className="dk-filters__go">
          <button className="dk-btn dk-btn--primary" type="submit">
            <Icon name="search" size={14} /> Apply
          </button>
        </div>
      </FilterCard>

      {users.length === 0 ? (
        <Empty title="No accounts match." />
      ) : (
        <Panel flush title={`${total.toLocaleString("en-US")} account${total === 1 ? "" : "s"}`} sub="Tick rows for bulk verify, free days, role or sign-out. Your own account is always skipped.">
          <BulkForm
            action={accountsBulk}
            returnTo={self()}
            noun="account"
            ops={[
              { op: "verify", label: "Mark verified" },
              { op: "unverify", label: "Remove verified" },
              { op: "trial", label: "Give free days", needs: "value", placeholder: "Days (default 7)" },
              { op: "host", label: "Make host" },
              { op: "renter", label: "Make renter" },
              { op: "signout", label: "Sign out everywhere", danger: true },
            ]}
          >
            <div className="dk-tablewrap">
              <table className="dk-table">
                <thead>
                  <tr>
                    <th>
                      <SelectAll />
                    </th>
                    <th>Account</th>
                    <th>Role</th>
                    <th>Verification</th>
                    <th>State</th>
                    <th className="dk-right">Listings</th>
                    <th>CRM</th>
                    <th className="dk-right">Joined</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const trial = u.trialEndsAt && u.trialEndsAt > now;
                    return (
                      <tr key={u.id} data-row="">
                        <td>{u.id === me.id ? null : <input type="checkbox" name="ids" value={u.id} aria-label={`Select ${u.name}`} />}</td>
                        <td className="dk-wrap">
                          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                            <Avatar name={u.name} email={u.email} />
                            <div>
                              <Link prefetch={false} href={self({ manage: u.id })} scroll={false}>
                                <b>{u.name}</b>
                              </Link>
                              <div className="dk-dim">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <Chip tone={u.role === "admin" ? "brand" : u.role === "host" ? "value" : "ink"}>{u.role}</Chip>
                        </td>
                        <td>
                          <Chip tone={u.identity?.status === "verified" ? "good" : "warn"}>{u.identity?.status || "unverified"}</Chip>
                        </td>
                        <td>
                          <div className="dk-chiprow">
                            {u.suspendedAt ? <Chip tone="bad">suspended</Chip> : null}
                            {trial ? <Chip tone="good">trial → {when(u.trialEndsAt, false)}</Chip> : null}
                            {reportsOn.get(u.id) ? <Chip tone="bad">{reportsOn.get(u.id)} reports</Chip> : null}
                            {!u.suspendedAt && !trial && !reportsOn.get(u.id) ? <span className="dk-dim">active</span> : null}
                          </div>
                        </td>
                        <td className="dk-right">
                          {u._count.listings ? <Link prefetch={false} href={`/admin/listings?host=${u.id}`}>{u._count.listings}</Link> : "—"}
                        </td>
                        <td>{u.contact ? <Link prefetch={false} href={`/admin/crm/${u.contact.id}`}>{u.contact.stage} →</Link> : <span className="dk-dim">—</span>}</td>
                        <td className="dk-right dk-dim">{ago(t - u.createdAt.getTime())}</td>
                        <td>
                          <Link prefetch={false} className="dk-btn dk-btn--sm" href={self({ manage: u.id })} scroll={false}>
                            Manage
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
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

      {managing ? (
        <RouteDrawer closeHref={self()} kicker={`${managing.role} · joined ${when(managing.createdAt, false)}`} title={managing.name}>
          <div className="dk-dossier">
            <div className="dk-chiprow">
              <Chip tone={managing.identity?.status === "verified" ? "good" : "warn"}>{managing.identity?.status || "unverified"}</Chip>
              <Chip>{managing._count.listings} listings</Chip>
              <Chip>{managing._count.sessions} sessions</Chip>
              {managing.suspendedAt ? <Chip tone="bad">suspended {when(managing.suspendedAt, false)}</Chip> : null}
              {managing.trialEndsAt && managing.trialEndsAt > now ? <Chip tone="good">trial until {when(managing.trialEndsAt, false)}</Chip> : null}
            </div>
            <p className="dk-hint">{managing.email}</p>
            {managing.suspendReason ? <p className="dk-flash dk-flash--err">Suspended: {managing.suspendReason}</p> : null}
            {managing.role === "staff" ? (
              <p className="dk-flash dk-flash--warn">
                Team member — access, two-factor and deactivation live in{" "}
                <Link prefetch={false} href={`/admin/team?open=${managing.id}`}>
                  Team &amp; access
                </Link>
                .
              </p>
            ) : null}

            <form action={accountAction} className="dk-form">
              <input type="hidden" name="id" value={managing.id} />
              <input type="hidden" name="returnTo" value={self()} />
              <label className="dk-field">
                <span>Role</span>
                <select name="role" defaultValue={managing.role}>
                  <option value="renter">renter</option>
                  <option value="host">host</option>
                  {isFounder(me) ? <option value="admin">admin (founder)</option> : null}
                </select>
              </label>
              <div className="dk-field" style={{ alignSelf: "end" }}>
                <button className="dk-btn" name="op" value="role">
                  Set role
                </button>
              </div>
              <label className="dk-field">
                <span>Free days</span>
                <input name="days" type="number" min={1} max={90} defaultValue={7} />
              </label>
              <div className="dk-field" style={{ alignSelf: "end" }}>
                <button className="dk-btn dk-btn--value" name="op" value="trial">
                  Give free days
                </button>
              </div>
              <div className="dk-compose__actions dk-field--wide">
                <button className="dk-btn" name="op" value={managing.identity?.status === "verified" ? "unverify" : "verify"}>
                  {managing.identity?.status === "verified" ? "Remove verified" : "Mark verified"}
                </button>
                {managing.trialEndsAt && managing.trialEndsAt > now ? (
                  <button className="dk-btn" name="op" value="endtrial">
                    End trial
                  </button>
                ) : null}
                <button className="dk-btn" name="op" value="signout">
                  Sign out everywhere
                </button>
                <button className="dk-btn dk-btn--primary" name="op" value="crm">
                  Open in CRM
                </button>
              </div>
              {managing.id !== me.id ? (
                managing.suspendedAt ? (
                  <div className="dk-danger dk-field--wide">
                    <button className="dk-btn" name="op" value="unsuspend">
                      Unsuspend
                    </button>
                  </div>
                ) : (
                  <div className="dk-danger dk-field--wide dk-form">
                    <label className="dk-field dk-field--wide">
                      <span>Suspension reason (signs them out and pauses their listings)</span>
                      <input name="reason" placeholder="e.g. asked renters for a deposit off-platform" />
                    </label>
                    <button className="dk-btn dk-btn--danger" name="op" value="suspend">
                      Suspend account
                    </button>
                  </div>
                )
              ) : (
                <p className="dk-hint dk-field--wide">This is your account — it can&rsquo;t be suspended or demoted from here.</p>
              )}
            </form>
            <div className="dk-compose__actions">
              <Link prefetch={false} className="dk-btn" href={`/admin/listings?host=${managing.id}`}>
                <Icon name="listings" size={14} /> Their listings
              </Link>
              {managing.contact ? (
                <Link prefetch={false} className="dk-btn" href={`/admin/crm/${managing.contact.id}`}>
                  <Icon name="crm" size={14} /> CRM · {managing.contact.stage}
                </Link>
              ) : null}
            </div>
          </div>
        </RouteDrawer>
      ) : null}
    </div>
  );
}
