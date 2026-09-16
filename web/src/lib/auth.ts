import { cookies } from "next/headers";
import { createHash, randomBytes } from "crypto";
import { prisma } from "./prisma";
import { hashPassword, verifyPassword } from "./password";

export { hashPassword, verifyPassword };

const COOKIE = "rl_session";

export function shaToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const raw = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
  await prisma.session.create({
    data: { userId, token: shaToken(raw), expiresAt },
  });
  const jar = await cookies();
  jar.set(COOKIE, raw, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (raw) {
    await prisma.session.deleteMany({ where: { token: shaToken(raw) } });
  }
  jar.set(COOKIE, "", { httpOnly: true, path: "/", expires: new Date(0) });
}

export async function getCurrentUser() {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const session = await prisma.session.findUnique({
    where: { token: shaToken(raw) },
    include: { user: { include: { identity: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  if (session.user.suspendedAt) return null;
  return session.user;
}

export function publicUser(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  identity?: { status: string } | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    identityStatus: user.identity?.status ?? "unverified",
  };
}
