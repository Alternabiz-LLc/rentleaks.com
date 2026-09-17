import { Card, NetShell } from "@/components/network/NetShell";
import { emailPortalLink } from "@/lib/network/engine";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partner portal — RentLeaks broker network", robots: { index: false, follow: false } };

async function send(fd: FormData) {
  "use server";
  const email = String(fd.get("email") || "").slice(0, 200);
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) await emailPortalLink(email).catch(() => undefined);
  redirect("/pro?sent=1");
}

/** Lost your portal link? Ask for a fresh one by email. */
export default async function PortalHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <NetShell
      kicker="Partner portal"
      title={sp.expired ? "That portal link has expired" : "Open your partner portal"}
      sub="Portal links are private and last 30 days. Enter the email you joined with and we'll send a fresh one."
    >
      <Card>
        {sp.sent ? (
          <p style={{ margin: 0 }}>If that email belongs to a partner, a link is on its way. Check your inbox (and spam).</p>
        ) : (
          <form action={send} className="nw-form">
            <label>
              Work email
              <input type="email" name="email" required autoComplete="email" />
            </label>
            <button className="nw-btn">Email me my link</button>
          </form>
        )}
        <p className="nw-muted">
          Not a partner yet? <a href="https://rentleaks.com/hire-a-broker/agents.html">Join the referral network</a>.
        </p>
      </Card>
    </NetShell>
  );
}
