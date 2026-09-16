import Link from "next/link";
import { saveCity, saveOperator } from "@/app/admin/_actions/markets";
import { Donut, Kpi, RankedBars } from "@/components/admin/desk/charts";
import { DeskHeader } from "@/components/admin/desk/DeskHeader";
import { Icon } from "@/components/admin/desk/Icon";
import { Chip, Panel, ViewSwitch } from "@/components/admin/desk/parts";
import { flashOf, qs, readParams, type SP } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";
import { recurringMonthly } from "@/lib/admin/metrics";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Markets & operators — RentLeaks desk" };

const OP_KIND: Record<string, string> = { landlord: "Landlord", portfolio: "Portfolio", coliving: "Co-living" };

export default async function MarketsAdmin({ searchParams }: { searchParams: SP }) {
  await requireAdminPage("/admin/markets");
  const p = await readParams(searchParams);
  const tab = p.tab === "operators" ? "operators" : "markets";
  const [cities, listings, operators, leadsByCity] = await Promise.all([
    prisma.city.findMany({ orderBy: [{ rank: "asc" }] }),
    prisma.listing.findMany({ select: { cityId: true, operatorId: true, status: true, housingType: true, plan: true, sponsored: true, moderation: true, availableUntil: true } }),
    prisma.operator.findMany({ orderBy: { name: "asc" } }),
    prisma.lead.groupBy({ by: ["cityId"], _count: { _all: true } }),
  ]);
  const group = (key: "cityId" | "operatorId") => {
    const m = new Map<string, { total: number; live: number; sponsored: number; noEnd: number; mrr: number }>();
    for (const l of listings) {
      const k = l[key];
      if (!k) continue;
      const cur = m.get(k) ?? { total: 0, live: 0, sponsored: 0, noEnd: 0, mrr: 0 };
      cur.total += 1;
      if (l.status === "active" && l.moderation === "approved") cur.live += 1;
      if (l.sponsored) cur.sponsored += 1;
      if (!l.availableUntil) cur.noEnd += 1;
      if (l.moderation === "approved") cur.mrr += recurringMonthly([l]);
      m.set(k, cur);
    }
    return m;
  };
  const byCity = group("cityId");
  const byOp = group("operatorId");
  const leadsOf = new Map(leadsByCity.map((l) => [l.cityId ?? "", l._count._all]));
  const featured = cities.filter((c) => c.featured).length;
  const countries = [...new Set(cities.map((c) => c.countryName))];
  const self = (over: Record<string, string | undefined> = {}) => `/admin/markets${qs(p, { ok: undefined, err: undefined, ...over })}`;
  const EMPTY = { total: 0, live: 0, sponsored: 0, noEnd: 0, mrr: 0 };

  return (
    <div className="dk-stack">
      <DeskHeader
        href="/admin/markets"
        flash={flashOf(p)}
        signals={[
          { label: "Markets", value: `${cities.length} in ${countries.length} countries`, tone: "live" },
          { label: "Featured", value: `${featured}`, tone: "ok" },
          { label: "Operators", value: `${operators.length}`, tone: "ok", href: self({ tab: "operators" }) },
          { label: "Without an end date", value: `${listings.filter((l) => !l.availableUntil).length} listings`, tone: "warn" },
        ]}
      />

      <div className="dk-kpis">
        <Kpi label="Markets" value={cities.length} href={self({ tab: undefined })} active={tab === "markets"} />
        <Kpi label="Featured" value={featured} />
        <Kpi label="Operators" value={operators.length} href={self({ tab: "operators" })} active={tab === "operators"} />
        <Kpi label="With listings" value={byCity.size} sub={`${cities.length - byCity.size} still empty`} />
        <Kpi label="Recurring" value={Math.round([...byCity.values()].reduce((n, v) => n + v.mrr, 0))} fmt="usd" sub="per month, all markets" tone="value" />
      </div>

      <div className="dk-grid dk-grid--2">
        <Panel title="Biggest markets" sub="By listings — click to open them.">
          <RankedBars
            rows={[...byCity.entries()]
              .sort((a, b) => b[1].total - a[1].total)
              .slice(0, 10)
              .map(([id, v]) => ({ key: id, label: cities.find((c) => c.id === id)?.name ?? id, value: v.total, href: `/admin/listings?city=${id}` }))}
          />
        </Panel>
        <Panel title="Where renters ask" sub="Leads by city, all time.">
          <Donut
            items={leadsByCity
              .filter((l) => l.cityId)
              .sort((a, b) => b._count._all - a._count._all)
              .slice(0, 6)
              .map((l) => ({ label: cities.find((c) => c.id === l.cityId)?.name ?? String(l.cityId), value: l._count._all, href: `/admin/leads?city=${l.cityId}` }))}
            centerLabel="LEADS"
          />
        </Panel>
      </div>

      <ViewSwitch
        items={[
          { key: "markets", label: "Markets", href: self({ tab: undefined }), on: tab === "markets", icon: "markets", count: cities.length },
          { key: "operators", label: "Operators", href: self({ tab: "operators" }), on: tab === "operators", icon: "accounts", count: operators.length },
        ]}
      />

      {tab === "markets" ? (
        <Panel flush title="Markets" sub="Ranking, featured markets and the medians behind the Leak Score. Re-running the catalogue seed resets these.">
          <div className="dk-tablewrap">
            <table className="dk-table">
              <thead>
                <tr>
                  <th>Market</th>
                  <th className="dk-right">Listings</th>
                  <th className="dk-right">Live</th>
                  <th className="dk-right">Leads</th>
                  <th className="dk-right">No end date</th>
                  <th className="dk-right">$/mo</th>
                  <th>Rank · median room · median furnished · featured</th>
                </tr>
              </thead>
              <tbody>
                {cities.map((c) => {
                  const v = byCity.get(c.id) ?? EMPTY;
                  return (
                    <tr key={c.id}>
                      <td className="dk-wrap">
                        <Link prefetch={false} href={`/admin/listings?city=${c.id}`}>
                          <b>{c.name}</b>
                        </Link>
                        <div className="dk-dim">
                          {c.countryName} · {c.currency}
                          {c.featured ? " · " : ""}
                          {c.featured ? <Chip tone="value">featured</Chip> : null}
                        </div>
                      </td>
                      <td className="dk-right">{v.total || "—"}</td>
                      <td className="dk-right">{v.live || "—"}</td>
                      <td className="dk-right">{leadsOf.get(c.id) || "—"}</td>
                      <td className={`dk-right${v.noEnd ? " dk-warn" : ""}`}>{v.noEnd || "—"}</td>
                      <td className="dk-right" style={{ color: "var(--dk-ochre)", fontWeight: 650 }}>
                        {v.mrr ? `$${Math.round(v.mrr).toLocaleString("en-US")}` : "—"}
                      </td>
                      <td>
                        <form action={saveCity} className="dk-inline">
                          <input type="hidden" name="id" value={c.id} />
                          <input name="rank" type="number" min={1} defaultValue={c.rank} aria-label="Rank" className="dk-w-num" />
                          <input name="avgRoom" type="number" min={0} defaultValue={c.avgRoom} aria-label="Median room" className="dk-w-num" />
                          <input name="avgFurnished" type="number" min={0} defaultValue={c.avgFurnished} aria-label="Median furnished" className="dk-w-num" />
                          <label className="dk-check">
                            <input name="featured" type="checkbox" defaultChecked={c.featured} /> featured
                          </label>
                          <button className="dk-btn dk-btn--sm" type="submit">
                            Save
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : (
        <div className="dk-grid dk-grid--1-2">
          <Panel id="operators" kicker="Add" title="New operator" sub="Landlords, portfolios and co-living brands shown on listing pages.">
            <form action={saveOperator} className="dk-form">
              <label className="dk-field dk-field--wide">
                <span>Name</span>
                <input name="name" required />
              </label>
              <label className="dk-field">
                <span>Kind</span>
                <select name="kind" defaultValue="landlord">
                  <option value="landlord">Landlord</option>
                  <option value="portfolio">Portfolio</option>
                  <option value="coliving">Co-living</option>
                </select>
              </label>
              <label className="dk-field">
                <span>Since</span>
                <input name="since" type="number" placeholder="2019" />
              </label>
              <label className="dk-field dk-field--wide">
                <span>Tagline</span>
                <input name="tagline" />
              </label>
              <label className="dk-field dk-field--wide">
                <span>Where they operate</span>
                <input name="scope" placeholder="Brooklyn & Queens" />
              </label>
              <button className="dk-btn dk-btn--primary" type="submit">
                <Icon name="plus" size={14} /> Add operator
              </button>
            </form>
          </Panel>
          <Panel flush title={`Operators · ${operators.length}`}>
            <div className="dk-tablewrap">
              <table className="dk-table">
                <thead>
                  <tr>
                    <th>Listings</th>
                    <th>Operator</th>
                  </tr>
                </thead>
                <tbody>
                  {operators.map((o) => {
                    const v = byOp.get(o.id) ?? EMPTY;
                    return (
                      <tr key={o.id}>
                        <td style={{ minWidth: 120 }}>
                          <Link prefetch={false} href={`/admin/listings?q=${encodeURIComponent(o.name)}`}>
                            <b>{v.total}</b> listings
                          </Link>
                          <div className="dk-dim">
                            {v.live} live · {OP_KIND[o.kind] ?? o.kind}
                          </div>
                        </td>
                        <td>
                          <form action={saveOperator} className="dk-inline">
                            <input type="hidden" name="id" value={o.id} />
                            <input name="name" defaultValue={o.name} aria-label="Name" />
                            <select name="kind" defaultValue={o.kind} aria-label="Kind">
                              <option value="landlord">Landlord</option>
                              <option value="portfolio">Portfolio</option>
                              <option value="coliving">Co-living</option>
                            </select>
                            <input name="tagline" defaultValue={o.tagline} aria-label="Tagline" placeholder="Tagline" />
                            <input name="scope" defaultValue={o.scope} aria-label="Scope" placeholder="Scope" />
                            <input name="since" type="number" defaultValue={o.since ?? ""} aria-label="Since" className="dk-w-num" />
                            <button className="dk-btn dk-btn--sm" type="submit">
                              Save
                            </button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
