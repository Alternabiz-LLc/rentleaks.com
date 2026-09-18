import Link from "next/link";
import type { Agreement, AgreementEvent, AgreementSigner, GuideLead, NetworkDeal, NetworkOffer, NetworkPartner, NetworkSearch } from "@prisma/client";
import { agreementAction, dealAction, guideAction, invitePartner, networkSettingsAction, partnerAction, searchAction } from "@/app/admin/_actions/referrals";
import { Icon } from "@/components/admin/desk/Icon";
import { RouteDrawer } from "@/components/admin/desk/RouteDrawer";
import { Chip, Empty, GradeChip, Panel, ago, type ChipTone } from "@/components/admin/desk/parts";
import { RankedBars } from "@/components/admin/desk/charts";
import { when } from "@/components/admin/ui";
import { AgreementView } from "@/components/network/AgreementView";
import { SignaturePad } from "@/components/network/SignaturePad";
import {
  AGREEMENT_STATUS,
  ESIGN_DISCLOSURE,
  GUIDE,
  feeEstimateCents,
  feeLabel,
  HOME_TYPES,
  LICENSE_TYPES,
  licenseLookupUrl,
  PARTNER_STATUS,
  SEARCH_STAGE,
  SPECIALTIES,
  usd,
  type AgreementStatus,
  type PartnerStatus,
  type RosterCard,
  type SearchStage,
} from "@/lib/network/core";

export type Self = (over?: Record<string, string | undefined>) => string;

export type OfferRow = NetworkOffer & { partner: { id: string; name: string; brokerage: string } };
export type SearchRow = NetworkSearch & { offers: OfferRow[]; brief: Array<[string, string]>; partnerName: string | null };
export type PartnerRow = NetworkPartner & {
  marketsList: string[];
  specialtiesList: string[];
  languagesList: string[];
  offersN: number;
  acceptedN: number;
  wins: number;
  openLeads: number;
  replyMins: number | null;
  env: (Agreement & { signers: AgreementSigner[] }) | null;
};
export type EnvRow = Agreement & { signers: AgreementSigner[] };
export type DealRow = NetworkDeal & { partnerName: string; brokerage: string; tenantName: string; city: string; invoice: { id: string; number: string; status: string } | null };
export type Candidate = { id: string; name: string; brokerage: string; score: number | null; reasons: string[]; openLeads: number; capacity: number };

const ROLE: Record<string, string> = { tenant: "Tenant", partner: "Broker", supervisor: "Broker of record", rentleaks: "RentLeaks" };
const SIGNER_TONE: Record<string, ChipTone> = { pending: "", viewed: "brand", signed: "good", declined: "bad" };
const OFFER: Record<string, { label: string; tone: ChipTone }> = {
  offered: { label: "waiting", tone: "warn" },
  proposed: { label: "proposed", tone: "value" },
  declined: { label: "declined", tone: "" },
  expired: { label: "expired", tone: "" },
  chosen: { label: "chosen", tone: "good" },
  not_chosen: { label: "not chosen", tone: "ink" },
  withdrawn: { label: "withdrawn", tone: "ink" },
};
const DEAL: Record<string, { label: string; tone: ChipTone }> = {
  reported: { label: "to invoice", tone: "warn" },
  invoiced: { label: "invoiced", tone: "value" },
  paid: { label: "paid", tone: "good" },
  waived: { label: "waived", tone: "ink" },
  disputed: { label: "disputed", tone: "bad" },
};

const mins = (m: number | null) => (m === null ? "—" : m < 60 ? `${Math.round(m)} min` : m < 48 * 60 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`);
const labelOf = <T extends { id: string; label: string }>(xs: readonly T[], id: string) => xs.find((x) => x.id === id)?.label ?? id;

function Hidden({ values }: { values: Record<string, string> }) {
  return (
    <>
      {Object.entries(values).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </>
  );
}

export function StageChip({ status }: { status: string }) {
  const s = SEARCH_STAGE[status as SearchStage];
  return <Chip tone={s?.tone ?? "ink"}>{s?.label ?? status}</Chip>;
}

export function EnvChip({ status }: { status: string }) {
  const s = AGREEMENT_STATUS[status as AgreementStatus];
  return <Chip tone={(s?.tone as ChipTone) ?? "ink"}>{s?.label ?? status}</Chip>;
}

function Signers({ signers }: { signers: AgreementSigner[] }) {
  return (
    <ol className="rf-signers">
      {signers.map((s) => (
        <li key={s.id}>
          <b>{ROLE[s.role] ?? s.role}</b> · {s.name} <span className="dk-dim">{s.email}</span> <Chip tone={SIGNER_TONE[s.status] ?? ""}>{s.status}</Chip>
          {s.signedAt ? <span className="dk-dim"> {when(s.signedAt)}</span> : null}
          {s.reminders ? <span className="dk-dim"> · {s.reminders} reminder{s.reminders === 1 ? "" : "s"}</span> : null}
          {s.declineReason ? <div className="dk-dim">“{s.declineReason}”</div> : null}
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------------
   Search dossier
   ------------------------------------------------------------------------ */

export function SearchDrawer({
  s,
  self,
  now,
  candidates,
  env,
  deal,
  contactId,
  founder,
  me,
  room,
}: {
  s: SearchRow;
  self: Self;
  now: number;
  candidates: Candidate[];
  env: EnvRow | null;
  deal: DealRow | null;
  contactId: string | null;
  founder: boolean;
  me: { name: string };
  room: string;
}) {
  const back = self();
  const first = s.name.split(" ")[0];
  const choosing = ["new", "matching", "proposals"].includes(s.status);
  const working = ["signed", "touring", "applied"].includes(s.status);
  const offered = new Set(s.offers.map((o) => o.partnerId));
  const open = candidates.filter((c) => !offered.has(c.id));
  return (
    <RouteDrawer closeHref={self({ open: undefined })} kicker={`Tenant search · ${ago(now - s.createdAt.getTime())}`} title={`${s.name} · ${s.city}, ${s.state}`} width={700}>
      <div className="dk-dossier">
        <div className="dk-chiprow">
          <StageChip status={s.status} />
          <GradeChip score={s.score} title="Brief quality: phone, move-in date, budget, fee cap, neighbourhoods, notes" />
          {s.noMatchAt ? <Chip tone="bad">no broker matched</Chip> : null}
          {s.partnerName ? <Chip tone="good">broker: {s.partnerName}</Chip> : null}
          {s.rating ? <Chip tone="value">{"★".repeat(s.rating)} rated</Chip> : null}
          {contactId ? (
            <Link prefetch={false} className="dk-chip dk-chip--brand" href={`/admin/crm/${contactId}`}>
              CRM →
            </Link>
          ) : null}
          {env ? (
            <Link prefetch={false} className="dk-chip dk-chip--value" href={self({ open: undefined, tab: "agreements", env: env.id })}>
              agreement · {AGREEMENT_STATUS[env.status as AgreementStatus]?.label ?? env.status} →
            </Link>
          ) : null}
        </div>
        <dl className="dk-dossier__facts">
          <div>
            <dt>Contact</dt>
            <dd>
              <a href={`mailto:${s.email}`}>{s.email}</a>
              {s.phone ? (
                <>
                  {" "}
                  · <a href={`tel:${s.phone.replace(/[^\d+]/g, "")}`}>{s.phone}</a>
                </>
              ) : null}
            </dd>
          </div>
          {s.brief.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
          <div>
            <dt>Source</dt>
            <dd>
              {s.source}
              {s.campaign ? ` · ${s.campaign}` : ""}
              {s.referrer ? ` · via ${s.referrer}` : ""}
            </dd>
          </div>
        </dl>
        {s.notes ? <pre className="dk-dossier__summary">{s.notes}</pre> : null}

        <Panel flush kicker={`${s.offers.length} offered`} title="Broker offers" sub="Who got the lead, what they proposed, and how fast.">
          {s.offers.length ? (
            <div className="dk-tablewrap">
              <table className="dk-table">
                <thead>
                  <tr>
                    <th>Broker</th>
                    <th>Status</th>
                    <th>Fee</th>
                    <th className="dk-right">Match</th>
                    <th>Replied</th>
                  </tr>
                </thead>
                <tbody>
                  {s.offers.map((o) => (
                    <tr key={o.id}>
                      <td className="dk-wrap">
                        <Link prefetch={false} href={self({ open: undefined, tab: "partners", partner: o.partner.id })} scroll={false}>
                          <b>{o.partner.name}</b>
                        </Link>
                        <div className="dk-dim">{o.partner.brokerage}</div>
                        {o.pitch ? <div className="rf-pitch">“{o.pitch}”</div> : null}
                        {o.declineWhy ? <div className="dk-dim">Declined: {o.declineWhy}</div> : null}
                      </td>
                      <td>
                        <Chip tone={OFFER[o.status]?.tone ?? ""}>{OFFER[o.status]?.label ?? o.status}</Chip>
                        {o.status === "offered" ? <div className="dk-dim">{o.expiresAt.getTime() > now ? `${Math.max(1, Math.round((o.expiresAt.getTime() - now) / 3_600_000))} h left` : "overdue"}</div> : null}
                      </td>
                      <td className="dk-wrap">
                        {o.feeType && o.feeValue ? (
                          <>
                            {feeLabel(o.feeType, o.feeValue)}
                            <div className="dk-dim">≈ {usd(feeEstimateCents(o.feeType, o.feeValue, s.budgetMax))}</div>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="dk-right dk-num" title={(JSON.parse(o.reasons || "[]") as string[]).join(" · ")}>
                        {o.matchScore}
                      </td>
                      <td>{o.respondedAt ? mins((o.respondedAt.getTime() - o.offeredAt.getTime()) / 60_000) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="Not offered to anyone yet.">Offer it by hand below, or recruit a partner in {s.city}.</Empty>
          )}
        </Panel>

        {choosing ? (
          <Panel kicker="Matching" title="Offer it to a broker" sub="Active partners licensed in the search's state, best match first. A hand-picked offer skips the market filter.">
            {open.length ? (
              <form action={searchAction} className="dk-inline">
                <Hidden values={{ id: s.id, returnTo: back, op: "offer" }} />
                <select name="partnerId" required defaultValue="">
                  <option value="" disabled>
                    Pick a broker…
                  </option>
                  {open.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.brokerage} — {c.score === null ? "outside their markets" : `match ${c.score}`} · {c.openLeads}/{c.capacity} open
                    </option>
                  ))}
                </select>
                <button className="dk-btn dk-btn--primary dk-btn--sm">
                  <Icon name="mail" size={13} /> Offer the lead
                </button>
              </form>
            ) : (
              <p className="dk-muted">No other active partner is licensed in {s.state}. Invite one from the Partners tab.</p>
            )}
            <form action={searchAction} className="dk-inline" style={{ marginTop: 10 }}>
              <Hidden values={{ id: s.id, returnTo: back, op: "rematch" }} />
              <button className="dk-btn dk-btn--sm">
                <Icon name="match" size={13} /> Re-run matching
              </button>
            </form>
          </Panel>
        ) : null}

        {working && s.chosenPartnerId ? (
          <Panel kicker="On the broker's behalf" title="Record the lease" sub="Normally the broker reports it from their portal. The referral fee is worked out from the fee they collected.">
            <form action={searchAction} className="dk-form">
              <Hidden values={{ id: s.id, returnTo: back, op: "lease" }} />
              <label className="dk-field">
                <span>Lease signed on</span>
                <input name="date" type="date" required max={new Date(now).toISOString().slice(0, 10)} />
              </label>
              <label className="dk-field">
                <span>Monthly rent ($)</span>
                <input name="rent" inputMode="decimal" required placeholder="3200" />
              </label>
              <label className="dk-field">
                <span>Broker fee collected ($)</span>
                <input name="fee" inputMode="decimal" required placeholder="3200" />
              </label>
              <label className="dk-field">
                <span>Address</span>
                <input name="address" placeholder="Street, unit" />
              </label>
              <label className="dk-field dk-field--wide">
                <span>Note</span>
                <input name="note" placeholder="How you confirmed it" />
              </label>
              <button className="dk-btn dk-btn--primary">Record lease</button>
            </form>
          </Panel>
        ) : null}

        {deal ? (
          <Panel kicker="Lease" title={`${usd(deal.monthlyRentCents)}/mo · signed ${deal.leaseSignedOn}`} sub={`${deal.address || "Address not given"} · fee ${usd(deal.grossFeeCents)} · referral ${usd(deal.referralDueCents)}`}>
            <div className="dk-inline">
              <Chip tone={DEAL[deal.status]?.tone ?? ""}>{DEAL[deal.status]?.label ?? deal.status}</Chip>
              <Link prefetch={false} className="dk-btn dk-btn--sm" href={self({ open: undefined, tab: "fees" })}>
                Referral fees →
              </Link>
              {s.status === "leased" ? (
                <form action={searchAction}>
                  <Hidden values={{ id: s.id, returnTo: back, op: "close" }} />
                  <button className="dk-btn dk-btn--ghost dk-btn--sm">Close the search</button>
                </form>
              ) : null}
            </div>
          </Panel>
        ) : null}

        <form action={searchAction} className="dk-form">
          <Hidden values={{ id: s.id, returnTo: back, op: "reply" }} />
          <label className="dk-field dk-field--wide">
            <span>Email {first} (from you, reply-to your address)</span>
            <input name="subject" defaultValue={`Your broker search in ${s.city}`} />
          </label>
          <label className="dk-field dk-field--wide">
            <span>Message</span>
            <textarea
              name="body"
              rows={6}
              defaultValue={
                s.noMatchAt
                  ? `Hi ${first},\n\nI'm personally lining up a licensed broker for your search in ${s.city}. You'll see their proposal in your search room within a business day.\n\nBest,\n${me.name}`
                  : `Hi ${first},\n\nChecking in on your search in ${s.city} — is there anything we can help with?\n\nBest,\n${me.name}`
              }
            />
          </label>
          <div className="dk-inline">
            <button className="dk-btn dk-btn--primary">
              <Icon name="mail" size={14} /> Send
            </button>
            <a className="dk-btn dk-btn--ghost dk-btn--sm" href={room} target="_blank" rel="noopener noreferrer">
              <Icon name="external" size={13} /> Open their room
            </a>
          </div>
        </form>
        <form action={searchAction} className="dk-inline">
          <Hidden values={{ id: s.id, returnTo: back, op: "resend" }} />
          <button className="dk-btn dk-btn--ghost dk-btn--sm">
            <Icon name="mail" size={13} /> Re-send their room link
          </button>
        </form>

        <form action={searchAction} className="dk-form">
          <Hidden values={{ id: s.id, returnTo: back, op: "note" }} />
          <label className="dk-field dk-field--wide">
            <span>Private note</span>
            <textarea name="note" rows={2} defaultValue={s.note ?? ""} />
          </label>
          <button className="dk-btn dk-btn--sm">Save note</button>
        </form>

        {!["leased", "closed", "lost"].includes(s.status) ? (
          <form action={searchAction} className="dk-inline">
            <Hidden values={{ id: s.id, returnTo: back }} />
            <input name="reason" placeholder="Why did it end? (found a place alone, moved elsewhere…)" />
            <button className="dk-btn dk-btn--sm" name="op" value="lost">
              Mark lost
            </button>
            <button className="dk-btn dk-btn--ghost dk-btn--sm" name="op" value="spam">
              Spam
            </button>
          </form>
        ) : s.lostReason ? (
          <p className="dk-hint">Ended: {s.lostReason}</p>
        ) : null}
        {founder ? (
          <form action={searchAction}>
            <Hidden values={{ id: s.id, returnTo: back, op: "delete" }} />
            <button className="dk-btn dk-btn--ghost dk-btn--sm">Delete (unsigned only)</button>
          </form>
        ) : null}
        <p className="dk-hint">
          Received {when(s.createdAt)} UTC · stage since {s.stageAt ? when(s.stageAt) : "—"}. The brief sent to brokers never includes the tenant&rsquo;s name or contact until they choose.
        </p>
      </div>
    </RouteDrawer>
  );
}

/* ------------------------------------------------------------------------
   Partners
   ------------------------------------------------------------------------ */

export function PartnersView({ partners, self, status }: { partners: PartnerRow[]; self: Self; status: string }) {
  const rows = status ? partners.filter((p) => p.status === status) : partners;
  return (
    <>
      <div className="dk-inline">
        {(["", "verifying", "applied", "active", "paused", "rejected"] as const).map((k) => (
          <Link key={k || "all"} prefetch={false} scroll={false} className={`dk-chip${status === k ? " dk-chip--brand" : ""}`} href={self({ status: k || undefined, partner: undefined })}>
            {k ? PARTNER_STATUS[k].label : "Everyone"} · {k ? partners.filter((p) => p.status === k).length : partners.length}
          </Link>
        ))}
      </div>
      <Panel flush kicker="Referral partners" title="Brokers in the network" sub="Reply speed, acceptance and wins decide who gets the next lead.">
        {rows.length ? (
          <div className="dk-tablewrap">
            <table className="dk-table">
              <thead>
                <tr>
                  <th>Broker</th>
                  <th>Licence</th>
                  <th>Markets</th>
                  <th>Status</th>
                  <th className="dk-right">Leads</th>
                  <th className="dk-right">Accept</th>
                  <th>Reply</th>
                  <th className="dk-right">Wins</th>
                  <th className="dk-right">Load</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td className="dk-wrap">
                      <Link prefetch={false} href={self({ partner: p.id })} scroll={false}>
                        <b>{p.name}</b>
                      </Link>
                      <div className="dk-dim">{p.brokerage}</div>
                    </td>
                    <td className="dk-wrap">
                      {p.licenseState} · {p.licenseNumber}
                      <div className="dk-dim">{labelOf(LICENSE_TYPES, p.licenseType)}</div>
                    </td>
                    <td className="dk-wrap">{p.marketsList.slice(0, 3).join(", ")}{p.marketsList.length > 3 ? ` +${p.marketsList.length - 3}` : ""}</td>
                    <td>
                      <Chip tone={PARTNER_STATUS[p.status as PartnerStatus]?.tone ?? ""}>{PARTNER_STATUS[p.status as PartnerStatus]?.label ?? p.status}</Chip>
                    </td>
                    <td className="dk-right dk-num">{p.offersN}</td>
                    <td className="dk-right dk-num">{p.offersN ? `${Math.round((p.acceptedN / p.offersN) * 100)}%` : "—"}</td>
                    <td>{mins(p.replyMins)}</td>
                    <td className="dk-right dk-num">
                      {p.wins}
                      {p.ratingCount ? <div className="dk-dim">★ {(p.ratingSum / p.ratingCount).toFixed(1)}</div> : null}
                    </td>
                    <td className="dk-right dk-num">
                      {p.openLeads}/{p.capacity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title={status ? "Nobody here." : "No brokers yet."}>Brokers apply on rentleaks.com/hire-a-broker/agents.html — or invite one below.</Empty>
        )}
      </Panel>
      <Panel kicker="Recruit" title="Invite a broker" sub="A personal email from you with the join page. They apply, sign the referral agreement in the app, and you verify and countersign.">
        <form action={invitePartner} className="dk-form">
          <Hidden values={{ returnTo: self() }} />
          <label className="dk-field">
            <span>Name</span>
            <input name="name" />
          </label>
          <label className="dk-field">
            <span>Email</span>
            <input name="email" type="email" required />
          </label>
          <label className="dk-field">
            <span>Market</span>
            <input name="market" placeholder="Astoria" />
          </label>
          <button className="dk-btn dk-btn--primary">
            <Icon name="mail" size={14} /> Send invitation
          </button>
        </form>
      </Panel>
    </>
  );
}

export function PartnerDrawer({
  p,
  self,
  now,
  offers,
  founder,
  me,
  referrerOk,
  events,
}: {
  p: PartnerRow;
  self: Self;
  now: number;
  offers: Array<NetworkOffer & { search: { id: string; city: string; status: string; budgetMax: number } }>;
  founder: boolean;
  me: { name: string };
  referrerOk: boolean;
  events: AgreementEvent[];
}) {
  const back = self();
  const lookup = licenseLookupUrl(p.licenseState);
  const env = p.env;
  const rl = env?.signers.find((s) => s.role === "rentleaks");
  const othersSigned = env ? env.signers.filter((s) => s.role !== "rentleaks").every((s) => s.status === "signed") : false;
  const canCountersign = !!env && (env.status === "sent" || env.status === "partial") && rl?.status !== "signed" && othersSigned;
  const status = PARTNER_STATUS[p.status as PartnerStatus];
  return (
    <RouteDrawer closeHref={self({ partner: undefined })} kicker={`Referral partner · applied ${ago(now - p.createdAt.getTime())}`} title={`${p.name} · ${p.brokerage}`} width={700}>
      <div className="dk-dossier">
        <div className="dk-chiprow">
          <Chip tone={status?.tone ?? ""}>{status?.label ?? p.status}</Chip>
          {p.verifiedAt ? <Chip tone="good">verified {when(p.verifiedAt, false)}</Chip> : <Chip tone="warn">not verified</Chip>}
          {env ? (
            <Link prefetch={false} className="dk-chip dk-chip--value" href={self({ partner: undefined, tab: "agreements", env: env.id })}>
              agreement · {AGREEMENT_STATUS[env.status as AgreementStatus]?.label ?? env.status} →
            </Link>
          ) : null}
          <Chip tone="value">{p.referralPctBp / 100}% referral</Chip>
        </div>
        <dl className="dk-dossier__facts">
          <div>
            <dt>Contact</dt>
            <dd>
              <a href={`mailto:${p.email}`}>{p.email}</a> · <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`}>{p.phone}</a>
            </dd>
          </div>
          <div>
            <dt>Licence</dt>
            <dd>
              {labelOf(LICENSE_TYPES, p.licenseType)} · {p.licenseState} {p.licenseNumber}
              {p.licenseExpires ? ` · expires ${p.licenseExpires}` : ""}
            </dd>
          </div>
          {p.supervisorName ? (
            <div>
              <dt>Broker of record</dt>
              <dd>
                {p.supervisorName} · <a href={`mailto:${p.supervisorEmail}`}>{p.supervisorEmail}</a>
              </dd>
            </div>
          ) : null}
          <div>
            <dt>Markets</dt>
            <dd>{p.marketsList.join(", ") || "—"}</dd>
          </div>
          <div>
            <dt>Specialties</dt>
            <dd>{p.specialtiesList.map((x) => labelOf(SPECIALTIES, x)).join(", ") || "—"}</dd>
          </div>
          <div>
            <dt>Languages</dt>
            <dd>{p.languagesList.join(", ") || "—"}</dd>
          </div>
          {p.website ? (
            <div>
              <dt>Website</dt>
              <dd>
                <a href={p.website} target="_blank" rel="noopener noreferrer nofollow">
                  {p.website}
                </a>
              </dd>
            </div>
          ) : null}
          <div>
            <dt>Record</dt>
            <dd>
              {p.offersN} leads · {p.acceptedN} accepted · {p.wins} leases · reply {mins(p.replyMins)}
              {p.ratingCount ? ` · ★ ${(p.ratingSum / p.ratingCount).toFixed(1)} (${p.ratingCount})` : ""}
            </dd>
          </div>
        </dl>
        {p.bio ? <pre className="dk-dossier__summary">{p.bio}</pre> : null}

        {env ? (
          <Panel kicker="Referral partner agreement" title="Signatures">
            <Signers signers={env.signers} />
          </Panel>
        ) : null}

        {canCountersign ? (
          <Panel kicker="Step 1 of the partner flow" title="Verify the licence, then countersign" sub="Countersigning activates the broker and emails their portal link.">
            <ol className="rf-checklist">
              <li>
                Look up <b>{p.licenseNumber}</b> in {p.licenseState}
                {lookup ? (
                  <>
                    {" "}
                    —{" "}
                    <a href={lookup} target="_blank" rel="noopener noreferrer">
                      state licence lookup ↗
                    </a>
                  </>
                ) : (
                  " on the state's licensing site"
                )}
                : name matches, licence active{p.licenseExpires ? `, expiry ${p.licenseExpires}` : ""}.
              </li>
              {p.supervisorName ? (
                <li>
                  The supervising broker shown by the state is <b>{p.supervisorName}</b> at <b>{p.brokerage}</b> — referral fees are paid broker-to-broker.
                </li>
              ) : null}
              <li>Their website and reviews look like a real, working practice.</li>
            </ol>
            {referrerOk ? (
              <form action={partnerAction} className="dk-form">
                <Hidden values={{ id: p.id, returnTo: back, op: "countersign" }} />
                <label className="dk-field dk-field--wide">
                  <span>What you checked (saved with the partner)</span>
                  <input name="verifyNote" required defaultValue={p.verifyNote ?? ""} placeholder="DOS lookup: active, exp. 2027-05, sponsor matches" />
                </label>
                <label className="dk-check dk-field--wide">
                  <input type="checkbox" name="verified" required /> I checked this licence with the state today.
                </label>
                <label className="dk-check dk-field--wide">
                  <input type="checkbox" name="consent" required /> {ESIGN_DISCLOSURE.split(".")[0]}. I sign for RentLeaks.
                </label>
                <label className="dk-field dk-field--wide">
                  <span>Type your full name to sign — {me.name}</span>
                  <input name="typedName" required autoComplete="name" placeholder={me.name} />
                </label>
                <div className="nw nw--embed dk-field--wide">
                  <SignaturePad />
                </div>
                <button className="dk-btn dk-btn--primary">
                  <Icon name="check" size={14} /> Verify &amp; countersign
                </button>
              </form>
            ) : (
              <div className="dk-flash dk-flash--warn" role="status">
                Add RentLeaks&rsquo; broker name, licence, states and a phone or address first (Enterprise → Packages &amp; licence) — they appear in the agreement.
              </div>
            )}
          </Panel>
        ) : env && !othersSigned && (env.status === "sent" || env.status === "partial") ? (
          <form action={partnerAction} className="dk-inline">
            <Hidden values={{ id: p.id, returnTo: back, op: "resign" }} />
            <span className="dk-muted">Waiting on {env.signers.find((s) => s.status !== "signed")?.name}.</span>
            <button className="dk-btn dk-btn--sm">
              <Icon name="mail" size={13} /> Send a fresh signing link
            </button>
          </form>
        ) : null}

        <Panel kicker="Terms" title="Referral % and capacity" sub="The % is fixed once their agreement is signed.">
          <form action={partnerAction} className="dk-form">
            <Hidden values={{ id: p.id, returnTo: back, op: "terms" }} />
            <label className="dk-field">
              <span>Referral fee %</span>
              <input name="pct" type="number" min={1} max={60} step="0.5" defaultValue={p.referralPctBp / 100} />
            </label>
            <label className="dk-field">
              <span>Open clients at once</span>
              <input name="capacity" type="number" min={1} max={50} defaultValue={p.capacity} />
            </label>
            <button className="dk-btn dk-btn--sm">Save</button>
          </form>
        </Panel>

        <div className="dk-inline">
          {p.status === "active" ? (
            <form action={partnerAction}>
              <Hidden values={{ id: p.id, returnTo: back, op: "pause" }} />
              <button className="dk-btn dk-btn--sm">Pause leads</button>
            </form>
          ) : null}
          {p.status === "paused" ? (
            <form action={partnerAction}>
              <Hidden values={{ id: p.id, returnTo: back, op: "activate" }} />
              <button className="dk-btn dk-btn--sm">Resume leads</button>
            </form>
          ) : null}
          {p.status === "active" || p.status === "paused" ? (
            <form action={partnerAction}>
              <Hidden values={{ id: p.id, returnTo: back, op: "portal" }} />
              <button className="dk-btn dk-btn--ghost dk-btn--sm">
                <Icon name="mail" size={13} /> Email portal link
              </button>
            </form>
          ) : null}
        </div>

        {p.status !== "rejected" ? (
          <form action={partnerAction} className="dk-inline">
            <Hidden values={{ id: p.id, returnTo: back, op: "reject" }} />
            <input name="reason" placeholder="Why? (licence not found, outside our states…)" />
            <button className="dk-btn dk-btn--ghost dk-btn--sm">Decline &amp; remove</button>
          </form>
        ) : null}

        <Panel flush kicker="Last 20" title="Leads offered">
          {offers.length ? (
            <div className="dk-tablewrap">
              <table className="dk-table">
                <tbody>
                  {offers.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link prefetch={false} href={self({ partner: undefined, tab: undefined, open: o.search.id })} scroll={false}>
                          {o.search.city}
                        </Link>{" "}
                        <span className="dk-dim">up to ${o.search.budgetMax.toLocaleString("en-US")}</span>
                      </td>
                      <td>
                        <Chip tone={OFFER[o.status]?.tone ?? ""}>{OFFER[o.status]?.label ?? o.status}</Chip>
                      </td>
                      <td>{o.feeType && o.feeValue ? feeLabel(o.feeType, o.feeValue) : ""}</td>
                      <td className="dk-dim">{when(o.offeredAt, false)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No leads yet.</Empty>
          )}
        </Panel>
        {events.length ? (
          <details className="dk-details">
            <summary>Agreement activity ({events.length})</summary>
            <ul className="dk-notes">
              {events.map((e) => (
                <li key={e.id}>
                  {when(e.createdAt)} · {e.type} {e.detail ? `· ${e.detail}` : ""}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        {founder ? (
          <form action={partnerAction}>
            <Hidden values={{ id: p.id, returnTo: self({ partner: undefined }), op: "delete" }} />
            <button className="dk-btn dk-btn--ghost dk-btn--sm">Delete (no signed records only)</button>
          </form>
        ) : null}
      </div>
    </RouteDrawer>
  );
}

/* ------------------------------------------------------------------------
   Agreements
   ------------------------------------------------------------------------ */

export function AgreementsView({ envs, self, kind }: { envs: EnvRow[]; self: Self; kind: string }) {
  const rows = kind ? envs.filter((e) => e.kind === kind) : envs;
  return (
    <>
      <div className="dk-inline">
        {[
          ["", "All"],
          ["tenant_rep", "Tenant representation & fee"],
          ["partner_referral", "Referral partner"],
        ].map(([k, l]) => (
          <Link key={k || "all"} prefetch={false} scroll={false} className={`dk-chip${kind === k ? " dk-chip--brand" : ""}`} href={self({ kind: k || undefined, env: undefined })}>
            {l}
          </Link>
        ))}
      </div>
      <Panel flush kicker="In-app e-signature" title="Agreements" sub="Each one is frozen at creation and fingerprinted (SHA-256); every view, consent and signature is on its trail. Keep them at least three years.">
        {rows.length ? (
          <div className="dk-tablewrap">
            <table className="dk-table">
              <thead>
                <tr>
                  <th>Agreement</th>
                  <th>Status</th>
                  <th>Signed</th>
                  <th>Open until</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td className="dk-wrap">
                      <Link prefetch={false} href={self({ env: e.id })} scroll={false}>
                        <b>{e.title}</b>
                      </Link>
                      <div className="dk-dim">
                        {e.version} · {e.signers.map((s) => s.name).join(", ")}
                      </div>
                    </td>
                    <td>
                      <EnvChip status={e.status} />
                    </td>
                    <td className="dk-num">
                      {e.signers.filter((s) => s.status === "signed").length}/{e.signers.length}
                    </td>
                    <td className="dk-dim">{e.status === "sent" || e.status === "partial" ? when(e.expiresAt, false) : e.completedAt ? `done ${when(e.completedAt, false)}` : "—"}</td>
                    <td className="dk-dim">{when(e.createdAt, false)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No agreements yet.">They&rsquo;re created when a tenant chooses a broker, and when a broker applies.</Empty>
        )}
      </Panel>
    </>
  );
}

export function AgreementDrawer({ env, self, founder, links }: { env: EnvRow & { events: AgreementEvent[] }; self: Self; founder: boolean; links: { search?: string; partner?: string } }) {
  const back = self();
  const open = env.status === "sent" || env.status === "partial";
  return (
    <RouteDrawer closeHref={self({ env: undefined })} kicker={env.kind === "tenant_rep" ? "Tenant representation & fee agreement" : "Referral partner agreement"} title={env.title} width={820}>
      <div className="dk-dossier">
        <div className="dk-chiprow">
          <EnvChip status={env.status} />
          <Chip tone="ink">{env.version}</Chip>
          {links.search ? (
            <Link prefetch={false} className="dk-chip dk-chip--brand" href={links.search}>
              search →
            </Link>
          ) : null}
          {links.partner ? (
            <Link prefetch={false} className="dk-chip dk-chip--brand" href={links.partner}>
              broker →
            </Link>
          ) : null}
        </div>
        <Signers signers={env.signers} />
        {open ? (
          <div className="dk-inline">
            <form action={agreementAction}>
              <Hidden values={{ id: env.id, returnTo: back, op: "remind" }} />
              <button className="dk-btn dk-btn--sm">
                <Icon name="mail" size={13} /> Remind the next signer
              </button>
            </form>
            <form action={agreementAction} className="dk-inline">
              <Hidden values={{ id: env.id, returnTo: back, op: "extend" }} />
              <select name="days" defaultValue="7">
                <option value="3">3 days</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </select>
              <button className="dk-btn dk-btn--ghost dk-btn--sm">Extend</button>
            </form>
          </div>
        ) : null}
        {env.voidReason ? <p className="dk-hint">Voided: {env.voidReason}</p> : null}
        <div className="nw nw--embed">
          <AgreementView env={env} fullIps />
        </div>
        {open || (env.status === "completed" && founder) ? (
          <form action={agreementAction} className="dk-inline">
            <Hidden values={{ id: env.id, returnTo: back, op: "void" }} />
            <input name="reason" placeholder="Why void it? (goes on the audit trail)" required />
            <button className="dk-btn dk-btn--danger dk-btn--sm">Void</button>
          </form>
        ) : null}
      </div>
    </RouteDrawer>
  );
}

/* ------------------------------------------------------------------------
   Referral fees
   ------------------------------------------------------------------------ */

export function FeesView({ deals, self, founder, canBooks }: { deals: DealRow[]; self: Self; founder: boolean; canBooks: boolean }) {
  const back = self();
  return (
    <Panel flush kicker="Broker-to-broker" title="Referral fees" sub="The partner's brokerage pays RentLeaks after the lease is signed. Invoices go to the broker of record.">
      {deals.length ? (
        <div className="dk-tablewrap">
          <table className="dk-table">
            <thead>
              <tr>
                <th>Lease</th>
                <th>Broker</th>
                <th className="dk-right">Rent</th>
                <th className="dk-right">Fee collected</th>
                <th className="dk-right">Referral</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => (
                <tr key={d.id}>
                  <td className="dk-wrap">
                    <Link prefetch={false} href={self({ tab: undefined, open: d.searchId })} scroll={false}>
                      <b>{d.tenantName}</b>
                    </Link>
                    <div className="dk-dim">
                      {d.city} · signed {d.leaseSignedOn}
                    </div>
                  </td>
                  <td className="dk-wrap">
                    {d.partnerName}
                    <div className="dk-dim">{d.brokerage}</div>
                  </td>
                  <td className="dk-right dk-num">{usd(d.monthlyRentCents)}</td>
                  <td className="dk-right dk-num">{usd(d.grossFeeCents)}</td>
                  <td className="dk-right dk-num">
                    <b>{usd(d.referralDueCents)}</b>
                    <div className="dk-dim">{d.referralPctBp / 100}%</div>
                  </td>
                  <td>
                    <Chip tone={DEAL[d.status]?.tone ?? ""}>{DEAL[d.status]?.label ?? d.status}</Chip>
                    {d.invoice ? (
                      <div>
                        {canBooks ? (
                          <Link prefetch={false} href={`/admin/books?tab=invoices&open=${d.invoice.id}`}>
                            {d.invoice.number}
                          </Link>
                        ) : (
                          d.invoice.number
                        )}{" "}
                        <span className="dk-dim">{d.invoice.status}</span>
                      </div>
                    ) : null}
                  </td>
                  <td className="dk-wrap">
                    {d.status === "reported" && d.referralDueCents > 0 && canBooks ? (
                      <form action={dealAction}>
                        <Hidden values={{ id: d.id, returnTo: back, op: "invoice" }} />
                        <button className="dk-btn dk-btn--primary dk-btn--sm">
                          <Icon name="invoice" size={13} /> Invoice
                        </button>
                      </form>
                    ) : null}
                    {d.status === "reported" || d.status === "disputed" ? (
                      <details className="dk-details">
                        <summary>Correct · dispute{founder ? " · waive" : ""}</summary>
                        <form action={dealAction} className="dk-inline">
                          <Hidden values={{ id: d.id, returnTo: back, op: "fix" }} />
                          <input name="fee" inputMode="decimal" placeholder="Fee collected $" style={{ width: 130 }} />
                          <button className="dk-btn dk-btn--sm">Correct</button>
                        </form>
                        <form action={dealAction} className="dk-inline">
                          <Hidden values={{ id: d.id, returnTo: back }} />
                          <input name="reason" placeholder="Reason" style={{ width: 160 }} />
                          <button className="dk-btn dk-btn--ghost dk-btn--sm" name="op" value="dispute">
                            Dispute
                          </button>
                          {founder ? (
                            <button className="dk-btn dk-btn--ghost dk-btn--sm" name="op" value="waive">
                              Waive
                            </button>
                          ) : null}
                        </form>
                      </details>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="No leases reported yet.">When a broker reports a lease from their portal, the referral fee lands here — invoice it into Books in one click.</Empty>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------------
   Settings
   ------------------------------------------------------------------------ */

export function SettingsView({
  settings,
  referrer,
  founder,
  self,
}: {
  settings: { referralPctBp: number; offerHours: number; offersPerSearch: number; signDays: number; termDays: number; open: boolean };
  referrer: { name: string; licence: string; states: string; complete: boolean };
  founder: boolean;
  self: Self;
}) {
  return (
    <div className="dk-grid dk-grid--2">
      <Panel kicker="How the network runs" title="Terms" sub="New terms apply to new applications and agreements; signed agreements keep theirs.">
        <form action={networkSettingsAction} className="dk-form">
          <Hidden values={{ returnTo: self() }} />
          <label className="dk-field">
            <span>Referral fee (% of the broker&rsquo;s fee)</span>
            <input name="referralPct" type="number" min={1} max={60} step="0.5" defaultValue={settings.referralPctBp / 100} disabled={!founder} />
          </label>
          <label className="dk-field">
            <span>Hours a broker has to answer</span>
            <input name="offerHours" type="number" min={2} max={96} defaultValue={settings.offerHours} disabled={!founder} />
          </label>
          <label className="dk-field">
            <span>Brokers offered per search</span>
            <input name="offersPerSearch" type="number" min={1} max={6} defaultValue={settings.offersPerSearch} disabled={!founder} />
          </label>
          <label className="dk-field">
            <span>Days an agreement stays open to sign</span>
            <input name="signDays" type="number" min={3} max={60} defaultValue={settings.signDays} disabled={!founder} />
          </label>
          <label className="dk-field">
            <span>Tenant agreement term (days)</span>
            <input name="termDays" type="number" min={30} max={365} defaultValue={settings.termDays} disabled={!founder} />
          </label>
          <label className="dk-check dk-field--wide">
            <input type="checkbox" name="open" defaultChecked={settings.open} disabled={!founder} /> Accept new tenant searches
          </label>
          {founder ? <button className="dk-btn dk-btn--primary">Save terms</button> : <p className="dk-muted">Only the account owner can change these.</p>}
        </form>
      </Panel>
      <Panel kicker="Named in every agreement" title="RentLeaks as referring broker">
        <dl className="dk-dossier__facts">
          <div>
            <dt>Broker</dt>
            <dd>{referrer.name}</dd>
          </div>
          <div>
            <dt>Licence</dt>
            <dd>{referrer.licence || <Chip tone="bad">missing</Chip>}</dd>
          </div>
          <div>
            <dt>States</dt>
            <dd>{referrer.states || <Chip tone="bad">missing</Chip>}</dd>
          </div>
        </dl>
        <p className="dk-muted">{referrer.complete ? "Complete — partner agreements can be countersigned." : "Incomplete — partner agreements can't be countersigned until it's filled in."}</p>
        <Link prefetch={false} className="dk-btn dk-btn--sm" href="/admin/enterprise?tab=catalogue">
          Edit in Enterprise →
        </Link>
        <h3 className="rf-h3">Before you promote the pages</h3>
        <ul className="rf-checklist">
          <li>Have a New York real-estate lawyer review both agreement templates ({"tenant-rep-2026.09"}, {"partner-referral-2026.09"}).</li>
          <li>Referral fees may only be paid to and by licensed brokers — RentLeaks must hold an active broker licence in each state it refers in.</li>
          <li>Tenants choose to hire a broker; fees are agreed in writing first and never charged for homes a landlord&rsquo;s agent lists (NYC FARE Act).</li>
          <li>Briefs describe the home only — never the renter&rsquo;s personal characteristics (fair housing).</li>
        </ul>
        <div className="dk-inline">
          <a className="dk-btn dk-btn--ghost dk-btn--sm" href="https://rentleaks.com/hire-a-broker/" target="_blank" rel="noopener noreferrer">
            <Icon name="external" size={13} /> Tenant page
          </a>
          <a className="dk-btn dk-btn--ghost dk-btn--sm" href="https://rentleaks.com/hire-a-broker/agents.html" target="_blank" rel="noopener noreferrer">
            <Icon name="external" size={13} /> Broker page
          </a>
        </div>
      </Panel>
    </div>
  );
}

export const HOME_LABEL = Object.fromEntries(HOME_TYPES.map((h) => [h.id, h.label])) as Record<string, string>;

/* ------------------------------------------------------------------------
   Guide leads (the lead magnets)
   ------------------------------------------------------------------------ */

export type GuideRow = GuideLead & { assignedName: string | null };

const GUIDE_STATUS: Record<string, { label: string; tone: ChipTone }> = {
  new: { label: "to follow up", tone: "warn" },
  contacted: { label: "contacted", tone: "brand" },
  converted: { label: "converted", tone: "good" },
  closed: { label: "closed", tone: "ink" },
  spam: { label: "spam", tone: "bad" },
};

export function GuidesView({ leads, self, audience, status, now }: { leads: GuideRow[]; self: Self; audience: string; status: string; now: number }) {
  const rows = leads.filter((l) => (audience ? l.audience === audience : true)).filter((l) => (status ? l.status === status : l.status !== "spam"));
  const count = (f: (l: GuideRow) => boolean) => leads.filter(f).length;
  return (
    <>
      <div className="dk-inline">
        {[
          ["", "Everyone"],
          ["tenant", "Renters"],
          ["partner", "Agents"],
        ].map(([k, l]) => (
          <Link key={k || "all"} prefetch={false} scroll={false} className={`dk-chip${audience === k ? " dk-chip--brand" : ""}`} href={self({ audience: k || undefined, lead: undefined })}>
            {l} · {k ? count((x) => x.audience === k && x.status !== "spam") : count((x) => x.status !== "spam")}
          </Link>
        ))}
        <span className="dk-dim">·</span>
        {[
          ["", "Open"],
          ["new", "To follow up"],
          ["converted", "Converted"],
          ["spam", "Spam"],
        ].map(([k, l]) => (
          <Link key={k || "open"} prefetch={false} scroll={false} className={`dk-chip${status === k ? " dk-chip--brand" : ""}`} href={self({ status: k || undefined, lead: undefined })}>
            {l}
          </Link>
        ))}
      </div>
      <Panel
        flush
        kicker="Lead magnets"
        title="Guide downloads"
        sub="Everyone here asked for a guide and agreed to be contacted by our agents and referral partners. The sentence they agreed to is on each row."
        actions={
          <Link prefetch={false} className="dk-btn dk-btn--ghost dk-btn--sm" href="/api/admin/export/network-guides">
            <Icon name="export" size={13} /> Export CSV
          </Link>
        }
      >
        {rows.length ? (
          <div className="dk-tablewrap">
            <table className="dk-table">
              <thead>
                <tr>
                  <th>Who</th>
                  <th>Guide</th>
                  <th>Where</th>
                  <th>Status</th>
                  <th>Asked</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id}>
                    <td className="dk-wrap">
                      <Link prefetch={false} href={self({ lead: l.id })} scroll={false}>
                        <b>{l.name}</b>
                      </Link>
                      <div className="dk-dim">
                        {l.email}
                        {l.phone ? ` · ${l.phone}` : ""}
                      </div>
                    </td>
                    <td className="dk-wrap">
                      {GUIDE.get(l.guideId)?.title ?? l.guideId}
                      <div className="dk-dim">{l.downloads ? `opened ${l.downloads}×` : l.sentAt ? "emailed, not opened" : "not emailed"}</div>
                    </td>
                    <td className="dk-wrap">
                      {l.audience === "partner" ? l.brokerage || "—" : l.city || "—"}
                      {l.licenseState ? <div className="dk-dim">{l.licenseState}</div> : null}
                    </td>
                    <td>
                      <Chip tone={GUIDE_STATUS[l.status]?.tone ?? ""}>{GUIDE_STATUS[l.status]?.label ?? l.status}</Chip>
                      {l.assignedName ? <div className="dk-dim">{l.assignedName}</div> : null}
                    </td>
                    <td className="dk-dim">{ago(now - l.createdAt.getTime())}</td>
                    <td>
                      <form action={guideAction} className="dk-inline">
                        <Hidden values={{ id: l.id, returnTo: self() }} />
                        {l.status === "new" ? (
                          <button className="dk-btn dk-btn--sm" name="op" value="contacted">
                            Contacted
                          </button>
                        ) : null}
                        <Link prefetch={false} className="dk-btn dk-btn--ghost dk-btn--sm" href={self({ lead: l.id })} scroll={false}>
                          Open
                        </Link>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Nothing here yet.">
            The guides are on rentleaks.com/hire-a-broker/guide.html — share that link in ads, posts and email signatures, and downloads land here.
          </Empty>
        )}
      </Panel>
    </>
  );
}

export function GuideSources({ leads }: { leads: GuideRow[] }) {
  const rows = new Map<string, { n: number; converted: number }>();
  for (const l of leads.filter((x) => x.status !== "spam")) {
    const key = l.campaign ? `${l.source} · ${l.campaign}` : l.source;
    const at = rows.get(key) ?? { n: 0, converted: 0 };
    at.n += 1;
    at.converted += l.status === "converted" ? 1 : 0;
    rows.set(key, at);
  }
  const list = [...rows.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 10);
  return (
    <Panel kicker="Where they came from" title="Sources" sub="The tagged links in the social kit land here — social posts, the bio links and anything with utm_source.">
      {list.length ? (
        <RankedBars rows={list.map(([k, v]) => ({ key: k, label: `${k}${v.converted ? ` · ${v.converted} converted` : ""}`, value: v.n }))} empty="No downloads yet." />
      ) : (
        <p className="dk-muted">Nothing yet. Post one of the guide links from marketing/social and this fills in.</p>
      )}
    </Panel>
  );
}

export function GuideDrawer({ l, self, now, founder, me }: { l: GuideRow; self: Self; now: number; founder: boolean; me: { name: string } }) {
  const back = self();
  const guide = GUIDE.get(l.guideId);
  const first = l.name.split(" ")[0];
  const tenant = l.audience === "tenant";
  const template = tenant
    ? `Hi ${first},\n\nThanks for downloading ${guide?.title ?? "the guide"} — I hope the fee-cap worksheet is useful.\n\nIf you'd like, tell me the neighbourhood, your budget and roughly when you need to move, and I'll have verified brokers who work that area send you proposals — each with their fee, at or under the cap you set. No obligation, and nothing to pay us.\n\nBest,\n${me.name}\nRentLeaks`
    : `Hi ${first},\n\nThanks for downloading the partner kit. Happy to answer anything about how the leads or the referral fee work${l.brokerage ? ` at ${l.brokerage}` : ""}.\n\nIf you'd like to start, applying takes two minutes (licence, markets, specialties) and you'll sign the referral agreement in the app. We verify the licence with the state and countersign, then leads in your markets start arriving.\n\nBest,\n${me.name}\nRentLeaks broker network`;
  return (
    <RouteDrawer closeHref={self({ lead: undefined })} kicker={`Guide download · ${ago(now - l.createdAt.getTime())}`} title={l.name} width={660}>
      <div className="dk-dossier">
        <div className="dk-chiprow">
          <Chip tone={GUIDE_STATUS[l.status]?.tone ?? ""}>{GUIDE_STATUS[l.status]?.label ?? l.status}</Chip>
          <Chip tone={tenant ? "brand" : "value"}>{tenant ? "renter" : "agent"}</Chip>
          {l.downloads ? <Chip tone="good">opened {l.downloads}×</Chip> : <Chip>not opened</Chip>}
          {l.assignedName ? <Chip tone="ink">owner: {l.assignedName}</Chip> : null}
        </div>
        <dl className="dk-dossier__facts">
          <div>
            <dt>Contact</dt>
            <dd>
              <a href={`mailto:${l.email}`}>{l.email}</a>
              {l.phone ? (
                <>
                  {" "}
                  · <a href={`tel:${l.phone.replace(/[^\d+]/g, "")}`}>{l.phone}</a>
                </>
              ) : null}
            </dd>
          </div>
          <div>
            <dt>Guide</dt>
            <dd>{guide?.title ?? l.guideId}</dd>
          </div>
          {l.city ? (
            <div>
              <dt>Where</dt>
              <dd>{l.city}</dd>
            </div>
          ) : null}
          {l.brokerage ? (
            <div>
              <dt>Brokerage</dt>
              <dd>
                {l.brokerage}
                {l.licenseState ? ` · ${l.licenseState}` : ""}
              </dd>
            </div>
          ) : null}
          <div>
            <dt>Source</dt>
            <dd>
              {l.source}
              {l.campaign ? ` · ${l.campaign}` : ""}
            </dd>
          </div>
          <div>
            <dt>Emailed</dt>
            <dd>{l.sentAt ? when(l.sentAt) : "not sent"}</dd>
          </div>
        </dl>
        <Panel kicker="Consent" title="What they agreed to" sub={`Ticked ${when(l.createdAt)} UTC${l.ip ? ` from ${l.ip}` : ""}.`}>
          <p className="dk-muted">“{l.consentText}”</p>
        </Panel>

        <form action={guideAction} className="dk-form">
          <Hidden values={{ id: l.id, returnTo: back, op: "reply" }} />
          <label className="dk-field dk-field--wide">
            <span>Reply by email (from you, reply-to your address)</span>
            <input name="subject" defaultValue={tenant ? "Your broker playbook — and the next step" : "Your partner kit — and how to start"} />
          </label>
          <label className="dk-field dk-field--wide">
            <span>Message</span>
            <textarea name="body" rows={9} defaultValue={template} />
          </label>
          <button className="dk-btn dk-btn--primary">
            <Icon name="mail" size={14} /> Send reply
          </button>
        </form>

        <div className="dk-inline">
          <form action={guideAction}>
            <Hidden values={{ id: l.id, returnTo: back, op: "contacted" }} />
            <button className="dk-btn dk-btn--sm">
              <Icon name="phone" size={13} /> Called them
            </button>
          </form>
          <form action={guideAction}>
            <Hidden values={{ id: l.id, returnTo: back, op: "resend" }} />
            <button className="dk-btn dk-btn--sm">
              <Icon name="mail" size={13} /> Re-send the guide
            </button>
          </form>
          <form action={guideAction}>
            <Hidden values={{ id: l.id, returnTo: back, op: "converted" }} />
            <button className="dk-btn dk-btn--sm">
              <Icon name="check" size={13} /> Converted
            </button>
          </form>
          {l.assignedName ? null : (
            <form action={guideAction}>
              <Hidden values={{ id: l.id, returnTo: back, op: "mine" }} />
              <button className="dk-btn dk-btn--ghost dk-btn--sm">Take it</button>
            </form>
          )}
        </div>

        <form action={guideAction} className="dk-form">
          <Hidden values={{ id: l.id, returnTo: back, op: "note" }} />
          <label className="dk-field dk-field--wide">
            <span>Private note</span>
            <textarea name="note" rows={2} defaultValue={l.note ?? ""} placeholder="What they said on the call" />
          </label>
          <button className="dk-btn dk-btn--sm">Save note</button>
        </form>

        <form action={guideAction} className="dk-inline">
          <Hidden values={{ id: l.id, returnTo: back }} />
          <input name="reason" placeholder="Closing it? Why (not moving, wrong state…)" />
          <button className="dk-btn dk-btn--sm" name="op" value="closed">
            Close
          </button>
          <button className="dk-btn dk-btn--ghost dk-btn--sm" name="op" value="spam">
            Spam
          </button>
          {founder ? (
            <button className="dk-btn dk-btn--ghost dk-btn--sm" name="op" value="delete">
              Delete
            </button>
          ) : null}
        </form>
      </div>
    </RouteDrawer>
  );
}

/* ------------------------------------------------------------------------
   The public roster: ten headshot slots
   ------------------------------------------------------------------------ */

export function RosterPanel({ cards, partners, self, slots }: { cards: RosterCard[]; partners: PartnerRow[]; self: Self; slots: number }) {
  const back = self();
  const withPhoto = partners.filter((p) => p.status === "active" && p.photoAt);
  const pinned = withPhoto.filter((p) => p.featuredAt).length;
  const empty = Math.max(0, slots - cards.length);
  return (
    <Panel
      kicker="rentleaks.com/hire-a-broker/"
      title={`The ${slots} faces on the public pages`}
      sub={`${cards.length} filled · ${pinned} pinned. Pinned partners come first; the rest of the slots go to active partners with a headshot, most leases first. Empty slots invite agents to join.`}
    >
      <div className="rf-roster">
        {cards.map((c) => (
          <figure key={c.id} className="rf-roster__card">
            {c.photo ? <img src={c.photo} alt={`${c.name} headshot`} width={64} height={64} /> : <span className="rf-roster__empty" />}
            <figcaption>
              <b>{c.name}</b>
              <span className="dk-dim">{c.brokerage}</span>
              <span className="dk-dim">{c.markets.join(", ")}</span>
            </figcaption>
          </figure>
        ))}
        {Array.from({ length: empty }).map((_, i) => (
          <figure key={`empty-${i}`} className="rf-roster__card rf-roster__card--empty">
            <span className="rf-roster__empty">{cards.length + i + 1}</span>
            <figcaption>
              <b>Open slot</b>
              <span className="dk-dim">Invite a broker, or ask a partner for a headshot</span>
            </figcaption>
          </figure>
        ))}
      </div>
      {withPhoto.length ? (
        <div className="dk-tablewrap" style={{ marginTop: 12 }}>
          <table className="dk-table">
            <thead>
              <tr>
                <th>Partner with a headshot</th>
                <th>Headline</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {withPhoto.map((p) => (
                <tr key={p.id}>
                  <td className="dk-wrap">
                    <Link prefetch={false} href={self({ partner: p.id })} scroll={false}>
                      <b>{p.name}</b>
                    </Link>
                    <div className="dk-dim">{p.brokerage}</div>
                  </td>
                  <td className="dk-wrap">
                    <form action={partnerAction} className="dk-inline">
                      <Hidden values={{ id: p.id, returnTo: back, op: "headline" }} />
                      <input name="headline" defaultValue={p.headline ?? ""} placeholder="One line tenants read first" style={{ minWidth: 220 }} />
                      <button className="dk-btn dk-btn--sm">Save</button>
                    </form>
                  </td>
                  <td>
                    <form action={partnerAction} className="dk-inline">
                      <Hidden values={{ id: p.id, returnTo: back }} />
                      {p.featuredAt ? (
                        <button className="dk-btn dk-btn--sm" name="op" value="unfeature">
                          Unpin
                        </button>
                      ) : (
                        <button className="dk-btn dk-btn--sm" name="op" value="feature">
                          Pin to the page
                        </button>
                      )}
                      <button className="dk-btn dk-btn--ghost dk-btn--sm" name="op" value="photo-remove">
                        Remove photo
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="No headshots yet.">Partners add theirs in the portal, under “Your headshot”. Nudge your best few — the page looks alive with faces on it.</Empty>
      )}
    </Panel>
  );
}
