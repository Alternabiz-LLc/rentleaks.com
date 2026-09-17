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
import { engagementValue, occupancy } from "@/lib/enterprise/catalog";

export const dynamic = "force-dynamic";

const MAX = 50_000;

function jsonList(j: string) {
  try {
    const v = JSON.parse(j) as unknown;
    return Array.isArray(v) ? v.map(String).join("; ") : "";
  } catch {
    return "";
  }
}

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
    case "requests": {
      const rows = await prisma.serviceRequest.findMany({ orderBy: { createdAt: "desc" }, take: MAX });
      const list = (j: string) => {
        try {
          return (JSON.parse(j) as string[]).join(";");
        } catch {
          return "";
        }
      };
      return {
        headers: ["created", "status", "score", "name", "email", "phone", "company", "role", "property", "units", "buildings", "market", "address", "owner_based_in", "out_of_state", "services", "add_ons", "package", "timeline", "source", "campaign", "contacted", "lost_reason", "note", "message"],
        rows: rows.map((r) => [r.createdAt, r.status, r.score, r.name, r.email, r.phone, r.company, r.role, r.propertyKind, r.units, r.buildings, r.market, r.address, r.ownerLocation, r.outOfState, list(r.services), list(r.addOns), r.packageId, r.timeline, r.source, r.campaign, r.contactedAt, r.lostReason, r.note, r.message]),
      };
    }
    case "engagements": {
      const rows = await prisma.engagement.findMany({ orderBy: { createdAt: "desc" }, take: MAX, include: { tasks: { select: { doneAt: true } } } });
      return {
        headers: ["created", "status", "title", "client", "email", "company", "track", "package", "fee_model", "amount", "percent", "units", "rent_roll", "monthly_value", "one_time_value", "currency", "signed_on", "agreement", "start", "end", "steps_done", "steps"],
        rows: rows.map((e) => {
          const v = engagementValue(e);
          return [e.createdAt, e.status, e.title, e.clientName, e.clientEmail, e.clientCompany, e.track, e.packageId, e.feeModel, e.amountCents / 100, e.pctBp / 100, e.units, e.rentRollCents / 100, v.monthly / 100, v.once / 100, e.currency, e.agreementSignedOn, e.agreementRef, e.startDate, e.endDate, e.tasks.filter((x) => x.doneAt).length, e.tasks.length];
        }),
      };
    }
    case "network-searches": {
      const rows = await prisma.networkSearch.findMany({ orderBy: { createdAt: "desc" }, take: MAX, include: { offers: { select: { status: true } } } });
      return {
        headers: ["created", "status", "score", "name", "email", "phone", "city", "state", "neighborhoods", "home", "building", "bedrooms", "budget_min", "budget_max", "move_in", "term", "term_months", "must_haves", "language", "fee_cap_type", "fee_cap_value", "offers", "proposals", "chosen_partner", "agreement", "leased_at", "lost_reason", "rating", "source", "campaign"],
        rows: rows.map((s) => [s.createdAt, s.status, s.score, s.name, s.email, s.phone, s.city, s.state, jsonList(s.neighborhoods), s.homeType, s.buildingAge, s.bedrooms, s.budgetMin, s.budgetMax, s.moveIn, s.term, s.termMonths, jsonList(s.mustHaves), s.language, s.feeCapType, s.feeCapValue, s.offers.length, s.offers.filter((o) => ["proposed", "chosen", "not_chosen"].includes(o.status)).length, s.chosenPartnerId, s.agreementId, s.leasedAt, s.lostReason, s.rating, s.source, s.campaign]),
      };
    }
    case "network-partners": {
      const rows = await prisma.networkPartner.findMany({ orderBy: { createdAt: "desc" }, take: MAX, include: { offers: { select: { status: true } } } });
      return {
        headers: ["created", "status", "name", "email", "phone", "brokerage", "licence_type", "licence_number", "licence_state", "licence_expires", "supervising_broker", "supervisor_email", "markets", "specialties", "languages", "capacity", "referral_pct", "leads", "accepted", "rating", "rating_count", "verified_at", "verify_note", "source"],
        rows: rows.map((x) => [x.createdAt, x.status, x.name, x.email, x.phone, x.brokerage, x.licenseType, x.licenseNumber, x.licenseState, x.licenseExpires, x.supervisorName, x.supervisorEmail, jsonList(x.markets), jsonList(x.specialties), jsonList(x.languages), x.capacity, x.referralPctBp / 100, x.offers.length, x.offers.filter((o) => ["proposed", "chosen", "not_chosen"].includes(o.status)).length, x.ratingCount ? (x.ratingSum / x.ratingCount).toFixed(1) : "", x.ratingCount, x.verifiedAt, x.verifyNote, x.source]),
      };
    }
    case "network-agreements": {
      const rows = await prisma.agreement.findMany({ orderBy: { createdAt: "desc" }, take: MAX, include: { signers: { orderBy: { order: "asc" } } } });
      return {
        headers: ["created", "kind", "version", "title", "status", "sha256", "signers", "signed", "expires", "completed", "voided", "void_reason", "search_id", "partner_id"],
        rows: rows.map((e) => [e.createdAt, e.kind, e.version, e.title, e.status, e.docHash, e.signers.map((s) => `${s.role}:${s.name} <${s.email}> ${s.status}${s.signedAt ? ` ${s.signedAt.toISOString()}` : ""}`).join("; "), e.signers.filter((s) => s.status === "signed").length, e.expiresAt, e.completedAt, e.voidedAt, e.voidReason, e.searchId, e.partnerId]),
      };
    }
    case "network-deals": {
      const rows = await prisma.networkDeal.findMany({ orderBy: { createdAt: "desc" }, take: MAX });
      const partners = new Map((await prisma.networkPartner.findMany({ where: { id: { in: [...new Set(rows.map((d) => d.partnerId))] } }, select: { id: true, name: true, brokerage: true } })).map((x) => [x.id, x]));
      return {
        headers: ["reported", "status", "lease_signed", "partner", "brokerage", "address", "monthly_rent", "fee_collected", "referral_pct", "referral_due", "invoice_id", "paid_at", "search_id", "note"],
        rows: rows.map((d) => [d.createdAt, d.status, d.leaseSignedOn, partners.get(d.partnerId)?.name, partners.get(d.partnerId)?.brokerage, d.address, d.monthlyRentCents / 100, d.grossFeeCents / 100, d.referralPctBp / 100, d.referralDueCents / 100, d.invoiceId, d.paidAt, d.searchId, d.note]),
      };
    }
    case "network-guides": {
      const rows = await prisma.guideLead.findMany({ orderBy: { createdAt: "desc" }, take: MAX });
      return {
        headers: ["asked", "audience", "guide", "status", "name", "email", "phone", "city", "brokerage", "licence_state", "consented_to", "emailed", "downloads", "last_download", "contacted", "source", "campaign", "ip", "note"],
        rows: rows.map((l) => [l.createdAt, l.audience, l.guideId, l.status, l.name, l.email, l.phone, l.city, l.brokerage, l.licenseState, l.consentText, l.sentAt, l.downloads, l.downloadedAt, l.contactedAt, l.source, l.campaign, l.ip, l.note]),
      };
    }
    case "properties": {
      const rows = await prisma.managedProperty.findMany({ orderBy: { name: "asc" }, take: MAX });
      return {
        headers: ["name", "status", "kind", "address", "market", "units", "occupied", "occupancy_pct", "rent_roll", "fee_pct", "flat_fee", "currency", "owner", "owner_email", "owner_based_in"],
        rows: rows.map((x) => [x.name, x.status, x.kind, x.address, x.market, x.units, x.occupied, occupancy(x.units, x.occupied), x.rentRollCents / 100, x.pctBp / 100, x.flatFeeCents / 100, x.currency, x.ownerName, x.ownerEmail, x.ownerLocation]),
      };
    }
    case "statements": {
      const rows = await prisma.ownerStatement.findMany({ orderBy: [{ month: "desc" }], take: MAX, include: { property: { select: { name: true, ownerName: true, ownerEmail: true, currency: true } } } });
      return {
        headers: ["month", "property", "owner", "owner_email", "collected", "paid_for_owner", "fee", "net_to_owner", "occupied", "currency", "sent", "invoice_id", "note"],
        rows: rows.map((s) => [s.month, s.property.name, s.property.ownerName, s.property.ownerEmail, s.collectedCents / 100, s.expensesCents / 100, s.feeCents / 100, s.netCents / 100, s.occupied, s.property.currency, s.sentAt, s.invoiceId, s.note]),
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
