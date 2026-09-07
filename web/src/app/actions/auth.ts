"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { safePath } from "@/lib/site";

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const next = safePath(String(formData.get("next") || "/"));
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    redirect(`/login?error=invalid&next=${encodeURIComponent(next)}`);
  }
  await createSession(user.id);
  redirect(next);
}

export async function signUpAction(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "host") === "renter" ? "renter" : "host";
  const next = safePath(String(formData.get("next") || "/list"));

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
  await createSession(user.id);
  redirect(next);
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
