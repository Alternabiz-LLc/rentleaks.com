import { prisma } from "@/lib/prisma";
import { publicUser, verifyPassword } from "@/lib/auth";
import { isStaffRole } from "@/lib/access";
import { clientKey, fail, handle, ok, rateLimit, readJson, str } from "@/lib/v1/http";
import { issueToken } from "@/lib/v1/session";
import { checkSecondFactor } from "@/lib/security/two-factor";

export const dynamic = "force-dynamic";

/**
 * Sign-in for the app. Desk accounts (founder and staff) that have two-factor
 * on must also send `otp` — a 6-digit code or a recovery code. Without it the
 * answer is 401 `mfa_required`, and the app asks for the code.
 */
export const POST = handle(async (req: Request) => {
  await rateLimit(`login:${clientKey(req)}`, 10, 60_000);
  const body = await readJson(req);
  const email = str(body.email, 200).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const otp = str(body.otp, 20);

  const user = await prisma.user.findUnique({ where: { email }, include: { identity: true } });
  /* One message for both failures, so the endpoint does not confirm which
     email addresses have accounts. */
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return fail(401, "invalid_credentials", "That email and password do not match an account.");
  }
  if (user.suspendedAt) {
    return fail(403, "suspended", "This account is suspended. Contact hello@rentleaks.com if you think this is a mistake.");
  }

  let mfa = false;
  if (isStaffRole(user) && user.totpEnabledAt) {
    if (!otp) return fail(401, "mfa_required", "Enter the 6-digit code from your authenticator app.");
    await rateLimit(`login-otp:${user.id}`, 10, 5 * 60_000);
    const check = await checkSecondFactor(user, otp);
    if (!check.ok) return fail(401, "mfa_invalid", check.error);
    mfa = true;
  }
  if (isStaffRole(user)) await prisma.user.update({ where: { id: user.id }, data: { lastSignInAt: new Date() } });

  const session = await issueToken(user.id, { mfa, userAgent: req.headers.get("user-agent") });
  return ok({ ...session, user: publicUser(user) });
});
