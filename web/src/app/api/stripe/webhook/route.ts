import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await fulfillCheckout(session);
      break;
    }
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.id) {
        await prisma.payment.updateMany({
          where: { stripeSessionId: session.id, status: "pending" },
          data: { status: "cancelled" },
        });
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}

async function fulfillCheckout(session: Stripe.Checkout.Session) {
  /* "complete" is not "paid". A session can finish with payment_status unpaid
     (delayed methods, or a $0 session). Only captured money unlocks the listing. */
  if (session.payment_status !== "paid" || !session.id) return;
  if (session.currency && session.currency !== "usd") return;

  const payments = await prisma.payment.findMany({
    where: { stripeSessionId: session.id, status: "pending" },
  });
  if (!payments.length) return;

  const listingId = payments[0].listingId;
  const userId = payments[0].userId;
  if (!listingId || payments.some((row) => row.listingId !== listingId || row.userId !== userId)) return;

  const metaUser = session.metadata?.userId;
  const metaListing = session.metadata?.listingId || session.client_reference_id;
  if (metaUser && metaUser !== userId) return;
  if (metaListing && metaListing !== listingId) return;

  const expected = payments.reduce((sum, row) => sum + row.amount, 0);
  if ((session.amount_total ?? 0) < expected) return;

  const sponsored = payments.some((row) => row.kind === "sponsored");
  const plan = payments.some((row) => row.planId === "month" || row.planId === "featured-month") ? "month" : "week";

  await prisma.$transaction([
    prisma.payment.updateMany({
      where: { id: { in: payments.map((row) => row.id) }, status: "pending" },
      data: { status: "paid" },
    }),
    prisma.listing.update({
      where: { id: listingId },
      data: { plan, sponsored, featured: sponsored },
    }),
  ]);
}
