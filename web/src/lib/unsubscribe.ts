import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/crm";

/** Takes an address out of all marketing mail, permanently. */
export async function unsubscribeEmail(email: string, via: string) {
  const address = email.trim().toLowerCase();
  await prisma.emailSuppression.upsert({
    where: { email: address },
    update: {},
    create: { email: address, reason: "unsubscribed" },
  });
  const contact = await prisma.contact.findUnique({ where: { email: address }, select: { id: true, unsubscribedAt: true } });
  if (contact && !contact.unsubscribedAt) {
    await prisma.contact.update({
      where: { id: contact.id },
      data: { unsubscribedAt: new Date(), marketingConsent: false },
    });
    await logActivity(contact.id, "note", "Unsubscribed from marketing email", `via ${via}`).catch(() => undefined);
  }
  await prisma.campaignSend.updateMany({
    where: { email: address, status: "queued" },
    data: { status: "skipped", error: "unsubscribed" },
  });
}
