import { NextResponse } from "next/server";
import { createListingCheckoutSession, hostCheckoutLines } from "@/lib/checkout";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripeEnabled } from "@/lib/stripe";

export async function POST(request: Request) {
  if (!stripeEnabled()) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to pay." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { listingId?: string } | null;
  const listingId = String(body?.listingId || "");
  if (!listingId) return NextResponse.json({ error: "Missing listing." }, { status: 400 });

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.hostId !== user.id) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  const detail = (listing.detail ?? {}) as { pendingSponsored?: boolean };
  const lines = hostCheckoutLines({
    housingType: listing.housingType,
    plan: listing.plan,
    sponsored: listing.sponsored || detail.pendingSponsored === true,
    trialEndsAt: user.trialEndsAt,
  });
  if (!lines.length) {
    return NextResponse.json({ url: `/listings/${listing.id}` });
  }

  for (const line of lines) {
    await prisma.payment.create({
      data: {
        userId: user.id,
        listingId: listing.id,
        kind: line.kind,
        amount: line.amountCents,
        currency: "usd",
        status: "pending",
        planId: line.planId,
      },
    });
  }

  const session = await createListingCheckoutSession({
    userId: user.id,
    email: user.email,
    listingId: listing.id,
    lines,
  });
  if (!session?.url) {
    return NextResponse.json({ error: "Could not start checkout." }, { status: 502 });
  }

  await prisma.payment.updateMany({
    where: { listingId: listing.id, userId: user.id, status: "pending", stripeSessionId: null },
    data: { stripeSessionId: session.id },
  });

  return NextResponse.json({ url: session.url });
}
