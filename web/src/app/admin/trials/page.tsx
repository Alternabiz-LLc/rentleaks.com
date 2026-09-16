import Link from "next/link";
import { inviteAction, inviteHosts } from "@/app/admin/_actions/trials";
import { Empty, flashOf, PageHead, Pill, readParams, Section, Stats, when, type SP } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { inviteLink, inviteState } from "@/lib/trials";

export const metadata = { title: "Free-trial invites — RentLeaks admin" };

const TONE: Record<string, "" | "good" | "warn" | "bad" | "brand"> = { pending: "", sent: "brand", redeemed: "good", expired: "warn", revoked: "bad" };

export default async function TrialsPage({ searchParams }: { searchParams: SP }) {
  await requireAdminPage();
  const p = await readParams(searchParams);
  const now = new Date();
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
  const count = (s: string) => states.filter((x) => x === s).length;
  const redeemed = count("redeemed");
  const reached = invites.filter((i) => i.sentAt).length;
  const active = onTrial.filter((u) => u.trialEndsAt! > now);
  const listed = active.filter((u) => u._count.listings > 0).length;

  return (
    <>
      <PageHead
        title="Free-trial invites"
        sub="Invite hosts to list free for a week (or any number of days). Each invite is a personal link; creating an account or signing in through it starts the trial."
        flash={flashOf(p)}
      >
        <Link className="btn btn--outline" href="/api/admin/export/invites">Export CSV</Link>
      </PageHead>
      <Stats
        items={[
          { k: "Invites sent", v: reached, s: `${invites.length} created` },
          { k: "Redeemed", v: redeemed, s: reached ? `${Math.round((redeemed / reached) * 100)}% of sent` : undefined },
          { k: "Trials running", v: active.length, s: `${listed} have listed a home` },
          { k: "Expired unused", v: count("expired") },
        ]}
      />

      <div className="a-cols">
        <Section title="Invite hosts">
          <form action={inviteHosts} className="adm-form">
            <label>
              Recipients — one per line: <code>email</code> or <code>email, name</code>
              <textarea name="recipients" rows={6} required placeholder={"jane@landlord.com, Jane Park\nops@colivingbrand.com"} />
            </label>
            <div className="adm-row">
              <label>Free days<input name="days" type="number" min={1} max={90} defaultValue={7} className="adm-num" /></label>
              <label>
                Email template
                <select name="templateId" defaultValue="">
                  <option value="">Default invitation</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>Internal note<input name="note" placeholder="Met at Brooklyn landlord meetup" /></label>
            <label className="adm-check"><input type="checkbox" name="send" defaultChecked /> Email the invitation now (from your mailbox if SMTP is set)</label>
            <button className="btn btn--primary">Create invites</button>
            <small className="a-dim">Invites are added to the CRM as host contacts. Links stay valid for 30 days.</small>
          </form>
        </Section>

        <Section title="Accounts on a trial">
          {onTrial.length === 0 ? (
            <Empty>No trials yet.</Empty>
          ) : (
            <table className="a-table">
              <tbody>
                {onTrial.map((u) => (
                  <tr key={u.id}>
                    <td><Link href={`/admin/accounts?q=${encodeURIComponent(u.email)}`}>{u.name}</Link></td>
                    <td>{u._count.listings} listings</td>
                    <td className={u.trialEndsAt! < now ? "a-dim" : u.trialEndsAt!.getTime() - now.getTime() < 2 * 86_400_000 ? "a-warn" : undefined}>
                      {u.trialEndsAt! < now ? "ended" : "ends"} {when(u.trialEndsAt, false)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>

      <Section title="Invites">
        {invites.length === 0 ? (
          <Empty>No invites yet.</Empty>
        ) : (
          <div className="a-scroll">
            <table className="a-table adm-table">
              <thead>
                <tr><th>Invitee</th><th>Days</th><th>Status</th><th>Sent</th><th>Link</th><th /></tr>
              </thead>
              <tbody>
                {invites.map((i, idx) => (
                  <tr key={i.id}>
                    <td className="adm-wrap"><b>{i.name || i.email}</b><div className="a-dim">{i.email}{i.note ? ` · ${i.note}` : ""}</div></td>
                    <td>{i.days}</td>
                    <td>
                      <Pill tone={TONE[states[idx]]}>{states[idx]}</Pill>
                      {i.user ? <div className="a-dim">{i.user.name} · {i.user._count.listings} listings</div> : null}
                    </td>
                    <td>{when(i.sentAt, false)}</td>
                    <td><input readOnly className="adm-copy" defaultValue={inviteLink(i.code)} aria-label="Invite link" /></td>
                    <td>
                      {states[idx] !== "redeemed" && states[idx] !== "revoked" ? (
                        <form action={inviteAction} className="adm-inline">
                          <input type="hidden" name="id" value={i.id} />
                          <button className="btn btn--outline" name="op" value="resend">{i.sentAt ? "Resend" : "Send"}</button>
                          <button className="btn btn--ghost" name="op" value="revoke">Revoke</button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
