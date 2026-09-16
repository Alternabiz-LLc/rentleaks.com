/**
 * Cloudflare entry point: OpenNext's Next.js handler plus the hourly cron.
 * `.open-next/worker.js` is produced by `npm run cf:build`.
 */
// @ts-expect-error: generated at build time
import { default as handler } from "./.open-next/worker.js";

type Ctx = { waitUntil(promise: Promise<unknown>): void };

const worker = {
  fetch: handler.fetch,

  async scheduled(_event: unknown, env: CloudflareEnv, ctx: Ctx) {
    if (!env.CRON_SECRET) {
      console.error("cron: CRON_SECRET is not set; skipping saved-search alerts");
      return;
    }
    const base = (env.APP_URL || "https://app.rentleaks.com").replace(/\/$/, "");
    const request = new Request(`${base}/api/v1/cron/alerts`, {
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    });
    ctx.waitUntil(
      Promise.resolve(handler.fetch(request, env, ctx)).then(async (res: Response) => {
        if (!res.ok) console.error("cron: alerts returned", res.status, await res.text());
      }),
    );
  },
};

export default worker;
