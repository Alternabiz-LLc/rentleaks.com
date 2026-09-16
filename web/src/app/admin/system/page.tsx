import { runOutboxNow, saveSettings, sendTestEmail, suppressEmail, testUpload } from "@/app/admin/_actions/system";
import { flashOf, PageHead, Pill, readParams, Section, when, type SP } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";
import { nowMs } from "@/lib/admin/metrics";
import { prisma } from "@/lib/prisma";
import { getSettings, SETTING_KEYS } from "@/lib/settings";
import { facebookConfig } from "@/lib/social";
import { storageMode } from "@/lib/storage";
import { mailStatus } from "@/lib/v1/mail";

export const metadata = { title: "System & settings — RentLeaks admin" };

function age(iso?: string) {
  if (!iso) return null;
  const mins = Math.round((nowMs() - new Date(iso).getTime()) / 60_000);
  return Number.isFinite(mins) ? mins : null;
}

export default async function SystemAdmin({ searchParams }: { searchParams: SP }) {
  const me = await requireAdminPage();
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
    getSettings([SETTING_KEYS.mailingAddress, SETTING_KEYS.senderName, SETTING_KEYS.outboxHeartbeat, SETTING_KEYS.alertsHeartbeat]),
    prisma.adminAction.findMany({ orderBy: { createdAt: "desc" }, take: 60 }).catch(() => []),
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
    { name: "Alerts job (hourly)", ok: alertsAge !== null && alertsAge < 90, detail: alertsAge === null ? "never ran" : `last ran ${alertsAge} min ago` },
    { name: "Facebook Page publishing", ok: Boolean(facebookConfig()), detail: facebookConfig() ? `page ${facebookConfig()!.pageId}` : "manual posting only", fix: "Set FB_PAGE_ID and FB_PAGE_TOKEN." },
    { name: "Shared rate limits", ok: Boolean(env.UPSTASH_REDIS_REST_URL), detail: env.UPSTASH_REDIS_REST_URL ? "Upstash" : "per-instance memory (fine at launch)" },
    { name: "Checkout", ok: Boolean(env.STRIPE_SECRET_KEY), detail: env.STRIPE_SECRET_KEY ? "Stripe configured" : "Stripe not configured — listings are not charged yet" },
    { name: "Meta catalog feed", ok: Boolean(env.META_FEED_KEY), detail: env.META_FEED_KEY ? "/feeds/meta-home-listings.csv?key=…" : "META_FEED_KEY not set" },
  ];

  return (
    <>
      <PageHead title="System & settings" sub="Health of every integration, business settings and the admin audit log." flash={flashOf(p)} />

      <Section title="Health">
        <ul className="adm-health">
          {checks.map((c) => (
            <li key={c.name}>
              <Pill tone={c.ok ? "good" : "warn"}>{c.ok ? "OK" : "Needs setup"}</Pill>
              <b>{c.name}</b>
              <span className="a-dim">{c.detail}</span>
              {!c.ok && c.fix ? <small>{c.fix}</small> : null}
            </li>
          ))}
        </ul>
        <div className="adm-inline">
          <form action={runOutboxNow}><button className="btn btn--outline">Run outbox now</button></form>
          <form action={testUpload}><button className="btn btn--outline">Test photo upload</button></form>
        </div>
      </Section>

      <div className="a-cols">
        <Section title="Business settings" sub="Shown in the footer of every marketing email.">
          <form action={saveSettings} className="adm-form">
            <label>
              Postal mailing address (required by anti-spam law)
              <textarea name="address" rows={3} defaultValue={settings[SETTING_KEYS.mailingAddress]} placeholder="Alternabiz LLC · 123 Example St, Suite 4 · Brooklyn, NY 11201 · USA" />
            </label>
            <label>
              Sender name
              <input name="sender" defaultValue={settings[SETTING_KEYS.senderName] || "RentLeaks"} />
            </label>
            <button className="btn btn--primary">Save settings</button>
          </form>
        </Section>

        <Section title="Test email">
          <form action={sendTestEmail} className="adm-form">
            <label>
              Send to
              <input name="to" type="email" defaultValue={me.email} />
            </label>
            <label>
              As
              <select name="purpose" defaultValue="transactional">
                <option value="transactional">Transactional (Resend first)</option>
                <option value="personal">Personal (your SMTP mailbox first)</option>
                <option value="bulk">Bulk (Resend first)</option>
              </select>
            </label>
            <button className="btn btn--primary">Send test</button>
          </form>
          <form action={suppressEmail} className="adm-form">
            <label>
              Never email this address again ({suppressed} suppressed)
              <input name="email" type="email" placeholder="someone@example.com" />
            </label>
            <button className="btn btn--outline">Suppress</button>
          </form>
        </Section>
      </div>

      <Section title="Audit log" sub="Every change made from the founder view, newest first.">
        <div className="a-scroll">
          <table className="a-table">
            <tbody>
              {actions.map((a) => (
                <tr key={a.id}>
                  <td>{when(a.createdAt)}</td>
                  <td>{actors.get(a.actorId) || a.actorId}</td>
                  <td>{a.action}</td>
                  <td className="adm-wrap a-dim">{a.targetType}{a.targetId ? ` · ${a.targetId}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
