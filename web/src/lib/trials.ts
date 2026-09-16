/**
 * Free listing trials by invitation.
 *
 * The founder invites a host (or a batch of them) to list free for `days`
 * days. The email carries a link to /invite/<code>; opening it and creating
 * an account — or signing in — sets User.trialEndsAt and marks the invite
 * redeemed. One redemption per invite; an expired or revoked code does
 * nothing.
 */
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/site";
import { contactFromUser, logActivity, upsertContact } from "@/lib/crm";
import { mergeFields, renderEmail, textToPlain } from "@/lib/marketing";
import { getSetting, SETTING_KEYS } from "@/lib/settings";
import { sendMail } from "@/lib/v1/mail";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const INVITE_VALID_DAYS = 30;

export function inviteCode(length = 10) {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function normaliseCode(code: string) {
  return String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
}

export function inviteLink(code: string) {
  return `${appUrl()}/invite/${code}`;
}

export const DEFAULT_TRIAL_SUBJECT = "{{first_name}}, list your place on RentLeaks free for {{days}} days";
export const DEFAULT_TRIAL_BODY = `Hi {{first_name}},

I'm Yves, founder of RentLeaks — a marketplace for rooms, co-living, furnished and 1-month+ homes where every price is shown all-in.

I'd like to invite you to list with us **free for your first {{days}} days**. No card needed to start:

- One listing page with photos, all-in price and your dates
- Viewing and booking requests sent straight to you
- No deposits or rent ever pass through us

[Claim your free trial]({{invite_link}})

The link is personal and valid for 30 days. Reply to this email if you have any questions.

Yves
RentLeaks`;

export type InviteStatus = "pending" | "sent" | "redeemed" | "expired" | "revoked";

export function inviteState(inv: { status: string; expiresAt: Date }, now = new Date()): InviteStatus {
  if (inv.status === "redeemed" || inv.status === "revoked") return inv.status;
  if (inv.expiresAt < now) return "expired";
  return inv.status === "sent" ? "sent" : "pending";
}

export async function createInvite(input: { email: string; name?: string; days?: number; note?: string; createdById?: string }) {
  const email = input.email.trim().toLowerCase();
  const days = Math.min(90, Math.max(1, Math.round(input.days ?? 7)));
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.trialInvite.create({
        data: {
          code: inviteCode(),
          email,
          name: input.name?.trim().slice(0, 120) || "",
          days,
          note: input.note?.trim().slice(0, 500) || null,
          expiresAt: new Date(Date.now() + INVITE_VALID_DAYS * 86_400_000),
          createdById: input.createdById || null,
        },
      });
    } catch (err) {
      if (attempt === 4) throw err;
    }
  }
  throw new Error("Could not create an invite code.");
}

export async function sendInvite(
  invite: { id: string; code: string; email: string; name: string; days: number },
  template?: { subject: string; body: string },
  actorId?: string,
) {
  const address = await getSetting(SETTING_KEYS.mailingAddress, "");
  const data = {
    days: invite.days,
    name: invite.name,
    email: invite.email,
    invite_link: inviteLink(invite.code),
    app_url: appUrl(),
  };
  const subject = mergeFields(template?.subject || DEFAULT_TRIAL_SUBJECT, data);
  const bodyText = mergeFields(template?.body || DEFAULT_TRIAL_BODY, data);
  const { text, html } = renderEmail(bodyText, {
    address: address || "RentLeaks",
    reason: "You received this personal invitation from the RentLeaks founder.",
  });
  const result = await sendMail({ to: invite.email, subject, text, html, purpose: "personal" });
  if (result.delivered || result.transport === "console") {
    await prisma.trialInvite.update({ where: { id: invite.id }, data: { status: "sent", sentAt: new Date() } });
  }
  try {
    const contact = await upsertContact({ email: invite.email, name: invite.name, kind: "host", source: "invite", tags: ["trial-invite"] });
    await logActivity(
      contact.id,
      "trial",
      `Free ${invite.days}-day trial invite ${result.delivered ? "sent" : "not delivered"}`,
      result.error || textToPlain(bodyText).slice(0, 600),
      actorId ?? null,
    );
  } catch {
    /* CRM is best effort */
  }
  return result;
}

export async function findUsableInvite(code: string) {
  const invite = await prisma.trialInvite.findUnique({ where: { code: normaliseCode(code) } });
  if (!invite) return { ok: false as const, reason: "That invitation code doesn't exist." };
  const state = inviteState(invite);
  if (state === "redeemed") return { ok: false as const, reason: "This invitation has already been used.", invite };
  if (state === "revoked") return { ok: false as const, reason: "This invitation was withdrawn.", invite };
  if (state === "expired") return { ok: false as const, reason: "This invitation has expired. Reply to the email for a new one.", invite };
  return { ok: true as const, invite };
}

/** Applies the trial to an account. Extends an existing trial rather than shortening it. */
export async function redeemInvite(code: string, user: { id: string; email: string; name: string; role: string; trialEndsAt?: Date | null }) {
  const found = await findUsableInvite(code);
  if (!found.ok) return found;
  const invite = found.invite;
  const base = user.trialEndsAt && user.trialEndsAt > new Date() ? user.trialEndsAt : new Date();
  const trialEndsAt = new Date(base.getTime() + invite.days * 86_400_000);
  const claimed = await prisma.trialInvite.updateMany({
    where: { id: invite.id, status: { in: ["pending", "sent"] } },
    data: { status: "redeemed", redeemedAt: new Date(), userId: user.id },
  });
  if (claimed.count !== 1) return { ok: false as const, reason: "This invitation has already been used." };
  await prisma.user.update({
    where: { id: user.id },
    data: { trialEndsAt, ...(user.role === "renter" ? { role: "host" } : {}) },
  });
  const contact = await contactFromUser({ ...user, role: user.role === "renter" ? "host" : user.role }, "invite");
  if (contact) {
    await prisma.contact.update({ where: { id: contact.id }, data: { stage: "customer" } }).catch(() => undefined);
    await logActivity(contact.id, "trial", `Redeemed a ${invite.days}-day free trial`, `Trial ends ${trialEndsAt.toISOString().slice(0, 10)}`);
  }
  return { ok: true as const, trialEndsAt, days: invite.days };
}
