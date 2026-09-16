import Link from "next/link";
import { inviteAction, inviteHosts } from "@/app/admin/_actions/trials";
import { FunnelLanes, Kpi } from "@/components/admin/desk/charts";
import { DeskHeader } from "@/components/admin/desk/DeskHeader";
import { Icon } from "@/components/admin/desk/Icon";
import { ago, Avatar, Chip, Empty, Panel, Steps, ViewSwitch } from "@/components/admin/desk/parts";
import { flashOf, qs, readParams, when, type SP } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";
import { nowMs } from "@/lib/admin/metrics";
import { prisma } from "@/lib/prisma";
import { inviteLink, inviteState, type InviteStatus } from "@/lib/trials";

export const metadata = { title: "Free-trial invites — RentLeaks desk" };

const DAY = 86_400_000;
const TONE: Record<InviteStatus, "ink" | "brand" | "good" | "warn" | "bad"> = { pending: "ink", sent: "brand", redeemed: "good", expired: "warn", revoked: "bad" };

export default async function TrialsPage({ searchParams }: { searchParams: SP }) {
  await requireAdminPage("/admin/trials");
  const p = await readParams(searchParams);
  const t = nowMs();
  const now = new Date(t);
  const [invites, templates, onTrial] = await Promise.all([
    prisma.trialInvite.findMany({ orderBy: { createdAt: "desc" }, take: 300, include: { user: { select: { id: true, name: true, _count: { select: { listings: true } } } } } }),
    prisma.emailTemplate.findMany({ where: { purpose: "trial" }, select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { trialEndsAt: { not: null } },
      orderBy: { trialEndsAt: "asc" },
      take: 100,
      select: { id: true, name: true, email: true, trialEndsAt: true, _count: { select: { listings: true } } },
    }),
  ]);
  const states = invites.map((i) => inviteState(i, now));
  const count = (s: InviteStatus) => states.filter((x) => x === s).length;
  const reached = invites.filter((i) => i.sentAt).length;
  const redeemed = count("redeemed");
  const active = onTrial.filter((u) => u.trialEndsAt! > now);
  const listed = active.filter((u) => u._count.listings > 0).length;
  const ending = active.filter((u) => u.trialEndsAt!.getTime() - t < 3 * DAY).length;
  const filter = (["pending", "sent", "redeemed", "expired", "revoked"] as InviteStatus[]).includes(p.state as InviteStatus) ? (p.state as InviteStatus) : null;
  const shown = invites.map((inv, i) => ({ inv, state: states[i] })).filter((x) => !filter || x.state === filter);
  const self = (over: Record<string, string | undefined> = {}) => `/admin/trials${qs(p, { ok: undefined, err: undefined, ...over })}`;

  return (
    <div className="dk-stack">
      <DeskHeader
        href="/admin/trials"
        flash={flashOf(p)}
        signals={[
          { label: "Invites sent", value: `${reached} of ${invites.length}`, tone: "live" },
          { label: "Redeemed", value: reached ? `${redeemed} · ${Math.round((redeemed / reached) * 100)}%` : `${redeemed}`, tone: redeemed ? "live" : "ok" },
          { label: "Trials running", value: `${active.length} · ${listed} listed`, tone: "ok" },
          { label: "Ending in 3 days", value: `${ending}`, tone: ending ? "warn" : "ok", href: "/admin#next-best" },
        ]}
        actions={
          <>
            <Link prefetch={false} className="dk-btn dk-btn--onink" href="/api/admin/export/invites">
              <Icon name="export" size={15} /> Export CSV
            </Link>
            <Link prefetch={false} className="dk-btn dk-btn--light" href="#invite">
              <Icon name="ticket" size={15} /> Invite hosts
            </Link>
          </>
        }
      />

      <Steps
        steps={[
          { label: "Invite (personal link)", state: invites.length ? "done" : "on", href: "#invite" },
          { label: "They sign up through it", state: redeemed ? "done" : invites.length ? "on" : "todo" },
          { label: "They list a home", state: listed ? "done" : redeemed ? "on" : "todo" },
          { label: "They stay on a plan", state: "todo", href: "/admin/revenue" },
        ]}
      />

      <div className="dk-kpis">
        <Kpi label="Created" value={invites.length} href={self({ state: undefined })} active={!filter} />
        <Kpi label="Sent" value={count("sent")} href={self({ state: filter === "sent" ? undefined : "sent" })} active={filter === "sent"} />
        <Kpi label="Redeemed" value={redeemed} href={self({ state: filter === "redeemed" ? undefined : "redeemed" })} active={filter === "redeemed"} tone="good" />
        <Kpi label="Not sent yet" value={count("pending")} href={self({ state: filter === "pending" ? undefined : "pending" })} active={filter === "pending"} />
        <Kpi label="Expired unused" value={count("expired")} href={self({ state: filter === "expired" ? undefined : "expired" })} active={filter === "expired"} tone="value" />
        <Kpi label="Trials running" value={active.length} sub={`${listed} have listed`} />
      </div>

      <div className="dk-grid dk-grid--2">
        <Panel title="Trial funnel" sub="From invitation to a live listing.">
          <FunnelLanes
            stages={[
              { label: "Invited", value: invites.length },
              { label: "Email sent", value: reached, href: self({ state: "sent" }) },
              { label: "Redeemed", value: redeemed, href: self({ state: "redeemed" }) },
              { label: "Listed a home", value: invites.filter((i) => i.user && i.user._count.listings > 0).length },
            ]}
          />
        </Panel>
        <Panel title="Accounts on a trial" sub="Soonest to end first." actions={<Link prefetch={false} href="/admin/accounts?state=trial">Accounts →</Link>}>
          {onTrial.length === 0 ? (
            <Empty title="No trials yet." />
          ) : (
            <ul className="dk-feed">
              {onTrial.slice(0, 10).map((u) => {
                const ended = u.trialEndsAt! < now;
                const soon = !ended && u.trialEndsAt!.getTime() - t < 2 * DAY;
                return (
                  <li key={u.id}>
                    <Avatar name={u.name} email={u.email} />
                    <div>
                      <Link prefetch={false} href={`/admin/accounts?manage=${u.id}`}>
                        <b>{u.name}</b>
                      </Link>
                      <p>{u._count.listings} listings</p>
                    </div>
                    <time className={soon ? "dk-warn" : undefined}>
                      {ended ? "ended" : "ends"} {when(u.trialEndsAt, false)}
                    </time>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Panel id="invite" kicker="Invitation" title="Invite hosts to a free week" sub="Each invite is a personal link. Creating an account or signing in through it starts the trial.">
        <form action={inviteHosts} className="dk-form">
          <label className="dk-field dk-field--wide">
            <span>
              Recipients — one per line: <code>email</code> or <code>email, name</code>
            </span>
            <textarea name="recipients" rows={6} required placeholder={"jane@landlord.com, Jane Park\nops@colivingbrand.com"} />
          </label>
          <label className="dk-field">
            <span>Free days</span>
            <input name="days" type="number" min={1} max={90} defaultValue={7} />
          </label>
          <label className="dk-field">
            <span>Email template</span>
            <select name="templateId" defaultValue="">
              <option value="">Default invitation</option>
              {templates.map((tp) => (
                <option key={tp.id} value={tp.id}>
                  {tp.name}
                </option>
              ))}
            </select>
          </label>
          <label className="dk-field dk-field--wide">
            <span>Internal note</span>
            <input name="note" placeholder="Met at the Brooklyn landlord meetup" />
          </label>
          <label className="dk-check">
            <input type="checkbox" name="send" defaultChecked /> Email the invitation now (from your mailbox if SMTP is set)
          </label>
          <button className="dk-btn dk-btn--primary">
            <Icon name="ticket" size={14} /> Create invites
          </button>
          <p className="dk-hint">Invitees are added to the CRM as host contacts. Links stay valid for 30 days.</p>
        </form>
      </Panel>

      <Panel
        flush
        title={`Invites${filter ? ` · ${filter}` : ""}`}
        actions={
          <ViewSwitch
            label="Filter"
            items={[
              { key: "all", label: "All", href: self({ state: undefined }), on: !filter },
              { key: "sent", label: "Sent", href: self({ state: "sent" }), on: filter === "sent" },
              { key: "redeemed", label: "Redeemed", href: self({ state: "redeemed" }), on: filter === "redeemed" },
              { key: "expired", label: "Expired", href: self({ state: "expired" }), on: filter === "expired" },
            ]}
          />
        }
      >
        {shown.length === 0 ? (
          <div style={{ padding: 20 }}>
            <Empty title="No invites here." />
          </div>
        ) : (
          <div className="dk-tablewrap">
            <table className="dk-table">
              <thead>
                <tr>
                  <th>Invitee</th>
                  <th className="dk-right">Days</th>
                  <th>Status</th>
                  <th>Sent</th>
                  <th>Link</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map(({ inv, state }) => (
                  <tr key={inv.id}>
                    <td className="dk-wrap">
                      <b>{inv.name || inv.email}</b>
                      <div className="dk-dim">
                        {inv.email}
                        {inv.note ? ` · ${inv.note}` : ""}
                      </div>
                    </td>
                    <td className="dk-right">{inv.days}</td>
                    <td>
                      <Chip tone={TONE[state]}>{state}</Chip>
                      {inv.user ? (
                        <div className="dk-dim">
                          {inv.user.name} · {inv.user._count.listings} listings
                        </div>
                      ) : null}
                    </td>
                    <td className="dk-dim">{inv.sentAt ? ago(t - inv.sentAt.getTime()) : "—"}</td>
                    <td style={{ minWidth: 220 }}>
                      <input readOnly className="dk-copy" defaultValue={inviteLink(inv.code)} aria-label="Invite link" style={{ border: "1px solid var(--dk-line)", borderRadius: 8, padding: "6px 8px", background: "var(--dk-paper)", color: "var(--dk-ink)" }} />
                    </td>
                    <td>
                      {state !== "redeemed" && state !== "revoked" ? (
                        <form action={inviteAction} className="dk-inline">
                          <input type="hidden" name="id" value={inv.id} />
                          <button className="dk-btn dk-btn--sm" name="op" value="resend">
                            {inv.sentAt ? "Resend" : "Send"}
                          </button>
                          <button className="dk-btn dk-btn--ghost dk-btn--sm" name="op" value="revoke">
                            Revoke
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
