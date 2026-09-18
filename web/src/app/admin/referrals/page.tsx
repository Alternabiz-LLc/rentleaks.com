import "@/app/network.css";
import Link from "next/link";
import { Board, type BoardCard } from "@/components/admin/desk/Board";
import { Donut, FunnelLanes, Kpi, RankedBars } from "@/components/admin/desk/charts";
import { DeskHeader, type Signal } from "@/components/admin/desk/DeskHeader";
import { Icon } from "@/components/admin/desk/Icon";
import { Chip, CommandRail, Empty, MarkTile, Panel } from "@/components/admin/desk/parts";
import { flashOf, qs, readParams, type SP } from "@/components/admin/ui";
import { canAccess, isFounder } from "@/lib/access";
import { requireAdminPage } from "@/lib/admin/guard";
import { nowMs } from "@/lib/admin/metrics";
import { BOARD_STAGES, feeLabel, GUIDES, HOME_TYPES, matchScore, median, norm, PARTNER_STATUSES, ROSTER_SLOTS, SEARCH_STAGE, usd, type SearchStage } from "@/lib/network/core";
import { json, networkSettings, partnerStats, referrer, roomLink, searchBrief } from "@/lib/network/engine";
import { roster } from "@/lib/network/guides";
import { prisma } from "@/lib/prisma";
import {
  AgreementDrawer,
  AgreementsView,
  FeesView,
  GuideDrawer,
  GuidesView,
  GuideSources,
  PartnerDrawer,
  PartnersView,
  RosterPanel,
  SearchDrawer,
  SettingsView,
  type Candidate,
  type DealRow,
  type EnvRow,
  type GuideRow,
  type PartnerRow,
  type SearchRow,
} from "./views";

export const metadata = { title: "Broker network — RentLeaks desk" };

const DAY = 86_400_000;
const TABS = ["searches", "partners", "guides", "agreements", "fees", "settings"] as const;
type Tab = (typeof TABS)[number];
const PUBLIC_URL = "https://rentleaks.com/hire-a-broker/";
const HOME = Object.fromEntries(HOME_TYPES.map((h) => [h.id, h.label])) as Record<string, string>;

/**
 * Broker network: tenants who want to hire a broker (rentleaks.com/hire-a-broker/),
 * the licensed partners who answer them, the in-app agreements that bind
 * them, and the broker-to-broker referral fees that follow a lease.
 */
export default async function ReferralsPage({ searchParams }: { searchParams: SP }) {
  const me = await requireAdminPage("/admin/referrals");
  const p = await readParams(searchParams);
  const t = nowMs();
  const now = new Date(t);
  const tab: Tab = (TABS as readonly string[]).includes(p.tab) ? (p.tab as Tab) : "searches";
  const self = (over: Record<string, string | undefined> = {}) => `/admin/referrals${qs(p, { ok: undefined, err: undefined, ...over })}`;
  const founder = isFounder(me);
  const canBooks = canAccess(me, "books");

  const safe = <T,>(q: Promise<T>, f: T) =>
    q.then(
      (v) => ({ v, failed: false }),
      (err: unknown) => {
        console.error("[admin/referrals]", err instanceof Error ? err.message : err);
        return { v: f, failed: true };
      },
    );
  const [searchesRes, partnersRes, envsRes, dealsRes, statsRes, settings, ref, guidesRes, rosterCards, team] = await Promise.all([
    safe(
      prisma.networkSearch.findMany({
        where: { status: { not: "spam" } },
        orderBy: { createdAt: "desc" },
        take: 500,
        include: { offers: { orderBy: { offeredAt: "asc" }, include: { partner: { select: { id: true, name: true, brokerage: true } } } } },
      }),
      [],
    ),
    safe(prisma.networkPartner.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 500 }), []),
    safe(prisma.agreement.findMany({ orderBy: { createdAt: "desc" }, take: 400, include: { signers: { orderBy: { order: "asc" } } } }), []),
    safe(prisma.networkDeal.findMany({ orderBy: { createdAt: "desc" }, take: 400 }), []),
    safe(
      prisma.networkPartner.findMany({ select: { id: true } }).then((xs) => (xs.length ? partnerStats(xs.map((x) => x.id)) : [])),
      [],
    ),
    networkSettings().catch(() => ({ referralPctBp: 2500, offerHours: 24, offersPerSearch: 3, signDays: 14, termDays: 90, open: true })),
    referrer().catch(() => ({ name: "RentLeaks", licence: "", states: "", contact: "", complete: false })),
    safe(prisma.guideLead.findMany({ orderBy: { createdAt: "desc" }, take: 500 }), []),
    roster().catch(() => []),
    prisma.user.findMany({ where: { role: { in: ["admin", "staff"] } }, select: { id: true, name: true } }).catch(() => []),
  ]);
  const pending = searchesRes.failed || partnersRes.failed || envsRes.failed || dealsRes.failed;
  const envs: EnvRow[] = envsRes.v;
  const envById = new Map(envs.map((e) => [e.id, e]));
  const partnersRaw = partnersRes.v;
  const partnerById = new Map(partnersRaw.map((x) => [x.id, x]));
  const statsById = new Map(statsRes.v.map((s) => [s.id, s]));

  const searches: SearchRow[] = searchesRes.v.map((s) => ({
    ...s,
    brief: searchBrief(s),
    partnerName: s.chosenPartnerId ? (partnerById.get(s.chosenPartnerId)?.name ?? null) : null,
  }));
  const searchById = new Map(searches.map((s) => [s.id, s]));
  const partners: PartnerRow[] = partnersRaw.map((x) => {
    const st = statsById.get(x.id);
    return {
      ...x,
      marketsList: json<string[]>(x.markets, []),
      specialtiesList: json<string[]>(x.specialties, []),
      languagesList: json<string[]>(x.languages, []),
      offersN: st?.offers ?? 0,
      acceptedN: st?.accepted ?? 0,
      wins: st?.wins ?? 0,
      openLeads: st?.openLeads ?? 0,
      replyMins: st?.medianReplyMins ?? null,
      env: x.agreementId ? (envById.get(x.agreementId) ?? null) : null,
    };
  });
  const staff = new Map(team.map((u) => [u.id, u.name]));
  const guideLeads: GuideRow[] = guidesRes.v.map((l) => ({ ...l, assignedName: l.assignedToId ? (staff.get(l.assignedToId) ?? null) : null }));
  const invoiceIds = dealsRes.v.map((d) => d.invoiceId).filter((x): x is string => !!x);
  const invoices = invoiceIds.length ? await prisma.invoice.findMany({ where: { id: { in: invoiceIds } }, select: { id: true, number: true, status: true } }).catch(() => []) : [];
  const invById = new Map(invoices.map((i) => [i.id, i]));
  const deals: DealRow[] = dealsRes.v.map((d) => {
    const pr = partnerById.get(d.partnerId);
    const s = searchById.get(d.searchId);
    return { ...d, partnerName: pr?.name ?? "—", brokerage: pr?.brokerage ?? "", tenantName: s?.name ?? "Tenant", city: s?.city ?? "", invoice: d.invoiceId ? (invById.get(d.invoiceId) ?? null) : null };
  });

  /* ---- numbers ---- */
  const live = searches.filter((s) => !["leased", "closed", "lost"].includes(s.status));
  const unmatched = searches.filter((s) => s.status === "matching" && s.noMatchAt);
  const r90 = searches.filter((s) => t - s.createdAt.getTime() < 90 * DAY);
  const withProposal = r90.filter((s) => s.offers.some((o) => o.respondedAt && o.status !== "declined" && o.status !== "expired"));
  const chosen90 = r90.filter((s) => ["chosen", "signed", "touring", "applied", "leased", "closed"].includes(s.status) || (s.status === "lost" && s.chosenPartnerId));
  const signed90 = r90.filter((s) => ["signed", "touring", "applied", "leased", "closed"].includes(s.status) || (s.status === "lost" && s.agreementId));
  const leased90 = r90.filter((s) => s.status === "leased" || s.status === "closed");
  const firstProposalHours = median(
    r90.flatMap((s) => {
      const ts = s.offers.filter((o) => o.respondedAt && o.feeType).map((o) => o.respondedAt!.getTime());
      return ts.length ? [(Math.min(...ts) - s.createdAt.getTime()) / 3_600_000] : [];
    }),
  );
  const active = partners.filter((x) => x.status === "active");
  const toVerify = partners.filter((x) => x.status === "verifying");
  const toInvoice = deals.filter((d) => d.status === "reported" && d.referralDueCents > 0);
  const owed = deals.filter((d) => d.status === "reported" || d.status === "invoiced").reduce((n, d) => n + d.referralDueCents, 0);
  const paidYear = deals.filter((d) => d.status === "paid" && d.paidAt && d.paidAt.getUTCFullYear() === now.getUTCFullYear()).reduce((n, d) => n + d.referralDueCents, 0);
  const waitingSign = envs.filter((e) => (e.status === "sent" || e.status === "partial") && t - e.createdAt.getTime() > 3 * DAY);
  const freshGuides = guideLeads.filter((l) => l.status === "new");
  const guides90 = guideLeads.filter((l) => t - l.createdAt.getTime() < 90 * DAY && l.status !== "spam");
  const guidesConverted = guideLeads.filter((l) => l.status === "converted").length;

  const signals: Signal[] = [
    {
      label: "Brokers to verify",
      value: toVerify.length ? `${toVerify.length} waiting` : "none waiting",
      tone: toVerify.length ? "warn" : "ok",
      href: self({ tab: "partners", status: "verifying", open: undefined }),
    },
    {
      label: "Searches without a broker",
      value: unmatched.length ? `${unmatched.length} need a hand` : "all matched",
      tone: unmatched.length ? "critical" : "ok",
      href: self({ tab: undefined, status: "matching", open: undefined }),
    },
    {
      label: "Referral fees",
      value: toInvoice.length ? `${toInvoice.length} to invoice` : owed ? `${usd(owed)} outstanding` : "nothing due",
      tone: toInvoice.length ? "warn" : "ok",
      href: self({ tab: "fees", open: undefined }),
    },
    {
      label: "Guide downloads",
      value: freshGuides.length ? `${freshGuides.length} to follow up` : guides90.length ? "all followed up" : "none yet",
      tone: freshGuides.filter((l) => t - l.createdAt.getTime() > 2 * DAY).length ? "critical" : freshGuides.length ? "warn" : "ok",
      href: self({ tab: "guides", status: "new", open: undefined }),
    },
    {
      label: "RentLeaks licence in agreements",
      value: ref.complete ? ref.states || "set" : "missing",
      tone: ref.complete ? "ok" : "critical",
      href: self({ tab: "settings", open: undefined }),
    },
  ];

  /* ---- board ---- */
  const statusFilter = p.status && p.status in SEARCH_STAGE && tab === "searches" ? (p.status as SearchStage) : "";
  const cards: BoardCard[] = live
    .filter((s) => (statusFilter ? s.status === statusFilter : true))
    .map((s) => {
      const proposals = s.offers.filter((o) => o.status === "proposed").length;
      const waiting = s.offers.filter((o) => o.status === "offered").length;
      const beds = s.bedrooms === null ? "" : s.bedrooms === 0 ? "studio" : `${s.bedrooms} bd`;
      return {
        id: s.id,
        column: s.status,
        title: `${s.city}, ${s.state}`,
        sub: [HOME[s.homeType] ?? s.homeType, beds, `≤ $${s.budgetMax.toLocaleString("en-US")}`, s.moveIn ? `in ${s.moveIn}` : ""].filter(Boolean).join(" · "),
        initials: s.name.slice(0, 2).toUpperCase(),
        score: s.score,
        chips: [
          ...(s.term !== "long" ? [{ label: s.term === "mid" ? "short term" : "flexible", tone: "value" }] : []),
          ...(s.buildingAge === "new" ? [{ label: "new dev", tone: "brand" }] : []),
          ...(proposals ? [{ label: `${proposals} proposal${proposals === 1 ? "" : "s"}`, tone: "good" }] : []),
          ...(waiting ? [{ label: `${waiting} waiting`, tone: "" }] : []),
          ...(s.feeCapType !== "none" ? [{ label: `cap ${feeLabel(s.feeCapType, s.feeCapValue)}`, tone: "" }] : []),
        ],
        lines: [s.name, s.partnerName ? `Broker: ${s.partnerName}` : ""].filter(Boolean),
        alert: s.noMatchAt ? "No broker matched" : s.status === "new" && t - s.createdAt.getTime() > 3_600_000 ? "Not matched yet" : undefined,
        href: self({ open: s.id }),
      };
    });

  /* ---- charts ---- */
  const byHome = HOME_TYPES.map((h) => ({ label: h.label, value: r90.filter((s) => s.homeType === h.id).length })).filter((x) => x.value > 0);
  const byCity = new Map<string, { n: number; state: string }>();
  for (const s of r90) {
    const k = `${s.city}, ${s.state}`;
    byCity.set(k, { n: (byCity.get(k)?.n ?? 0) + 1, state: s.state });
  }
  const coverage = (city: string, state: string) => active.filter((x) => x.licenseState === state && x.marketsList.some((m) => norm(m) === norm(city))).length;

  /* ---- drawers ---- */
  const openSearch = p.open ? searchById.get(p.open) : undefined;
  const openPartner = p.partner ? partners.find((x) => x.id === p.partner) : undefined;
  const openEnvId = p.env && envById.has(p.env) ? p.env : undefined;
  const openLead = p.lead ? guideLeads.find((l) => l.id === p.lead) : undefined;
  const [contact, partnerOffers, envFull, partnerEvents] = await Promise.all([
    openSearch ? prisma.contact.findUnique({ where: { email: openSearch.email }, select: { id: true } }).catch(() => null) : null,
    openPartner
      ? prisma.networkOffer.findMany({ where: { partnerId: openPartner.id }, orderBy: { offeredAt: "desc" }, take: 20, include: { search: { select: { id: true, city: true, status: true, budgetMax: true } } } }).catch(() => [])
      : [],
    openEnvId ? prisma.agreement.findUnique({ where: { id: openEnvId }, include: { signers: { orderBy: { order: "asc" } }, events: { orderBy: { createdAt: "asc" } } } }).catch(() => null) : null,
    openPartner?.agreementId ? prisma.agreementEvent.findMany({ where: { agreementId: openPartner.agreementId }, orderBy: { createdAt: "desc" }, take: 30 }).catch(() => []) : [],
  ]);
  const candidates: Candidate[] = openSearch
    ? active
        .filter((x) => x.licenseState === openSearch.state)
        .map((x) => {
          const st = statsById.get(x.id);
          const m = st
            ? matchScore(
                { city: openSearch.city, state: openSearch.state, neighborhoods: json<string[]>(openSearch.neighborhoods, []), homeType: openSearch.homeType, buildingAge: openSearch.buildingAge, term: openSearch.term, language: openSearch.language, budgetMax: openSearch.budgetMax },
                st,
                t,
              )
            : null;
          return { id: x.id, name: x.name, brokerage: x.brokerage, score: m?.score ?? null, reasons: m?.reasons ?? [], openLeads: x.openLeads, capacity: x.capacity };
        })
        .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    : [];

  return (
    <div className="dk-stack">
      <DeskHeader
        href="/admin/referrals"
        flash={flashOf(p)}
        signals={signals}
        actions={
          <>
            <a className="dk-btn dk-btn--onink" href={PUBLIC_URL} target="_blank" rel="noopener noreferrer">
              <Icon name="external" size={15} /> Public pages
            </a>
            <Link prefetch={false} className="dk-btn dk-btn--onink" href={`/api/admin/export/${tab === "partners" ? "network-partners" : tab === "agreements" ? "network-agreements" : tab === "fees" ? "network-deals" : tab === "guides" ? "network-guides" : "network-searches"}`}>
              <Icon name="export" size={15} /> Export
            </Link>
            <Link prefetch={false} className="dk-btn dk-btn--light" href={self({ tab: "partners", status: undefined, open: undefined })} scroll={false}>
              <Icon name="plus" size={15} /> Invite a broker
            </Link>
          </>
        }
      />

      {pending ? (
        <div className="dk-flash dk-flash--warn" role="status">
          The broker network tables aren&rsquo;t in this database yet — run the latest migration (the deploy script does it), then reload.
        </div>
      ) : null}
      {!ref.complete ? (
        <div className="dk-flash dk-flash--warn" role="status">
          Every agreement names RentLeaks as the referring broker. Add the broker name, licence number, states and a phone or address before promoting the pages.{" "}
          <Link prefetch={false} href="/admin/enterprise?tab=catalogue">
            {founder ? "Add them now →" : "Ask the account owner →"}
          </Link>
        </div>
      ) : null}
      {!settings.open ? (
        <div className="dk-flash dk-flash--warn" role="status">
          New tenant searches are paused. <Link href={self({ tab: "settings" })}>Resume →</Link>
        </div>
      ) : null}

      <div className="dk-kpis">
        <Kpi label="Live searches" value={live.length} sub={`${live.filter((s) => s.status === "proposals").length} choosing · ${live.filter((s) => ["signed", "touring", "applied"].includes(s.status)).length} under way`} href={self({ tab: undefined, status: undefined })} tone={unmatched.length ? "alert" : undefined} />
        {tab === "guides" ? (
          <Kpi label="Guide leads · 90 days" value={guides90.length} sub={freshGuides.length ? `${freshGuides.length} waiting on a reply` : guidesConverted ? `${guidesConverted} converted` : "none waiting"} tone={freshGuides.length ? "alert" : undefined} href={self({ tab: "guides" })} />
        ) : (
          <Kpi label="Got a proposal · 90 days" value={r90.length ? `${Math.round((withProposal.length / r90.length) * 100)}%` : "—"} sub={firstProposalHours === null ? "no proposals yet" : `first one in ${firstProposalHours < 1 ? "under an hour" : `${Math.round(firstProposalHours)} h`} (median)`} />
        )}
        <Kpi label="Active brokers" value={active.length} sub={toVerify.length ? `${toVerify.length} to verify` : `${partners.filter((x) => x.status === "applied").length} signing up`} tone={toVerify.length ? "alert" : "good"} href={self({ tab: "partners", status: toVerify.length ? "verifying" : "active" })} />
        <Kpi label="Signed → leased · 90 days" value={signed90.length ? `${Math.round((leased90.length / signed90.length) * 100)}%` : "—"} sub={`${leased90.length} leases of ${signed90.length} signed`} />
        <Kpi label="Referral fees outstanding" value={Math.round(owed / 100)} fmt="usd" sub={`${usd(paidYear)} collected this year`} tone="value" href={self({ tab: "fees" })} />
      </div>

      <div className="dk-grid dk-grid--rail">
        <CommandRail
          title="Broker network"
          sub="Brief · propose · sign · lease · referral"
          tabs={[
            { key: "searches", label: "Tenant searches", href: self({ tab: undefined, status: undefined, partner: undefined, env: undefined, kind: undefined }), on: tab === "searches", count: unmatched.length || undefined },
            { key: "partners", label: "Partner brokers", href: self({ tab: "partners", status: undefined, open: undefined, env: undefined, kind: undefined }), on: tab === "partners", count: toVerify.length || undefined },
            { key: "guides", label: "Guide leads", href: self({ tab: "guides", status: undefined, open: undefined, partner: undefined, env: undefined, kind: undefined }), on: tab === "guides", count: freshGuides.length || undefined },
            { key: "agreements", label: "Agreements", href: self({ tab: "agreements", status: undefined, open: undefined, partner: undefined }), on: tab === "agreements", count: waitingSign.length || undefined },
            { key: "fees", label: "Referral fees", href: self({ tab: "fees", status: undefined, open: undefined, partner: undefined, env: undefined, kind: undefined }), on: tab === "fees", count: toInvoice.length || undefined },
            { key: "settings", label: "Terms & licence", href: self({ tab: "settings", status: undefined, open: undefined, partner: undefined, env: undefined, kind: undefined }), on: tab === "settings" },
          ]}
          quick={{
            title: "Jump to",
            items: [
              {
                label: `${toVerify.length} to verify & countersign`,
                href: self({ tab: "partners", status: "verifying" }),
                mark: (
                  <MarkTile bg={toVerify.length ? "#c4892a" : undefined}>
                    <Icon name="shield" size={14} />
                  </MarkTile>
                ),
              },
              {
                label: `${unmatched.length} without a broker`,
                href: self({ tab: undefined, status: "matching" }),
                mark: (
                  <MarkTile bg={unmatched.length ? "#a93a28" : undefined}>
                    <Icon name="search" size={14} />
                  </MarkTile>
                ),
              },
              {
                label: `${freshGuides.length} guide leads to call`,
                href: self({ tab: "guides", status: "new" }),
                mark: (
                  <MarkTile bg={freshGuides.length ? "#2b6b55" : undefined}>
                    <Icon name="mail" size={14} />
                  </MarkTile>
                ),
              },
              {
                label: `${waitingSign.length} agreements waiting 3+ days`,
                href: self({ tab: "agreements" }),
                mark: (
                  <MarkTile bg="#2b6b55">
                    <Icon name="handshake" size={14} />
                  </MarkTile>
                ),
              },
            ],
          }}
        />

        <div className="dk-stack">
          {tab === "searches" ? (
            <>
              {statusFilter ? (
                <div className="dk-inline">
                  <Chip tone="brand">Showing: {SEARCH_STAGE[statusFilter].label}</Chip>
                  <Link prefetch={false} className="dk-btn dk-btn--ghost dk-btn--sm" href={self({ status: undefined })} scroll={false}>
                    Show every stage
                  </Link>
                </div>
              ) : null}
              {cards.length ? (
                <Board
                  mode="search"
                  columns={BOARD_STAGES.filter((k) => !statusFilter || k === statusFilter).map((k) => ({ key: k, label: SEARCH_STAGE[k].label, hint: SEARCH_STAGE[k].hint, tone: SEARCH_STAGE[k].tone }))}
                  cards={cards}
                  empty="Drop a search here"
                />
              ) : (
                <Panel>
                  <Empty title={statusFilter ? "Nothing at this stage." : "No tenant searches yet."}>
                    They arrive from rentleaks.com/hire-a-broker/. Recruit a few brokers first so every search gets proposals within hours.
                    <div className="dk-inline" style={{ marginTop: 12 }}>
                      <a className="dk-btn dk-btn--primary" href={PUBLIC_URL} target="_blank" rel="noopener noreferrer">
                        <Icon name="external" size={14} /> Open the tenant page
                      </a>
                      <Link prefetch={false} className="dk-btn" href={self({ tab: "partners" })}>
                        <Icon name="plus" size={14} /> Invite a broker
                      </Link>
                    </div>
                  </Empty>
                </Panel>
              )}
              <div className="dk-grid dk-grid--2">
                <Panel kicker="90 days" title="From brief to lease">
                  <FunnelLanes
                    stages={[
                      { label: "Briefs", value: r90.length },
                      { label: "Proposal received", value: withProposal.length },
                      { label: "Broker chosen", value: chosen90.length },
                      { label: "Agreement signed", value: signed90.length },
                      { label: "Leased", value: leased90.length },
                    ]}
                  />
                </Panel>
                <Panel kicker="90 days" title="What tenants look for">
                  <Donut items={byHome} centerLabel="BRIEFS" />
                </Panel>
              </div>
              <Panel kicker="90 days" title="Demand by city" sub="The number after each city is how many active brokers cover it — recruit where it's zero.">
                <RankedBars
                  rows={[...byCity.entries()]
                    .sort((a, b) => b[1].n - a[1].n)
                    .slice(0, 10)
                    .map(([k, v]) => {
                      const c = coverage(k.split(",")[0], v.state);
                      return { key: k, label: `${k} · ${c} broker${c === 1 ? "" : "s"}`, value: v.n };
                    })}
                  empty="No briefs yet."
                />
              </Panel>
            </>
          ) : null}

          {tab === "partners" ? (
            <>
              <PartnersView partners={partners} self={self} status={p.status && (PARTNER_STATUSES as readonly string[]).includes(p.status) ? p.status : ""} />
              <RosterPanel cards={rosterCards} partners={partners} self={self} slots={ROSTER_SLOTS} />
            </>
          ) : null}
          {tab === "guides" ? (
            <>
              <GuidesView
                leads={guideLeads}
                self={self}
                now={t}
                audience={p.audience === "tenant" || p.audience === "partner" ? p.audience : ""}
                status={["new", "contacted", "converted", "closed", "spam"].includes(p.status) ? p.status : ""}
              />
              <GuideSources leads={guideLeads} />
              <Panel kicker="What they downloaded" title={`The ${GUIDES.length} guides`} sub="Built from tools/guides/*.json by tools/build-guides.py, and offered at rentleaks.com/hire-a-broker/guide.html.">
                <div className="dk-grid dk-grid--2">
                  {GUIDES.map((g) => (
                    <div key={g.id}>
                      <h3 className="rf-h3">{g.title}</h3>
                      <p className="dk-muted">{g.tagline}</p>
                      <p className="dk-dim">
                        {g.pages} pages · for {g.audience === "tenant" ? "renters" : "agents"} · {guideLeads.filter((l) => l.guideId === g.id && l.status !== "spam").length} downloads
                      </p>
                      <a className="dk-btn dk-btn--ghost dk-btn--sm" href={`/guides/${g.file}`} target="_blank" rel="noopener noreferrer">
                        <Icon name="external" size={13} /> Open the PDF
                      </a>
                    </div>
                  ))}
                </div>
              </Panel>
            </>
          ) : null}
          {tab === "agreements" ? <AgreementsView envs={envs} self={self} kind={p.kind === "tenant_rep" || p.kind === "partner_referral" ? p.kind : ""} /> : null}
          {tab === "fees" ? <FeesView deals={deals} self={self} founder={founder} canBooks={canBooks} /> : null}
          {tab === "settings" ? <SettingsView settings={settings} referrer={ref} founder={founder} self={self} /> : null}
        </div>
      </div>

      {openSearch ? (
        <SearchDrawer
          s={openSearch}
          self={self}
          now={t}
          candidates={candidates}
          env={openSearch.agreementId ? (envById.get(openSearch.agreementId) ?? null) : null}
          deal={deals.find((d) => d.searchId === openSearch.id) ?? null}
          contactId={contact?.id ?? null}
          founder={founder}
          me={{ name: me.name }}
          room={roomLink(openSearch)}
        />
      ) : null}
      {openLead ? <GuideDrawer l={openLead} self={self} now={t} founder={founder} me={{ name: me.name }} /> : null}
      {openPartner ? <PartnerDrawer p={openPartner} self={self} now={t} offers={partnerOffers} founder={founder} me={{ name: me.name }} referrerOk={ref.complete} events={partnerEvents} /> : null}
      {envFull ? (
        <AgreementDrawer
          env={envFull}
          self={self}
          founder={founder}
          links={{
            search: envFull.searchId ? self({ env: undefined, tab: undefined, open: envFull.searchId }) : undefined,
            partner: envFull.partnerId ? self({ env: undefined, tab: "partners", partner: envFull.partnerId }) : undefined,
          }}
        />
      ) : null}
    </div>
  );
}
