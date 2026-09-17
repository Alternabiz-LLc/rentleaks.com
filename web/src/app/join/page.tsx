import Link from "next/link";
import { Gate } from "@/components/auth/Gate";
import { JoinForm } from "@/components/auth/JoinForm";
import { ACCESS_LABEL, cleanAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { peekInvite } from "@/lib/v1/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Join the RentLeaks team", robots: { index: false }, referrer: "no-referrer" as const };

/** Where a staff invitation lands: who invited you, what you'll open, a password. */
export default async function JoinPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const user = await peekInvite(token);
  if (!user || user.role !== "staff") {
    return (
      <Gate kicker="Team invitation" title="This link has expired">
        <p className="gt__muted">Invitations work once and last 48 hours. Ask the person who invited you to resend it from Team &amp; access.</p>
        <Link className="gt__btn gt__btn--ghost" href="/login" prefetch={false}>
          Already joined? Sign in
        </Link>
      </Gate>
    );
  }
  const inviter = user.invitedById ? await prisma.user.findUnique({ where: { id: user.invitedById }, select: { name: true } }) : null;
  const areas = cleanAccess(user.staffAccess).map((k) => ACCESS_LABEL[k]);
  return (
    <Gate
      kicker="Team invitation"
      title={`Welcome, ${user.name.split(/\s+/)[0]}`}
      sub={`${inviter?.name ?? "The RentLeaks team"} invited you to the RentLeaks desk${user.staffTitle ? ` as ${user.staffTitle}` : ""}.`}
      steps={[
        { label: "Password", state: "on" },
        { label: "Two-factor", state: "todo" },
        { label: "Desk", state: "todo" },
      ]}
    >
      <div className="gt__who">
        <span className="gt__avatar">{user.name.slice(0, 1).toUpperCase()}</span>
        <div>
          <b>{user.name}</b>
          <p className="gt__muted">{user.email}</p>
        </div>
      </div>
      <div>
        <p className="gt__muted" style={{ marginBottom: 8 }}>
          You&rsquo;ll be able to open:
        </p>
        <div className="gt__chips">
          {areas.map((a) => (
            <span key={a}>{a}</span>
          ))}
        </div>
      </div>
      <JoinForm token={token} email={user.email} />
    </Gate>
  );
}
