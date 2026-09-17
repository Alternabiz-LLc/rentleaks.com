import Link from "next/link";
import { Kpi } from "@/components/admin/desk/charts";
import { DeskHeader } from "@/components/admin/desk/DeskHeader";
import { Icon } from "@/components/admin/desk/Icon";
import { Chip, Empty, Panel } from "@/components/admin/desk/parts";
import { flashOf, qs, readParams, type SP } from "@/components/admin/ui";
import { canAccess } from "@/lib/access";
import { requireAdminPage } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { typeLabel } from "@/lib/site";
import { BANDS, bandOf, loadDemand } from "@/lib/ops/demand";

export const metadata = { title: "Demand map — RentLeaks desk" };

const TYPES = ["room", "coliving", "furnished", "short-term", "aparthotel", "lease-break", "any"];
const typeName = (t: string) => (t === "any" ? "Any type" : typeLabel(t).replace(/ \(.*\)/, ""));
const money = (n: number | null) => (n ? `$${Math.round(n).toLocaleString("en-US")}` : "—");

/**
 * Demand Map: 1 see where renters want homes, 2 pick a gap, 3 recruit hosts
 * for exactly that gap (outreach, free-week invites or an ad).
 */
export default async function DemandPage({ searchParams }: { searchParams: SP }) {
  const me = await requireAdminPage("/admin/demand");
  const p = await readParams(searchParams);
  const [{ wants, haves, cells, examplesHidden }, cities] = await Promise.all([loadDemand(90), prisma.city.findMany({ select: { id: true, name: true, rank: true } })]);
  const self = (over: Record<string, string | undefined> = {}) => `/admin/demand${qs(p, { ok: undefined, err: undefined, ...over })}`;
  const name = (id: string) => cities.find((c) => c.id === id)?.name ?? id;

  const cityRows = [...new Set(cells.map((c) => c.cityId))]
    .map((id) => ({ id, demand: cells.filter((c) => c.cityId === id).reduce((n, c) => n + c.demand, 0), gap: cells.filter((c) => c.cityId === id).reduce((n, c) => n + c.gap, 0) }))
    .sort((a, b) => b.demand - a.demand)
    .slice(0, 20);
  const maxGap = Math.max(1, ...cells.map((c) => c.gap));
  const cols = TYPES.filter((t) => cells.some((c) => c.type === t));
  const gaps = cells.filter((c) => c.gap > 0).slice(0, 8);
  const city = p.city && cityRows.some((c) => c.id === p.city) ? p.city : cityRows[0]?.id ?? "";
  const bandDemand = (key: string) => wants.filter((w) => w.cityId === city && w.maxUsd && bandOf(w.maxUsd) === key).length;
  const bandSupply = (key: string) => haves.filter((h) => h.cityId === city && bandOf(h.usd) === key).length;
  const bandMax = Math.max(1, ...BANDS.map((b) => Math.max(bandDemand(b.key), bandSupply(b.key))));
  const requests = wants.filter((w) => w.source === "request").length;
  const searches = wants.length - requests;

  return (
    <div className="dk-stack">
      <DeskHeader
        href="/admin/demand"
        flash={flashOf(p)}
        signals={[
          { label: "Renters asking · 90 days", value: `${requests} requests · ${searches} saved searches`, tone: "live" },
          { label: "Biggest gap", value: gaps[0] ? `${typeName(gaps[0].type)} in ${name(gaps[0].cityId)} · ${gaps[0].gap} unmet` : "none", tone: gaps[0] ? "critical" : "ok" },
          { label: "Live supply", value: `${haves.length} real homes${examplesHidden ? ` · ${examplesHidden} examples left out` : ""}`, tone: "ok" },
        ]}
      />

      <div className="dk-kpis">
        <Kpi label="Demand signals" value={wants.length} sub="requests + saved searches, 90 days" />
        <Kpi label="Markets with a gap" value={new Set(gaps.map((g) => g.cityId)).size} tone={gaps.length ? "alert" : undefined} />
        <Kpi label="Unmet renters" value={cells.reduce((n, c) => n + c.gap, 0)} sub="wanting more than affordable supply" />
        <Kpi label="Live homes" value={haves.length} sub="real listings only" tone="good" />
      </div>

      <div className="dk-grid dk-grid--2-1">
        <Panel flush kicker="1 · See" title="Demand against affordable supply" sub="Each cell: renters asking / live homes within their median budget. Darker = bigger gap.">
          {cityRows.length === 0 ? (
            <Empty title="No demand recorded yet.">Requests and saved searches with a city show up here.</Empty>
          ) : (
            <div className="dk-tablewrap">
              <table className="dk-table dk-heat">
                <thead>
                  <tr>
                    <th>Market</th>
                    {cols.map((t) => (
                      <th key={t} className="dk-right">
                        {typeName(t)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cityRows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link prefetch={false} href={self({ city: r.id })} scroll={false}>
                          <b>{name(r.id)}</b>
                        </Link>
                        <div className="dk-dim">{r.demand} asking</div>
                      </td>
                      {cols.map((t) => {
                        const c = cells.find((x) => x.cityId === r.id && x.type === t);
                        if (!c) return <td key={t} className="dk-right dk-dim">·</td>;
                        const heat = c.gap / maxGap;
                        return (
                          <td key={t} className="dk-right dk-heat__cell" style={{ ["--heat" as string]: heat.toFixed(2) }} title={`${c.demand} asking · ${c.affordable} of ${c.supply} live homes within ${money(c.budget)}`}>
                            <b>{c.demand}</b>
                            <span>/{c.affordable}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="dk-stack">
          <Panel kicker="2 · Pick a gap" title="Where to recruit first">
            {gaps.length === 0 ? (
              <Empty title="Supply covers demand everywhere." />
            ) : (
              <ul className="dk-gaps">
                {gaps.map((g) => (
                  <li key={`${g.cityId}-${g.type}`}>
                    <div>
                      <b>
                        {typeName(g.type)} · {name(g.cityId)}
                      </b>
                      <small>
                        {g.demand} asking at ~{money(g.budget)} · {g.affordable} live within budget
                      </small>
                    </div>
                    <Chip tone="bad">{g.gap} unmet</Chip>
                    <div className="dk-gaps__act">
                      <span className="dk-kicker">3 · Recruit</span>
                      {canAccess(me, "outreach") ? (
                        <Link prefetch={false} className="dk-btn dk-btn--sm" href="/admin/outreach">
                          <Icon name="outreach" size={13} /> Outreach
                        </Link>
                      ) : null}
                      {canAccess(me, "trials") ? (
                        <Link prefetch={false} className="dk-btn dk-btn--sm" href="/admin/trials#invite">
                          <Icon name="ticket" size={13} /> Free week
                        </Link>
                      ) : null}
                      {canAccess(me, "ads") ? (
                        <Link
                          prefetch={false}
                          className="dk-btn dk-btn--sm dk-btn--primary"
                          href={`/admin/ads${qs({}, { tab: "create", name: `Hosts — ${typeName(g.type)} in ${name(g.cityId)}`, objective: "hosts" })}`}
                        >
                          <Icon name="ads" size={13} /> Host ad
                        </Link>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {city ? (
            <Panel title={`Budgets in ${name(city)}`} sub="What renters can pay against what's listed.">
              <ul className="dk-bands">
                {BANDS.map((b) => (
                  <li key={b.key}>
                    <span>{b.label}</span>
                    <span className="dk-bands__bars">
                      <i className="is-demand" style={{ width: `${(bandDemand(b.key) / bandMax) * 100}%` }} />
                      <i className="is-supply" style={{ width: `${(bandSupply(b.key) / bandMax) * 100}%` }} />
                    </span>
                    <b>
                      {bandDemand(b.key)} / {bandSupply(b.key)}
                    </b>
                  </li>
                ))}
              </ul>
              <p className="dk-legend" style={{ marginTop: 10 }}>
                <i className="dk-legend__a" /> renters asking <i className="dk-legend__b" /> live homes
              </p>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
