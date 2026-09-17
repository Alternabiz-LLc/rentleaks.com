"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  createSession,
  destroySession,
  endPendingSignIn,
  getCurrentSession,
  getPendingSignIn,
  hashPassword,
  startPendingSignIn,
  verifyPassword,
} from "@/lib/auth";
import { safePath } from "@/lib/site";
import { contactFromUser } from "@/lib/crm";
import { isStaffRole } from "@/lib/access";
import { rateLimit } from "@/lib/v1/http";
import { checkSecondFactor } from "@/lib/security/two-factor";

async function ipKey() {
  const h = await headers();
  return h.get("cf-connecting-ip") || (h.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
}

/** Rate-limited without throwing: false means "slow down". */
async function allowed(key: string, limit: number, windowMs: number) {
  try {
    await rateLimit(key, limit, windowMs);
    return true;
  } catch {
    return false;
  }
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const next = safePath(String(formData.get("next") || "/"));
  const back: (error: string) => never = (error) => redirect(`/login?error=${error}&next=${encodeURIComponent(next)}`);

  if (!(await allowed(`web-login:${await ipKey()}`, 10, 60_000)) || !(await allowed(`web-login-email:${email}`, 20, 15 * 60_000))) {
    back("slow");
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordHash)) back("invalid");
  if (user.suspendedAt) redirect("/login?error=suspended");

  if (isStaffRole(user)) {
    await prisma.user.update({ where: { id: user.id }, data: { lastSignInAt: new Date() } });
    if (user.totpEnabledAt) {
      /* Password is right; the session only exists once the code is too. */
      await startPendingSignIn(user.id);
      redirect(`/login/verify?next=${encodeURIComponent(next)}`);
    }
    /* Never set up: a session that can only open the set-up page. */
    await createSession(user.id, { staff: true });
    redirect(`/login/two-factor?next=${encodeURIComponent(next.startsWith("/admin") ? next : "/admin")}`);
  }

  await createSession(user.id);
  redirect(next);
}

export type VerifyState = { error?: string };

/**
 * The second step. Works for a pending sign-in (password just entered) and
 * for an existing session that has not passed two-factor yet (an app hand-off
 * or a session from before two-factor was required) — that one is upgraded.
 */
export async function verifyCodeAction(_: VerifyState, formData: FormData): Promise<VerifyState> {
  const code = String(formData.get("code") || "");
  const next = safePath(String(formData.get("next") || "/admin"), "/admin");
  if (!(await allowed(`mfa:${await ipKey()}`, 20, 5 * 60_000))) return { error: "Too many attempts from this network. Wait a few minutes." };

  const pending = await getPendingSignIn();
  if (pending) {
    const result = await checkSecondFactor(pending.user, code);
    if (!result.ok) return { error: result.error };
    await endPendingSignIn(pending.rowId);
    await createSession(pending.user.id, { mfa: true, staff: true });
    await auditSignIn(pending.user.id, result.method);
    redirect(result.method === "recovery" ? "/admin/security?ok=Signed+in+with+a+recovery+code.+Print+new+codes+or+move+your+authenticator+below." : next);
  }

  const ctx = await getCurrentSession();
  if (!ctx || !isStaffRole(ctx.user)) return { error: "Your sign-in expired. Enter your email and password again." };
  if (ctx.session.mfaAt) redirect(next);
  const result = await checkSecondFactor(ctx.user, code);
  if (!result.ok) return { error: result.error };
  await prisma.session.update({ where: { id: ctx.session.id }, data: { mfaAt: new Date() } });
  await auditSignIn(ctx.user.id, result.method);
  redirect(next);
}

async function auditSignIn(userId: string, method: string) {
  await prisma.adminAction
    .create({ data: { actorId: userId, action: `security.signin.${method}`, targetType: "user", targetId: userId } })
    .catch(() => undefined);
}

export async function cancelSignInAction() {
  const pending = await getPendingSignIn();
  await endPendingSignIn(pending?.rowId);
  await destroySession();
  redirect("/login");
}

export async function signUpAction(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "host") === "renter" ? "renter" : "host";
  const next = safePath(String(formData.get("next") || "/list"));

  if (!(await allowed(`web-signup:${await ipKey()}`, 5, 15 * 60_000))) {
    redirect(`/login?mode=signup&error=slow&next=${encodeURIComponent(next)}`);
  }
  if (!name || !email.includes("@") || password.length < 8) {
    redirect(`/login?mode=signup&error=invalid&next=${encodeURIComponent(next)}`);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    redirect(`/login?error=exists&next=${encodeURIComponent(next)}`);
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: hashPassword(password),
      role,
      identity: { create: { status: "unverified", provider: "demo" } },
    },
  });
  await contactFromUser(user);
  await createSession(user.id);
  redirect(next);
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
