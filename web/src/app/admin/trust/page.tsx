import Link from "next/link";
import { trustAction } from "@/app/admin/_actions/ops";
import { Kpi } from "@/components/admin/desk/charts";
import { DeskHeader } from "@/components/admin/desk/DeskHeader";
import { Icon } from "@/components/admin/desk/Icon";
import { ago, CommandRail, Empty, Panel } from "@/components/admin/desk/parts";
import { flashOf, qs, readParams, type SP } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";
import { nowMs } from "@/lib/admin/metrics";
import { KIND_LABEL, loadTrustSignals, type TrustKind } from "@/lib/ops/trust";

export const metadata = { title: "Trust radar — RentLeaks desk" };

const KINDS: TrustKind[] = ["photo", "text", "address", "price", "wording", "velocity", "messages", "reports"];
const KIND_ICON: Record<TrustKind, string> = { photo: "▣", text: "¶", address: "⌂", price: "$", wording: "!", velocity: "↯", messages: "✉", reports: "⚑" };

/**
 * Trust Radar: see the risk, check the evidence, act — in that order, on one
 * card. Nothing is automatic; dismissed signals stay quiet.
 */
export default async function TrustPage({ searchParams }: { searchParams: SP }) {
  await requireAdminPage("/admin/trust");
  const p = await readParams(searchParams);
  const t = nowMs();
  const { signals, scanned, samplesSkipped } = await loadTrustSignals(new Date(t));
  const kind = (KINDS as string[]).includes(p.kind) ? (p.kind as TrustKind) : "";
  const sev = ["high", "medium"].includes(p.sev) ? p.sev : "";
  const shown = signals.filter((s) => (!kind || s.kind === kind) && (!sev || s.severity === sev));
  const count = (k: TrustKind) => signals.filter((s) => s.kind === k).length;
  const high = signals.filter((s) => s.severity === "high").length;
  const self = (over: Record<string, string | undefined> = {}) => `/admin/trust${qs(p, { ok: undefined, err: undefined, ...over })}`;
  const back = self();

  return (
    <div className="dk-stack">
      <DeskHeader
        href="/admin/trust"
        flash={flashOf(p)}
        signals={[
          { label: "High risk", value: high ? `${high} to check now` : "none", tone: high ? "critical" : "live", href: self({ sev: "high", kind: undefined }) },
          { label: "Listings scanned", value: `${scanned.toLocaleString("en-US")}${samplesSkipped ? " · examples skipped" : ""}`, tone: "ok" },
          { label: "How it works", value: "see → check → act", tone: "ok" },
        ]}
        actions={
          <Link prefetch={false} className="dk-btn dk-btn--light" href="/admin/reports">
            <Icon name="shield" size={15} /> Member reports
          </Link>
        }
      />

      <div className="dk-kpis">
        <Kpi label="Open signals" value={signals.length} href={self({ kind: undefined, sev: undefined })} active={!kind && !sev} />
        <Kpi label="High risk" value={high} tone={high ? "alert" : undefined} href={self({ sev: "high", kind: undefined })} active={sev === "high"} />
        <Kpi label="Copied ads" value={count("photo") + count("text") + count("address")} sub="photo · text · address" href={self({ kind: "photo", sev: undefined })} />
        <Kpi label="Too cheap" value={count("price")} sub="under 55% of the market" href={self({ kind: "price", sev: undefined })} active={kind === "price"} />
        <Kpi label="Risky messages" value={count("messages") + count("wording")} sub="scam-guard flags" href={self({ kind: "messages", sev: undefined })} active={kind === "messages"} />
      </div>

      <div className="dk-grid dk-grid--rail">
        <CommandRail
          title="Radar"
          sub="See · check · act"
          tabs={[
            { key: "all", label: "Everything", href: self({ kind: undefined }), on: !kind, count: signals.length },
            ...KINDS.map((k) => ({ key: k, label: KIND_LABEL[k], href: self({ kind: k }), on: kind === k, count: count(k) || undefined })),
          ]}
        />
        <div className="dk-stack">
          {shown.length === 0 ? (
            <Panel>
              <Empty title={signals.length ? "Nothing in this view." : "All clear."}>
                The radar re-checks every listing and message each time this page opens: copied photos, copied text, shared addresses, rent under 55% of the market, scam wording, fast new accounts and flagged messages.
              </Empty>
            </Panel>
          ) : null}
          {shown.map((s) => (
            <article key={s.id} className={`dk-risk dk-risk--${s.severity}`}>
              <header className="dk-risk__head">
                <span className="dk-risk__icon" aria-hidden="true">
                  {KIND_ICON[s.kind]}
                </span>
                <div>
                  <p className="dk-kicker">
                    {KIND_LABEL[s.kind]} · {s.severity} risk · {ago(t - s.at.getTime())}
                  </p>
                  <h3>{s.title}</h3>
                  <p className="dk-hint">{s.detail}</p>
                </div>
              </header>
              <ul className="dk-risk__evidence">
                {s.evidence.map((e, i) => (
                  <li key={`${s.id}-${i}`}>
                    {e.image && /^(https:|\/)/.test(e.image) ? (
                      // eslint-disable-next-line @next/next/no-img-element -- evidence thumbnails from host uploads
                      <img src={e.image} alt="Shared photo" loading="lazy" />
                    ) : null}
                    <span>
                      <small>{e.label}</small>
                      {e.href ? (
                        <Link prefetch={false} href={e.href}>
                          {e.value}
                        </Link>
                      ) : (
                        <b>{e.value}</b>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <form action={trustAction} className="dk-risk__act">
                <input type="hidden" name="signal" value={s.id} />
                <input type="hidden" name="returnTo" value={back} />
                {s.listingIds.map((id) => (
                  <input key={id} type="hidden" name="listingIds" value={id} />
                ))}
                {s.userIds.map((id) => (
                  <input key={id} type="hidden" name="userIds" value={id} />
                ))}
                {(s.homes?.length ?? 0) > 1 || (s.people?.length ?? 0) > 1 ? (
                  <fieldset className="dk-risk__pick">
                    <input type="hidden" name="picking" value="1" />
                    <legend>Act on — newest first (usually the copy)</legend>
                    {s.homes && s.homes.length > 1
                      ? s.homes.slice(0, 12).map((h, i) => (
                          <label key={h.id} className="dk-check">
                            <input type="checkbox" name="pick" value={h.id} defaultChecked={i === 0} /> {h.title} <small>· {h.posted}</small>
                          </label>
                        ))
                      : null}
                    {s.people && s.people.length > 1
                      ? s.people.slice(0, 8).map((u, i) => (
                          <label key={u.id} className="dk-check">
                            <input type="checkbox" name="pickUser" value={u.id} defaultChecked={i === 0} /> {u.name} <small>· joined {u.since}</small>
                          </label>
                        ))
                      : null}
                    {(s.homes?.length ?? 0) > 12 || (s.people?.length ?? 0) > 8 ? (
                      <small>Showing the newest {Math.min(12, s.homes?.length ?? 0) || Math.min(8, s.people?.length ?? 0)} — open Listings to act on the rest.</small>
                    ) : null}
                  </fieldset>
                ) : null}
                <input name="note" placeholder="Note or suspension reason" aria-label="Note" maxLength={300} />
                {s.listingIds.length ? (
                  <button className="dk-btn dk-btn--sm" name="op" value="pause">
                    {s.listingIds.length > 1 ? "Pause ticked listings" : "Pause listing"}
                  </button>
                ) : null}
                {s.userIds.length ? (
                  <>
                    <button className="dk-btn dk-btn--sm" name="op" value="warn">
                      Warn their contacts
                    </button>
                    <button className="dk-btn dk-btn--sm dk-btn--danger" name="op" value="suspend">
                      {s.userIds.length > 1 ? "Suspend ticked accounts" : "Suspend account"}
                    </button>
                  </>
                ) : null}
                <button className="dk-btn dk-btn--ghost dk-btn--sm" name="op" value="dismiss">
                  <Icon name="check" size={13} /> Looks fine — dismiss
                </button>
              </form>
              {s.userIds.length > 1 ? <p className="dk-hint">Only the ticked accounts and listings are acted on. The original host is often the victim — check the dates first.</p> : null}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
