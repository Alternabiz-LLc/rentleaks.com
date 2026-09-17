"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentSession, hashPassword, verifyPassword } from "@/lib/auth";
import { isStaffRole } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/v1/http";
import { SealError } from "@/lib/security/seal";
import { checkSecondFactor, confirmEnrolment, regenerateRecoveryCodes } from "@/lib/security/two-factor";

export type CodesState = { error?: string; codes?: string[] };
export type PasswordState = { error?: string; ok?: string };

async function throttle(key: string, limit: number, windowMs: number) {
  const h = await headers();
  const ip = h.get("cf-connecting-ip") || (h.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
  try {
    await rateLimit(`${key}:${ip}`, limit, windowMs);
    return true;
  } catch {
    return false;
  }
}

async function staffSession() {
  const ctx = await getCurrentSession();
  if (!ctx || !isStaffRole(ctx.user)) return null;
  return ctx;
}

async function log(actorId: string, action: string, detail: Record<string, unknown> = {}) {
  await prisma.adminAction.create({ data: { actorId, action, targetType: "user", targetId: actorId, detail: detail as object } }).catch(() => undefined);
}

/**
 * Step 3 of set-up: the password again (so a borrowed session cannot bind
 * someone else's phone) and a code from the new authenticator. On success
 * this session counts as verified and every other session is signed out.
 */
export async function confirmTwoFactorAction(_: CodesState, fd: FormData): Promise<CodesState> {
  const ctx = await staffSession();
  if (!ctx) return { error: "Your session ended. Sign in again." };
  if (!(await throttle("tf-setup", 10, 5 * 60_000))) return { error: "Too many attempts. Wait a few minutes." };
  const { user, session } = ctx;
  if (user.totpEnabledAt && !session.mfaAt) return { error: "Confirm your current code first." };
  if (!verifyPassword(String(fd.get("password") || ""), user.passwordHash)) return { error: "That password isn't right." };
  try {
    const r = await confirmEnrolment(user.id, String(fd.get("code") || ""));
    if (!r.ok) return { error: r.error };
    await prisma.$transaction([
      prisma.session.update({ where: { id: session.id }, data: { mfaAt: new Date() } }),
      prisma.session.deleteMany({ where: { userId: user.id, kind: "session", id: { not: session.id } } }),
    ]);
    await log(user.id, user.totpEnabledAt ? "security.2fa.moved" : "security.2fa.enabled");
    return { codes: r.codes };
  } catch (err) {
    if (err instanceof SealError) return { error: err.message };
    throw err;
  }
}

/** New recovery codes; asks for a current code so a stolen laptop can't print them. */
export async function regenerateCodesAction(_: CodesState, fd: FormData): Promise<CodesState> {
  const ctx = await staffSession();
  if (!ctx || !ctx.session.mfaAt) return { error: "Sign in again." };
  const check = await checkSecondFactor(ctx.user, String(fd.get("code") || ""));
  if (!check.ok) return { error: check.error };
  const codes = await regenerateRecoveryCodes(ctx.user.id);
  await log(ctx.user.id, "security.recovery.regenerated");
  revalidatePath("/admin/security");
  return { codes };
}

export async function changePasswordAction(_: PasswordState, fd: FormData): Promise<PasswordState> {
  const ctx = await staffSession();
  if (!ctx || !ctx.session.mfaAt) return { error: "Sign in again." };
  if (!(await throttle("pw-change", 10, 15 * 60_000))) return { error: "Too many attempts. Wait a few minutes." };
  const current = String(fd.get("current") || "");
  const next = String(fd.get("password") || "");
  const again = String(fd.get("confirm") || "");
  if (!verifyPassword(current, ctx.user.passwordHash)) return { error: "Your current password isn't right." };
  if (next.length < 12) return { error: "Use at least 12 characters." };
  if (next !== again) return { error: "The two new passwords don't match." };
  if (next === current) return { error: "Choose a password you haven't used here." };
  await prisma.$transaction([
    prisma.user.update({ where: { id: ctx.user.id }, data: { passwordHash: hashPassword(next) } }),
    prisma.session.deleteMany({ where: { userId: ctx.user.id, id: { not: ctx.session.id } } }),
  ]);
  await log(ctx.user.id, "security.password.changed");
  revalidatePath("/admin/security");
  return { ok: "Password changed. Every other device was signed out." };
}

export async function revokeSessionAction(fd: FormData) {
  const ctx = await staffSession();
  if (!ctx || !ctx.session.mfaAt) redirect("/login");
  const id = String(fd.get("id") || "");
  if (id === "others") {
    const r = await prisma.session.deleteMany({ where: { userId: ctx.user.id, kind: "session", id: { not: ctx.session.id } } });
    await log(ctx.user.id, "security.sessions.revoked", { count: r.count });
    redirect(`/admin/security?ok=${encodeURIComponent(`Signed out of ${r.count} other session${r.count === 1 ? "" : "s"}.`)}`);
  }
  if (id === ctx.session.id) redirect("/admin/security?err=Use+Sign+out+for+this+device.");
  const r = await prisma.session.deleteMany({ where: { id, userId: ctx.user.id } });
  if (r.count) await log(ctx.user.id, "security.sessions.revoked", { count: 1 });
  redirect(`/admin/security?ok=${r.count ? "Session+signed+out." : "That+session+had+already+ended."}`);
}
