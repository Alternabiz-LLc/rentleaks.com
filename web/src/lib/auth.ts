import { cookies, headers } from "next/headers";
import { createHash, randomBytes } from "crypto";
import { prisma } from "./prisma";
import { hashPassword, verifyPassword } from "./password";

export { hashPassword, verifyPassword };

const COOKIE = "rl_session";
/** Holds the half-finished sign-in between the password and the code. */
const MFA_COOKIE = "rl_mfa";
const MFA_PREFIX = "mfa:";
const MFA_MINUTES = 10;

export function shaToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function userAgent() {
  try {
    return ((await headers()).get("user-agent") || "").slice(0, 200) || null;
  } catch {
    return null;
  }
}

/**
 * A signed-in browser session. `mfa: true` marks one that passed the second
 * factor — the only kind the desk accepts. Staff sessions are shorter.
 */
export async function createSession(userId: string, opts: { mfa?: boolean; staff?: boolean } = {}) {
  const raw = randomBytes(32).toString("hex");
  const days = opts.staff ? 7 : 14;
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * days);
  await prisma.session.create({
    data: { userId, token: shaToken(raw), expiresAt, mfaAt: opts.mfa ? new Date() : null, userAgent: await userAgent() },
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

/** The session row behind the cookie, with its user — or null. */
export async function getCurrentSession() {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw || !/^[a-f0-9]{64}$/i.test(raw)) return null;
  const session = await prisma.session.findUnique({
    where: { token: shaToken(raw) },
    include: { user: { include: { identity: true } } },
  });
  if (!session || session.kind !== "session" || session.expiresAt < new Date()) return null;
  if (session.user.suspendedAt) return null;
  const { user, ...row } = session;
  return { session: row, user };
}

export async function getCurrentUser() {
  return (await getCurrentSession())?.user ?? null;
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/* --- the step between password and code --------------------------------- */

/** After a correct password: remember who is signing in, for ten minutes. */
export async function startPendingSignIn(userId: string) {
  const raw = randomBytes(32).toString("hex");
  await prisma.session.create({
    data: { userId, kind: "mfa", token: shaToken(MFA_PREFIX + raw), expiresAt: new Date(Date.now() + MFA_MINUTES * 60_000) },
  });
  const jar = await cookies();
  jar.set(MFA_COOKIE, raw, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/login",
    maxAge: MFA_MINUTES * 60,
  });
}

/** The user waiting for their code, if the pending cookie is still valid. */
export async function getPendingSignIn() {
  const jar = await cookies();
  const raw = jar.get(MFA_COOKIE)?.value;
  if (!raw || !/^[a-f0-9]{64}$/i.test(raw)) return null;
  const row = await prisma.session.findUnique({ where: { token: shaToken(MFA_PREFIX + raw) }, include: { user: true } });
  if (!row || row.kind !== "mfa" || row.expiresAt < new Date() || row.user.suspendedAt) return null;
  return { rowId: row.id, user: row.user };
}

export async function endPendingSignIn(rowId?: string) {
  if (rowId) await prisma.session.deleteMany({ where: { id: rowId } });
  const jar = await cookies();
  jar.set(MFA_COOKIE, "", { httpOnly: true, path: "/login", expires: new Date(0) });
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
