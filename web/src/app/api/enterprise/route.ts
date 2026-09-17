import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { corsHeaders, preflight } from "@/lib/api";
import { logActivity, upsertContact } from "@/lib/crm";
import { parseServiceRequest, requestScore, requestSummary, suggestPackage, packageTitle } from "@/lib/enterprise/catalog";
import { alertEnterpriseTeam, deskLink, enterpriseSettings, publicConfig } from "@/lib/enterprise/data";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/v1/mail";
import { clientKey, HttpError, rateLimit, readJson } from "@/lib/v1/http";

export const dynamic = "force-dynamic";

const METHODS = "GET,POST,OPTIONS";

export function OPTIONS(req: NextRequest) {
  return preflight(req, METHODS);
}

/**
 * rentleaks.com/enterprise/ talks to this route.
 *
 * GET  — the licence strip, optional "from" prices and whether the form is
 *        open. Public, cached for five minutes.
 * POST — a service request. Stored, put in the CRM, the enterprise team is
 *        alerted and the requester gets a copy. Nothing is charged, and the
 *        form asks about the property, never about people.
 */
export async function GET(req: NextRequest) {
  const headers = { ...corsHeaders(req, METHODS), "Content-Type": "application/json; charset=utf-8" };
  try {
    const body = await publicConfig();
    return new Response(JSON.stringify(body), { headers: { ...headers, "Cache-Control": "public, max-age=300, stale-while-revalidate=600" } });
  } catch (err) {
    console.error("[api/enterprise] config", err);
    return new Response(JSON.stringify({ broker: null, prices: {}, formOpen: true }), { headers: { ...headers, "Cache-Control": "no-store" } });
  }
}

export async function POST(req: NextRequest) {
  const headers = { ...corsHeaders(req, METHODS), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
  const refuse = (status: number, code: string, message: string) => reply(status, { error: { code, message } });

  try {
    await rateLimit(`enterprise:${clientKey(req)}`, 6, 10 * 60_000);
    const settings = await enterpriseSettings();
    if (!settings.formOpen) return refuse(503, "paused", "Online requests are paused for a moment. Email or message us instead.");
    const parsed = parseServiceRequest(await readJson(req));
    if (!parsed.ok) return refuse(400, parsed.field, parsed.message);
    const { request: r, spam } = parsed;
    if (spam) return reply(201, { ok: true, id: "received" });

    /* The same person sending the same thing twice within ten minutes is a double click. */
    const dupe = await prisma.serviceRequest.findFirst({
      where: { email: r.email, createdAt: { gte: new Date(Date.now() - 10 * 60_000) }, message: r.message, services: JSON.stringify(r.services) },
      select: { id: true },
    });
    if (dupe) return reply(201, { ok: true, id: dupe.id, duplicate: true });

    const score = requestScore(r).score;
    const created = await prisma.serviceRequest.create({
      data: {
        name: r.name,
        email: r.email,
        phone: r.phone,
        company: r.company,
        role: r.role,
        propertyKind: r.propertyKind,
        units: r.units,
        buildings: r.buildings,
        market: r.market,
        address: r.address,
        ownerLocation: r.ownerLocation,
        outOfState: r.outOfState,
        services: JSON.stringify(r.services),
        addOns: JSON.stringify(r.addOns),
        packageId: r.packageId,
        timeline: r.timeline,
        message: r.message,
        consent: true,
        source: r.source,
        campaign: r.campaign,
        referrer: r.referrer,
        score,
      },
      select: { id: true },
    });

    const summary = requestSummary(r);
    try {
      const contact = await upsertContact({
        email: r.email,
        name: r.name,
        phone: r.phone,
        company: r.company,
        kind: r.role === "operator" ? "operator" : "partner",
        source: "lead",
        tags: ["enterprise", r.outOfState ? "out-of-state" : "", ...r.services.map((s) => `svc:${s}`), r.campaign ? `campaign:${r.campaign}` : ""].filter(Boolean),
      });
      await logActivity(contact.id, "lead", "Enterprise request", summary);
    } catch (err) {
      console.error("[api/enterprise] crm", err instanceof Error ? err.message : err);
    }

    const suggestion = r.packageId ? "" : `\nSuggested package: ${packageTitle(suggestPackage(r))}`;
    await alertEnterpriseTeam(
      `Enterprise request: ${r.company || r.name}${r.units ? ` · ${r.units} units` : ""} (priority ${score})`,
      `${summary}${suggestion}\n\nContact: ${r.email}${r.phone ? ` · ${r.phone}` : ""}\nSource: ${r.source}${r.campaign ? ` (${r.campaign})` : ""}\n\nOpen it: ${deskLink(`/admin/enterprise?open=${created.id}`)}`,
    ).catch(() => []);

    const first = r.name.split(" ")[0];
    const copy = requestSummary(r, false);
    const mail = await sendMail({
      to: r.email,
      subject: "We got your request — RentLeaks Enterprise",
      text:
        `Hi ${first},\n\nThanks for telling us about your property. Here is what you sent:\n\n${copy}\n\n` +
        "What happens next: someone from our team replies within one business day to set up a call or a walk-through. " +
        "You'll get a written proposal with the scope, the fee and the timeline — brokerage and management start only under a signed agreement.\n\n" +
        `${settings.broker.name ? `${settings.broker.name}\n` : ""}RentLeaks Enterprise`,
    }).catch(() => null);
    if (mail && (mail.delivered || mail.transport === "console")) {
      await prisma.serviceRequest.update({ where: { id: created.id }, data: { ackSentAt: new Date() } }).catch(() => undefined);
    }

    return reply(201, { ok: true, id: created.id });
  } catch (err) {
    if (err instanceof HttpError) return refuse(err.status, err.code, err.message);
    if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2021" || err.code === "P2022")) {
      console.error("[api/enterprise] schema behind code:", err.message);
      return refuse(503, "migration_pending", "We can't take requests online right now. Email or message us instead.");
    }
    console.error("[api/enterprise]", err);
    return refuse(500, "server_error", "Something went wrong on our side. Email or message us instead.");
  }
}
