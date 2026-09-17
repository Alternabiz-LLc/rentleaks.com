/**
 * Shortlists: the three best live homes for a request, sent as one email with
 * tracked links. Used by Match & Send (a person picks and edits) and by the
 * speed-to-lead autopilot (the instant reply to a new request).
 *
 * Example listings from the sample catalogue are never offered: if the sample
 * list cannot be read, no homes are offered at all.
 */
import { liveListingWhere } from "@/lib/billing";
import { logActivity } from "@/lib/crm";
import { prisma } from "@/lib/prisma";
import { sampleCatalogIds } from "@/lib/sample-catalog";
import { appUrl, fmtMoney, typeLabel } from "@/lib/site";
import { sendMail, type MailResult } from "@/lib/v1/mail";
import { shortlistLink } from "./links";
import { medianOf, PRICE_FLOOR } from "./trust";
import { rankMatches, type Match, type MatchRequest } from "./match";

export type ShortlistHome = {
  id: string;
  title: string;
  neighborhood: string;
  cityName: string;
  allIn: number;
  currency: string;
  housingType: string;
  image: string;
  availableFrom: string;
  minStayMonths: number;
};

export type Scored = { match: Match; home: ShortlistHome };

type LeadLike = MatchRequest & { id: string; name: string; email: string; listingId?: string | null };

async function samples(): Promise<Set<string> | null> {
  try {
    return await sampleCatalogIds();
  } catch {
    return null;
  }
}

/** Ranked live homes for a request (never examples, never the one already asked about). */
export async function matchesFor(lead: LeadLike, limit = 3): Promise<Scored[]> {
  const sample = await samples();
  if (!sample) return [];
  const live = await liveListingWhere();
  const rows = await prisma.listing.findMany({
    where: {
      AND: [live, lead.cityId ? { cityId: lead.cityId } : {}, lead.listingId ? { id: { not: lead.listingId } } : {}, { allInUsd: { gt: 0 } }],
    },
    select: {
      id: true,
      title: true,
      neighborhood: true,
      cityId: true,
      city: { select: { name: true } },
      housingType: true,
      allIn: true,
      allInUsd: true,
      currency: true,
      image: true,
      availableFrom: true,
      availableUntil: true,
      minStayMonths: true,
      maxStayMonths: true,
      verified: true,
      sponsored: true,
      postedAt: true,
      confirmedAt: true,
    },
    orderBy: { postedAt: "desc" },
    take: 600,
  });
  // A rent far under the market for its type is a classic scam lure: never offer it.
  const real = rows.filter((r) => !sample.has(r.id));
  const homes = real.filter((r) => {
    const peers = real.filter((x) => x.cityId === r.cityId && x.housingType === r.housingType).map((x) => x.allInUsd);
    return peers.length < 5 || r.allInUsd >= medianOf(peers) * PRICE_FLOOR;
  });
  const ranked = rankMatches(lead, homes, limit);
  return ranked.map((match) => {
    const r = homes.find((h) => h.id === match.id)!;
    return {
      match,
      home: {
        id: r.id,
        title: r.title,
        neighborhood: r.neighborhood,
        cityName: r.city.name,
        allIn: r.allIn,
        currency: r.currency,
        housingType: r.housingType,
        image: r.image,
        availableFrom: r.availableFrom,
        minStayMonths: r.minStayMonths,
      },
    };
  });
}

export async function homesByIds(ids: string[]): Promise<ShortlistHome[]> {
  const sample = await samples();
  if (!sample || !ids.length) return [];
  const live = await liveListingWhere();
  const rows = await prisma.listing.findMany({
    where: { AND: [live, { id: { in: ids.slice(0, 8) } }] },
    select: { id: true, title: true, neighborhood: true, city: { select: { name: true } }, allIn: true, currency: true, housingType: true, image: true, availableFrom: true, minStayMonths: true },
  });
  return ids
    .map((id) => rows.find((r) => r.id === id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r) && !sample.has(r!.id))
    .map((r) => ({ ...r, cityName: r.city.name }));
}

const first = (name: string) => name.trim().split(/\s+/)[0] || "there";

function homeLines(leadId: string, homes: ShortlistHome[]) {
  return homes.map((h, i) => {
    const link = shortlistLink(leadId, h.id);
    const text = `${i + 1}. ${h.title} — ${h.neighborhood}, ${h.cityName}\n   ${fmtMoney(h.allIn, h.currency)}/month all-in · ${typeLabel(h.housingType)} · from ${h.availableFrom} · ${h.minStayMonths}+ months\n   ${link}`;
    const html = `<tr><td style="padding:10px 0;border-top:1px solid #e3ecee">
      ${h.image && /^https:\/\//.test(h.image) ? `<img src="${esc(h.image)}" alt="" width="120" height="80" style="float:left;margin:0 12px 0 0;border-radius:8px;object-fit:cover">` : ""}
      <a href="${esc(link)}" style="color:#1c5b69;font-weight:700;text-decoration:none">${esc(h.title)}</a><br>
      <span style="color:#56696f">${esc(h.neighborhood)}, ${esc(h.cityName)} · ${esc(typeLabel(h.housingType))}</span><br>
      <b style="color:#0f2a31">${esc(fmtMoney(h.allIn, h.currency))}/month all-in</b>
      <span style="color:#56696f"> · from ${esc(h.availableFrom)} · ${h.minStayMonths}+ months</span>
    </td></tr>`;
    return { text, html };
  });
}

function esc(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export const SAFETY_NOTE =
  "A safety note: never pay rent or a deposit before you have seen the home (in person or on a live video call) and signed a lease. RentLeaks never takes payment and never asks for wire transfers, gift cards or crypto.";

export function defaultShortlistBody(name: string, count: number, sender = "The RentLeaks team") {
  return (
    `Hi ${first(name)},\n\n` +
    `Thanks for your request. ${count === 1 ? "Here is a home" : `Here are ${count} homes`} that fit what you asked for — monthly prices are all-in, with no broker fee:\n\n` +
    `{{homes}}\n\n` +
    `Reply to this email and we'll set up a viewing, in person or on a live video call.\n\n` +
    `${SAFETY_NOTE}\n\n— ${sender}`
  );
}

export function renderShortlist(leadId: string, body: string, homes: ShortlistHome[]) {
  const lines = homeLines(leadId, homes);
  const listText = lines.map((l) => l.text).join("\n\n");
  const withList = body.includes("{{homes}}") ? body.replace("{{homes}}", listText) : `${body}\n\n${listText}`;
  const [before, after = ""] = body.split("{{homes}}");
  const para = (t: string) =>
    t
      .trim()
      .split(/\n{2,}/)
      .map((p) => `<p style="margin:0 0 14px">${esc(p).replace(/\n/g, "<br>")}</p>`)
      .join("");
  const table = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px">${lines.map((l) => l.html).join("")}</table>`;
  const html = `<!doctype html><html><body style="margin:0;background:#f2f6f6"><div style="max-width:560px;margin:0 auto;padding:24px;font:15px/1.55 -apple-system,Segoe UI,Arial,sans-serif;color:#0f2a31;background:#ffffff">${para(before)}${table}${para(body.includes("{{homes}}") ? after : "")}<p style="margin:18px 0 0;color:#7d8f94;font-size:12px">RentLeaks · <a href="${esc(appUrl())}" style="color:#7d8f94">${esc(appUrl().replace(/^https?:\/\//, ""))}</a></p></div></body></html>`;
  return { text: withList, html };
}

/** Sends a shortlist and records it on the lead and the contact's timeline. */
export async function sendShortlist(input: {
  leadId: string;
  listingIds: string[];
  subject: string;
  body: string;
  actorId: string | null;
  auto?: boolean;
}): Promise<{ ok: true; mail: MailResult; count: number } | { ok: false; error: string }> {
  const lead = await prisma.lead.findUnique({ where: { id: input.leadId } });
  if (!lead) return { ok: false, error: "That request no longer exists." };
  if (lead.status === "spam") return { ok: false, error: "This request is marked as spam." };
  const homes = await homesByIds(input.listingIds);
  if (!homes.length) return { ok: false, error: "None of those homes is live any more. Pick others." };
  const { text, html } = renderShortlist(lead.id, input.body, homes);
  const mail = await sendMail({ to: lead.email, subject: input.subject.slice(0, 200), text, html, purpose: input.auto ? "transactional" : "personal" });
  if (!mail.delivered && mail.transport !== "console") return { ok: false, error: `Not delivered: ${mail.error ?? mail.transport}` };
  const now = new Date();
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      matchesSentAt: now,
      matchIds: JSON.stringify(homes.map((h) => h.id)),
      ...(input.auto ? { ackSentAt: lead.ackSentAt ?? now } : { status: lead.status === "new" ? "contacted" : lead.status, contactedAt: lead.contactedAt ?? now }),
    },
  });
  const contact = await prisma.contact.findUnique({ where: { email: lead.email.toLowerCase() }, select: { id: true } });
  if (contact) {
    await logActivity(
      contact.id,
      "email",
      input.auto ? `Instant reply with ${homes.length} home${homes.length === 1 ? "" : "s"}` : `Shortlist: ${homes.length} home${homes.length === 1 ? "" : "s"}`,
      homes.map((h) => h.title).join(" · "),
      input.actorId,
    ).catch(() => undefined);
    if (!input.auto) await prisma.contact.update({ where: { id: contact.id }, data: { lastContactedAt: now } }).catch(() => undefined);
  }
  return { ok: true, mail, count: homes.length };
}
