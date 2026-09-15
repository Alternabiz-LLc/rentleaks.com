import { prisma } from "@/lib/prisma";
import { handle, ok, readJson } from "@/lib/v1/http";
import { requireUser } from "@/lib/v1/session";

export const dynamic = "force-dynamic";

export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  const { id } = await ctx.params;
  const body = await readJson(req);
  await prisma.savedSearch.updateMany({
    where: { id, userId: user.id },
    data: { alerts: body.alerts === true, ...(body.alerts === true ? { lastCheckedAt: new Date() } : {}) },
  });
  return ok({ ok: true });
});

export const DELETE = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  const { id } = await ctx.params;
  await prisma.savedSearch.deleteMany({ where: { id, userId: user.id } });
  return ok({ ok: true });
});
