import { prisma } from "@/lib/prisma";
import { reconcileEmailReceipts } from "@/lib/notifications";
import { verifyEmailWebhook } from "@/lib/security/email-webhook";
import { fail, handle, ok, readText } from "@/lib/v1/http";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return fail(503, "not_configured", "Delivery callbacks are not configured.");
  const raw = await readText(req, 64 * 1024);
  if (!verifyEmailWebhook(raw, req.headers, secret)) return fail(401, "invalid_signature", "Invalid callback signature.");
  let event: { type?: string; created_at?: string; data?: { email_id?: string } };
  try { event = JSON.parse(raw); } catch { return fail(400, "bad_json", "Invalid callback payload."); }
  if (!event || !["email.delivered", "email.bounced", "email.complained", "email.failed"].includes(event.type ?? "")) return ok({ ignored: true });
  const occurredAt = new Date(event.created_at ?? "");
  if (!event.data?.email_id || event.data.email_id.length > 200 || Number.isNaN(occurredAt.getTime())) return fail(400, "bad_event", "Invalid delivery event.");
  await prisma.emailWebhookReceipt.upsert({ where: { id: req.headers.get("svix-id")! }, update: {}, create: {
    id: req.headers.get("svix-id")!, providerId: event.data.email_id, type: event.type!, occurredAt,
  } });
  await reconcileEmailReceipts(event.data.email_id);
  return ok({ ok: true });
});
