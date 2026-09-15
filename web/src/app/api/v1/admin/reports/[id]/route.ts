import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/roles";
import { fail, handle, ok, readJson } from "@/lib/v1/http";
import { requireUser } from "@/lib/v1/session";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  if (!isAdmin(user)) return fail(403, "forbidden", "Founder account only.");
  const { id } = await ctx.params;
  const body = await readJson(req);
  const status = body.status === "actioned" ? "actioned" : body.status === "dismissed" ? "dismissed" : null;
  if (!status) return fail(400, "status", "Choose actioned or dismissed.");

  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return fail(404, "not_found", "That report no longer exists.");

  await prisma.$transaction([
    prisma.report.update({ where: { id }, data: { status, resolvedAt: new Date() } }),
    /* Actioning a listing report takes the listing out of the catalogue and
       back into review; it is not deleted, so the decision can be revisited. */
    ...(status === "actioned" && report.listingId && body.unpublish === true
      ? [
          prisma.listing.update({
            where: { id: report.listingId },
            data: {
              moderation: "declined",
              moderationNote: `Removed after a member report (${report.reason}).`,
              moderatedAt: new Date(),
              moderatedById: user.id,
            },
          }),
        ]
      : []),
  ]);
  return ok({ ok: true });
});
