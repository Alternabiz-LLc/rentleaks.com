import Link from "next/link";
import { hostAction } from "@/app/admin/_actions/ops";
import { Kpi } from "@/components/admin/desk/charts";
import { DeskHeader } from "@/components/admin/desk/DeskHeader";
import { Icon } from "@/components/admin/desk/Icon";
import { RouteDrawer } from "@/components/admin/desk/RouteDrawer";
import { Avatar, Chip, CommandRail, Empty, MarkTile, Panel } from "@/components/admin/desk/parts";
import { flashOf, qs, readParams, when, type SP } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";
import { nowMs } from "@/lib/admin/metrics";
import { FEATURED_MONTHLY, FEATURED_WEEKLY } from "@/lib/plans";
import { appUrl } from "@/lib/site";
import { loadScorecards, minsLabel, nudgeDraft, scoreHost, sponsorDraft, WINDOW_DAYS, type Grade, type Weak } from "@/lib/ops/hosts";

export const metadata = { title: "Host scorecards — RentLeaks desk" };

const WEAK_LABEL: Record<Weak, string> = { quality: "Missing details", freshness: "Not confirmed", replies: "Leaves renters unanswered", speed: "Slow to reply" };
const FRESH_LABEL: Record<string, string> = { fresh: "fresh", due: "due a check", asked: "asked", stale: "stale", silent: "no answer" };

function Part({ label, value, hint }: { label: string; value: number; hint: string }) {
  const tone = value >= 80 ? "good" : value >= 60 ? "warn" : "bad";
  return (
    <li className={`is-${tone}`}>
      <span>{label}</span>
      <i style={{ ["--v" as string]: `${Math.max(2, Math.min(100, value))}%` }} />
      <b>{Math.round(value)}</b>
      <small>{hint}</small>
    </li>
  );
}

/**
 * Host scorecards: 1 see every host's grade, 2 open the weak ones, 3 send the
 * one nudge that fixes the weakest part — or reward the best with a sponsored
 * spot offer.
 */
export default async function HostsPage({ searchParams }: { searchParams: SP }) {
  await requireAdminPage("/admin/hosts");
  const p = await readParams(searchParams);
  const t = nowMs();
  const { cards, unavailable } = await loadScorecards(t);
  const self = (over: Record<string, string | undefined> = {}) => `/admin/hosts${qs(p, { ok: undefined, err: undefined, ...over })}`;
  const grade = (["A", "B", "C", "D"] as Grade[]).includes(p.grade as Grade) ? (p.grade as Grade) : null;
  const weak = (["quality", "freshness", "replies", "speed"] as Weak[]).includes(p.weak as Weak) ? (p.weak as Weak) : null;
  const q = (p.q ?? "").trim().toLowerCase();
  const shown = cards.filter((c) => (!grade || c.grade === grade) && (!weak || c.weakest === weak) && (!q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)));
  const count = (g: Grade) => cards.filter((c) => c.grade === g).length;
  const weakCount = (w: Weak) => cards.filter((c) => c.weakest === w).length;
  const withReplies = cards.filter((c) => c.replyMins !== null).map((c) => c.replyMins!).sort((a, b) => a - b);
  const medianReply = withReplies.length ? withReplies[Math.floor(withReplies.length / 2)] : null;
  const rates = cards.filter((c) => c.replyRate !== null);
  const avgRate = rates.length ? Math.round(rates.reduce((n, c) => n + c.replyRate!, 0) / rates.length) : null;
  const open = p.open ? cards.find((c) => c.id === p.open) : undefined;
  const base = appUrl().replace(/\/$/, "");

  return (
    <div className="dk-stack">
      <DeskHeader
        href="/admin/hosts"
        flash={flashOf(p)}
        signals={[
          { label: "Hosts graded", value: `${cards.length} · last ${WINDOW_DAYS} days`, tone: "live" },
          { label: "Grade A", value: `${count("A")} ready for a sponsored spot`, tone: count("A") ? "ok" : "warn", href: self({ grade: "A", weak: undefined }) },
          { label: "Need a nudge", value: `${count("C") + count("D")} graded C or D`, tone: count("D") ? "critical" : "ok", href: self({ grade: "D", weak: undefined }) },
        ]}
        actions={
          <Link prefetch={false} className="dk-btn dk-btn--light" href="/api/admin/export/hosts">
            <Icon name="export" size={15} /> Export CSV
          </Link>
        }
      />

      <div className="dk-kpis">
        <Kpi label="Hosts" value={cards.length} sub="with at least one real listing" />
        <Kpi label="Grade A" value={count("A")} tone="good" href={self({ grade: "A", weak: undefined })} active={grade === "A"} />
        <Kpi label="Grade C or D" value={count("C") + count("D")} tone={count("C") + count("D") ? "alert" : undefined} href={self({ grade: "D", weak: undefined })} active={grade === "D"} />
        <Kpi label="Typical first reply" value={medianReply === null ? "—" : minsLabel(medianReply)} sub="median across hosts" />
        <Kpi label="Reply rate" value={avgRate ?? 0} fmt="pct" sub={avgRate === null ? "no messages yet" : "threads answered"} tone={avgRate !== null && avgRate < 70 ? "alert" : undefined} />
      </div>

      <div className="dk-grid dk-grid--rail">
        <CommandRail
          title="Scorecards"
          sub="Grade · open · nudge"
          tabs={[
            { key: "all", label: "All hosts", href: self({ grade: undefined, weak: undefined }), on: !grade && !weak, count: cards.length },
            ...(["A", "B", "C", "D"] as Grade[]).map((g) => ({ key: g, label: `Grade ${g}`, href: self({ grade: g, weak: undefined }), on: grade === g, count: count(g) })),
          ]}
          quick={{
            title: "Fix first",
            items: (["replies", "speed", "freshness", "quality"] as Weak[]).map((w) => ({
              label: WEAK_LABEL[w],
              href: self({ weak: w, grade: undefined }),
              mark: <MarkTile bg={w === "replies" || w === "speed" ? "var(--dk-warn, #d88a16)" : undefined}>{weakCount(w)}</MarkTile>,
            })),
          }}
        />

        <Panel
          flush
          kicker="1 · See"
          title={grade ? `Grade ${grade} hosts` : weak ? WEAK_LABEL[weak] : "Every host, best first"}
          sub="Score = listing quality 30% · freshness 25% · reply rate 30% · reply speed 15%. Example listings and desk accounts are left out."
          actions={
            <form className="dk-inline" action="/admin/hosts">
              {grade ? <input type="hidden" name="grade" value={grade} /> : null}
              <input name="q" defaultValue={p.q ?? ""} placeholder="Find a host" aria-label="Find a host" />
            </form>
          }
        >
          {unavailable ? (
            <Empty title="Couldn't read the example list.">Scorecards stay hidden rather than grade example homes as real ones. Try again in a minute.</Empty>
          ) : shown.length === 0 ? (
            <Empty title={cards.length ? "No host matches." : "No hosts yet."}>{cards.length ? "Clear the filter to see everyone." : "Hosts appear once they list a home."}</Empty>
          ) : (
            <div className="dk-tablewrap">
              <table className="dk-table dk-hosts">
                <thead>
                  <tr>
                    <th>Host</th>
                    <th>Grade</th>
                    <th className="dk-right">Live</th>
                    <th className="dk-right">Quality</th>
                    <th className="dk-right">Fresh</th>
                    <th className="dk-right">Replies</th>
                    <th className="dk-right">Booked</th>
                    <th>Fix first</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.slice(0, 200).map((c) => (
                    <tr key={c.id} className={open?.id === c.id ? "is-on" : undefined}>
                      <td>
                        <Link prefetch={false} className="dk-who" href={self({ open: c.id })} scroll={false}>
                          <Avatar name={c.name} email={c.email} />
                          <span>
                            <b>{c.name}</b>
                            <small>{c.email}</small>
                          </span>
                        </Link>
                      </td>
                      <td>
                        <span className={`dk-grade dk-grade--${c.grade}`} title={`Host score ${c.score} of 100`}>
                          {c.grade} · {c.score}
                        </span>
                      </td>
                      <td className="dk-right">
                        {c.live}
                        {c.listings > c.live ? <span className="dk-dim">/{c.listings}</span> : null}
                        {c.sponsored ? <Chip tone="value">sponsored</Chip> : null}
                      </td>
                      <td className="dk-right">{c.quality}%</td>
                      <td className="dk-right">{c.live ? `${c.freshPct}%` : "—"}</td>
                      <td className="dk-right">
                        {c.replyRate === null ? (
                          <span className="dk-dim">no threads</span>
                        ) : (
                          <>
                            {c.replyRate}%<div className="dk-dim">{`of ${c.threads} · ${minsLabel(c.replyMins)}`}</div>
                          </>
                        )}
                      </td>
                      <td className="dk-right" title={`${c.leads} requests on these homes in ${WINDOW_DAYS} days`}>
                        <b>{c.booked}</b>
                        <div className="dk-dim">of {c.leads} leads</div>
                      </td>
                      <td>{c.weakest ? <Chip tone={c.weakest === "replies" || c.weakest === "speed" ? "warn" : "bad"}>{WEAK_LABEL[c.weakest]}</Chip> : <Chip tone="good">all good</Chip>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {open ? (
        (() => {
          const s = scoreHost(open);
          const nudge = nudgeDraft(open, base);
          const sponsor = sponsorDraft(open, base, `${FEATURED_WEEKLY.label} or ${FEATURED_MONTHLY.label}`);
          const canSponsor = (open.grade === "A" || open.grade === "B") && open.live > open.sponsored;
          return (
            <RouteDrawer closeHref={self({ open: undefined })} kicker={`Host since ${when(open.since, false)} · score ${open.score}`} title={open.name} width={660}>
              <div className="dk-dossier">
                <div className="dk-chiprow">
                  <span className={`dk-grade dk-grade--${open.grade}`}>
                    {open.grade} · {open.score}
                  </span>
                  <Chip tone="brand">{`${open.live} live of ${open.listings}`}</Chip>
                  {open.sponsored ? <Chip tone="value">{`${open.sponsored} sponsored`}</Chip> : null}
                  <Link prefetch={false} className="dk-chip dk-chip--brand" href={`/admin/accounts/${open.id}`}>
                    account
                  </Link>
                  <Link prefetch={false} className="dk-chip" href={`/admin/listings?q=${encodeURIComponent(open.email)}`}>
                    listings
                  </Link>
                </div>

                <p className="dk-kicker">2 · Why this grade</p>
                <ul className="dk-parts">
                  <Part label="Listing quality" value={s.parts.quality} hint="checks passed, average" />
                  <Part label="Freshness" value={s.parts.freshness} hint="live homes confirmed in 2 weeks" />
                  <Part label="Reply rate" value={s.parts.replies} hint={open.replyRate === null ? "no threads yet — neutral" : `${open.threads} threads`} />
                  <Part label="Reply speed" value={s.parts.speed} hint={open.replyMins === null ? "no replies yet — neutral" : `typically ${minsLabel(open.replyMins)}`} />
                </ul>

                <ul className="dk-list">
                  {open.homes.slice(0, 12).map((h) => (
                    <li key={h.id}>
                      <Link prefetch={false} href={`/admin/listings?edit=${h.id}`}>
                        <b>{h.title}</b>
                      </Link>
                      <small>
                        {h.live ? "live" : "not live"} · {h.quality}% · {FRESH_LABEL[h.fresh] ?? h.fresh}
                        {h.failing.length ? ` · missing: ${h.failing.slice(0, 3).join(", ")}` : ""}
                      </small>
                    </li>
                  ))}
                </ul>

                <p className="dk-kicker">3 · Act</p>
                <form action={hostAction} className="dk-form">
                  <input type="hidden" name="hostId" value={open.id} />
                  <input type="hidden" name="returnTo" value={self()} />
                  <label className="dk-field">
                    <span>{open.weakest ? `Nudge — ${WEAK_LABEL[open.weakest].toLowerCase()}` : "Thank-you note"}</span>
                    <input name="subject" defaultValue={nudge.subject} required />
                  </label>
                  <label className="dk-field dk-field--wide">
                    <span>Message</span>
                    <textarea name="body" rows={8} defaultValue={nudge.body} required />
                  </label>
                  <div className="dk-inline">
                    <button className="dk-btn dk-btn--primary" name="op" value="nudge">
                      <Icon name="mail" size={14} /> Send
                    </button>
                    <label className="dk-check">
                      <input type="checkbox" name="again" value="1" /> send anyway if already sent this week
                    </label>
                  </div>
                </form>

                {canSponsor ? (
                  <details className="dk-details">
                    <summary>
                      <Icon name="star" size={14} /> Offer a sponsored spot
                    </summary>
                    <form action={hostAction} className="dk-form">
                      <input type="hidden" name="hostId" value={open.id} />
                      <input type="hidden" name="returnTo" value={self()} />
                      <label className="dk-field">
                        <span>Subject</span>
                        <input name="subject" defaultValue={sponsor.subject} required />
                      </label>
                      <label className="dk-field dk-field--wide">
                        <span>Message</span>
                        <textarea name="body" rows={7} defaultValue={sponsor.body} required />
                      </label>
                      <button className="dk-btn" name="op" value="sponsor">
                        <Icon name="mail" size={14} /> Send offer
                      </button>
                    </form>
                  </details>
                ) : null}
              </div>
            </RouteDrawer>
          );
        })()
      ) : null}
    </div>
  );
}
