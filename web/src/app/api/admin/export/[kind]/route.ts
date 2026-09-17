import type { Prisma } from "@prisma/client";
import { toCsv } from "@/lib/csv";
import { parseTags } from "@/lib/marketing";
import { prisma } from "@/lib/prisma";
import { EXPORT_ACCESS } from "@/lib/access";
import { audit, staffForRoute } from "@/lib/admin/guard";
import { CATEGORY, ISO, LEDGER_HEADERS, ledgerRow, parseItems, pnl, invoiceState } from "@/lib/books/core";
import { booksToday } from "@/lib/books/data";
import { loadScorecards } from "@/lib/ops/hosts";
import { loadDemand } from "@/lib/ops/demand";

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
    case "ledger": {
      const from = ISO.test(p.get("from") || "") ? p.get("from")! : "0000-01-01";
      const to = ISO.test(p.get("to") || "") ? p.get("to")! : "9999-12-31";
      const rows = await prisma.ledgerEntry.findMany({ where: { date: { gte: from, lte: to } }, orderBy: [{ date: "asc" }, { createdAt: "asc" }], take: MAX });
      const counts = new Map(
        (rows.length ? await prisma.receipt.groupBy({ by: ["entryId"], where: { entryId: { in: rows.map((l) => l.id) } }, _count: { _all: true } }) : []).map((x) => [x.entryId, x._count._all]),
      );
      return { headers: LEDGER_HEADERS, rows: rows.map((l) => ledgerRow(l, counts.get(l.id) ?? 0)) };
    }
    case "pnl": {
      const from = ISO.test(p.get("from") || "") ? p.get("from")! : `${booksToday().slice(0, 4)}-01-01`;
      const to = ISO.test(p.get("to") || "") ? p.get("to")! : booksToday();
      const lines = await prisma.ledgerEntry.findMany({ where: { date: { gte: from, lte: to }, voidedAt: null }, take: MAX });
      const r = pnl(lines, { from, to });
      return {
        headers: ["section", "category", "schedule_c_line", "amount", "share"],
        rows: [
          ...r.byCategory.map((c) => [c.kind === "income" ? "Income" : "Expenses", c.label, CATEGORY.get(c.key)?.line ?? "", c.cents / 100, `${Math.round(c.share * 100)}%`]),
          ["Total", "Income", "", r.income / 100, ""],
          ["Total", "Expenses", "", r.expenses / 100, ""],
          ["Total", `Net (${from} to ${to})`, "", r.net / 100, r.margin === null ? "" : `${Math.round(r.margin * 100)}% margin`],
        ],
      };
    }
    case "invoices": {
      const rows = await prisma.invoice.findMany({ orderBy: { createdAt: "desc" }, take: MAX });
      const today = booksToday();
      return {
        headers: ["number", "state", "bill_to", "email", "issued", "due", "items", "subtotal", "tax", "total", "currency", "sent", "reminders", "paid", "paid_method"],
        rows: rows.map((i) => [i.number, invoiceState(i, today), i.billToName, i.billToEmail, i.issueDate, i.dueDate, parseItems(i.itemsJson).map((x) => `${x.quantity}× ${x.description}`).join("; "), i.subtotalCents / 100, i.taxCents / 100, i.totalCents / 100, i.currency, i.sentAt, i.reminders, i.paidAt, i.paidMethod]),
      };
    }
    case "hosts": {
      const { cards } = await loadScorecards();
      return {
        headers: ["host", "email", "grade", "score", "live", "listings", "quality_pct", "fresh_pct", "reply_rate_pct", "median_reply_min", "leads_90d", "booked_90d", "sponsored", "fix_first"],
        rows: cards.map((c) => [c.name, c.email, c.grade, c.score, c.live, c.listings, c.quality, c.freshPct, c.replyRate, c.replyMins, c.leads, c.booked, c.sponsored, c.weakest ?? ""]),
      };
    }
    case "demand": {
      const { cells } = await loadDemand(90);
      const cities = new Map((await prisma.city.findMany({ select: { id: true, name: true } })).map((c) => [c.id, c.name]));
      return {
        headers: ["market", "type", "renters_asking", "median_budget_usd", "live_homes", "affordable_homes", "gap"],
        rows: cells.map((c) => [cities.get(c.cityId) ?? c.cityId, c.type, c.demand, c.budget, c.supply, c.affordable, c.gap]),
      };
    }
    case "playbooks": {
      const rows = await prisma.playbookRun.findMany({ orderBy: { createdAt: "desc" }, take: MAX, include: { playbook: { select: { name: true, trigger: true, action: true } } } });
      return {
        headers: ["when", "playbook", "trigger", "action", "status", "target_type", "target_id", "detail"],
        rows: rows.map((r) => [r.createdAt, r.playbook.name, r.playbook.trigger, r.playbook.action, r.status, r.targetType, r.targetId, r.detail]),
      };
    }
    case "bookings": {
      const rows = await prisma.booking.findMany({ orderBy: { createdAt: "desc" }, take: MAX });
      const titles = new Map(
        (await prisma.listing.findMany({ where: { id: { in: [...new Set(rows.map((b) => b.listingId).filter((x): x is string => !!x))] } }, select: { id: true, title: true } })).map((l) => [l.id, l.title]),
      );
      return {
        headers: ["created", "stage", "renter", "email", "phone", "listing", "viewing_at", "viewing_mode", "viewing_confirmed", "move_in", "move_out", "monthly_all_in", "currency", "lost_reason", "renewal_offered", "note"],
        rows: rows.map((b) => [b.createdAt, b.stage, b.renterName, b.renterEmail, b.renterPhone, b.listingId ? titles.get(b.listingId) ?? b.listingId : "", b.viewingAt?.toISOString().slice(0, 16).replace("T", " "), b.viewingMode, b.viewingConfirmedAt, b.moveIn, b.moveOut, b.monthlyAllIn, b.currency, b.lostReason, b.renewalRemindedAt, b.note]),
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
