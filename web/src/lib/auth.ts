import { cookies } from "next/headers";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { prisma } from "./prisma";

const COOKIE = "rl_session";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 64);
  const prev = Buffer.from(hash, "hex");
  return prev.length === next.length && timingSafeEqual(prev, next);
}

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
