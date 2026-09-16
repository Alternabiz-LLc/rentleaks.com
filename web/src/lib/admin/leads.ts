import type { LeadRow } from "@/components/LeadsInbox";
import { KIND_LABEL, leadSummary, type LeadKind, type ViewingSlot } from "@/lib/leads";
import { prisma } from "@/lib/prisma";

/** The newest 300 leads, shaped for the inbox; null when the table is missing. */
export async function loadLeads(): Promise<LeadRow[] | null> {
  try {
    const rows = await prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
      include: { listing: { select: { id: true, title: true } } },
    });
    const now = Date.now();
    return rows.map((l) => {
      let slots: ViewingSlot[] = [];
      try {
        const parsed = JSON.parse(l.viewingSlots) as unknown;
        if (Array.isArray(parsed)) slots = parsed as ViewingSlot[];
      } catch {
        slots = [];
      }
      const kind = (l.kind in KIND_LABEL ? l.kind : "match") as LeadKind;
      return {
        id: l.id,
        kind,
        kindLabel: KIND_LABEL[kind],
        status: l.status,
        name: l.name,
        email: l.email,
        phone: l.phone,
        summary: leadSummary(
          {
            kind,
            name: l.name,
            cityId: l.cityId,
            housingType: l.housingType,
            budgetMax: l.budgetMax,
            currency: l.currency,
            moveIn: l.moveIn,
            moveOut: l.moveOut,
            stayMonths: l.stayMonths,
            viewingSlots: slots,
            viewingMode: l.viewingMode === "video" ? "video" : l.viewingMode ? "in-person" : null,
            message: l.message,
          },
          l.listing ? { title: l.listing.title } : null,
        ),
        listingTitle: l.listing?.title ?? null,
        listingHref: l.listing ? `/listings/${l.listing.id}` : null,
        source: l.source,
        campaign: l.campaign,
        note: l.note,
        createdAt: l.createdAt.toISOString().slice(0, 16).replace("T", " "),
        waitingHours: l.status === "new" ? Math.floor((now - l.createdAt.getTime()) / 3_600_000) : null,
      };
    });
  } catch (err) {
    console.error("[admin] leads unavailable:", err instanceof Error ? err.message : err);
    return null;
  }
}
