import { processOutbox } from "@/lib/outbox";
import { fail, handle, ok } from "@/lib/v1/http";

export const dynamic = "force-dynamic";

/**
 * The five-minute outbox (worker.ts). Bearer CRON_SECRET only.
 */
async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return fail(401, "unauthorized", "Missing or wrong cron secret.");
  }
  return ok(await processOutbox());
}

export const POST = handle(run);
export const GET = handle(run);
