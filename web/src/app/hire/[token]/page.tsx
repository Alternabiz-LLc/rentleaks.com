import { nowMs } from "@/lib/admin/metrics";
import { redirect } from "next/navigation";
import { Card, Facts, flashOf, NetShell, Pill, since, type Step } from "@/components/network/NetShell";
import { feeEstimateCents, feeLabel, LICENSE_TYPES, usd } from "@/lib/network/core";
import { cancelSearch, chooseBroker, freshSignerLink, json, NetworkError, networkSettings, rateBroker, searchBrief, searchFromToken } from "@/lib/network/engine";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your broker search — RentLeaks", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

function back(token: string, kind: "ok" | "err", msg: string): never {
  redirect(`/hire/${encodeURIComponent(token)}?${kind}=${encodeURIComponent(msg)}`);
}

async function choose(fd: FormData) {
  "use server";
  const token = String(fd.get("token") || "");
  const s = await searchFromToken(token);
  if (!s) redirect("/hire/expired");
  if (fd.get("confirm") !== "on") back(token, "err", "Tick the box to confirm you want to hire this broker.");
  let link = "";
  try {
    link = (await chooseBroker(s.id, String(fd.get("offerId") || ""))).tenantLink;
  } catch (err) {
    if (err instanceof NetworkError) back(token, "err", err.message);
    throw err;
  }
  redirect(new URL(link).pathname);
}

async function signNow(fd: FormData) {
  "use server";
  const token = String(fd.get("token") || "");
  const s = await searchFromToken(token);
  if (!s || !s.agreementId) redirect("/hire/expired");
  const signer = await prisma.agreementSigner.findFirst({ where: { agreementId: s.agreementId, role: "tenant" } });
  if (!signer) back(token, "err", "We couldn't find your agreement.");
  redirect(new URL(await freshSignerLink(signer.id)).pathname);
}

async function rate(fd: FormData) {
  "use server";
  const token = String(fd.get("token") || "");
  const s = await searchFromToken(token);
  if (!s) redirect("/hire/expired");
  try {
    await rateBroker(s.id, Number(fd.get("stars")));
  } catch (err) {
    if (err instanceof NetworkError) back(token, "err", err.message);
    throw err;
  }
  back(token, "ok", "Thank you — your rating helps the next renter.");
}

async function cancel(fd: FormData) {
  "use server";
  const token = String(fd.get("token") || "");
  const s = await searchFromToken(token);
  if (!s) redirect("/hire/expired");
  try {
    await cancelSearch(s.id, String(fd.get("why") || ""));
  } catch (err) {
    if (err instanceof NetworkError) back(token, "err", err.message);
    throw err;
  }
  back(token, "ok", "Your search is closed. Brokers have been told.");
}

const initials = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

const TRACK = ["signed", "touring", "applied", "leased"] as const;
const TRACK_LABEL: Record<string, string> = { chosen: "Chosen", signed: "Signed", touring: "Touring", applied: "Applied", leased: "Leased" };

/** The tenant's private search room: proposals in, one choice, one signature. */
export default async function SearchRoom({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await params;
  const flash = flashOf(await searchParams);
  const s = await searchFromToken(token);
  if (!s) {
    return (
      <NetShell kicker="Broker search" title="This link isn't valid any more" sub="Open the newest email from RentLeaks, or start a new search.">
        <Card>
          <a className="nw-btn" href="https://rentleaks.com/hire-a-broker/">
            Start a search
          </a>
        </Card>
      </NetShell>
    );
  }
  const now = nowMs();
  const [offers, settings, agreement] = await Promise.all([
    prisma.networkOffer.findMany({ where: { searchId: s.id }, include: { partner: true }, orderBy: [{ respondedAt: "asc" }] }),
    networkSettings(),
    s.agreementId ? prisma.agreement.findUnique({ where: { id: s.agreementId }, include: { signers: { orderBy: { order: "asc" } } } }) : Promise.resolve(null),
  ]);
  const proposals = offers.filter((o) => o.status === "proposed");
  const waiting = offers.filter((o) => o.status === "offered").length;
  const chosen = offers.find((o) => o.status === "chosen");
  const partner = chosen?.partner;
  const tenantSigner = agreement?.signers.find((x) => x.role === "tenant");
  const first = s.name.split(" ")[0];
  const stage = s.status;
  const choosing = stage === "matching" || stage === "proposals";
  const signedOn = ["signed", "touring", "applied", "leased", "closed"].includes(stage);
  const steps: Step[] = [
    { label: "Tell us what you need", state: "done" },
    { label: "Pick your broker", state: choosing ? "on" : "done" },
    { label: "Sign & search", state: stage === "chosen" || signedOn ? (stage === "leased" || stage === "closed" ? "done" : "on") : "todo" },
  ];
  const title =
    stage === "matching"
      ? `We're finding your broker, ${first}`
      : stage === "proposals"
        ? `${proposals.length} broker${proposals.length === 1 ? " wants" : "s want"} to help you`
        : stage === "chosen"
          ? "One signature and you're set"
          : stage === "leased"
            ? "Congratulations on your new home"
            : stage === "lost"
              ? "This search is closed"
              : `${partner?.name ?? "Your broker"} is on it`;

  return (
    <NetShell
      kicker={`Broker search · ${s.city}, ${s.state}`}
      title={title}
      sub={
        choosing
          ? `Each proposal is from a licensed broker we've verified, with a fee at or under your cap. Choose one — or none. Nothing is owed unless you sign a lease for a home your broker finds.`
          : stage === "chosen"
            ? "Read the agreement, agree to sign electronically and type your name. Your broker countersigns next."
            : undefined
      }
      steps={steps}
      flash={flash}
      aside={
        <>
          <Card title="Your brief" kicker={`Sent ${since(s.createdAt, now)}`}>
            <Facts rows={searchBrief(s)} />
          </Card>
          {["matching", "proposals", "chosen"].includes(stage) ? (
            <Card>
              <details>
                <summary className="nw-muted" style={{ cursor: "pointer" }}>
                  Stop this search
                </summary>
                <form action={cancel} className="nw-form" style={{ marginTop: "0.6rem" }}>
                  <input type="hidden" name="token" value={token} />
                  <label>
                    Why? (optional)
                    <input name="why" maxLength={200} placeholder="Found a place, changed plans…" />
                  </label>
                  <button className="nw-btn nw-btn--danger">Stop searching</button>
                </form>
              </details>
            </Card>
          ) : null}
          <Card tone="warn">
            <p style={{ margin: 0, fontSize: "0.86rem" }}>
              <b>Stay safe.</b> Pay rent and deposits only to the landlord, against a signed lease, after you&rsquo;ve seen the home. RentLeaks never asks you for money.
            </p>
          </Card>
        </>
      }
    >
      {stage === "matching" && !proposals.length ? (
        <Card>
          <div className="nw-empty">
            <div className="nw-radar" aria-hidden="true" />
            <h3>Your brief is with {waiting || "our"} verified broker{waiting === 1 ? "" : "s"}</h3>
            <p className="nw-muted" style={{ maxWidth: "46ch" }}>
              Each has {settings.offerHours} hours to send a pitch and a fee. We&rsquo;ll email you the moment the first one arrives — keep this page; it&rsquo;s your private search room.
            </p>
          </div>
        </Card>
      ) : null}

      {choosing && proposals.length ? (
        <div className="nw-props">
          {proposals.map((o) => {
            const p = o.partner;
            const lt = LICENSE_TYPES.find((x) => x.id === p.licenseType)?.label ?? p.licenseType;
            const langs = json<string[]>(p.languages, []);
            const reasons = json<string[]>(o.reasons, []);
            const mins = o.respondedAt ? Math.round((o.respondedAt.getTime() - o.offeredAt.getTime()) / 60_000) : null;
            return (
              <article key={o.id} className="nw-prop">
                <div className="nw-avatar" aria-hidden="true">
                  {initials(p.name)}
                </div>
                <div>
                  <h3>{p.name}</h3>
                  <p className="nw-muted" style={{ margin: 0 }}>
                    {p.brokerage}
                  </p>
                  <div className="nw-pills" style={{ marginTop: "0.45rem" }}>
                    <Pill tone="good">✓ Licence verified</Pill>
                    <Pill>
                      {lt} · {p.licenseState} {p.licenseNumber}
                    </Pill>
                    {p.ratingCount ? <Pill tone="value">★ {(p.ratingSum / p.ratingCount).toFixed(1)} ({p.ratingCount})</Pill> : null}
                    {mins !== null ? <Pill tone="brand">replied in {mins < 60 ? `${Math.max(1, mins)} min` : `${Math.round(mins / 60)} h`}</Pill> : null}
                    {langs.length > 1 ? <Pill>{langs.join(" · ")}</Pill> : null}
                  </div>
                  <div className="nw-prop__fee">
                    <b>{feeLabel(o.feeType!, o.feeValue!)}</b>
                    <small>≈ {usd(feeEstimateCents(o.feeType!, o.feeValue!, s.budgetMax))} at ${s.budgetMax.toLocaleString("en-US")}/mo · only if you sign a lease they found</small>
                  </div>
                  <p className="nw-quote">“{o.pitch}”</p>
                  {reasons.length ? <p className="nw-muted">Why we matched: {reasons.join(" · ")}</p> : null}
                  {p.bio ? <p className="nw-muted">{p.bio}</p> : null}
                </div>
                <form action={choose} className="nw-form">
                  <input type="hidden" name="token" value={token} />
                  <input type="hidden" name="offerId" value={o.id} />
                  <label className="nw-check">
                    <input type="checkbox" name="confirm" required /> I want to hire {p.name.split(" ")[0]} and I&rsquo;ll review and sign the agreement next.
                  </label>
                  <div className="nw-row">
                    <button className="nw-btn">Choose {p.name.split(" ")[0]}</button>
                  </div>
                </form>
              </article>
            );
          })}
          {waiting ? <p className="nw-muted">{waiting} more broker{waiting === 1 ? " hasn't" : "s haven't"} answered yet.</p> : null}
        </div>
      ) : null}

      {partner && !choosing ? (
        <Card title={partner.name} kicker={stage === "chosen" ? "You chose" : "Your broker"} tone={stage === "chosen" ? "brand" : undefined}>
          <Facts
            rows={[
              ["Brokerage", partner.brokerage],
              ["Licence", `${partner.licenseState} ${partner.licenseNumber}`],
              ["Email", <a key="e" href={`mailto:${partner.email}`}>{partner.email}</a>],
              ["Phone", <a key="p" href={`tel:${partner.phone.replace(/[^\d+]/g, "")}`}>{partner.phone}</a>],
              ["Fee", chosen ? `${feeLabel(chosen.feeType!, chosen.feeValue!)} — only if you sign a lease they found` : "—"],
            ]}
          />
          {stage === "chosen" && tenantSigner ? (
            tenantSigner.status === "signed" ? (
              <p className="nw-note" style={{ marginTop: "1rem" }}>
                You&rsquo;ve signed ✓ — waiting for {partner.name.split(" ")[0]} to countersign. You&rsquo;ll get the completed copy by email.
              </p>
            ) : (
              <form action={signNow} style={{ marginTop: "1rem" }}>
                <input type="hidden" name="token" value={token} />
                <button className="nw-btn nw-btn--lg">Review &amp; sign the agreement</button>
              </form>
            )
          ) : null}
          {signedOn || stage === "lost" ? (
            <>
              <ol className="nw-track" style={{ marginTop: "1.1rem" }} aria-label="Search progress">
                {["chosen", ...TRACK].map((t) => {
                  const order = ["chosen", ...TRACK];
                  const reached = order.indexOf(stage) >= order.indexOf(t) || (stage === "closed" && t !== "leased");
                  return (
                    <li key={t} className={reached ? "is-done" : undefined}>
                      {TRACK_LABEL[t]}
                    </li>
                  );
                })}
              </ol>
              {tenantSigner ? (
                <form action={signNow} style={{ marginTop: "1rem" }}>
                  <input type="hidden" name="token" value={token} />
                  <button className="nw-btn nw-btn--ghost">View the signed agreement</button>
                </form>
              ) : null}
            </>
          ) : null}
        </Card>
      ) : null}

      {stage === "signed" || stage === "touring" || stage === "applied" ? (
        <Card title="What happens now" kicker="Your search">
          <ul style={{ margin: 0, paddingLeft: "1.1rem", lineHeight: 1.7 }}>
            <li>{partner?.name.split(" ")[0] ?? "Your broker"} will contact you to set up viewings — in person or on a live video call.</li>
            <li>They must tell you in writing before a viewing if they also work for that home&rsquo;s landlord — and can&rsquo;t charge you for it.</li>
            <li>The fee is due only when you sign a lease for a home they found. To end the agreement, email your broker.</li>
          </ul>
        </Card>
      ) : null}

      {(stage === "leased" || stage === "closed") && partner ? (
        <Card title={s.rating ? "Thanks for your rating" : `How was ${partner.name.split(" ")[0]}?`} tone="good">
          {s.rating ? (
            <p style={{ margin: 0 }}>{"★".repeat(s.rating)}</p>
          ) : (
            <form action={rate}>
              <input type="hidden" name="token" value={token} />
              <div className="nw-stars" role="group" aria-label="Rate your broker">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} name="stars" value={n} aria-label={`${n} star${n === 1 ? "" : "s"}`}>
                    ★
                  </button>
                ))}
              </div>
            </form>
          )}
        </Card>
      ) : null}

      {stage === "lost" ? (
        <Card>
          <p style={{ marginTop: 0 }}>{s.lostReason ?? "This search ended."}</p>
          <a className="nw-btn" href="https://rentleaks.com/hire-a-broker/">
            Start a new search
          </a>
        </Card>
      ) : null}
    </NetShell>
  );
}
