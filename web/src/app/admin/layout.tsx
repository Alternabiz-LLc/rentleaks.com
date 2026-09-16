import { Fraunces } from "next/font/google";
import { CommandPalette } from "@/components/admin/desk/CommandPalette";
import { DeskSidebar } from "@/components/admin/desk/DeskSidebar";
import { requireAdminPage } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import "./desk.css";

export const dynamic = "force-dynamic";

const display = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });

/**
 * The founder desk frame: its own full-height layout (no public header or
 * footer), the grouped rail with live counts, and ⌘K everywhere.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAdminPage();
  const now = new Date();
  const safe = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback);
  const [leads, review, reports, followups, waiting] = await Promise.all([
    safe(prisma.lead.count({ where: { status: "new" } }), 0),
    safe(prisma.listing.count({ where: { moderation: "pending" } }), 0),
    safe(prisma.report.count({ where: { status: "open" } }), 0),
    safe(prisma.contact.count({ where: { nextFollowUpAt: { lte: now } } }), 0),
    safe(prisma.lead.count({ where: { status: "new", createdAt: { lt: new Date(now.getTime() - 86_400_000) } } }), 0),
  ]);
  return (
    <div className={`dk ${display.variable}`}>
      <DeskSidebar
        counts={{ leads, review, reports, followups, copilot: waiting + reports + followups }}
        user={{ name: me.name, email: me.email }}
      />
      <main className="dk-main" id="desk">
        {children}
      </main>
      <CommandPalette />
    </div>
  );
}
