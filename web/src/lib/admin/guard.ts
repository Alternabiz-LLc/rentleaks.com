/**
 * Founder-only access for pages and server actions, plus the audit trail.
 *
 * Every admin server action calls `requireAdminAction()` first. A server
 * action is a public endpoint with a stable name; the fact that its button
 * only renders under /admin is not access control.
 */
import { notFound, redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/roles";

export type AdminUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
export type ActionResult<T = undefined> = ({ ok: true } & (T extends undefined ? object : { data: T })) | { ok: false; error: string };

/** For pages: redirect to sign-in, 404 for everyone else. */
export async function requireAdminPage(next = "/admin"): Promise<AdminUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!isAdmin(user)) notFound();
  return user;
}

/** For server actions: a result the UI can show instead of throwing. */
export async function requireAdminAction(): Promise<{ ok: true; user: AdminUser } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again." };
  if (!isAdmin(user)) return { ok: false, error: "This is a founder-account action." };
  return { ok: true, user };
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
