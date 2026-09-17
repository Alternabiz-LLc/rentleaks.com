import { NextResponse } from "next/server";
import { logActivity } from "@/lib/crm";
import { readLink } from "@/lib/ops/links";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Shortlist click: note the first open on the lead, then show the home. */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const url = new URL(req.url);
  const parts = readLink(token);
  if (!parts || parts[0] !== "s") return NextResponse.redirect(new URL("/stays", url.origin));
  const [, leadId, listingId] = parts;
  try {
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, email: true, shortlistOpenedAt: true } });
    if (lead && !lead.shortlistOpenedAt) {
      await prisma.lead.update({ where: { id: lead.id }, data: { shortlistOpenedAt: new Date() } });
      const contact = await prisma.contact.findUnique({ where: { email: lead.email.toLowerCase() }, select: { id: true } });
      if (contact) await logActivity(contact.id, "note", "Opened the shortlist", `Home ${listingId}`);
    }
  } catch (err) {
    console.error("[go/s]", err instanceof Error ? err.message : err);
  }
  const dest = new URL(`/listings/${encodeURIComponent(listingId)}`, url.origin);
  dest.searchParams.set("utm_source", "rentleaks");
  dest.searchParams.set("utm_medium", "email");
  dest.searchParams.set("utm_campaign", "shortlist");
  return NextResponse.redirect(dest);
}
