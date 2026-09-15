import { prisma } from "@/lib/prisma";
import { fail, handle, ok, readJson, str } from "@/lib/v1/http";
import { requireUser } from "@/lib/v1/session";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  const body = await readJson(req);
  const blockedId = str(body.userId, 64);
  if (!blockedId || blockedId === user.id) return fail(400, "subject", "Choose someone to block.");
  if (!(await prisma.user.count({ where: { id: blockedId } }))) return fail(404, "not_found", "That account no longer exists.");
  await prisma.userBlock.upsert({
    where: { blockerId_blockedId: { blockerId: user.id, blockedId } },
    create: { blockerId: user.id, blockedId },
    update: {},
  });
  return ok({ ok: true, blocked: true });
});

export const DELETE = handle(async (req: Request) => {
  const user = await requireUser(req);
  const body = await readJson(req);
  await prisma.userBlock.deleteMany({ where: { blockerId: user.id, blockedId: str(body.userId, 64) } });
  return ok({ ok: true, blocked: false });
});
