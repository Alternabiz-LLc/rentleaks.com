import Link from "next/link";
import { notFound } from "next/navigation";
import { accountAction } from "@/app/admin/_actions/accounts";
import { clientEmail, clientFollowUp, noteAction } from "@/app/admin/_actions/clients";
import { Gauge, Kpi } from "@/components/admin/desk/charts";
import { DeskHeader } from "@/components/admin/desk/DeskHeader";
import { Icon } from "@/components/admin/desk/Icon";
import { ago, Avatar, Chip, Empty, Panel, ViewSwitch, type ChipTone } from "@/components/admin/desk/parts";
import { flashOf, qs, readParams, when, type SP } from "@/components/admin/ui";
import { canAccess, isFounder } from "@/lib/access";
import { requireAdminPage } from "@/lib/admin/guard";
import { nowMs } from "@/lib/admin/metrics";
import { CATEGORY, fmtCents } from "@/lib/books/core";
import { loadClient } from "@/lib/clients/account";
import { ENGAGEMENT_STAGE, PACKAGE, type EngagementStatus } from "@/lib/enterprise/catalog";
import { clientEnterprise } from "@/lib/enterprise/data";
import type { DeskIcon } from "@/lib/admin/nav";

export const metadata = { title: "Client account — RentLeaks desk" };

const TABS = ["overview", "money", "listings", "activity", "notes"] as const;
type Tab = (typeof TABS)[number];
const INV_TONE: Record<string, ChipTone> = { draft: "ink", sent: "brand", due_soon: "warn", overdue: "bad", paid: "good", void: "" };
const EVENT_ICON: Record<string, DeskIcon> = {
  signup: "user",
  signin: "lock",
  listing: "listings",
  payment: "revenue",
  invoice: "invoice",
  paid: "check",
  lead: "leads",
  booking: "calendar",
  report: "flag",
  email: "mail",
  call: "phone",
  note: "check",
  desk: "shield",
  trial: "ticket",
  stage: "crm",
};
const WEAK: Record<string, string> = { quality: "missing listing details", freshness: "homes not confirmed", replies: "leaves renters unanswered", speed: "slow replies" };

/**
 * One client, everything the desk knows: 1 read the health and suggestions,
 * 2 look through money, listings and activity, 3 act (email, follow-up, note,
 * invoice, free days) without leaving the page.
 */
export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const me = await requireAdminPage(`/admin/accounts/${id}`);
  const p = await readParams(searchParams);
  const t = nowMs();
  const c = await loadClient(id, new Date(t));
  if (!c) notFound();
  const { user, facts, health } = c;
  const money = canAccess(me, "books") || canAccess(me, "revenue");
  const tabs = TABS.filter((x) => (x === "money" ? money : x === "listings" ? user.role === "host" || c.listings.length > 0 : true));
  const tab: Tab = (tabs as readonly string[]).includes(p.tab ?? "") ? (p.tab as Tab) : "overview";
  const self = (over: Record<string, string | undefined> = {}) => `/admin/accounts/${id}${qs(p, { ok: undefined, err: undefined, ...over })}`;
  const desk = user.role === "admin" || user.role === "staff";
  const suggestions = c.suggestions.filter((s) => !s.key || canAccess(me, s.key as Parameters<typeof canAccess>[1]));
  const tone = health.score >= 70 ? "live" : health.score >= 45 ? "warn" : "critical";
  const ent = canAccess(me, "enterprise") ? await clientEnterprise(user.email, user.id) : null;
  const entAny = ent && ent.requests.length + ent.engagements.length + ent.properties.length > 0;
  const first = user.name.trim().split(/\s+/)[0] || "there";

  return (
    <div className="dk-stack">
      <DeskHeader
        href="/admin/accounts"
        title={user.name}
        brief={`${user.email} · ${user.role} · joined ${when(user.createdAt, false)}`}
        crumbs={[{ label: user.role === "host" ? "Host" : user.role === "renter" ? "Renter" : "Desk account" }, { label: user.name }]}
        flash={flashOf(p)}
        signals={[
          { label: "Relationship health", value: `${health.score} / 100`, tone },
          money ? { label: "Lifetime value", value: `${fmtCents(c.lifetimeCents, "USD", { whole: true })}${c.openBalance ? ` · ${fmtCents(c.openBalance, "USD", { whole: true })} open` : ""}`, tone: c.openBalance ? "warn" : "ok" } : { label: "Listings", value: `${facts.live} live of ${facts.listings}`, tone: "ok" },
          {
            label: "Status",
            value: user.suspendedAt ? "suspended" : `${facts.verified ? "verified" : "not verified"}${facts.trialDaysLeft !== null && facts.trialDaysLeft >= 0 ? ` · trial ${facts.trialDaysLeft}d` : ""}`,
            tone: user.suspendedAt ? "critical" : facts.verified ? "ok" : "warn",
          },
        ]}
        actions={
          <>
            <Link prefetch={false} className="dk-btn dk-btn--onink" href={self({ tab: "overview" }) + "#email"} scroll={false}>
              <Icon name="mail" size={15} /> Email
            </Link>
            {canAccess(me, "books") && !desk ? (
              <Link prefetch={false} className="dk-btn dk-btn--onink" href={`/admin/books?tab=invoices&new=1&client=${user.id}`}>
                <Icon name="invoice" size={15} /> Invoice
              </Link>
            ) : null}
            <Link prefetch={false} className="dk-btn dk-btn--light" href={`/admin/accounts?manage=${user.id}`} scroll={false}>
              <Icon name="system" size={15} /> Manage
            </Link>
          </>
        }
      />

      <section className="dk-client">
        <Avatar name={user.name} email={user.email} tone={user.role === "host" ? "warm" : "cool"} />
        <div>
          <b>{user.name}</b>
          <span>
            <a href={`mailto:${user.email}`}>{user.email}</a>
            {c.lastSession ? ` · last seen ${ago(t - (user.lastSignInAt ?? c.lastSession.createdAt).getTime())}` : " · never signed in"}
          </span>
          <div className="dk-chiprow">
            <Chip tone="brand">{user.role}</Chip>
            <Chip tone={facts.verified ? "good" : "warn"}>{facts.verified ? "verified" : "unverified"}</Chip>
            {user.suspendedAt ? <Chip tone="bad">suspended · {user.suspendReason}</Chip> : null}
            {facts.trialDaysLeft !== null && facts.trialDaysLeft >= 0 ? <Chip tone="good">free week · {facts.trialDaysLeft}d left</Chip> : null}
            {c.scorecard ? (
              <span className={`dk-grade dk-grade--${c.scorecard.grade}`} title="Host scorecard">
                {c.scorecard.grade} · {c.scorecard.score}
              </span>
            ) : null}
            {user.contact ? (
              canAccess(me, "crm") ? (
                <Link prefetch={false} className="dk-chip dk-chip--value" href={`/admin/crm/${user.contact.id}`}>
                  CRM · {user.contact.stage}
                </Link>
              ) : (
                <Chip tone="value">CRM · {user.contact.stage}</Chip>
              )
            ) : null}
            {user.contact?.nextFollowUpAt ? <Chip tone={user.contact.nextFollowUpAt.getTime() <= t ? "warn" : ""}>follow-up {when(user.contact.nextFollowUpAt, false)}</Chip> : null}
          </div>
        </div>
        <div className="dk-client__gauge">
          <Gauge pct={health.score} label="Health" sub={health.score >= 70 ? "strong" : health.score >= 45 ? "okay" : "needs care"} />
        </div>
      </section>

      <ViewSwitch
        label="Client"
        items={tabs.map((k) => ({
          key: k,
          label: { overview: "Overview", money: "Money", listings: "Listings", activity: "Activity", notes: "Notes" }[k],
          href: self({ tab: k === "overview" ? undefined : k }),
          on: tab === k,
          count: k === "notes" ? c.notes.length || undefined : k === "listings" ? c.listings.length || undefined : k === "money" ? c.invoices.filter((i) => i.state === "overdue").length || undefined : undefined,
        }))}
      />

      {tab === "overview" ? (
        <>
          <div className="dk-kpis">
            {user.role === "host" ? (
              <>
                <Kpi label="Live listings" value={facts.live} sub={`${facts.listings} total · ${facts.pending} pending`} href={self({ tab: "listings" })} />
                <Kpi label="Requests on their homes" value={c.leads.length} sub={`${facts.unansweredLeads} waiting`} href={self({ tab: "activity" })} tone={facts.unansweredLeads ? "alert" : undefined} />
                <Kpi label="Reply rate" value={c.scorecard?.replyRate ?? 0} fmt="pct" sub={c.scorecard?.replyRate === null || !c.scorecard ? "no threads yet" : `${c.scorecard.threads} threads`} />
              </>
            ) : (
              <>
                <Kpi label="Requests" value={c.leads.length} sub={`${facts.openLeads} open`} href={self({ tab: "activity" })} />
                <Kpi label="Bookings" value={c.bookings.length} sub={`${facts.bookingsActive} active`} href={self({ tab: "activity" })} tone="good" />
                <Kpi label="Saved searches" value={c.savedSearches} />
              </>
            )}
            <Kpi label="Conversations" value={c.conversations.length} sub={facts.flaggedMessages ? `${facts.flaggedMessages} flagged` : "none flagged"} tone={facts.flaggedMessages ? "alert" : undefined} />
            {money ? <Kpi label="Lifetime value" value={Math.round(c.lifetimeCents / 100)} fmt="usd" tone="value" href={self({ tab: "money" })} /> : null}
          </div>

          <div className="dk-grid dk-grid--2-1">
            <Panel kicker="1 · Read" title={suggestions.length ? "What to do next" : "Nothing needs you"} sub="Suggested from their listings, requests, money and trust signals.">
              {suggestions.length ? (
                <ul className="dk-insights">
                  {suggestions.map((s) => (
                    <li key={s.id} className={`is-${s.tone}`}>
                      <Icon name={s.tone === "good" ? "star" : s.tone === "info" ? "idea" : "flag"} size={16} />
                      <div>
                        <b>{s.title}</b>
                        <p>{s.id === "nudge" && facts.weakest ? `Weakest point: ${WEAK[facts.weakest] ?? facts.weakest}. One nudge usually moves it.` : s.body}</p>
                      </div>
                      {s.href ? (
                        <Link prefetch={false} className="dk-btn dk-btn--sm" href={s.href}>
                          {s.cta ?? "Open"}
                        </Link>
                      ) : s.id === "crm" || s.id === "touch" ? (
                        <form action={clientFollowUp}>
                          <input type="hidden" name="userId" value={user.id} />
                          <input type="hidden" name="days" value="0" />
                          <input type="hidden" name="returnTo" value={self()} />
                          <button className="dk-btn dk-btn--sm">{s.id === "crm" ? "Add to CRM" : "Follow up today"}</button>
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty title="All good.">No open requests, no overdue money, no trust flags.</Empty>
              )}
            </Panel>
            <Panel title="Why this health score" sub="Starts at 30; every part is shown.">
              <ul className="dk-points">
                {health.parts.map((x) => (
                  <li key={x.label} className={x.points >= 0 ? "is-up" : "is-down"}>
                    <span>{x.label}</span>
                    <b>
                      {x.points > 0 ? "+" : ""}
                      {x.points}
                    </b>
                  </li>
                ))}
                <li className="is-total">
                  <span>Health</span>
                  <b>{health.score}</b>
                </li>
              </ul>
            </Panel>
          </div>

          <div className="dk-grid dk-grid--2-1">
            <Panel kicker="2 · Look" title="Timeline" sub="Everything, newest first.">
              {c.timeline.length ? (
                <ul className="dk-feed dk-timeline">
                  {c.timeline.slice(0, p.all === "1" ? 80 : 18).map((e, i) => (
                    <li key={`${e.kind}-${e.at.getTime()}-${i}`}>
                      <span className={`dk-feed__icon${e.kind === "report" ? " dk-feed__icon--bad" : e.kind === "payment" || e.kind === "paid" ? " dk-feed__icon--good" : e.kind === "invoice" ? " dk-feed__icon--value" : ""}`}>
                        <Icon name={EVENT_ICON[e.kind] ?? "clock"} size={14} />
                      </span>
                      <div>
                        {e.href ? (
                          <Link prefetch={false} href={e.href}>
                            <b>{e.title}</b>
                          </Link>
                        ) : (
                          <b>{e.title}</b>
                        )}
                        {e.detail ? <p>{e.detail}</p> : null}
                      </div>
                      <time dateTime={e.at.toISOString()} title={when(e.at)}>
                        {ago(t - e.at.getTime())}
                      </time>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty title="Nothing yet." />
              )}
              {c.timeline.length > 18 && p.all !== "1" ? (
                <Link prefetch={false} className="dk-btn dk-btn--ghost dk-btn--sm" href={self({ all: "1" })} scroll={false} style={{ marginTop: 10 }}>
                  Show all {c.timeline.length} events
                </Link>
              ) : null}
            </Panel>
            <div className="dk-stack">
              <Panel id="email" kicker="3 · Act" title={`Email ${first}`} sub="Sent from the desk and logged in the CRM.">
                <form action={clientEmail} className="dk-form">
                  <input type="hidden" name="userId" value={user.id} />
                  <input type="hidden" name="returnTo" value={self()} />
                  <label className="dk-field dk-field--wide">
                    <span>Subject</span>
                    <input name="subject" required placeholder={user.role === "host" ? "Quick question about your listing" : "Homes for you"} />
                  </label>
                  <label className="dk-field dk-field--wide">
                    <span>Message</span>
                    <textarea name="body" rows={6} required defaultValue={`Hi ${first},\n\n\n\nBest,\nRentLeaks`} />
                  </label>
                  <button className="dk-btn dk-btn--primary">
                    <Icon name="mail" size={14} /> Send
                  </button>
                </form>
              </Panel>
              <Panel title="Follow up">
                <form action={clientFollowUp} className="dk-inline">
                  <input type="hidden" name="userId" value={user.id} />
                  <input type="hidden" name="returnTo" value={self()} />
                  <select name="days" defaultValue="3" aria-label="When">
                    <option value="0">Today</option>
                    <option value="1">Tomorrow</option>
                    <option value="3">In 3 days</option>
                    <option value="7">Next week</option>
                    <option value="30">In a month</option>
                  </select>
                  <button className="dk-btn">
                    <Icon name="clock" size={14} /> Set follow-up
                  </button>
                </form>
                {!desk ? (
                  <form action={accountAction} className="dk-inline" style={{ marginTop: 10 }}>
                    <input type="hidden" name="id" value={user.id} />
                    <input type="hidden" name="returnTo" value={self()} />
                    <input name="days" type="number" min={1} max={90} defaultValue={7} className="dk-w-num" aria-label="Free days" />
                    <button className="dk-btn dk-btn--value" name="op" value="trial">
                      Give free days
                    </button>
                    <button className="dk-btn" name="op" value={facts.verified ? "unverify" : "verify"}>
                      {facts.verified ? "Remove verified" : "Mark verified"}
                    </button>
                  </form>
                ) : (
                  <p className="dk-hint" style={{ marginTop: 10 }}>
                    Desk account — manage it in {isFounder(me) ? <Link href={`/admin/team?open=${user.id}`}>Team &amp; access</Link> : "Team & access"}.
                  </p>
                )}
              </Panel>
              {ent && entAny ? (
                <Panel kicker="Enterprise" title="Services with us" actions={<Link prefetch={false} className="dk-btn dk-btn--ghost dk-btn--sm" href="/admin/enterprise">Open</Link>}>
                  <ul className="dk-feed">
                    {ent.engagements.map((e) => (
                      <li key={e.id}>
                        <span className="dk-feed__icon dk-feed__icon--good">
                          <Icon name="building" size={15} />
                        </span>
                        <div>
                          <Link prefetch={false} href={`/admin/enterprise?tab=engagements&eng=${e.id}`}>
                            <b>{e.packageId ? (PACKAGE.get(e.packageId)?.name ?? e.title) : e.title}</b>
                          </Link>
                          <p>
                            {ENGAGEMENT_STAGE[e.status as EngagementStatus]?.label ?? e.status} · {e.tasks.filter((x) => x.doneAt).length}/{e.tasks.length} steps
                          </p>
                        </div>
                      </li>
                    ))}
                    {ent.properties.map((x) => (
                      <li key={x.id}>
                        <span className="dk-feed__icon">
                          <Icon name="listings" size={15} />
                        </span>
                        <div>
                          <Link prefetch={false} href={`/admin/enterprise?tab=portfolio&prop=${x.id}`}>
                            <b>{x.name}</b>
                          </Link>
                          <p>
                            {x.occupied}/{x.units} occupied · last statement {x.statements[0]?.month ?? "none"}
                          </p>
                        </div>
                      </li>
                    ))}
                    {ent.requests
                      .filter((r) => !r.engagementId)
                      .map((r) => (
                        <li key={r.id}>
                          <span className="dk-feed__icon dk-feed__icon--value">
                            <Icon name="leads" size={15} />
                          </span>
                          <div>
                            <Link prefetch={false} href={`/admin/enterprise?open=${r.id}`}>
                              <b>Request · {r.status}</b>
                            </Link>
                            <p>
                              {r.units ? `${r.units} units · ` : ""}
                              {r.market ?? r.address ?? ""} · {when(r.createdAt, false)}
                            </p>
                          </div>
                        </li>
                      ))}
                  </ul>
                </Panel>
              ) : null}
              <Panel title="Pinned notes" actions={<Link prefetch={false} className="dk-btn dk-btn--ghost dk-btn--sm" href={self({ tab: "notes" })}>All notes</Link>}>
                {c.notes.filter((n) => n.pinned).length ? (
                  <ul className="dk-notes">
                    {c.notes
                      .filter((n) => n.pinned)
                      .slice(0, 3)
                      .map((n) => (
                        <li key={n.id}>
                          <p>{n.body}</p>
                          <small>{when(n.createdAt, false)}</small>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="dk-hint">No pinned notes. Pin the things everyone should know before calling.</p>
                )}
              </Panel>
            </div>
          </div>
        </>
      ) : null}

      {tab === "money" && money ? (
        <>
          <div className="dk-kpis">
            <Kpi label="Lifetime value" value={Math.round(c.lifetimeCents / 100)} fmt="usd" tone="value" />
            <Kpi label="Open balance" value={Math.round(c.openBalance / 100)} fmt="usd" tone={facts.overdueInvoices ? "alert" : undefined} sub={facts.overdueInvoices ? `${facts.overdueInvoices} overdue` : "nothing overdue"} />
            <Kpi label="Stripe payments" value={c.payments.length} sub={`${c.payments.filter((x) => ["paid", "succeeded", "complete"].includes(x.status)).length} paid`} />
            <Kpi label="Invoices" value={c.invoices.length} />
          </div>
          <div className="dk-grid dk-grid--2">
            <Panel
              flush
              title="Invoices"
              actions={
                canAccess(me, "books") ? (
                  <Link prefetch={false} className="dk-btn dk-btn--primary dk-btn--sm" href={`/admin/books?tab=invoices&new=1&client=${user.id}`}>
                    <Icon name="plus" size={13} /> New invoice
                  </Link>
                ) : null
              }
            >
              {c.invoices.length ? (
                <table className="dk-table">
                  <tbody>
                    {c.invoices.map((i) => (
                      <tr key={i.id}>
                        <td>
                          <Link prefetch={false} href={`/admin/books?tab=invoices&open=${i.id}`}>
                            <b className="dk-mono">{i.number}</b>
                          </Link>
                          <div className="dk-dim">due {i.dueDate}</div>
                        </td>
                        <td>
                          <Chip tone={INV_TONE[i.state]}>{i.state.replace("_", " ")}</Chip>
                        </td>
                        <td className="dk-right">
                          <b>{fmtCents(i.totalCents, i.currency)}</b>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <Empty title="No invoices." />
              )}
            </Panel>
            <Panel flush title="Stripe payments">
              {c.payments.length ? (
                <table className="dk-table">
                  <tbody>
                    {c.payments.map((x) => (
                      <tr key={x.id}>
                        <td>
                          <b>{x.kind}</b>
                          <div className="dk-dim">
                            {when(x.createdAt, false)}
                            {x.listing ? ` · ${x.listing.title}` : ""}
                          </div>
                        </td>
                        <td>
                          <Chip tone={["paid", "succeeded", "complete"].includes(x.status) ? "good" : x.status === "refunded" ? "bad" : "warn"}>{x.status}</Chip>
                        </td>
                        <td className="dk-right">
                          <b>{fmtCents(x.amount, x.currency)}</b>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <Empty title="No payments." />
              )}
            </Panel>
          </div>
          {canAccess(me, "books") ? (
            <Panel flush title="In the books" sub="Every ledger line tied to this client.">
              {c.ledger.length ? (
                <table className="dk-table">
                  <tbody>
                    {c.ledger.map((l) => (
                      <tr key={l.id} className={l.voidedAt ? "is-void" : undefined}>
                        <td className="dk-nowrap">{l.date}</td>
                        <td>{CATEGORY.get(l.category)?.label ?? l.category}</td>
                        <td className="dk-dim">
                          {l.description}
                          {c.receiptCounts.get(l.id) ? (
                            <>
                              {" · "}
                              <Link prefetch={false} href={`/admin/books?tab=ledger&edit=${l.id}`}>
                                {c.receiptCounts.get(l.id)} receipt{c.receiptCounts.get(l.id) === 1 ? "" : "s"}
                              </Link>
                            </>
                          ) : null}
                        </td>
                        <td className="dk-right">
                          <b>{fmtCents(l.kind === "expense" ? -l.amountCents : l.amountCents, l.currency)}</b>
                          {l.voidedAt ? <div className="dk-dim">void</div> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <Empty title="No lines tied to this client yet.">Stripe payments and paid invoices link here automatically.</Empty>
              )}
            </Panel>
          ) : null}
        </>
      ) : null}

      {tab === "listings" ? (
        <>
          {c.scorecard ? (
            <Panel title="Host scorecard" sub="Last 90 days." actions={canAccess(me, "hosts") ? <Link prefetch={false} className="dk-btn dk-btn--sm" href={`/admin/hosts?open=${user.id}`}>Open scorecard</Link> : null}>
              <div className="dk-kpis">
                <Kpi label="Grade" value={`${c.scorecard.grade} · ${c.scorecard.score}`} />
                <Kpi label="Listing quality" value={c.scorecard.quality} fmt="pct" />
                <Kpi label="Freshness" value={c.scorecard.freshPct} fmt="pct" />
                <Kpi label="Reply rate" value={c.scorecard.replyRate ?? 0} fmt="pct" sub={c.scorecard.replyRate === null ? "no threads" : undefined} />
                <Kpi label="Booked" value={c.scorecard.booked} sub={`of ${c.scorecard.leads} requests`} />
              </div>
            </Panel>
          ) : null}
          <Panel flush title={`${c.listings.length} listing${c.listings.length === 1 ? "" : "s"}`}>
            {c.listings.length ? (
              <div className="dk-tablewrap">
                <table className="dk-table">
                  <thead>
                    <tr>
                      <th>Listing</th>
                      <th>Review</th>
                      <th>Status</th>
                      <th className="dk-right">All-in</th>
                      <th>Confirmed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.listings.map((l) => (
                      <tr key={l.id}>
                        <td>
                          {canAccess(me, "listings") ? (
                            <Link prefetch={false} href={`/admin/listings?edit=${l.id}`}>
                              <b>{l.title}</b>
                            </Link>
                          ) : (
                            <b>{l.title}</b>
                          )}
                          <div className="dk-dim">
                            {l.city.name} · {l.housingType}
                            {l.sponsored ? " · sponsored" : ""}
                          </div>
                        </td>
                        <td>
                          <Chip tone={l.moderation === "approved" ? "good" : l.moderation === "declined" ? "bad" : "warn"}>{l.moderation}</Chip>
                          {l.moderationNote ? <div className="dk-dim">{l.moderationNote}</div> : null}
                        </td>
                        <td>{l.status}</td>
                        <td className="dk-right">{fmtCents(l.allIn * 100, l.currency, { whole: true })}</td>
                        <td className="dk-dim">{l.confirmedAt ? ago(t - l.confirmedAt.getTime()) : "never"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty title="No listings yet." />
            )}
          </Panel>
        </>
      ) : null}

      {tab === "activity" ? (
        <div className="dk-grid dk-grid--2">
          <Panel flush title={user.role === "host" ? "Requests on their homes" : "Their requests"}>
            {c.leads.length ? (
              <table className="dk-table">
                <tbody>
                  {c.leads.map((l) => (
                    <tr key={l.id}>
                      <td>
                        {canAccess(me, "leads") ? (
                          <Link prefetch={false} href={`/admin/leads?open=${l.id}`}>
                            <b>{user.role === "host" ? l.name : l.listing?.title ?? l.kind}</b>
                          </Link>
                        ) : (
                          <b>{user.role === "host" ? l.name : l.listing?.title ?? l.kind}</b>
                        )}
                        <div className="dk-dim">
                          {l.kind}
                          {user.role === "host" && l.listing ? ` · ${l.listing.title}` : ""} · {ago(t - l.createdAt.getTime())}
                        </div>
                      </td>
                      <td>
                        <Chip tone={l.status === "new" ? "warn" : l.status === "booked" ? "good" : ""}>{l.status}</Chip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty title="No requests." />
            )}
          </Panel>
          <Panel flush title="Bookings">
            {c.bookings.length ? (
              <table className="dk-table">
                <tbody>
                  {c.bookings.map((b) => (
                    <tr key={b.id}>
                      <td>
                        {canAccess(me, "bookings") ? (
                          <Link prefetch={false} href={`/admin/bookings?open=${b.id}`}>
                            <b>{b.renterName}</b>
                          </Link>
                        ) : (
                          <b>{b.renterName}</b>
                        )}
                        <div className="dk-dim">
                          {b.moveIn ?? "—"} → {b.moveOut ?? "—"}
                        </div>
                      </td>
                      <td>
                        <Chip tone={b.stage === "lost" ? "bad" : b.stage === "signed" || b.stage === "moved_in" ? "good" : "brand"}>{b.stage.replace("_", " ")}</Chip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty title="No bookings." />
            )}
          </Panel>
          <Panel flush title="Conversations" sub="Dates and sizes only — message text stays private to the people in it.">
            {c.conversations.length ? (
              <table className="dk-table">
                <tbody>
                  {c.conversations.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <b>{v.listing.title}</b>
                        <div className="dk-dim">{v.hostId === user.id ? "as host" : "as renter"}</div>
                      </td>
                      <td className="dk-right dk-dim">
                        {v._count.messages} message{v._count.messages === 1 ? "" : "s"} · {ago(t - v.lastMessageAt.getTime())}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty title="No conversations." />
            )}
          </Panel>
          <Panel flush title="Reports">
            {c.reports.length ? (
              <table className="dk-table">
                <tbody>
                  {c.reports.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <b>{r.reason}</b>
                        <div className="dk-dim">{r.note.slice(0, 120)}</div>
                      </td>
                      <td>
                        <Chip tone={r.status === "open" ? "bad" : ""}>{r.status}</Chip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty title="No reports." />
            )}
          </Panel>
        </div>
      ) : null}

      {tab === "notes" ? (
        <div className="dk-grid dk-grid--2-1">
          <Panel title={`${c.notes.length} note${c.notes.length === 1 ? "" : "s"}`} sub="Private to the desk. Never shown to the client.">
            {c.notes.length ? (
              <ul className="dk-notes">
                {c.notes.map((n) => (
                  <li key={n.id} className={n.pinned ? "is-pinned" : undefined}>
                    <p>{n.body}</p>
                    <small>
                      {when(n.createdAt)}
                      {n.pinned ? " · pinned" : ""}
                    </small>
                    <form action={noteAction} className="dk-inline">
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="noteId" value={n.id} />
                      <input type="hidden" name="returnTo" value={self()} />
                      <button className="dk-btn dk-btn--ghost dk-btn--sm" name="op" value={n.pinned ? "unpin" : "pin"}>
                        {n.pinned ? "Unpin" : "Pin"}
                      </button>
                      <button className="dk-btn dk-btn--ghost dk-btn--sm" name="op" value="delete">
                        Delete
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty title="No notes yet." />
            )}
          </Panel>
          <Panel title="Add a note">
            <form action={noteAction} className="dk-form">
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="op" value="add" />
              <input type="hidden" name="returnTo" value={self()} />
              <label className="dk-field dk-field--wide">
                <span>Note</span>
                <textarea name="body" rows={5} required placeholder="Prefers WhatsApp after 6pm. Owns 3 more units in Astoria." />
              </label>
              <label className="dk-check dk-field--wide">
                <input type="checkbox" name="pin" value="yes" /> Pin it to the top
              </label>
              <p className="dk-hint">Keep it about the business. No health, money or personal details.</p>
              <button className="dk-btn dk-btn--primary">Save note</button>
            </form>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
