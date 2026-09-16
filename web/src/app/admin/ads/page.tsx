import Link from "next/link";
import { deleteAd, saveAd } from "@/app/admin/_actions/ads";
import { Donut, Kpi, RankedBars } from "@/components/admin/desk/charts";
import { DeskHeader } from "@/components/admin/desk/DeskHeader";
import { Icon } from "@/components/admin/desk/Icon";
import { Chip, Empty, Panel } from "@/components/admin/desk/parts";
import { flashOf, readParams, type SP } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Paid ads — RentLeaks desk" };

const TONE: Record<string, "ink" | "good" | "warn"> = { planned: "ink", active: "good", paused: "warn", ended: "ink" };
const usd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: n < 100 ? 2 : 0 })}`;

export default async function AdsPage({ searchParams }: { searchParams: SP }) {
  await requireAdminPage("/admin/ads");
  const p = await readParams(searchParams);
  const [ads, sourceLeads] = await Promise.all([
    prisma.adCampaign.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }] }),
    prisma.lead.groupBy({ by: ["source"], _count: { _all: true } }),
  ]);
  const tags = ads.map((a) => a.utmCampaign);
  const leads = tags.length ? await prisma.lead.groupBy({ by: ["campaign", "status"], where: { campaign: { in: tags } }, _count: { _all: true } }) : [];
  const stat = (tag: string, status?: string) => leads.filter((l) => l.campaign === tag && (!status || l.status === status)).reduce((n, l) => n + l._count._all, 0);
  const spend = ads.reduce((n, a) => n + a.spend, 0);
  const totalLeads = tags.reduce((n, tg) => n + stat(tg), 0);
  const booked = tags.reduce((n, tg) => n + stat(tg, "booked"), 0);
  const active = ads.filter((a) => a.status === "active");
  const daily = active.reduce((n, a) => n + a.dailyBudget, 0);
  const feedKey = process.env.META_FEED_KEY;
  const platforms = [...new Set(ads.map((a) => a.platform))];

  return (
    <div className="dk-stack">
      <DeskHeader
        href="/admin/ads"
        flash={flashOf(p)}
        signals={[
          { label: "Active campaigns", value: `${active.length} · ${usd(daily)}/day`, tone: active.length ? "live" : "ok" },
          { label: "Spend recorded", value: usd(spend), tone: "ok" },
          { label: "Cost per lead", value: totalLeads ? usd(spend / totalLeads) : "—", tone: "ok" },
          { label: "Cost per booking", value: booked ? usd(spend / booked) : "—", tone: booked ? "live" : "ok" },
        ]}
        actions={
          <>
            <a className="dk-btn dk-btn--onink" href="https://adsmanager.facebook.com/" target="_blank" rel="noreferrer">
              <Icon name="external" size={15} /> Meta Ads
            </a>
            <a className="dk-btn dk-btn--onink" href="https://ads.google.com/" target="_blank" rel="noreferrer">
              <Icon name="external" size={15} /> Google Ads
            </a>
            <Link prefetch={false} className="dk-btn dk-btn--light" href="#new">
              <Icon name="plus" size={15} /> Track a campaign
            </Link>
          </>
        }
      />

      <div className="dk-kpis">
        <Kpi label="Spend recorded" value={spend} fmt="usd" tone="value" />
        <Kpi label="Attributed leads" value={totalLeads} sub={`${booked} booked`} href="/admin/leads?source=fb_ad" />
        <Kpi label="Cost per lead" value={totalLeads ? usd(spend / totalLeads) : "—"} />
        <Kpi label="Cost per booking" value={booked ? usd(spend / booked) : "—"} tone="good" />
        <Kpi label="Daily budget live" value={daily} fmt="usd" sub={`${active.length} active campaigns`} />
      </div>

      <div className="dk-grid dk-grid--2">
        <Panel title="Leads by campaign" sub="Leads carrying each campaign's utm_campaign tag.">
          <RankedBars
            rows={ads
              .map((a) => ({ key: a.id, label: a.name, value: stat(a.utmCampaign), hint: a.spend && stat(a.utmCampaign) ? `${usd(a.spend / stat(a.utmCampaign))}/lead` : undefined }))
              .sort((a, b) => b.value - a.value)}
            empty="No campaigns yet."
          />
        </Panel>
        <Panel title="All leads by source" sub="Paid and organic, all time." actions={<Link prefetch={false} href="/admin/leads">Leads →</Link>}>
          <Donut items={sourceLeads.map((s) => ({ label: s.source, value: s._count._all, href: `/admin/leads?source=${s.source}` }))} centerLabel="LEADS" />
        </Panel>
      </div>

      <Panel title="Campaigns" sub={platforms.length ? `On ${platforms.join(", ")}` : "Create the campaign here first, then paste its tracking link into the ad platform."}>
        {ads.length === 0 ? (
          <Empty title="No paid campaigns yet.">Each campaign gets a tracking link; every lead that arrives through it is counted here against what you spent.</Empty>
        ) : (
          <div className="dk-stack">
            {ads.map((a) => {
              const n = stat(a.utmCampaign);
              const b = stat(a.utmCampaign, "booked");
              return (
                <article key={a.id} className={`dk-rcard dk-rcard--${a.status === "active" ? "good" : a.status === "paused" ? "warn" : "ink"}`}>
                  <div className="dk-rcard__top">
                    <span className="dk-avatar dk-avatar--warm">{a.platform.slice(0, 2).toUpperCase()}</span>
                    <div className="dk-rcard__who">
                      <b className="dk-rcard__title">{a.name}</b>
                      <small>
                        {a.platform} · {a.objective} · utm_campaign={a.utmCampaign}
                      </small>
                      <div className="dk-chiprow dk-chiprow--tight">
                        <Chip tone={TONE[a.status] ?? "ink"}>{a.status}</Chip>
                        <Chip tone="value">{usd(a.spend)} spent</Chip>
                        <Chip tone="brand">{n} leads</Chip>
                        <Chip tone="good">{b} booked</Chip>
                        <Chip>{n ? `${usd(a.spend / n)}/lead` : "no leads yet"}</Chip>
                      </div>
                    </div>
                  </div>
                  <label className="dk-field">
                    <span>Tracking link — use it as the ad&rsquo;s website URL</span>
                    <input readOnly defaultValue={a.landingUrl} className="dk-copy" />
                  </label>
                  <form action={saveAd} className="dk-inline">
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="platform" value={a.platform} />
                    <input type="hidden" name="objective" value={a.objective} />
                    <select name="status" defaultValue={a.status} aria-label="Status">
                      <option value="planned">planned</option>
                      <option value="active">active</option>
                      <option value="paused">paused</option>
                      <option value="ended">ended</option>
                    </select>
                    <label className="dk-check">
                      Daily $<input name="dailyBudget" type="number" min={0} defaultValue={a.dailyBudget} className="dk-w-num" />
                    </label>
                    <label className="dk-check">
                      Spent $<input name="spend" type="number" min={0} defaultValue={a.spend} className="dk-w-num" />
                    </label>
                    <input name="startDate" type="date" defaultValue={a.startDate ?? ""} aria-label="Start" />
                    <input name="endDate" type="date" defaultValue={a.endDate ?? ""} aria-label="End" />
                    <input name="note" defaultValue={a.note ?? ""} placeholder="Notes (audience, creative…)" aria-label="Notes" />
                    <button className="dk-btn dk-btn--sm dk-btn--primary">Save</button>
                  </form>
                  <form action={deleteAd}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="dk-btn dk-btn--ghost dk-btn--sm">Delete campaign</button>
                  </form>
                </article>
              );
            })}
          </div>
        )}
      </Panel>

      <div className="dk-grid dk-grid--2">
        <Panel id="new" kicker="Track" title="New campaign">
          <form action={saveAd} className="dk-form">
            <label className="dk-field dk-field--wide">
              <span>Name</span>
              <input name="name" required placeholder="Brooklyn rooms — lead form — Oct" />
            </label>
            <label className="dk-field">
              <span>Platform</span>
              <select name="platform" defaultValue="meta">
                <option value="meta">Meta (Facebook / Instagram)</option>
                <option value="google">Google</option>
                <option value="tiktok">TikTok</option>
                <option value="reddit">Reddit</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="dk-field">
              <span>Objective</span>
              <select name="objective" defaultValue="leads">
                <option value="leads">Leads</option>
                <option value="traffic">Traffic</option>
                <option value="hosts">Host sign-ups</option>
                <option value="awareness">Awareness</option>
              </select>
            </label>
            <label className="dk-field dk-field--wide">
              <span>Landing page</span>
              <select name="landing" defaultValue="https://rentleaks.com/facebook.html">
                <option value="https://rentleaks.com/facebook.html">Renter lead form (rentleaks.com/facebook.html)</option>
                <option value="https://app.rentleaks.com/stays">Browse homes (app)</option>
                <option value="https://app.rentleaks.com/list">List a place — hosts (app)</option>
                <option value="https://rentleaks.com/">Home page</option>
              </select>
            </label>
            <label className="dk-field">
              <span>Status</span>
              <select name="status" defaultValue="planned">
                <option value="planned">planned</option>
                <option value="active">active</option>
              </select>
            </label>
            <label className="dk-field">
              <span>utm_campaign (optional)</span>
              <input name="utm" placeholder="auto from name" />
            </label>
            <label className="dk-field">
              <span>Daily budget $</span>
              <input name="dailyBudget" type="number" min={0} defaultValue={10} />
            </label>
            <label className="dk-field">
              <span>Start</span>
              <input name="startDate" type="date" />
            </label>
            <label className="dk-field">
              <span>End</span>
              <input name="endDate" type="date" />
            </label>
            <button className="dk-btn dk-btn--primary">
              <Icon name="plus" size={14} /> Create campaign
            </button>
          </form>
        </Panel>
        <Panel kicker="Catalog & pixel" title="Meta dynamic ads" sub="For Advantage+ catalog campaigns.">
          <ul className="dk-feed">
            <li>
              <span className="dk-feed__icon">
                <Icon name="listings" size={15} />
              </span>
              <div>
                <b>Listings feed</b>
                <p>{feedKey ? "https://app.rentleaks.com/feeds/meta-home-listings.csv?key=…" : "Set the META_FEED_KEY secret (deploy script --secrets) to switch it on."}</p>
              </div>
              <time>{feedKey ? <Chip tone="good">on</Chip> : <Chip tone="warn">off</Chip>}</time>
            </li>
            <li>
              <span className="dk-feed__icon">
                <Icon name="clock" size={15} />
              </span>
              <div>
                <b>Schedule it daily</b>
                <p>Commerce Manager → Catalog → Data sources → Scheduled feed.</p>
              </div>
              <time />
            </li>
            <li>
              <span className="dk-feed__icon">
                <Icon name="leads" size={15} />
              </span>
              <div>
                <b>How leads are counted</b>
                <p>Landing-page leads carry src and utm_campaign — that is what the numbers above add up.</p>
              </div>
              <time />
            </li>
            <li>
              <span className="dk-feed__icon dk-feed__icon--value">
                <Icon name="shield" size={15} />
              </span>
              <div>
                <b>Fair housing</b>
                <p>Ad copy is about the home, never about who may live there. In the US, Meta&rsquo;s Special Ad Category “Housing” is required.</p>
              </div>
              <time />
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
