/**
 * Desk access for pages, server actions and API routes, plus the audit trail.
 *
 * Three checks, in order, on every request:
 *   1. a staff account — the founder (role "admin") or an employee ("staff");
 *   2. a session that passed two-factor (set up first if it never was);
 *   3. the module: employees only reach what the founder granted them.
 *
 * A server action is a public endpoint with a stable name; the fact that its
 * button only renders under /admin is not access control — hence the key on
 * every `requireAdminAction` call.
 */
import { notFound, redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { getCurrentSession, type CurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { accessKeyForPath, ACCESS_LABEL, canAccess, isFounder, isStaffRole, type AccessKey } from "@/lib/access";

export type AdminUser = CurrentUser;
export type ActionResult<T = undefined> = ({ ok: true } & (T extends undefined ? object : { data: T })) | { ok: false; error: string };

/**
 * For pages. `path` is the page's own path — it names the module and is where
 * sign-in returns to. Outsiders get a 404, so the desk does not advertise itself.
 */
export async function requireAdminPage(path = "/admin"): Promise<AdminUser> {
  const ctx = await getCurrentSession();
  const next = encodeURIComponent(path);
  if (!ctx) redirect(`/login?next=${next}`);
  const { user, session } = ctx;
  if (!isStaffRole(user)) notFound();
  if (!user.totpEnabledAt) redirect(`/login/two-factor?next=${next}`);
  if (!session.mfaAt) redirect(`/login/verify?next=${next}`);
  const key = accessKeyForPath(path);
  if (key && !canAccess(user, key)) {
    redirect(`/admin?err=${encodeURIComponent(`Your access doesn't include ${ACCESS_LABEL[key]}. Ask the account owner if you need it.`)}`);
  }
  return user;
}

/** For founder-only pages that are not modules of their own. */
export async function requireFounderPage(path: string): Promise<AdminUser> {
  const user = await requireAdminPage(path);
  if (!isFounder(user)) notFound();
  return user;
}

type Guard = { ok: true; user: AdminUser; founder: boolean } | { ok: false; error: string };

/** For server actions: a result the UI can show instead of throwing. */
export async function requireAdminAction(key: AccessKey | "any"): Promise<Guard> {
  const ctx = await getCurrentSession();
  if (!ctx) return { ok: false, error: "Sign in again." };
  const { user, session } = ctx;
  if (!isStaffRole(user)) return { ok: false, error: "This is a desk action." };
  if (!user.totpEnabledAt || !session.mfaAt) return { ok: false, error: "Confirm your two-factor code again, then retry." };
  if (key !== "any" && !canAccess(user, key)) return { ok: false, error: `Your access doesn't include ${ACCESS_LABEL[key]}.` };
  return { ok: true, user, founder: isFounder(user) };
}

/** For route handlers on the cookie session: the user, or null (answer 404). */
export async function staffForRoute(key: AccessKey | "any"): Promise<AdminUser | null> {
  const g = await requireAdminAction(key);
  return g.ok ? g.user : null;
}

/** Records an admin action. Never throws: the action itself already happened. */
export async function audit(
  actorId: string,
  action: string,
  targetType: string,
  targetId = "",
  detail: Record<string, unknown> = {},
) {
  try {
    await prisma.adminAction.create({
      data: { actorId, action, targetType, targetId, detail: detail as Prisma.InputJsonValue },
    });
  } catch (err) {
    console.error("[audit]", err instanceof Error ? err.message : err);
  }
}

export function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}
