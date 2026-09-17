import Link from "next/link";
import { inviteStaff, teamAction } from "@/app/admin/_actions/team";
import { AccessPicker } from "@/components/admin/desk/AccessPicker";
import { Kpi } from "@/components/admin/desk/charts";
import { DeskHeader } from "@/components/admin/desk/DeskHeader";
import { Icon } from "@/components/admin/desk/Icon";
import { RecordCards, type RecordCard } from "@/components/admin/desk/RecordCards";
import { RouteDrawer } from "@/components/admin/desk/RouteDrawer";
import { ago, Chip, CommandRail, Panel, Steps, initials } from "@/components/admin/desk/parts";
import { flashOf, qs, readParams, when, type SP } from "@/components/admin/ui";
import { ACCESS_LABEL, cleanAccess, PRESETS, presetOf, type PresetKey } from "@/lib/access";
import { requireAdminPage } from "@/lib/admin/guard";
import { nowMs } from "@/lib/admin/metrics";
import { prisma } from "@/lib/prisma";
import { deviceLabel } from "@/lib/security/device";

export const metadata = { title: "Team & access — RentLeaks desk" };

const DAY = 86_400_000;
const TABS = ["team", "invite", "activity"] as const;
type Tab = (typeof TABS)[number];

const EVENT: Record<string, string> = {
  "staff.invite": "invited",
  "staff.access": "changed access for",
  "staff.reset2fa": "reset two-factor for",
  "staff.signout": "signed out",
  "staff.deactivate": "deactivated",
  "staff.reactivate": "reactivated",
  "staff.cancel": "cancelled the invitation of",
  "staff.joined": "joined",
  "security.signin.totp": "signed in",
  "security.signin.recovery": "signed in with a recovery code",
  "security.2fa.enabled": "turned on two-factor",
  "security.2fa.moved": "moved to a new authenticator",
  "security.password.changed": "changed their password",
  "security.password.reset": "reset their password by email",
  "security.recovery.regenerated": "printed new recovery codes",
  "security.sessions.revoked": "signed out other devices",
};

type Member = Awaited<ReturnType<typeof loadMembers>>[number];

async function loadMembers() {
  return prisma.user.findMany({
    where: { role: { in: ["admin", "staff"] } },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      staffAccess: true,
      staffTitle: true,
      staffInvitedAt: true,
      staffJoinedAt: true,
      totpEnabledAt: true,
      mfaLockedUntil: true,
      suspendedAt: true,
      lastSignInAt: true,
      passwordHash: true,
      createdAt: true,
      _count: { select: { recoveryCodes: { where: { usedAt: null } } } },
    },
  });
}

function stateOf(m: Member) {
  if (m.suspendedAt) return { label: "Deactivated", tone: "bad" as const };
  if (m.role === "staff" && !m.passwordHash) return { label: "Invited", tone: "warn" as const };
  if (!m.totpEnabledAt) return { label: "Needs two-factor", tone: "warn" as const };
  return { label: "Active", tone: "good" as const };
}

function roleLabel(m: Member) {
  if (m.role === "admin") return "Founder";
  const p = presetOf(m.staffAccess);
  return m.staffTitle || (p ? PRESETS[p].label : "Custom access");
}

/**
 * Team & access (founder only): who works on the desk, what each person can
 * open, invitations and two-factor coverage — invite in three steps.
 */
export default async function TeamPage({ searchParams }: { searchParams: SP }) {
  const me = await requireAdminPage("/admin/team");
  const p = await readParams(searchParams);
  const t = nowMs();
  const tab: Tab = (TABS as readonly string[]).includes(p.tab) ? (p.tab as Tab) : "team";
  const self = (over: Record<string, string | undefined> = {}) => `/admin/team${qs(p, { ok: undefined, err: undefined, ...over })}`;

  const members = await loadMembers();
  const ids = members.map((m) => m.id);
  const [events, sessions, managingSessions] = await Promise.all([
    prisma.adminAction.findMany({
      where: {
        OR: [
          { action: { startsWith: "staff." } },
          { action: { startsWith: "security." }, actorId: { in: ids } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: tab === "activity" ? 80 : 8,
    }),
    prisma.session.groupBy({ by: ["userId"], where: { userId: { in: ids }, kind: "session", expiresAt: { gt: new Date(t) } }, _count: { _all: true } }),
    p.open
      ? prisma.session.findMany({ where: { userId: p.open, kind: "session", expiresAt: { gt: new Date(t) } }, orderBy: { createdAt: "desc" }, take: 10 })
      : Promise.resolve([]),
  ]);
  const byId = new Map(members.map((m) => [m.id, m]));
  const devices = (id: string) => sessions.find((s) => s.userId === id)?._count._all ?? 0;

  const staff = members.filter((m) => m.role === "staff");
  const active = staff.filter((m) => !m.suspendedAt && m.passwordHash);
  const pending = staff.filter((m) => !m.suspendedAt && !m.passwordHash);
  const deactivated = staff.filter((m) => m.suspendedAt);
  const live = members.filter((m) => !m.suspendedAt && m.passwordHash);
  const withTf = live.filter((m) => m.totpEnabledAt).length;
  const recent = live.filter((m) => m.lastSignInAt && t - m.lastSignInAt.getTime() < 7 * DAY).length;
  const presetParam = (Object.keys(PRESETS) as PresetKey[]).includes(p.preset as PresetKey) ? (p.preset as PresetKey) : "sales";

  const cards: RecordCard[] = members.map((m) => {
    const st = stateOf(m);
    const areas = m.role === "admin" ? ["Everything"] : cleanAccess(m.staffAccess).filter((k) => k !== "overview").map((k) => ACCESS_LABEL[k]);
    return {
      id: m.id,
      title: m.id === me.id ? `${m.name} (you)` : m.name,
      sub: `${roleLabel(m)} · ${m.email}`,
      initials: initials(m.name, m.email),
      status: st,
      chips: [
        m.totpEnabledAt ? { label: "2FA on", tone: "good" } : { label: "2FA off", tone: "bad" },
        ...(m.mfaLockedUntil && m.mfaLockedUntil.getTime() > t ? [{ label: "locked", tone: "bad" }] : []),
      ],
      lines: [
        { k: "Access", v: areas.length > 3 ? `${areas.slice(0, 3).join(", ")} +${areas.length - 3}` : areas.join(", ") || "Overview only" },
        { k: "Last sign-in", v: m.lastSignInAt ? ago(t - m.lastSignInAt.getTime()) : m.passwordHash ? "not yet" : "—" },
        {
          k: m.passwordHash ? "Devices" : "Invited",
          v: m.passwordHash ? String(devices(m.id)) : m.staffInvitedAt ? `${ago(t - m.staffInvitedAt.getTime())} · link lasts 48 h` : "—",
          tone: !m.passwordHash && m.staffInvitedAt && t - m.staffInvitedAt.getTime() > 2 * DAY ? "warn" : undefined,
        },
      ],
      accent: st.tone === "good" ? "good" : st.tone === "bad" ? "bad" : "warn",
      href: m.id === me.id ? "/admin/security" : m.role === "admin" ? `/admin/accounts?manage=${m.id}` : self({ open: m.id }),
      selectable: false,
      primary: m.role === "staff" && !m.passwordHash && !m.suspendedAt ? { label: "Resend", href: self({ open: m.id }) } : undefined,
    };
  });

  const managing = p.open ? byId.get(p.open) : undefined;
  const who = (id: string) => byId.get(id)?.name ?? "Someone";

  return (
    <div className="dk-stack">
      <DeskHeader
        href="/admin/team"
        flash={flashOf(p)}
        signals={[
          { label: "Team", value: `${active.length} active · ${pending.length} invited`, tone: "live", href: self({ tab: undefined }) },
          { label: "Two-factor coverage", value: `${withTf}/${live.length} accounts`, tone: withTf === live.length ? "ok" : "critical" },
          { label: "Your account", value: me.totpEnabledAt ? "protected" : "set up two-factor", tone: me.totpEnabledAt ? "ok" : "critical", href: "/admin/security" },
        ]}
        actions={
          <Link prefetch={false} className="dk-btn dk-btn--light" href={self({ tab: "invite", open: undefined })} scroll={false}>
            <Icon name="plus" size={15} /> Invite a team member
          </Link>
        }
      />

      <div className="dk-kpis">
        <Kpi label="Active members" value={active.length} sub="plus you" href={self({ tab: undefined })} />
        <Kpi label="Pending invites" value={pending.length} sub="waiting to set a password" tone={pending.length ? "brand" : undefined} />
        <Kpi label="Two-factor on" value={live.length ? Math.round((withTf / live.length) * 100) : 100} fmt="pct" sub={`${withTf} of ${live.length} who can sign in`} tone={withTf === live.length ? "good" : "alert"} />
        <Kpi label="Signed in this week" value={recent} sub="founder included" />
        <Kpi label="Deactivated" value={deactivated.length} sub="kept for the audit log" />
      </div>

      <div className="dk-grid dk-grid--rail">
        <CommandRail
          title="Team command"
          sub="Invite · grant · protect"
          tabs={[
            { key: "team", label: "Team", href: self({ tab: undefined, open: undefined }), on: tab === "team", count: members.length },
            { key: "invite", label: "Invite", href: self({ tab: "invite", open: undefined }), on: tab === "invite" },
            { key: "activity", label: "Activity", href: self({ tab: "activity", open: undefined }), on: tab === "activity" },
          ]}
          quick={{
            title: "Invite as",
            items: (Object.entries(PRESETS) as Array<[PresetKey, (typeof PRESETS)[PresetKey]]>).map(([k, v]) => ({
              label: v.label,
              href: self({ tab: "invite", preset: k, open: undefined }),
              mark: (
                <span className="dk-railcard__mark" style={{ background: "var(--dk-teal-deep)" }}>
                  <Icon name="team" size={14} />
                </span>
              ),
              note: `${v.access.length - 1} areas`,
            })),
          }}
        />

        <div className="dk-stack">
          {tab === "team" ? (
            <>
              <Panel kicker="Who works on the desk" title="Team" sub="Click a card to change access, resend an invitation, reset two-factor or deactivate.">
                <RecordCards cards={cards} empty="Just you so far — invite your first team member." />
              </Panel>
              <Panel title="How access works" sub="Three rules the desk enforces on every click.">
                <ol className="dk-rules">
                  <li>
                    <b>Two-factor for everyone.</b> Nobody opens the desk with a password alone — employees set up an authenticator app when they join.
                  </li>
                  <li>
                    <b>Only what you tick.</b> Pages, buttons, search results, exports and the Overview all follow each person&rsquo;s access.
                  </li>
                  <li>
                    <b>Money, system and team stay yours.</b> Revenue, System &amp; settings and this page are owner-only.
                  </li>
                </ol>
              </Panel>
            </>
          ) : null}

          {tab === "invite" ? (
            <Panel id="invite" kicker="Invite in three steps" title="Add a team member" sub="They get an email link to choose a password, then set up two-factor. You never see their password.">
              <Steps
                steps={[
                  { label: "Who", state: "on" },
                  { label: "What they can open", state: "on" },
                  { label: "Send the invitation", state: "todo" },
                ]}
              />
              <form action={inviteStaff} className="dk-stack" style={{ marginTop: 16 }}>
                <input type="hidden" name="returnTo" value={self({ tab: "invite" })} />
                <fieldset className="dk-fieldset">
                  <legend>1 · Who</legend>
                  <div className="dk-form">
                    <label className="dk-field">
                      <span>Full name</span>
                      <input name="name" required minLength={2} placeholder="Maya Chen" autoComplete="off" />
                    </label>
                    <label className="dk-field">
                      <span>Work email</span>
                      <input name="email" type="email" required placeholder="maya@rentleaks.com" autoComplete="off" />
                    </label>
                    <label className="dk-field">
                      <span>Job title (optional)</span>
                      <input name="title" placeholder="Leasing coordinator" maxLength={60} />
                    </label>
                  </div>
                </fieldset>
                <fieldset className="dk-fieldset">
                  <legend>2 · What they can open</legend>
                  <AccessPicker key={presetParam} initial={PRESETS[presetParam].access} />
                </fieldset>
                <fieldset className="dk-fieldset">
                  <legend>3 · Send</legend>
                  <p className="dk-hint">The link works once, for 48 hours. You can resend it or cancel it from their card.</p>
                  <button className="dk-btn dk-btn--primary">
                    <Icon name="mail" size={14} /> Send invitation
                  </button>
                </fieldset>
              </form>
            </Panel>
          ) : null}

          {tab === "activity" || tab === "team" ? (
            <Panel
              kicker="Audit"
              title={tab === "activity" ? "Team activity" : "Latest team activity"}
              sub="Invitations, access changes and sign-ins — who did what, when."
              actions={tab === "team" ? <Link prefetch={false} href={self({ tab: "activity" })}>All activity →</Link> : undefined}
            >
              {events.length === 0 ? (
                <p className="dk-empty">Nothing yet.</p>
              ) : (
                <ul className="dk-feed">
                  {events.map((e) => {
                    const target = e.targetId && e.targetId !== e.actorId ? byId.get(e.targetId)?.name ?? (e.detail as { email?: string })?.email ?? "a former member" : "";
                    return (
                      <li key={e.id}>
                        <span className={`dk-feed__icon${e.action.includes("reset") || e.action.includes("recovery") || e.action.includes("deactivate") ? " dk-feed__icon--bad" : e.action.startsWith("staff.") ? " dk-feed__icon--value" : ""}`}>
                          <Icon name={e.action.startsWith("staff.") ? "team" : "lock"} size={15} />
                        </span>
                        <div>
                          <b>
                            {who(e.actorId)} {EVENT[e.action] ?? e.action.replace(/\./g, " · ")} {target}
                          </b>
                          <p>{when(e.createdAt)}</p>
                        </div>
                        <time dateTime={e.createdAt.toISOString()}>{ago(t - e.createdAt.getTime())}</time>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          ) : null}
        </div>
      </div>

      {managing && managing.role === "staff" ? (
        <RouteDrawer closeHref={self({ open: undefined })} kicker={`${roleLabel(managing)} · ${stateOf(managing).label}`} title={managing.name} width={680}>
          <div className="dk-dossier">
            <div className="dk-chiprow">
              <Chip tone={stateOf(managing).tone}>{stateOf(managing).label}</Chip>
              <Chip tone={managing.totpEnabledAt ? "good" : "bad"}>{managing.totpEnabledAt ? `2FA since ${when(managing.totpEnabledAt, false)}` : "2FA not set up"}</Chip>
              {managing.totpEnabledAt ? <Chip>{managing._count.recoveryCodes} recovery codes left</Chip> : null}
              <Chip>{devices(managing.id)} devices</Chip>
            </div>
            <p className="dk-hint">
              {managing.email} · invited {managing.staffInvitedAt ? when(managing.staffInvitedAt, false) : "—"}
              {managing.staffJoinedAt ? ` · joined ${when(managing.staffJoinedAt, false)}` : ""}
              {managing.lastSignInAt ? ` · last sign-in ${ago(t - managing.lastSignInAt.getTime())}` : ""}
            </p>

            {!managing.passwordHash && !managing.suspendedAt ? (
              <div className="dk-inline">
                <form action={teamAction}>
                  <input type="hidden" name="id" value={managing.id} />
                  <input type="hidden" name="returnTo" value={self()} />
                  <button className="dk-btn dk-btn--primary" name="op" value="resend">
                    <Icon name="mail" size={14} /> Resend invitation
                  </button>
                </form>
                <form action={teamAction}>
                  <input type="hidden" name="id" value={managing.id} />
                  <button className="dk-btn dk-btn--ghost" name="op" value="cancel">
                    Cancel invitation
                  </button>
                </form>
              </div>
            ) : null}

            <form action={teamAction} className="dk-stack">
              <input type="hidden" name="id" value={managing.id} />
              <input type="hidden" name="returnTo" value={self()} />
              <label className="dk-field">
                <span>Job title</span>
                <input name="title" defaultValue={managing.staffTitle ?? ""} maxLength={60} placeholder="Leasing coordinator" />
              </label>
              <AccessPicker key={managing.id} initial={managing.staffAccess} />
              <button className="dk-btn dk-btn--primary" name="op" value="access">
                <Icon name="check" size={14} /> Save access
              </button>
            </form>

            {managingSessions.length ? (
              <div>
                <p className="dk-kicker" style={{ marginBottom: 6 }}>
                  Signed in on
                </p>
                <ul className="dk-feed">
                  {managingSessions.map((s) => (
                    <li key={s.id}>
                      <span className="dk-feed__icon">
                        <Icon name="phone" size={14} />
                      </span>
                      <div>
                        <b>{deviceLabel(s.userAgent)}</b>
                        <p>{s.mfaAt ? "verified with two-factor" : "password only — can't open the desk"}</p>
                      </div>
                      <time>{ago(t - s.createdAt.getTime())}</time>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="dk-dangerzone">
              <p className="dk-kicker">Security</p>
              <form action={teamAction} className="dk-inline">
                <input type="hidden" name="id" value={managing.id} />
                <input type="hidden" name="returnTo" value={self()} />
                {managing.passwordHash ? (
                  <button className="dk-btn" name="op" value="signout">
                    <Icon name="logout" size={14} /> Sign out everywhere
                  </button>
                ) : null}
                {managing.totpEnabledAt ? (
                  <button className="dk-btn" name="op" value="reset2fa">
                    <Icon name="phone" size={14} /> Reset two-factor (lost phone)
                  </button>
                ) : null}
                {managing.suspendedAt ? (
                  <button className="dk-btn dk-btn--primary" name="op" value="reactivate">
                    Reactivate
                  </button>
                ) : managing.passwordHash ? (
                  <button className="dk-btn dk-btn--danger" name="op" value="deactivate">
                    Deactivate account
                  </button>
                ) : null}
              </form>
              <p className="dk-hint">Deactivating signs them out at once and blocks sign-in. Their actions stay in the audit log.</p>
            </div>
          </div>
        </RouteDrawer>
      ) : null}
    </div>
  );
}
