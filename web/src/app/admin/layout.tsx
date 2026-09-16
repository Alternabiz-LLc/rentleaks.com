import { AdminNav } from "@/components/admin/AdminNav";
import { Shell } from "@/components/Shell";
import { requireAdminPage } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Founder view shell: section navigation with live counts. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  const now = new Date();
  const safe = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback);
  const [leads, review, reports, followups] = await Promise.all([
    safe(prisma.lead.count({ where: { status: "new" } }), 0),
    safe(prisma.listing.count({ where: { moderation: "pending" } }), 0),
    safe(prisma.report.count({ where: { status: "open" } }), 0),
    safe(prisma.contact.count({ where: { nextFollowUpAt: { lte: now } } }), 0),
  ]);
  return (
    <Shell>
      <div className="adm">
        <AdminNav counts={{ leads, review, reports, followups }} />
        <div className="adm__main">{children}</div>
      </div>
    </Shell>
  );
}
