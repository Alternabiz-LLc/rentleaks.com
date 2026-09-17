/**
 * Two-factor sign-in for the desk: enrolment, verification, recovery codes,
 * lockout and resets. Every staff account (founder included) must have it.
 *
 * Guarantees:
 * - an authenticator code is accepted once (the step is stored atomically);
 * - five wrong codes lock the second step for 15 minutes — counted in the
 *   database, so it holds across Worker isolates — and the owner is emailed;
 * - recovery codes are single-use and stored hashed;
 * - the secret is sealed with AUTH_SECRET before it is written.
 */
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/v1/mail";
import { appUrl } from "@/lib/site";
import { hashRecovery, looksLikeRecovery, newRecoveryCodes } from "./recovery";
import { seal, unseal } from "./seal";
import { newTotpSecret, verifyTotp } from "./totp";

export const MAX_FAILURES = 5;
export const LOCK_MINUTES = 15;

type TfUser = {
  id: string;
  email: string;
  name: string;
  totpSecret: string | null;
  totpEnabledAt: Date | null;
  mfaLockedUntil: Date | null;
};

export type CheckResult = { ok: true; method: "totp" | "recovery"; remaining?: number } | { ok: false; error: string };

function firstName(name: string) {
  return name.split(/\s+/)[0] || "there";
}

async function notify(user: { email: string; name: string }, subject: string, lines: string[]) {
  await sendMail({
    to: user.email,
    subject,
    text: `Hi ${firstName(user.name)},\n\n${lines.join("\n\n")}\n\nSecurity settings: ${appUrl().replace(/\/$/, "")}/admin/security\n\nRentLeaks`,
  }).catch(() => undefined);
}

/**
 * The secret waiting to be confirmed, created on first call. Kept separate
 * from the active one, so moving to a new phone never locks anyone out
 * half-way.
 */
export async function pendingSecret(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { totpPendingSecret: true } });
  if (user.totpPendingSecret) {
    try {
      return unseal(user.totpPendingSecret);
    } catch {
      /* sealed with an older AUTH_SECRET — make a new one below */
    }
  }
  const secret = newTotpSecret();
  await prisma.user.update({ where: { id: userId }, data: { totpPendingSecret: seal(secret) } });
  return secret;
}

/** Confirms the pending secret with a code from the app; returns fresh recovery codes. */
export async function confirmEnrolment(userId: string, code: string): Promise<{ ok: true; codes: string[] } | { ok: false; error: string }> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.totpPendingSecret) return { ok: false, error: "Start again: reload the page to get a new QR code." };
  const secret = unseal(user.totpPendingSecret);
  const step = verifyTotp(secret, code, Date.now());
  if (step === null) return { ok: false, error: "That code doesn't match. Check the time on your phone is set automatically, then try the newest code." };
  const codes = newRecoveryCodes();
  const replacing = Boolean(user.totpEnabledAt);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        totpSecret: user.totpPendingSecret,
        totpPendingSecret: null,
        totpEnabledAt: new Date(),
        totpLastStep: step,
        mfaFailures: 0,
        mfaLockedUntil: null,
      },
    }),
    prisma.recoveryCode.deleteMany({ where: { userId } }),
    prisma.recoveryCode.createMany({ data: codes.map((c) => ({ userId, codeHash: hashRecovery(c) })) }),
  ]);
  if (replacing) {
    await notify(user, "Your RentLeaks authenticator was changed", [
      "Two-factor sign-in on your RentLeaks desk account now uses a new authenticator app, and new recovery codes were issued. The old codes no longer work.",
      "If this wasn't you, reply to this email straight away.",
    ]);
  }
  return { ok: true, codes };
}

/** Checks a six-digit code or a recovery code. Counts failures and locks. */
export async function checkSecondFactor(user: TfUser, input: string): Promise<CheckResult> {
  const now = new Date();
  if (user.mfaLockedUntil && user.mfaLockedUntil > now) {
    const mins = Math.ceil((user.mfaLockedUntil.getTime() - now.getTime()) / 60_000);
    return { ok: false, error: `Too many wrong codes. Try again in ${mins} minute${mins === 1 ? "" : "s"}.` };
  }
  if (!user.totpSecret || !user.totpEnabledAt) return { ok: false, error: "Two-factor isn't set up on this account yet." };

  const raw = String(input || "").trim();
  if (/^\d[\d\s-]{4,8}\d$/.test(raw)) {
    const step = verifyTotp(unseal(user.totpSecret), raw, now.getTime());
    if (step !== null) {
      /* Atomic replay guard: only one request can move the step forward. */
      const r = await prisma.user.updateMany({
        where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
        data: { totpLastStep: step, mfaFailures: 0, mfaLockedUntil: null },
      });
      if (r.count === 1) return { ok: true, method: "totp" };
      return failure(user, "That code was already used. Wait for the next one.");
    }
    return failure(user, "That code doesn't match. Use the newest code in your authenticator app.");
  }

  if (looksLikeRecovery(raw)) {
    const r = await prisma.recoveryCode.updateMany({
      where: { userId: user.id, codeHash: hashRecovery(raw), usedAt: null },
      data: { usedAt: now },
    });
    if (r.count === 1) {
      await prisma.user.update({ where: { id: user.id }, data: { mfaFailures: 0, mfaLockedUntil: null } });
      const remaining = await prisma.recoveryCode.count({ where: { userId: user.id, usedAt: null } });
      await notify(user, "A RentLeaks recovery code was used", [
        `Someone signed in to your RentLeaks desk account with a recovery code. ${remaining} unused code${remaining === 1 ? "" : "s"} left.`,
        "If that was you, set up your authenticator again and print new codes from Security. If it wasn't, reply to this email straight away.",
      ]);
      return { ok: true, method: "recovery", remaining };
    }
    return failure(user, "That recovery code isn't valid or was already used.");
  }

  return failure(user, "Enter the 6-digit code from your authenticator app, or a recovery code like abcde-fghjk.");
}

async function failure(user: TfUser, error: string): Promise<CheckResult> {
  const u = await prisma.user.update({ where: { id: user.id }, data: { mfaFailures: { increment: 1 } }, select: { mfaFailures: true } });
  if (u.mfaFailures >= MAX_FAILURES) {
    await prisma.user.update({
      where: { id: user.id },
      data: { mfaFailures: 0, mfaLockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) },
    });
    await notify(user, "Sign-in blocked on your RentLeaks account", [
      `Someone entered your password correctly but then got the two-factor code wrong ${MAX_FAILURES} times. Code entry is paused for ${LOCK_MINUTES} minutes.`,
      "If this wasn't you, your password is known to someone else: change it now from Security, or use “Forgot your password?” on the sign-in page.",
    ]);
    return { ok: false, error: `Too many wrong codes. Try again in ${LOCK_MINUTES} minutes.` };
  }
  const left = MAX_FAILURES - u.mfaFailures;
  return { ok: false, error: `${error} ${left} attempt${left === 1 ? "" : "s"} left.` };
}

export async function regenerateRecoveryCodes(userId: string) {
  const codes = newRecoveryCodes();
  await prisma.$transaction([
    prisma.recoveryCode.deleteMany({ where: { userId } }),
    prisma.recoveryCode.createMany({ data: codes.map((c) => ({ userId, codeHash: hashRecovery(c) })) }),
  ]);
  return codes;
}

/**
 * Wipes two-factor for an account (lost phone and lost codes) and signs it
 * out everywhere. The member sets it up again at their next sign-in.
 */
export async function resetTwoFactor(userId: string, byFounder: boolean) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { totpSecret: null, totpPendingSecret: null, totpEnabledAt: null, totpLastStep: null, mfaFailures: 0, mfaLockedUntil: null },
    }),
    prisma.recoveryCode.deleteMany({ where: { userId } }),
    prisma.session.deleteMany({ where: { userId } }),
  ]);
  await notify(user, "Two-factor was reset on your RentLeaks account", [
    byFounder
      ? "The account owner reset two-factor sign-in for you. Sign in with your password and you'll be asked to set up your authenticator app again."
      : "Two-factor sign-in was reset. Sign in with your password and set up your authenticator app again.",
    "If you didn't expect this, reply to this email.",
  ]);
}

export async function recoveryCodesLeft(userId: string) {
  return prisma.recoveryCode.count({ where: { userId, usedAt: null } });
}
