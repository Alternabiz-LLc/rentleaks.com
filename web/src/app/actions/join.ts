"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/v1/http";
import { redeemInvite } from "@/lib/v1/session";

export type JoinState = { error?: string };

/**
 * An invited employee chooses a password. The invitation proves the mailbox;
 * the session this creates can only open the two-factor set-up next.
 */
export async function acceptInviteAction(_: JoinState, fd: FormData): Promise<JoinState> {
  const h = await headers();
  const ip = h.get("cf-connecting-ip") || (h.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
  try {
    await rateLimit(`join:${ip}`, 10, 15 * 60_000);
  } catch {
    return { error: "Too many attempts. Wait a few minutes." };
  }
  const token = String(fd.get("token") || "");
  const password = String(fd.get("password") || "");
  const confirm = String(fd.get("confirm") || "");
  if (password.length < 12) return { error: "Use at least 12 characters." };
  if (password !== confirm) return { error: "The two passwords don't match." };
  if (/^(.)\1+$/.test(password) || /^(password|123456|qwerty)/i.test(password)) return { error: "Choose a password that's harder to guess." };

  const user = await redeemInvite(token);
  if (!user || user.role !== "staff") return { error: "This invitation has expired or was already used. Ask for a new one." };
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(password), staffJoinedAt: new Date(), lastSignInAt: new Date() },
  });
  await prisma.adminAction
    .create({ data: { actorId: user.id, action: "staff.joined", targetType: "user", targetId: user.id } })
    .catch(() => undefined);
  await createSession(user.id, { staff: true });
  redirect("/login/two-factor?next=%2Fadmin");
}
