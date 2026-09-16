import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { corsHeaders, preflight } from "@/lib/api";
import { liveListingWhere } from "@/lib/billing";
import { KIND_LABEL, leadSummary, messengerLink, parseLead } from "@/lib/leads";
import { prisma } from "@/lib/prisma";
import { contactFromLead } from "@/lib/crm";
import { sampleCatalogIds } from "@/lib/sample-catalog";
import { appUrl } from "@/lib/site";
import { sendMail } from "@/lib/v1/mail";
import { clientKey, HttpError, rateLimit, readJson } from "@/lib/v1/http";

export const dynamic = "force-dynamic";

const METHODS = "POST,OPTIONS";

export function OPTIONS(req: NextRequest) {
  return preflight(req, METHODS);
}

/**
 * A lead from the Facebook landing page (rentleaks.com/facebook.html) or any
 * other public form. Public and CORS-open to the site's own origins.
 *
 * Viewing and booking requests are only taken for live listings that are not
 * part of the sample catalogue: asking to see a home that does not exist would
 * waste the renter's time and ours.
 *
 * The founder is emailed every lead; the host is emailed requests for their
 * own listing; the renter gets a copy of what they sent. Nothing is charged.
 */
export async function POST(req: NextRequest) {
  const headers = {
    ...corsHeaders(req, METHODS),
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
  const refuse = (status: number, code: string, message: string) => reply(status, { error: { code, message } });

  try {
    /* Generous enough for a shared mobile-carrier IP, tight enough for a script. */
    await rateLimit(`lead:${clientKey(req)}`, 10, 10 * 60_000);
    const body = await readJson(req);
    const parsed = parseLead(body, new Date().toISOString().slice(0, 10));
    if (!parsed.ok) return refuse(400, parsed.field, parsed.message);
    const { lead, spam } = parsed;
    if (spam) return reply(201, { ok: true, id: "received", messenger: messengerLink(leadSummary(lead)) });

    let listing: { id: string; title: string; cityId: string; housingType: string; currency: string; host: { email: string; name: string; role: string } } | null = null;
    if (lead.listingId) {
      listing = await prisma.listing.findFirst({
        where: { AND: [{ id: lead.listingId }, await liveListingWhere()] },
        select: {
          id: true,
          title: true,
          cityId: true,
          housingType: true,
          currency: true,
          host: { select: { email: true, name: true, role: true } },
        },
      });
      if (!listing) {
        return refuse(404, "listingId", "That home is no longer available. Tell us what you need and we'll match you.");
      }
      const samples = await sampleCatalogIds().catch(() => null);
      if (!samples || samples.has(listing.id)) {
        return refuse(
          409,
          "listingId",
          "That home is an example listing, so it can't be viewed or booked. Tell us what you need and we'll match you with a real one.",
        );
      }
    }

    const created = await prisma.lead.create({
      data: {
        ...lead,
        listingId: listing?.id ?? null,
        cityId: lead.cityId ?? listing?.cityId ?? null,
        housingType: lead.housingType ?? listing?.housingType ?? null,
        currency: listing?.currency ?? lead.currency,
        viewingSlots: JSON.stringify(lead.viewingSlots),
      },
      select: { id: true },
    });

    const listingUrl = listing ? `${appUrl()}/listings/${listing.id}` : undefined;
    const summary = leadSummary(lead, listing ? { title: listing.title, url: listingUrl } : null);
    /* The renter's copy leaves out the free-text note: the address is not
       verified, and this must not work as a way to mail arbitrary text. */
    const renterCopy = leadSummary({ ...lead, message: "" }, listing ? { title: listing.title, url: listingUrl } : null);
    const contact =
      `\n\nContact: ${lead.email}${lead.phone ? ` · ${lead.phone}` : ""}` +
      `\nSource: ${lead.source}${lead.campaign ? ` (${lead.campaign})` : ""}`;
    const subject = `${KIND_LABEL[lead.kind]}${listing ? ` — ${listing.title}` : ""}`;
    await contactFromLead({
      id: created.id,
      kind: lead.kind,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      cityId: lead.cityId ?? listing?.cityId ?? null,
      source: lead.source,
      campaign: lead.campaign,
      summary,
    });

    const admins = await prisma.user.findMany({ where: { role: "admin" }, select: { email: true } });
    const founders = new Set(admins.map((a) => a.email));
    const mails = [...founders].map((to) =>
      sendMail({ to, subject: `New lead: ${subject}`, text: `${summary}${contact}\n\nManage it: ${appUrl()}/admin#leads` }),
    );
    if (listing && !founders.has(listing.host.email)) {
      mails.push(
        sendMail({
          to: listing.host.email,
          subject: `A renter asked about your home: ${subject}`,
          text:
            `Hi ${listing.host.name},\n\n${summary}${contact}\n\n` +
            "Reply to them directly to confirm or decline. Please answer within one business day — " +
            "renters who wait book elsewhere.\n\nRentLeaks",
        }),
      );
    }
    mails.push(
      sendMail({
        to: lead.email,
        subject: `We got your request — ${subject}`,
        text:
          `Hi ${lead.name},\n\nThanks for reaching out. Here is what you sent:\n\n${renterCopy}\n\n` +
          "We reply within one business day, by email" +
          (lead.phone ? " or phone" : "") +
          ".\n\nA safety note: never pay rent or a deposit before you have seen the home (in person or on a live video call) " +
          "and signed a lease. RentLeaks never takes payment and never asks for wire transfers, gift cards or crypto.\n\nRentLeaks",
      }),
    );
    await Promise.allSettled(mails);

    return reply(201, { ok: true, id: created.id, messenger: messengerLink(summary, `lead_${created.id}`) });
  } catch (err) {
    if (err instanceof HttpError) return refuse(err.status, err.code, err.message);
    if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2021" || err.code === "P2022")) {
      console.error("[api/leads] schema behind code:", err.message);
      return refuse(503, "migration_pending", "We can't take requests online right now. Message us on Messenger instead.");
    }
    console.error("[api/leads]", err);
    return refuse(500, "server_error", "Something went wrong on our side. Message us on Messenger instead.");
  }
}
