import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/v1/http";
import { requireUser } from "@/lib/v1/session";

export const dynamic = "force-dynamic";

export const DELETE = handle(async (req: Request, ctx: { params: Promise<{ listingId: string }> }) => {
  const user = await requireUser(req);
  const { listingId } = await ctx.params;
  await prisma.savedListing.deleteMany({ where: { userId: user.id, listingId } });
  return ok({ ok: true, saved: false });
});
