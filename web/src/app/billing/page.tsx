import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { BankBillingButton } from "@/components/BankBillingButton";
import { getCurrentUser } from "@/lib/auth";
import { chargebeeConfig } from "@/lib/chargebee/client";
import { hostCheckoutLines } from "@/lib/checkout";
import { formatUsd } from "@/lib/plans";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bank billing — RentLeaks" };
export default async function BillingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/billing");
  const listings = await prisma.listing.findMany({ where: { hostId: user.id }, include: { bankSubscription: true }, orderBy: { createdAt: "asc" } });
  const enabled = Boolean(chargebeeConfig());
  const billable = listings;
  return <Shell><section className="container page-hero"><h1>Bank billing</h1><p>Recurring listing plans at your current app prices. Secure checkout and bank mandates are handled by Chargebee and GoCardless.</p><p>Bank payments can take several business days. Completing checkout does not confirm payment. Your account remains available while payment is pending; paid publication and placement activate after confirmation and become read-only if payment fails.</p>{!enabled ? <p role="status">Bank billing is not available yet. Contact us for help with your current payment options.</p> : null}<p><Link href="/account">Back to your account</Link> · <Link href="https://rentleaks.com/contact.html">Contact us</Link></p>
    {billable.length ? billable.map((listing) => {
      const bank = listing.bankSubscription;
      const detail = (listing.detail ?? {}) as { pendingSponsored?: boolean };
      const lines = hostCheckoutLines({ housingType: listing.housingType, plan: listing.plan, sponsored: listing.sponsored || detail.pendingSponsored === true, trialEndsAt: user.trialEndsAt, priorListings: Math.max(0, billable.length - 1) });
      const period = (bank?.planId ?? listing.plan) === "month" ? "month" : "week";
      const amount = bank?.amountCents ?? lines.reduce((sum, line) => sum + line.amountCents, 0);
      return <section key={listing.id} style={{ padding: "1.5rem 0", borderTop: "1px solid var(--border)" }}><h2>{listing.title}</h2><p>{formatUsd(amount)}/{period}{bank?.sponsored ? " including sponsored placement" : ""}</p><p>{bank ? bank.access === "active" && bank.paidThrough && bank.paidThrough > new Date() ? `Paid through ${bank.paidThrough.toLocaleDateString("en-US", { timeZone: "America/New_York" })}` : bank.access === "read_only" ? "Payment needs attention — paid features are read-only." : bank.status === "checkout_pending" ? "Checkout has not been completed." : "Payment pending — basic account access." : lines.length ? "You’ll review the recurring amount and bank mandate before subscribing." : "Your listing trial is active; no payment is required."}</p>{bank?.customerId ? <BankBillingButton subscriptionId={bank.id} disabled={!enabled} /> : lines.length ? <BankBillingButton listingId={listing.id} disabled={!enabled || Boolean(bank && bank.status !== "checkout_pending")} /> : null}</section>;
    }) : <p>No billable listings yet.</p>}
  </section></Shell>;
}
