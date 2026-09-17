import { nowMs } from "@/lib/admin/metrics";
import { redirect } from "next/navigation";
import { Card, Facts, flashOf, NetShell, Pill, since, until, type Step } from "@/components/network/NetShell";
import { booksToday } from "@/lib/books/data";
import { canSignNow, FEE_TYPES, feeLabel, isFeeType, parseFeeValue, PARTNER_STATUS, SEARCH_STAGE, SPECIALTIES, usd, type PartnerStatus, type SearchStage } from "@/lib/network/core";
import { answerOffer, freshSignerLink, json, NetworkError, partnerFromToken, partnerMove, reportLease, searchBrief } from "@/lib/network/engine";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partner portal — RentLeaks broker network", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

function back(token: string, kind: "ok" | "err", msg: string, hash = ""): never {
  redirect(`/pro/${encodeURIComponent(token)}?${kind}=${encodeURIComponent(msg)}${hash ? `#${hash}` : ""}`);
}

async function guard(fd: FormData) {
  const token = String(fd.get("token") || "");
  const p = await partnerFromToken(token);
  if (!p) redirect("/pro?expired=1");
  return { token, p };
}

const money = (raw: string) => {
  const s = raw.replace(/[\s$,]/g, "");
  return /^\d+(\.\d{1,2})?$/.test(s) ? Math.round(Number(s) * 100) : null;
};

async function answer(fd: FormData) {
  "use server";
  const { token, p } = await guard(fd);
  const accept = fd.get("op") === "accept";
  const type = String(fd.get("feeType") || "");
  const value = isFeeType(type) ? parseFeeValue(type, String(fd.get("feeValue") || "")) : null;
  try {
    await answerOffer(p.id, String(fd.get("offerId") || ""), { accept, feeType: type, feeValue: value, pitch: String(fd.get("pitch") || ""), why: String(fd.get("why") || "") });
  } catch (err) {
    if (err instanceof NetworkError) back(token, "err", err.message, "leads");
    throw err;
  }
  back(token, "ok", accept ? "Proposal sent — the tenant has been told." : "Declined. We'll keep the leads coming.", "leads");
}

async function signNow(fd: FormData) {
  "use server";
  const { token, p } = await guard(fd);
  const signer = await prisma.agreementSigner.findFirst({ where: { agreementId: String(fd.get("agreementId") || ""), role: "partner", email: p.email } });
  if (!signer) back(token, "err", "That agreement isn't yours.");
  redirect(new URL(await freshSignerLink(signer.id)).pathname);
}

async function move(fd: FormData) {
  "use server";
  const { token, p } = await guard(fd);
  try {
    await partnerMove(p.id, String(fd.get("searchId") || ""), String(fd.get("stage") || "") as SearchStage, String(fd.get("why") || "").trim() || null);
  } catch (err) {
    if (err instanceof NetworkError) back(token, "err", err.message, "clients");
    throw err;
  }
  back(token, "ok", "Updated.", "clients");
}

async function lease(fd: FormData) {
  "use server";
  const { token, p } = await guard(fd);
  const rent = money(String(fd.get("rent") || ""));
  const fee = money(String(fd.get("fee") || ""));
  const date = String(fd.get("date") || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || rent === null || fee === null) back(token, "err", "Add the lease date, the monthly rent and the fee you collected.", "clients");
  if (fd.get("confirm") !== "on") back(token, "err", "Confirm the figures match the signed lease and your fee receipt.", "clients");
  try {
    await reportLease(p.id, String(fd.get("searchId") || ""), { leaseSignedOn: date, monthlyRentCents: rent, grossFeeCents: fee, address: String(fd.get("address") || ""), note: String(fd.get("note") || "") });
  } catch (err) {
    if (err instanceof NetworkError) back(token, "err", err.message, "clients");
    throw err;
  }
  back(token, "ok", "Lease recorded — congratulations. Your brokerage will get the referral invoice.", "earnings");
}

async function profile(fd: FormData) {
  "use server";
  const { token, p } = await guard(fd);
  const op = String(fd.get("op") || "");
  if (op === "pause" || op === "resume") {
    if (p.status !== "active" && p.status !== "paused") back(token, "err", "Your account isn't active yet.");
    await prisma.networkPartner.update({ where: { id: p.id }, data: { status: op === "pause" ? "paused" : "active" } });
    back(token, "ok", op === "pause" ? "Paused — no new leads until you resume." : "You're back on — new leads will arrive by email.");
  }
  const markets = String(fd.get("markets") || "")
    .split(",")
    .map((m) => m.trim().slice(0, 50))
    .filter(Boolean)
    .slice(0, 20);
  const specialties = fd
    .getAll("specialties")
    .map(String)
    .filter((x) => SPECIALTIES.some((s) => s.id === x));
  const capacity = Math.round(Number(fd.get("capacity")));
  if (!markets.length || !specialties.length || !(capacity >= 1 && capacity <= 50)) back(token, "err", "Keep at least one market, one specialty and a capacity between 1 and 50.", "profile");
  await prisma.networkPartner.update({ where: { id: p.id }, data: { markets: JSON.stringify([...new Set(markets)]), specialties: JSON.stringify(specialties), capacity, bio: String(fd.get("bio") || "").trim().slice(0, 600) } });
  back(token, "ok", "Profile saved.", "profile");
}

/** The partner's portal: leads to answer, clients to serve, leases to report. */
export default async function Portal({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await params;
  const flash = flashOf(await searchParams);
  const p = await partnerFromToken(token);
  if (!p) redirect("/pro?expired=1");
  const now = nowMs();
  const [offers, clients, deals, referral] = await Promise.all([
    prisma.networkOffer.findMany({ where: { partnerId: p.id }, include: { search: true }, orderBy: { offeredAt: "desc" }, take: 60 }),
    prisma.networkSearch.findMany({ where: { chosenPartnerId: p.id }, orderBy: { updatedAt: "desc" }, take: 60 }),
    prisma.networkDeal.findMany({ where: { partnerId: p.id }, orderBy: { createdAt: "desc" } }),
    p.agreementId ? prisma.agreementSigner.findFirst({ where: { agreementId: p.agreementId, role: "partner" } }) : Promise.resolve(null),
  ]);
  const agreements = await prisma.agreement.findMany({ where: { id: { in: clients.map((c) => c.agreementId).filter((x): x is string => !!x) } }, include: { signers: { orderBy: { order: "asc" } } } });
  const envBy = new Map(agreements.map((a) => [a.id, a]));
  const fresh = offers.filter((o) => o.status === "offered" && o.expiresAt.getTime() > now);
  const pending = offers.filter((o) => o.status === "proposed");
  const active = clients.filter((c) => ["chosen", "signed", "touring", "applied"].includes(c.status));
  const closed = clients.filter((c) => !["chosen", "signed", "touring", "applied"].includes(c.status));
  const due = deals.filter((d) => d.status !== "paid" && d.status !== "waived").reduce((n, d) => n + d.referralDueCents, 0);
  const grossPaid = deals.reduce((n, d) => n + d.grossFeeCents, 0);
  const status = p.status as PartnerStatus;
  const steps: Step[] = [
    { label: "Accept a lead", state: pending.length || clients.length ? "done" : "on" },
    { label: "Sign with your client", state: clients.some((c) => c.status !== "chosen") ? "done" : clients.length ? "on" : "todo" },
    { label: "Close & get paid", state: deals.length ? "done" : clients.some((c) => ["signed", "touring", "applied"].includes(c.status)) ? "on" : "todo" },
  ];
  const today = booksToday();

  return (
    <NetShell
      kicker={`Partner portal · ${p.brokerage}`}
      title={`Hi ${p.name.split(" ")[0]}`}
      sub={status === "active" ? `Leads in ${json<string[]>(p.markets, []).join(", ")} arrive by email; answer them here. Referral fee: ${p.referralPctBp / 100}% of the fee your brokerage collects.` : undefined}
      steps={steps}
      flash={flash}
      aside={
        <>
          <Card title="Your account">
            <div className="nw-pills" style={{ marginBottom: "0.7rem" }}>
              <Pill tone={status === "active" ? "good" : status === "paused" ? "" : "warn"}>{PARTNER_STATUS[status]?.label ?? status}</Pill>
              <Pill>
                {p.licenseState} {p.licenseNumber}
              </Pill>
              {p.ratingCount ? <Pill tone="value">★ {(p.ratingSum / p.ratingCount).toFixed(1)}</Pill> : null}
            </div>
            <Facts
              rows={[
                ["Capacity", `${active.length + pending.length} of ${p.capacity} open`],
                ["Referral fee", `${p.referralPctBp / 100}%`],
              ]}
            />
            {status === "active" || status === "paused" ? (
              <form action={profile} style={{ marginTop: "0.8rem" }}>
                <input type="hidden" name="token" value={token} />
                <button className="nw-btn nw-btn--ghost nw-btn--block" name="op" value={status === "active" ? "pause" : "resume"}>
                  {status === "active" ? "Pause new leads" : "Resume new leads"}
                </button>
              </form>
            ) : null}
            {referral ? (
              <form action={signNow} style={{ marginTop: "0.5rem" }}>
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="agreementId" value={p.agreementId ?? ""} />
                <button className="nw-btn nw-btn--ghost nw-btn--block">Referral agreement</button>
              </form>
            ) : null}
          </Card>
          <Card title="Rules of the road" tone="warn">
            <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.85rem", lineHeight: 1.6 }}>
              <li>Charge nothing until the tenant agreement is fully signed.</li>
              <li>Never charge a tenant for a home you list for the landlord.</li>
              <li>Never make a home available only if you&rsquo;re hired.</li>
              <li>Fair housing in every ad, message and screening.</li>
              <li>Report each lease within five business days.</li>
            </ul>
          </Card>
        </>
      }
    >
      {status !== "active" && status !== "paused" ? (
        <Card tone="warn">
          <p style={{ margin: 0 }}>
            {status === "verifying" ? "Thanks for signing — we're verifying your licence with the state. You'll get an email when you're live." : status === "rejected" ? "Your application wasn't approved. Reply to any of our emails for details." : "Finish signing your referral agreement to continue."}
          </p>
        </Card>
      ) : null}

      <div className="nw-kpis">
        <div className="nw-kpi">
          <span>New leads</span>
          <b>{fresh.length}</b>
        </div>
        <div className="nw-kpi">
          <span>Active clients</span>
          <b>{active.length}</b>
        </div>
        <div className="nw-kpi">
          <span>Leases closed</span>
          <b>{deals.length}</b>
        </div>
        <div className="nw-kpi">
          <span>Fees collected</span>
          <b>{usd(grossPaid)}</b>
        </div>
      </div>

      <Card id="leads" kicker="Step 1" title={fresh.length ? `${fresh.length} lead${fresh.length === 1 ? "" : "s"} to answer` : "No new leads right now"}>
        {fresh.length ? (
          <div className="nw-stack">
            {fresh.map((o) => {
              const s = o.search;
              return (
                <article key={o.id} className="nw-lead">
                  <div className="nw-lead__top">
                    <b>
                      {s.city}, {s.state} · up to ${s.budgetMax.toLocaleString("en-US")}/mo
                    </b>
                    <Pill tone="warn">{until(o.expiresAt, now)}</Pill>
                  </div>
                  <Facts rows={searchBrief(s)} />
                  {s.notes ? <p className="nw-quote">“{s.notes}”</p> : null}
                  {json<string[]>(o.reasons, []).length ? <p className="nw-muted">Why you: {json<string[]>(o.reasons, []).join(" · ")}</p> : null}
                  <form action={answer} className="nw-form">
                    <input type="hidden" name="token" value={token} />
                    <input type="hidden" name="offerId" value={o.id} />
                    <div className="nw-two">
                      <label>
                        Your fee
                        <select name="feeType" defaultValue={s.feeCapType !== "none" ? s.feeCapType : "months"}>
                          {FEE_TYPES.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Amount {s.feeCapType !== "none" ? `(cap: ${feeLabel(s.feeCapType, s.feeCapValue)})` : ""}
                        <input name="feeValue" inputMode="decimal" placeholder="1" required />
                      </label>
                    </div>
                    <label>
                      Your pitch to the tenant
                      <textarea name="pitch" rows={3} minLength={30} maxLength={600} required placeholder="What you know about these neighborhoods, how fast you can show homes, one thing that makes you the right broker." />
                    </label>
                    <div className="nw-row">
                      <button className="nw-btn" name="op" value="accept">
                        Send proposal
                      </button>
                      <select name="why" aria-label="Reason to decline" defaultValue="">
                        <option value="">Decline reason (optional)</option>
                        <option>Outside my area</option>
                        <option>Budget too low for the market</option>
                        <option>Fully booked</option>
                        <option>Not my specialty</option>
                      </select>
                      <button className="nw-btn nw-btn--danger" name="op" value="decline" formNoValidate>
                        Decline
                      </button>
                    </div>
                  </form>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="nw-muted" style={{ margin: 0 }}>
            {status === "active" ? "We'll email you when a tenant in your markets wants a broker." : "Leads start once your account is active."}
          </p>
        )}
        {pending.length ? (
          <p className="nw-muted">
            Waiting on the tenant: {pending.map((o) => `${o.search.city} (${feeLabel(o.feeType!, o.feeValue!)}, sent ${since(o.respondedAt ?? o.offeredAt, now)})`).join(" · ")}
          </p>
        ) : null}
      </Card>

      <Card id="clients" kicker="Steps 2 and 3" title={active.length ? "Your clients" : "No active clients yet"}>
        {active.length ? (
          <div className="nw-stack">
            {active.map((c) => {
              const env = c.agreementId ? envBy.get(c.agreementId) : undefined;
              const me = env?.signers.find((x) => x.role === "partner");
              const mustSign = env && me && (env.status === "sent" || env.status === "partial") && canSignNow(env.signers, me.id);
              return (
                <article key={c.id} className="nw-lead">
                  <div className="nw-lead__top">
                    <b>{c.name}</b>
                    <Pill tone={SEARCH_STAGE[c.status as SearchStage]?.tone === "good" ? "good" : "warn"}>{SEARCH_STAGE[c.status as SearchStage]?.label ?? c.status}</Pill>
                  </div>
                  <Facts
                    rows={[
                      ["Email", <a key="e" href={`mailto:${c.email}`}>{c.email}</a>],
                      ["Phone", c.phone ? <a key="p" href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}>{c.phone}</a> : "—"],
                      ...searchBrief(c).slice(0, 4),
                      ["Agreement", env ? (env.status === "completed" ? "Signed by everyone ✓" : `${env.signers.filter((x) => x.status === "signed").length} of ${env.signers.length} signed`) : "—"],
                    ]}
                  />
                  {mustSign ? (
                    <form action={signNow}>
                      <input type="hidden" name="token" value={token} />
                      <input type="hidden" name="agreementId" value={env!.id} />
                      <button className="nw-btn">Countersign the tenant agreement</button>
                    </form>
                  ) : c.status === "chosen" ? (
                    <p className="nw-note">Waiting for {env?.signers.find((x) => x.status !== "signed")?.name ?? "the other signers"} to sign. Don&rsquo;t charge anything yet.</p>
                  ) : (
                    <>
                      <form action={move} className="nw-row">
                        <input type="hidden" name="token" value={token} />
                        <input type="hidden" name="searchId" value={c.id} />
                        {c.status !== "touring" && c.status !== "applied" ? (
                          <button className="nw-btn nw-btn--ghost" name="stage" value="touring">
                            Touring
                          </button>
                        ) : null}
                        {c.status !== "applied" ? (
                          <button className="nw-btn nw-btn--ghost" name="stage" value="applied">
                            Applied
                          </button>
                        ) : null}
                        <input name="why" placeholder="If it ended: why?" aria-label="Why the search ended" style={{ flex: "1 1 160px" }} />
                        <button className="nw-btn nw-btn--danger" name="stage" value="lost">
                          Ended, no lease
                        </button>
                      </form>
                      <details>
                        <summary className="nw-btn" style={{ display: "inline-flex" }}>
                          Report the signed lease
                        </summary>
                        <form action={lease} className="nw-form" style={{ marginTop: "0.8rem" }}>
                          <input type="hidden" name="token" value={token} />
                          <input type="hidden" name="searchId" value={c.id} />
                          <div className="nw-two">
                            <label>
                              Lease signed on
                              <input type="date" name="date" max={today} required />
                            </label>
                            <label>
                              Monthly rent (USD)
                              <input name="rent" inputMode="decimal" required placeholder="3,650" />
                            </label>
                            <label>
                              Fee your brokerage collected (USD)
                              <input name="fee" inputMode="decimal" required placeholder="3,650" />
                            </label>
                            <label>
                              Address (optional)
                              <input name="address" maxLength={200} />
                            </label>
                          </div>
                          <label>
                            Note (optional)
                            <input name="note" maxLength={500} />
                          </label>
                          <label className="nw-check">
                            <input type="checkbox" name="confirm" required /> These figures match the signed lease and our fee receipt. The referral fee ({p.referralPctBp / 100}%) is invoiced to our brokerage.
                          </label>
                          <button className="nw-btn">Record the lease</button>
                        </form>
                      </details>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="nw-muted" style={{ margin: 0 }}>
            When a tenant chooses you, their details and the agreement appear here.
          </p>
        )}
      </Card>

      <Card id="earnings" kicker="Referral fees" title={deals.length ? `${usd(due)} to be paid by your brokerage` : "No leases yet"}>
        {deals.length ? (
          <table className="nw-table">
            <thead>
              <tr>
                <th>Lease</th>
                <th className="num">Rent</th>
                <th className="num">Fee</th>
                <th className="num">Referral</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => (
                <tr key={d.id}>
                  <td>
                    {d.leaseSignedOn}
                    <div className="nw-muted">{d.address || clients.find((c) => c.id === d.searchId)?.name}</div>
                  </td>
                  <td className="num">{usd(d.monthlyRentCents)}</td>
                  <td className="num">{usd(d.grossFeeCents)}</td>
                  <td className="num">{usd(d.referralDueCents)}</td>
                  <td>
                    <Pill tone={d.status === "paid" ? "good" : d.status === "invoiced" ? "warn" : ""}>{d.status}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="nw-muted" style={{ margin: 0 }}>
            Report a lease and it shows up here with its referral fee.
          </p>
        )}
        {closed.length ? <p className="nw-muted">Past clients: {closed.map((c) => `${c.name} (${SEARCH_STAGE[c.status as SearchStage]?.label ?? c.status})`).join(" · ")}</p> : null}
      </Card>

      <Card id="profile" kicker="Your profile" title="What tenants see">
        <form action={profile} className="nw-form">
          <input type="hidden" name="token" value={token} />
          <label>
            Markets (cities and neighborhoods, comma separated)
            <input name="markets" defaultValue={json<string[]>(p.markets, []).join(", ")} required />
          </label>
          <div className="nw-pills">
            {SPECIALTIES.map((s) => (
              <label key={s.id} className="nw-check" style={{ marginRight: "0.8rem" }}>
                <input type="checkbox" name="specialties" value={s.id} defaultChecked={json<string[]>(p.specialties, []).includes(s.id)} /> {s.label}
              </label>
            ))}
          </div>
          <div className="nw-two">
            <label>
              Most open leads and clients at once
              <input name="capacity" type="number" min={1} max={50} defaultValue={p.capacity} />
            </label>
          </div>
          <label>
            Short bio
            <textarea name="bio" rows={3} maxLength={600} defaultValue={p.bio} />
          </label>
          <button className="nw-btn nw-btn--ghost" name="op" value="save">
            Save profile
          </button>
        </form>
      </Card>
    </NetShell>
  );
}
