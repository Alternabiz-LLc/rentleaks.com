/**
 * The lead magnets: someone asks for a guide, agrees to be contacted, gets a
 * private download link by email, and lands on the desk as a lead the team
 * follows up. Also the public roster — the ten partner headshots on the
 * website — which reads from the same verified partners the matcher uses.
 *
 * Consent is recorded as the exact sentence shown next to the tick box, with
 * the time, IP and user agent, so what someone agreed to is never guesswork.
 */
import { canAccess } from "@/lib/access";
import { logActivity, upsertContact } from "@/lib/crm";
import { readLink, signLink } from "@/lib/ops/links";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/site";
import { sendMail } from "@/lib/v1/mail";
import { GUIDE, GUIDES, ROSTER_SLOTS, type GuideInput, type RosterCard } from "./core";
import { json, networkSettings, nonce, NetworkError } from "./engine";

const DAY = 86_400_000;
const base = () => appUrl().replace(/\/$/, "");

function fail(m: string): never {
  throw new NetworkError(m);
}

export function guideLink(lead: { id: string; tokenHash: string }) {
  return `${base()}/guide/${signLink(["gd", lead.id, lead.tokenHash], new Date(Date.now() + 60 * DAY))}`;
}

export async function guideFromToken(token: string) {
  const p = readLink(token);
  if (!p || p[0] !== "gd") return null;
  const lead = await prisma.guideLead.findUnique({ where: { id: p[1] } });
  return lead && lead.tokenHash === p[2] && lead.status !== "spam" ? lead : null;
}

/** The public file path of a guide, served from the app's own /guides folder. */
export function guideFile(guideId: string) {
  const g = GUIDE.get(guideId);
  return g ? `/guides/${g.file}` : null;
}

type Ctx = { ip?: string | null; ua?: string | null };

async function alertTeam(subject: string, text: string) {
  const team = await prisma.user
    .findMany({ where: { role: { in: ["admin", "staff"] }, suspendedAt: null, NOT: { passwordHash: "" } }, select: { email: true, role: true, staffAccess: true } })
    .catch(() => []);
  await Promise.allSettled(team.filter((u) => canAccess(u, "network")).map((u) => sendMail({ to: u.email, subject, text })));
}

/**
 * Records the request, emails the guide and returns the private link. The same
 * person asking twice within an hour gets their existing link back rather than
 * a second lead on the desk.
 */
export async function requestGuide(input: GuideInput, ctx: Ctx = {}, now = new Date()) {
  const guide = GUIDE.get(input.guideId);
  if (!guide) fail("That guide no longer exists.");
  const recent = await prisma.guideLead.findFirst({
    where: { email: input.email, guideId: input.guideId, createdAt: { gte: new Date(now.getTime() - 60 * 60_000) } },
    orderBy: { createdAt: "desc" },
  });
  if (recent) return { lead: recent, link: guideLink(recent), duplicate: true };

  const lead = await prisma.guideLead.create({
    data: { ...input, tokenHash: nonce(), ip: ctx.ip ?? null, userAgent: ctx.ua?.slice(0, 300) ?? null, consent: true },
  });
  const link = guideLink(lead);
  const first = input.name.split(" ")[0];
  const settings = await networkSettings().catch(() => ({ offersPerSearch: 3, referralPctBp: 2500 }));
  const next =
    input.audience === "tenant"
      ? `When you're ready, tell us what you're looking for and up to ${settings.offersPerSearch} verified brokers will send a proposal at or under the fee cap you set:\n${base()}/hire-a-broker/`
      : `Ready to take leads? Apply with your licence — it takes two minutes, and there's no sign-up fee:\n${base()}/hire-a-broker/agents.html`;
  const mail = await sendMail({
    to: input.email,
    subject: `${guide.title} — your copy`,
    text:
      `Hi ${first},\n\nHere's your copy of ${guide.title} (${guide.pages} pages, PDF):\n${link}\n\n` +
      `${guide.tagline}\n\n${next}\n\n` +
      "A person from our team will follow up shortly to answer questions — reply to this email any time to stop hearing from us.\n\nRentLeaks broker network",
  }).catch(() => null);
  if (mail?.delivered) await prisma.guideLead.update({ where: { id: lead.id }, data: { sentAt: now } });

  try {
    const c = await upsertContact({
      email: input.email,
      name: input.name,
      phone: input.phone ?? undefined,
      company: input.brokerage ?? undefined,
      kind: input.audience === "partner" ? "partner" : "renter",
      source: "lead",
      tags: ["broker-network", `guide:${guide.id}`, input.campaign ? `campaign:${input.campaign}` : ""].filter(Boolean),
    });
    await logActivity(c.id, "lead", `Asked for ${guide.title}`, `${input.consentText}\n\nAgreed ${now.toISOString()} from ${ctx.ip ?? "unknown IP"}.`);
  } catch {
    /* the CRM is best effort */
  }
  await alertTeam(
    `Guide download: ${input.name}${input.audience === "partner" ? ` (${input.brokerage})` : input.city ? ` — ${input.city}` : ""}`,
    `${guide.title}\n${input.email}${input.phone ? ` · ${input.phone}` : ""}\n\nThey agreed to be contacted:\n"${input.consentText}"\n\nFollow up: ${base()}/admin/referrals?tab=guides&lead=${lead.id}`,
  );
  return { lead, link, duplicate: false };
}

export async function markGuideDownloaded(id: string, now = new Date()) {
  await prisma.guideLead.update({ where: { id }, data: { downloadedAt: now, downloads: { increment: 1 } } }).catch(() => undefined);
}

/* ------------------------------------------------------------------------
   The public roster: up to ten verified partners with a headshot.
   ------------------------------------------------------------------------ */

export function headshotUrl(p: { id: string; photoAt: Date | null }) {
  return p.photoAt ? `${base()}/api/network/headshot/${p.id}?v=${Math.floor(p.photoAt.getTime() / 1000)}` : null;
}

/**
 * Featured partners first (in the order the desk pinned them), then the ones
 * with the most leases. Only active partners with a photo appear — an empty
 * slot on the page is an invitation, not a hole.
 */
export async function roster(limit = ROSTER_SLOTS): Promise<RosterCard[]> {
  const partners = await prisma.networkPartner.findMany({
    where: { status: "active", photoAt: { not: null } },
    orderBy: [{ featuredAt: "desc" }, { createdAt: "asc" }],
    take: Math.max(1, Math.min(limit * 3, 60)),
    select: {
      id: true,
      name: true,
      brokerage: true,
      headline: true,
      bio: true,
      markets: true,
      languages: true,
      licenseState: true,
      photoAt: true,
      featuredAt: true,
      ratingSum: true,
      ratingCount: true,
    },
  });
  const leases = partners.length
    ? await prisma.networkDeal.groupBy({ by: ["partnerId"], where: { partnerId: { in: partners.map((p) => p.id) } }, _count: { _all: true } }).catch(() => [])
    : [];
  const wins = new Map(leases.map((l) => [l.partnerId, l._count._all]));
  return partners
    .map((p) => ({
      id: p.id,
      name: p.name,
      brokerage: p.brokerage,
      headline: (p.headline || p.bio.split(/(?<=[.!?])\s/)[0] || "").slice(0, 140),
      markets: json<string[]>(p.markets, []).slice(0, 4),
      languages: json<string[]>(p.languages, []).slice(0, 4),
      photo: headshotUrl(p),
      rating: p.ratingCount ? Math.round((p.ratingSum / p.ratingCount) * 10) / 10 : null,
      leases: wins.get(p.id) ?? 0,
      state: p.licenseState,
      featured: p.featuredAt ? p.featuredAt.getTime() : 0,
    }))
    .sort((a, b) => b.featured - a.featured || b.leases - a.leases || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((card) => {
      const { featured, ...rest } = card;
      void featured;
      return rest;
    });
}

const PHOTO_MAX = 3_000_000;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Saves a partner's headshot. Only real JPEG/PNG/WebP bytes are accepted. */
export async function setHeadshot(partnerId: string, bytes: Uint8Array, sniffed: string | null, now = new Date()) {
  if (bytes.length > PHOTO_MAX) fail("That photo is over 3 MB — a headshot around 800 pixels wide is plenty.");
  if (!sniffed || !PHOTO_TYPES.has(sniffed)) fail("Use a JPEG, PNG or WebP photo.");
  await prisma.networkPartner.update({ where: { id: partnerId }, data: { photoData: Buffer.from(bytes), photoType: sniffed, photoAt: now } });
}

export async function clearHeadshot(partnerId: string) {
  await prisma.networkPartner.update({ where: { id: partnerId }, data: { photoData: null, photoType: null, photoAt: null, featuredAt: null } });
}

/** Desk numbers for the guide tab and the overview. */
export async function guideFacts(now = new Date()) {
  const safe = <T,>(q: Promise<T>, f: T) => q.catch(() => f);
  const [fresh, waiting, rosterCount] = await Promise.all([
    safe(prisma.guideLead.count({ where: { status: "new" } }), 0),
    safe(prisma.guideLead.count({ where: { status: "new", createdAt: { lt: new Date(now.getTime() - 2 * DAY) } } }), 0),
    safe(prisma.networkPartner.count({ where: { status: "active", photoAt: { not: null } } }), 0),
  ]);
  return { fresh, waiting, rosterCount, slots: ROSTER_SLOTS, guides: GUIDES.length };
}
