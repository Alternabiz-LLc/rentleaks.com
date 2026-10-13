/**
 * RentLeaks' own Worker bindings and secrets (wrangler.jsonc + dashboard).
 * OpenNext declares its bindings in the same global interface. Written by
 * hand on purpose: `wrangler types` output collides with Next.js's DOM types.
 */
interface CloudflareEnv {
  HYPERDRIVE?: { connectionString: string };
  APP_URL?: string;
  CRON_SECRET?: string;
  CHARGEBEE_BANK_ENABLED?: string;
  CHARGEBEE_SITE?: string;
  CHARGEBEE_API_KEY?: string;
  CHARGEBEE_WEBHOOK_USER?: string;
  CHARGEBEE_WEBHOOK_PASSWORD?: string;
  CHARGEBEE_PRICE_LISTING_WEEK?: string;
  CHARGEBEE_PRICE_LISTING_MONTH?: string;
  CHARGEBEE_PRICE_SPONSORED_WEEK?: string;
  CHARGEBEE_PRICE_SPONSORED_MONTH?: string;
  MEDIA_BUCKET?: R2Bucket;
  MEDIA_PUBLIC_URL?: string;
  EMAIL?: {
    send(message: {
      to: string;
      from: { email: string; name?: string };
      replyTo?: { email: string; name?: string };
      subject: string;
      text?: string;
      html?: string;
      headers?: Record<string, string>;
    }): Promise<{ messageId: string }>;
  };
}
