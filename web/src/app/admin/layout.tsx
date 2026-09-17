import { Fraunces } from "next/font/google";
import { CommandPalette } from "@/components/admin/desk/CommandPalette";
import { DeskSidebar } from "@/components/admin/desk/DeskSidebar";
import { accessList, isFounder, presetOf, PRESETS } from "@/lib/access";
import { requireAdminPage } from "@/lib/admin/guard";
import { groupsFor } from "@/lib/admin/nav";
import { prisma } from "@/lib/prisma";
import "./desk.css";

export const dynamic = "force-dynamic";

const display = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });

/**
 * The desk frame: its own full-height layout (no public header or footer),
 * the grouped rail with live counts, and ⌘K everywhere. Employees see only
 * the modules they were given; the counts follow the same rule.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAdminPage();
  const allowed = accessList(me);
  const can = (k: (typeof allowed)[number]) => allowed.includes(k);
  const now = new Date();
  const safe = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback);
  const zero = Promise.resolve(0);
  const [leads, review, reports, followups, waiting, trust, viewings, enterprise] = await Promise.all([
    can("leads") ? safe(prisma.lead.count({ where: { status: "new" } }), 0) : zero,
    can("listings") ? safe(prisma.listing.count({ where: { moderation: "pending" } }), 0) : zero,
    can("reports") ? safe(prisma.report.count({ where: { status: "open" } }), 0) : zero,
    can("crm") ? safe(prisma.contact.count({ where: { nextFollowUpAt: { lte: now } } }), 0) : zero,
    can("leads") ? safe(prisma.lead.count({ where: { status: "new", createdAt: { lt: new Date(now.getTime() - 86_400_000) } } }), 0) : zero,
    // Cheap proxy for the radar: scam-guard flags on messages this week.
    can("trust") ? safe(prisma.message.count({ where: { createdAt: { gte: new Date(now.getTime() - 7 * 86_400_000) }, NOT: { flags: "[]" } } }), 0) : zero,
    can("bookings") ? safe(prisma.booking.count({ where: { stage: "viewing", viewingAt: { gte: now }, viewingConfirmedAt: null } }), 0) : zero,
    can("enterprise") ? safe(prisma.serviceRequest.count({ where: { status: "new" } }), 0) : zero,
  ]);
  const founder = isFounder(me);
  const preset = presetOf(me.staffAccess);
  const title = founder ? "Founder · full access" : me.staffTitle || (preset ? PRESETS[preset].label : "Team member");
  return (
    <div className={`dk ${display.variable}`}>
      <DeskSidebar
        counts={{ leads, review, reports, followups, trust, viewings, enterprise, copilot: waiting + reports + followups }}
        user={{ name: me.name, email: me.email, title, founder }}
        groups={groupsFor(allowed)}
      />
      <main className="dk-main" id="desk">
        {children}
      </main>
      <CommandPalette allowed={allowed} />
    </div>
  );
}
