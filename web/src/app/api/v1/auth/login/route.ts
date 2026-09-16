import { prisma } from "@/lib/prisma";
import { publicUser, verifyPassword } from "@/lib/auth";
import { clientKey, fail, handle, ok, rateLimit, readJson, str } from "@/lib/v1/http";
import { issueToken } from "@/lib/v1/session";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  await rateLimit(`login:${clientKey(req)}`, 10, 60_000);
  const body = await readJson(req);
  const email = str(body.email, 200).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";

  const user = await prisma.user.findUnique({ where: { email }, include: { identity: true } });
  /* One message for both failures, so the endpoint does not confirm which
     email addresses have accounts. */
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return fail(401, "invalid_credentials", "That email and password do not match an account.");
  }
  if (user.suspendedAt) {
    return fail(403, "suspended", "This account is suspended. Contact hello@rentleaks.com if you think this is a mistake.");
  }
  const session = await issueToken(user.id);
  return ok({ ...session, user: publicUser(user) });
});
