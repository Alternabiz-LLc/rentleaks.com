"use server";

import { revalidatePath } from "next/cache";
import { audit, requireAdminAction } from "@/lib/admin/guard";
import { back, field, returnTo } from "@/lib/admin/flash";
import { logActivity } from "@/lib/crm";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/site";
import { sendMail } from "@/lib/v1/mail";
import { isStage, STAGE_META, wallClock, wallLabel } from "@/lib/ops/bookings";
import { SAFETY_NOTE } from "@/lib/ops/shortlist";

type DeskResult = { ok: true; message?: string } | { ok: false; error: string };

const PATH = "/admin/bookings";
const ISO = /^\d{4}-\d{2}-\d{2}$/;

async function timeline(email: string, subject: string, body: string, actorId: string) {
  const c = await prisma.contact.findUnique({ where: { email: email.toLowerCase() }, select: { id: true } });
  if (c) await logActivity(c.id, "stage", subject, body, actorId).catch(() => undefined);
}

/** Board drag: move a booking to another stage. */
export async function moveBooking(id: string, stage: string): Promise<DeskResult> {
  const guard = await requireAdminAction("bookings");
  if (!guard.ok) return guard;
  if (!isStage(stage)) return { ok: false, error: "Unknown stage." };
  const b = await prisma.booking.findUnique({ where: { id } });
  if (!b) return { ok: false, error: "That booking no longer exists." };
  if (stage === "lost" && !b.lostReason) {
    await prisma.booking.update({ where: { id }, data: { stage, lostReason: "Moved to lost from the board" } });
  } else {
    await prisma.booking.update({ where: { id }, data: { stage } });
  }
  if (b.leadId && (stage === "signed" || stage === "moved_in")) {
    await prisma.lead.update({ where: { id: b.leadId }, data: { status: "booked" } }).catch(() => undefined);
  }
  await timeline(b.renterEmail, `Booking: ${STAGE_META[stage].label}`, "", guard.user.id);
  await audit(guard.user.id, "booking.stage", "booking", id, { from: b.stage, to: stage });
  revalidatePath(PATH);
  return { ok: true, message: `moved to ${STAGE_META[stage].label}` };
}

/** Create a booking, from a lead or by hand. */
export async function saveBooking(fd: FormData) {
  const path = returnTo(fd, PATH);
  const guard = await requireAdminAction("bookings");
  if (!guard.ok) back(path, "err", guard.error);
  const id = field(fd, "id", 60);
  const leadId = field(fd, "leadId", 60) || null;
  const lead = leadId ? await prisma.lead.findUnique({ where: { id: leadId } }) : null;
  const name = field(fd, "renterName", 120) || lead?.name || "";
  const email = (field(fd, "renterEmail", 200) || lead?.email || "").toLowerCase();
  const listingRaw = field(fd, "listingId", 200);
  const listingId = listingRaw.split(" — ")[0].trim() || lead?.listingId || null;
  const stage = isStage(field(fd, "stage", 20)) ? field(fd, "stage", 20) : "viewing";
  const viewingAt = wallClock(field(fd, "viewingAt", 16));
  const moveIn = ISO.test(field(fd, "moveIn", 10)) ? field(fd, "moveIn", 10) : lead?.moveIn ?? null;
  const moveOut = ISO.test(field(fd, "moveOut", 10)) ? field(fd, "moveOut", 10) : lead?.moveOut ?? null;
  const rent = Math.round(Number(field(fd, "monthlyAllIn", 10)) || 0) || null;
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) back(path, "err", "Add the renter's name and email.");
  if (listingId && !(await prisma.listing.findUnique({ where: { id: listingId }, select: { id: true } }))) back(path, "err", "That listing id doesn't exist — pick one from the list.");
  const listing = listingId ? await prisma.listing.findUnique({ where: { id: listingId }, select: { allIn: true, currency: true } }) : null;
  const data = {
    leadId,
    listingId,
    renterName: name,
    renterEmail: email,
    renterPhone: field(fd, "renterPhone", 40) || lead?.phone || null,
    stage,
    viewingAt,
    viewingMode: field(fd, "viewingMode", 20) || lead?.viewingMode || null,
    moveIn,
    moveOut,
    monthlyAllIn: rent ?? listing?.allIn ?? null,
    currency: listing?.currency ?? lead?.currency ?? "USD",
    note: field(fd, "note", 1000) || null,
    ownerId: guard.user.id,
  };
  const saved = id ? await prisma.booking.update({ where: { id }, data }) : await prisma.booking.create({ data });
  if (lead && lead.status === "new") await prisma.lead.update({ where: { id: lead.id }, data: { status: "contacted", contactedAt: lead.contactedAt ?? new Date() } });
  await timeline(email, id ? "Booking updated" : "Booking started", `${STAGE_META[stage as keyof typeof STAGE_META].label}${viewingAt ? ` · viewing ${wallLabel(viewingAt)}` : ""}`, guard.user.id);
  await audit(guard.user.id, id ? "booking.edit" : "booking.create", "booking", saved.id, { stage, leadId });
  revalidatePath(PATH);
  back(`${PATH}?open=${saved.id}`, "ok", id ? "Booking saved." : "Booking started. Confirm the viewing to email the renter.");
}

/** One-button emails from a booking: confirm viewing, renewal offer, lost reason. */
export async function bookingAction(fd: FormData) {
  const path = returnTo(fd, PATH);
  const guard = await requireAdminAction("bookings");
  if (!guard.ok) back(path, "err", guard.error);
  const id = field(fd, "id", 60);
  const op = field(fd, "op", 20);
  const b = await prisma.booking.findUnique({ where: { id } });
  if (!b) back(path, "err", "That booking no longer exists.");
  const listing = b.listingId ? await prisma.listing.findUnique({ where: { id: b.listingId }, select: { title: true, neighborhood: true, address: true, addressPrivacy: true, city: { select: { name: true } } } }) : null;
  const first = b.renterName.split(/\s+/)[0] || "there";
  const home = listing ? `${listing.title} (${listing.neighborhood}, ${listing.city.name})` : "the home";

  if (op === "confirm") {
    if (!b.viewingAt) back(path, "err", "Set the viewing date and time first.");
    const text = field(fd, "message", 4000);
    const mail = await sendMail({
      to: b.renterEmail,
      subject: `Viewing confirmed — ${wallLabel(b.viewingAt)}`,
      text:
        text ||
        `Hi ${first},\n\nYour ${b.viewingMode === "video" ? "live video viewing" : "viewing"} of ${home} is confirmed for ${wallLabel(b.viewingAt)} (local time).\n\n` +
          `${b.viewingMode === "video" ? "We'll send the call link shortly before." : "We'll send the exact meeting point the day before."} Need another time? Just reply.\n\n${SAFETY_NOTE}\n\nRentLeaks`,
      purpose: "personal",
    });
    if (!mail.delivered && mail.transport !== "console") back(path, "err", `Not delivered: ${mail.error ?? mail.transport}`);
    await prisma.booking.update({ where: { id }, data: { viewingConfirmedAt: new Date() } });
    await timeline(b.renterEmail, "Viewing confirmed", wallLabel(b.viewingAt), guard.user.id);
    await audit(guard.user.id, "booking.confirm", "booking", id);
    revalidatePath(PATH);
    back(path, "ok", `Viewing confirmation sent to ${b.renterEmail}.`);
  }

  if (op === "renewal") {
    const text = field(fd, "message", 4000);
    const mail = await sendMail({
      to: b.renterEmail,
      subject: `Staying on at ${listing?.title ?? "your home"}?`,
      text:
        text ||
        `Hi ${first},\n\nYour stay at ${home} ends on ${b.moveOut}. Would you like to extend? Reply with how many more months you'd like and we'll check with the host.\n\n` +
          `Moving on instead? Tell us what you need next — we'll send homes that fit.\n\nRentLeaks\n${appUrl()}`,
      purpose: "personal",
    });
    if (!mail.delivered && mail.transport !== "console") back(path, "err", `Not delivered: ${mail.error ?? mail.transport}`);
    await prisma.booking.update({ where: { id }, data: { renewalRemindedAt: new Date() } });
    await timeline(b.renterEmail, "Renewal offer sent", `Stay ends ${b.moveOut}`, guard.user.id);
    await audit(guard.user.id, "booking.renewal", "booking", id);
    revalidatePath(PATH);
    back(path, "ok", `Renewal offer sent to ${b.renterEmail}.`);
  }

  if (op === "lost") {
    const reason = field(fd, "reason", 200);
    if (reason.length < 3) back(path, "err", "Say briefly why it was lost.");
    await prisma.booking.update({ where: { id }, data: { stage: "lost", lostReason: reason } });
    await audit(guard.user.id, "booking.lost", "booking", id, { reason });
    revalidatePath(PATH);
    back(path, "ok", "Marked lost.");
  }

  if (op === "delete") {
    await prisma.booking.delete({ where: { id } });
    await audit(guard.user.id, "booking.delete", "booking", id);
    revalidatePath(PATH);
    back(PATH, "ok", "Booking deleted.");
  }
  back(path, "err", "Unknown action.");
}
