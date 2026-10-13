/**
 * Email.
 *
 * Transports, chosen per message:
 *
 * - Cloudflare Email (`EMAIL` binding) — sends as the domain address. This is
 *   the path for a Namecheap forwarding address such as hello@rentleaks.com,
 *   which can receive mail but cannot log in to SMTP.
 * - Resend (RESEND_API_KEY) — an HTTP API; the default for everything the app
 *   sends on its own (password resets, lead alerts, newsletters, campaigns)
 *   when Cloudflare Email is not bound.
 * - SMTP (SMTP_HOST, SMTP_USER, SMTP_PASS) — a real mailbox such as Namecheap
 *   Private Email (mail.privateemail.com). Used for `personal` mail only when
 *   the address is an actual mailbox. A domain forwarder will reject AUTH.
 *
 * With none of these, the message is logged to the console, which is what you want
 * in development (the reset link appears in the terminal running `npm run dev`).
 *
 * SMTP needs TCP sockets, which only the Cloudflare Worker provides here
 * (worker.ts hands `connect` over), so in local dev SMTP falls back to Resend
 * or the console.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { onWorkers } from "../runtime";
import { smtpSend, socketConnect } from "./smtp";
import { containsDevelopmentUrl } from "../origin";

export type MailPurpose = "transactional" | "bulk" | "personal";

export type Mail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  purpose?: MailPurpose;
  replyTo?: string;
  /** Extra headers, e.g. List-Unsubscribe on marketing mail. */
  headers?: Record<string, string>;
  /** Overrides MAIL_FROM (SMTP always sends from the mailbox itself). */
  from?: string;
  idempotencyKey?: string;
  queueGuard?: { signerId: string; tokenHash: string };
};

export type MailResult = { delivered: boolean; transport: "cloudflare" | "resend" | "smtp" | "console" | "blocked" | "queued"; error?: string; providerId?: string };

type SmtpConfig = { host: string; port: number; user: string; pass: string; secure: boolean };

export function smtpConfig(env: NodeJS.ProcessEnv = process.env): SmtpConfig | null {
  const host = env.SMTP_HOST?.trim();
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  const port = Number(env.SMTP_PORT) || 465;
  return { host, port, user, pass, secure: port === 465 };
}

export function resendKey(env: NodeJS.ProcessEnv = process.env) {
  return env.RESEND_API_KEY?.trim() || null;
}

/** Cloudflare Email Sending binding, present only on the Worker. */
export function cloudflareEmail(): NonNullable<CloudflareEnv["EMAIL"]> | null {
  if (!onWorkers()) return null;
  try {
    return getCloudflareContext().env.EMAIL ?? null;
  } catch {
    return null;
  }
}

/** Which transport a message would use — pure, so it can be tested. */
export function pickTransport(
  purpose: MailPurpose,
  has: { cloudflare?: boolean; resend: boolean; smtp: boolean; workers: boolean },
): MailResult["transport"] {
  if (has.cloudflare) return "cloudflare";
  const smtp = has.smtp && has.workers;
  if (purpose === "personal" && smtp) return "smtp";
  if (has.resend) return "resend";
  if (smtp) return "smtp";
  return "console";
}

export function currentMailTransport(purpose: MailPurpose = "transactional") {
  return pickTransport(purpose, { cloudflare: Boolean(cloudflareEmail()), resend: Boolean(resendKey()), smtp: Boolean(smtpConfig()), workers: Boolean(socketConnect()) });
}

export function mailStatus(env: NodeJS.ProcessEnv = process.env) {
  const smtp = smtpConfig(env);
  return {
    cloudflare: Boolean(cloudflareEmail()),
    resend: Boolean(resendKey(env)),
    smtp: smtp ? `${smtp.user} via ${smtp.host}:${smtp.port}` : null,
    from: env.MAIL_FROM || "RentLeaks <no-reply@rentleaks.com>",
    replyTo: env.MAIL_REPLY_TO || "RentLeaks <hello@rentleaks.com>",
  };
}

/** "Name <a@b.c>" → { name, email } */
export function parseAddress(value: string): { name?: string; email: string } {
  const m = /^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/.exec(value);
  if (m) return { name: m[1]?.trim() || undefined, email: m[2].trim() };
  return { email: value.trim() };
}

export async function sendMail(mail: Mail): Promise<MailResult> {
  if (process.env.NODE_ENV === "production" && containsDevelopmentUrl(`${mail.text}\n${mail.html ?? ""}`)) {
    console.error("[mail] blocked production message containing a development URL");
    return { delivered: false, transport: "blocked", error: "Production email contains a development URL" };
  }
  const purpose = mail.purpose ?? "transactional";
  const key = resendKey();
  const smtp = smtpConfig();
  const email = cloudflareEmail();
  const transport = pickTransport(purpose, {
    cloudflare: Boolean(email),
    resend: Boolean(key),
    smtp: Boolean(smtp),
    workers: Boolean(socketConnect()),
  });
  const from = mail.from || process.env.MAIL_FROM || "RentLeaks <no-reply@rentleaks.com>";
  const replyTo = mail.replyTo || process.env.MAIL_REPLY_TO || undefined;

  if (transport === "cloudflare" && email) {
    const sender =
      purpose === "personal"
        ? parseAddress(process.env.MAIL_REPLY_TO || "RentLeaks <hello@rentleaks.com>")
        : parseAddress(from);
    const reply = replyTo ? parseAddress(replyTo) : undefined;
    try {
      const receipt = await email.send({
        to: mail.to,
        from: { email: sender.email, name: sender.name },
        replyTo: reply && reply.email !== sender.email ? { email: reply.email, name: reply.name } : undefined,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        headers: mail.headers,
      });
      return { delivered: true, transport, providerId: receipt.messageId };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error("[mail] cloudflare transport failed");
      void error;
      return { delivered: false, transport, error: "Cloudflare email transport failed" };
    }
  }

  if (transport === "console") {
    if (process.env.NODE_ENV === "production") {
      console.error("[mail] no production email transport configured");
      return { delivered: false, transport: "blocked", error: "Production email transport is not configured" };
    }
    console.info(`[mail:dev] (${purpose}) to=${mail.to} subject=${mail.subject}\n${mail.text}`);
    return { delivered: false, transport };
  }

  if (transport === "resend" && key) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(mail.idempotencyKey ? { "Idempotency-Key": mail.idempotencyKey } : {}) },
        signal: AbortSignal.timeout(30_000),
        body: JSON.stringify({
          from,
          to: [mail.to],
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
          reply_to: replyTo,
          headers: mail.headers,
        }),
      });
      if (!res.ok) {
        console.error("[mail] resend failed", res.status);
        return { delivered: false, transport, error: `Resend transport failed (${res.status})` };
      }
      const receipt = await res.json() as { id?: string };
      return { delivered: true, transport, providerId: typeof receipt.id === "string" ? receipt.id : undefined };
    } catch (err) {
      void err;
      return { delivered: false, transport, error: "Resend transport unavailable" };
    }
  }

  /* SMTP. The mailbox is the sender: most providers, Namecheap included,
     refuse a From that is not the authenticated account. */
  try {
    const cfg = smtp!;
    const display = process.env.MAIL_SENDER_NAME || parseAddress(from).name || "RentLeaks";
    await smtpSend(
      { ...cfg, clientName: cfg.user.split("@")[1] },
      {
        from: { name: display, email: cfg.user },
        to: mail.to,
        replyTo,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        headers: mail.headers,
      },
      socketConnect()!,
    );
    return { delivered: true, transport };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[mail] smtp transport failed");
    void error;
    return { delivered: false, transport, error: "SMTP transport failed" };
  }
}
