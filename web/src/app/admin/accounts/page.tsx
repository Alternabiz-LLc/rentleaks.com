import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { accountAction } from "@/app/admin/_actions/accounts";
import { Empty, flashOf, PageHead, Pager, Pill, qs, readParams, when, type SP } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Accounts — RentLeaks admin" };

const PAGE = 40;

export default async function AccountsAdmin({ searchParams }: { searchParams: SP }) {
  const me = await requireAdminPage();
  const p = await readParams(searchParams);
  const page = Math.max(1, Number(p.page) || 1);
  const now = new Date();
  const and: Prisma.UserWhereInput[] = [];
  if (p.q) and.push({ OR: [{ email: { contains: p.q, mode: "insensitive" } }, { name: { contains: p.q, mode: "insensitive" } }] });
  if (p.role) and.push({ role: p.role });
  if (p.state === "suspended") and.push({ suspendedAt: { not: null } });
  if (p.state === "trial") and.push({ trialEndsAt: { gt: now } });
  if (p.state === "unverified") and.push({ OR: [{ identity: null }, { identity: { status: { not: "verified" } } }] });
  const where: Prisma.UserWhereInput = and.length ? { AND: and } : {};

  const [total, users, roles] = await Promise.all([
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
  ]);
  const reportedAgainst = users.length
    ? await prisma.report.groupBy({ by: ["subjectUserId"], where: { subjectUserId: { in: users.map((u) => u.id) } }, _count: { _all: true } })
    : [];
  const reportsOn = new Map(reportedAgainst.map((r) => [r.subjectUserId, r._count._all]));
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const self = `/admin/accounts${qs(p, { ok: undefined, err: undefined })}`;
  const roleCount = (r: string) => roles.find((x) => x.role === r)?._count._all ?? 0;

  return (
    <>
      <PageHead
        title="Accounts"
        sub={`${roleCount("host")} hosts · ${roleCount("renter")} renters · ${roleCount("admin")} founders`}
        flash={flashOf(p)}
      >
        <Link className="btn btn--outline" href="/api/admin/export/accounts">Export CSV</Link>
      </PageHead>

      <form className="adm-filters" method="get">
        <input name="q" placeholder="Name or email" defaultValue={p.q} />
        <select name="role" defaultValue={p.role}>
          <option value="">All roles</option>
          <option value="host">Hosts</option>
          <option value="renter">Renters</option>
          <option value="admin">Founders</option>
        </select>
        <select name="state" defaultValue={p.state}>
          <option value="">Any state</option>
          <option value="trial">On free trial</option>
          <option value="unverified">Not verified</option>
          <option value="suspended">Suspended</option>
        </select>
        <button className="btn btn--primary" type="submit">Filter</button>
        <Link className="btn btn--ghost" href="/admin/accounts">Reset</Link>
      </form>

      {users.length === 0 ? (
        <Empty>No accounts match.</Empty>
      ) : (
        <ul className="adm-cards">
          {users.map((u) => {
            const onTrial = u.trialEndsAt && u.trialEndsAt > now;
            return (
              <li key={u.id} className="adm-card">
                <div className="adm-card__top">
                  <div>
                    <b>{u.name}</b> <span className="a-dim">{u.email}</span>
                    <div className="adm-tags">
                      <Pill tone={u.role === "admin" ? "brand" : ""}>{u.role}</Pill>
                      <Pill tone={u.identity?.status === "verified" ? "good" : "warn"}>{u.identity?.status || "unverified"}</Pill>
                      {u.suspendedAt ? <Pill tone="bad">suspended {when(u.suspendedAt, false)}</Pill> : null}
                      {onTrial ? <Pill tone="good">trial until {when(u.trialEndsAt, false)}</Pill> : null}
                      {reportsOn.get(u.id) ? <Pill tone="bad">{reportsOn.get(u.id)} reports</Pill> : null}
                    </div>
                  </div>
                  <div className="a-dim adm-right">
                    Joined {when(u.createdAt, false)}
                    <br />
                    <Link href={`/admin/listings?host=${u.id}`}>{u._count.listings} listings</Link> · {u._count.sessions} sessions
                    <br />
                    {u.contact ? <Link href={`/admin/crm/${u.contact.id}`}>CRM · {u.contact.stage}</Link> : null}
                  </div>
                </div>
                {u.suspendReason ? <p className="v-note">Suspended: {u.suspendReason}</p> : null}
                <form action={accountAction} className="adm-actions">
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="returnTo" value={self} />
                  <select name="role" defaultValue={u.role} aria-label="Role">
                    <option value="renter">renter</option>
                    <option value="host">host</option>
                    <option value="admin">admin</option>
                  </select>
                  <button className="btn btn--outline" name="op" value="role">Set role</button>
                  <button className="btn btn--outline" name="op" value={u.identity?.status === "verified" ? "unverify" : "verify"}>
                    {u.identity?.status === "verified" ? "Unverify" : "Mark verified"}
                  </button>
                  <input name="days" type="number" min={1} max={90} defaultValue={7} aria-label="Trial days" className="adm-num" />
                  <button className="btn btn--outline" name="op" value="trial">Give free days</button>
                  {onTrial ? <button className="btn btn--ghost" name="op" value="endtrial">End trial</button> : null}
                  <button className="btn btn--ghost" name="op" value="signout">Sign out everywhere</button>
                  <button className="btn btn--ghost" name="op" value="crm">Open in CRM</button>
                  {u.id !== me.id ? (
                    u.suspendedAt ? (
                      <button className="btn btn--outline" name="op" value="unsuspend">Unsuspend</button>
                    ) : (
                      <>
                        <input name="reason" placeholder="Suspension reason" aria-label="Suspension reason" />
                        <button className="btn btn--danger" name="op" value="suspend">Suspend</button>
                      </>
                    )
                  ) : null}
                </form>
              </li>
            );
          })}
        </ul>
      )}
      <Pager page={page} pages={pages} href={(n) => `/admin/accounts${qs(p, { page: n, ok: undefined, err: undefined })}`} />
    </>
  );
}
