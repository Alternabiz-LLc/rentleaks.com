/**
 * RentLeaks' own Worker bindings and secrets (wrangler.jsonc + dashboard).
 * OpenNext declares its bindings in the same global interface. Written by
 * hand on purpose: `wrangler types` output collides with Next.js's DOM types.
 */
interface CloudflareEnv {
  HYPERDRIVE?: { connectionString: string };
  APP_URL?: string;
  CRON_SECRET?: string;
}
