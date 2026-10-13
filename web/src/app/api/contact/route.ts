import type { NextRequest } from "next/server";
import { preflight, corsHeaders } from "@/lib/api";
import { enqueueMail } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { clientKey, HttpError, rateLimit, readJson, str } from "@/lib/v1/http";

export const dynamic = "force-dynamic";
const METHODS = "POST,OPTIONS";
const TOPICS = ["Renter help", "Host / operator", "Report a listing", "Partner application", "Press", "Other"];

export function OPTIONS(req: NextRequest) { return preflight(req, METHODS); }

export async function POST(req: NextRequest) {
  const reply = (status: number, body: unknown) => Response.json(body, { status, headers: { ...corsHeaders(req, METHODS), "Cache-Control": "no-store" } });
  try {
    await rateLimit(`contact:${clientKey(req)}`, 5, 10 * 60_000);
    const body = await readJson(req);
    if (str(body.website)) return reply(201, { ok: true });
    const name = str(body.name, 120), email = str(body.email, 200).toLowerCase(), topic = str(body.topic, 50), message = str(body.message, 10_001);
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !TOPICS.includes(topic) || message.length < 10 || message.length > 10_000) return reply(400, { error: { message: "Add your name, a valid email, a topic and a message of 10–10,000 characters." } });
    await rateLimit(`contact-email:${email}`, 3, 60 * 60_000);
    await rateLimit("contact-global", 300, 60 * 60_000);
    const recipients = await prisma.user.findMany({ where: { role: "admin", suspendedAt: null, NOT: { passwordHash: "" } }, select: { email: true } });
    if (!recipients.length) return reply(503, { error: { message: "The contact form is temporarily unavailable. Email hello@rentleaks.com instead." } });
    const window = Math.floor(Date.now() / (10 * 60_000));
    await prisma.$transaction(async (tx) => {
      for (const recipient of recipients) await enqueueMail({ to: recipient.email, subject: `RentLeaks contact: ${topic}`, replyTo: email, text: `From: ${name}\nReply email: ${email}\nTopic: ${topic}\n\n${message}` }, { key: `contact:${window}:${email}:${topic}:${message}:${recipient.email}`, audience: "owner_admin", targetType: "contact" }, tx);
    });
    return reply(201, { ok: true });
  } catch (error) {
    if (error instanceof HttpError) return reply(error.status, { error: { message: error.message } });
    console.error("[contact] persistence unavailable");
    return reply(503, { error: { message: "Your message could not be saved. Please retry or email hello@rentleaks.com." } });
  }
}
