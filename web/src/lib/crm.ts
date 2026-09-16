/**
 * CRM helpers: every lead and every sign-up lands in Contact, so the founder
 * has one list of people with one timeline each.
 *
 * Consent is never inferred. A lead consented to be contacted about their
 * request, not to receive newsletters, so `marketingConsent` stays false
 * unless the person opted in (newsletter form) or the founder records it.
 */
import { prisma } from "@/lib/prisma";
import { EMAIL_RE, normaliseTags, parseTags } from "@/lib/marketing";

export type ContactSeed = {
  email: string;
  name?: string;
  phone?: string | null;
  company?: string | null;
  kind?: string;
  source?: string;
  cityId?: string | null;
  tags?: string[];
  userId?: string | null;
  note?: string | null;
};

/** Creates the contact or fills in what is missing; never downgrades a stage. */
export async function upsertContact(seed: ContactSeed) {
  const email = seed.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error(`"${seed.email}" is not an email address.`);
  const existing = await prisma.contact.findUnique({ where: { email } });
  if (!existing) {
    return prisma.contact.create({
      data: {
        email,
        name: seed.name?.trim().slice(0, 120) || "",
        phone: seed.phone || null,
        company: seed.company || null,
        kind: seed.kind || "renter",
        source: seed.source || "manual",
        cityId: seed.cityId || null,
        tags: JSON.stringify(normaliseTags(seed.tags || [])),
        userId: seed.userId || null,
        note: seed.note || null,
      },
    });
  }
  const tags = normaliseTags([...parseTags(existing.tags), ...(seed.tags || [])]);
  let userId = existing.userId;
  if (!userId && seed.userId) {
    const taken = await prisma.contact.findFirst({ where: { userId: seed.userId }, select: { id: true } });
    if (!taken) userId = seed.userId;
  }
  return prisma.contact.update({
    where: { id: existing.id },
    data: {
      name: existing.name || seed.name?.trim().slice(0, 120) || "",
      phone: existing.phone || seed.phone || null,
      company: existing.company || seed.company || null,
      /* A renter who signs up as a host becomes a host; nothing else moves kind. */
      kind: seed.kind === "host" && existing.kind === "renter" ? "host" : existing.kind,
      cityId: existing.cityId || seed.cityId || null,
      tags: JSON.stringify(tags),
      userId,
    },
  });
}

export async function logActivity(
  contactId: string,
  kind: string,
  subject: string,
  body = "",
  actorId: string | null = null,
) {
  return prisma.contactActivity.create({
    data: { contactId, kind, subject: subject.slice(0, 200), body: body.slice(0, 5000), actorId },
  });
}

/** Called after a public lead is stored. Best effort: a CRM hiccup must not lose the lead. */
export async function contactFromLead(lead: {
  id: string;
  kind: string;
  name: string;
  email: string;
  phone: string | null;
  cityId: string | null;
  source: string;
  campaign: string | null;
  summary: string;
}) {
  try {
    const contact = await upsertContact({
      email: lead.email,
      name: lead.name,
      phone: lead.phone,
      kind: "renter",
      source: "lead",
      cityId: lead.cityId,
      tags: [lead.source, lead.campaign ? `campaign:${lead.campaign}` : ""].filter(Boolean),
    });
    await logActivity(contact.id, "lead", `Lead: ${lead.kind}`, lead.summary);
    return contact;
  } catch (err) {
    console.error("[crm] lead → contact failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Called after an account is created. */
export async function contactFromUser(user: { id: string; email: string; name: string; role: string }, source = "signup") {
  try {
    const contact = await upsertContact({
      email: user.email,
      name: user.name,
      kind: user.role === "host" ? "host" : "renter",
      source,
      userId: user.id,
    });
    await logActivity(contact.id, "signup", `Created a ${user.role} account`);
    return contact;
  } catch (err) {
    console.error("[crm] user → contact failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export const STAGE_LABEL: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  customer: "Customer",
  lost: "Lost",
};

export const KIND_LABEL: Record<string, string> = {
  renter: "Renter",
  host: "Host",
  operator: "Operator",
  partner: "Partner",
  press: "Press",
  other: "Other",
};
