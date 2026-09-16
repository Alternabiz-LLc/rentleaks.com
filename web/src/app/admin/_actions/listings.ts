"use server";

import { revalidatePath } from "next/cache";
import { audit, requireAdminAction } from "@/lib/admin/guard";
import { back, field, fields, returnTo } from "@/lib/admin/flash";
import { prisma } from "@/lib/prisma";

const OPS = ["approve", "pending", "decline", "pause", "activate", "sponsor", "unsponsor", "feature", "unfeature", "verify", "unverify"] as const;
type Op = (typeof OPS)[number];

/** Bulk and single listing operations from /admin/listings. */
export async function listingsBulk(fd: FormData) {
  const path = returnTo(fd, "/admin/listings");
  const guard = await requireAdminAction();
  if (!guard.ok) back(path, "err", guard.error);
  const op = field(fd, "op") as Op;
  const ids = fields(fd, "ids").slice(0, 500);
  const note = field(fd, "note", 600);
  if (!OPS.includes(op)) back(path, "err", "Choose an action.");
  if (!ids.length) back(path, "err", "Tick at least one listing.");
  if (op === "decline" && note.length < 8) back(path, "err", "Add a reason (a sentence) — the seller sees it.");

  const now = new Date();
  const moderation = (m: string) => ({ moderation: m, moderatedAt: now, moderatedById: guard.user.id });
  const data: Record<Op, object> = {
    approve: { ...moderation("approved"), moderationNote: null },
    pending: moderation("pending"),
    decline: { ...moderation("declined"), moderationNote: note },
    pause: { status: "paused" },
    activate: { status: "active" },
    sponsor: { sponsored: true },
    unsponsor: { sponsored: false },
    feature: { featured: true },
    unfeature: { featured: false },
    verify: { verified: true },
    unverify: { verified: false },
  };
  const r = await prisma.listing.updateMany({ where: { id: { in: ids } }, data: data[op] });
  await audit(guard.user.id, `listing.${op}`, "listing", ids.length === 1 ? ids[0] : "", { ids: ids.slice(0, 50), count: r.count, note });
  revalidatePath("/admin", "layout");
  revalidatePath("/stays");
  for (const id of ids.slice(0, 20)) revalidatePath(`/listings/${id}`);
  back(path, "ok", `${r.count} listing${r.count === 1 ? "" : "s"} updated (${op}).`);
}

/** Edit the fields the founder most often corrects. */
export async function listingEdit(fd: FormData) {
  const id = field(fd, "id", 200);
  const path = returnTo(fd, `/admin/listings?q=${encodeURIComponent(id)}`);
  const guard = await requireAdminAction();
  if (!guard.ok) back(path, "err", guard.error);
  const title = field(fd, "title", 140);
  const price = Math.round(Number(field(fd, "price")));
  const allIn = Math.round(Number(field(fd, "allIn")));
  const plan = field(fd, "plan") === "month" ? "month" : "week";
  const hostEmail = field(fd, "hostEmail", 200).toLowerCase();
  if (title.length < 6) back(path, "err", "Title is too short.");
  if (!Number.isFinite(price) || price < 0 || !Number.isFinite(allIn) || allIn < price) back(path, "err", "All-in must be at least the rent.");
  const listing = await prisma.listing.findUnique({ where: { id }, select: { id: true, allIn: true, allInUsd: true } });
  if (!listing) back(path, "err", "That listing no longer exists.");
  let hostId: string | undefined;
  if (hostEmail) {
    const host = await prisma.user.findUnique({ where: { email: hostEmail }, select: { id: true } });
    if (!host) back(path, "err", `No account with ${hostEmail}.`);
    hostId = host.id;
  }
  const rate = listing.allIn ? listing.allInUsd / listing.allIn : 1;
  await prisma.listing.update({
    where: { id },
    data: { title, price, allIn, allInUsd: Math.round(allIn * rate), plan, ...(hostId ? { hostId } : {}) },
  });
  await audit(guard.user.id, "listing.edit", "listing", id, { title, price, allIn, plan, hostEmail: hostEmail || undefined });
  revalidatePath("/admin", "layout");
  revalidatePath(`/listings/${id}`);
  back(path, "ok", "Listing saved.");
}
