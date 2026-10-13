"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { canAccess } from "@/lib/access";
import { audit, auditedMutation, requireAdminAction } from "@/lib/admin/guard";
import { back, field, returnTo } from "@/lib/admin/flash";
import { parseMoney } from "@/lib/books/core";
import { booksToday } from "@/lib/books/data";
import { logActivity } from "@/lib/crm";
import { GUIDE, PARTNER_STATUS, ROSTER_SLOTS, SEARCH_STAGE, signatureMatches, usd, type PartnerStatus, type SearchStage } from "@/lib/network/core";
import { licenseCurrent } from "@/lib/network/core";
import { guideLink } from "@/lib/network/guides";
import {
  alertNetworkTeam,
  clientIp,
  emailPortalLink,
  freshSignerLink,
  invoiceDeal,
  matchSearch,
  NetworkError,
  networkSettings,
  nonce,
  signerLink,
  partnerMove,
  referrer,
  reportLease,
  roomLink,
  signEnvelope,
  voidEnvelope,
} from "@/lib/network/engine";
import { enqueueMail } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { setSetting, SETTING_KEYS } from "@/lib/settings";
import { sendMail } from "@/lib/v1/mail";

type DeskResult = { ok: true; message?: string } | { ok: false; error: string };

const PATH = "/admin/referrals";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const JOIN_URL = "https://rentleaks.com/hire-a-broker/agents.html";

/** Runs an engine call; a NetworkError becomes a message, anything else still throws. */
async function attempt<T>(fn: () => Promise<T>): Promise<{ ok: true; v: T } | { ok: false; error: string }> {
  try {
    return { ok: true, v: await fn() };
  } catch (e) {
    if (e instanceof NetworkError) return { ok: false, error: e.message };
    throw e;
  }
}

async function ctx() {
  const h = await headers();
  return { ip: clientIp(h), ua: h.get("user-agent") };
}

async function crm(email: string, subject: string, body: string, actorId: string) {
  const c = await prisma.contact.findUnique({ where: { email: email.toLowerCase() }, select: { id: true } }).catch(() => null);
  if (c) await logActivity(c.id, "note", subject, body, actorId).catch(() => undefined);
}

/* ------------------------------------------------------------------------
   Searches
   ------------------------------------------------------------------------ */

/** Board drag. The desk can re-run matching, record progress for a signed search, or close one. */
export async function moveSearch(id: string, to: string): Promise<DeskResult> {
  const guard = await requireAdminAction("network");
  if (!guard.ok) return guard;
  const s = await prisma.networkSearch.findUnique({ where: { id } });
  if (!s) return { ok: false, error: "That search no longer exists." };
  if (s.status === to) return { ok: true };
  const label = SEARCH_STAGE[to as SearchStage]?.label ?? to;
  if (to === "matching") {
    if (!["new", "matching", "proposals"].includes(s.status)) return { ok: false, error: "A broker is already chosen — void the agreement to reopen matching." };
    await prisma.networkSearch.update({ where: { id }, data: { status: s.status === "proposals" ? "proposals" : "matching", noMatchAt: null } });
    const made = await matchSearch(id);
    revalidatePath(PATH);
    return { ok: true, message: made ? `offered to ${made} more broker${made === 1 ? "" : "s"}` : "no other broker matches — offer it by hand from the card" };
  }
  if (to === "touring" || to === "applied") {
    if (!s.chosenPartnerId) return { ok: false, error: "No broker is attached yet." };
    const r = await attempt(() => partnerMove(s.chosenPartnerId!, id, to, null));
    if (!r.ok) return r;
    await audit(guard.user.id, "network.search.stage", "networkSearch", id, { from: s.status, to });
    revalidatePath(PATH);
    return { ok: true, message: `moved to ${label}` };
  }
  if (to === "leased") return { ok: false, error: "Open the card and record the lease — the referral fee is worked out from it." };
  return { ok: false, error: `The ${label} stage is set by the tenant, the broker or the signatures — open the card for the actions.` };
}

export async function searchAction(fd: FormData) {
  const path = returnTo(fd, PATH);
  const guard = await requireAdminAction("network");
  if (!guard.ok) back(path, "err", guard.error);
  const me = guard.user;
  const id = field(fd, "id", 60);
  const op = field(fd, "op", 20);
  const s = await prisma.networkSearch.findUnique({ where: { id } });
  if (!s) back(path, "err", "That search no longer exists.");
  const closedPath = path.replace(/([?&])open=[^&#]*&?/, "$1");
  switch (op) {
    case "note":
      await prisma.networkSearch.update({ where: { id }, data: { note: field(fd, "note", 2000) || null } });
      return back(path, "ok", "Note saved.");
    case "offer": {
      const partnerId = field(fd, "partnerId", 60);
      if (!partnerId) back(path, "err", "Pick a broker.");
      if (!["new", "matching", "proposals"].includes(s.status)) back(path, "err", "This search already has a broker.");
      const made = await matchSearch(id, new Date(), partnerId);
      if (!made) back(path, "err", "That broker can't take it — they must be active, licensed in the search's state and not already offered it.");
      await audit(me.id, "network.search.offer", "networkSearch", id, { partnerId });
      revalidatePath(PATH);
      return back(path, "ok", "Offered — they have the lead by email and in their portal.");
    }
    case "rematch": {
      if (!["new", "matching", "proposals"].includes(s.status)) back(path, "err", "This search already has a broker.");
      await prisma.networkSearch.update({ where: { id }, data: { noMatchAt: null, status: s.status === "new" ? "matching" : s.status } });
      const made = await matchSearch(id);
      revalidatePath(PATH);
      return back(path, made ? "ok" : "err", made ? `Offered to ${made} more broker${made === 1 ? "" : "s"}.` : "Nobody else matches. Offer it by hand, or recruit a partner in that market.");
    }
    case "resend": {
      const link = roomLink(s);
      const mail = await sendMail({
        to: s.email,
        subject: "Your RentLeaks broker search",
        text: `Hi ${s.name.split(" ")[0]},\n\nHere's the link to your search room — proposals, your agreement and your broker's progress are all there:\n${link}\n\n${me.name}\nRentLeaks broker network`,
        replyTo: me.email,
        purpose: "personal",
      });
      await crm(s.email, "Search room link re-sent", "", me.id);
      return back(path, mail.delivered || mail.transport === "console" ? "ok" : "err", mail.delivered ? `Sent to ${s.email}.` : (mail.error ?? "Logged — email isn't configured."));
    }
    case "reply": {
      const subject = field(fd, "subject", 200);
      const body = String(fd.get("body") ?? "").trim().slice(0, 8000);
      if (!subject || body.length < 10) back(path, "err", "Write a subject and a message.");
      const mail = await sendMail({ to: s.email, subject, text: body, replyTo: me.email, purpose: "personal" });
      if (!mail.delivered && mail.transport !== "console") back(path, "err", mail.error ?? "Not delivered.");
      await crm(s.email, subject, body, me.id);
      await audit(me.id, "network.search.reply", "networkSearch", id);
      return back(path, "ok", mail.delivered ? `Sent to ${s.email}.` : "Logged — email isn't configured, so nothing went out.");
    }
    case "lease": {
      if (!s.chosenPartnerId) back(path, "err", "No broker is attached to this search.");
      const rent = parseMoney(field(fd, "rent", 20));
      const fee = parseMoney(field(fd, "fee", 20) || "0");
      const date = field(fd, "date", 10);
      if (!rent || rent <= 0) back(path, "err", "Add the monthly rent.");
      if (fee === null || fee < 0) back(path, "err", "Add the broker fee collected (0 if none).");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) back(path, "err", "Add the lease date.");
      const r = await attempt(() => reportLease(s.chosenPartnerId!, id, { leaseSignedOn: date, monthlyRentCents: rent!, grossFeeCents: fee!, address: field(fd, "address", 200), note: `Recorded by ${me.name} from the desk. ${field(fd, "note", 300)}`.trim() }));
      if (!r.ok) back(path, "err", r.error);
      await audit(me.id, "network.search.lease", "networkSearch", id, { rent, fee });
      revalidatePath(PATH);
      return back(path, "ok", "Lease recorded — the referral fee is on the Referral fees tab.");
    }
    case "close":
      if (s.status !== "leased") back(path, "err", "Only a leased search can be closed.");
      await prisma.networkSearch.update({ where: { id }, data: { status: "closed", stageAt: new Date() } });
      await audit(me.id, "network.search.close", "networkSearch", id);
      revalidatePath(PATH);
      return back(closedPath, "ok", "Closed.");
    case "lost": {
      const reason = field(fd, "reason", 200);
      if (!reason) back(path, "err", "Say why it ended — it's how the network gets better.");
      if (["leased", "closed", "lost", "spam"].includes(s.status)) back(path, "err", "This search is already closed.");
      if (s.agreementId && s.status === "chosen") await voidEnvelope(s.agreementId, `Search ended by the desk: ${reason}`, me.id).catch(() => undefined);
      await prisma.networkOffer.updateMany({ where: { searchId: id, status: { in: ["offered", "proposed"] } }, data: { status: "withdrawn" } });
      await prisma.networkSearch.update({ where: { id }, data: { status: "lost", lostReason: reason, stageAt: new Date() } });
      await crm(s.email, "Broker search ended", reason, me.id);
      await audit(me.id, "network.search.lost", "networkSearch", id, { reason });
      revalidatePath(PATH);
      return back(path, "ok", "Marked lost.");
    }
    case "spam":
      await prisma.networkOffer.updateMany({ where: { searchId: id, status: { in: ["offered", "proposed"] } }, data: { status: "withdrawn" } });
      await prisma.networkSearch.update({ where: { id }, data: { status: "spam" } });
      await audit(me.id, "network.search.spam", "networkSearch", id);
      revalidatePath(PATH);
      return back(closedPath, "ok", "Marked as spam — the room link no longer opens.");
    case "delete": {
      if (!guard.founder) back(path, "err", "Only the account owner can delete searches.");
      const signed = await prisma.agreement.count({ where: { searchId: id, status: "completed" } });
      if (signed) back(path, "err", "This search has a signed agreement — records are kept for at least three years. Mark it lost instead.");
      await prisma.agreement.deleteMany({ where: { searchId: id } });
      await prisma.networkSearch.delete({ where: { id } });
      await audit(me.id, "network.search.delete", "networkSearch", id);
      revalidatePath(PATH);
      return back(closedPath, "ok", "Search deleted.");
    }
  }
  return back(path, "err", "Unknown action.");
}

/* ------------------------------------------------------------------------
   Partners
   ------------------------------------------------------------------------ */

export async function partnerAction(fd: FormData) {
  const path = returnTo(fd, `${PATH}?tab=partners`);
  const guard = await requireAdminAction("network");
  if (!guard.ok) back(path, "err", guard.error);
  const me = guard.user;
  const id = field(fd, "id", 60);
  const op = field(fd, "op", 20);
  const p = await prisma.networkPartner.findUnique({ where: { id } });
  if (!p) back(path, "err", "That broker no longer exists.");
  switch (op) {
    case "expiry": {
      const expiry = field(fd, "licenseExpires", 10);
      const note = field(fd, "verifyNote", 300);
      if (!expiry || !licenseCurrent(expiry, booksToday()) || note.length < 6 || field(fd, "verified", 3) !== "on") back(path, "err", "Provide a current expiry, verification note and state lookup confirmation.");
      await auditedMutation(me.id, "network.partner.license.renewed", "networkPartner", id, { previous: p.licenseExpires, expiry, note }, (tx) => tx.networkPartner.update({ where: { id, updatedAt: p.updatedAt }, data: { licenseExpires: expiry, verifyNote: note, verifiedAt: new Date(), verifiedById: me.id } }));
      revalidatePath(PATH);
      return back(path, "ok", "Licence renewal evidence saved. Account status and agreement terms are unchanged.");
    }
    case "review": {
      if (!["applied", "under_review", "verifying"].includes(p.status)) back(path, "err", "Only pending applications can enter review.");
      await auditedMutation(me.id, "network.partner.review", "networkPartner", id, { from: p.status }, (tx) => tx.networkPartner.update({ where: { id, updatedAt: p.updatedAt }, data: { status: "under_review" } }));
      revalidatePath(PATH);
      return back(path, "ok", "Application is under review.");
    }
    case "revoke-links": {
      if (field(fd, "confirm", 3) !== "on") back(path, "err", "Confirm that existing private links should stop working.");
      await auditedMutation(me.id, "network.partner.links.revoked", "networkPartner", id, {}, async (tx) => {
        await tx.networkPartner.update({ where: { id, updatedAt: p.updatedAt }, data: { portalTokenHash: nonce() } });
        const signers = await tx.agreementSigner.findMany({ where: { agreement: { partnerId: id }, role: { not: "rentleaks" } }, select: { id: true } });
        for (const signer of signers) await tx.agreementSigner.update({ where: { id: signer.id }, data: { tokenHash: nonce() } });
        await tx.notificationDelivery.updateMany({ where: { status: "queued", OR: [{ targetType: "networkPartner", targetId: id }, { targetType: "agreement", targetId: p.agreementId ?? "" }] }, data: { status: "cancelled", lastError: "links_revoked" } });
      });
      revalidatePath(PATH);
      return back(path, "ok", "Old private links revoked. Send fresh links separately if appropriate.");
    }
    case "countersign": {
      if (!licenseCurrent(p.licenseExpires, booksToday())) back(path, "err", "Update the expired licence before countersigning.");
      if (!guard.founder && !canAccess(me, "network")) back(path, "err", "You can't sign for RentLeaks.");
      const ref = await referrer();
      if (!ref.complete) back(path, "err", "Add the RentLeaks broker name, licence, states and a phone or address (Enterprise → Packages & licence) before countersigning.");
      if (field(fd, "verified", 3) !== "on") back(path, "err", "Confirm you checked the licence with the state first.");
      const note = field(fd, "verifyNote", 300);
      if (note.length < 6) back(path, "err", "Note what you checked (e.g. “DOS lookup: active, expires 2027-05, sponsor matches”).");
      if (!p.agreementId) back(path, "err", "This broker has no agreement to countersign.");
      const signer = await prisma.agreementSigner.findFirst({ where: { agreementId: p.agreementId!, role: "rentleaks" } });
      if (!signer) back(path, "err", "The agreement has no RentLeaks signature line.");
      const typed = field(fd, "typedName", 120);
      // Whoever countersigns is the person on the RentLeaks line.
      if (!signatureMatches(typed, me.name)) back(path, "err", `Type your full name as it appears on your account: ${me.name}.`);
      const r = await attempt(async () => signEnvelope(signer!.id, { typedName: typed, drawn: field(fd, "drawn", 180_000) || null, consent: field(fd, "consent", 3) === "on", readIt: true, actorId: me.id, verificationNote: note }, await ctx()));
      if (!r.ok) back(path, "err", r.error);
      revalidatePath(PATH);
      return back(path, "ok", r.ok && r.v.status === "completed" ? `${p.name} is verified and active — their portal link is on its way.` : "Signed — waiting on the other signers.");
    }
    case "pause":
      if (p.status !== "active") back(path, "err", "Only an active broker can be paused.");
      await auditedMutation(me.id, "network.partner.pause", "networkPartner", id, { from: p.status }, async (tx) => {
        await tx.networkPartner.update({ where: { id, updatedAt: p.updatedAt }, data: { status: "paused", suspendedAt: new Date(), suspendedById: me.id } });
        await tx.networkOffer.updateMany({ where: { partnerId: id, status: "offered" }, data: { status: "withdrawn" } });
      });
      revalidatePath(PATH);
      return back(path, "ok", "Paused — no new leads until you resume.");
    case "activate": {
      if (!licenseCurrent(p.licenseExpires, booksToday())) back(path, "err", "Update the expired licence before reactivating.");
      if (p.status !== "paused") back(path, "err", "Only a paused broker can be resumed — new brokers become active when their agreement is countersigned.");
      const env = p.agreementId ? await prisma.agreement.findUnique({ where: { id: p.agreementId } }) : null;
      if (env?.status !== "completed" || !p.verifiedAt || (p.mailboxGateAt && !p.emailVerifiedAt)) back(path, "err", "Their verification and referral agreement must be complete.");
      await auditedMutation(me.id, "network.partner.activate", "networkPartner", id, { from: p.status }, (tx) => tx.networkPartner.update({ where: { id, updatedAt: p.updatedAt }, data: { status: "active", suspendedAt: null, suspendedById: null } }));
      revalidatePath(PATH);
      return back(path, "ok", "Active again.");
    }
    case "reject": {
      const reason = field(fd, "reason", 300);
      if (reason.length < 4) back(path, "err", "Say why (it goes in the email).");
      await auditedMutation(me.id, "network.partner.reject", "networkPartner", id, { reason, from: p.status }, async (tx) => {
        if (p.agreementId) {
          const changed = await tx.agreement.updateMany({ where: { id: p.agreementId, status: { in: ["sent", "partial"] } }, data: { status: "voided", voidedAt: new Date(), voidReason: `Application declined: ${reason}` } });
          if (changed.count) await tx.agreementEvent.create({ data: { agreementId: p.agreementId, type: "voided", detail: "Application declined by authorized desk" } });
        }
        await tx.networkPartner.update({ where: { id, updatedAt: p.updatedAt }, data: { status: "rejected", verifyNote: reason, portalTokenHash: null } });
        await tx.networkOffer.updateMany({ where: { partnerId: id, status: { in: ["offered", "proposed"] } }, data: { status: "withdrawn" } });
        await enqueueMail({ to: p.email, subject: "Your RentLeaks broker network application", text: `Hi ${p.name.split(" ")[0]},\n\nWe can't add you to the network right now: ${reason}\n\nIf something changes, reply to the team.\n\n${me.name}\nRentLeaks`, replyTo: me.email, purpose: "personal" }, { key: `rejection:${id}:${p.updatedAt.toISOString()}`, targetType: "networkPartner", targetId: id }, tx);
      });
      revalidatePath(PATH);
      return back(path, "ok", "Declined — notification queued.");
    }
    case "terms": {
      const pct = Number(field(fd, "pct", 6));
      const cap = Number(field(fd, "capacity", 3));
      if (!Number.isFinite(pct) || pct < 1 || pct > 60) back(path, "err", "Referral % must be between 1 and 60.");
      if (!Number.isInteger(cap) || cap < 1 || cap > 50) back(path, "err", "Capacity must be 1–50 open clients.");
      const bp = Math.round(pct * 100);
      // A signed agreement fixes the referral %: changing it needs a new agreement, so only capacity changes then.
      const env = p.agreementId ? await prisma.agreement.findUnique({ where: { id: p.agreementId }, select: { status: true } }) : null;
      if (bp !== p.referralPctBp && env?.status === "completed") back(path, "err", "The referral % is fixed by their signed agreement. Capacity can change; for a new %, void and re-send the agreement.");
      await auditedMutation(me.id, "network.partner.terms", "networkPartner", id, { bp, cap }, (tx) => tx.networkPartner.update({ where: { id, updatedAt: p.updatedAt }, data: { referralPctBp: bp, capacity: cap } }));
      revalidatePath(PATH);
      return back(path, "ok", "Saved.");
    }
    case "note":
      await auditedMutation(me.id, "network.partner.note", "networkPartner", id, {}, (tx) => tx.networkPartner.update({ where: { id, updatedAt: p.updatedAt }, data: { verifyNote: field(fd, "verifyNote", 300) || null } }));
      return back(path, "ok", "Note saved.");
    case "feature": {
      if (p.status !== "active") back(path, "err", "Only an active broker can appear on the public page.");
      if (!p.photoAt) back(path, "err", "They need a headshot first — ask them to add one in their portal.");
      const featured = await prisma.networkPartner.count({ where: { status: "active", featuredAt: { not: null }, photoAt: { not: null }, NOT: { id } } });
      if (featured >= ROSTER_SLOTS) back(path, "err", `All ${ROSTER_SLOTS} pinned slots are taken — unpin someone first.`);
      await auditedMutation(me.id, "network.partner.feature", "networkPartner", id, {}, (tx) => tx.networkPartner.update({ where: { id, updatedAt: p.updatedAt }, data: { featuredAt: new Date() } }));
      revalidatePath(PATH);
      return back(path, "ok", `${p.name} is pinned to the public roster.`);
    }
    case "unfeature":
      await auditedMutation(me.id, "network.partner.unfeature", "networkPartner", id, {}, (tx) => tx.networkPartner.update({ where: { id, updatedAt: p.updatedAt }, data: { featuredAt: null } }));
      revalidatePath(PATH);
      return back(path, "ok", "Unpinned — they can still appear if a slot is free.");
    case "headline":
      await auditedMutation(me.id, "network.partner.headline", "networkPartner", id, {}, (tx) => tx.networkPartner.update({ where: { id, updatedAt: p.updatedAt }, data: { headline: field(fd, "headline", 140) || null } }));
      revalidatePath(PATH);
      return back(path, "ok", "Headline saved.");
    case "photo-remove":
      if (!p.photoAt) back(path, "err", "They have no headshot.");
      await auditedMutation(me.id, "network.partner.photo.remove", "networkPartner", id, {}, (tx) => tx.networkPartner.update({ where: { id, updatedAt: p.updatedAt }, data: { photoData: null, photoType: null, photoAt: null, featuredAt: null } }));
      revalidatePath(PATH);
      return back(path, "ok", "Headshot removed from the public page.");
    case "portal":
      if (p.status !== "active" && p.status !== "paused") back(path, "err", "The portal opens once they're verified.");
      await emailPortalLink(p.email);
      await audit(me.id, "network.partner.portal", "networkPartner", id);
      return back(path, "ok", `Portal link queued for ${p.email}.`);
    case "resign": {
      if (!p.agreementId) back(path, "err", "No agreement to sign.");
      const next = await prisma.agreementSigner.findFirst({ where: { agreementId: p.agreementId!, status: { in: ["pending", "viewed"] }, role: { not: "rentleaks" } }, orderBy: { order: "asc" } });
      if (!next) back(path, "err", "Nobody outside RentLeaks is waiting to sign.");
      await auditedMutation(me.id, "network.partner.resend", "networkPartner", id, {}, async (tx) => {
        const signer = await tx.agreementSigner.update({ where: { id: next!.id }, data: { tokenHash: nonce() } });
        await enqueueMail({ to: signer.email, subject: "Please sign — RentLeaks referral partner agreement", text: `Hi ${signer.name.split(" ")[0]},\n\nYour fresh signing link:\n${signerLink(signer)}\n\n${me.name}\nRentLeaks`, replyTo: me.email, purpose: "personal" }, { key: `signer:${signer.id}:${signer.tokenHash}`, targetType: "agreement", targetId: p.agreementId! }, tx);
        await tx.agreementEvent.create({ data: { agreementId: p.agreementId!, signerId: signer.id, type: "notification_queued", detail: "Fresh signing invitation queued by desk" } });
      });
      return back(path, "ok", "Fresh signing link queued for email.");
    }
    case "delete": {
      if (!guard.founder) back(path, "err", "Only the account owner can delete a broker.");
      const deals = await prisma.networkDeal.count({ where: { partnerId: id } });
      const signed = await prisma.agreement.count({ where: { partnerId: id, status: "completed" } });
      if (deals || signed) back(path, "err", "This broker has signed agreements or deals — keep the record and decline or pause them instead.");
      await auditedMutation(me.id, "network.partner.delete", "networkPartner", id, {}, async (tx) => {
        if (await tx.networkDeal.count({ where: { partnerId: id } }) || await tx.agreement.count({ where: { partnerId: id, status: "completed" } })) throw new NetworkError("This record now has signed agreements or deals; keep it.");
        await tx.agreement.deleteMany({ where: { partnerId: id } });
        await tx.networkPartner.delete({ where: { id, updatedAt: p.updatedAt } });
      });
      revalidatePath(PATH);
      return back(`${PATH}?tab=partners`, "ok", "Deleted.");
    }
  }
  return back(path, "err", "Unknown action.");
}

/** Invite a broker to apply: a personal email with the join page. */
export async function invitePartner(fd: FormData) {
  const path = returnTo(fd, `${PATH}?tab=partners`);
  const guard = await requireAdminAction("network");
  if (!guard.ok) back(path, "err", guard.error);
  const email = field(fd, "email", 200).toLowerCase();
  const name = field(fd, "name", 80);
  const market = field(fd, "market", 80);
  if (!EMAIL.test(email)) back(path, "err", "Add a valid email.");
  const exists = await prisma.networkPartner.findUnique({ where: { email }, select: { status: true } });
  if (exists && exists.status !== "rejected") back(path, "err", `They're already in the network (${PARTNER_STATUS[exists.status as PartnerStatus]?.label ?? exists.status}).`);
  const s = await networkSettings();
  const mail = await sendMail({
    to: email,
    subject: `Tenant leads${market ? ` in ${market}` : ""} — join the RentLeaks broker network`,
    text:
      `Hi${name ? ` ${name.split(" ")[0]}` : ""},\n\nRentLeaks connects renters who want to hire a broker with licensed agents in their area. ` +
      `Leads come with a budget, a move-in date and the fee the renter will pay; you accept with your fee and a short pitch, the renter picks, and your fee agreement is signed in the app.\n\n` +
      `No sign-up fee — your brokerage pays a ${s.referralPctBp / 100}% referral fee only when a lease is signed.\n\nApply in two minutes: ${JOIN_URL}${market ? `?market=${encodeURIComponent(market)}` : ""}\n\n${guard.user.name}\nRentLeaks`,
    replyTo: guard.user.email,
    purpose: "personal",
  });
  await audit(guard.user.id, "network.partner.invite", "networkPartner", email, { market });
  return back(path, mail.delivered || mail.transport === "console" ? "ok" : "err", mail.delivered ? `Invitation sent to ${email}.` : (mail.error ?? "Logged — email isn't configured."));
}

/* ------------------------------------------------------------------------
   Agreements
   ------------------------------------------------------------------------ */

export async function agreementAction(fd: FormData) {
  const path = returnTo(fd, `${PATH}?tab=agreements`);
  const guard = await requireAdminAction("network");
  if (!guard.ok) back(path, "err", guard.error);
  const id = field(fd, "id", 60);
  const op = field(fd, "op", 20);
  const env = await prisma.agreement.findUnique({ where: { id }, include: { signers: { orderBy: { order: "asc" } } } });
  if (!env) back(path, "err", "That agreement no longer exists.");
  if (op === "void") {
    const reason = field(fd, "reason", 300);
    if (reason.length < 4) back(path, "err", "Say why it's being voided — it goes on the audit trail.");
    if (env!.status === "completed" && !guard.founder) back(path, "err", "Only the account owner can void a completed agreement.");
    const r = await attempt(() => voidEnvelope(id, reason, guard.user.id));
    if (!r.ok) back(path, "err", r.error);
    if (env!.kind === "partner_referral" && env!.partnerId) {
      const p = await prisma.networkPartner.findUnique({ where: { id: env!.partnerId } });
      if (p && p.agreementId === id && p.status !== "rejected") await prisma.networkPartner.update({ where: { id: p.id }, data: { status: p.status === "active" ? "paused" : "applied" } });
    }
    await audit(guard.user.id, "network.agreement.void", "agreement", id, { reason, was: env!.status });
    revalidatePath(PATH);
    return back(path, "ok", "Voided — every party's link now shows it as voided.");
  }
  if (op === "remind") {
    if (env!.status !== "sent" && env!.status !== "partial") back(path, "err", "Nobody is waiting to sign.");
    const next = env!.signers.find((s) => s.status !== "signed");
    if (!next) back(path, "err", "Nobody is waiting to sign.");
    if (next!.role === "rentleaks") back(path, "err", "It's waiting on RentLeaks — countersign it from the Partners tab.");
    const link = await freshSignerLink(next!.id);
    await sendMail({ to: next!.email, subject: `Reminder: please sign — ${env!.title}`, text: `Hi ${next!.name.split(" ")[0]},\n\nThis agreement is waiting for your signature (open until ${env!.expiresAt.toISOString().slice(0, 10)}):\n${link}\n\n${guard.user.name}\nRentLeaks`, replyTo: guard.user.email, purpose: "personal" }).catch(() => null);
    await prisma.agreementSigner.update({ where: { id: next!.id }, data: { remindedAt: new Date(), reminders: { increment: 1 } } });
    await prisma.agreementEvent.create({ data: { agreementId: id, signerId: next!.id, type: "reminded", detail: `${next!.email} (from the desk)` } });
    return back(path, "ok", `Reminder sent to ${next!.email}.`);
  }
  if (op === "extend") {
    if (env!.status !== "sent" && env!.status !== "partial") back(path, "err", "Only an open agreement can be extended.");
    const days = Math.min(30, Math.max(1, Number(field(fd, "days", 3)) || 7));
    const expiresAt = new Date(Math.max(env!.expiresAt.getTime(), Date.now()) + days * 86_400_000);
    await prisma.agreement.update({ where: { id }, data: { expiresAt } });
    await prisma.agreementEvent.create({ data: { agreementId: id, type: "sent", detail: `Signing window extended to ${expiresAt.toISOString().slice(0, 10)} by the desk` } });
    await audit(guard.user.id, "network.agreement.extend", "agreement", id, { days });
    revalidatePath(PATH);
    return back(path, "ok", `Open until ${expiresAt.toISOString().slice(0, 10)}.`);
  }
  return back(path, "err", "Unknown action.");
}

/* ------------------------------------------------------------------------
   Referral fees
   ------------------------------------------------------------------------ */

export async function dealAction(fd: FormData) {
  const path = returnTo(fd, `${PATH}?tab=fees`);
  const guard = await requireAdminAction("network");
  if (!guard.ok) back(path, "err", guard.error);
  const me = guard.user;
  const id = field(fd, "id", 60);
  const op = field(fd, "op", 20);
  const d = await prisma.networkDeal.findUnique({ where: { id } });
  if (!d) back(path, "err", "That deal no longer exists.");
  switch (op) {
    case "invoice": {
      if (!canAccess(me, "books")) back(path, "err", "Invoices live in Books — ask someone with Books access.");
      const r = await attempt(() => invoiceDeal(id, me.id));
      if (!r.ok) back(path, "err", r.error);
      await audit(me.id, "network.deal.invoice", "networkDeal", id, { invoiceId: r.ok ? r.v : "" });
      revalidatePath(PATH);
      return back(path, "ok", "Draft invoice created in Books — review and send it from there.");
    }
    case "fix": {
      if (d!.status !== "reported" && d!.status !== "disputed") back(path, "err", "It's already invoiced — change the invoice in Books instead.");
      const fee = parseMoney(field(fd, "fee", 20));
      if (fee === null || fee < 0) back(path, "err", "Add the fee the brokerage collected.");
      const due = Math.round((fee! * d!.referralPctBp) / 10_000);
      await auditedMutation(me.id, "network.deal.fix", "networkDeal", id, { from: d!.grossFeeCents, to: fee }, async (tx) => {
        await tx.networkDeal.update({ where: { id, updatedAt: d!.updatedAt }, data: { grossFeeCents: fee!, referralDueCents: due, status: "reported", note: `${d!.note}\nCorrected by ${me.name} on ${booksToday()}: fee ${usd(d!.grossFeeCents)} → ${usd(fee!)}`.trim().slice(0, 500) } });
      });
      revalidatePath(PATH);
      return back(path, "ok", `Corrected — referral due is now ${usd(due)}.`);
    }
    case "dispute": {
      const reason = field(fd, "reason", 300);
      if (!reason) back(path, "err", "Say what's in dispute.");
      await auditedMutation(me.id, "network.deal.dispute", "networkDeal", id, { reason }, async (tx) => {
        await tx.networkDeal.update({ where: { id, updatedAt: d!.updatedAt }, data: { status: "disputed", note: `${d!.note}\nDisputed: ${reason}`.trim().slice(0, 500) } });
      });
      await alertNetworkTeam("Referral fee disputed", `${reason}\n/admin/referrals?tab=fees`);
      revalidatePath(PATH);
      return back(path, "ok", "Marked disputed.");
    }
    case "waive": {
      if (!guard.founder) back(path, "err", "Only the account owner can waive a referral fee.");
      const reason = field(fd, "reason", 300);
      if (!reason) back(path, "err", "Say why it's waived.");
      if (d!.status === "paid") back(path, "err", "It's already paid.");
      await auditedMutation(me.id, "network.deal.waive", "networkDeal", id, { reason }, async (tx) => {
        if (d!.invoiceId) {
          const invoice = await tx.invoice.findUnique({ where: { id: d!.invoiceId } });
          if (invoice?.status === "paid") throw new Error("The invoice is already paid; reconcile it in Books before waiving this fee.");
          await tx.invoice.updateMany({ where: { id: d!.invoiceId, status: { in: ["draft", "sent", "overdue"] } }, data: { status: "void" } });
        }
        await tx.networkDeal.update({ where: { id, updatedAt: d!.updatedAt }, data: { status: "waived", note: `${d!.note}\nWaived: ${reason}`.trim().slice(0, 500) } });
      });
      revalidatePath(PATH);
      return back(path, "ok", "Waived.");
    }
  }
  return back(path, "err", "Unknown action.");
}

/* ------------------------------------------------------------------------
   Settings
   ------------------------------------------------------------------------ */

export async function networkSettingsAction(fd: FormData) {
  const path = returnTo(fd, `${PATH}?tab=settings`);
  const guard = await requireAdminAction("network");
  if (!guard.ok) back(path, "err", guard.error);
  if (!guard.founder) back(path, "err", "Only the account owner can change the network's terms.");
  const n = (k: string, lo: number, hi: number, label: string) => {
    const v = Number(field(fd, k, 8));
    if (!Number.isFinite(v) || v < lo || v > hi) back(path, "err", `${label} must be between ${lo} and ${hi}.`);
    return String(v);
  };
  const values: Array<[keyof typeof SETTING_KEYS, string]> = [
    ["netReferralPct", n("referralPct", 1, 60, "Referral %")],
    ["netOfferHours", n("offerHours", 2, 96, "Hours to answer")],
    ["netOffersPerSearch", n("offersPerSearch", 1, 6, "Brokers per search")],
    ["netSignDays", n("signDays", 3, 60, "Days to sign")],
    ["netTermDays", n("termDays", 30, 365, "Agreement term")],
    ["netOpen", field(fd, "open", 3) === "on" ? "on" : "off"],
  ];
  for (const [k, v] of values) await setSetting(SETTING_KEYS[k], v);
  await audit(guard.user.id, "network.settings", "setting", "net", Object.fromEntries(values));
  revalidatePath(PATH);
  return back(path, "ok", "Saved. New terms apply to new applications and agreements — signed ones keep theirs.");
}


/* ------------------------------------------------------------------------
   Guide leads (the lead magnets)
   ------------------------------------------------------------------------ */

export async function guideAction(fd: FormData) {
  const path = returnTo(fd, `${PATH}?tab=guides`);
  const guard = await requireAdminAction("network");
  if (!guard.ok) back(path, "err", guard.error);
  const me = guard.user;
  const id = field(fd, "id", 60);
  const op = field(fd, "op", 20);
  const lead = await prisma.guideLead.findUnique({ where: { id } });
  if (!lead) back(path, "err", "That lead no longer exists.");
  const guide = GUIDE.get(lead!.guideId);
  switch (op) {
    case "note":
      await prisma.guideLead.update({ where: { id }, data: { note: field(fd, "note", 1000) || null } });
      return back(path, "ok", "Note saved.");
    case "mine":
      await prisma.guideLead.update({ where: { id }, data: { assignedToId: me.id } });
      return back(path, "ok", "It's yours.");
    case "contacted":
      await prisma.guideLead.update({ where: { id }, data: { status: lead!.status === "new" ? "contacted" : lead!.status, contactedAt: lead!.contactedAt ?? new Date() } });
      await crm(lead!.email, "Guide follow-up: called", "", me.id);
      revalidatePath(PATH);
      return back(path, "ok", "Marked as contacted.");
    case "converted":
      await prisma.guideLead.update({ where: { id }, data: { status: "converted", contactedAt: lead!.contactedAt ?? new Date() } });
      await audit(me.id, "network.guide.converted", "guideLead", id);
      revalidatePath(PATH);
      return back(path, "ok", "Marked converted — nice one.");
    case "closed":
      await prisma.guideLead.update({ where: { id }, data: { status: "closed", note: field(fd, "reason", 300) || lead!.note } });
      revalidatePath(PATH);
      return back(path, "ok", "Closed.");
    case "spam":
      await prisma.guideLead.update({ where: { id }, data: { status: "spam" } });
      await audit(me.id, "network.guide.spam", "guideLead", id);
      revalidatePath(PATH);
      return back(path.replace(/([?&])lead=[^&#]*&?/, "$1"), "ok", "Marked as spam — their link stops working.");
    case "resend": {
      const mail = await sendMail({
        to: lead!.email,
        subject: `${guide?.title ?? "Your guide"} — your copy`,
        text: `Hi ${lead!.name.split(" ")[0]},\n\nHere's your copy again:\n${guideLink(lead!)}\n\n${me.name}\nRentLeaks broker network`,
        replyTo: me.email,
        purpose: "personal",
      });
      if (mail.delivered) await prisma.guideLead.update({ where: { id }, data: { sentAt: new Date() } });
      return back(path, mail.delivered || mail.transport === "console" ? "ok" : "err", mail.delivered ? `Sent to ${lead!.email}.` : (mail.error ?? "Logged — email isn't configured."));
    }
    case "reply": {
      const subject = field(fd, "subject", 200);
      const body = String(fd.get("body") ?? "").trim().slice(0, 8000);
      if (!subject || body.length < 10) back(path, "err", "Write a subject and a message.");
      const mail = await sendMail({ to: lead!.email, subject, text: body, replyTo: me.email, purpose: "personal" });
      if (!mail.delivered && mail.transport !== "console") back(path, "err", mail.error ?? "Not delivered.");
      await prisma.guideLead.update({ where: { id }, data: { status: lead!.status === "new" ? "contacted" : lead!.status, contactedAt: lead!.contactedAt ?? new Date() } });
      await crm(lead!.email, subject, body, me.id);
      await audit(me.id, "network.guide.reply", "guideLead", id);
      revalidatePath(PATH);
      return back(path, "ok", mail.delivered ? `Sent to ${lead!.email}.` : "Logged — email isn't configured, so nothing went out.");
    }
    case "delete":
      if (!guard.founder) back(path, "err", "Only the account owner can delete a lead.");
      await prisma.guideLead.delete({ where: { id } });
      await audit(me.id, "network.guide.delete", "guideLead", id);
      revalidatePath(PATH);
      return back(`${PATH}?tab=guides`, "ok", "Deleted.");
  }
  return back(path, "err", "Unknown action.");
}
