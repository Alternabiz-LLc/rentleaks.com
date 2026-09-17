import Link from "next/link";
import ModerationQueue, { type QueueItem } from "@/components/ModerationQueue";
import { Columns, Donut, FunnelLanes, Gauge, Kpi, RankedBars, TrendArea } from "@/components/admin/desk/charts";
import { DeskHeader } from "@/components/admin/desk/DeskHeader";
import { Icon } from "@/components/admin/desk/Icon";
import { NextBest } from "@/components/admin/desk/NextBest";
import { ago, Chip, GradeChip, Panel } from "@/components/admin/desk/parts";
import { flashOf, readParams, type SP } from "@/components/admin/ui";
import { accessKeyForPath, canAccess, isFounder, type AccessKey } from "@/lib/access";
import { loadNextActions } from "@/lib/admin/copilot";
import { requireAdminPage } from "@/lib/admin/guard";
import { bucketWeeks, lastWeeks, nowMs, recurringMonthly } from "@/lib/admin/metrics";
import { scoreLead } from "@/lib/admin/score";
import { KIND_LABEL as LEAD_KIND_LABEL, type LeadKind } from "@/lib/leads";
import { checkListing, type Fee } from "@/lib/listing-rules";
import { prisma } from "@/lib/prisma";
import { fmtMoney, typeLabel } from "@/lib/site";

export const metadata = { title: "Founder desk — RentLeaks" };

const DAY = 86_400_000;

const SOURCE_LABEL: Record<string, string> = {
  fb_page: "Facebook Page",
  fb_button: "Facebook button",
  fb_post: "Facebook post",
  fb_ad: "Facebook ad",
  messenger: "Messenger",
  instagram: "Instagram",
  web: "Website",
};

const ACTIVITY_ICON: Record<string, { icon: "mail" | "phone" | "leads" | "crm" | "ticket" | "accounts" | "check" | "outreach"; tone?: string }> = {
  email: { icon: "mail" },
  call: { icon: "phone" },
  sms: { icon: "outreach" },
  lead: { icon: "leads", tone: "good" },
  stage: { icon: "crm" },
  trial: { icon: "ticket", tone: "value" },
  signup: { icon: "accounts", tone: "good" },
  campaign: { icon: "mail", tone: "value" },
  note: { icon: "check" },
  meeting: { icon: "phone" },
};

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * The founder desk overview: the overnight watch, Next-best actions, the KPI
 * bento, lead activity, conversion gauges, the feed, the review queue and the
 * compliance checks — everything across every account.
 *
 * Two things it deliberately does not show: identity documents (status only —
 * the documents are matched and discarded) and renter contact details outside
 * the lead they were given in.
 */
export default async function AdminPage({ searchParams }: { searchParams: SP }) {
  const me = await requireAdminPage();
  const p = await readParams(searchParams);
  const can = (k: AccessKey) => canAccess(me, k);
  const founder = isFounder(me);
  /* Employees see the parts of the book their access covers — and the queries
     for the rest never run. */
  const allowedHref = (href: string) => {
    const k = accessKeyForPath(href);
    return !k || can(k);
  };
  const now = new Date();
  const t = nowMs();
  const weekAgo = new Date(t - 7 * DAY);
  const since30 = new Date(t - 30 * DAY);
  const weeks = lastWeeks(12, now);
  const since12w = new Date(`${weeks[0]}T00:00:00Z`);
  const safe = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback);

  const seesCatalogue = can("listings") || can("markets") || can("revenue");
  const [listings, users, cities, allActions] = await Promise.all([
    seesCatalogue
      ? prisma.listing.findMany({
          include: { city: true, host: { select: { name: true, identity: true } } },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    can("accounts") ? prisma.user.findMany({ include: { identity: true }, orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
    can("markets") ? prisma.city.findMany({ orderBy: { rank: "asc" } }) : Promise.resolve([]),
    loadNextActions(now),
  ]);
  const actions = allActions.filter((a) => allowedHref(a.href));
  const none = <T,>(v: T) => Promise.resolve(v);

  const [leads30, leads12w, recentLeads, followUps, openReports, sending, trialsActive, trialsEnding, contacts, subscribers, activity, adminLog, failedPosts, manualDue] =
    await Promise.all([
      can("leads") ? safe(prisma.lead.findMany({ where: { createdAt: { gte: since30 } }, select: { createdAt: true, status: true, kind: true, source: true, contactedAt: true } }), []) : none([]),
      can("leads") ? safe(prisma.lead.findMany({ where: { createdAt: { gte: since12w } }, select: { createdAt: true } }), []) : none([]),
      can("leads") ? safe(prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { listing: { select: { title: true } } } }), []) : none([]),
      can("crm") ? safe(prisma.contact.count({ where: { nextFollowUpAt: { lte: now } } }), 0) : none(0),
      can("reports") ? safe(prisma.report.count({ where: { status: "open" } }), 0) : none(0),
      can("campaigns") ? safe(prisma.campaign.count({ where: { status: { in: ["sending", "scheduled"] } } }), 0) : none(0),
      can("trials") || can("accounts") ? safe(prisma.user.count({ where: { trialEndsAt: { gt: now } } }), 0) : none(0),
      can("trials") ? safe(prisma.user.count({ where: { trialEndsAt: { gt: now, lte: new Date(t + 3 * DAY) } } }), 0) : none(0),
      can("crm") ? safe(prisma.contact.count(), 0) : none(0),
      can("campaigns") ? safe(prisma.contact.count({ where: { marketingConsent: true, unsubscribedAt: null, confirmToken: null } }), 0) : none(0),
      can("crm") ? safe(prisma.contactActivity.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { contact: { select: { id: true, name: true, email: true } } } }), []) : none([]),
      founder ? safe(prisma.adminAction.findMany({ orderBy: { createdAt: "desc" }, take: 6 }), []) : none([]),
      can("social") ? safe(prisma.socialPost.count({ where: { status: "failed" } }), 0) : none(0),
      can("social") ? safe(prisma.socialPost.count({ where: { status: "scheduled", scheduledAt: { lte: now }, channel: { not: "facebook" } } }), 0) : none(0),
    ]);

  const signupsWeek = users.filter((u) => u.createdAt >= weekAgo).length;
  const live = listings.filter((l) => l.status === "active" && (l.moderation ?? "approved") === "approved");
  const sponsored = listings.filter((l) => l.sponsored);
  const monthly = recurringMonthly(listings.filter((l) => (l.moderation ?? "approved") === "approved"));
  const newLeads = leads30.filter((l) => l.status === "new").length;
  const waiting = leads30.filter((l) => l.status === "new" && t - l.createdAt.getTime() > DAY).length;
  const leadsWeek = leads30.filter((l) => l.createdAt >= weekAgo).length;
  const leadsPrevWeek = leads30.filter((l) => l.createdAt < weekAgo && l.createdAt >= new Date(t - 14 * DAY)).length;
  const weekTrend = leadsPrevWeek ? Math.round(((leadsWeek - leadsPrevWeek) / leadsPrevWeek) * 100) : null;
  const answered = leads30.filter((l) => l.status !== "new" && l.status !== "spam").length;
  const booked = leads30.filter((l) => l.status === "booked").length;
  const real = leads30.filter((l) => l.status !== "spam").length;

  /* Same gate as the composer, re-run over stored rows. */
  const reviewed = listings.map((l) => {
    let fees: Fee[] = [];
    try {
      const parsed = JSON.parse(l.feesJson) as unknown;
      if (Array.isArray(parsed)) fees = parsed as Fee[];
    } catch {
      fees = [];
    }
    const detail = (l.detail ?? {}) as { photos?: unknown };
    const checks = checkListing({
      role: l.listedBy,
      housingType: l.housingType,
      cityId: l.cityId,
      citySlug: l.city.slug,
      cityName: l.city.name,
      state: l.city.state,
      country: l.city.country,
      title: l.title,
      neighborhood: l.neighborhood,
      address: l.address,
      description: l.description,
      price: l.price,
      deposit: l.deposit,
      fees,
      availableFrom: l.availableFrom,
      availableUntil: l.availableUntil || "",
      minStayMonths: l.minStayMonths,
      maxStayMonths: l.maxStayMonths,
      leaseEnd: l.leaseEnd || undefined,
      consentStatus: l.consentStatus || undefined,
      registrationNumber: l.registrationNumber || undefined,
      photoCount: Array.isArray(detail.photos) ? detail.photos.length : l.image ? 1 : 0,
    });
    return { listing: l, fees, checks, blocked: checks.filter((c) => c.blocking && !c.ok), warned: checks.filter((c) => !c.blocking && !c.ok) };
  });
  const failing = reviewed.filter((x) => x.blocked.length);

  /* The queue, oldest first. */
  const queue: QueueItem[] = reviewed
    .filter((x) => (x.listing.moderation ?? "approved") === "pending")
    .reverse()
    .map(({ listing: l, fees, blocked, warned }) => {
      const detail = (l.detail ?? {}) as { photos?: unknown; images?: unknown };
      const shots = Array.isArray(detail.photos)
        ? (detail.photos as unknown[]).filter((p): p is string => typeof p === "string")
        : Array.isArray(detail.images)
          ? (detail.images as unknown[]).filter((p): p is string => typeof p === "string")
          : [];
      return {
        id: l.id,
        title: l.title,
        href: `/listings/${l.id}`,
        cityName: l.city.name,
        typeLabel: typeLabel(l.housingType),
        hostName: l.host.name,
        hostVerified: l.host.identity?.status === "verified",
        listedBy: l.listedBy,
        price: fmtMoney(l.price, l.currency),
        allIn: fmtMoney(l.allIn, l.currency),
        deposit: l.deposit ? fmtMoney(l.deposit, l.currency) : "None",
        feeLines: fees.map((f) => `${f.type}: ${fmtMoney(f.amount, l.currency)}${f.cadence === "monthly" ? " /mo" : " once"}`),
        photos: shots.length ? shots : l.image ? [l.image] : [],
        availableFrom: l.availableFrom,
        availableUntil: l.availableUntil,
        createdAt: l.createdAt.toISOString().slice(0, 10),
        moderation: l.moderation ?? "approved",
        moderationNote: l.moderationNote ?? null,
        blockers: blocked.map((c) => c.title),
        warnings: warned.map((c) => c.title),
      };
    });

  const unverifiedHosts = users.filter((u) => u.role !== "renter" && (!u.identity || u.identity.status !== "verified"));

  const byMarket = cities
    .map((c) => {
      const mine = listings.filter((l) => l.cityId === c.id);
      return {
        id: c.id,
        name: c.name,
        country: c.country,
        total: mine.length,
        live: mine.filter((l) => l.status === "active").length,
        sponsored: mine.filter((l) => l.sponsored).length,
        noWindow: mine.filter((l) => !l.availableUntil).length,
        breaching: failing.filter((f) => f.listing.cityId === c.id).length,
      };
    })
    .filter((m) => m.total > 0)
    .sort((a, b) => b.total - a.total);

  /* Charts */
  const days = Array.from({ length: 14 }, (_, i) => dayKey(new Date(t - (13 - i) * DAY)));
  const trend = days.map((d) => ({
    label: new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
    a: leads30.filter((l) => dayKey(l.createdAt) === d).length,
    b: leads30.filter((l) => l.contactedAt && dayKey(l.contactedAt) === d).length,
  }));
  const trendTotal = trend.reduce((n, p) => n + p.a, 0);
  const kinds = (["stay", "viewing", "match"] as LeadKind[]).map((k) => ({
    label: LEAD_KIND_LABEL[k],
    value: leads30.filter((l) => l.kind === k).length,
    href: `/admin/leads?kind=${k}`,
  }));
  const sources = [...new Set(leads30.map((l) => l.source))]
    .map((s) => ({ key: s, label: SOURCE_LABEL[s] ?? s, value: leads30.filter((l) => l.source === s).length, href: `/admin/leads?source=${s}` }))
    .sort((a, b) => b.value - a.value);
  const leadSpark = bucketWeeks(leads12w.map((l) => l.createdAt), weeks).map((w) => w.count);
  const signupSpark = bucketWeeks(users.filter((u) => u.createdAt >= since12w).map((u) => u.createdAt), weeks).map((w) => w.count);
  const listingSpark = bucketWeeks(listings.filter((l) => l.createdAt >= since12w).map((l) => l.createdAt), weeks).map((w) => w.count);
  const types = ["room", "coliving", "furnished", "short-term", "aparthotel", "lease-break"].map((ty) => ({
    label: typeLabel(ty).replace(/ \(.*\)/, ""),
    value: listings.filter((l) => l.housingType === ty).length,
    href: `/admin/listings?type=${ty}`,
  }));

  // When leads arrive, in the founder's time (Brooklyn).
  const hours = new Array(24).fill(0) as number[];
  for (const l of leads30) {
    const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/New_York" }).format(l.createdAt));
    if (Number.isFinite(h)) hours[h % 24] += 1;
  }
  const peak = hours.indexOf(Math.max(...hours));
  const peakLabel = leads30.length ? `${peak % 12 || 12}:00 ${peak >= 12 ? "PM" : "AM"}` : "—";

  const watch = [
    { key: "leads" as AccessKey, n: waiting, tone: "bad", label: "Leads waiting over a day", sub: "A renter who waits books elsewhere", href: "/admin/leads?status=new&sort=oldest" },
    { key: "listings" as AccessKey, n: queue.length, tone: "", label: "Listings awaiting review", sub: "Nothing reaches renters until approved", href: "/admin/listings?moderation=pending&view=board" },
    { key: "reports" as AccessKey, n: openReports, tone: "bad", label: "Open safety reports", sub: "Oldest first", href: "/admin/reports" },
    { key: "crm" as AccessKey, n: followUps, tone: "", label: "Follow-ups due", sub: "Contacts you promised to get back to", href: "/admin/crm?due=1" },
    { key: "trials" as AccessKey, n: trialsEnding, tone: "brand", label: "Free weeks ending in 3 days", sub: "Nudge them to list or keep listing", href: "/admin/trials" },
    { key: "social" as AccessKey, n: manualDue + failedPosts, tone: "brand", label: "Social posts to handle", sub: `${manualDue} due to copy · ${failedPosts} failed`, href: "/admin/social?tab=queue" },
  ].filter((w) => can(w.key));
  const urgent = watch.filter((w) => w.n > 0);

  const feed = [
    ...activity.map((a) => ({
      key: `a-${a.id}`,
      at: a.createdAt,
      title: a.subject || a.kind,
      sub: a.contact.name || a.contact.email,
      href: `/admin/crm/${a.contact.id}`,
      icon: ACTIVITY_ICON[a.kind] ?? { icon: "check" as const },
    })),
    ...adminLog.map((a) => ({
      key: `x-${a.id}`,
      at: a.createdAt,
      title: a.action.replace(/\./g, " · "),
      sub: `${a.targetType}${a.targetId ? ` ${a.targetId.slice(0, 18)}` : ""}`,
      href: "/admin/system#audit",
      icon: { icon: "check" as const, tone: "value" },
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 12);

  return (
    <div className="dk-stack">
      <DeskHeader
        href="/admin"
        title={founder ? "Founder desk" : `Welcome, ${me.name.split(/\s+/)[0]}`}
        brief={founder ? undefined : "Your part of the book: what's waiting, what's due, and the best next move."}
        flash={flashOf(p)}
        signals={(
          [
            { key: "leads", label: "New leads", value: `${newLeads} · ${waiting} waiting`, tone: waiting ? "critical" : "live", href: "/admin/leads?status=new" },
            { key: "listings", label: "Awaiting review", value: `${queue.length} listings`, tone: queue.length ? "warn" : "ok", href: "/admin/listings?moderation=pending&view=board" },
            { key: "overview", label: "Next best moves", value: `${actions.length} ranked`, tone: "ok", href: "#next-best" },
            { key: "revenue", label: "Recurring", value: `$${Math.round(monthly).toLocaleString("en-US")}/mo`, tone: "ok", href: "/admin/revenue" },
          ] as const
        )
          .filter((x) => can(x.key))
          .map((x) => ({ label: x.label, value: x.value, tone: x.tone, href: x.href }))}
        actions={
          <>
            <Link prefetch={false} className="dk-btn dk-btn--onink" href="/admin">
              Refresh
            </Link>
            {can("leads") ? (
              <Link prefetch={false} className="dk-btn dk-btn--light" href="/admin/leads?view=board">
                <Icon name="board" size={15} /> Lead board
              </Link>
            ) : null}
          </>
        }
      />

      <Panel kicker="Overnight watch" title={urgent.length ? `${urgent.length} thing${urgent.length === 1 ? "" : "s"} need you` : "All clear"} sub="What moved since you last looked, and where to go about it.">
        <ul className="dk-watch dk-grid dk-grid--3">
          {watch.map((w) => (
            <li key={w.label} className={w.n ? undefined : "is-clear"}>
              <Link prefetch={false} href={w.href}>
                <span className={`dk-watch__n${w.n ? (w.tone ? ` dk-watch__n--${w.tone}` : "") : " dk-watch__n--good"}`}>{w.n || "✓"}</span>
                <span>
                  <b>{w.label}</b>
                  <small>{w.n ? w.sub : "Clear"}</small>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel id="next-best" kicker="Next best actions" title="Today's best moves" sub="Ranked from the book: who is waiting, what is due, and where the money is. Drafts open ready to edit and send." actions={<Chip tone="brand">{actions.length} ranked</Chip>}>
        <NextBest actions={actions} />
      </Panel>

      <div className="dk-kpis">
        {can("leads") ? <Kpi label="New leads" value={newLeads} sub={`${leadsWeek} this week${weekTrend !== null ? ` · ${weekTrend >= 0 ? "+" : ""}${weekTrend}% vs last` : ""}`} href="/admin/leads?status=new" spark={leadSpark} tone={waiting ? "alert" : undefined} /> : null}
        {can("crm") ? <Kpi label="Follow-ups due" value={followUps} sub={`${contacts.toLocaleString("en-US")} contacts`} href="/admin/crm?due=1" /> : null}
        {can("listings") ? <Kpi label="Awaiting review" value={queue.length} sub={`${listings.filter((l) => l.moderation === "declined").length} declined`} href="/admin/listings?moderation=pending&view=board" /> : null}
        {can("reports") ? <Kpi label="Open reports" value={openReports} sub="trust & safety" href="/admin/reports" tone={openReports ? "alert" : undefined} /> : null}
        {can("accounts") ? <Kpi label="Accounts" value={users.length} sub={`${signupsWeek} new this week · ${trialsActive} on trial`} href="/admin/accounts" spark={signupSpark} /> : null}
        {can("listings") ? <Kpi label="Live listings" value={live.length} sub={`${listings.length} total · ${sponsored.length} sponsored`} href="/admin/listings?status=active" spark={listingSpark} /> : null}
        {can("campaigns") ? <Kpi label="Subscribers" value={subscribers} sub={`${sending} campaign${sending === 1 ? "" : "s"} going out`} href="/admin/campaigns" tone="good" /> : null}
        {can("revenue") ? <Kpi label="Recurring" value={Math.round(monthly)} fmt="usd" sub="per month at posted rates" href="/admin/revenue" tone="value" /> : null}
      </div>

      <div className="dk-toolbar__group">
        {can("leads") ? (
  <Link prefetch={false} className="dk-btn dk-btn--primary" href="/admin/leads?view=board">
          <Icon name="leads" size={15} /> Leads →
        </Link>
        ) : null}
        {can("crm") ? (
  <Link prefetch={false} className="dk-btn" href="/admin/crm?view=board">
          <Icon name="crm" size={15} /> CRM board
        </Link>
        ) : null}
        {can("campaigns") ? (
  <Link prefetch={false} className="dk-btn" href="/admin/campaigns#new">
          <Icon name="mail" size={15} /> New campaign
        </Link>
        ) : null}
        {can("social") ? (
  <Link prefetch={false} className="dk-btn" href="/admin/social?tab=compose">
          <Icon name="social" size={15} /> Schedule posts
        </Link>
        ) : null}
        {can("trials") ? (
  <Link prefetch={false} className="dk-btn" href="/admin/trials#invite">
          <Icon name="ticket" size={15} /> Invite hosts
        </Link>
        ) : null}
        {can("revenue") ? (
  <Link prefetch={false} className="dk-btn" href="/admin/revenue">
          <Icon name="revenue" size={15} /> Analytics
        </Link>
        ) : null}
      </div>

      {can("leads") ? (
      <div className="dk-grid dk-grid--2-1">
        <Panel
          title="Lead activity — last 14 days"
          sub={`${trendTotal} leads · peak ${trend.reduce((b, p) => (p.a > b.a ? p : b), trend[0]).label}`}
          actions={<Chip tone="brand">received vs answered</Chip>}
        >
          <TrendArea points={trend} aLabel="received" bLabel="answered" />
        </Panel>
        <Panel title="Leads by kind" sub="Last 30 days" actions={<Link prefetch={false} href="/admin/leads">View all →</Link>}>
          <Donut items={kinds} centerLabel="LEADS · 30D" />
        </Panel>
      </div>
      ) : null}

      {can("leads") || can("listings") ? (
      <div className="dk-grid dk-grid--4">
        {can("leads") ? (
          <>
            <Panel>
              <Gauge pct={real ? (answered / real) * 100 : 0} label="Reply rate" sub={`${answered} of ${real} leads answered · 30d`} />
            </Panel>
            <Panel>
              <Gauge pct={real ? (booked / real) * 100 : 0} label="Booking rate" sub={`${booked} booked · 30d`} />
            </Panel>
          </>
        ) : null}
        {can("listings") ? (
          <Panel className="dk-span-2" title="Catalogue by type" actions={<Link prefetch={false} href="/admin/listings">Listings →</Link>}>
            <Columns rows={types} height={150} />
          </Panel>
        ) : null}
      </div>
      ) : null}

      {can("leads") ? (
      <Panel
        title="Peak lead hour"
        sub="When leads arrive over the last 30 days, New York time. Be at the desk then — the first reply wins the booking."
        actions={
          <span className="dk-bigstat">
            <b>{peakLabel}</b>
          </span>
        }
      >
        <Columns rows={hours.map((v, h) => ({ label: h % 3 === 0 ? `${h % 12 || 12}${h >= 12 ? "p" : "a"}` : "", value: v }))} height={110} />
      </Panel>
      ) : null}

      <div className="dk-grid dk-grid--2">
        {feed.length || can("crm") || founder ? (
        <Panel title="Recent activity" sub="Timeline entries and founder actions, newest first." actions={founder ? <Link prefetch={false} href="/admin/system#audit">Audit log →</Link> : undefined}>
          {feed.length === 0 ? (
            <p className="dk-empty">Nothing yet.</p>
          ) : (
            <ul className="dk-feed">
              {feed.map((f) => (
                <li key={f.key}>
                  <span className={`dk-feed__icon${f.icon.tone ? ` dk-feed__icon--${f.icon.tone}` : ""}`}>
                    <Icon name={f.icon.icon} size={15} />
                  </span>
                  <div>
                    <Link prefetch={false} href={f.href}>
                      <b>{f.title}</b>
                    </Link>
                    <p>{f.sub}</p>
                  </div>
                  <time dateTime={f.at.toISOString()}>{ago(t - f.at.getTime())}</time>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        ) : null}
        {can("leads") ? (
        <Panel title="Leads by source" sub="Last 30 days — click a source to filter the inbox." actions={can("ads") ? <Link prefetch={false} href="/admin/ads">Paid ads →</Link> : undefined}>
          <RankedBars rows={sources} empty="No leads in the last 30 days." />
          <div style={{ marginTop: 18 }}>
            <FunnelLanes
              stages={[
                { label: "Received", value: real, href: "/admin/leads" },
                { label: "Answered", value: answered, href: "/admin/leads?status=contacted" },
                { label: "Booked", value: booked, href: "/admin/leads?status=booked" },
              ]}
            />
          </div>
        </Panel>
        ) : null}
      </div>

      {can("listings") ? (
      <Panel
        id="review"
        kicker="Moderation"
        title={`Waiting on review${queue.length ? ` · ${queue.length}` : ""}`}
        sub="Nothing reaches renters until it is approved here. Decline needs a reason and the seller is shown it verbatim."
        actions={
          <Link prefetch={false} className="dk-btn dk-btn--sm" href="/admin/listings?moderation=pending&view=board">
            <Icon name="board" size={14} /> Review board
          </Link>
        }
      >
        <div className="dk-queue-host">
          <ModerationQueue items={queue} />
        </div>
      </Panel>
      ) : null}

      <div className="dk-grid dk-grid--2">
        {can("listings") ? (
        <Panel title="Listings breaching their market" sub="The composer's gate, re-run against what is stored — anything written before a rule shifted surfaces here.">
          {failing.length === 0 ? (
            <p className="dk-empty">Nothing breaching. Every stored listing passes the gate for its own market.</p>
          ) : (
            <ul className="dk-feed">
              {failing.slice(0, 12).map(({ listing, blocked }) => (
                <li key={listing.id}>
                  <span className="dk-feed__icon dk-feed__icon--bad">
                    <Icon name="flag" size={15} />
                  </span>
                  <div>
                    <Link prefetch={false} href={`/admin/listings?q=${encodeURIComponent(listing.id)}`}>
                      <b>{listing.title}</b>
                    </Link>
                    <p>
                      {listing.city.name} · {blocked.map((b) => b.title).join(" · ")}
                    </p>
                  </div>
                  <time />
                </li>
              ))}
            </ul>
          )}
          {failing.length > 12 ? <p className="dk-hint">…and {failing.length - 12} more.</p> : null}
        </Panel>
        ) : null}
        {can("accounts") ? (
        <Panel title="Sellers without verification" sub="Status only. The documents are matched and discarded, so there is nothing here to open.">
          {unverifiedHosts.length === 0 ? (
            <p className="dk-empty">Every seller account is verified.</p>
          ) : (
            <ul className="dk-feed">
              {unverifiedHosts.slice(0, 12).map((u) => (
                <li key={u.id}>
                  <span className="dk-feed__icon dk-feed__icon--value">
                    <Icon name="accounts" size={15} />
                  </span>
                  <div>
                    <Link prefetch={false} href={`/admin/accounts?q=${encodeURIComponent(u.email)}`}>
                      <b>{u.name}</b>
                    </Link>
                    <p>
                      {u.identity?.status || "no verification started"} · {listings.filter((l) => l.hostId === u.id).length} listings
                    </p>
                  </div>
                  <time />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        ) : null}
      </div>

      {can("markets") ? (
      <Panel flush title="Markets" sub="“No end date” is the column to watch: without one a listing cannot answer a date-range search." actions={<Link prefetch={false} href="/admin/markets">Markets →</Link>}>
        <div className="dk-tablewrap">
          <table className="dk-table">
            <thead>
              <tr>
                <th>Market</th>
                <th className="dk-right">Listings</th>
                <th className="dk-right">Live</th>
                <th className="dk-right">Sponsored</th>
                <th className="dk-right">No end date</th>
                <th className="dk-right">Breaching</th>
              </tr>
            </thead>
            <tbody>
              {byMarket.slice(0, 14).map((m) => (
                <tr key={m.id}>
                  <td>
                    <Link prefetch={false} href={`/admin/listings?city=${m.id}`}>{m.name}</Link> <span className="dk-dim">{m.country}</span>
                  </td>
                  <td className="dk-right">{m.total}</td>
                  <td className="dk-right">{m.live}</td>
                  <td className="dk-right">{m.sponsored || "—"}</td>
                  <td className={`dk-right${m.noWindow ? " dk-warn" : ""}`}>{m.noWindow || "—"}</td>
                  <td className={`dk-right${m.breaching ? " dk-bad" : ""}`}>{m.breaching || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      ) : null}

      {can("leads") ? (
      <Panel flush title="Recent leads" actions={<Link prefetch={false} href="/admin/leads">View all →</Link>}>
        <div className="dk-tablewrap">
          <table className="dk-table">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Kind</th>
                <th>Home</th>
                <th>Source</th>
                <th>Status</th>
                <th>Score</th>
                <th className="dk-right">Received</th>
              </tr>
            </thead>
            <tbody>
              {recentLeads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="dk-dim">
                    No leads yet — they arrive from rentleaks.com/facebook.html and the other public forms.
                  </td>
                </tr>
              ) : null}
              {recentLeads.map((l) => (
                <tr key={l.id}>
                  <td className="dk-wrap">
                    <Link prefetch={false} href={`/admin/leads?open=${l.id}`}>
                      <b>{l.name}</b>
                    </Link>
                    <div className="dk-dim">{l.email}</div>
                  </td>
                  <td>{LEAD_KIND_LABEL[l.kind as LeadKind] ?? l.kind}</td>
                  <td className="dk-wrap">{l.listing?.title ?? "—"}</td>
                  <td>{SOURCE_LABEL[l.source] ?? l.source}</td>
                  <td>
                    <Chip tone={l.status === "new" ? "brand" : l.status === "booked" ? "good" : l.status === "spam" ? "bad" : "ink"}>{l.status}</Chip>
                  </td>
                  <td>
                    <GradeChip score={scoreLead(l, t).score} />
                  </td>
                  <td className="dk-right dk-dim">{ago(t - l.createdAt.getTime())}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      ) : null}
    </div>
  );
}
