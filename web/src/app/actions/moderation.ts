"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/roles";

/**
 * Listing review, for the founder account only.
 *
 * Approve puts a listing in front of renters; decline takes it out and records
 * why. The reason is not optional on a decline and it is shown to the seller
 * verbatim: a listing rejected without a reason is a support ticket, and a
 * seller who cannot tell what was wrong will submit the same listing again.
 *
 * The check is `isAdmin` on every path. A server action is a public endpoint
 * with a stable name — "the button only renders on /admin" is not access
 * control, and the failure here would be any signed-in account moderating the
 * whole catalogue.
 */

export type ReviewResult = { ok: true } | { ok: false; error: string };

const DECISIONS = ["approved", "declined", "pending"] as const;
type Decision = (typeof DECISIONS)[number];

export async function reviewListing(id: string, decision: string, note: string): Promise<ReviewResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again." };
  if (!isAdmin(user)) return { ok: false, error: "Reviewing listings is a founder-account action." };

  if (!DECISIONS.includes(decision as Decision)) {
    return { ok: false, error: "Unknown decision." };
  }
  const reason = note.trim().slice(0, 600);
  if (decision === "declined" && reason.length < 8) {
    return { ok: false, error: "Say why, in a sentence. The seller is shown this and will otherwise resubmit the same listing." };
  }

  const listing = await prisma.listing.findUnique({ where: { id }, select: { id: true, cityId: true } });
  if (!listing) return { ok: false, error: "That listing no longer exists." };

  await prisma.listing.update({
    where: { id },
    data: {
      moderation: decision,
      moderationNote: decision === "declined" ? reason : reason || null,
      moderatedAt: new Date(),
      moderatedById: user.id,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/account");
  revalidatePath("/stays");
  revalidatePath(`/listings/${id}`);
  return { ok: true };
}
