import { prisma } from "@/lib/prisma";
import { handle, ok, readJson } from "@/lib/v1/http";
import { rawBearer, revokeToken } from "@/lib/v1/session";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  const raw = rawBearer(req);
  const body = await readJson<{ pushToken?: string }>(req).catch(() => ({}) as { pushToken?: string });
  if (typeof body.pushToken === "string" && body.pushToken) {
    await prisma.pushDevice.deleteMany({ where: { token: body.pushToken } });
  }
  if (raw) await revokeToken(raw);
  return ok({ ok: true });
});
