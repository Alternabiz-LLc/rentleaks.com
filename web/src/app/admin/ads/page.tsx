import Link from "next/link";
import type { AdCampaign } from "@prisma/client";
import { deleteAd, saveAd } from "@/app/admin/_actions/ads";
import { Columns, Donut, FunnelLanes, Kpi, RankedBars } from "@/components/admin/desk/charts";
import { DeskHeader } from "@/components/admin/desk/DeskHeader";
import { Icon } from "@/components/admin/desk/Icon";
import { Chip, CommandRail, Empty, Panel, Steps, ViewSwitch } from "@/components/admin/desk/parts";
import { flashOf, qs, readParams, when, type SP } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";
import { nowMs } from "@/lib/admin/metrics";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Paid ads — RentLeaks desk" };

const DAY = 86_400_000;
const TABS = ["overview", "create", "campaigns", "attribution", "flight", "platforms"] as const;
type Tab = (typeof TABS)[number];

const PLATFORMS = ["meta", "google", "tiktok", "reddit", "other"] as const;
type Platform = (typeof PLATFORMS)[number];

const PLATFORM: Record<Platform, { label: string; bg: string; letter: string; manager?: string; managerLabel?: string; note: string }> = {
  meta: {
    label: "Meta (Facebook · Instagram)",
    bg: "#1f4fbf",
    letter: "f",
    manager: "https://adsmanager.facebook.com/",
    managerLabel: "Ads Manager",
    note: "Housing ads must use the Special Ad Category “Housing”. Catalog feed below powers Advantage+ ads.",
  },
  google: { label: "Google Ads", bg: "linear-gradient(135deg,#1a73e8,#34a853)", letter: "G", manager: "https://ads.google.com/", managerLabel: "Google Ads", note: "Housing is a personalized-ads restricted category — no targeting by age, gender, family status or ZIP." },
  tiktok: { label: "TikTok Ads", bg: "#111827", letter: "TT", manager: "https://ads.tiktok.com/", managerLabel: "TikTok Ads Manager", note: "Use the tracking link as the landing page; TikTok passes it through unchanged." },
  reddit: { label: "Reddit Ads", bg: "#e5461b", letter: "R", manager: "https://ads.reddit.com/", managerLabel: "Reddit Ads", note: "City subreddits convert best with a plain, price-first headline." },
  other: { label: "Other / offline", bg: "#56696f", letter: "•", note: "Flyers, newsletters, sponsorships — anything you pay for that sends people to a link." },
};

const STATUS_TONE: Record<string, "" | "good" | "warn" | "ink" | "brand"> = { planned: "brand", active: "good", paused: "warn", ended: "ink" };
const usd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: n > 0 && n < 100 ? 2 : 0 })}`;

function Mark({ platform, size = 28 }: { platform: string; size?: number }) {
  const m = PLATFORM[platform as Platform] ?? PLATFORM.other;
  return (
    <span className="dk-railcard__mark" style={{ background: m.bg, width: size, height: size }} aria-hidden="true">
      {m.letter}
    </span>
  );
}

const dateOnly = (s: string | null | undefined) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : null);

/**
 * Paid ads command center: every campaign against the leads it brought in.
 * Leads are attributed by utm_campaign (set by each campaign's tracking link);
 * spend is entered from the ad platform, and the desk flags when it looks stale.
 */
export default async function AdsPage({ searchParams }: { searchParams: SP }) {
  await requireAdminPage("/admin/ads");
  const p = await readParams(searchParams);
  const t = nowMs();
  const now = new Date(t);
  const tab: Tab = (TABS as readonly string[]).includes(p.tab) ? (p.tab as Tab) : "overview";
  const platform = (PLATFORMS as readonly string[]).includes(p.platform) ? (p.platform as Platform) : "";
  const status = ["planned", "active", "paused", "ended"].includes(p.status) ? p.status : "";
  const q = (p.q || "").trim().toLowerCase();
  const self = (over: Record<string, string | undefined> = {}) => `/admin/ads${qs(p, { ok: undefined, err: undefined, ...over })}`;

  const ads = await prisma.adCampaign.findMany({ orderBy: [{ createdAt: "desc" }] });
  const tags = ads.map((a) => a.utmCampaign);
  const since30 = new Date(t - 30 * DAY);
  const [byTag, sourceLeads, paid30, untracked] = await Promise.all([
    tags.length ? prisma.lead.groupBy({ by: ["campaign", "status"], where: { campaign: { in: tags } }, _count: { _all: true } }) : Promise.resolve([]),
    prisma.lead.groupBy({ by: ["source"], where: { createdAt: { gte: since30 } }, _count: { _all: true } }),
    prisma.lead.findMany({
      where: { createdAt: { gte: since30 }, OR: [{ source: "fb_ad" }, ...(tags.length ? [{ campaign: { in: tags } }] : [])] },
      select: { createdAt: true, campaign: true },
    }),
    prisma.lead.count({ where: { source: "fb_ad", OR: [{ campaign: null }, ...(tags.length ? [{ campaign: { notIn: tags } }] : [])] } }),
  ]);

  const stat = (tag: string, st?: string[]) => byTag.filter((l) => l.campaign === tag && (!st || st.includes(l.status))).reduce((n, l) => n + l._count._all, 0);
  type Row = AdCampaign & { leads: number; answered: number; booked: number; cpl: number | null; cpb: number | null; conv: number | null; expected: number | null; stale: boolean };
  const rows: Row[] = ads.map((a) => {
    const leads = stat(a.utmCampaign, ["new", "contacted", "booked", "closed"]);
    const answered = stat(a.utmCampaign, ["contacted", "booked", "closed"]);
    const booked = stat(a.utmCampaign, ["booked"]);
    const start = dateOnly(a.startDate);
    const end = dateOnly(a.endDate);
    const until = end && end.getTime() < t ? end.getTime() : t;
    const days = start ? Math.max(0, Math.ceil((until - start.getTime()) / DAY)) : 0;
    const expected = a.status !== "planned" && start && a.dailyBudget ? days * a.dailyBudget : null;
    return {
      ...a,
      leads,
      answered,
      booked,
      cpl: leads && a.spend ? a.spend / leads : null,
      cpb: booked && a.spend ? a.spend / booked : null,
      conv: leads ? (booked / leads) * 100 : null,
      expected,
      stale: a.status === "active" && expected !== null && expected > 0 && a.spend < expected * 0.5,
    };
  });

  const spend = rows.reduce((n, r) => n + r.spend, 0);
  const leads = rows.reduce((n, r) => n + r.leads, 0);
  const answered = rows.reduce((n, r) => n + r.answered, 0);
  const booked = rows.reduce((n, r) => n + r.booked, 0);
  const active = rows.filter((r) => r.status === "active");
  const daily = active.reduce((n, r) => n + r.dailyBudget, 0);
  const stale = rows.filter((r) => r.stale);
  const feedKey = process.env.META_FEED_KEY;
  const count = (s: string) => rows.filter((r) => r.status === s).length;

  const perPlatform = PLATFORMS.map((pl) => {
    const mine = rows.filter((r) => r.platform === pl);
    const sp = mine.reduce((n, r) => n + r.spend, 0);
    const ld = mine.reduce((n, r) => n + r.leads, 0);
    return {
      key: pl,
      campaigns: mine.length,
      live: mine.filter((r) => r.status === "active").length,
      planned: mine.filter((r) => r.status === "planned").length,
      spend: sp,
      leads: ld,
      cpl: ld && sp ? sp / ld : null,
    };
  });
  const livePlatforms = perPlatform.filter((x) => x.live).length;

  const filtered = rows.filter(
    (r) => (!platform || r.platform === platform) && (!status || r.status === status) && (!q || r.name.toLowerCase().includes(q) || r.utmCampaign.includes(q)),
  );
  const sort = ["cpl", "leads", "spend", "booked"].includes(p.sort) ? p.sort : "leads";
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "cpl") return a.cpl === b.cpl ? b.leads - a.leads : a.cpl === null ? 1 : b.cpl === null ? -1 : a.cpl - b.cpl;
    if (sort === "spend") return b.spend - a.spend;
    if (sort === "booked") return b.booked - a.booked;
    return b.leads - a.leads;
  });

  const perDay = Array.from({ length: 30 }, (_, i) => new Date(t - (29 - i) * DAY).toISOString().slice(0, 10)).map((d) => ({
    label: d.slice(8),
    value: paid30.filter((x) => x.createdAt.toISOString().slice(0, 10) === d).length,
  }));
  const paidTotal30 = paid30.length;

  /* Flight plan window: 30 days back, 60 ahead. */
  const winStart = t - 30 * DAY;
  const winEnd = t + 60 * DAY;
  const pct = (ms: number) => Math.min(100, Math.max(0, ((ms - winStart) / (winEnd - winStart)) * 100));
  const weeks = Array.from({ length: 7 }, (_, i) => winStart + i * 14 * DAY);

  const newPlatform: Platform = platform || "meta";
  const open = p.open ? rows.find((r) => r.id === p.open) : undefined;

  const card = (r: Row, compact = false) => (
    <article key={r.id} id={`ad-${r.id}`} className={`dk-adcard${r.id === open?.id ? " is-open" : ""}`}>
      <div className="dk-adcard__top">
        <Mark platform={r.platform} size={34} />
        <div className="dk-adcard__who">
          <b>{r.name}</b>
          <small>
            {PLATFORM[r.platform as Platform]?.label ?? r.platform} · {r.objective} · <span className="dk-mono">{r.utmCampaign}</span>
          </small>
        </div>
        <Chip tone={STATUS_TONE[r.status] || "ink"}>{r.status}</Chip>
      </div>
      <dl className="dk-adcard__stats">
        <div>
          <dt>Spend</dt>
          <dd className="dk-value">{usd(r.spend)}</dd>
        </div>
        <div>
          <dt>Leads</dt>
          <dd>{r.leads}</dd>
        </div>
        <div>
          <dt>Booked</dt>
          <dd>{r.booked}</dd>
        </div>
        <div>
          <dt>$/lead</dt>
          <dd>{r.cpl !== null ? usd(r.cpl) : "—"}</dd>
        </div>
        <div>
          <dt>$/booking</dt>
          <dd>{r.cpb !== null ? usd(r.cpb) : "—"}</dd>
        </div>
      </dl>
      <div className="dk-adcard__funnel" aria-label={`${r.leads} leads, ${r.answered} answered, ${r.booked} booked`}>
        <span style={{ width: "100%" }} />
        <span style={{ width: `${r.leads ? (r.answered / r.leads) * 100 : 0}%` }} />
        <span style={{ width: `${r.leads ? (r.booked / r.leads) * 100 : 0}%` }} />
      </div>
      <p className="dk-hint">
        {r.dailyBudget ? `${usd(r.dailyBudget)}/day` : "no daily budget"} · {r.startDate ? `from ${r.startDate}` : "no start date"}
        {r.endDate ? ` to ${r.endDate}` : ""}
        {r.stale ? (
          <>
            {" "}
            · <b className="dk-warn">spend looks out of date (expected ≈ {usd(r.expected ?? 0)})</b>
          </>
        ) : null}
      </p>
      {compact ? null : (
        <>
          <label className="dk-field">
            <span>Tracking link — paste it as the ad&rsquo;s website URL</span>
            <input readOnly defaultValue={r.landingUrl} className="dk-copy" />
          </label>
          <details className="dk-adcard__edit" open={r.id === open?.id}>
            <summary>Update status, budget or spend</summary>
            <form action={saveAd} className="dk-form">
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="platform" value={r.platform} />
              <input type="hidden" name="objective" value={r.objective} />
              <input type="hidden" name="returnTo" value={self({ open: r.id })} />
              <label className="dk-field">
                <span>Status</span>
                <select name="status" defaultValue={r.status}>
                  <option value="planned">planned</option>
                  <option value="active">active</option>
                  <option value="paused">paused</option>
                  <option value="ended">ended</option>
                </select>
              </label>
              <label className="dk-field">
                <span>Daily budget $</span>
                <input name="dailyBudget" type="number" min={0} defaultValue={r.dailyBudget} />
              </label>
              <label className="dk-field">
                <span>Spent so far $ (from the platform)</span>
                <input name="spend" type="number" min={0} defaultValue={r.spend} />
              </label>
              <label className="dk-field">
                <span>Start</span>
                <input name="startDate" type="date" defaultValue={r.startDate ?? ""} />
              </label>
              <label className="dk-field">
                <span>End</span>
                <input name="endDate" type="date" defaultValue={r.endDate ?? ""} />
              </label>
              <label className="dk-field dk-field--wide">
                <span>Notes</span>
                <input name="note" defaultValue={r.note ?? ""} placeholder="Audience, creative, what you're testing…" />
              </label>
              <button className="dk-btn dk-btn--primary">
                <Icon name="check" size={14} /> Save
              </button>
            </form>
            <form action={deleteAd} style={{ marginTop: 8 }}>
              <input type="hidden" name="id" value={r.id} />
              <button className="dk-btn dk-btn--ghost dk-btn--sm">Delete campaign</button>
            </form>
          </details>
        </>
      )}
    </article>
  );

  return (
    <div className="dk-stack">
      <DeskHeader
        href="/admin/ads"
        title="Paid ads command center"
        brief="Every paid campaign against the leads it actually brought in — track it, compare platforms and keep spend honest."
        flash={flashOf(p)}
        signals={[
          { label: "Platform coverage", value: `${livePlatforms}/${PLATFORMS.length} platforms live`, tone: livePlatforms ? "live" : "warn", href: self({ tab: "platforms" }) },
          { label: "Spend pacing", value: active.length ? `${usd(daily)}/day across ${active.length}` : "nothing running", tone: stale.length ? "warn" : "ok", href: self({ tab: "flight" }) },
          {
            label: "Attribution",
            value: untracked ? `${untracked} ad leads untagged` : leads ? `${usd(spend / leads)} per lead` : "no attributed leads yet",
            tone: untracked ? "critical" : "ok",
            href: self({ tab: "attribution" }),
          },
        ]}
        actions={
          <>
            <a className="dk-btn dk-btn--onink" href="https://adsmanager.facebook.com/" target="_blank" rel="noreferrer">
              <Icon name="external" size={15} /> Meta Ads
            </a>
            <a className="dk-btn dk-btn--onink" href="https://ads.google.com/" target="_blank" rel="noreferrer">
              <Icon name="external" size={15} /> Google Ads
            </a>
            <Link prefetch={false} className="dk-btn dk-btn--light" href={self({ tab: "create" })} scroll={false}>
              <Icon name="plus" size={15} /> Track a campaign
            </Link>
          </>
        }
      />

      <div className="dk-kpis">
        <Kpi label="Spend recorded" value={spend} fmt="usd" sub={`${rows.length} campaigns`} tone="value" href={self({ tab: "attribution", sort: "spend" })} />
        <Kpi label="Attributed leads" value={leads} sub={`${booked} booked · ${paidTotal30} in 30 days`} href={self({ tab: "attribution" })} />
        <Kpi label="Cost per lead" value={leads && spend ? usd(spend / leads) : "—"} sub="all campaigns" href={self({ tab: "attribution", sort: "cpl" })} />
        <Kpi label="Cost per booking" value={booked && spend ? usd(spend / booked) : "—"} tone="good" href={self({ tab: "attribution", sort: "booked" })} />
        <Kpi label="Live daily budget" value={daily} fmt="usd" sub={`${active.length} active`} href={self({ tab: "campaigns", status: "active" })} />
        <Kpi label="Untagged ad leads" value={untracked} sub="ad leads with no campaign" tone={untracked ? "alert" : undefined} href={self({ tab: "attribution" })} />
      </div>

      <div className="dk-grid dk-grid--rail">
        <CommandRail
          title="Command rail"
          sub="Track · compare · pace"
          tabs={[
            { key: "overview", label: "Overview", href: self({ tab: undefined, open: undefined }), on: tab === "overview" },
            { key: "create", label: "Track new", href: self({ tab: "create", open: undefined }), on: tab === "create" },
            { key: "campaigns", label: "Campaigns", href: self({ tab: "campaigns" }), on: tab === "campaigns", count: rows.length },
            { key: "attribution", label: "Attribution", href: self({ tab: "attribution", open: undefined }), on: tab === "attribution", count: untracked || undefined },
            { key: "flight", label: "Flight plan", href: self({ tab: "flight", open: undefined }), on: tab === "flight" },
            { key: "platforms", label: "Platforms", href: self({ tab: "platforms", open: undefined }), on: tab === "platforms" },
          ]}
          quick={{
            title: "Quick track",
            items: PLATFORMS.map((pl) => ({
              label: PLATFORM[pl].label.split(" (")[0],
              href: self({ tab: "create", platform: pl, open: undefined }),
              mark: <Mark platform={pl} />,
              note: perPlatform.find((x) => x.key === pl)?.live ? "live" : undefined,
            })),
          }}
        />

        <div className="dk-stack">
          <Panel kicker="Platform status" title="Ad platforms" sub={`${livePlatforms} running now · spend is entered from each platform, leads are counted here automatically.`}>
            <div className="dk-channels">
              {perPlatform.map((x) => (
                <div key={x.key} className="dk-channel">
                  <div className="dk-channel__top">
                    <Mark platform={x.key} />
                    <div>
                      <b>{PLATFORM[x.key].label.split(" (")[0]}</b>
                      <span className={`dk-channel__state dk-channel__state--${x.live ? "on" : "manual"}`}>
                        <i /> {x.live ? `${x.live} live` : x.planned ? `${x.planned} planned` : x.campaigns ? "Paused" : "Not used yet"}
                      </span>
                    </div>
                  </div>
                  <div className="dk-channel__foot">
                    <span title={x.cpl !== null ? `${usd(x.cpl)} per lead` : undefined}>
                      {usd(x.spend)} · {x.leads} lead{x.leads === 1 ? "" : "s"}
                    </span>
                    <Link prefetch={false} href={self({ tab: "create", platform: x.key })} scroll={false}>
                      + Track
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {stale.length ? (
            <p className="dk-flash dk-flash--warn">
              {stale.length} active campaign{stale.length === 1 ? " shows" : "s show"} less than half the expected spend — copy today&rsquo;s spend from the ad platform so cost per lead stays true.{" "}
              <Link prefetch={false} href={self({ tab: "campaigns", status: "active" })}>
                Update →
              </Link>
            </p>
          ) : null}

          <Panel>
            <div className="dk-toolbar" style={{ marginBottom: 14 }}>
              <ViewSwitch
                items={[
                  { key: "overview", label: "01 Overview", href: self({ tab: undefined, open: undefined }), on: tab === "overview" },
                  { key: "campaigns", label: "02 Campaigns", href: self({ tab: "campaigns" }), on: tab === "campaigns" },
                  { key: "attribution", label: "03 Attribution", href: self({ tab: "attribution", open: undefined }), on: tab === "attribution" },
                  { key: "flight", label: "04 Flight plan", href: self({ tab: "flight", open: undefined }), on: tab === "flight" },
                  { key: "platforms", label: "05 Platforms", href: self({ tab: "platforms", open: undefined }), on: tab === "platforms" },
                ]}
              />
              {tab === "campaigns" || tab === "attribution" ? (
                <form method="get" className="dk-inline">
                  <input type="hidden" name="tab" value={tab} />
                  <input name="q" defaultValue={p.q} placeholder="Search campaigns…" aria-label="Search campaigns" />
                  <select name="platform" defaultValue={platform} aria-label="Platform">
                    <option value="">All platforms</option>
                    {PLATFORMS.map((pl) => (
                      <option key={pl} value={pl}>
                        {PLATFORM[pl].label.split(" (")[0]}
                      </option>
                    ))}
                  </select>
                  <select name="status" defaultValue={status} aria-label="Status">
                    <option value="">All status</option>
                    {["active", "planned", "paused", "ended"].map((s) => (
                      <option key={s} value={s}>
                        {s} ({count(s)})
                      </option>
                    ))}
                  </select>
                  {tab === "attribution" ? (
                    <select name="sort" defaultValue={sort} aria-label="Sort">
                      <option value="leads">Most leads</option>
                      <option value="cpl">Cheapest lead</option>
                      <option value="booked">Most bookings</option>
                      <option value="spend">Most spend</option>
                    </select>
                  ) : null}
                  <button className="dk-btn dk-btn--sm">Filter</button>
                </form>
              ) : null}
            </div>

            {tab === "overview" ? (
              <div className="dk-stack">
                <div className="dk-grid dk-grid--2">
                  <div>
                    <p className="dk-kicker" style={{ marginBottom: 8 }}>
                      Paid leads per day · 30 days · {paidTotal30} total
                    </p>
                    <Columns rows={perDay} height={130} />
                  </div>
                  <div>
                    <p className="dk-kicker" style={{ marginBottom: 8 }}>
                      Leads by campaign
                    </p>
                    <RankedBars
                      rows={rows
                        .filter((r) => r.leads)
                        .sort((a, b) => b.leads - a.leads)
                        .slice(0, 6)
                        .map((r) => ({ key: r.id, label: r.name, value: r.leads, hint: r.cpl !== null ? `${usd(r.cpl)}/lead` : undefined, href: self({ tab: "campaigns", open: r.id }) }))}
                      empty="No attributed leads yet — paste a tracking link into your first ad."
                    />
                  </div>
                </div>
                <p className="dk-kicker">Latest campaigns</p>
                {rows.length === 0 ? (
                  <Empty title="No paid campaigns yet.">
                    Track the campaign here first, then paste its link into the ad. Every lead that arrives through it is counted against what you spent.
                    <div style={{ marginTop: 12 }}>
                      <Link prefetch={false} className="dk-btn dk-btn--primary" href={self({ tab: "create" })}>
                        <Icon name="plus" size={14} /> Track a campaign
                      </Link>
                    </div>
                  </Empty>
                ) : (
                  <div className="dk-adgrid">{rows.slice(0, 4).map((r) => card(r, true))}</div>
                )}
              </div>
            ) : null}

            {tab === "campaigns" ? (
              sorted.length === 0 ? (
                <Empty title={rows.length ? "No campaign matches those filters." : "No paid campaigns yet."}>
                  <Link prefetch={false} className="dk-btn dk-btn--primary" href={self({ tab: "create" })}>
                    <Icon name="plus" size={14} /> Track a campaign
                  </Link>
                </Empty>
              ) : (
                <div className="dk-adgrid">{sorted.map((r) => card(r))}</div>
              )
            ) : null}

            {tab === "attribution" ? (
              <div className="dk-stack">
                {untracked ? (
                  <p className="dk-flash dk-flash--err">
                    {untracked} lead{untracked === 1 ? "" : "s"} came from a Facebook ad without a campaign tag, so no campaign gets the credit. Use each campaign&rsquo;s tracking link as the ad URL.
                  </p>
                ) : null}
                <div className="dk-tablewrap">
                  <table className="dk-table">
                    <thead>
                      <tr>
                        <th>Campaign</th>
                        <th>Status</th>
                        <th className="dk-right">Spend</th>
                        <th className="dk-right">Leads</th>
                        <th className="dk-right">Answered</th>
                        <th className="dk-right">Booked</th>
                        <th className="dk-right">Per lead</th>
                        <th className="dk-right">Per booking</th>
                        <th className="dk-right">Lead → booking</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="dk-dim">
                            Nothing to attribute yet.
                          </td>
                        </tr>
                      ) : null}
                      {sorted.map((r) => (
                        <tr key={r.id}>
                          <td className="dk-wrap">
                            <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                              <Mark platform={r.platform} size={22} />
                              <Link prefetch={false} href={self({ tab: "campaigns", open: r.id })}>
                                <b>{r.name}</b>
                              </Link>
                            </span>
                            <div className="dk-dim dk-mono">{r.utmCampaign}</div>
                          </td>
                          <td>
                            <Chip tone={STATUS_TONE[r.status] || "ink"}>{r.status}</Chip>
                          </td>
                          <td className="dk-right dk-num">{usd(r.spend)}</td>
                          <td className="dk-right dk-num">
                            <Link prefetch={false} href={`/admin/leads?q=${encodeURIComponent(r.utmCampaign)}`}>
                              {r.leads}
                            </Link>
                          </td>
                          <td className="dk-right dk-num">{r.answered}</td>
                          <td className="dk-right dk-num">{r.booked}</td>
                          <td className="dk-right dk-num">{r.cpl !== null ? usd(r.cpl) : "—"}</td>
                          <td className="dk-right dk-num">{r.cpb !== null ? usd(r.cpb) : "—"}</td>
                          <td className="dk-right dk-num">{r.conv !== null ? `${r.conv.toFixed(r.conv < 10 ? 1 : 0)}%` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                    {sorted.length > 1 ? (
                      <tfoot>
                        <tr>
                          <th>All shown</th>
                          <th />
                          <th className="dk-right">{usd(sorted.reduce((n, r) => n + r.spend, 0))}</th>
                          <th className="dk-right">{sorted.reduce((n, r) => n + r.leads, 0)}</th>
                          <th className="dk-right">{sorted.reduce((n, r) => n + r.answered, 0)}</th>
                          <th className="dk-right">{sorted.reduce((n, r) => n + r.booked, 0)}</th>
                          <th className="dk-right" colSpan={3} />
                        </tr>
                      </tfoot>
                    ) : null}
                  </table>
                </div>
                <div className="dk-grid dk-grid--2">
                  <div>
                    <p className="dk-kicker" style={{ marginBottom: 8 }}>
                      Paid funnel · all time
                    </p>
                    <FunnelLanes
                      stages={[
                        { label: "Leads", value: leads, href: "/admin/leads" },
                        { label: "Answered", value: answered, href: "/admin/leads?status=contacted" },
                        { label: "Booked", value: booked, href: "/admin/leads?status=booked" },
                      ]}
                    />
                  </div>
                  <div>
                    <p className="dk-kicker" style={{ marginBottom: 8 }}>
                      Every lead by source · 30 days
                    </p>
                    <Donut items={sourceLeads.map((s) => ({ label: s.source, value: s._count._all, href: `/admin/leads?source=${s.source}` }))} centerLabel="LEADS · 30D" />
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "flight" ? (
              <div className="dk-stack">
                <p className="dk-hint">Thirty days back, sixty ahead. Bars run from each campaign&rsquo;s start to its end — open-ended campaigns run to the edge. The line is today.</p>
                {rows.length === 0 ? (
                  <Empty title="Nothing on the flight plan yet." />
                ) : (
                  <div className="dk-flight">
                    <div className="dk-flight__scale" aria-hidden="true">
                      {weeks.map((w) => (
                        <span key={w} style={{ left: `${pct(w)}%` }}>
                          {new Date(w).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                        </span>
                      ))}
                    </div>
                    <ul>
                      {rows.map((r) => {
                        const s = (dateOnly(r.startDate) ?? r.createdAt).getTime();
                        const e = dateOnly(r.endDate)?.getTime() ?? (r.status === "ended" ? r.updatedAt.getTime() : winEnd);
                        const left = pct(s);
                        const width = Math.max(1.5, pct(e) - left);
                        return (
                          <li key={r.id}>
                            <Link prefetch={false} href={self({ tab: "campaigns", open: r.id })} className="dk-flight__label">
                              <Mark platform={r.platform} size={20} />
                              <span>{r.name}</span>
                            </Link>
                            <div className="dk-flight__track">
                              <span className="dk-flight__today" style={{ left: `${pct(t)}%` }} />
                              {e >= winStart && s <= winEnd ? (
                                <span
                                  className={`dk-flight__bar dk-flight__bar--${r.status}`}
                                  style={{ left: `${left}%`, width: `${width}%` }}
                                  title={`${r.startDate ?? "no start"} → ${r.endDate ?? "open-ended"} · ${usd(r.dailyBudget)}/day`}
                                >
                                  {r.dailyBudget ? `${usd(r.dailyBudget)}/d` : ""}
                                </span>
                              ) : (
                                <span className="dk-flight__out">outside this window</span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                <div className="dk-legend">
                  <span className="dk-flight__key dk-flight__bar--active">active</span>
                  <span className="dk-flight__key dk-flight__bar--planned">planned</span>
                  <span className="dk-flight__key dk-flight__bar--paused">paused</span>
                  <span className="dk-flight__key dk-flight__bar--ended">ended</span>
                </div>
              </div>
            ) : null}

            {tab === "platforms" ? (
              <div className="dk-stack">
                <ul className="dk-health">
                  {PLATFORMS.map((pl) => {
                    const x = perPlatform.find((y) => y.key === pl)!;
                    return (
                      <li key={pl}>
                        <b>
                          <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                            <Mark platform={pl} /> {PLATFORM[pl].label}
                          </span>
                          <Chip tone={x.live ? "good" : x.campaigns ? "warn" : "ink"}>{x.live ? `${x.live} live` : x.campaigns ? "paused" : "not used"}</Chip>
                        </b>
                        <span>
                          {x.campaigns} campaigns · {usd(x.spend)} spent · {x.leads} leads{x.cpl !== null ? ` · ${usd(x.cpl)} per lead` : ""}
                        </span>
                        <small>{PLATFORM[pl].note}</small>
                        {PLATFORM[pl].manager ? (
                          <a href={PLATFORM[pl].manager} target="_blank" rel="noreferrer">
                            Open {PLATFORM[pl].managerLabel} ↗
                          </a>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                <div className="dk-grid dk-grid--2">
                  <div>
                    <p className="dk-kicker" style={{ marginBottom: 8 }}>
                      Meta catalog (Advantage+ ads)
                    </p>
                    <ul className="dk-feed">
                      <li>
                        <span className="dk-feed__icon">
                          <Icon name="listings" size={15} />
                        </span>
                        <div>
                          <b>Listings feed</b>
                          <p>{feedKey ? "https://app.rentleaks.com/feeds/meta-home-listings.csv?key=…" : "Set META_FEED_KEY with the deploy script (--secrets) to switch it on."}</p>
                        </div>
                        <time>{feedKey ? <Chip tone="good">on</Chip> : <Chip tone="warn">off</Chip>}</time>
                      </li>
                      <li>
                        <span className="dk-feed__icon">
                          <Icon name="clock" size={15} />
                        </span>
                        <div>
                          <b>Refresh it daily</b>
                          <p>Commerce Manager → Catalog → Data sources → Scheduled feed.</p>
                        </div>
                        <time />
                      </li>
                    </ul>
                  </div>
                  <div>
                    <p className="dk-kicker" style={{ marginBottom: 8 }}>
                      How a lead is credited
                    </p>
                    <ol className="dk-rules">
                      <li>
                        <b>Track the campaign here.</b> It gets a unique <span className="dk-mono">utm_campaign</span> and a tracking link.
                      </li>
                      <li>
                        <b>Use the link as the ad&rsquo;s URL.</b> The lead form carries the tag into every lead.
                      </li>
                      <li>
                        <b>Copy spend weekly.</b> Cost per lead and per booking update the moment you save.
                      </li>
                    </ol>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "create" ? (
              <div className="dk-grid dk-grid--2-1" id="create">
                <form action={saveAd} className="dk-stack">
                  <input type="hidden" name="returnTo" value={self({ tab: "create" })} />
                  <Steps
                    steps={[
                      { label: "Platform & goal", state: "on" },
                      { label: "Landing page", state: "todo" },
                      { label: "Budget & dates", state: "todo" },
                    ]}
                  />
                  <fieldset className="dk-fieldset">
                    <legend>1 · Platform &amp; goal</legend>
                    <div className="dk-pickgrid" role="radiogroup" aria-label="Platform">
                      {PLATFORMS.map((pl) => (
                        <label key={pl} className="dk-pick">
                          <input type="radio" name="platform" value={pl} defaultChecked={pl === newPlatform} />
                          <Mark platform={pl} />
                          <span>{PLATFORM[pl].label.split(" (")[0]}</span>
                        </label>
                      ))}
                    </div>
                    <div className="dk-form" style={{ marginTop: 12 }}>
                      <label className="dk-field dk-field--wide">
                        <span>Campaign name</span>
                        <input name="name" required minLength={3} placeholder="Brooklyn rooms — lead form — Oct" defaultValue={(p.name ?? "").slice(0, 120)} />
                      </label>
                      <label className="dk-field">
                        <span>Goal</span>
                        <select name="objective" defaultValue={["leads", "hosts", "traffic", "awareness"].includes(p.objective ?? "") ? p.objective : "leads"}>
                          <option value="leads">Renter leads</option>
                          <option value="hosts">Host sign-ups</option>
                          <option value="traffic">Traffic</option>
                          <option value="awareness">Awareness</option>
                        </select>
                      </label>
                      <label className="dk-field">
                        <span>Status</span>
                        <select name="status" defaultValue="planned">
                          <option value="planned">planned</option>
                          <option value="active">active (running now)</option>
                        </select>
                      </label>
                    </div>
                  </fieldset>
                  <fieldset className="dk-fieldset">
                    <legend>2 · Where the ad sends people</legend>
                    <div className="dk-form">
                      <label className="dk-field dk-field--wide">
                        <span>Landing page</span>
                        <select name="landing" defaultValue="https://rentleaks.com/facebook.html">
                          <option value="https://rentleaks.com/facebook.html">Renter lead form (rentleaks.com/facebook.html)</option>
                          <option value="https://app.rentleaks.com/stays">Browse homes (app)</option>
                          <option value="https://app.rentleaks.com/list">List a place — hosts (app)</option>
                          <option value="https://rentleaks.com/">Home page</option>
                        </select>
                      </label>
                      <label className="dk-field dk-field--wide">
                        <span>utm_campaign (optional — made from the name)</span>
                        <input name="utm" placeholder="brooklyn-rooms-oct" pattern="[A-Za-z0-9 _-]*" />
                      </label>
                    </div>
                  </fieldset>
                  <fieldset className="dk-fieldset">
                    <legend>3 · Budget &amp; dates</legend>
                    <div className="dk-form">
                      <label className="dk-field">
                        <span>Daily budget $</span>
                        <input name="dailyBudget" type="number" min={0} defaultValue={10} />
                      </label>
                      <label className="dk-field">
                        <span>Start</span>
                        <input name="startDate" type="date" defaultValue={now.toISOString().slice(0, 10)} />
                      </label>
                      <label className="dk-field">
                        <span>End (optional)</span>
                        <input name="endDate" type="date" />
                      </label>
                    </div>
                  </fieldset>
                  <button className="dk-btn dk-btn--primary">
                    <Icon name="plus" size={14} /> Create campaign and get the tracking link
                  </button>
                </form>
                <div className="dk-stack" style={{ alignContent: "start" }}>
                  <Panel kicker="What happens next" title="Three things">
                    <ol className="dk-rules">
                      <li>
                        <b>Copy the tracking link</b> from the campaign card into the ad&rsquo;s website URL.
                      </li>
                      <li>
                        <b>Launch the ad</b> in {PLATFORM[newPlatform].managerLabel ?? "the platform"}.
                      </li>
                      <li>
                        <b>Update spend weekly</b> — the desk flags it when it looks stale.
                      </li>
                    </ol>
                  </Panel>
                  <Panel kicker="Fair housing" title="Keep ads about the home">
                    <p className="dk-hint">{PLATFORM[newPlatform].note}</p>
                    <p className="dk-hint" style={{ marginTop: 8 }}>
                      Never target or exclude by race, religion, sex, disability, familial status or national origin — say what the home offers, not who should live there.
                    </p>
                  </Panel>
                </div>
              </div>
            ) : null}
          </Panel>

          {open && tab !== "campaigns" ? (
            <p className="dk-hint">
              Last updated {when(open.updatedAt)} ·{" "}
              <Link prefetch={false} href={self({ tab: "campaigns" })}>
                open in Campaigns →
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
