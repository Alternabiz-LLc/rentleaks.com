import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  billingPlanFromCheckout,
  wantsSponsoredFromCheckout,
} from "@/lib/checkout";
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
  if (session.payment_status !== "paid" && session.status !== "complete") return;

  const listingId = session.metadata?.listingId || session.client_reference_id;
  if (!listingId) return;

  const planCsv = session.metadata?.plans;
  const plan = billingPlanFromCheckout(planCsv);
  const sponsored = wantsSponsoredFromCheckout(planCsv);

  await prisma.$transaction([
    ...(session.id
      ? [
          prisma.payment.updateMany({
            where: { stripeSessionId: session.id },
            data: { status: "paid" },
          }),
        ]
      : []),
    prisma.listing.update({
      where: { id: listingId },
      data: {
        plan,
        sponsored,
        featured: sponsored,
      },
    }),
  ]);
}
