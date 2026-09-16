import Link from "next/link";
import { resolveReport } from "@/app/admin/_actions/reports";
import { Kpi, RankedBars } from "@/components/admin/desk/charts";
import { DeskHeader } from "@/components/admin/desk/DeskHeader";
import { Icon } from "@/components/admin/desk/Icon";
import { ago, Avatar, Chip, Empty, Panel } from "@/components/admin/desk/parts";
import { flashOf, readParams, when, type SP } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";
import { nowMs } from "@/lib/admin/metrics";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Reports & safety — RentLeaks desk" };

const REASON_TONE: Record<string, "bad" | "warn" | "ink"> = { scam: "bad", discriminatory: "bad", abusive: "bad", misleading: "warn", unavailable: "ink", other: "ink" };

export default async function ReportsAdmin({ searchParams }: { searchParams: SP }) {
  await requireAdminPage("/admin/reports");
  const p = await readParams(searchParams);
  const t = nowMs();
  const [open, resolved, blocks, flagged, reasons, actioned, dismissed] = await Promise.all([
    prisma.report.findMany({
      where: { status: "open", ...(p.reason ? { reason: p.reason } : {}) },
      include: { reporter: { select: { name: true, email: true } }, listing: { select: { id: true, title: true, hostId: true } } },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
    prisma.report.findMany({ where: { status: { not: "open" } }, include: { listing: { select: { id: true, title: true } } }, orderBy: { resolvedAt: "desc" }, take: 30 }),
    prisma.userBlock.count(),
    prisma.message.findMany({
      where: { NOT: { flags: "[]" } },
      select: { id: true, flags: true, createdAt: true, sender: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.report.groupBy({ by: ["reason"], _count: { _all: true } }),
    prisma.report.count({ where: { status: "actioned" } }),
    prisma.report.count({ where: { status: "dismissed" } }),
  ]);
  const userIds = [...new Set(open.map((r) => r.subjectUserId).filter((x): x is string => Boolean(x)))];
  const msgIds = open.map((r) => r.messageId).filter((x): x is string => Boolean(x));
  const [subjects, messages] = await Promise.all([
    userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }) : [],
    msgIds.length ? prisma.message.findMany({ where: { id: { in: msgIds } }, select: { id: true, body: true } }) : [],
  ]);
  const subjectOf = new Map(subjects.map((u) => [u.id, u]));
  const messageOf = new Map(messages.map((m) => [m.id, m.body]));
  const oldestH = open.length ? (t - open[0].createdAt.getTime()) / 3_600_000 : 0;

  return (
    <div className="dk-stack">
      <DeskHeader
        href="/admin/reports"
        flash={flashOf(p)}
        signals={[
          { label: "Open", value: `${open.length} report${open.length === 1 ? "" : "s"}`, tone: open.length ? "critical" : "live" },
          { label: "Oldest waiting", value: open.length ? ago(oldestH * 3_600_000).replace(" ago", "") : "—", tone: oldestH > 24 ? "warn" : "ok" },
          { label: "Scam-guard flags", value: `${flagged.length} recent`, tone: flagged.length ? "warn" : "ok", href: "#flags" },
          { label: "Blocks", value: `${blocks} between members`, tone: "ok" },
        ]}
      />

      <div className="dk-kpis">
        <Kpi label="Open" value={open.length} tone={open.length ? "alert" : undefined} href="/admin/reports" active={!p.reason} />
        <Kpi label="Actioned" value={actioned} sub="listing removed or account suspended" />
        <Kpi label="Dismissed" value={dismissed} />
        <Kpi label="Flagged messages" value={flagged.length} sub="warnings shown, nothing blocked" href="#flags" tone="value" />
      </div>

      <div className="dk-grid dk-grid--1-2">
        <Panel title="Why members report" sub="All time — click to filter the open queue.">
          <RankedBars
            rows={reasons
              .map((r) => ({ key: r.reason, label: r.reason, value: r._count._all, href: p.reason === r.reason ? "/admin/reports" : `/admin/reports?reason=${r.reason}` }))
              .sort((a, b) => b.value - a.value)}
            activeKey={p.reason || undefined}
            empty="No reports yet."
          />
        </Panel>

        <Panel title={`Open queue${p.reason ? ` · ${p.reason}` : ""}`} sub="Oldest first. Removing a listing sends it back to review with the reason; suspending signs the account out and pauses its listings.">
          {open.length === 0 ? (
            <Empty title="No open reports.">Members can report a listing, an account or a message from the app.</Empty>
          ) : (
            <ol className="dk-nba__list">
              {open.map((r) => {
                const subject = r.subjectUserId ? subjectOf.get(r.subjectUserId) : null;
                const tone = REASON_TONE[r.reason] ?? "ink";
                return (
                  <li key={r.id} className={`dk-nba__row dk-nba__row--${tone}`}>
                    <span className={`dk-nba__icon dk-nba__icon--${tone === "bad" ? "bad" : tone === "warn" ? "warn" : "ink"}`}>
                      <Icon name="shield" size={17} />
                    </span>
                    <div className="dk-nba__main">
                      <p className="dk-nba__meta">
                        <Chip tone={tone}>{r.reason}</Chip>
                        <span className="dk-nba__who">
                          filed {ago(t - r.createdAt.getTime())} by {r.reporter.name}
                        </span>
                      </p>
                      <b className="dk-nba__title">
                        {r.listing ? (
                          <a href={`/listings/${r.listing.id}`} target="_blank" rel="noreferrer">
                            {r.listing.title}
                          </a>
                        ) : subject ? (
                          <Link prefetch={false} href={`/admin/accounts?q=${encodeURIComponent(subject.email)}`}>{subject.name}</Link>
                        ) : (
                          "Message report"
                        )}
                      </b>
                      {r.listing && subject ? (
                        <p className="dk-nba__reason">
                          Account: <Link prefetch={false} href={`/admin/accounts?q=${encodeURIComponent(subject.email)}`}>{subject.name}</Link>
                        </p>
                      ) : null}
                      {r.note ? <p className="dk-nba__reason">“{r.note}”</p> : null}
                      {r.messageId && messageOf.get(r.messageId) ? <pre className="dk-dossier__summary">{messageOf.get(r.messageId)}</pre> : null}
                    </div>
                    <form action={resolveReport} className="dk-nba__actions">
                      <input type="hidden" name="id" value={r.id} />
                      <button className="dk-btn dk-btn--sm" name="op" value="dismiss">
                        Dismiss
                      </button>
                      {r.listingId ? (
                        <button className="dk-btn dk-btn--sm" name="op" value="unpublish">
                          Remove listing
                        </button>
                      ) : null}
                      <button className="dk-btn dk-btn--sm dk-btn--danger" name="op" value="suspend">
                        Suspend account
                      </button>
                    </form>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>
      </div>

      <div className="dk-grid dk-grid--2">
        <Panel flush title="Recently resolved">
          {resolved.length === 0 ? (
            <div style={{ padding: 20 }}>
              <Empty title="Nothing resolved yet." />
            </div>
          ) : (
            <div className="dk-tablewrap">
              <table className="dk-table">
                <thead>
                  <tr>
                    <th>Resolved</th>
                    <th>Outcome</th>
                    <th>Reason</th>
                    <th>Listing</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {resolved.map((r) => (
                    <tr key={r.id}>
                      <td className="dk-dim">{when(r.resolvedAt)}</td>
                      <td>
                        <Chip tone={r.status === "actioned" ? "bad" : "ink"}>{r.status}</Chip>
                      </td>
                      <td>{r.reason}</td>
                      <td className="dk-wrap">{r.listing?.title || "—"}</td>
                      <td>
                        <form action={resolveReport}>
                          <input type="hidden" name="id" value={r.id} />
                          <button className="dk-btn dk-btn--ghost dk-btn--sm" name="op" value="reopen">
                            Reopen
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel id="flags" title="Messages flagged by the scam guard" sub="Warnings shown to recipients — wire transfers, paying before a viewing, moving off-platform. Nothing was blocked.">
          {flagged.length === 0 ? (
            <Empty title="No flagged messages." />
          ) : (
            <ul className="dk-feed">
              {flagged.map((m) => (
                <li key={m.id}>
                  <Avatar name={m.sender.name} email={m.sender.email} tone="warm" />
                  <div>
                    <Link prefetch={false} href={`/admin/accounts?q=${encodeURIComponent(m.sender.email)}`}>
                      <b>{m.sender.name}</b>
                    </Link>
                    <p>{m.flags}</p>
                  </div>
                  <time dateTime={m.createdAt.toISOString()}>{ago(t - m.createdAt.getTime())}</time>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
