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
import { canAccess, isStaffRole, type AccessKey } from "@/lib/access";

const APP_SESSION_DAYS = 60;
/** One-time web hand-off codes live this long. */
const HANDOFF_SECONDS = 120;
const HANDOFF_PREFIX = "handoff:";

export async function issueToken(userId: string, opts: { mfa?: boolean; userAgent?: string | null } = {}) {
  const raw = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + APP_SESSION_DAYS * 86_400_000);
  await prisma.session.create({
    data: { userId, token: shaToken(raw), expiresAt, mfaAt: opts.mfa ? new Date() : null, userAgent: opts.userAgent?.slice(0, 200) || "RentLeaks app" },
  });
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

async function findSession(hashed: string) {
  const session = await prisma.session.findUnique({
    where: { token: hashed },
    include: { user: { include: { identity: true } } },
  });
  if (!session || session.kind !== "session" || session.expiresAt < new Date()) return null;
  if (session.user.suspendedAt) return null;
  return session;
}

async function findUser(hashed: string) {
  return (await findSession(hashed))?.user ?? null;
}

/** The session row and user for an API request (bearer first, then cookie). */
export async function optionalSession(req: Request) {
  const raw = bearer(req);
  if (raw) return findSession(shaToken(raw));
  try {
    const jar = await cookies();
    const c = jar.get("rl_session")?.value;
    return c ? findSession(shaToken(c)) : null;
  } catch {
    return null;
  }
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

/**
 * A desk member on the API: signed in, two-factor passed on this session, and
 * granted `key`. Throws the HTTP error the app shows.
 */
export async function requireStaff(req: Request, key: AccessKey): Promise<SessionUser> {
  const s = await optionalSession(req);
  if (!s) throw new HttpError(401, "unauthenticated", "Sign in to continue.");
  if (!isStaffRole(s.user)) throw new HttpError(403, "forbidden", "Desk accounts only.");
  if (!s.user.totpEnabledAt || !s.mfaAt) throw new HttpError(403, "two_factor", "Sign out and back in with your two-factor code to use the desk.");
  if (!canAccess(s.user, key)) throw new HttpError(403, "forbidden", "Your desk access doesn't include this.");
  return s.user;
}

type AnySession = NonNullable<Awaited<ReturnType<typeof optionalSession>>>;

/** True when this session may use desk module `key` (no throw). */
export function sessionCan(s: AnySession | null, key: AccessKey) {
  return !!s && isStaffRole(s.user) && !!s.user.totpEnabledAt && !!s.mfaAt && canAccess(s.user, key);
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

/** `mfa` carries the second-factor state of the app session over to the web. */
export async function issueHandoff(userId: string, mfa = false) {
  const raw = randomBytes(24).toString("hex");
  await prisma.session.create({
    data: {
      userId,
      kind: "handoff",
      token: shaToken(HANDOFF_PREFIX + raw),
      expiresAt: new Date(Date.now() + HANDOFF_SECONDS * 1000),
      mfaAt: mfa ? new Date() : null,
    },
  });
  return raw;
}

export async function redeemHandoff(raw: string): Promise<{ userId: string; mfa: boolean } | null> {
  if (!/^[a-f0-9]{48}$/i.test(raw)) return null;
  const hashed = shaToken(HANDOFF_PREFIX + raw);
  const row = await prisma.session.findUnique({ where: { token: hashed } });
  if (!row || row.kind !== "handoff") return null;
  await prisma.session.delete({ where: { token: hashed } });
  if (row.expiresAt < new Date()) return null;
  return { userId: row.userId, mfa: Boolean(row.mfaAt) };
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
    data: { userId, kind: "reset", token: shaToken(RESET_PREFIX + raw), expiresAt: new Date(Date.now() + RESET_MINUTES * 60_000) },
  });
  return raw;
}

export async function redeemResetToken(raw: string) {
  if (!/^[a-f0-9]{64}$/i.test(raw)) return null;
  const hashed = shaToken(RESET_PREFIX + raw);
  const row = await prisma.session.findUnique({ where: { token: hashed } });
  if (!row || row.kind !== "reset") return null;
  await prisma.session.delete({ where: { token: hashed } });
  if (row.expiresAt < new Date()) return null;
  return row.userId;
}

/* --- staff invitations ---------------------------------------------------
   Same pattern again: 48 hours, single use, hashed. Issuing a new invite
   removes any older one for that person. */

const INVITE_PREFIX = "invite:";
export const INVITE_HOURS = 48;

export async function issueInviteToken(userId: string) {
  const raw = randomBytes(32).toString("hex");
  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId, kind: "invite" } }),
    prisma.session.create({
      data: { userId, kind: "invite", token: shaToken(INVITE_PREFIX + raw), expiresAt: new Date(Date.now() + INVITE_HOURS * 3_600_000) },
    }),
  ]);
  return raw;
}

/** Looks the invite up without using it (for rendering the page). */
export async function peekInvite(raw: string) {
  if (!/^[a-f0-9]{64}$/i.test(raw)) return null;
  const row = await prisma.session.findUnique({ where: { token: shaToken(INVITE_PREFIX + raw) }, include: { user: true } });
  if (!row || row.kind !== "invite" || row.expiresAt < new Date() || row.user.suspendedAt) return null;
  return row.user;
}

export async function redeemInvite(raw: string) {
  const user = await peekInvite(raw);
  if (!user) return null;
  const r = await prisma.session.deleteMany({ where: { token: shaToken(INVITE_PREFIX + raw) } });
  return r.count === 1 ? user : null;
}
