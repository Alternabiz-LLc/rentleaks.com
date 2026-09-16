"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/leads";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/roles";

/**
 * Working the Leads inbox on /admin. Founder account only, checked here on
 * every call: a server action is a public endpoint, whatever page renders the
 * button.
 */
export type LeadUpdateResult = { ok: true } | { ok: false; error: string };

export async function updateLead(id: string, status: string, note: string): Promise<LeadUpdateResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again." };
  if (!isAdmin(user)) return { ok: false, error: "Leads are a founder-account view." };
  if (!LEAD_STATUSES.includes(status as LeadStatus)) return { ok: false, error: "Unknown status." };

  const lead = await prisma.lead.findUnique({ where: { id }, select: { id: true, contactedAt: true } });
  if (!lead) return { ok: false, error: "That lead no longer exists." };

  await prisma.lead.update({
    where: { id },
    data: {
      status,
      note: note.trim().slice(0, 1000) || null,
      /* First time it leaves "new", stamp when we got back to them. */
      ...(status !== "new" && !lead.contactedAt ? { contactedAt: new Date() } : {}),
    },
  });
  revalidatePath("/admin");
  return { ok: true };
}
