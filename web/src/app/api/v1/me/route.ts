import { prisma } from "@/lib/prisma";
import { publicUser } from "@/lib/auth";
import { fail, handle, ok, readJson, str } from "@/lib/v1/http";
import { requireUser } from "@/lib/v1/session";
import { unreadCount } from "@/lib/v1/inbox";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const user = await requireUser(req);
  const [saved, unread, listings] = await Promise.all([
    prisma.savedListing.count({ where: { userId: user.id } }),
    unreadCount(user.id),
    prisma.listing.groupBy({ by: ["moderation"], where: { hostId: user.id }, _count: true }),
  ]);
  return ok({
    user: { ...publicUser(user), createdAt: user.createdAt.toISOString() },
    counts: {
      saved,
      unread,
      listings: Object.fromEntries(listings.map((r) => [r.moderation, r._count])),
    },
  });
});

/**
 * Profile edits. `role` may only move a renter to `host` — the one-tap
 * "start hosting" a renter needs when they have a room to let. Nobody can
 * grant themselves admin, and a host stays a host.
 */
export const PATCH = handle(async (req: Request) => {
  const user = await requireUser(req);
  const body = await readJson(req);
  const data: { name?: string; role?: string } = {};
  if (body.name !== undefined) {
    const name = str(body.name, 80);
    if (name.length < 2) return fail(400, "invalid_name", "Add your name.");
    data.name = name;
  }
  if (body.role !== undefined) {
    if (body.role !== "host") return fail(400, "role", "Accounts can only be switched to hosting.");
    if (user.role === "renter") data.role = "host";
  }
  if (!Object.keys(data).length) return fail(400, "nothing", "Nothing to change.");
  const updated = await prisma.user.update({ where: { id: user.id }, data, include: { identity: true } });
  return ok({ user: publicUser(updated) });
});

/**
 * Account deletion, from inside the app — an App Store requirement (5.1.1(v))
 * and the right thing to offer anyway. Listings go first because Listing.host
 * does not cascade; conversations, leases, saved rows and reports on those
 * listings cascade from them.
 */
export const DELETE = handle(async (req: Request) => {
  const user = await requireUser(req);
  const body = await readJson(req).catch(() => ({}) as Record<string, unknown>);
  if (body.confirm !== "DELETE") {
    return fail(400, "confirm", "Type DELETE to confirm. This removes your account, listings and messages.");
  }
  if (user.role === "admin" || user.role === "staff") {
    return fail(403, "admin", "Desk accounts can't be deleted from the app. The account owner removes them from Team & access.");
  }
  await prisma.$transaction([
    prisma.listing.deleteMany({ where: { hostId: user.id } }),
    prisma.user.delete({ where: { id: user.id } }),
  ]);
  return ok({ ok: true });
});
