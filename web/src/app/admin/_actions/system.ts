"use server";

import { revalidatePath } from "next/cache";
import { audit, errorMessage, requireAdminAction } from "@/lib/admin/guard";
import { back, field } from "@/lib/admin/flash";
import { EMAIL_RE, renderEmail } from "@/lib/marketing";
import { processOutbox } from "@/lib/outbox";
import { prisma } from "@/lib/prisma";
import { setSetting, SETTING_KEYS } from "@/lib/settings";
import { r2Target } from "@/lib/storage";
import { sendMail, type MailPurpose } from "@/lib/v1/mail";

const path = "/admin/system";

export async function saveSettings(fd: FormData) {
  const guard = await requireAdminAction();
  if (!guard.ok) back(path, "err", guard.error);
  const address = field(fd, "address", 300);
  const sender = field(fd, "sender", 80);
  await setSetting(SETTING_KEYS.mailingAddress, address);
  await setSetting(SETTING_KEYS.senderName, sender);
  await audit(guard.user.id, "settings.save", "settings", "", { address, sender });
  revalidatePath(path);
  back(path, "ok", "Settings saved.");
}

export async function sendTestEmail(fd: FormData) {
  const guard = await requireAdminAction();
  if (!guard.ok) back(path, "err", guard.error);
  const to = field(fd, "to", 160).toLowerCase() || guard.user.email;
  const purpose = (["transactional", "personal", "bulk"].includes(field(fd, "purpose")) ? field(fd, "purpose") : "transactional") as MailPurpose;
  if (!EMAIL_RE.test(to)) back(path, "err", "Enter a valid address.");
  const { text, html } = renderEmail(
    `This is a **${purpose}** test from the RentLeaks admin.\n\nIf you can read this, email is working.`,
    { address: "RentLeaks", reason: "Sent from Admin → System." },
  );
  const r = await sendMail({ to, subject: `RentLeaks test email (${purpose})`, text, html, purpose });
  await audit(guard.user.id, "system.test_email", "email", to, { purpose, ...r });
  if (r.delivered) back(path, "ok", `Sent to ${to} via ${r.transport}.`);
  back(path, "err", r.transport === "console" ? "No email provider is configured yet (see the status above)." : `Not delivered: ${r.error || "unknown error"}`);
}

export async function testUpload() {
  const guard = await requireAdminAction();
  if (!guard.ok) back(path, "err", guard.error);
  const r2 = r2Target();
  if (!r2) back(path, "err", "The MEDIA_BUCKET binding or MEDIA_PUBLIC_URL isn't available on this server.");
  const key = `health/${Date.now().toString(36)}.txt`;
  try {
    await r2.bucket.put(key, new TextEncoder().encode("ok"), { httpMetadata: { contentType: "text/plain" } });
  } catch (err) {
    back(path, "err", `Writing to the bucket failed: ${errorMessage(err)}`);
  }
  const url = `${r2.publicUrl}/${key}`;
  let status = 0;
  try {
    status = (await fetch(url, { cache: "no-store" })).status;
  } catch {
    status = 0;
  }
  if (status === 200) back(path, "ok", `Upload works: ${url}`);
  back(path, "err", `Saved to the bucket, but ${url} answered ${status || "nothing"}. Connect the custom domain media.rentleaks.com to the rentleaks-media bucket.`);
}

export async function runOutboxNow() {
  const guard = await requireAdminAction();
  if (!guard.ok) back(path, "err", guard.error);
  let r: Awaited<ReturnType<typeof processOutbox>>;
  try {
    r = await processOutbox({ batch: 25 });
  } catch (err) {
    back(path, "err", `Outbox failed: ${errorMessage(err)}`);
  }
  await audit(guard.user.id, "system.outbox", "outbox", "", r as unknown as Record<string, unknown>);
  back(path, "ok", `Outbox ran: ${r.email.sent} emails sent, ${r.email.remaining} queued, ${r.social.published} posts published, ${r.expired} invites expired.`);
}

export async function suppressEmail(fd: FormData) {
  const guard = await requireAdminAction();
  if (!guard.ok) back(path, "err", guard.error);
  const email = field(fd, "email", 160).toLowerCase();
  if (!EMAIL_RE.test(email)) back(path, "err", "Enter a valid address.");
  const { unsubscribeEmail } = await import("@/lib/unsubscribe");
  await unsubscribeEmail(email, "admin");
  await prisma.emailSuppression.update({ where: { email }, data: { reason: "manual" } }).catch(() => undefined);
  await audit(guard.user.id, "system.suppress", "email", email);
  back(path, "ok", `${email} will not receive marketing email.`);
}
