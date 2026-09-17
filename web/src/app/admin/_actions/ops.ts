"use server";

import { revalidatePath } from "next/cache";
import { audit, requireAdminAction } from "@/lib/admin/guard";
import { back, field, fields, returnTo } from "@/lib/admin/flash";
import { logActivity } from "@/lib/crm";
import { prisma } from "@/lib/prisma";
import { setSetting, SETTING_KEYS } from "@/lib/settings";
import { appUrl } from "@/lib/site";
import { sendMail } from "@/lib/v1/mail";
import { auditListing } from "@/lib/ops/catalogue";
import { askFreshness } from "@/lib/ops/freshness";
import { sendShortlist } from "@/lib/ops/shortlist";

/* ---- Match & Send --------------------------------------------------------- */

export async function sendShortlistAction(fd: FormData) {
  const path = returnTo(fd, "/admin/match");
  const guard = await requireAdminAction("leads");
  if (!guard.ok) back(path, "err", guard.error);
  const leadId = field(fd, "leadId", 60);
  const ids = fields(fd, "listingIds").slice(0, 8);
  const subject = field(fd, "subject", 200);
  const body = field(fd, "body", 8000);
  if (!ids.length) back(path, "err", "Tick at least one home.");
  if (subject.length < 3 || body.length < 10) back(path, "err", "Add a subject and a message.");
  const r = await sendShortlist({ leadId, listingIds: ids, subject, body, actorId: guard.user.id });
  if (!r.ok) back(path, "err", r.error);
  await audit(guard.user.id, "lead.shortlist", "lead", leadId, { homes: ids.length });
  revalidatePath("/admin/match");
  const next = field(fd, "nextLead", 60);
  back(
    `/admin/match${next ? `?lead=${next}` : ""}`,
    "ok",
    r.mail.transport === "console" ? `Shortlist recorded (${r.count} homes). Email isn't configured, so nothing was sent — see System.` : `Shortlist of ${r.count} home${r.count === 1 ? "" : "s"} sent.`,
  );
}

/* ---- Trust Radar ------------------------------------------------------------ */

export async function trustAction(fd: FormData) {
  const path = returnTo(fd, "/admin/trust");
  const guard = await requireAdminAction("trust");
  if (!guard.ok) back(path, "err", guard.error);
  const op = field(fd, "op", 20);
  const signal = field(fd, "signal", 300);
  const listingIds = fields(fd, "listingIds").slice(0, 20);
  const userIds = fields(fd, "userIds").slice(0, 10);
  const note = field(fd, "note", 300);
  /* When the card offers checkboxes, only the ticked items are touched. */
  const picking = field(fd, "picking", 1) === "1";
  const pickedListings = picking && listingIds.length > 1 ? fields(fd, "pick").filter((id) => listingIds.includes(id)) : listingIds;
  const pickedUsers = picking && userIds.length > 1 ? fields(fd, "pickUser").filter((id) => userIds.includes(id)) : userIds;

  if (op === "dismiss") {
    if (!signal) back(path, "err", "Nothing to dismiss.");
    await prisma.trustDismissal.upsert({ where: { signal }, update: { note, byId: guard.user.id }, create: { signal, note, byId: guard.user.id } });
    await audit(guard.user.id, "trust.dismiss", "signal", signal.slice(0, 120), { note });
    revalidatePath("/admin/trust");
    back(path, "ok", "Cleared. This signal won't come back unless something changes.");
  }
  if (op === "pause") {
    const ids = pickedListings;
    if (!ids.length) back(path, "err", "Tick the listing to pause.");
    const r = await prisma.listing.updateMany({ where: { id: { in: ids } }, data: { status: "paused", moderation: "pending", moderationNote: note || "Paused by Trust Radar for review" } });
    await audit(guard.user.id, "trust.pause", "listing", ids.join(","), { signal, note });
    revalidatePath("/admin", "layout");
    back(path, "ok", `${r.count} listing${r.count === 1 ? "" : "s"} paused and sent back to review.`);
  }
  if (op === "suspend") {
    const ids = pickedUsers;
    if (!ids.length) back(path, "err", "Tick the account to suspend.");
    if (note.length < 4) back(path, "err", "Add a short reason for the suspension.");
    const targets = await prisma.user.findMany({ where: { id: { in: ids }, role: { notIn: ["admin", "staff"] } }, select: { id: true } });
    if (!targets.length) back(path, "err", "No account to suspend (desk accounts are never suspended from here).");
    const tIds = targets.map((u) => u.id);
    await prisma.$transaction([
      prisma.user.updateMany({ where: { id: { in: tIds } }, data: { suspendedAt: new Date(), suspendReason: note } }),
      prisma.session.deleteMany({ where: { userId: { in: tIds } } }),
      prisma.listing.updateMany({ where: { hostId: { in: tIds } }, data: { status: "paused" } }),
    ]);
    await audit(guard.user.id, "trust.suspend", "user", tIds.join(","), { signal, note });
    revalidatePath("/admin", "layout");
    back(path, "ok", `${tIds.length} account${tIds.length === 1 ? "" : "s"} suspended, signed out, listings paused.`);
  }
  if (op === "warn") {
    if (!pickedUsers.length) back(path, "err", "Tick the account to warn about.");
    const convos = await prisma.conversation.findMany({
      where: { OR: [{ hostId: { in: pickedUsers } }, { renterId: { in: pickedUsers } }], lastMessageAt: { gte: new Date(Date.now() - 60 * 86_400_000) } },
      select: { renterId: true, hostId: true, listing: { select: { title: true } } },
      take: 200,
    });
    const flagged = new Set(pickedUsers);
    const others = new Map<string, string>();
    for (const c of convos) {
      const other = flagged.has(c.hostId) ? c.renterId : c.hostId;
      if (!flagged.has(other)) others.set(other, c.listing.title);
    }
    const people = await prisma.user.findMany({ where: { id: { in: [...others.keys()] } }, select: { id: true, name: true, email: true } });
    await Promise.allSettled(
      people.map((p) =>
        sendMail({
          to: p.email,
          subject: "A safety note about a RentLeaks conversation",
          text:
            `Hi ${p.name.split(/\s+/)[0] || "there"},\n\nWe're reviewing an account you've been messaging about “${others.get(p.id)}”.\n\n` +
            "Until you hear from us: don't send any money, don't share ID documents or bank details, and don't move the conversation off RentLeaks. " +
            "A genuine host lets you see the home — in person or on a live video call — before anything is paid.\n\n" +
            `Questions? Reply to this email.\n\nRentLeaks Trust & Safety\n${appUrl()}`,
        }),
      ),
    );
    await audit(guard.user.id, "trust.warn", "user", pickedUsers.join(","), { signal, people: people.length });
    back(path, "ok", people.length ? `Safety note sent to ${people.length} ${people.length === 1 ? "person" : "people"} in recent conversations.` : "No recent conversations to warn.");
  }
  back(path, "err", "Unknown action.");
}

/* ---- Compliance & freshness ------------------------------------------------ */

export async function complianceAction(fd: FormData) {
  const path = returnTo(fd, "/admin/compliance");
  const guard = await requireAdminAction("listings");
  if (!guard.ok) back(path, "err", guard.error);
  const op = field(fd, "op", 20);
  const ids = fields(fd, "ids").slice(0, 300);
  if (!ids.length) back(path, "err", "Tick at least one listing.");

  if (op === "ask") {
    const n = await askFreshness({ ids, limit: 300 });
    await audit(guard.user.id, "listing.freshness.ask", "listing", "", { count: n });
    revalidatePath("/admin/compliance");
    back(path, "ok", n ? `Asked hosts about ${n} listing${n === 1 ? "" : "s"}.` : "Nothing to ask — those listings are examples, paused or unavailable.");
  }

  if (op === "fix") {
    const rows = await prisma.listing.findMany({
      where: { id: { in: ids } },
      select: {
        id: true, listedBy: true, housingType: true, cityId: true, title: true, neighborhood: true, address: true, description: true, price: true, deposit: true,
        feesJson: true, availableFrom: true, availableUntil: true, minStayMonths: true, maxStayMonths: true, leaseEnd: true, consentStatus: true, registrationNumber: true,
        image: true, detail: true, hostId: true,
        city: { select: { slug: true, name: true, state: true, country: true } },
        host: { select: { name: true, email: true, role: true } },
      },
    });
    const byHost = new Map<string, Array<{ title: string; items: string[] }>>();
    const hostOf = new Map<string, { name: string; email: string }>();
    const touched: string[] = [];
    for (const r of rows) {
      if (r.host.role === "admin" || r.host.role === "staff") continue;
      const a = auditListing(r);
      if (!a.failing.length) continue;
      touched.push(r.id);
      hostOf.set(r.hostId, r.host);
      byHost.set(r.hostId, [...(byHost.get(r.hostId) ?? []), { title: r.title, items: a.failing.map((f) => `${f.title}: ${f.why}`) }]);
    }
    let sent = 0;
    for (const [hostId, list] of byHost) {
      const h = hostOf.get(hostId)!;
      const mail = await sendMail({
        to: h.email,
        subject: list.length === 1 ? `One fix for “${list[0].title}”` : `Fixes for ${list.length} of your RentLeaks listings`,
        text:
          `Hi ${h.name.split(/\s+/)[0] || "there"},\n\nA few details on your listings need an update so renters see the full picture and the listing meets local rules:\n\n` +
          list.map((l) => `• ${l.title}\n${l.items.map((i) => `   – ${i}`).join("\n")}`).join("\n\n") +
          `\n\nEdit them here: ${appUrl().replace(/\/$/, "")}/account\n\nThank you,\nRentLeaks`,
        purpose: "personal",
      });
      if (mail.delivered || mail.transport === "console") sent += 1;
    }
    if (touched.length) await prisma.listing.updateMany({ where: { id: { in: touched } }, data: { fixRequestedAt: new Date() } });
    await audit(guard.user.id, "listing.fix.request", "listing", "", { listings: touched.length, hosts: sent });
    revalidatePath("/admin/compliance");
    back(path, touched.length ? "ok" : "err", touched.length ? `Fix requests sent to ${sent} host${sent === 1 ? "" : "s"} for ${touched.length} listing${touched.length === 1 ? "" : "s"}.` : "Nothing to fix on those (your own listings are fixed from Listings).");
  }
  back(path, "err", "Unknown action.");
}

/* ---- Settings: autopilot, freshness, morning brief ------------------------ */

export async function opsSettingAction(fd: FormData) {
  const path = returnTo(fd, "/admin/playbooks");
  const guard = await requireAdminAction("automation");
  if (!guard.ok) back(path, "err", guard.error);
  const key = field(fd, "key", 20);
  const value = field(fd, "value", 5) === "off" ? "off" : "on";
  if (key !== "autopilot" && key !== "freshness" && key !== "weekly") back(path, "err", "Unknown setting.");
  if (key === "weekly") {
    if (field(fd, "now", 1) === "1") {
      if (!guard.founder) back(path, "err", "The owner report goes to founders only.");
      const { sendWeeklyReport } = await import("@/lib/ops/report");
      const n = await sendWeeklyReport(new Date(), true);
      back(path, n ? "ok" : "err", n ? "Owner report sent (or logged if email isn't set up)." : "Couldn't send the report.");
    }
    await setSetting(SETTING_KEYS.weeklyReport, value);
    await audit(guard.user.id, "settings.weekly", "setting", key, { value });
    revalidatePath(path.split("?")[0]);
    back(path, "ok", value === "on" ? "The Monday owner report is on." : "The Monday owner report is off.");
  }
  await setSetting(key === "autopilot" ? SETTING_KEYS.autopilot : SETTING_KEYS.freshness, value);
  await audit(guard.user.id, `settings.${key}`, "setting", key, { value });
  revalidatePath(path.split("?")[0]);
  back(path, "ok", key === "autopilot" ? (value === "on" ? "Instant reply is on." : "Instant reply is off — renters get the plain confirmation.") : value === "on" ? "Weekly freshness checks are on." : "Freshness checks are off.");
}

export async function briefSettingAction(fd: FormData) {
  const guard = await requireAdminAction("any");
  if (!guard.ok) back("/admin/security", "err", guard.error);
  const raw = field(fd, "hour", 3);
  const hour = raw === "" || raw === "off" ? null : Math.min(11, Math.max(5, Math.round(Number(raw))));
  await prisma.user.update({ where: { id: guard.user.id }, data: { briefHour: hour !== null && Number.isFinite(hour) ? hour : null } });
  if (field(fd, "preview", 3) === "1") {
    const { sendBrief } = await import("@/lib/ops/brief");
    const r = await sendBrief(guard.user.id, new Date(), true);
    back(
      "/admin/security#brief",
      r ? "ok" : "err",
      r === "sent" ? "Preview sent to your inbox." : r === "logged" ? "Saved. Email isn't configured, so the preview was only logged — see System." : "Couldn't send the preview — check email in System.",
    );
  }
  back("/admin/security#brief", "ok", hour === null ? "Morning brief is off." : `Morning brief set for ${hour}:00 New York time.`);
}

/* ---- Host scorecards ------------------------------------------------------ */

/** Nudge a host (their weakest part) or offer a sponsored spot. Edited text wins. */
export async function hostAction(fd: FormData) {
  const path = returnTo(fd, "/admin/hosts");
  const guard = await requireAdminAction("hosts");
  if (!guard.ok) back(path, "err", guard.error);
  const op = field(fd, "op", 20);
  const hostId = field(fd, "hostId", 60);
  const subject = field(fd, "subject", 200);
  const body = field(fd, "body", 6000);
  if (op !== "nudge" && op !== "sponsor") back(path, "err", "Unknown action.");
  if (subject.length < 3 || body.length < 10) back(path, "err", "Add a subject and a message.");
  const host = await prisma.user.findUnique({ where: { id: hostId }, select: { id: true, email: true, role: true, suspendedAt: true } });
  if (!host || host.role === "admin" || host.role === "staff") back(path, "err", "That host no longer exists.");
  if (host.suspendedAt) back(path, "err", "That account is suspended.");
  if (await prisma.emailSuppression.findUnique({ where: { email: host.email.toLowerCase() } })) back(path, "err", "This host unsubscribed from our emails.");
  const recent = await prisma.adminAction.findFirst({
    where: { action: `host.${op}`, targetId: host.id, createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
    select: { createdAt: true },
  });
  if (recent && field(fd, "again", 1) !== "1") back(path, "err", `Already sent this week (${recent.createdAt.toISOString().slice(0, 10)}). Tick "send anyway" to repeat.`);
  const mail = await sendMail({ to: host.email, subject, text: body, purpose: "personal" });
  if (!mail.delivered && mail.transport !== "console") back(path, "err", `Not delivered: ${mail.error ?? mail.transport}`);
  const contact = await prisma.contact.findUnique({ where: { email: host.email.toLowerCase() }, select: { id: true } });
  if (contact) {
    await logActivity(contact.id, "email", subject, body.slice(0, 500), guard.user.id).catch(() => undefined);
  }
  await audit(guard.user.id, `host.${op}`, "user", host.id, { subject });
  revalidatePath("/admin/hosts");
  back(path, "ok", mail.transport === "console" ? "Recorded — email isn't configured, so nothing went out (see System)." : op === "nudge" ? `Nudge sent to ${host.email}.` : `Sponsored-spot offer sent to ${host.email}.`);
}
