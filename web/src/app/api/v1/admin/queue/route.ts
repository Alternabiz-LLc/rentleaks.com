import { prisma } from "@/lib/prisma";
import { blockersFor } from "@/lib/listing-rules";
import { parseFees } from "@/lib/listing-evidence";
import { mediaFromDetail } from "@/lib/media";
import { canAccess } from "@/lib/access";
import { handle, ok } from "@/lib/v1/http";
import { toCard } from "@/lib/v1/listing-view";
import { requireStaff } from "@/lib/v1/session";

export const dynamic = "force-dynamic";

/**
 * The founder queue on a phone: listings waiting for review, each with the
 * publication gate re-run over the stored row (a rule may have changed since
 * it was submitted), plus open reports. Status only — never documents.
 */
export const GET = handle(async (req: Request) => {
  const user = await requireStaff(req, "listings");
  const seesReports = canAccess(user, "reports");
  const url = new URL(req.url);

  const [pending, reports] = await Promise.all([
    prisma.listing.findMany({
      where: { moderation: "pending" },
      orderBy: { createdAt: "asc" },
      take: 100,
      include: {
        city: true,
        operator: true,
        host: { select: { id: true, name: true, email: true, createdAt: true, identity: { select: { status: true } } } },
      },
    }),
    prisma.report.findMany({
      where: seesReports ? { status: "open" } : { id: "__none__" },
      orderBy: { createdAt: "asc" },
      take: 100,
      include: {
        reporter: { select: { name: true } },
        listing: { select: { id: true, title: true } },
      },
    }),
  ]);

  return ok({
    listings: pending.map((r) => {
      const blockers = blockersFor({
        role: r.listedBy,
        housingType: r.housingType,
        cityId: r.cityId,
        citySlug: r.city.slug,
        cityName: r.city.name,
        state: r.city.state,
        country: r.city.country,
        title: r.title,
        neighborhood: r.neighborhood,
        address: r.address,
        description: r.description,
        price: r.price,
        deposit: r.deposit,
        fees: parseFees(r.feesJson),
        availableFrom: r.availableFrom,
        availableUntil: r.availableUntil || "",
        minStayMonths: r.minStayMonths,
        maxStayMonths: r.maxStayMonths,
        leaseEnd: r.leaseEnd || undefined,
        consentStatus: r.consentStatus || undefined,
        registrationNumber: r.registrationNumber || "",
        photoCount: mediaFromDetail(r.detail).photos.length,
      });
      return {
        ...toCard(r, url.origin),
        address: r.address,
        description: r.description,
        submittedAt: r.createdAt.toISOString(),
        host: {
          id: r.host.id,
          name: r.host.name,
          email: r.host.email,
          memberSince: r.host.createdAt.toISOString().slice(0, 10),
          identity: r.host.identity?.status ?? "unverified",
        },
        gate: blockers.map(({ id, title, why }) => ({ id, title, why })),
      };
    }),
    reports: reports.map((r) => ({
      id: r.id,
      reason: r.reason,
      note: r.note,
      reporter: r.reporter.name.split(/\s+/)[0],
      listing: r.listing,
      subjectUserId: r.subjectUserId,
      messageId: r.messageId,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});
