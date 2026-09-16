import Link from "next/link";
import { Shell } from "@/components/Shell";
import { logActivity } from "@/lib/crm";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Subscription — RentLeaks", robots: { index: false } };

/**
 * Double opt-in confirmation. Confirming is the consent: it clears any past
 * unsubscribe for this address because the person has just asked again.
 */
export default async function ConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const clean = /^[a-f0-9]{48}$/.test(token) ? token : "";
  const contact = clean ? await prisma.contact.findUnique({ where: { confirmToken: clean } }) : null;
  if (contact) {
    await prisma.contact.update({
      where: { id: contact.id },
      data: { confirmToken: null, marketingConsent: true, consentAt: new Date(), unsubscribedAt: null },
    });
    await prisma.emailSuppression.delete({ where: { email: contact.email } }).catch(() => undefined);
    await logActivity(contact.id, "note", "Confirmed newsletter subscription").catch(() => undefined);
  }
  return (
    <Shell>
      <section className="container page-hero">
        <h1>{contact ? "You're subscribed" : "This link has already been used"}</h1>
        <p>
          {contact
            ? "Thanks for confirming. You'll get new homes, city guides and renting tips about twice a month. Every email has an unsubscribe link."
            : "If you already confirmed, you're all set. Otherwise sign up again on rentleaks.com."}
        </p>
        <p>
          <Link className="btn btn--primary" href="/stays">Browse homes</Link>
        </p>
      </section>
    </Shell>
  );
}
