import { prisma } from "@/lib/prisma";
import { fail, handle, ok, readJson, str } from "@/lib/v1/http";
import { requireUser } from "@/lib/v1/session";

export const dynamic = "force-dynamic";

const EXPO_TOKEN = /^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]+\]$/;

export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  const body = await readJson(req);
  const token = str(body.token, 200);
  if (!EXPO_TOKEN.test(token)) return fail(400, "bad_token", "That is not an Expo push token.");
  const platform = ["ios", "android"].includes(String(body.platform)) ? String(body.platform) : "unknown";
  /* A token belongs to one device; if another account signed in on this
     phone, the token moves to the current account. */
  await prisma.pushDevice.upsert({
    where: { token },
    create: { token, platform, userId: user.id },
    update: { platform, userId: user.id },
  });
  return ok({ ok: true });
});

export const DELETE = handle(async (req: Request) => {
  const user = await requireUser(req);
  const body = await readJson(req);
  await prisma.pushDevice.deleteMany({ where: { token: str(body.token, 200), userId: user.id } });
  return ok({ ok: true });
});
