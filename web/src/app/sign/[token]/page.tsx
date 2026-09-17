import { nowMs } from "@/lib/admin/metrics";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AgreementView } from "@/components/network/AgreementView";
import { Card, flashOf, NetShell, Pill } from "@/components/network/NetShell";
import { PrintButton, SignaturePad, TypedSignature } from "@/components/network/SignaturePad";
import { canSignNow, ESIGN_DISCLOSURE } from "@/lib/network/core";
import { clientIp, declineEnvelope, NetworkError, recordView, signEnvelope, signerFromToken } from "@/lib/network/engine";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review and sign — RentLeaks", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

const ROLE: Record<string, string> = { tenant: "tenant", partner: "broker", supervisor: "broker of record", rentleaks: "RentLeaks" };

async function ctx() {
  const h = await headers();
  return { ip: clientIp(h), ua: h.get("user-agent") };
}

function go(token: string, kind: "ok" | "err", msg: string): never {
  redirect(`/sign/${encodeURIComponent(token)}?${kind}=${encodeURIComponent(msg)}#${kind === "ok" ? "document" : "sign"}`);
}

async function sign(fd: FormData) {
  "use server";
  const token = String(fd.get("token") || "");
  const s = await signerFromToken(token);
  if (!s) redirect("/sign/expired");
  try {
    const r = await signEnvelope(
      s.id,
      { typedName: String(fd.get("typedName") || ""), drawn: String(fd.get("drawn") || "") || null, consent: fd.get("consent") === "on", readIt: fd.get("readIt") === "on" },
      await ctx(),
    );
    go(token, "ok", r.status === "completed" ? "Signed. Everyone has now signed — your copy is below and on its way by email." : "Signed. We've sent it to the next person.");
  } catch (err) {
    if (err instanceof NetworkError) go(token, "err", err.message);
    throw err;
  }
}

async function decline(fd: FormData) {
  "use server";
  const token = String(fd.get("token") || "");
  const s = await signerFromToken(token);
  if (!s) redirect("/sign/expired");
  try {
    await declineEnvelope(s.id, String(fd.get("reason") || ""), await ctx());
    go(token, "ok", "You declined this agreement. Nothing was signed.");
  } catch (err) {
    if (err instanceof NetworkError) go(token, "err", err.message);
    throw err;
  }
}

/**
 * Review → consent → sign, in one screen. The document is frozen when the
 * envelope is created and checked against its SHA-256 before every signature.
 */
export default async function SignPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await params;
  const flash = flashOf(await searchParams);
  const s = await signerFromToken(token);
  if (!s) {
    return (
      <NetShell kicker="Agreement" title="This signing link has expired" sub="Signing links are replaced whenever a reminder goes out. Use the newest email, or reply to it and we'll send a fresh one.">
        <Card>
          <p className="nw-muted">Nothing was signed with this link.</p>
        </Card>
      </NetShell>
    );
  }
  await recordView(s.id, await ctx());
  const env = s.agreement;
  const open = env.status === "sent" || env.status === "partial";
  const expired = env.expiresAt.getTime() < nowMs();
  const myTurn = open && !expired && canSignNow(env.signers, s.id);
  const done = s.status === "signed";
  const steps = [
    { label: "Review the agreement", state: done ? "done" : "on" },
    { label: "Agree to sign electronically", state: done ? "done" : myTurn ? "on" : "todo" },
    { label: env.status === "completed" ? "Everyone has signed" : "Sign", state: env.status === "completed" ? "done" : done ? "done" : "todo" },
  ] as const;
  const waitingOn = env.signers.find((x) => x.status !== "signed");

  return (
    <NetShell
      kicker={`Agreement · you sign as ${ROLE[s.role] ?? s.role}`}
      title={env.status === "completed" ? "Signed by everyone" : done ? "You've signed" : "Review and sign"}
      sub={env.title}
      steps={[...steps]}
      flash={flash}
      aside={
        <>
          <Card title="Status">
            <div className="nw-pills" style={{ marginBottom: "0.7rem" }}>
              <Pill tone={env.status === "completed" ? "good" : env.status === "declined" || env.status === "voided" ? "bad" : "warn"}>{env.status === "partial" ? "partly signed" : env.status === "sent" ? "out for signature" : env.status}</Pill>
              {open ? <Pill>open until {env.expiresAt.toISOString().slice(0, 10)}</Pill> : null}
            </div>
            <ol style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.35rem" }}>
              {env.signers.map((x) => (
                <li key={x.id}>
                  <b>{x.name}</b> <span className="nw-muted">({ROLE[x.role] ?? x.role})</span> — {x.status === "signed" ? "signed ✓" : x.status === "declined" ? "declined" : x.id === s.id ? "you" : "waiting"}
                </li>
              ))}
            </ol>
            {done && waitingOn && open ? <p className="nw-muted">Waiting on {waitingOn.name}. You&rsquo;ll get the completed copy by email.</p> : null}
          </Card>
          {env.status === "completed" || done ? (
            <Card>
              <PrintButton />
              <p className="nw-muted">Keep a copy. You can ask for a paper copy at any time by replying to any of our emails.</p>
            </Card>
          ) : null}
        </>
      }
    >
      <AgreementView env={env} scroll={myTurn} />
      {myTurn ? (
        <Card id="sign" title="Sign" kicker="Step 2 and 3" tone="brand">
          <form action={sign} className="nw-form">
            <input type="hidden" name="token" value={token} />
            <p className="nw-note">{ESIGN_DISCLOSURE}</p>
            <label className="nw-check">
              <input type="checkbox" name="consent" required /> I agree to use electronic records and signatures for this agreement.
            </label>
            <label className="nw-check">
              <input type="checkbox" name="readIt" required /> I have read the whole agreement and I intend to sign it.
            </label>
            <TypedSignature expected={s.name} />
            <SignaturePad />
            <button className="nw-btn nw-btn--lg nw-btn--block">Sign agreement</button>
          </form>
          <details style={{ marginTop: "1rem" }}>
            <summary className="nw-muted" style={{ cursor: "pointer" }}>
              I don&rsquo;t want to sign
            </summary>
            <form action={decline} className="nw-form" style={{ marginTop: "0.6rem" }}>
              <input type="hidden" name="token" value={token} />
              <label>
                Tell us why (optional)
                <input name="reason" maxLength={300} />
              </label>
              <button className="nw-btn nw-btn--danger">Decline this agreement</button>
            </form>
          </details>
        </Card>
      ) : open && !done && !expired ? (
        <Card tone="warn">
          <p style={{ margin: 0 }}>It isn&rsquo;t your turn yet — {waitingOn?.name} signs first. We&rsquo;ll email you when it&rsquo;s ready.</p>
        </Card>
      ) : expired && open ? (
        <Card tone="warn">
          <p style={{ margin: 0 }}>This agreement expired before everyone signed. Ask for a new one.</p>
        </Card>
      ) : null}
    </NetShell>
  );
}
