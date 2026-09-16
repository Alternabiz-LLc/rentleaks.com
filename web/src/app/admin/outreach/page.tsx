import Link from "next/link";
import { deleteTemplate, loadStarterTemplates, saveTemplate } from "@/app/admin/_actions/campaigns";
import { Columns, Kpi, RankedBars } from "@/components/admin/desk/charts";
import { DeskHeader } from "@/components/admin/desk/DeskHeader";
import { Icon } from "@/components/admin/desk/Icon";
import { NextBest } from "@/components/admin/desk/NextBest";
import { Chip, CohortTile, Empty, Panel, ViewSwitch } from "@/components/admin/desk/parts";
import { RouteDrawer } from "@/components/admin/desk/RouteDrawer";
import { flashOf, qs, readParams, when, type SP } from "@/components/admin/ui";
import { loadNextActions } from "@/lib/admin/copilot";
import { requireAdminPage } from "@/lib/admin/guard";
import { nowMs } from "@/lib/admin/metrics";
import { KIND_LABEL } from "@/lib/crm";
import { prisma } from "@/lib/prisma";
import { mailStatus } from "@/lib/v1/mail";

export const metadata = { title: "Outreach — RentLeaks desk" };

const DAY = 86_400_000;
const PURPOSE_TONE: Record<string, "brand" | "value" | "good" | "ink"> = { outreach: "brand", newsletter: "good", bulk: "ink", trial: "value" };
const OUTREACH_CATS = new Set(["follow-up", "going-quiet", "qualified", "invite-idle", "declined", "upsell", "trial-ending"]);

export default async function OutreachPage({ searchParams }: { searchParams: SP }) {
  await requireAdminPage("/admin/outreach");
  const p = await readParams(searchParams);
  const t = nowMs();
  const now = new Date(t);
  const tab = p.tab === "templates" ? "templates" : "work";
  const weekAgo = new Date(t - 7 * DAY);
  const since = new Date(t - 28 * DAY);

  const [templates, prospects, touchesWeek, touches, editing, actions, sendCounts] = await Promise.all([
    prisma.emailTemplate.findMany({ orderBy: [{ purpose: "asc" }, { name: "asc" }] }),
    prisma.contact.groupBy({ by: ["kind", "stage"], where: { kind: { in: ["host", "operator", "partner"] } }, _count: { _all: true } }),
    prisma.contactActivity.groupBy({ by: ["kind"], where: { kind: { in: ["email", "call", "sms", "meeting"] }, createdAt: { gte: weekAgo } }, _count: { _all: true } }),
    prisma.contactActivity.findMany({ where: { kind: { in: ["email", "call", "sms", "meeting"] }, createdAt: { gte: since } }, select: { createdAt: true } }),
    p.edit ? prisma.emailTemplate.findUnique({ where: { id: p.edit } }) : null,
    loadNextActions(now),
    prisma.campaign.groupBy({ by: ["kind"], where: { kind: "outreach" }, _sum: { sent: true }, _count: { _all: true } }),
  ]);
  const mail = mailStatus();
  const outreachActions = actions.filter((a) => OUTREACH_CATS.has(a.category));
  const open = (k: string) => prospects.filter((x) => x.kind === k && ["new", "contacted", "qualified"].includes(x.stage)).reduce((n, x) => n + x._count._all, 0);
  const inStage = (k: string, s: string) => prospects.find((x) => x.kind === k && x.stage === s)?._count._all ?? 0;
  const weekTouches = touchesWeek.reduce((n, x) => n + x._count._all, 0);
  const days = Array.from({ length: 28 }, (_, i) => new Date(t - (27 - i) * DAY).toISOString().slice(0, 10));
  const perDay = days.map((d) => ({ label: d.slice(8), value: touches.filter((x) => x.createdAt.toISOString().slice(0, 10) === d).length }));
  const self = (over: Record<string, string | undefined> = {}) => `/admin/outreach${qs(p, { ok: undefined, err: undefined, edit: undefined, ...over })}`;

  return (
    <div className="dk-stack">
      <DeskHeader
        href="/admin/outreach"
        flash={flashOf(p)}
        signals={[
          { label: "Moves ready", value: `${outreachActions.length} drafted`, tone: outreachActions.length ? "live" : "ok", href: self({ tab: undefined }) },
          { label: "Touches this week", value: `${weekTouches}`, tone: "ok" },
          { label: "Your mailbox", value: mail.smtp ? "connected" : mail.resend ? "via Resend" : "not set", tone: mail.smtp || mail.resend ? "ok" : "warn", href: "/admin/system" },
          { label: "Templates", value: `${templates.length}`, tone: "ok", href: self({ tab: "templates" }) },
        ]}
        actions={
          <>
            <Link prefetch={false} className="dk-btn dk-btn--onink" href="/admin/crm?kind=host&stage=new&view=board">
              <Icon name="crm" size={15} /> Host prospects
            </Link>
            <Link prefetch={false} className="dk-btn dk-btn--light" href="/admin/campaigns#new">
              <Icon name="outreach" size={15} /> Outreach wave
            </Link>
          </>
        }
      />

      <div className="dk-grid dk-grid--4">
        <CohortTile kicker="Open host prospects" title={`${open("host")} hosts`} sub={`${inStage("host", "qualified")} qualified · ${inStage("host", "new")} not yet contacted`} href="/admin/crm?kind=host&view=board" />
        <CohortTile kicker="Operators & co-living" title={`${open("operator")} operators`} sub={`${inStage("operator", "qualified")} qualified`} href="/admin/crm?kind=operator&view=board" />
        <CohortTile kicker="Partners" title={`${open("partner")} partners`} sub={`${inStage("partner", "qualified")} qualified`} href="/admin/crm?kind=partner" />
        <CohortTile kicker="Waves sent" title={`${sendCounts[0]?._count._all ?? 0} outreach waves`} sub={`${sendCounts[0]?._sum.sent ?? 0} emails delivered`} href="/admin/campaigns" />
      </div>

      <ViewSwitch
        items={[
          { key: "work", label: "Work the list", href: self({ tab: undefined }), on: tab === "work", icon: "spark", count: outreachActions.length },
          { key: "templates", label: "Templates", href: self({ tab: "templates" }), on: tab === "templates", icon: "mail", count: templates.length },
        ]}
      />

      {tab === "work" ? (
        <div className="dk-grid dk-grid--2-1">
          <Panel kicker="Outreach queue" title="Who to reach today" sub="Follow-ups due, prospects going quiet, qualified hosts, unused invites and hosts ready for sponsorship — each with a draft in your voice.">
            <NextBest actions={outreachActions} limit={15} compact />
          </Panel>
          <div className="dk-stack">
            <Panel title="Touches per day" sub="Emails, calls, texts and meetings logged — last 4 weeks.">
              <Columns rows={perDay} height={130} />
            </Panel>
            <div className="dk-kpis">
              {(["email", "call", "sms", "meeting"] as const).map((k) => (
                <Kpi key={k} label={k === "sms" ? "Texts" : `${k[0].toUpperCase()}${k.slice(1)}s`} value={touchesWeek.find((x) => x.kind === k)?._count._all ?? 0} sub="this week" />
              ))}
            </div>
            <Panel title="Prospect pipeline" sub="Hosts and operators by stage.">
              <RankedBars
                rows={["new", "contacted", "qualified", "customer", "lost"].map((s) => ({
                  key: s,
                  label: s,
                  value: inStage("host", s) + inStage("operator", s) + inStage("partner", s),
                  href: `/admin/crm?stage=${s}&kind=host`,
                }))}
              />
            </Panel>
          </div>
        </div>
      ) : (
        <Panel
          flush
          title={`Templates · ${templates.length}`}
          sub="Merge fields: {{first_name}} {{name}} {{city}} {{app_url}} {{invite_link}} {{days}}"
          actions={
            <>
              <form action={loadStarterTemplates}>
                <button className="dk-btn dk-btn--sm">{templates.length ? "Add missing starters" : "Load 6 starter templates"}</button>
              </form>
              <Link prefetch={false} className="dk-btn dk-btn--primary dk-btn--sm" href={self({ tab: "templates", edit: "new" })} scroll={false}>
                <Icon name="plus" size={13} /> New template
              </Link>
            </>
          }
        >
          {templates.length === 0 ? (
            <div style={{ padding: 20 }}>
              <Empty title="No templates yet.">Load the starters — host invitation, operator pitch, follow-up, newsletter, trial invite and a product update — then edit them to sound like you.</Empty>
            </div>
          ) : (
            <div className="dk-tablewrap">
              <table className="dk-table">
                <thead>
                  <tr>
                    <th>Used for</th>
                    <th>Template</th>
                    <th>Updated</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {templates.map((tp) => (
                    <tr key={tp.id}>
                      <td>
                        <Chip tone={PURPOSE_TONE[tp.purpose] ?? "ink"}>{tp.purpose}</Chip>
                      </td>
                      <td className="dk-wrap">
                        <Link prefetch={false} href={self({ tab: "templates", edit: tp.id })} scroll={false}>
                          <b>{tp.name}</b>
                        </Link>
                        <div className="dk-dim">{tp.subject}</div>
                      </td>
                      <td className="dk-dim">{when(tp.updatedAt, false)}</td>
                      <td>
                        <div className="dk-inline" style={{ justifyContent: "flex-end" }}>
                          <Link prefetch={false} className="dk-btn dk-btn--sm" href={self({ tab: "templates", edit: tp.id })} scroll={false}>
                            Edit
                          </Link>
                          <Link prefetch={false} className="dk-btn dk-btn--sm" href={`/admin/campaigns?template=${tp.id}#new`}>
                            Use in a wave
                          </Link>
                          <form action={deleteTemplate}>
                            <input type="hidden" name="id" value={tp.id} />
                            <button className="dk-btn dk-btn--ghost dk-btn--sm">Delete</button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {p.edit ? (
        <RouteDrawer closeHref={self({ tab: "templates" })} kicker="Template" title={editing ? `Edit “${editing.name}”` : "New template"} width={640}>
          <form action={saveTemplate} className="dk-form">
            <input type="hidden" name="id" value={editing?.id ?? ""} />
            <label className="dk-field">
              <span>Name</span>
              <input name="name" defaultValue={editing?.name} required />
            </label>
            <label className="dk-field">
              <span>Used for</span>
              <select name="purpose" defaultValue={editing?.purpose ?? "outreach"}>
                <option value="outreach">Outreach</option>
                <option value="newsletter">Newsletter</option>
                <option value="bulk">Announcement</option>
                <option value="trial">Trial invite</option>
              </select>
            </label>
            <label className="dk-field dk-field--wide">
              <span>Subject</span>
              <input name="subject" defaultValue={editing?.subject} required />
            </label>
            <label className="dk-field dk-field--wide">
              <span>Body</span>
              <textarea name="body" rows={16} defaultValue={editing?.body} required />
            </label>
            <p className="dk-hint">
              Merge fields: {"{{first_name}} {{name}} {{city}} {{app_url}} {{invite_link}} {{days}}"}. Blank line = paragraph · “- ” bullets · “# ” heading · **bold** · [link](https://…). Keep copy about the home and the product — never about who may live there.
            </p>
            <button className="dk-btn dk-btn--primary">Save template</button>
          </form>
        </RouteDrawer>
      ) : null}

      <p className="dk-hint">
        {KIND_LABEL.host} outreach goes one-to-one from {mail.smtp ? `your mailbox (${mail.smtp})` : "Resend until your mailbox is connected"}; waves go through the outbox with an unsubscribe link and your address.
      </p>
    </div>
  );
}
