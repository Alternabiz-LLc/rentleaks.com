import Link from "next/link";
import { opsSettingAction } from "@/app/admin/_actions/ops";
import { addRecipe, playbookAction, savePlaybook } from "@/app/admin/_actions/playbooks";
import { Kpi } from "@/components/admin/desk/charts";
import { DeskHeader } from "@/components/admin/desk/DeskHeader";
import { Icon } from "@/components/admin/desk/Icon";
import { RouteDrawer } from "@/components/admin/desk/RouteDrawer";
import { ago, Chip, Empty, Panel } from "@/components/admin/desk/parts";
import { flashOf, qs, readParams, when, type SP } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";
import { nowMs } from "@/lib/admin/metrics";
import { prisma } from "@/lib/prisma";
import { getSettings, SETTING_KEYS } from "@/lib/settings";
import { ACTIONS, LOOKBACK_DAYS, MERGE_FIELDS, preview, RECIPES, TRIGGERS, isAction, isTrigger, waitLabel, type TriggerKey } from "@/lib/ops/playbooks";

export const metadata = { title: "Playbooks & autopilot — RentLeaks desk" };

const DAY = 86_400_000;
const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
const RUN_TONE: Record<string, "good" | "warn" | "bad" | "ink"> = { done: "good", skipped: "warn", failed: "bad", running: "ink" };

function splitWait(mins: number) {
  if (mins % 1440 === 0 && mins > 0) return { wait: mins / 1440, unit: "day" };
  if (mins % 60 === 0 && mins > 0) return { wait: mins / 60, unit: "hour" };
  return { wait: mins, unit: "min" };
}

function Sentence({ trigger, wait, action }: { trigger: string; wait: number; action: string }) {
  const tr = isTrigger(trigger) ? TRIGGERS[trigger] : null;
  return (
    <p className="dk-rule">
      <span className="dk-rule__when">When</span> {tr ? lowerFirst(tr.label) : trigger}
      <span className="dk-rule__arrow">→</span>
      <span className="dk-rule__wait">{wait ? `${waitLabel(wait)} ${tr?.unit ?? "later"}` : "right away"}</span>
      <span className="dk-rule__arrow">→</span>
      <b>{isAction(action) ? lowerFirst(ACTIONS[action].label) : action}</b>
    </p>
  );
}

/**
 * Playbooks: 1 pick a recipe, 2 read it and switch it on, 3 watch the log.
 * The two built-in autopilots (instant reply, weekly freshness) live at the
 * bottom so everything automatic is in one place.
 */
export default async function PlaybooksPage({ searchParams }: { searchParams: SP }) {
  await requireAdminPage("/admin/playbooks");
  const p = await readParams(searchParams);
  const t = nowMs();
  const now = new Date(t);
  const self = (over: Record<string, string | undefined> = {}) => `/admin/playbooks${qs(p, { ok: undefined, err: undefined, ...over })}`;
  const [books, runs, week, settings] = await Promise.all([
    prisma.playbook.findMany({ orderBy: [{ enabled: "desc" }, { createdAt: "asc" }] }),
    prisma.playbookRun.findMany({ orderBy: { createdAt: "desc" }, take: 40, include: { playbook: { select: { name: true } } } }),
    prisma.playbookRun.groupBy({ by: ["status"], where: { createdAt: { gte: new Date(t - 7 * DAY) } }, _count: { _all: true } }),
    getSettings([SETTING_KEYS.autopilot, SETTING_KEYS.freshness, SETTING_KEYS.opsHeartbeat]),
  ]);
  const autopilot = settings[SETTING_KEYS.autopilot] !== "off";
  const freshness = settings[SETTING_KEYS.freshness] !== "off";
  const beat = settings[SETTING_KEYS.opsHeartbeat] ? new Date(settings[SETTING_KEYS.opsHeartbeat]) : null;
  const beatOk = beat && !Number.isNaN(beat.getTime()) && t - beat.getTime() < 20 * 60_000;
  const on = books.filter((b) => b.enabled);
  const weekCount = (s: string) => week.find((w) => w.status === s)?._count._all ?? 0;
  const due = new Map(await Promise.all(books.map(async (b) => [b.id, (await preview(b, now)).length] as const)));
  const edit = p.edit === "new" ? "new" : books.find((b) => b.id === p.edit);
  const presetTrigger = isTrigger(p.trigger ?? "") ? (p.trigger as TriggerKey) : "lead_waiting";

  return (
    <div className="dk-stack">
      <DeskHeader
        href="/admin/playbooks"
        flash={flashOf(p)}
        signals={[
          { label: "Playbooks on", value: `${on.length} of ${books.length}`, tone: on.length ? "live" : "warn" },
          { label: "Instant reply", value: autopilot ? "on" : "off", tone: autopilot ? "live" : "warn", href: "#settings" },
          {
            label: "Automation clock",
            value: beat && !Number.isNaN(beat.getTime()) ? `last ran ${ago(t - beat.getTime())}` : "hasn't run yet",
            tone: beatOk ? "ok" : "critical",
          },
        ]}
        actions={
          <>
            <form action={playbookAction}>
              <input type="hidden" name="returnTo" value={self()} />
              <button className="dk-btn dk-btn--onink" name="op" value="run">
                <Icon name="bolt" size={15} /> Run due now
              </button>
            </form>
            <Link prefetch={false} className="dk-btn dk-btn--light" href={self({ edit: "new" })} scroll={false}>
              <Icon name="plus" size={15} /> New playbook
            </Link>
          </>
        }
      />

      <div className="dk-kpis">
        <Kpi label="Playbooks on" value={on.length} tone={on.length ? "good" : undefined} />
        <Kpi label="Actions · 7 days" value={weekCount("done")} sub="emails, alerts, follow-ups" />
        <Kpi label="Skipped · 7 days" value={weekCount("skipped")} sub="unsubscribed or no contact" />
        <Kpi label="Failed · 7 days" value={weekCount("failed")} tone={weekCount("failed") ? "alert" : undefined} sub="see the log" />
      </div>

      <Panel kicker="1 · Pick" title="Recipes" sub="Proven moves for a rental desk. Adding one creates it switched off, so you can read it first.">
        <div className="dk-recipes">
          {RECIPES.map((r) => {
            const have = books.find((b) => b.name === r.name);
            return (
              <article key={r.id} className={`dk-recipe${have ? " is-added" : ""}`}>
                <b>{r.name}</b>
                <p>{r.pitch}</p>
                <Sentence trigger={r.trigger} wait={r.waitMinutes} action={r.action} />
                {have ? (
                  <Link prefetch={false} className="dk-btn dk-btn--sm" href={self({ edit: have.id })} scroll={false}>
                    {have.enabled ? "On · open" : "Added · open"}
                  </Link>
                ) : (
                  <form action={addRecipe}>
                    <input type="hidden" name="recipe" value={r.id} />
                    <input type="hidden" name="returnTo" value={self()} />
                    <button className="dk-btn dk-btn--primary dk-btn--sm">
                      <Icon name="plus" size={13} /> Add
                    </button>
                  </form>
                )}
              </article>
            );
          })}
        </div>
      </Panel>

      <div className="dk-grid dk-grid--2-1">
        <Panel kicker="2 · Switch on" title="Your playbooks" sub={`Runs every 5 minutes. Each one acts once per person or listing, never twice. A new playbook reaches back ${LOOKBACK_DAYS} days.`}>
          {books.length === 0 ? (
            <Empty title="No playbooks yet.">Add a recipe above — the two-hour alarm is a good first one.</Empty>
          ) : (
            <ul className="dk-books">
              {books.map((b) => (
                <li key={b.id} className={b.enabled ? "is-on" : undefined}>
                  <div>
                    <Link prefetch={false} href={self({ edit: b.id })} scroll={false}>
                      <b>{b.name}</b>
                    </Link>
                    <Sentence trigger={b.trigger} wait={b.waitMinutes} action={b.action} />
                    <small>
                      {b.runs} action{b.runs === 1 ? "" : "s"} so far{b.lastRunAt ? ` · last ${ago(t - b.lastRunAt.getTime())}` : ""} ·{" "}
                      {due.get(b.id) ? <b>{due.get(b.id)} due now</b> : "nothing due now"}
                    </small>
                  </div>
                  <form action={playbookAction} className="dk-inline">
                    <input type="hidden" name="id" value={b.id} />
                    <input type="hidden" name="returnTo" value={self()} />
                    <button className={`dk-switch${b.enabled ? " is-on" : ""}`} name="op" value={b.enabled ? "off" : "on"} aria-pressed={b.enabled} title={b.enabled ? "Switch off" : "Switch on"}>
                      <i />
                      <span>{b.enabled ? "On" : "Off"}</span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel kicker="3 · Watch" title="Run log" sub="Newest first.">
          {runs.length === 0 ? (
            <Empty title="Nothing has run yet." />
          ) : (
            <ul className="dk-feed">
              {runs.map((r) => (
                <li key={r.id}>
                  <span className="dk-feed__icon">
                    <Icon name="bolt" size={14} />
                  </span>
                  <div>
                    <b>{r.playbook.name}</b>
                    <p>{r.detail || r.targetType}</p>
                  </div>
                  <span className="dk-feed__side">
                    <Chip tone={RUN_TONE[r.status] ?? "ink"}>{r.status}</Chip>
                    <time dateTime={r.createdAt.toISOString()}>{ago(t - r.createdAt.getTime())}</time>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel id="settings" kicker="Built in" title="Autopilot" sub="The two automations that come with the desk.">
        <ul className="dk-books">
          <li className={autopilot ? "is-on" : undefined}>
            <div>
              <b>Instant reply to new requests</b>
              <small>
                The renter&apos;s confirmation carries up to three live homes that fit, the moment they ask. The team is alerted, and again after an hour without a personal
                reply. Example listings are never offered.
              </small>
            </div>
            <form action={opsSettingAction}>
              <input type="hidden" name="key" value="autopilot" />
              <input type="hidden" name="returnTo" value={self()} />
              <button className={`dk-switch${autopilot ? " is-on" : ""}`} name="value" value={autopilot ? "off" : "on"} aria-pressed={autopilot}>
                <i />
                <span>{autopilot ? "On" : "Off"}</span>
              </button>
            </form>
          </li>
          <li className={freshness ? "is-on" : undefined}>
            <div>
              <b>Weekly freshness check</b>
              <small>
                Hosts of homes not confirmed in two weeks get one email: still available, or taken? No answer within 7 days pauses the listing — one tap brings it back.{" "}
                <Link prefetch={false} href="/admin/compliance?tab=freshness">
                  See freshness →
                </Link>
              </small>
            </div>
            <form action={opsSettingAction}>
              <input type="hidden" name="key" value="freshness" />
              <input type="hidden" name="returnTo" value={self()} />
              <button className={`dk-switch${freshness ? " is-on" : ""}`} name="value" value={freshness ? "off" : "on"} aria-pressed={freshness}>
                <i />
                <span>{freshness ? "On" : "Off"}</span>
              </button>
            </form>
          </li>
        </ul>
        <p className="dk-hint" style={{ marginTop: 10 }}>
          {beat && !Number.isNaN(beat.getTime())
            ? `Automation clock last ran ${when(beat)}${beatOk ? "." : " — more than 20 minutes ago. Check the Cloudflare cron in System."}`
            : "The automation clock hasn't run yet. It starts with the 5-minute Cloudflare cron after the next deploy."}
        </p>
      </Panel>

      {edit ? (
        (() => {
          const b = edit === "new" ? null : edit;
          const trig = (b?.trigger && isTrigger(b.trigger) ? b.trigger : presetTrigger) as TriggerKey;
          const w = splitWait(b ? b.waitMinutes : TRIGGERS[trig].defaultWait);
          return (
            <RouteDrawer closeHref={self({ edit: undefined })} kicker={b ? (b.enabled ? "On" : "Off") : "New playbook"} title={b ? b.name : "When this happens, do that"} width={620}>
              <form action={savePlaybook} className="dk-form">
                {b ? <input type="hidden" name="id" value={b.id} /> : null}
                <input type="hidden" name="returnTo" value={self()} />
                <label className="dk-field dk-field--wide">
                  <span>Name</span>
                  <input name="name" required defaultValue={b?.name ?? ""} placeholder="Two-hour alarm" />
                </label>
                <fieldset className="dk-fieldset">
                  <legend>1 · When</legend>
                  <div className="dk-form">
                    <label className="dk-field dk-field--wide">
                      <span>This happens</span>
                      <select name="trigger" defaultValue={trig}>
                        {(Object.keys(TRIGGERS) as TriggerKey[]).map((k) => (
                          <option key={k} value={k}>
                            {TRIGGERS[k].label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="dk-field">
                      <span>Wait</span>
                      <input name="wait" type="number" min={0} max={259200} defaultValue={w.wait} />
                    </label>
                    <label className="dk-field">
                      <span>Unit</span>
                      <select name="unit" defaultValue={w.unit}>
                        <option value="min">minutes</option>
                        <option value="hour">hours</option>
                        <option value="day">days</option>
                      </select>
                    </label>
                    <p className="dk-hint">For free weeks and stays, the wait counts back from the end date.</p>
                  </div>
                </fieldset>
                <fieldset className="dk-fieldset">
                  <legend>2 · Do</legend>
                  <div className="dk-form">
                    <label className="dk-field dk-field--wide">
                      <span>Action</span>
                      <select name="action" defaultValue={b?.action ?? "notify_team"}>
                        {(Object.keys(ACTIONS) as Array<keyof typeof ACTIONS>).map((k) => (
                          <option key={k} value={k}>
                            {ACTIONS[k].label} — {ACTIONS[k].hint}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="dk-field dk-field--wide">
                      <span>Subject</span>
                      <input name="subject" defaultValue={b?.subject ?? ""} placeholder="Did any of these homes fit, {{first_name}}?" />
                    </label>
                    <label className="dk-field dk-field--wide">
                      <span>Message</span>
                      <textarea name="body" rows={9} defaultValue={b?.body ?? ""} />
                    </label>
                    <p className="dk-hint">
                      Merge fields: {MERGE_FIELDS.join(" ")}. Write about the home and the dates — never about the person. Unsubscribed addresses are always skipped.
                    </p>
                  </div>
                </fieldset>
                <div className="dk-inline">
                  <button className="dk-btn dk-btn--primary">{b ? "Save" : "Create (switched off)"}</button>
                  {b ? <span className="dk-dim">{due.get(b.id) ? `${due.get(b.id)} due right now` : "nothing due right now"}</span> : null}
                </div>
              </form>
              {b ? (
                <form action={playbookAction} className="dk-inline" style={{ marginTop: 16 }}>
                  <input type="hidden" name="id" value={b.id} />
                  <input type="hidden" name="returnTo" value={self({ edit: undefined })} />
                  <button className="dk-btn" name="op" value={b.enabled ? "off" : "on"}>
                    {b.enabled ? "Switch off" : "Switch on"}
                  </button>
                  <button className="dk-btn dk-btn--ghost" name="op" value="delete">
                    Delete
                  </button>
                </form>
              ) : null}
            </RouteDrawer>
          );
        })()
      ) : null}
    </div>
  );
}
