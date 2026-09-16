/**
 * Email.
 *
 * Two transports, chosen per message:
 *
 * - Resend (RESEND_API_KEY) — an HTTP API; the default for everything the app
 *   sends on its own (password resets, lead alerts, newsletters, campaigns).
 * - SMTP (SMTP_HOST, SMTP_USER, SMTP_PASS) — a real mailbox such as Namecheap
 *   Private Email (mail.privateemail.com). Preferred for `personal` mail: a
 *   one-to-one outreach email sent from the CRM should come from, and be
 *   answerable at, the founder's own mailbox. Used for everything when Resend
 *   is not configured.
 *
 * With neither, the message is logged to the console, which is what you want
 * in development (the reset link appears in the terminal running `npm run dev`).
 *
 * SMTP needs TCP sockets, which only the Cloudflare Worker provides here
 * (worker.ts hands `connect` over), so in local dev SMTP falls back to Resend
 * or the console.
 */
import { smtpSend, socketConnect } from "./smtp";

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
};

export type MailResult = { delivered: boolean; transport: "resend" | "smtp" | "console"; error?: string };

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

/** Which transport a message would use — pure, so it can be tested. */
export function pickTransport(
  purpose: MailPurpose,
  has: { resend: boolean; smtp: boolean; workers: boolean },
): MailResult["transport"] {
  const smtp = has.smtp && has.workers;
  if (purpose === "personal" && smtp) return "smtp";
  if (has.resend) return "resend";
  if (smtp) return "smtp";
  return "console";
}

export function mailStatus(env: NodeJS.ProcessEnv = process.env) {
  const smtp = smtpConfig(env);
  return {
    resend: Boolean(resendKey(env)),
    smtp: smtp ? `${smtp.user} via ${smtp.host}:${smtp.port}` : null,
    from: env.MAIL_FROM || "RentLeaks <no-reply@rentleaks.com>",
    replyTo: env.MAIL_REPLY_TO || null,
  };
}

/** "Name <a@b.c>" → { name, email } */
export function parseAddress(value: string): { name?: string; email: string } {
  const m = /^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/.exec(value);
  if (m) return { name: m[1]?.trim() || undefined, email: m[2].trim() };
  return { email: value.trim() };
}

export async function sendMail(mail: Mail): Promise<MailResult> {
  const purpose = mail.purpose ?? "transactional";
  const key = resendKey();
  const smtp = smtpConfig();
  const transport = pickTransport(purpose, { resend: Boolean(key), smtp: Boolean(smtp), workers: Boolean(socketConnect()) });
  const from = mail.from || process.env.MAIL_FROM || "RentLeaks <no-reply@rentleaks.com>";
  const replyTo = mail.replyTo || process.env.MAIL_REPLY_TO || undefined;

  if (transport === "console") {
    console.info(`[mail:dev] (${purpose}) to=${mail.to} subject=${mail.subject}\n${mail.text}`);
    return { delivered: false, transport };
  }

  if (transport === "resend" && key) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
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
        const detail = (await res.text().catch(() => "")).slice(0, 300);
        console.error("[mail] resend failed", res.status, detail);
        return { delivered: false, transport, error: `Resend ${res.status}: ${detail}` };
      }
      return { delivered: true, transport };
    } catch (err) {
      return { delivered: false, transport, error: err instanceof Error ? err.message : String(err) };
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
    console.error("[mail] smtp failed", error);
    return { delivered: false, transport, error: `SMTP: ${error}` };
  }
}
