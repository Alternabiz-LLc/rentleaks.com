import Link from "next/link";
import { sendShortlistAction } from "@/app/admin/_actions/ops";
import { Kpi } from "@/components/admin/desk/charts";
import { DeskHeader } from "@/components/admin/desk/DeskHeader";
import { Icon } from "@/components/admin/desk/Icon";
import { Chip, Empty, Panel, Steps, initials } from "@/components/admin/desk/parts";
import { flashOf, qs, readParams, type SP } from "@/components/admin/ui";
import { canAccess } from "@/lib/access";
import { requireAdminPage } from "@/lib/admin/guard";
import { nowMs } from "@/lib/admin/metrics";
import { KIND_LABEL, type LeadKind } from "@/lib/leads";
import { prisma } from "@/lib/prisma";
import { fmtMoney, typeLabel } from "@/lib/site";
import { autopilotOn } from "@/lib/ops/autopilot";
import { median, slaOf, ageLabel } from "@/lib/ops/sla";
import { sampleCatalogIds } from "@/lib/sample-catalog";
import { defaultShortlistBody, matchesFor } from "@/lib/ops/shortlist";

export const metadata = { title: "Match & send — RentLeaks desk" };

const DAY = 86_400_000;

/**
 * Match & Send: pick a request, confirm the homes the desk chose, send.
 * The queue is oldest-first so the renter who has waited longest goes first.
 */
export default async function MatchPage({ searchParams }: { searchParams: SP }) {
  const me = await requireAdminPage("/admin/match");
  const p = await readParams(searchParams);
  const t = nowMs();
  const since14 = new Date(t - 14 * DAY);
  const since7 = new Date(t - 7 * DAY);
  const self = (over: Record<string, string | undefined> = {}) => `/admin/match${qs(p, { ok: undefined, err: undefined, ...over })}`;

  const [queue, recent, cities, autopilot] = await Promise.all([
    prisma.lead.findMany({
      where: { status: { in: ["new", "contacted"] }, matchesSentAt: null, createdAt: { gte: since14 } },
      orderBy: [{ status: "desc" }, { createdAt: "asc" }],
      take: 60,
      include: { listing: { select: { title: true } } },
    }),
    prisma.lead.findMany({
      where: { createdAt: { gte: since7 } },
      select: { status: true, createdAt: true, contactedAt: true, ackSentAt: true, matchesSentAt: true, shortlistOpenedAt: true },
    }),
    prisma.city.findMany({ select: { id: true, name: true } }),
    autopilotOn(),
  ]);
  const cityName = (id: string | null) => cities.find((c) => c.id === id)?.name ?? "Any city";
  const waitingNew = queue.filter((l) => l.status === "new");
  const replyMinutes = recent.filter((l) => l.contactedAt).map((l) => (l.contactedAt!.getTime() - l.createdAt.getTime()) / 60_000);
  const med = median(replyMinutes);
  const sent = recent.filter((l) => l.matchesSentAt).length;
  const opened = recent.filter((l) => l.shortlistOpenedAt).length;
  const instant = recent.filter((l) => l.ackSentAt && l.ackSentAt.getTime() - l.createdAt.getTime() < 5 * 60_000).length;

  const selectedId = p.lead || queue[0]?.id;
  const lead = selectedId ? await prisma.lead.findUnique({ where: { id: selectedId }, include: { listing: { select: { id: true, title: true } } } }) : null;
  const relax = p.relax === "type" || p.relax === "budget" || p.relax === "both" ? p.relax : "";
  const request = lead
    ? {
        ...lead,
        housingType: relax === "type" || relax === "both" ? null : lead.housingType,
        budgetMax: lead.budgetMax && (relax === "budget" || relax === "both") ? Math.round(lead.budgetMax * 1.2) : lead.budgetMax,
      }
    : null;
  const [matches, examplesReadable] = request
    ? await Promise.all([matchesFor(request, 8), sampleCatalogIds().then(() => true, () => false)])
    : [[], true];
  const nextLead = queue.find((l) => l.id !== lead?.id)?.id ?? "";
  const alreadySent: string[] = (() => {
    try {
      return lead ? (JSON.parse(lead.matchIds) as string[]) : [];
    } catch {
      return [];
    }
  })();
  const sla = lead ? slaOf(lead, t) : null;

  return (
    <div className="dk-stack">
      <DeskHeader
        href="/admin/match"
        flash={flashOf(p)}
        signals={[
          { label: "Waiting for a first reply", value: waitingNew.length ? `${waitingNew.length} · oldest ${ageLabel((t - waitingNew[0].createdAt.getTime()) / 60_000)}` : "none", tone: waitingNew.length ? "critical" : "ok" },
          { label: "Median first reply · 7 days", value: med === null ? "—" : ageLabel(med), tone: med !== null && med <= 60 ? "live" : "warn" },
          {
            label: "Instant reply",
            value: autopilot ? `on · ${instant} sent within 5 min` : "off",
            tone: autopilot ? "live" : "warn",
            href: canAccess(me, "automation") ? "/admin/playbooks" : undefined,
          },
        ]}
        actions={
          <Link prefetch={false} className="dk-btn dk-btn--light" href="/admin/leads?status=new">
            <Icon name="leads" size={15} /> Lead inbox
          </Link>
        }
      />

      <div className="dk-kpis">
        <Kpi label="In the queue" value={queue.length} sub={`${waitingNew.length} not answered yet`} tone={waitingNew.length ? "alert" : undefined} />
        <Kpi label="Median first reply" value={med === null ? "—" : ageLabel(med)} sub="last 7 days" />
        <Kpi label="Shortlists sent" value={sent} sub="last 7 days" tone="good" />
        <Kpi label="Opened" value={sent ? Math.round((opened / sent) * 100) : 0} fmt="pct" sub={`${opened} of ${sent} renters clicked a home`} />
      </div>

      <div className="dk-grid dk-grid--queue">
        <aside className="dk-railcard dk-queue">
          <p className="dk-kicker">Queue · oldest first</p>
          <b className="dk-railcard__title">Requests</b>
          <small>{queue.length ? "Pick one — the homes are already chosen." : "Everyone has a shortlist."}</small>
          <ul className="dk-queue__list">
            {queue.map((l) => {
              const s = slaOf(l, t);
              return (
                <li key={l.id}>
                  <Link prefetch={false} scroll={false} href={self({ lead: l.id, relax: undefined })} className={l.id === lead?.id ? "is-on" : undefined}>
                    <span className="dk-avatar dk-avatar--sm">{initials(l.name, l.email)}</span>
                    <span className="dk-queue__who">
                      <b>{l.name}</b>
                      <small>
                        {KIND_LABEL[l.kind as LeadKind] ?? l.kind} · {cityName(l.cityId)}
                        {l.budgetMax ? ` · ≤ ${fmtMoney(l.budgetMax, l.currency)}` : ""}
                      </small>
                    </span>
                    <span className={`dk-chip dk-chip--${s.tone === "good" ? "good" : s.tone === "warn" ? "warn" : s.tone === "bad" ? "bad" : "ink"}`}>{s.label.replace(" · on time", "")}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>

        <div className="dk-stack">
          {!lead ? (
            <Panel>
              <Empty title="The queue is clear.">New requests arrive here with homes already picked. The instant reply has already sent matches where there were any.</Empty>
            </Panel>
          ) : (
            <form action={sendShortlistAction} className="dk-stack">
              <input type="hidden" name="leadId" value={lead.id} />
              <input type="hidden" name="nextLead" value={nextLead} />
              <input type="hidden" name="returnTo" value={self({ lead: lead.id })} />
              <Steps
                steps={[
                  { label: "Read the request", state: "done" },
                  { label: "Confirm the homes", state: "on" },
                  { label: "Send the shortlist", state: "todo" },
                ]}
              />

              <Panel
                kicker={`1 · Request · ${sla?.label ?? ""}`}
                title={`${lead.name} — ${KIND_LABEL[lead.kind as LeadKind] ?? lead.kind}`}
                sub={lead.email + (lead.phone ? ` · ${lead.phone}` : "")}
                actions={
                  <Link prefetch={false} className="dk-btn dk-btn--sm" href={`/admin/leads?open=${lead.id}`}>
                    Open lead
                  </Link>
                }
              >
                <div className="dk-chiprow">
                  <Chip tone="brand">{cityName(lead.cityId)}</Chip>
                  <Chip>{lead.housingType ? typeLabel(lead.housingType) : "Any type"}</Chip>
                  <Chip tone="value">{lead.budgetMax ? `≤ ${fmtMoney(lead.budgetMax, lead.currency)}/mo` : "No budget given"}</Chip>
                  <Chip>{lead.moveIn ? `from ${lead.moveIn}` : "flexible start"}</Chip>
                  {lead.moveOut ? <Chip>to {lead.moveOut}</Chip> : lead.stayMonths ? <Chip>{lead.stayMonths} months</Chip> : null}
                  {lead.listing ? <Chip tone="warn">asked about: {lead.listing.title}</Chip> : null}
                  {lead.ackSentAt ? <Chip tone="good">instant reply sent</Chip> : null}
                  {alreadySent.length ? <Chip tone="good">{alreadySent.length} homes sent automatically</Chip> : null}
                </div>
                {lead.message ? <p className="dk-quote">“{lead.message}”</p> : null}
              </Panel>

              <Panel
                kicker="2 · Homes"
                title={matches.length ? `${matches.length} live home${matches.length === 1 ? "" : "s"} fit` : "Nothing fits exactly"}
                sub="Ranked on city, budget, type, dates and stay length. The top three are ticked — change them freely. Example listings are never offered."
                actions={
                  <div className="dk-inline">
                    <Link prefetch={false} scroll={false} className={`dk-btn dk-btn--sm${relax === "type" ? " is-on" : ""}`} href={self({ lead: lead.id, relax: relax === "type" ? undefined : "type" })}>
                      Any type
                    </Link>
                    <Link prefetch={false} scroll={false} className={`dk-btn dk-btn--sm${relax === "budget" ? " is-on" : ""}`} href={self({ lead: lead.id, relax: relax === "budget" ? undefined : "budget" })}>
                      Budget +20%
                    </Link>
                  </div>
                }
              >
                {matches.length === 0 && !examplesReadable ? (
                  <Empty title="Homes are held back for a moment.">
                    The example-listing list couldn&apos;t be read, so nothing is offered rather than risk sending an example as a real home. Reload in a minute.
                  </Empty>
                ) : matches.length === 0 ? (
                  <Empty title="No live home matches this request.">
                    Try <Link href={self({ lead: lead.id, relax: "both" })}>any type and +20% budget</Link>, or note the gap — it shows up on the{" "}
                    {canAccess(me, "markets") ? <Link href="/admin/demand">Demand map</Link> : "Demand map"}.
                  </Empty>
                ) : (
                  <ul className="dk-homes">
                    {matches.map(({ match, home }, i) => (
                      <li key={home.id}>
                        <label className="dk-home">
                          <input type="checkbox" name="listingIds" value={home.id} defaultChecked={i < 3} />
                          {home.image && /^(https:|\/)/.test(home.image) ? (
                            // eslint-disable-next-line @next/next/no-img-element -- listing photos come from many hosts
                            <img src={home.image} alt="" loading="lazy" />
                          ) : (
                            <span className="dk-home__ph" aria-hidden="true" />
                          )}
                          <span className="dk-home__body">
                            <b>{home.title}</b>
                            <small>
                              {home.neighborhood}, {home.cityName} · {typeLabel(home.housingType)} · from {home.availableFrom}
                            </small>
                            <span className="dk-home__why">{match.reasons.slice(0, 3).join(" · ")}</span>
                          </span>
                          <span className="dk-home__side">
                            <b className="dk-value">{fmtMoney(home.allIn, home.currency)}</b>
                            <span className={`dk-grade dk-grade--${match.score >= 80 ? "A" : match.score >= 62 ? "B" : match.score >= 42 ? "C" : "D"}`}>{match.score}</span>
                            {alreadySent.includes(home.id) ? <Chip tone="good">sent</Chip> : null}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              {matches.length ? (
                <Panel kicker="3 · Send" title="Your message" sub="{{homes}} is replaced by the homes you ticked, each with a tracked link. Sent from your mailbox when SMTP is set up.">
                  <div className="dk-form">
                    <label className="dk-field dk-field--wide">
                      <span>Subject</span>
                      <input name="subject" defaultValue={`${Math.min(3, matches.length)} homes for you in ${cityName(lead.cityId)}`} required />
                    </label>
                    <label className="dk-field dk-field--wide">
                      <span>Message</span>
                      <textarea name="body" rows={11} defaultValue={defaultShortlistBody(lead.name, Math.min(3, matches.length), me.name)} required />
                    </label>
                    <button className="dk-btn dk-btn--primary dk-btn--wide">
                      <Icon name="mail" size={15} /> Send shortlist{nextLead ? " and open the next request" : ""}
                    </button>
                  </div>
                </Panel>
              ) : null}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
