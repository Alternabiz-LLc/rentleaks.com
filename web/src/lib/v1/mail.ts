/**
 * Transactional email. Uses Resend's HTTP API when RESEND_API_KEY is set;
 * otherwise logs the message to the server console, which is what you want in
 * development (the reset link appears in the terminal running `npm run dev`).
 */
export type Mail = { to: string; subject: string; text: string; html?: string };

export async function sendMail(mail: Mail) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || "RentLeaks <no-reply@rentleaks.com>";
  if (!key) {
    console.info(`[mail:dev] to=${mail.to} subject=${mail.subject}\n${mail.text}`);
    return { delivered: false };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
  });
  if (!res.ok) {
    console.error("[mail] send failed", res.status, await res.text().catch(() => ""));
    return { delivered: false };
  }
  return { delivered: true };
}
