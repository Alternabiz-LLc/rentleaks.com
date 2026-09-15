import { prisma } from "@/lib/prisma";
import { hashPassword, publicUser } from "@/lib/auth";
import { clientKey, fail, handle, ok, rateLimit, readJson, str } from "@/lib/v1/http";
import { issueToken } from "@/lib/v1/session";

export const dynamic = "force-dynamic";

/**
 * Sign-up. `role` is renter or host — nobody can sign themselves up as admin.
 * Landlords, owners, brokers and departing tenants are all `host` accounts;
 * which of those they are is recorded per listing (`listedBy`), because the
 * same person can be an owner on one listing and a tenant on another.
 */
export const POST = handle(async (req: Request) => {
  rateLimit(`signup:${clientKey(req)}`, 5, 60_000);
  const body = await readJson(req);
  const name = str(body.name, 80);
  const email = str(body.email, 200).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const role = body.role === "host" ? "host" : "renter";

  if (name.length < 2) return fail(400, "invalid_name", "Add your name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(400, "invalid_email", "That email address does not look right.");
  if (password.length < 8) return fail(400, "weak_password", "Use at least 8 characters for your password.");
  if (body.acceptTerms !== true) return fail(400, "terms", "Accept the terms and community guidelines to continue.");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return fail(409, "exists", "An account with that email already exists. Sign in instead.");

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: hashPassword(password),
      role,
      identity: { create: { status: "unverified", provider: "demo" } },
    },
    include: { identity: true },
  });
  const session = await issueToken(user.id);
  return ok({ ...session, user: publicUser(user) }, 201);
});
