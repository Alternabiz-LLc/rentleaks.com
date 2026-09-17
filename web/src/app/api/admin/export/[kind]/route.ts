import type { Prisma } from "@prisma/client";
import { toCsv } from "@/lib/csv";
import { parseTags } from "@/lib/marketing";
import { prisma } from "@/lib/prisma";
import { EXPORT_ACCESS } from "@/lib/access";
import { audit, staffForRoute } from "@/lib/admin/guard";

export const dynamic = "force-dynamic";

const MAX = 50_000;

async function build(kind: string, url: URL): Promise<{ headers: string[]; rows: unknown[][] } | null> {
  const p = url.searchParams;
  switch (kind) {
    case "leads": {
      const rows = await prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: MAX, include: { listing: { select: { title: true } } } });
      return {
        headers: ["created", "status", "kind", "name", "email", "phone", "city", "type", "budget", "currency", "move_in", "move_out", "months", "listing", "source", "campaign", "note"],
        rows: rows.map((l) => [l.createdAt, l.status, l.kind, l.name, l.email, l.phone, l.cityId, l.housingType, l.budgetMax, l.currency, l.moveIn, l.moveOut, l.stayMonths, l.listing?.title, l.source, l.campaign, l.note]),
      };
    }
    case "contacts": {
      const rows = await prisma.contact.findMany({ orderBy: { createdAt: "desc" }, take: MAX });
      return {
        headers: ["email", "name", "phone", "company", "kind", "stage", "tags", "source", "city", "marketing_consent", "unsubscribed", "last_contacted", "next_follow_up", "created"],
        rows: rows.map((c) => [c.email, c.name, c.phone, c.company, c.kind, c.stage, parseTags(c.tags).join(";"), c.source, c.cityId, c.marketingConsent && !c.confirmToken, c.unsubscribedAt, c.lastContactedAt, c.nextFollowUpAt, c.createdAt]),
      };
    }
    case "listings": {
      const and: Prisma.ListingWhereInput[] = [];
      if (p.get("city")) and.push({ cityId: p.get("city")! });
      if (p.get("type")) and.push({ housingType: p.get("type")! });
      if (p.get("moderation")) and.push({ moderation: p.get("moderation")! });
      if (p.get("status")) and.push({ status: p.get("status")! });
      const rows = await prisma.listing.findMany({
        where: and.length ? { AND: and } : {},
        orderBy: { createdAt: "desc" },
        take: MAX,
        include: { host: { select: { email: true } } },
      });
      return {
        headers: ["id", "title", "city", "type", "price", "all_in", "currency", "status", "moderation", "sponsored", "featured", "verified", "plan", "available_from", "available_until", "host_email", "created"],
        rows: rows.map((l) => [l.id, l.title, l.cityId, l.housingType, l.price, l.allIn, l.currency, l.status, l.moderation, l.sponsored, l.featured, l.verified, l.plan, l.availableFrom, l.availableUntil, l.host.email, l.createdAt]),
      };
    }
    case "accounts": {
      const rows = await prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: MAX,
        include: { identity: { select: { status: true } }, _count: { select: { listings: true } } },
      });
      return {
        headers: ["email", "name", "role", "verification", "listings", "trial_ends", "suspended", "created"],
        rows: rows.map((u) => [u.email, u.name, u.role, u.identity?.status, u._count.listings, u.trialEndsAt, u.suspendedAt, u.createdAt]),
      };
    }
    case "payments": {
      const rows = await prisma.payment.findMany({ orderBy: { createdAt: "desc" }, take: MAX, include: { user: { select: { email: true } } } });
      return {
        headers: ["created", "email", "kind", "plan", "listing", "amount_cents", "currency", "status", "stripe_session"],
        rows: rows.map((x) => [x.createdAt, x.user.email, x.kind, x.planId, x.listingId, x.amount, x.currency, x.status, x.stripeSessionId]),
      };
    }
    case "campaign": {
      const id = p.get("id") || "";
      const rows = await prisma.campaignSend.findMany({ where: { campaignId: id }, orderBy: { createdAt: "asc" }, take: MAX });
      return {
        headers: ["email", "name", "status", "sent_at", "error"],
        rows: rows.map((r) => [r.email, r.name, r.status, r.sentAt, r.error]),
      };
    }
    case "invites": {
      const rows = await prisma.trialInvite.findMany({ orderBy: { createdAt: "desc" }, take: MAX });
      return {
        headers: ["email", "name", "code", "days", "status", "sent", "redeemed", "expires", "created"],
        rows: rows.map((i) => [i.email, i.name, i.code, i.days, i.status, i.sentAt, i.redeemedAt, i.expiresAt, i.createdAt]),
      };
    }
    default:
      return null;
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  const key = EXPORT_ACCESS[kind];
  const user = key ? await staffForRoute(key) : null;
  if (!user) return new Response("Not found", { status: 404 });
  const url = new URL(req.url);
  const table = await build(kind, url);
  if (!table) return new Response("Unknown export", { status: 404 });
  await audit(user.id, "export", kind, url.searchParams.get("id") || "", { rows: table.rows.length });
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(toCsv(table.headers, table.rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rentleaks-${kind}-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
