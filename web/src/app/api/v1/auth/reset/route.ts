import { prisma } from "@/lib/prisma";
import { hashPassword, publicUser } from "@/lib/auth";
import { clientKey, fail, handle, ok, rateLimit, readJson, str } from "@/lib/v1/http";
import { issueToken, redeemResetToken } from "@/lib/v1/session";

export const dynamic = "force-dynamic";

/**
 * Set a new password with a reset token. Every existing session — web and
 * app, on every device — is signed out, then the caller gets a fresh one.
 * The deleteMany below runs before the new session is issued, so it cannot
 * remove it.
 */
export const POST = handle(async (req: Request) => {
  await rateLimit(`reset:${clientKey(req)}`, 10, 15 * 60_000);
  const body = await readJson(req);
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 8) return fail(400, "weak_password", "Use at least 8 characters for your password.");

  const userId = await redeemResetToken(str(body.token, 128));
  if (!userId) return fail(400, "invalid_token", "This reset link has expired or was already used. Ask for a new one.");

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash: hashPassword(password) } }),
    prisma.session.deleteMany({ where: { userId } }),
  ]);

  const user = await prisma.user.findUnique({ where: { id: userId }, include: { identity: true } });
  if (!user) return fail(404, "not_found", "That account no longer exists.");
  const session = await issueToken(user.id);
  return ok({ ...session, user: publicUser(user) });
});
