import Link from "next/link";
import { bookingAction, saveBooking } from "@/app/admin/_actions/bookings";
import { Board, type BoardCard } from "@/components/admin/desk/Board";
import { FunnelLanes, Kpi } from "@/components/admin/desk/charts";
import { DeskHeader } from "@/components/admin/desk/DeskHeader";
import { Icon } from "@/components/admin/desk/Icon";
import { RouteDrawer } from "@/components/admin/desk/RouteDrawer";
import { Chip, CommandRail, Empty, MarkTile, Panel, Steps, ago, initials } from "@/components/admin/desk/parts";
import { flashOf, qs, readParams, when, type SP } from "@/components/admin/ui";
import { canAccess } from "@/lib/access";
import { requireAdminPage } from "@/lib/admin/guard";
import { nowMs } from "@/lib/admin/metrics";
import { LEAD_WINDOW_LABEL } from "@/lib/leads";
import { prisma } from "@/lib/prisma";
import { fmtMoney } from "@/lib/site";
import { BOARD_STAGES, daysToMoveOut, parseSlots, renewalDue, STAGE_META, wallLabel, type BookingStage } from "@/lib/ops/bookings";

export const metadata = { title: "Bookings & leases — RentLeaks desk" };

const DAY = 86_400_000;
const VIEWS = ["board", "calendar", "renewals", "leases", "new"] as const;
type View = (typeof VIEWS)[number];

/**
 * Bookings: everything after "yes". The board runs viewing → move-in; the
 * calendar shows booked viewings next to the times renters asked for; the
 * renewal list comes up 90 days before a stay ends.
 */
export default async function BookingsPage({ searchParams }: { searchParams: SP }) {
  const me = await requireAdminPage("/admin/bookings");
  const p = await readParams(searchParams);
  const t = nowMs();
  const view: View = (VIEWS as readonly string[]).includes(p.view) ? (p.view as View) : "board";
  const self = (over: Record<string, string | undefined> = {}) => `/admin/bookings${qs(p, { ok: undefined, err: undefined, ...over })}`;
  const today = new Date(new Date(t).toISOString().slice(0, 10) + "T00:00:00Z");

  const [bookings, requests, leases, listings] = await Promise.all([
    prisma.booking.findMany({ orderBy: { updatedAt: "desc" }, take: 500 }),
    prisma.lead.findMany({
      where: {
        kind: "viewing",
        status: { in: ["new", "contacted"] },
        createdAt: { gte: new Date(t - 30 * DAY) },
      },
      select: {
        id: true,
        name: true,
        email: true,
        viewingSlots: true,
        viewingMode: true,
        listingId: true,
        listing: { select: { title: true } },
      },
      take: 200,
    }),
    view === "leases"
      ? prisma.lease.findMany({
          orderBy: { createdAt: "desc" },
          take: 200,
          include: {
            listing: { select: { title: true } },
            renter: { select: { name: true, email: true } },
            host: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    prisma.listing.findMany({
      where: { status: { not: "paused" } },
      select: { id: true, title: true, neighborhood: true },
      orderBy: { postedAt: "desc" },
      take: 300,
    }),
  ]);
  const titles = new Map(listings.map((l) => [l.id, l.title]));
  const extraIds = bookings.map((b) => b.listingId).filter((id): id is string => !!id && !titles.has(id));
  if (extraIds.length) {
    for (const l of await prisma.listing.findMany({
      where: { id: { in: extraIds } },
      select: { id: true, title: true },
    }))
      titles.set(l.id, l.title);
  }
  const booked = new Set(bookings.map((b) => b.leadId).filter(Boolean));
  const unbooked = requests.filter((r) => !booked.has(r.id));

  const count = (s: BookingStage) => bookings.filter((b) => b.stage === s).length;
  const upcoming = bookings.filter((b) => b.viewingAt && b.viewingAt.getTime() >= today.getTime() && b.viewingAt.getTime() < today.getTime() + 14 * DAY && b.stage === "viewing");
  const unconfirmed = upcoming.filter((b) => !b.viewingConfirmedAt);
  const renewals = bookings.filter((b) => renewalDue(b, t)).sort((a, b) => (a.moveOut ?? "").localeCompare(b.moveOut ?? ""));
  const active = bookings.filter((b) => b.stage === "moved_in" || b.stage === "signed");
  const monthly = active.reduce((n, b) => n + (b.monthlyAllIn ?? 0), 0);
  const started90 = bookings.filter((b) => t - b.createdAt.getTime() < 90 * DAY);
  const reached = (stages: BookingStage[]) => started90.filter((b) => stages.includes(b.stage as BookingStage)).length;

  const cards: BoardCard[] = bookings
    .filter((b) => (BOARD_STAGES as string[]).includes(b.stage))
    .map((b) => ({
      id: b.id,
      column: b.stage,
      title: b.renterName,
      sub: b.listingId ? (titles.get(b.listingId) ?? "Home removed") : "No home picked yet",
      initials: initials(b.renterName, b.renterEmail),
      chips: [
        ...(b.viewingAt
          ? [
              {
                label: wallLabel(b.viewingAt),
                tone: b.viewingConfirmedAt ? "good" : "warn",
              },
            ]
          : []),
        ...(b.monthlyAllIn
          ? [
              {
                label: `${fmtMoney(b.monthlyAllIn, b.currency)}/mo`,
                tone: "value",
              },
            ]
          : []),
        ...(renewalDue(b, t) ? [{ label: `ends in ${daysToMoveOut(b.moveOut, t)}d`, tone: "bad" }] : []),
      ],
      lines: [b.moveIn ? `${b.moveIn} → ${b.moveOut ?? "open"}` : "", b.lostReason ? `Lost: ${b.lostReason}` : ""].filter(Boolean),
      href: self({ open: b.id }),
    }));

  const days = Array.from({ length: 14 }, (_, i) => new Date(today.getTime() + i * DAY));
  const open = p.open ? bookings.find((b) => b.id === p.open) : undefined;
  const openAccount = open && canAccess(me, "accounts") ? await prisma.user.findUnique({ where: { email: open.renterEmail.toLowerCase() }, select: { id: true } }).catch(() => null) : null;
  const fromLead = p.lead ? await prisma.lead.findUnique({ where: { id: p.lead } }) : null;

  const form = (b?: (typeof bookings)[number]) => (
    <form action={saveBooking} className="dk-form">
      {b ? <input type="hidden" name="id" value={b.id} /> : null}
      <input type="hidden" name="leadId" value={b?.leadId ?? fromLead?.id ?? ""} />
      <input type="hidden" name="returnTo" value={self()} />
      <label className="dk-field">
        <span>Renter name</span>
        <input name="renterName" defaultValue={b?.renterName ?? fromLead?.name ?? ""} required />
      </label>
      <label className="dk-field">
        <span>Renter email</span>
        <input name="renterEmail" type="email" defaultValue={b?.renterEmail ?? fromLead?.email ?? ""} required />
      </label>
      <label className="dk-field dk-field--wide">
        <span>Home (pick or paste an id)</span>
        <input name="listingId" list="bk-homes" defaultValue={b?.listingId ?? fromLead?.listingId ?? ""} placeholder="Start typing a title…" />
      </label>
      <label className="dk-field">
        <span>Stage</span>
        <select name="stage" defaultValue={b?.stage ?? "viewing"}>
          {(Object.keys(STAGE_META) as BookingStage[]).map((s) => (
            <option key={s} value={s}>
              {STAGE_META[s].label}
            </option>
          ))}
        </select>
      </label>
      <label className="dk-field">
        <span>Viewing (home&rsquo;s local time)</span>
        <input name="viewingAt" type="datetime-local" defaultValue={b?.viewingAt ? b.viewingAt.toISOString().slice(0, 16) : ""} />
      </label>
      <label className="dk-field">
        <span>Viewing type</span>
        <select name="viewingMode" defaultValue={b?.viewingMode ?? fromLead?.viewingMode ?? "in-person"}>
          <option value="in-person">In person</option>
          <option value="video">Live video</option>
        </select>
      </label>
      <label className="dk-field">
        <span>Monthly all-in</span>
        <input name="monthlyAllIn" type="number" min={0} defaultValue={b?.monthlyAllIn ?? ""} placeholder="from the listing" />
      </label>
      <label className="dk-field">
        <span>Move in</span>
        <input name="moveIn" type="date" defaultValue={b?.moveIn ?? fromLead?.moveIn ?? ""} />
      </label>
      <label className="dk-field">
        <span>Move out</span>
        <input name="moveOut" type="date" defaultValue={b?.moveOut ?? fromLead?.moveOut ?? ""} />
      </label>
      <label className="dk-field dk-field--wide">
        <span>Note</span>
        <input name="note" defaultValue={b?.note ?? ""} placeholder="Anything the team should know" />
      </label>
      <button className="dk-btn dk-btn--primary">
        <Icon name="check" size={14} /> {b ? "Save booking" : "Start booking"}
      </button>
      <datalist id="bk-homes">
        {listings.map((l) => (
          <option key={l.id} value={`${l.id} — ${l.title}`} />
        ))}
      </datalist>
    </form>
  );

  return (
    <div className="dk-stack">
      <DeskHeader
        href="/admin/bookings"
        flash={flashOf(p)}
        signals={[
          {
            label: "Viewings next 14 days",
            value: `${upcoming.length} · ${unconfirmed.length} to confirm`,
            tone: unconfirmed.length ? "warn" : "live",
            href: self({ view: "calendar", open: undefined }),
          },
          {
            label: "Requested, not booked",
            value: `${unbooked.length} viewing request${unbooked.length === 1 ? "" : "s"}`,
            tone: unbooked.length ? "critical" : "ok",
            href: self({ view: "calendar", open: undefined }),
          },
          {
            label: "Renewals due",
            value: renewals.length ? `${renewals.length} in 90 days` : "none",
            tone: renewals.length ? "warn" : "ok",
            href: self({ view: "renewals", open: undefined }),
          },
        ]}
        actions={
          <>
            <Link prefetch={false} className="dk-btn dk-btn--onink" href="/api/admin/export/bookings">
              <Icon name="export" size={15} /> Export CSV
            </Link>
            <Link prefetch={false} className="dk-btn dk-btn--light" href={self({ view: "new", open: undefined })} scroll={false}>
              <Icon name="plus" size={15} /> Start a booking
            </Link>
          </>
        }
      />

      <div className="dk-kpis">
        <Kpi label="Viewings" value={count("viewing")} sub={`${upcoming.length} in 14 days`} href={self({ view: "board" })} />
        <Kpi label="In progress" value={count("application") + count("approved")} sub="applications and approvals" />
        <Kpi label="Signed & living" value={active.length} sub={`${count("signed")} signed · ${count("moved_in")} moved in`} tone="good" />
        <Kpi label="Monthly under lease" value={monthly} fmt="usd" sub="signed + moved in, all-in" tone="value" />
        <Kpi label="Renewals due" value={renewals.length} sub="within 90 days" tone={renewals.length ? "alert" : undefined} href={self({ view: "renewals" })} />
      </div>

      <div className="dk-grid dk-grid--rail">
        <CommandRail
          title="Bookings"
          sub="View · apply · sign · move in"
          tabs={[
            {
              key: "board",
              label: "Board",
              href: self({ view: undefined, open: undefined }),
              on: view === "board",
              count: cards.length,
            },
            {
              key: "calendar",
              label: "Viewing calendar",
              href: self({ view: "calendar", open: undefined }),
              on: view === "calendar",
              count: upcoming.length + unbooked.length || undefined,
            },
            {
              key: "renewals",
              label: "Renewals",
              href: self({ view: "renewals", open: undefined }),
              on: view === "renewals",
              count: renewals.length || undefined,
            },
            {
              key: "leases",
              label: "Leases signed in the app",
              href: self({ view: "leases", open: undefined }),
              on: view === "leases",
            },
            {
              key: "new",
              label: "Start a booking",
              href: self({ view: "new", open: undefined }),
              on: view === "new",
            },
          ]}
          quick={{
            title: "Funnel · 90 days",
            items: [
              {
                label: `${started90.length} started`,
                href: self({ view: undefined }),
                mark: (
                  <MarkTile>
                    <Icon name="calendar" size={14} />
                  </MarkTile>
                ),
              },
              {
                label: `${reached(["signed", "moved_in", "moved_out"])} signed`,
                href: self({ view: undefined }),
                mark: (
                  <MarkTile bg="#2b6b55">
                    <Icon name="check" size={14} />
                  </MarkTile>
                ),
              },
              {
                label: `${reached(["lost"])} lost`,
                href: self({ view: undefined }),
                mark: (
                  <MarkTile bg="#a93a28">
                    <Icon name="close" size={14} />
                  </MarkTile>
                ),
              },
            ],
          }}
        />

        <div className="dk-stack">
          {view === "board" ? (
            cards.length ? (
              <>
                <Board
                  mode="booking"
                  columns={BOARD_STAGES.map((s) => ({
                    key: s,
                    label: STAGE_META[s].label,
                    hint: STAGE_META[s].hint,
                    tone: STAGE_META[s].tone,
                  }))}
                  cards={cards}
                  empty="Drop a booking here"
                />
                <Panel title="From viewing to lease · 90 days">
                  <FunnelLanes
                    stages={[
                      { label: "Started", value: started90.length },
                      {
                        label: "Applied",
                        value: reached(["application", "approved", "signed", "moved_in", "moved_out"]),
                      },
                      {
                        label: "Signed",
                        value: reached(["signed", "moved_in", "moved_out"]),
                      },
                      {
                        label: "Moved in",
                        value: reached(["moved_in", "moved_out"]),
                      },
                    ]}
                  />
                </Panel>
              </>
            ) : (
              <Panel>
                <Empty title="No bookings yet.">
                  Start one from a viewing request on the calendar, from a lead, or by hand.
                  <div style={{ marginTop: 12 }}>
                    <Link prefetch={false} className="dk-btn dk-btn--primary" href={self({ view: "new" })}>
                      <Icon name="plus" size={14} /> Start a booking
                    </Link>
                  </div>
                </Empty>
              </Panel>
            )
          ) : null}

          {view === "calendar" ? (
            <>
              {unbooked.length ? (
                <Panel
                  kicker="Step 1 · requested times"
                  title={`${unbooked.length} renter${unbooked.length === 1 ? "" : "s"} asked for a viewing`}
                  sub="Pick one, set the time, confirm — the renter gets the email."
                >
                  <ul className="dk-feed">
                    {unbooked.map((r) => (
                      <li key={r.id}>
                        <span className="dk-feed__icon dk-feed__icon--value">
                          <Icon name="calendar" size={15} />
                        </span>
                        <div>
                          <b>{r.name}</b>
                          <p>
                            {r.listing?.title ?? "No home picked"} · {r.viewingMode === "video" ? "video" : "in person"} ·{" "}
                            {parseSlots(r.viewingSlots)
                              .map((s) => `${s.date} ${LEAD_WINDOW_LABEL[s.window as keyof typeof LEAD_WINDOW_LABEL] ?? s.window}`)
                              .join(" / ") || "any time"}
                          </p>
                        </div>
                        <time>
                          <Link prefetch={false} className="dk-btn dk-btn--sm dk-btn--primary" href={self({ view: "new", lead: r.id })}>
                            Book it
                          </Link>
                        </time>
                      </li>
                    ))}
                  </ul>
                </Panel>
              ) : null}
              <Panel kicker="Step 2 · the next two weeks" title="Viewing calendar" sub="Booked viewings in the home's local time. Amber = not confirmed yet.">
                <div className="dk-cal">
                  {days.map((d, i) => {
                    const key = d.toISOString().slice(0, 10);
                    const items = upcoming.filter((b) => b.viewingAt!.toISOString().slice(0, 10) === key);
                    const asked = unbooked.filter((r) => parseSlots(r.viewingSlots).some((s) => s.date === key));
                    return (
                      <div key={key} className={`dk-cal__day${i === 0 ? " is-today" : ""}`}>
                        <b>
                          {d.toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            timeZone: "UTC",
                          })}
                        </b>
                        <ul>
                          {items.map((b) => (
                            <li key={b.id} className={b.viewingConfirmedAt ? undefined : "is-warn"}>
                              <Link prefetch={false} href={self({ open: b.id })} scroll={false}>
                                {b.viewingAt!.toISOString().slice(11, 16)} {b.renterName.split(" ")[0]}
                              </Link>
                            </li>
                          ))}
                          {asked.map((r) => (
                            <li key={`r-${r.id}`} className="is-ask">
                              <Link prefetch={false} href={self({ view: "new", lead: r.id })}>
                                asked · {r.name.split(" ")[0]}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            </>
          ) : null}

          {view === "renewals" ? (
            <Panel kicker="90-day window" title="Stays ending soon" sub="Offer an extension early — a renewal costs nothing to acquire.">
              {renewals.length === 0 ? (
                <Empty title="No stay ends in the next 90 days." />
              ) : (
                <ul className="dk-feed">
                  {renewals.map((b) => (
                    <li key={b.id}>
                      <span className={`dk-feed__icon${(daysToMoveOut(b.moveOut, t) ?? 99) <= 30 ? " dk-feed__icon--bad" : " dk-feed__icon--value"}`}>
                        <Icon name="clock" size={15} />
                      </span>
                      <div>
                        <Link prefetch={false} href={self({ open: b.id })} scroll={false}>
                          <b>{b.renterName}</b>
                        </Link>
                        <p>
                          {b.listingId ? titles.get(b.listingId) : "—"} · ends {b.moveOut} ({daysToMoveOut(b.moveOut, t)} days)
                          {b.renewalRemindedAt ? ` · offer sent ${ago(t - b.renewalRemindedAt.getTime())}` : ""}
                        </p>
                      </div>
                      <time>
                        <form action={bookingAction}>
                          <input type="hidden" name="id" value={b.id} />
                          <input type="hidden" name="returnTo" value={self()} />
                          <button className="dk-btn dk-btn--sm dk-btn--primary" name="op" value="renewal">
                            {b.renewalRemindedAt ? "Send again" : "Offer renewal"}
                          </button>
                        </form>
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ) : null}

          {view === "leases" ? (
            <Panel flush title="Leases signed in the app" sub="Read-only: created by renters and hosts in the RentLeaks app.">
              {leases.length === 0 ? (
                <Empty title="No app leases yet." />
              ) : (
                <div className="dk-tablewrap">
                  <table className="dk-table">
                    <thead>
                      <tr>
                        <th>Home</th>
                        <th>Renter</th>
                        <th>Host</th>
                        <th>Dates</th>
                        <th>Status</th>
                        <th className="dk-right">All-in</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leases.map((l) => (
                        <tr key={l.id}>
                          <td className="dk-wrap">{l.listing.title}</td>
                          <td>{l.renter.name}</td>
                          <td>{l.host.name}</td>
                          <td className="dk-dim">
                            {l.startDate} → {l.endDate}
                          </td>
                          <td>
                            <Chip tone={l.status === "signed" || l.status === "active" ? "good" : "ink"}>{l.status}</Chip>
                          </td>
                          <td className="dk-right dk-num">${l.monthlyAllIn.toLocaleString("en-US")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          ) : null}

          {view === "new" ? (
            <Panel
              kicker="Start a booking"
              title={fromLead ? `Booking for ${fromLead.name}` : "New booking"}
              sub={fromLead ? "Filled from their request — set the time and save." : "For a renter who reached you another way."}
            >
              <Steps
                steps={[
                  { label: "Who and which home", state: "on" },
                  { label: "When", state: "todo" },
                  { label: "Save, then confirm", state: "todo" },
                ]}
              />
              <div style={{ marginTop: 14 }}>{form()}</div>
            </Panel>
          ) : null}
        </div>
      </div>

      {open ? (
        <RouteDrawer
          closeHref={self({ open: undefined })}
          kicker={`${STAGE_META[open.stage as BookingStage]?.label ?? open.stage} · started ${when(open.createdAt, false)}`}
          title={open.renterName}
          width={640}
        >
          <div className="dk-dossier">
            <div className="dk-chiprow">
              <Chip tone={STAGE_META[open.stage as BookingStage]?.tone ?? "ink"}>{STAGE_META[open.stage as BookingStage]?.label ?? open.stage}</Chip>
              {open.viewingAt ? (
                <Chip tone={open.viewingConfirmedAt ? "good" : "warn"}>{`${wallLabel(open.viewingAt)}${open.viewingConfirmedAt ? " · confirmed" : " · not confirmed"}`}</Chip>
              ) : null}
              {openAccount ? (
                <Link prefetch={false} className="dk-chip dk-chip--value" href={`/admin/accounts/${openAccount.id}`}>
                  renter account →
                </Link>
              ) : null}
              {open.leadId ? (
                <Link prefetch={false} className="dk-chip dk-chip--brand" href={`/admin/leads?open=${open.leadId}`}>
                  from a lead
                </Link>
              ) : null}
            </div>
            <p className="dk-hint">
              {open.renterEmail}
              {open.renterPhone ? ` · ${open.renterPhone}` : ""} · {open.listingId ? titles.get(open.listingId) : "no home yet"}
            </p>
            <div className="dk-inline">
              {open.stage === "viewing" || open.stage === "application" ? (
                <form action={bookingAction}>
                  <input type="hidden" name="id" value={open.id} />
                  <input type="hidden" name="returnTo" value={self()} />
                  <button className="dk-btn dk-btn--primary dk-btn--sm" name="op" value="confirm" disabled={!open.viewingAt}>
                    <Icon name="mail" size={13} /> {open.viewingConfirmedAt ? "Re-send confirmation" : "Confirm viewing by email"}
                  </button>
                </form>
              ) : null}
              {renewalDue(open, t) ? (
                <form action={bookingAction}>
                  <input type="hidden" name="id" value={open.id} />
                  <input type="hidden" name="returnTo" value={self()} />
                  <button className="dk-btn dk-btn--sm" name="op" value="renewal">
                    Offer renewal
                  </button>
                </form>
              ) : null}
            </div>
            {form(open)}
            <form action={bookingAction} className="dk-inline">
              <input type="hidden" name="id" value={open.id} />
              <input type="hidden" name="returnTo" value={self()} />
              <input name="reason" placeholder="Why was it lost? (price, timing, chose another home…)" defaultValue={open.lostReason ?? ""} />
              <button className="dk-btn dk-btn--sm" name="op" value="lost">
                Mark lost
              </button>
              <button className="dk-btn dk-btn--ghost dk-btn--sm" name="op" value="delete">
                Delete
              </button>
            </form>
          </div>
        </RouteDrawer>
      ) : null}
    </div>
  );
}
