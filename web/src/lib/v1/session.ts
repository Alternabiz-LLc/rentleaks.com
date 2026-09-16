/**
 * Bearer sessions for the native app.
 *
 * Same `Session` table and the same hashing as the cookie flow in lib/auth.ts:
 * the database stores sha256(token), the raw token lives only in the device's
 * secure enclave (expo-secure-store). A stolen database row cannot be replayed.
 *
 * Web and app sessions are interchangeable rows, so signing out everywhere is
 * one deleteMany.
 */
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { shaToken } from "@/lib/auth";
import { HttpError } from "./http";

const APP_SESSION_DAYS = 60;
/** One-time web hand-off codes live this long. */
const HANDOFF_SECONDS = 120;
const HANDOFF_PREFIX = "handoff:";

export async function issueToken(userId: string) {
  const raw = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + APP_SESSION_DAYS * 86_400_000);
  await prisma.session.create({ data: { userId, token: shaToken(raw), expiresAt } });
  return { token: raw, expiresAt: expiresAt.toISOString() };
}

export async function revokeToken(raw: string) {
  await prisma.session.deleteMany({ where: { token: shaToken(raw) } });
}

function bearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = /^Bearer\s+([a-f0-9]{64})$/i.exec(h.trim());
  return m ? m[1] : null;
}

export type SessionUser = NonNullable<Awaited<ReturnType<typeof findUser>>>;

async function findUser(hashed: string) {
  const session = await prisma.session.findUnique({
    where: { token: hashed },
    include: { user: { include: { identity: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  if (session.user.suspendedAt) return null;
  return session.user;
}

/**
 * The signed-in user for an API request: bearer token first (the app), then
 * the web cookie (so the same endpoints work from the browser during
 * development).
 */
export async function optionalUser(req: Request): Promise<SessionUser | null> {
  const raw = bearer(req);
  if (raw) return findUser(shaToken(raw));
  try {
    const jar = await cookies();
    const c = jar.get("rl_session")?.value;
    return c ? findUser(shaToken(c)) : null;
  } catch {
    return null;
  }
}

export async function requireUser(req: Request): Promise<SessionUser> {
  const user = await optionalUser(req);
  if (!user) throw new HttpError(401, "unauthenticated", "Sign in to continue.");
  return user;
}

export function rawBearer(req: Request) {
  return bearer(req);
}

/* --- web hand-off --------------------------------------------------------
   Identity verification runs in the browser (the document is checked on the
   device and discarded — there is deliberately no upload endpoint). The app
   opens that page in an in-app browser, which has no cookie. A hand-off code
   bridges it: short-lived, single-use, stored hashed like any session. */

export async function issueHandoff(userId: string) {
  const raw = randomBytes(24).toString("hex");
  await prisma.session.create({
    data: {
      userId,
      token: shaToken(HANDOFF_PREFIX + raw),
      expiresAt: new Date(Date.now() + HANDOFF_SECONDS * 1000),
    },
  });
  return raw;
}

export async function redeemHandoff(raw: string) {
  if (!/^[a-f0-9]{48}$/i.test(raw)) return null;
  const hashed = shaToken(HANDOFF_PREFIX + raw);
  const row = await prisma.session.findUnique({ where: { token: hashed } });
  if (!row) return null;
  await prisma.session.delete({ where: { token: hashed } });
  if (row.expiresAt < new Date()) return null;
  return row.userId;
}

/* --- password reset ------------------------------------------------------
   Same pattern as the hand-off: a random token, stored only as a hash in the
   Session table under its own prefix, single-use, short-lived. No migration
   needed, and a leaked database row cannot be used to reset anyone. */

const RESET_PREFIX = "reset:";
const RESET_MINUTES = 30;

export async function issueResetToken(userId: string) {
  const raw = randomBytes(32).toString("hex");
  await prisma.session.create({
    data: { userId, token: shaToken(RESET_PREFIX + raw), expiresAt: new Date(Date.now() + RESET_MINUTES * 60_000) },
  });
  return raw;
}

export async function redeemResetToken(raw: string) {
  if (!/^[a-f0-9]{64}$/i.test(raw)) return null;
  const hashed = shaToken(RESET_PREFIX + raw);
  const row = await prisma.session.findUnique({ where: { token: hashed } });
  if (!row) return null;
  await prisma.session.delete({ where: { token: hashed } });
  if (row.expiresAt < new Date()) return null;
  return row.userId;
}
