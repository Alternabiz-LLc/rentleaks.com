import type { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { corsHeaders, preflight } from "@/lib/api";
import { logActivity, upsertContact } from "@/lib/crm";
import { EMAIL_RE, renderEmail } from "@/lib/marketing";
import { prisma } from "@/lib/prisma";
import { getSetting, SETTING_KEYS } from "@/lib/settings";
import { appUrl } from "@/lib/site";
import { sendMail } from "@/lib/v1/mail";
import { clientKey, HttpError, rateLimit, readJson } from "@/lib/v1/http";

export const dynamic = "force-dynamic";

const METHODS = "POST,OPTIONS";

export function OPTIONS(req: NextRequest) {
  return preflight(req, METHODS);
}

/**
 * Newsletter sign-up from rentleaks.com (CORS) or the app. Double opt-in: the
 * address only joins the list after the confirmation link is clicked.
 * Body: { email, name?, city?, website? (honeypot), source? }
 */
export async function POST(req: NextRequest) {
  const headers = { ...corsHeaders(req, METHODS), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
  try {
    await rateLimit(`newsletter:${clientKey(req)}`, 5, 10 * 60_000);
    const body = await readJson(req);
    if (typeof body.website === "string" && body.website.trim()) return reply(201, { ok: true });
    const email = String(body.email || "").trim().toLowerCase().slice(0, 160);
    if (!EMAIL_RE.test(email)) return reply(400, { error: { code: "email", message: "Add a valid email address." } });
    const name = String(body.name || "").replace(/\s+/g, " ").trim().slice(0, 80);
    if (/https?:|www\.|[<>@]/i.test(name)) return reply(400, { error: { code: "name", message: "Add just your name." } });
    const city = /^[a-z0-9-]{1,60}$/.test(String(body.city || "")) ? String(body.city) : null;
    const source = String(body.source || "web").replace(/[^a-z0-9_-]/gi, "").slice(0, 30) || "web";

    const contact = await upsertContact({ email, name, cityId: city, source: "newsletter", tags: ["newsletter", source] });
    if (contact.marketingConsent && !contact.confirmToken) return reply(200, { ok: true, status: "already_subscribed" });

    const token = randomBytes(24).toString("hex");
    await prisma.contact.update({ where: { id: contact.id }, data: { confirmToken: token, consentSource: `newsletter:${source}` } });

    const link = `${appUrl()}/newsletter/confirm/${token}`;
    const address = await getSetting(SETTING_KEYS.mailingAddress, "RentLeaks");
    const { text, html } = renderEmail(
      `Hi ${name || "there"},\n\nPlease confirm you'd like RentLeaks updates — new homes, city guides and renting tips, about twice a month.\n\n[Confirm my subscription](${link})\n\nIf you didn't ask for this, ignore this email and nothing will happen.`,
      { address, reason: "You're receiving this because this address was entered on rentleaks.com." },
    );
    await sendMail({ to: email, subject: "Confirm your RentLeaks subscription", text, html, purpose: "transactional" });
    await logActivity(contact.id, "note", "Newsletter sign-up (awaiting confirmation)", `source: ${source}`);
    return reply(201, { ok: true, status: "confirm_sent" });
  } catch (err) {
    if (err instanceof HttpError) return reply(err.status, { error: { code: err.code, message: err.message } });
    console.error("[api/newsletter]", err);
    return reply(500, { error: { code: "server_error", message: "Something went wrong. Try again later." } });
  }
}
