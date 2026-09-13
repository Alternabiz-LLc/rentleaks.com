"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Seller-account mutations.
 *
 * Every one of these re-reads the listing and checks it belongs to the signed-
 * in account before writing. That check is not a formality: a server action is
 * a public endpoint with a stable name, and "the button was only on my own
 * dashboard" is not access control. The failure mode if it were missing is the
 * worst kind — one account pausing, unpausing or promoting another account's
 * listings.
 *
 * They return a result rather than throwing, so the dashboard can say what
 * happened instead of showing an error boundary.
 */

type Result = { ok: true } | { ok: false; error: string };

/* Explicitly discriminated on `ok`. An `"error" in found` check does not
   narrow reliably across a three-branch union, and a half-narrowed type here
   would mean the ownership check compiles while quietly doing nothing. */
type Owned =
  | { ok: false; error: string }
  | { ok: true; userId: string; listing: { id: string; hostId: string; cityId: string } };

const STATUSES = ["active", "coming-soon", "paused"] as const;
type Status = (typeof STATUSES)[number];

async function ownedListing(id: string): Promise<Owned> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again to change your listings." };

  const listing = await prisma.listing.findUnique({
    where: { id },
    select: { id: true, hostId: true, cityId: true },
  });
  if (!listing) return { ok: false, error: "That listing no longer exists." };

  /* The check. Ownership, every time, on every path. */
  if (listing.hostId !== user.id) {
    return { ok: false, error: "That listing belongs to another account." };
  }
  return { ok: true, userId: user.id, listing };
}

export async function setListingStatus(id: string, status: string): Promise<Result> {
  if (!STATUSES.includes(status as Status)) {
    return { ok: false, error: "Unknown status." };
  }
  const found = await ownedListing(id);
  if (!found.ok) return found;

  await prisma.listing.update({ where: { id }, data: { status } });
  revalidatePath("/account");
  revalidatePath(`/listings/${id}`);
  return { ok: true };
}

export async function setListingSponsored(id: string, sponsored: boolean): Promise<Result> {
  const found = await ownedListing(id);
  if (!found.ok) return found;

  /* Sponsorship buys position in this listing's own market and nothing else.
     It does not touch `verified`, and it cannot: promoting an unverified
     listing is allowed, promoting it into looking verified is not. */
  await prisma.listing.update({ where: { id }, data: { sponsored } });
  revalidatePath("/account");
  revalidatePath(`/cities/${found.listing.cityId}`);
  return { ok: true };
}

export async function setListingPlan(id: string, plan: string): Promise<Result> {
  const next = plan === "month" ? "month" : "week";
  const found = await ownedListing(id);
  if (!found.ok) return found;

  await prisma.listing.update({ where: { id }, data: { plan: next } });
  revalidatePath("/account");
  return { ok: true };
}
