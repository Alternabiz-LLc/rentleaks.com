/**
 * Cloudflare entry point: OpenNext's Next.js handler plus the scheduled jobs.
 * `.open-next/worker.js` is produced by `npm run cf:build`.
 *
 *   "0 * * * *"    → /api/v1/cron/alerts  (saved-search alerts)
 *   "*\/5 * * * *" → /api/cron/outbox     (campaign emails, social posts, invites)
 */
// @ts-expect-error: generated at build time
import { default as handler } from "./.open-next/worker.js";
// @ts-expect-error: provided by the Workers runtime
import { connect } from "cloudflare:sockets";

/* TCP sockets for the SMTP client (src/lib/v1/smtp.ts). Only this entry file
   can import cloudflare:sockets; the Next.js bundle reads it from here. */
(globalThis as unknown as { __rlSocketConnect?: unknown }).__rlSocketConnect = connect;

type Ctx = { waitUntil(promise: Promise<unknown>): void };
type ScheduledEvent = { cron?: string };

const JOBS: Record<string, string> = {
  "0 * * * *": "/api/v1/cron/alerts",
  "*/5 * * * *": "/api/cron/outbox",
};

const worker = {
  fetch: handler.fetch,

  async scheduled(event: ScheduledEvent, env: CloudflareEnv, ctx: Ctx) {
    if (!env.CRON_SECRET) {
      console.error("cron: CRON_SECRET is not set; skipping scheduled jobs");
      return;
    }
    const path = JOBS[event.cron || ""] || "/api/v1/cron/alerts";
    const base = (env.APP_URL || "https://app.rentleaks.com").replace(/\/$/, "");
    const request = new Request(`${base}${path}`, {
      method: path === "/api/cron/outbox" ? "POST" : "GET",
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    });
    ctx.waitUntil(
      Promise.resolve(handler.fetch(request, env, ctx)).then(async (res: Response) => {
        if (!res.ok) console.error(`cron: ${path} returned`, res.status, await res.text());
      }),
    );
  },
};

export default worker;
