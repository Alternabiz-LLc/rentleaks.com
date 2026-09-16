import { deleteAd, saveAd } from "@/app/admin/_actions/ads";
import { Empty, flashOf, PageHead, Pill, readParams, Section, Stats, type SP } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Paid ads — RentLeaks admin" };

const TONE: Record<string, "" | "good" | "warn" | "bad" | "brand"> = { planned: "", active: "good", paused: "warn", ended: "" };

export default async function AdsPage({ searchParams }: { searchParams: SP }) {
  await requireAdminPage();
  const p = await readParams(searchParams);
  const ads = await prisma.adCampaign.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }] });
  const tags = ads.map((a) => a.utmCampaign);
  const leads = tags.length
    ? await prisma.lead.groupBy({ by: ["campaign", "status"], where: { campaign: { in: tags } }, _count: { _all: true } })
    : [];
  const stat = (tag: string, status?: string) =>
    leads.filter((l) => l.campaign === tag && (!status || l.status === status)).reduce((n, l) => n + l._count._all, 0);
  const spend = ads.reduce((n, a) => n + a.spend, 0);
  const totalLeads = tags.reduce((n, t) => n + stat(t), 0);
  const booked = tags.reduce((n, t) => n + stat(t, "booked"), 0);
  const feedKey = process.env.META_FEED_KEY;

  return (
    <>
      <PageHead
        title="Paid ads"
        sub="Track every paid campaign against the leads it actually brought in. Create the campaign here first, then paste its tracking link into Meta Ads Manager or Google Ads."
        flash={flashOf(p)}
      >
        <a className="btn btn--outline" href="https://adsmanager.facebook.com/" target="_blank" rel="noreferrer">Meta Ads Manager ↗</a>
        <a className="btn btn--outline" href="https://ads.google.com/" target="_blank" rel="noreferrer">Google Ads ↗</a>
      </PageHead>
      <Stats
        items={[
          { k: "Spend recorded", v: `$${spend.toLocaleString("en-US")}` },
          { k: "Attributed leads", v: totalLeads, s: `${booked} booked` },
          { k: "Cost per lead", v: totalLeads ? `$${(spend / totalLeads).toFixed(2)}` : "—" },
          { k: "Cost per booking", v: booked ? `$${(spend / booked).toFixed(2)}` : "—" },
        ]}
      />

      <Section title="Campaigns">
        {ads.length === 0 ? (
          <Empty>No paid campaigns yet.</Empty>
        ) : (
          <ul className="adm-cards">
            {ads.map((a) => {
              const n = stat(a.utmCampaign);
              return (
                <li key={a.id} className="adm-card">
                  <div className="adm-card__top">
                    <div>
                      <b>{a.name}</b> <Pill tone={TONE[a.status]}>{a.status}</Pill> <span className="a-dim">{a.platform} · {a.objective} · utm_campaign={a.utmCampaign}</span>
                    </div>
                    <div className="adm-right">
                      <b>{n}</b> leads · {stat(a.utmCampaign, "booked")} booked · {n ? `$${(a.spend / n).toFixed(2)}/lead` : "no leads yet"}
                    </div>
                  </div>
                  <label className="adm-form">
                    Tracking link (use as the ad&rsquo;s website URL)
                    <input readOnly defaultValue={a.landingUrl} className="adm-copy" />
                  </label>
                  <form action={saveAd} className="adm-actions">
                    <input type="hidden" name="id" value={a.id} />
                    <select name="status" defaultValue={a.status} aria-label="Status">
                      <option value="planned">planned</option>
                      <option value="active">active</option>
                      <option value="paused">paused</option>
                      <option value="ended">ended</option>
                    </select>
                    <input type="hidden" name="platform" value={a.platform} />
                    <input type="hidden" name="objective" value={a.objective} />
                    <label>Daily $<input name="dailyBudget" type="number" min={0} defaultValue={a.dailyBudget} className="adm-num" /></label>
                    <label>Spent $<input name="spend" type="number" min={0} defaultValue={a.spend} className="adm-num" /></label>
                    <label>From<input name="startDate" type="date" defaultValue={a.startDate ?? ""} /></label>
                    <label>To<input name="endDate" type="date" defaultValue={a.endDate ?? ""} /></label>
                    <input name="note" defaultValue={a.note ?? ""} placeholder="Notes (audience, creative…)" aria-label="Notes" />
                    <button className="btn btn--outline">Save</button>
                  </form>
                  <form action={deleteAd}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="btn btn--ghost">Delete</button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <div className="a-cols">
        <Section title="New campaign">
          <form action={saveAd} className="adm-form">
            <label>Name<input name="name" required placeholder="Brooklyn rooms — lead form — Oct" /></label>
            <div className="adm-row">
              <label>
                Platform
                <select name="platform" defaultValue="meta">
                  <option value="meta">Meta (Facebook / Instagram)</option>
                  <option value="google">Google</option>
                  <option value="tiktok">TikTok</option>
                  <option value="reddit">Reddit</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label>
                Objective
                <select name="objective" defaultValue="leads">
                  <option value="leads">Leads</option>
                  <option value="traffic">Traffic</option>
                  <option value="hosts">Host sign-ups</option>
                  <option value="awareness">Awareness</option>
                </select>
              </label>
              <label>
                Status
                <select name="status" defaultValue="planned">
                  <option value="planned">planned</option>
                  <option value="active">active</option>
                </select>
              </label>
            </div>
            <label>
              Landing page
              <select name="landing" defaultValue="https://rentleaks.com/facebook.html">
                <option value="https://rentleaks.com/facebook.html">Renter lead form (rentleaks.com/facebook.html)</option>
                <option value="https://app.rentleaks.com/stays">Browse homes (app)</option>
                <option value="https://app.rentleaks.com/list">List a place — hosts (app)</option>
                <option value="https://rentleaks.com/">Home page</option>
              </select>
            </label>
            <div className="adm-row">
              <label>utm_campaign (optional)<input name="utm" placeholder="auto from name" /></label>
              <label>Daily budget $<input name="dailyBudget" type="number" min={0} defaultValue={10} /></label>
            </div>
            <div className="adm-row">
              <label>Start<input name="startDate" type="date" /></label>
              <label>End<input name="endDate" type="date" /></label>
            </div>
            <button className="btn btn--primary">Create campaign</button>
          </form>
        </Section>
        <Section title="Catalog & pixel" sub="For Meta dynamic ads (Advantage+ catalog).">
          <ul className="adm-list">
            <li>
              Listings feed:{" "}
              {feedKey ? <code>https://app.rentleaks.com/feeds/meta-home-listings.csv?key=…</code> : "set the META_FEED_KEY secret to enable it"}
            </li>
            <li>Add it in Commerce Manager → Catalog → Data sources → Scheduled feed (daily).</li>
            <li>Leads from the landing page carry <code>src</code> and <code>utm_campaign</code>, which is how the numbers above are counted.</li>
            <li>Keep ad copy about the home, never about who may live there (fair housing — Meta&rsquo;s Special Ad Category “Housing” is required in the US).</li>
          </ul>
        </Section>
      </div>
    </>
  );
}
