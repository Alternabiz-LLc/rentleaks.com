import { runOutboxNow, saveSettings, sendTestEmail, suppressEmail, testUpload } from "@/app/admin/_actions/system";
import { Kpi } from "@/components/admin/desk/charts";
import { DeskHeader } from "@/components/admin/desk/DeskHeader";
import { Icon } from "@/components/admin/desk/Icon";
import { ago, Chip, Panel } from "@/components/admin/desk/parts";
import { flashOf, readParams, when, type SP } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";
import { nowMs } from "@/lib/admin/metrics";
import { prisma } from "@/lib/prisma";
import { getSettings, SETTING_KEYS } from "@/lib/settings";
import { facebookConfig } from "@/lib/social";
import { storageMode } from "@/lib/storage";
import { mailStatus } from "@/lib/v1/mail";

export const metadata = { title: "System & settings — RentLeaks desk" };

function age(iso?: string) {
  if (!iso) return null;
  const mins = Math.round((nowMs() - new Date(iso).getTime()) / 60_000);
  return Number.isFinite(mins) ? mins : null;
}

export default async function SystemAdmin({ searchParams }: { searchParams: SP }) {
  const me = await requireAdminPage("/admin/system");
  const p = await readParams(searchParams);
  const t0 = nowMs();
  let dbOk = true;
  let migrations: Array<{ migration_name: string; finished_at: Date | null }> = [];
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbOk = false;
  }
  if (dbOk) {
    migrations = await prisma.$queryRaw<typeof migrations>`SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 3`.catch(() => []);
  }
  const dbMs = nowMs() - t0;
  const [settings, actions, suppressed, queued] = await Promise.all([
    getSettings([SETTING_KEYS.mailingAddress, SETTING_KEYS.senderName, SETTING_KEYS.outboxHeartbeat, SETTING_KEYS.alertsHeartbeat, SETTING_KEYS.opsHeartbeat]),
    prisma.adminAction.findMany({ where: p.action ? { action: { startsWith: p.action } } : {}, orderBy: { createdAt: "desc" }, take: 80 }).catch(() => []),
    prisma.emailSuppression.count().catch(() => 0),
    prisma.campaignSend.count({ where: { status: "queued" } }).catch(() => 0),
  ]);
  const actorIds = [...new Set(actions.map((a) => a.actorId))];
  const actors = new Map(
    (actorIds.length ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }) : []).map((u) => [u.id, u.name]),
  );
  const mail = mailStatus();
  const storage = storageMode();
  const outboxAge = age(settings[SETTING_KEYS.outboxHeartbeat]);
  const alertsAge = age(settings[SETTING_KEYS.alertsHeartbeat]);
  const opsAge = age(settings[SETTING_KEYS.opsHeartbeat]);
  const env = process.env;
  const checks: Array<{ name: string; ok: boolean; detail: string; fix?: string }> = [
    { name: "Database", ok: dbOk, detail: dbOk ? `${dbMs} ms · latest migration ${migrations[0]?.migration_name ?? "?"}` : "not reachable", fix: "Check the Hyperdrive binding (DEPLOY.md §2)." },
    {
      name: "Email",
      ok: mail.resend || Boolean(mail.smtp),
      detail: [mail.resend ? "Resend ✓" : "Resend –", mail.smtp ? `SMTP ✓ ${mail.smtp}` : "SMTP –", `from ${mail.from}`].join(" · "),
      fix: "Run: bash tools/deploy-cloudflare.sh --secrets",
    },
    {
      name: "Mailing address",
      ok: Boolean(settings[SETTING_KEYS.mailingAddress]),
      detail: settings[SETTING_KEYS.mailingAddress] || "missing — required before any newsletter or campaign",
      fix: "Fill it in below.",
    },
    { name: "Photo uploads", ok: storage === "r2-binding" || storage === "s3" || storage === "local-disk", detail: storage, fix: "Bind MEDIA_BUCKET (wrangler.jsonc) and redeploy." },
    { name: "Outbox job (5 min)", ok: outboxAge !== null && outboxAge < 15, detail: outboxAge === null ? "never ran" : `last ran ${outboxAge} min ago · ${queued} emails queued`, fix: "Needs CRON_SECRET and the */5 cron trigger." },
    { name: "Automation clock (5 min)", ok: opsAge !== null && opsAge < 20, detail: opsAge === null ? "never ran" : `last ran ${opsAge} min ago · escalations, freshness, briefs, playbooks`, fix: "Runs with the outbox job — see Playbooks & autopilot." },
    { name: "Alerts job (hourly)", ok: alertsAge !== null && alertsAge < 90, detail: alertsAge === null ? "never ran" : `last ran ${alertsAge} min ago` },
    { name: "Facebook Page publishing", ok: Boolean(facebookConfig()), detail: facebookConfig() ? `page ${facebookConfig()!.pageId}` : "manual posting only", fix: "Set FB_PAGE_ID and FB_PAGE_TOKEN." },
    { name: "Shared rate limits", ok: Boolean(env.UPSTASH_REDIS_REST_URL), detail: env.UPSTASH_REDIS_REST_URL ? "Upstash" : "per-instance memory (fine at launch)" },
    { name: "Checkout", ok: Boolean(env.STRIPE_SECRET_KEY), detail: env.STRIPE_SECRET_KEY ? "Stripe configured" : "Stripe not configured — listings are not charged yet" },
    { name: "Meta catalog feed", ok: Boolean(env.META_FEED_KEY), detail: env.META_FEED_KEY ? "/feeds/meta-home-listings.csv?key=…" : "META_FEED_KEY not set" },
  ];

  const okCount = checks.filter((c) => c.ok).length;
  const t = nowMs();
  const groups = [...new Set(actions.map((a) => a.action.split(".")[0]))];

  return (
    <div className="dk-stack">
      <DeskHeader
        href="/admin/system"
        flash={flashOf(p)}
        signals={[
          { label: "Health", value: `${okCount} of ${checks.length} OK`, tone: okCount === checks.length ? "live" : "warn" },
          { label: "Database", value: dbOk ? `${dbMs} ms` : "unreachable", tone: dbOk ? "live" : "critical" },
          { label: "Email", value: mail.resend ? "Resend" : mail.smtp ? "SMTP" : "not set up", tone: mail.resend || mail.smtp ? "ok" : "critical", href: "#test-email" },
          { label: "Outbox", value: outboxAge === null ? "never ran" : `${outboxAge} min ago · ${queued} queued`, tone: outboxAge !== null && outboxAge < 15 ? "ok" : "warn" },
        ]}
        actions={
          <>
            <form action={runOutboxNow}>
              <button className="dk-btn dk-btn--onink">
                <Icon name="clock" size={15} /> Run outbox now
              </button>
            </form>
            <form action={testUpload}>
              <button className="dk-btn dk-btn--onink">
                <Icon name="check" size={15} /> Test photo upload
              </button>
            </form>
          </>
        }
      />

      <div className="dk-kpis">
        <Kpi label="Checks passing" value={okCount} sub={`of ${checks.length}`} tone={okCount === checks.length ? "good" : "alert"} />
        <Kpi label="DB latency" value={dbMs} fmt="raw" sub="milliseconds" />
        <Kpi label="Emails queued" value={queued} href="/admin/campaigns?status=sending" />
        <Kpi label="Suppressed" value={suppressed} sub="never emailed again" href="#suppress" />
        <Kpi label="Audit entries" value={actions.length} sub="latest shown below" href="#audit" />
      </div>

      <Panel kicker="Integrations" title="Health" sub="Every moving part the desk depends on, with the fix beside anything that needs setting up.">
        <ul className="dk-health">
          {checks.map((c) => (
            <li key={c.name} className={c.ok ? undefined : "is-bad"}>
              <b>
                {c.name}
                <Chip tone={c.ok ? "good" : "warn"}>{c.ok ? "OK" : "Needs setup"}</Chip>
              </b>
              <span>{c.detail}</span>
              {!c.ok && c.fix ? <small>{c.fix}</small> : null}
            </li>
          ))}
        </ul>
      </Panel>

      <div className="dk-grid dk-grid--2">
        <Panel kicker="Business" title="Settings" sub="Shown in the footer of every marketing email.">
          <form action={saveSettings} className="dk-form">
            <label className="dk-field dk-field--wide">
              <span>Postal mailing address (required by anti-spam law)</span>
              <textarea name="address" rows={3} defaultValue={settings[SETTING_KEYS.mailingAddress]} placeholder="Alternabiz LLC · 123 Example St, Suite 4 · Brooklyn, NY 11201 · USA" />
            </label>
            <label className="dk-field dk-field--wide">
              <span>Sender name</span>
              <input name="sender" defaultValue={settings[SETTING_KEYS.senderName] || "RentLeaks"} />
            </label>
            <button className="dk-btn dk-btn--primary">Save settings</button>
          </form>
        </Panel>

        <Panel id="test-email" kicker="Email" title="Send a test" sub={`From ${mail.from}${mail.replyTo ? ` · replies to ${mail.replyTo}` : ""}`}>
          <form action={sendTestEmail} className="dk-form">
            <label className="dk-field">
              <span>Send to</span>
              <input name="to" type="email" defaultValue={me.email} />
            </label>
            <label className="dk-field">
              <span>As</span>
              <select name="purpose" defaultValue="transactional">
                <option value="transactional">Transactional (Resend first)</option>
                <option value="personal">Personal (your SMTP mailbox first)</option>
                <option value="bulk">Bulk (Resend first)</option>
              </select>
            </label>
            <button className="dk-btn dk-btn--primary">
              <Icon name="mail" size={14} /> Send test
            </button>
          </form>
          <form id="suppress" action={suppressEmail} className="dk-form dk-danger">
            <label className="dk-field dk-field--wide">
              <span>Never email this address again ({suppressed} suppressed)</span>
              <input name="email" type="email" placeholder="someone@example.com" />
            </label>
            <button className="dk-btn">Suppress</button>
          </form>
        </Panel>
      </div>

      <Panel
        flush
        id="audit"
        kicker="Compliance"
        title="Audit log"
        sub="Every change made from the founder desk, newest first."
        actions={
          <div className="dk-chiprow">
            <a className={`dk-chip${!p.action ? " is-on" : ""}`} href="/admin/system#audit">
              all
            </a>
            {groups.map((g) => (
              <a key={g} className={`dk-chip${p.action === g ? " is-on" : ""}`} href={`/admin/system?action=${g}#audit`}>
                {g}
              </a>
            ))}
          </div>
        }
      >
        <div className="dk-tablewrap">
          <table className="dk-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((a) => (
                <tr key={a.id}>
                  <td className="dk-dim" title={when(a.createdAt)}>
                    {ago(t - a.createdAt.getTime())}
                  </td>
                  <td>{actors.get(a.actorId) || a.actorId}</td>
                  <td>
                    <Chip tone="brand">{a.action}</Chip>
                  </td>
                  <td className="dk-wrap dk-dim">
                    {a.targetType}
                    {a.targetId ? <span className="dk-mono"> · {a.targetId}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
