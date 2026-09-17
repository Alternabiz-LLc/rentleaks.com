import Link from "next/link";
import { revokeSessionAction } from "@/app/actions/security";
import { Kpi } from "@/components/admin/desk/charts";
import { DeskHeader } from "@/components/admin/desk/DeskHeader";
import { Icon } from "@/components/admin/desk/Icon";
import { ChangePasswordForm, RegenerateCodesForm } from "@/components/admin/desk/SecurityForms";
import { ago, Chip, Panel } from "@/components/admin/desk/parts";
import { flashOf, readParams, when, type SP } from "@/components/admin/ui";
import { accessList, ACCESS_LABEL, isFounder } from "@/lib/access";
import { getCurrentSession } from "@/lib/auth";
import { requireAdminPage } from "@/lib/admin/guard";
import { nowMs } from "@/lib/admin/metrics";
import { prisma } from "@/lib/prisma";
import { deviceLabel } from "@/lib/security/device";
import { RECOVERY_COUNT } from "@/lib/security/recovery";

export const metadata = { title: "Security — RentLeaks desk" };

const EVENT_LABEL: Record<string, string> = {
  "security.signin.totp": "Signed in with the authenticator",
  "security.signin.recovery": "Signed in with a recovery code",
  "security.2fa.enabled": "Turned on two-factor",
  "security.2fa.moved": "Moved to a new authenticator",
  "security.recovery.regenerated": "Printed new recovery codes",
  "security.password.changed": "Changed password",
  "security.password.reset": "Reset password by email",
  "security.sessions.revoked": "Signed out other devices",
  "staff.invite": "Invited to the team",
  "staff.joined": "Joined the team",
  "staff.access": "Access changed",
  "staff.reset2fa": "Two-factor reset by the owner",
  "staff.deactivate": "Deactivated",
  "staff.reactivate": "Reactivated",
};

/** Every desk member's own page: password, two-factor, codes, devices. */
export default async function SecurityPage({ searchParams }: { searchParams: SP }) {
  const me = await requireAdminPage("/admin/security");
  const ctx = await getCurrentSession();
  const p = await readParams(searchParams);
  const t = nowMs();
  const now = new Date(t);
  const [codesLeft, sessions, events] = await Promise.all([
    prisma.recoveryCode.count({ where: { userId: me.id, usedAt: null } }),
    prisma.session.findMany({ where: { userId: me.id, kind: "session", expiresAt: { gt: now } }, orderBy: { createdAt: "desc" } }),
    prisma.adminAction.findMany({
      where: { OR: [{ actorId: me.id, action: { startsWith: "security." } }, { targetId: me.id, action: { startsWith: "staff." } }] },
      orderBy: { createdAt: "desc" },
      take: 14,
    }),
  ]);
  const others = sessions.filter((s) => s.id !== ctx?.session.id).length;
  const founder = isFounder(me);
  const access = accessList(me).filter((k) => k !== "overview");

  return (
    <div className="dk-stack">
      <DeskHeader
        href="/admin/security"
        flash={flashOf(p)}
        signals={[
          { label: "Two-factor", value: me.totpEnabledAt ? `On since ${when(me.totpEnabledAt, false)}` : "Off", tone: me.totpEnabledAt ? "live" : "critical" },
          { label: "Recovery codes", value: `${codesLeft} of ${RECOVERY_COUNT} left`, tone: codesLeft <= 3 ? "warn" : "ok", href: "#codes" },
          { label: "Signed in", value: `${sessions.length} device${sessions.length === 1 ? "" : "s"}`, tone: "ok", href: "#devices" },
        ]}
        actions={
          <Link prefetch={false} className="dk-btn dk-btn--light" href="/login/two-factor?change=1">
            <Icon name="phone" size={15} /> Move to a new phone
          </Link>
        }
      />

      <div className="dk-kpis">
        <Kpi label="Two-factor" value={me.totpEnabledAt ? "On" : "Off"} sub="authenticator app" tone={me.totpEnabledAt ? "good" : "alert"} />
        <Kpi label="Recovery codes left" value={codesLeft} sub={codesLeft <= 3 ? "print new ones soon" : "single use each"} tone={codesLeft <= 3 ? "alert" : undefined} href="#codes" />
        <Kpi label="Devices signed in" value={sessions.length} sub={others ? `${others} besides this one` : "only this one"} href="#devices" />
        <Kpi label="Access" value={founder ? "Full" : access.length} sub={founder ? "founder account" : "modules"} tone="value" />
      </div>

      <div className="dk-grid dk-grid--2">
        <Panel id="codes" kicker="Step 1 · keep a way back in" title="Recovery codes" sub="Each one signs you in once if your phone is lost. Printing new codes cancels the old ones.">
          <p className="dk-hint" style={{ marginBottom: 12 }}>
            {codesLeft} of {RECOVERY_COUNT} unused.
          </p>
          <RegenerateCodesForm email={me.email} />
        </Panel>
        <Panel kicker="Step 2 · rotate when in doubt" title="Password" sub="Changing it signs out every other device.">
          <ChangePasswordForm />
        </Panel>
      </div>

      <Panel
        id="devices"
        flush
        kicker="Step 3 · review devices"
        title="Where you're signed in"
        sub="Sign out anything you don't recognise, then change your password."
        actions={
          others ? (
            <form action={revokeSessionAction}>
              <input type="hidden" name="id" value="others" />
              <button className="dk-btn dk-btn--sm dk-btn--danger">
                <Icon name="logout" size={13} /> Sign out everywhere else
              </button>
            </form>
          ) : undefined
        }
      >
        <div className="dk-tablewrap">
          <table className="dk-table">
            <thead>
              <tr>
                <th>Device</th>
                <th>Signed in</th>
                <th>Two-factor</th>
                <th>Expires</th>
                <th className="dk-right" />
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const current = s.id === ctx?.session.id;
                return (
                  <tr key={s.id}>
                    <td>
                      <b>{deviceLabel(s.userAgent)}</b> {current ? <Chip tone="brand">this device</Chip> : null}
                    </td>
                    <td className="dk-dim">{ago(t - s.createdAt.getTime())}</td>
                    <td>{s.mfaAt ? <Chip tone="good">verified</Chip> : <Chip tone="warn">password only</Chip>}</td>
                    <td className="dk-dim">{when(s.expiresAt, false)}</td>
                    <td className="dk-right">
                      {current ? null : (
                        <form action={revokeSessionAction}>
                          <input type="hidden" name="id" value={s.id} />
                          <button className="dk-btn dk-btn--ghost dk-btn--sm">Sign out</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="dk-grid dk-grid--2">
        <Panel title="Your access" sub={founder ? "The founder account opens everything, including money, system and team." : "Set by the account owner in Team & access."}>
          <div className="dk-chiprow">
            {founder ? <Chip tone="value">Everything</Chip> : access.map((k) => <Chip key={k} tone="brand">{ACCESS_LABEL[k]}</Chip>)}
          </div>
        </Panel>
        <Panel title="Security activity" sub="Sign-ins and changes on your account, newest first.">
          {events.length === 0 ? (
            <p className="dk-empty">Nothing yet.</p>
          ) : (
            <ul className="dk-feed">
              {events.map((e) => (
                <li key={e.id}>
                  <span className={`dk-feed__icon${e.action.includes("recovery") || e.action.includes("reset") ? " dk-feed__icon--value" : ""}`}>
                    <Icon name="lock" size={15} />
                  </span>
                  <div>
                    <b>{EVENT_LABEL[e.action] ?? e.action.replace(/\./g, " · ")}</b>
                    <p>{when(e.createdAt)}</p>
                  </div>
                  <time dateTime={e.createdAt.toISOString()}>{ago(t - e.createdAt.getTime())}</time>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
