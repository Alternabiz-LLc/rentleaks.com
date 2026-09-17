import Link from "next/link";
import { complianceAction, opsSettingAction } from "@/app/admin/_actions/ops";
import { BulkForm, SelectAll } from "@/components/admin/desk/BulkForm";
import { Gauge, Kpi, RankedBars } from "@/components/admin/desk/charts";
import { DeskHeader } from "@/components/admin/desk/DeskHeader";
import { Chip, CommandRail, Empty, Panel, ViewSwitch } from "@/components/admin/desk/parts";
import { flashOf, qs, readParams, when, type SP } from "@/components/admin/ui";
import { canAccess } from "@/lib/access";
import { requireAdminPage } from "@/lib/admin/guard";
import { nowMs } from "@/lib/admin/metrics";
import { prisma } from "@/lib/prisma";
import { sampleCatalogIds } from "@/lib/sample-catalog";
import { auditListing, CHECK_LABEL, freshnessOf, type Freshness } from "@/lib/ops/catalogue";
import { freshnessOn } from "@/lib/ops/freshness";

export const metadata = { title: "Compliance & freshness — RentLeaks desk" };

const DAY = 86_400_000;
const FRESH_LABEL: Record<Freshness, { label: string; tone: "good" | "warn" | "bad" | "brand" | "ink" }> = {
  fresh: { label: "Fresh", tone: "good" },
  due: { label: "Due a check", tone: "warn" },
  asked: { label: "Asked, waiting", tone: "brand" },
  stale: { label: "Stale", tone: "bad" },
  silent: { label: "No answer — pauses next run", tone: "bad" },
};

/**
 * Catalogue health in two tabs. Rules: the publication gate re-run over every
 * stored listing, with bulk "please fix" emails. Freshness: who confirmed
 * their home is still available, and who needs asking.
 */
export default async function CompliancePage({ searchParams }: { searchParams: SP }) {
  const me = await requireAdminPage("/admin/compliance");
  const p = await readParams(searchParams);
  const t = nowMs();
  const tab = p.tab === "freshness" ? "freshness" : "rules";
  const self = (over: Record<string, string | undefined> = {}) => `/admin/compliance${qs(p, { ok: undefined, err: undefined, ...over })}`;

  let sample: Set<string> | null = null;
  try {
    sample = await sampleCatalogIds();
  } catch {
    sample = null;
  }
  const [rows, cities, fresh] = await Promise.all([
    prisma.listing.findMany({
      where: { moderation: { not: "declined" } },
      select: {
        id: true, listedBy: true, housingType: true, cityId: true, title: true, neighborhood: true, address: true, description: true, price: true, deposit: true,
        feesJson: true, availableFrom: true, availableUntil: true, minStayMonths: true, maxStayMonths: true, leaseEnd: true, consentStatus: true, registrationNumber: true,
        image: true, detail: true, status: true, moderation: true, postedAt: true, confirmedAt: true, freshnessAskedAt: true, fixRequestedAt: true, updatedAt: true,
        city: { select: { slug: true, name: true, state: true, country: true } },
        host: { select: { name: true, email: true } },
      },
      orderBy: { postedAt: "desc" },
      take: 3000,
    }),
    prisma.city.findMany({ select: { id: true, name: true } }),
    freshnessOn(),
  ]);
  const real = rows.filter((r) => !sample?.has(r.id));
  const hidden = rows.length - real.length;
  const audited = real.map((r) => ({ r, a: auditListing(r), f: freshnessOf(r, t) }));

  /* ---- rules ---- */
  const failingAny = audited.filter((x) => x.a.failing.length);
  const blocking = audited.filter((x) => x.a.blocking);
  const avg = audited.length ? Math.round(audited.reduce((n, x) => n + x.a.score, 0) / audited.length) : 100;
  const checkCounts = new Map<string, number>();
  for (const x of audited) for (const f of x.a.failing) checkCounts.set(f.id, (checkCounts.get(f.id) ?? 0) + 1);
  const check = p.check && checkCounts.has(p.check) ? p.check : "";
  const city = p.city && cities.some((c) => c.id === p.city) ? p.city : "";
  const ruleRows = audited
    .filter((x) => (check ? x.a.failing.some((f) => f.id === check) : x.a.failing.length > 0) && (!city || x.r.cityId === city))
    .sort((a, b) => b.a.blocking - a.a.blocking || a.a.score - b.a.score)
    .slice(0, 200);
  const byCity = cities
    .map((c) => {
      const mine = audited.filter((x) => x.r.cityId === c.id);
      return { key: c.id, label: c.name, value: mine.length ? Math.round((mine.filter((x) => !x.a.blocking).length / mine.length) * 100) : -1, total: mine.length };
    })
    .filter((c) => c.total > 0)
    .sort((a, b) => a.value - b.value);
  const requested30 = real.filter((r) => r.fixRequestedAt && t - r.fixRequestedAt.getTime() < 30 * DAY).length;

  /* ---- freshness ---- */
  const live = audited.filter((x) => x.r.status !== "paused" && x.r.moderation === "approved");
  const fCount = (s: Freshness) => live.filter((x) => x.f.state === s).length;
  const state = (["fresh", "due", "asked", "stale", "silent"] as Freshness[]).includes(p.state as Freshness) ? (p.state as Freshness) : "";
  const freshRows = live
    .filter((x) => (state ? x.f.state === state : x.f.state !== "fresh"))
    .sort((a, b) => b.f.days - a.f.days)
    .slice(0, 200);
  const freshPct = live.length ? Math.round((fCount("fresh") / live.length) * 100) : 100;
  const cityName = (id: string) => cities.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="dk-stack">
      <DeskHeader
        href="/admin/compliance"
        flash={flashOf(p)}
        signals={[
          { label: "Rule health", value: `${avg}% · ${blocking.length} blocking`, tone: blocking.length ? "critical" : "live", href: self({ tab: undefined }) },
          { label: "Freshness", value: `${freshPct}% confirmed in 2 weeks`, tone: freshPct >= 70 ? "live" : "warn", href: self({ tab: "freshness" }) },
          {
            label: "Weekly check",
            value: fresh ? "on — asks and auto-pauses" : "off",
            tone: fresh ? "ok" : "warn",
            href: canAccess(me, "automation") ? "/admin/playbooks#settings" : undefined,
          },
        ]}
      />

      <div className="dk-kpis">
        <Kpi label="Health score" value={avg} fmt="pct" sub={`${audited.length} real listings${hidden ? ` · ${hidden} examples hidden` : ""}`} tone={avg >= 85 ? "good" : "alert"} />
        <Kpi label="Blocking issues" value={blocking.length} sub="would fail the gate today" tone={blocking.length ? "alert" : undefined} href={self({ tab: undefined, check: undefined })} />
        <Kpi label="Fix requests" value={requested30} sub="sent in 30 days" />
        <Kpi label="Fresh" value={fCount("fresh")} sub={`of ${live.length} live`} tone="good" href={self({ tab: "freshness", state: "fresh" })} />
        <Kpi label="Needs asking" value={fCount("due") + fCount("stale")} sub="not confirmed in 2+ weeks" href={self({ tab: "freshness", state: "due" })} />
        <Kpi label="No answer" value={fCount("silent")} sub="paused on the next run" tone={fCount("silent") ? "alert" : undefined} href={self({ tab: "freshness", state: "silent" })} />
      </div>

      <div className="dk-grid dk-grid--rail">
        <CommandRail
          title={tab === "rules" ? "Rules" : "Freshness"}
          sub={tab === "rules" ? "Pick a rule · tick · ask to fix" : "Pick a state · tick · ask"}
          tabs={
            tab === "rules"
              ? [
                  { key: "all", label: "Every failing listing", href: self({ check: undefined }), on: !check, count: failingAny.length },
                  ...[...checkCounts.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ key: id, label: CHECK_LABEL[id] ?? id, href: self({ check: id }), on: check === id, count: n })),
                ]
              : [
                  { key: "all", label: "Needs attention", href: self({ state: undefined }), on: !state, count: live.length - fCount("fresh") },
                  ...(["due", "stale", "asked", "silent", "fresh"] as Freshness[]).map((s) => ({ key: s, label: FRESH_LABEL[s].label, href: self({ state: s }), on: state === s, count: fCount(s) })),
                ]
          }
        />

        <div className="dk-stack">
          <Panel>
            <div className="dk-toolbar">
              <ViewSwitch
                items={[
                  { key: "rules", label: "01 Rules", href: self({ tab: undefined, state: undefined }), on: tab === "rules" },
                  { key: "freshness", label: "02 Freshness", href: self({ tab: "freshness", check: undefined }), on: tab === "freshness" },
                ]}
              />
              {tab === "rules" ? (
                <form method="get" className="dk-inline">
                  {check ? <input type="hidden" name="check" value={check} /> : null}
                  <select name="city" defaultValue={city} aria-label="Market">
                    <option value="">All markets</option>
                    {byCity.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <button className="dk-btn dk-btn--sm">Filter</button>
                </form>
              ) : null}
            </div>
          </Panel>

          {tab === "rules" ? (
            <>
              <div className="dk-grid dk-grid--2-1">
                <Panel flush title={check ? CHECK_LABEL[check] : "Listings that miss a rule"} sub="Tick listings, then send each host one email listing exactly what to fix.">
                  {ruleRows.length === 0 ? (
                    <Empty title="Every listing passes." />
                  ) : (
                    <BulkForm action={complianceAction} returnTo={self()} noun="listing" ops={[{ op: "fix", label: "Ask hosts to fix" }]}>
                      <div className="dk-tablewrap">
                        <table className="dk-table">
                          <thead>
                            <tr>
                              <th>
                                <SelectAll />
                              </th>
                              <th>Listing</th>
                              <th>Misses</th>
                              <th className="dk-right">Score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ruleRows.map(({ r, a }) => (
                              <tr key={r.id} data-row="">
                                <td>
                                  <input type="checkbox" name="ids" value={r.id} aria-label={`Select ${r.title}`} />
                                </td>
                                <td className="dk-wrap">
                                  <Link prefetch={false} href={`/admin/listings?edit=${r.id}`}>
                                    <b>{r.title}</b>
                                  </Link>
                                  <div className="dk-dim">
                                    {r.city.name} · {r.host.name}
                                    {r.fixRequestedAt ? ` · fix asked ${when(r.fixRequestedAt, false)}` : ""}
                                  </div>
                                </td>
                                <td className="dk-wrap">
                                  <div className="dk-chiprow dk-chiprow--tight">
                                    {a.failing.map((f) => (
                                      <span key={f.id} title={f.why} className={`dk-chip dk-chip--${f.blocking ? "bad" : "warn"}`}>
                                        {f.title}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="dk-right dk-num">{a.score}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </BulkForm>
                  )}
                </Panel>
                <div className="dk-stack">
                  <Panel>
                    <Gauge pct={avg} label="Catalogue health" sub="share of rules passed, all real listings" />
                  </Panel>
                  <Panel title="Pass rate by market" sub="Listings with no blocking issue.">
                    <RankedBars rows={byCity.map((c) => ({ key: c.key, label: c.label, value: Math.max(0, c.value), hint: `${c.total} listings`, href: self({ city: c.key }) }))} fmt="pct" empty="No listings yet." />
                  </Panel>
                  <Panel title="The rules behind this" sub="Each market's own rules, from the listing gate.">
                    <ul className="dk-rules">
                      <li>
                        <b>Every fee in the listing.</b> NYC&rsquo;s FARE Act requires all mandatory tenant fees in the ad; the FTC is consulting on total-price rules.
                      </li>
                      <li>
                        <b>No landlord broker fee to renters</b> where the law bars it.
                      </li>
                      <li>
                        <b>Fair-housing wording</b> — describe the home, never who should live there.
                      </li>
                    </ul>
                  </Panel>
                </div>
              </div>
            </>
          ) : (
            <Panel
              flush
              title={state ? FRESH_LABEL[state].label : "Listings to confirm"}
              sub={fresh ? "The weekly run asks automatically; tick listings to ask now. No answer in 7 days pauses the listing — the host brings it back with one tap." : "Weekly checks are off — ask by hand here."}
            >
              {freshRows.length === 0 ? (
                <Empty title="Everything live was confirmed in the last two weeks." />
              ) : (
                <BulkForm action={complianceAction} returnTo={self()} noun="listing" ops={[{ op: "ask", label: "Ask “still available?” now" }]}>
                  <div className="dk-tablewrap">
                    <table className="dk-table">
                      <thead>
                        <tr>
                          <th>
                            <SelectAll />
                          </th>
                          <th>Listing</th>
                          <th>State</th>
                          <th className="dk-right">Last confirmed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {freshRows.map(({ r, f }) => (
                          <tr key={r.id} data-row="">
                            <td>
                              <input type="checkbox" name="ids" value={r.id} aria-label={`Select ${r.title}`} />
                            </td>
                            <td className="dk-wrap">
                              <b>{r.title}</b>
                              <div className="dk-dim">
                                {cityName(r.cityId)} · {r.host.name}
                              </div>
                            </td>
                            <td>
                              <Chip tone={FRESH_LABEL[f.state].tone}>{FRESH_LABEL[f.state].label}</Chip>
                              {r.freshnessAskedAt ? <div className="dk-dim">asked {when(r.freshnessAskedAt, false)}</div> : null}
                            </td>
                            <td className="dk-right dk-num">{f.days} days ago</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </BulkForm>
              )}
              {canAccess(me, "automation") ? (
                <form action={opsSettingAction} className="dk-inline" style={{ padding: 16 }}>
                  <input type="hidden" name="key" value="freshness" />
                  <input type="hidden" name="returnTo" value={self()} />
                  <input type="hidden" name="value" value={fresh ? "off" : "on"} />
                  <button className="dk-btn dk-btn--sm">{fresh ? "Turn weekly checks off" : "Turn weekly checks on"}</button>
                </form>
              ) : null}
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
