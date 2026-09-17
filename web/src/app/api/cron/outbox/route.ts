import { processOutbox } from "@/lib/outbox";
import { runOps } from "@/lib/ops/cron";
import { fail, handle, ok } from "@/lib/v1/http";

export const dynamic = "force-dynamic";

/**
 * The five-minute outbox (worker.ts), then the automation clock (escalations,
 * freshness, briefs, playbooks). Bearer CRON_SECRET only.
 */
async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return fail(401, "unauthorized", "Missing or wrong cron secret.");
  }
  const outbox = await processOutbox();
  let ops: Record<string, unknown> = {};
  try {
    ops = await runOps(new Date());
  } catch (err) {
    console.error("[cron] ops", err instanceof Error ? err.message : err);
    ops = { error: true };
  }
  return ok({ ...outbox, ops });
}

export const POST = handle(run);
export const GET = handle(run);
