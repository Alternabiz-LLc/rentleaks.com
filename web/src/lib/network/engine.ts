/**
 * The broker-network engine: intake, matching, lead offers, the tenant's
 * choice, in-app e-signing with an audit trail, pipeline updates, lease
 * reports and referral fees — plus the cron that keeps it all moving.
 *
 * Links in emails are HMAC-signed (lib/ops/links) and carry a per-record
 * nonce, so a link can't be forged and rotating the nonce revokes every old
 * link at once. Nothing secret is stored in plain text.
 */
import { createHash, randomBytes } from "crypto";
import { canAccess } from "@/lib/access";
import { booksSettings, booksToday, nextInvoiceNumber } from "@/lib/books/data";
import { invoiceTotals } from "@/lib/books/core";
import { logActivity, upsertContact } from "@/lib/crm";
import { enterpriseSettings } from "@/lib/enterprise/data";
import { brokerComplete } from "@/lib/enterprise/catalog";
import { readLink, signLink } from "@/lib/ops/links";
import { prisma } from "@/lib/prisma";
import { getSettings, SETTING_KEYS } from "@/lib/settings";
import { appUrl } from "@/lib/site";
import { sendMail } from "@/lib/v1/mail";
import {
  briefLines,
  canonicalDocument,
  canSignNow,
  envelopeStatus,
  feeEstimateCents,
  feeLabel,
  isFeeType,
  median,
  partnerAgreement,
  rankPartners,
  referralDue,
  searchScore,
  signatureMatches,
  tenantAgreement,
  usd,
  withinCap,
  type MatchPartner,
  type MatchSearch,
  type PartnerInput,
  type Referrer,
  type SearchInput,
  type SearchStage,
  type Section,
} from "./core";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const SAFETY = "Safety: never wire money or pay anyone before you've seen a home and have a lease to sign. RentLeaks never collects rent, deposits or broker fees.";

export class NetworkError extends Error {}
function fail(m: string): never {
  throw new NetworkError(m);
}

/* ------------------------------------------------------------------------
   Settings, links, helpers
   ------------------------------------------------------------------------ */

export async function networkSettings() {
  const s = await getSettings([SETTING_KEYS.netReferralPct, SETTING_KEYS.netOfferHours, SETTING_KEYS.netOffersPerSearch, SETTING_KEYS.netSignDays, SETTING_KEYS.netTermDays, SETTING_KEYS.netOpen]);
  const num = (k: string, d: number, lo: number, hi: number) => {
    const n = Number(s[k]);
    return Number.isFinite(n) && n >= lo && n <= hi ? n : d;
  };
  return {
    referralPctBp: Math.round(num(SETTING_KEYS.netReferralPct, 25, 1, 60) * 100),
    offerHours: Math.round(num(SETTING_KEYS.netOfferHours, 24, 2, 96)),
    offersPerSearch: Math.round(num(SETTING_KEYS.netOffersPerSearch, 3, 1, 6)),
    signDays: Math.round(num(SETTING_KEYS.netSignDays, 14, 3, 60)),
    termDays: Math.round(num(SETTING_KEYS.netTermDays, 90, 30, 365)),
    open: s[SETTING_KEYS.netOpen] !== "off",
  };
}

export async function referrer(): Promise<Referrer & { complete: boolean }> {
  const { broker } = await enterpriseSettings();
  return {
    name: broker.name || "RentLeaks (Alternabiz LLC)",
    licence: broker.licence,
    states: broker.states,
    contact: [broker.address, broker.phone].filter(Boolean).join(" · "),
    complete: brokerComplete(broker),
  };
}

const base = () => appUrl().replace(/\/$/, "");
export const nonce = () => randomBytes(18).toString("base64url");
export const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

export function roomLink(s: { id: string; roomTokenHash: string }) {
  return `${base()}/hire/${signLink(["h", s.id, s.roomTokenHash], new Date(Date.now() + 365 * DAY))}`;
}
export function portalLink(p: { id: string; portalTokenHash: string | null }) {
  return `${base()}/pro/${signLink(["p", p.id, p.portalTokenHash ?? "none"], new Date(Date.now() + 30 * DAY))}`;
}
export function signerLink(s: { id: string; tokenHash: string }) {
  return `${base()}/sign/${signLink(["g", s.id, s.tokenHash], new Date(Date.now() + 400 * DAY))}`;
}

export async function searchFromToken(token: string) {
  const p = readLink(token);
  if (!p || p[0] !== "h") return null;
  const s = await prisma.networkSearch.findUnique({ where: { id: p[1] } });
  return s && s.roomTokenHash === p[2] && s.status !== "spam" ? s : null;
}
export async function partnerFromToken(token: string) {
  const p = readLink(token);
  if (!p || p[0] !== "p") return null;
  const partner = await prisma.networkPartner.findUnique({ where: { id: p[1] } });
  return partner && partner.portalTokenHash && partner.portalTokenHash === p[2] ? partner : null;
}
export async function signerFromToken(token: string) {
  const p = readLink(token);
  if (!p || p[0] !== "g") return null;
  const s = await prisma.agreementSigner.findUnique({ where: { id: p[1] }, include: { agreement: { include: { signers: { orderBy: { order: "asc" } }, events: { orderBy: { createdAt: "asc" } } } } } });
  return s && s.tokenHash === p[2] ? s : null;
}

export const json = <T,>(s: string, d: T): T => {
  try {
    return JSON.parse(s) as T;
  } catch {
    return d;
  }
};

export function searchBrief(s: { city: string; state: string; neighborhoods: string; homeType: string; buildingAge: string; bedrooms: number | null; budgetMin: number | null; budgetMax: number; moveIn: string | null; term: string; termMonths: number | null; mustHaves: string; language: string | null; feeCapType: string; feeCapValue: number }) {
  return briefLines({ ...s, neighborhoods: json<string[]>(s.neighborhoods, []), mustHaves: json<string[]>(s.mustHaves, []) });
}

function matchSearchOf(s: { city: string; state: string; neighborhoods: string; homeType: string; buildingAge: string; term: string; language: string | null; budgetMax: number }): MatchSearch {
  return { city: s.city, state: s.state, neighborhoods: json<string[]>(s.neighborhoods, []), homeType: s.homeType, buildingAge: s.buildingAge, term: s.term, language: s.language, budgetMax: s.budgetMax };
}

async function networkTeam() {
  const users = await prisma.user.findMany({ where: { role: { in: ["admin", "staff"] }, suspendedAt: null, NOT: { passwordHash: "" } }, select: { email: true, role: true, staffAccess: true } });
  return users.filter((u) => canAccess(u, "network"));
}

export async function alertNetworkTeam(subject: string, text: string) {
  const team = await networkTeam();
  await Promise.allSettled(team.map((u) => sendMail({ to: u.email, subject, text })));
}

async function mail(to: string, subject: string, text: string, purpose: "transactional" | "personal" = "transactional") {
  return sendMail({ to, subject, text: `${text}\n\nRentLeaks broker network`, purpose }).catch(() => null);
}

async function crmNote(email: string, subject: string, body = "") {
  const c = await prisma.contact.findUnique({ where: { email: email.toLowerCase() }, select: { id: true } }).catch(() => null);
  if (c) await logActivity(c.id, "note", subject, body).catch(() => undefined);
}

/* ------------------------------------------------------------------------
   Partner stats for matching
   ------------------------------------------------------------------------ */

export async function partnerStats(ids?: string[]): Promise<Array<MatchPartner & { name: string; brokerage: string }>> {
  const partners = await prisma.networkPartner.findMany({
    where: ids ? { id: { in: ids } } : { status: "active" },
    include: { offers: { select: { status: true, offeredAt: true, respondedAt: true, searchId: true } } },
  });
  const pids = partners.map((p) => p.id);
  const [open, wins] = await Promise.all([
    prisma.networkSearch.groupBy({ by: ["chosenPartnerId"], where: { chosenPartnerId: { in: pids }, status: { in: ["chosen", "signed", "touring", "applied"] } }, _count: { _all: true } }),
    prisma.networkDeal.groupBy({ by: ["partnerId"], where: { partnerId: { in: pids } }, _count: { _all: true } }),
  ]);
  const openBy = new Map(open.map((o) => [o.chosenPartnerId, o._count._all]));
  const winsBy = new Map(wins.map((w) => [w.partnerId, w._count._all]));
  return partners.map((p) => {
    const answered = p.offers.filter((o) => o.respondedAt);
    const pending = p.offers.filter((o) => o.status === "offered" || o.status === "proposed").length;
    return {
      id: p.id,
      name: p.name,
      brokerage: p.brokerage,
      status: p.status,
      licenseState: p.licenseState,
      markets: json<string[]>(p.markets, []),
      specialties: json<string[]>(p.specialties, []),
      languages: json<string[]>(p.languages, []),
      capacity: p.capacity,
      openLeads: (openBy.get(p.id) ?? 0) + pending,
      medianReplyMins: median(answered.map((o) => (o.respondedAt!.getTime() - o.offeredAt.getTime()) / 60_000)),
      offers: p.offers.length,
      accepted: p.offers.filter((o) => ["proposed", "chosen", "not_chosen"].includes(o.status)).length,
      wins: winsBy.get(p.id) ?? 0,
      rating: p.ratingCount ? p.ratingSum / p.ratingCount : null,
      lastOfferedAt: p.lastOfferedAt?.getTime() ?? null,
    };
  });
}

/* ------------------------------------------------------------------------
   Tenant intake and matching
   ------------------------------------------------------------------------ */

export async function createSearch(input: SearchInput, now = new Date()) {
  const settings = await networkSettings();
  if (!settings.open) fail("Broker matching is paused for a moment. Please try again later.");
  const dupe = await prisma.networkSearch.findFirst({ where: { email: input.email, city: input.city, createdAt: { gte: new Date(now.getTime() - 10 * 60_000) } } });
  if (dupe) return { search: dupe, duplicate: true };
  const search = await prisma.networkSearch.create({
    data: {
      ...input,
      neighborhoods: JSON.stringify(input.neighborhoods),
      mustHaves: JSON.stringify(input.mustHaves),
      consent: true,
      score: searchScore(input, booksToday(now)),
      roomTokenHash: nonce(),
      status: "matching",
      stageAt: now,
    },
  });
  try {
    const c = await upsertContact({ email: input.email, name: input.name, phone: input.phone, kind: "renter", source: "lead", tags: ["broker-network", input.campaign ? `campaign:${input.campaign}` : ""].filter(Boolean) });
    await logActivity(c.id, "lead", "Wants to hire a broker", searchBrief(search).map(([k, v]) => `${k}: ${v}`).join("\n"));
  } catch {
    /* the CRM is best effort */
  }
  const made = await matchSearch(search.id, now);
  const first = input.name.split(" ")[0];
  await mail(
    input.email,
    "Your broker search is live — RentLeaks",
    `Hi ${first},\n\nWe've sent your brief to ${made ? `${made} verified broker${made === 1 ? "" : "s"} who work` : "the verified brokers who work"} ${input.city}. ` +
      `Their proposals — each with a short pitch and a fee at or under your cap — appear in your search room:\n\n${roomLink(search)}\n\n` +
      "Pick one when you're ready (or none). You'll sign one clear agreement in the app, and nothing is owed unless you sign a lease for a home your broker found for you.\n\n" +
      SAFETY,
  );
  await alertNetworkTeam(
    `Broker search: ${input.city} · up to $${input.budgetMax.toLocaleString("en-US")} (${made} offer${made === 1 ? "" : "s"} sent)`,
    `${searchBrief(search).map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${made ? "" : "No partner matched yet — recruit one or offer it by hand.\n\n"}Open: ${base()}/admin/referrals?open=${search.id}`,
  );
  return { search, duplicate: false };
}

/** Offers the search to the best-matched partners until the target number of live offers is reached. */
export async function matchSearch(searchId: string, now = new Date(), onlyPartnerId?: string) {
  const search = await prisma.networkSearch.findUnique({ where: { id: searchId }, include: { offers: true } });
  if (!search || !["new", "matching", "proposals"].includes(search.status)) return 0;
  const settings = await networkSettings();
  const live = search.offers.filter((o) => o.status === "offered" || o.status === "proposed").length;
  const room = onlyPartnerId ? 1 : Math.max(0, settings.offersPerSearch - live);
  if (!room) return 0;
  const exclude = new Set(search.offers.map((o) => o.partnerId));
  const stats = await partnerStats(onlyPartnerId ? [onlyPartnerId] : undefined);
  let picks = rankPartners(matchSearchOf(search), stats, now.getTime(), exclude).slice(0, room);
  if (onlyPartnerId && !picks.length) {
    // A hand-picked offer skips the market filter but never the status or licence state.
    const p = stats.find((x) => x.id === onlyPartnerId && x.status === "active" && x.licenseState === search.state && !exclude.has(x.id));
    picks = p ? [{ p, m: { score: 50, reasons: ["Offered by the RentLeaks team"] } }] : [];
  }
  let made = 0;
  for (const { p, m } of picks) {
    const offer = await prisma.networkOffer
      .create({ data: { searchId, partnerId: p.id, matchScore: m.score, reasons: JSON.stringify(m.reasons), expiresAt: new Date(now.getTime() + settings.offerHours * HOUR) } })
      .catch(() => null);
    if (!offer) continue;
    made++;
    const partner = await prisma.networkPartner.update({ where: { id: p.id }, data: { lastOfferedAt: now } });
    await mail(
      partner.email,
      `New tenant lead: ${search.city} · up to $${search.budgetMax.toLocaleString("en-US")}/mo`,
      `Hi ${partner.name.split(" ")[0]},\n\nA tenant who wants to hire a broker matches your markets:\n\n${searchBrief(search)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n")}\n\nWhy you: ${m.reasons.join(" · ") || "your markets"}\n\n` +
        `Accept with your fee and a short pitch within ${settings.offerHours} hours — the tenant picks from up to ${settings.offersPerSearch} brokers:\n${portalLink(partner)}`,
    );
  }
  if (made && search.status === "new") await prisma.networkSearch.update({ where: { id: searchId }, data: { status: "matching" } });
  return made;
}

/* ------------------------------------------------------------------------
   Partner answers
   ------------------------------------------------------------------------ */

export async function answerOffer(partnerId: string, offerId: string, a: { accept: boolean; feeType?: string; feeValue?: number | null; pitch?: string; why?: string }, now = new Date()) {
  const offer = await prisma.networkOffer.findUnique({ where: { id: offerId }, include: { search: true, partner: true } });
  if (!offer || offer.partnerId !== partnerId) fail("That lead isn't yours.");
  if (offer!.status !== "offered") fail("You've already answered this lead.");
  if (offer!.expiresAt < now) fail("This lead has expired.");
  if (offer!.partner.status !== "active") fail("Your partner account isn't active.");
  const s = offer!.search;
  if (!["matching", "proposals"].includes(s.status)) fail("The tenant has already chosen a broker.");
  if (!a.accept) {
    await prisma.networkOffer.update({ where: { id: offerId }, data: { status: "declined", respondedAt: now, declineWhy: (a.why ?? "").slice(0, 200) || null } });
    await matchSearch(s.id, now);
    return { accepted: false };
  }
  if (!a.feeType || !isFeeType(a.feeType) || !a.feeValue) fail("Set your fee.");
  if (!withinCap({ type: a.feeType!, value: a.feeValue! }, { type: s.feeCapType, value: s.feeCapValue }, s.budgetMax)) {
    fail(`That's above the tenant's cap of ${feeLabel(s.feeCapType, s.feeCapValue)}.`);
  }
  const pitch = (a.pitch ?? "").replace(/\s+/g, " ").trim().slice(0, 600);
  if (pitch.length < 30) fail("Write a short pitch (at least a sentence or two) — it's what the tenant reads first.");
  await prisma.networkOffer.update({ where: { id: offerId }, data: { status: "proposed", respondedAt: now, feeType: a.feeType, feeValue: a.feeValue, pitch } });
  const firstProposal = s.status === "matching";
  await prisma.networkSearch.update({ where: { id: s.id }, data: { status: "proposals", stageAt: firstProposal ? now : s.stageAt } });
  await mail(
    s.email,
    firstProposal ? "Your first broker proposal is in" : "Another broker proposal is in",
    `Hi ${s.name.split(" ")[0]},\n\n${offer!.partner.name} (${offer!.partner.brokerage}) would like to find your home in ${s.city} for ${feeLabel(a.feeType!, a.feeValue!)} ` +
      `(about ${usd(feeEstimateCents(a.feeType!, a.feeValue!, s.budgetMax))} at your top budget).\n\n“${pitch}”\n\nCompare and choose in your search room:\n${roomLink(s)}\n\n${SAFETY}`,
  );
  return { accepted: true };
}

/* ------------------------------------------------------------------------
   The tenant's choice → the tenant agreement
   ------------------------------------------------------------------------ */

export async function chooseBroker(searchId: string, offerId: string, now = new Date()) {
  const s = await prisma.networkSearch.findUnique({ where: { id: searchId }, include: { offers: { include: { partner: true } } } });
  if (!s) fail("That search no longer exists.");
  if (s!.status !== "proposals") fail(s!.status === "chosen" ? "You've already chosen — sign your agreement to start." : "There's nothing to choose yet.");
  const offer = s!.offers.find((o) => o.id === offerId && o.status === "proposed");
  if (!offer) fail("That proposal is no longer available.");
  const p = offer!.partner;
  if (p.status !== "active") fail("That broker isn't taking new clients right now — pick another.");
  const settings = await networkSettings();
  const ref = await referrer();
  const doc = tenantAgreement({
    date: booksToday(now),
    tenant: { name: s!.name, email: s!.email },
    partner: p,
    search: { ...matchSearchOf(s!), bedrooms: s!.bedrooms, moveIn: s!.moveIn, termMonths: s!.termMonths, homeType: s!.homeType, mustHaves: json<string[]>(s!.mustHaves, []) },
    fee: { type: offer!.feeType!, value: offer!.feeValue! },
    termDays: settings.termDays,
    referralPctBp: p.referralPctBp,
    referrer: ref,
  });
  const signers = [
    { role: "tenant", name: s!.name, email: s!.email },
    { role: "partner", name: p.name, email: p.email },
    ...(p.supervisorEmail && p.supervisorName ? [{ role: "supervisor", name: p.supervisorName, email: p.supervisorEmail }] : []),
  ];
  const env = await createEnvelope({ kind: "tenant_rep", doc, signers, searchId: s!.id, partnerId: p.id, days: settings.signDays, now, notifyFrom: 1 });
  await prisma.$transaction([
    prisma.networkOffer.update({ where: { id: offer!.id }, data: { status: "chosen", chosenAt: now } }),
    prisma.networkOffer.updateMany({ where: { searchId: s!.id, id: { not: offer!.id }, status: { in: ["offered", "proposed"] } }, data: { status: "not_chosen" } }),
    prisma.networkSearch.update({ where: { id: s!.id }, data: { status: "chosen", chosenPartnerId: p.id, agreementId: env.id, stageAt: now } }),
  ]);
  for (const o of s!.offers.filter((x) => x.id !== offer!.id && (x.status === "proposed" || x.status === "offered"))) {
    await mail(o.partner.email, `The tenant in ${s!.city} chose another broker`, `Hi ${o.partner.name.split(" ")[0]},\n\nThanks for your proposal — this tenant went with another broker. More leads are on the way.\n\n${portalLink(o.partner)}`);
  }
  await mail(
    p.email,
    `You were chosen: ${s!.name} in ${s!.city}`,
    `Hi ${p.name.split(" ")[0]},\n\n${s!.name} chose you. Their contact: ${s!.email}${s!.phone ? ` · ${s!.phone}` : ""}.\n\n` +
      "They're signing the tenant representation & fee agreement now; you'll get your signing link as soon as they have. Don't charge anything before it's fully signed.\n\n" +
      portalLink(p),
  );
  await crmNote(s!.email, `Chose broker ${p.name} (${p.brokerage})`, feeLabel(offer!.feeType!, offer!.feeValue!));
  const tenantSigner = env.signers.find((x) => x.role === "tenant")!;
  return { agreementId: env.id, tenantLink: signerLink(tenantSigner) };
}

/* ------------------------------------------------------------------------
   Envelopes
   ------------------------------------------------------------------------ */

type Doc = { title: string; sections: Section[]; terms: Record<string, unknown> };

export async function createEnvelope(o: {
  kind: "tenant_rep" | "partner_referral";
  doc: Doc;
  signers: Array<{ role: string; name: string; email: string }>;
  searchId?: string;
  partnerId?: string;
  days: number;
  now?: Date;
  /** Email signing links to signers from this position on (the first signer usually signs in the app). */
  notifyFrom?: number;
  actorId?: string | null;
}) {
  const now = o.now ?? new Date();
  const env = await prisma.agreement.create({
    data: {
      kind: o.kind,
      version: String(o.doc.terms.version ?? ""),
      title: o.doc.title,
      sections: JSON.stringify(o.doc.sections),
      terms: JSON.stringify(o.doc.terms),
      docHash: sha256(canonicalDocument(o.doc)),
      searchId: o.searchId ?? null,
      partnerId: o.partnerId ?? null,
      expiresAt: new Date(now.getTime() + o.days * DAY),
      createdById: o.actorId ?? null,
      signers: { create: o.signers.map((s, i) => ({ role: s.role, name: s.name, email: s.email.toLowerCase(), order: i, tokenHash: nonce() })) },
      events: { create: [{ type: "created", detail: `${o.doc.terms.version ?? ""} · ${o.signers.length} signers` }] },
    },
    include: { signers: { orderBy: { order: "asc" } } },
  });
  // Only the next signer in order is invited; later signers are invited as each one signs.
  const next = env.signers.find((s) => s.order === 0);
  if (next && (o.notifyFrom ?? 0) <= 0 && next.role !== "rentleaks") await inviteSigner(env, next);
  return env;
}

async function inviteSigner(env: { id: string; title: string; expiresAt: Date }, s: { id: string; name: string; email: string; tokenHash: string; role: string }, reminder = false) {
  if (s.role === "rentleaks") {
    await alertNetworkTeam(`Countersign needed: ${env.title}`, `Verify the licence and countersign in the desk: ${base()}/admin/referrals?tab=partners`);
    return;
  }
  await mail(
    s.email,
    `${reminder ? "Reminder: " : ""}Please review and sign — ${env.title}`,
    `Hi ${s.name.split(" ")[0]},\n\n${reminder ? "This agreement is still waiting for your signature" : "An agreement is ready for your signature"}:\n${env.title}\n\n` +
      `Review and sign (it takes a minute; open until ${env.expiresAt.toISOString().slice(0, 10)}):\n${signerLink(s)}\n\nYou can ask for a paper copy at any time by replying to this email.`,
  );
  await prisma.agreementEvent.create({ data: { agreementId: env.id, signerId: s.id, type: reminder ? "reminded" : "sent", detail: s.email } });
}

type Ctx = { ip: string | null; ua: string | null };

export async function recordView(signerId: string, ctx: Ctx) {
  const s = await prisma.agreementSigner.findUnique({ where: { id: signerId } });
  if (!s || s.viewedAt) return;
  await prisma.agreementSigner.update({ where: { id: signerId }, data: { viewedAt: new Date(), status: s.status === "pending" ? "viewed" : s.status } });
  await prisma.agreementEvent.create({ data: { agreementId: s.agreementId, signerId, type: "viewed", ip: ctx.ip, userAgent: ctx.ua?.slice(0, 300) } });
}

/** Rotates a signer's link (so an in-app "Sign now" never needs a stored secret) and returns it. */
export async function freshSignerLink(signerId: string) {
  const s = await prisma.agreementSigner.update({ where: { id: signerId }, data: { tokenHash: nonce() } });
  return signerLink(s);
}

const PNG = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;

export async function signEnvelope(signerId: string, input: { typedName: string; drawn: string | null; consent: boolean; readIt: boolean; actorId?: string | null }, ctx: Ctx, now = new Date()) {
  const s = await prisma.agreementSigner.findUnique({ where: { id: signerId }, include: { agreement: { include: { signers: true } } } });
  if (!s) fail("This signing link is no longer valid.");
  const env = s!.agreement;
  if (env.status === "voided" || env.status === "expired" || env.status === "declined") fail(`This agreement is ${env.status}.`);
  if (env.expiresAt < now) fail("This agreement has expired. Ask for a new one.");
  if (s!.status === "signed") fail("You've already signed.");
  if (!canSignNow(env.signers, s!.id)) fail("It isn't your turn to sign yet — you'll get an email when it is.");
  if (!input.consent) fail("Please agree to sign electronically.");
  if (!input.readIt) fail("Please confirm you've read the agreement.");
  if (!signatureMatches(input.typedName, s!.name)) fail(`Type your full name as it appears here: ${s!.name}.`);
  const drawn = input.drawn && PNG.test(input.drawn) && input.drawn.length < 180_000 ? input.drawn : null;
  // Tamper check before anyone signs: the stored text must still hash to the stored fingerprint.
  const doc = { title: env.title, sections: json<Section[]>(env.sections, []), terms: json<Record<string, unknown>>(env.terms, {}) };
  if (sha256(canonicalDocument(doc)) !== env.docHash) fail("This document failed its integrity check and can't be signed. We've been alerted.");
  await prisma.agreementSigner.update({
    where: { id: s!.id },
    data: {
      status: "signed",
      consentAt: now,
      signedAt: now,
      viewedAt: s!.viewedAt ?? now,
      signatureKind: drawn ? "drawn" : "typed",
      signedName: input.typedName.replace(/\s+/g, " ").trim().slice(0, 120),
      signatureImage: drawn,
      ip: ctx.ip,
      userAgent: ctx.ua?.slice(0, 300) ?? null,
      signedById: input.actorId ?? null,
    },
  });
  await prisma.agreementEvent.createMany({
    data: [
      { agreementId: env.id, signerId: s!.id, type: "consented", detail: "Agreed to electronic records and signatures", ip: ctx.ip, userAgent: ctx.ua?.slice(0, 300) },
      { agreementId: env.id, signerId: s!.id, type: "signed", detail: `${s!.role} · ${drawn ? "drawn + typed" : "typed"} signature · doc ${env.docHash.slice(0, 12)}`, ip: ctx.ip, userAgent: ctx.ua?.slice(0, 300) },
    ],
  });
  const signers = await prisma.agreementSigner.findMany({ where: { agreementId: env.id }, orderBy: { order: "asc" } });
  const status = envelopeStatus(signers, env.status);
  await prisma.agreement.update({ where: { id: env.id }, data: { status, completedAt: status === "completed" ? now : null } });
  if (status === "completed") {
    await prisma.agreementEvent.create({ data: { agreementId: env.id, type: "completed", detail: `All ${signers.length} parties signed` } });
    await onCompleted(env.id, now);
  } else {
    const next = signers.find((x) => x.status !== "signed");
    if (next) await inviteSigner(env, next);
    if (env.kind === "partner_referral" && next?.role === "rentleaks" && env.partnerId) {
      await prisma.networkPartner.update({ where: { id: env.partnerId }, data: { status: "verifying" } });
    }
  }
  return { status };
}

async function onCompleted(agreementId: string, now: Date) {
  const env = await prisma.agreement.findUnique({ where: { id: agreementId }, include: { signers: true } });
  if (!env) return;
  for (const s of env.signers.filter((x) => x.role !== "rentleaks")) {
    await mail(s.email, `Signed by everyone — ${env.title}`, `Hi ${s.name.split(" ")[0]},\n\nEveryone has signed. Your copy, with the signature certificate, is here (save it as PDF from your browser):\n${signerLink(s)}\n\nDocument fingerprint (SHA-256): ${env.docHash}`);
  }
  if (env.kind === "tenant_rep" && env.searchId) {
    const s = await prisma.networkSearch.update({ where: { id: env.searchId }, data: { status: "signed", stageAt: now } });
    await crmNote(s.email, "Signed the tenant representation agreement", env.title);
    await alertNetworkTeam(`Signed: ${env.title}`, `${base()}/admin/referrals?open=${s.id}`);
  }
  if (env.kind === "partner_referral" && env.partnerId) {
    const p = await prisma.networkPartner.update({ where: { id: env.partnerId }, data: { status: "active", agreementId: env.id, portalTokenHash: nonce() } });
    await mail(
      p.email,
      "You're in — RentLeaks broker network",
      `Hi ${p.name.split(" ")[0]},\n\nYour licence is verified and your referral agreement is signed. Leads in ${json<string[]>(p.markets, []).join(", ")} will arrive by email; ` +
        `answer them from your portal (bookmark it — you can always ask for a fresh link):\n${portalLink(p)}`,
    );
  }
}

export async function declineEnvelope(signerId: string, reason: string, ctx: Ctx, now = new Date()) {
  const s = await prisma.agreementSigner.findUnique({ where: { id: signerId }, include: { agreement: true } });
  if (!s || s.status === "signed") fail("This agreement can't be declined any more.");
  const env = s!.agreement;
  if (env.status !== "sent" && env.status !== "partial") fail(`This agreement is ${env.status}.`);
  const why = reason.replace(/\s+/g, " ").trim().slice(0, 300) || "No reason given";
  await prisma.agreementSigner.update({ where: { id: s!.id }, data: { status: "declined", declinedAt: now, declineReason: why, ip: ctx.ip, userAgent: ctx.ua?.slice(0, 300) } });
  await prisma.agreement.update({ where: { id: env.id }, data: { status: "declined" } });
  await prisma.agreementEvent.create({ data: { agreementId: env.id, signerId: s!.id, type: "declined", detail: why, ip: ctx.ip, userAgent: ctx.ua?.slice(0, 300) } });
  await reopenAfterEnvelope(env, `${s!.name} declined: ${why}`, now);
}

/** A tenant agreement that won't complete puts the search back to choosing. */
async function reopenAfterEnvelope(env: { id: string; kind: string; searchId: string | null; partnerId: string | null; title: string }, why: string, now: Date) {
  if (env.kind === "tenant_rep" && env.searchId) {
    const s = await prisma.networkSearch.findUnique({ where: { id: env.searchId } });
    if (s && s.agreementId === env.id && s.status === "chosen") {
      await prisma.networkOffer.updateMany({ where: { searchId: s.id, partnerId: env.partnerId ?? "", status: "chosen" }, data: { status: "withdrawn" } });
      await prisma.networkOffer.updateMany({ where: { searchId: s.id, status: "not_chosen", respondedAt: { not: null } }, data: { status: "proposed" } });
      const left = await prisma.networkOffer.count({ where: { searchId: s.id, status: "proposed" } });
      await prisma.networkSearch.update({ where: { id: s.id }, data: { status: left ? "proposals" : "matching", chosenPartnerId: null, agreementId: null, stageAt: now } });
      if (!left) await matchSearch(s.id, now);
      await mail(s.email, "Your broker agreement didn't go through", `Hi ${s.name.split(" ")[0]},\n\n${why}\n\n${left ? "Your other proposals are open again" : "We're finding you more brokers"}:\n${roomLink(s)}`);
    }
  }
  await alertNetworkTeam(`Agreement stopped: ${env.title}`, `${why}\n${base()}/admin/referrals?tab=agreements`);
}

export async function voidEnvelope(id: string, reason: string, actorId: string, now = new Date()) {
  const env = await prisma.agreement.findUnique({ where: { id } });
  if (!env) fail("That agreement no longer exists.");
  if (env!.status === "voided") fail("Already voided.");
  await prisma.agreement.update({ where: { id }, data: { status: "voided", voidedAt: now, voidReason: reason.slice(0, 300) } });
  await prisma.agreementEvent.create({ data: { agreementId: id, type: "voided", detail: `${reason.slice(0, 300)} (by desk ${actorId})` } });
  if (env!.status !== "completed") await reopenAfterEnvelope(env!, `The agreement was withdrawn: ${reason}`, now);
}

/* ------------------------------------------------------------------------
   Partner applications
   ------------------------------------------------------------------------ */

export async function applyPartner(input: PartnerInput, source: string, now = new Date()) {
  const settings = await networkSettings();
  const existing = await prisma.networkPartner.findUnique({ where: { email: input.email } });
  if (existing && existing.status !== "rejected" && existing.status !== "applied") fail("You're already in the network — ask for your portal link instead.");
  const data = {
    ...input,
    markets: JSON.stringify(input.markets),
    specialties: JSON.stringify(input.specialties),
    languages: JSON.stringify(input.languages),
    status: "applied",
    referralPctBp: settings.referralPctBp,
    source,
  };
  const partner = existing ? await prisma.networkPartner.update({ where: { id: existing.id }, data }) : await prisma.networkPartner.create({ data });
  if (existing?.agreementId) await prisma.agreement.updateMany({ where: { id: existing.agreementId, status: { in: ["sent", "partial"] } }, data: { status: "voided", voidedAt: now, voidReason: "Replaced by a new application" } });
  const ref = await referrer();
  const doc = partnerAgreement({ date: booksToday(now), partner: input, referralPctBp: settings.referralPctBp, offerHours: settings.offerHours, referrer: ref });
  const team = await prisma.user.findFirst({ where: { role: "admin", suspendedAt: null }, orderBy: { createdAt: "asc" }, select: { name: true, email: true } });
  const signers = [
    { role: "partner", name: input.name, email: input.email },
    ...(input.supervisorEmail && input.supervisorName ? [{ role: "supervisor", name: input.supervisorName, email: input.supervisorEmail }] : []),
    { role: "rentleaks", name: team?.name ?? ref.name, email: team?.email ?? "desk@rentleaks.com" },
  ];
  const env = await createEnvelope({ kind: "partner_referral", doc, signers, partnerId: partner.id, days: 30, now, notifyFrom: 1 });
  await prisma.networkPartner.update({ where: { id: partner.id }, data: { agreementId: env.id } });
  try {
    const c = await upsertContact({ email: input.email, name: input.name, phone: input.phone, company: input.brokerage, kind: "partner", source: "lead", tags: ["broker-network", `licence:${input.licenseState}`] });
    await logActivity(c.id, "lead", "Applied to the broker referral network", `${input.brokerage} · ${input.licenseType} ${input.licenseNumber} (${input.licenseState})`);
  } catch {
    /* best effort */
  }
  await alertNetworkTeam(
    `Partner application: ${input.name} (${input.brokerage})`,
    `${input.licenseType} ${input.licenseNumber} · ${input.licenseState}\nMarkets: ${input.markets.join(", ")}\n\nVerify: ${base()}/admin/referrals?tab=partners&partner=${partner.id}`,
  );
  const first = env.signers.find((s) => s.role === "partner")!;
  return { partner, signLink: signerLink(first) };
}

export async function emailPortalLink(email: string) {
  const p = await prisma.networkPartner.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!p) return;
  if (p.status === "active" || p.status === "paused") {
    const fresh = p.portalTokenHash ? p : await prisma.networkPartner.update({ where: { id: p.id }, data: { portalTokenHash: nonce() } });
    await mail(p.email, "Your RentLeaks partner portal", `Here's your portal link (valid 30 days):\n${portalLink(fresh)}`);
  } else if (p.agreementId) {
    const signer = await prisma.agreementSigner.findFirst({ where: { agreementId: p.agreementId, role: "partner", status: { not: "signed" } } });
    if (signer) await mail(p.email, "Finish your RentLeaks partner agreement", `Sign here to finish joining:\n${await freshSignerLink(signer.id)}`);
  }
}

/* ------------------------------------------------------------------------
   Pipeline, leases, referral fees, ratings
   ------------------------------------------------------------------------ */

export async function partnerMove(partnerId: string, searchId: string, stage: SearchStage, why: string | null, now = new Date()) {
  const s = await prisma.networkSearch.findUnique({ where: { id: searchId } });
  if (!s || s.chosenPartnerId !== partnerId) fail("That client isn't yours.");
  if (!["signed", "touring", "applied"].includes(s!.status)) fail(s!.status === "chosen" ? "The agreement isn't fully signed yet." : "This search is closed.");
  if (!["touring", "applied", "lost"].includes(stage)) fail("Report a lease with the lease form.");
  if (stage === "lost" && !why) fail("Say why the search ended.");
  await prisma.networkSearch.update({ where: { id: searchId }, data: { status: stage, stageAt: now, lostReason: stage === "lost" ? why : s!.lostReason } });
  await crmNote(s!.email, `Broker search: ${stage}`, why ?? "");
  if (stage === "lost") await alertNetworkTeam(`Search ended without a lease: ${s!.city}`, `${why}\n${base()}/admin/referrals?open=${searchId}`);
}

export async function reportLease(partnerId: string, searchId: string, r: { leaseSignedOn: string; monthlyRentCents: number; grossFeeCents: number; address: string; note: string }, now = new Date()) {
  const s = await prisma.networkSearch.findUnique({ where: { id: searchId } });
  const p = await prisma.networkPartner.findUnique({ where: { id: partnerId } });
  if (!s || !p || s.chosenPartnerId !== partnerId) fail("That client isn't yours.");
  if (!["signed", "touring", "applied"].includes(s!.status)) fail("Only an active, signed search can be reported as leased.");
  if (r.leaseSignedOn > booksToday(now)) fail("The lease date can't be in the future.");
  if (r.monthlyRentCents <= 0) fail("Add the monthly rent.");
  const due = referralDue(r.grossFeeCents, p!.referralPctBp);
  const deal = await prisma.networkDeal.create({
    data: { searchId, partnerId, leaseSignedOn: r.leaseSignedOn, monthlyRentCents: r.monthlyRentCents, grossFeeCents: r.grossFeeCents, referralPctBp: p!.referralPctBp, referralDueCents: due, address: r.address.slice(0, 200), note: r.note.slice(0, 500) },
  });
  await prisma.networkSearch.update({ where: { id: searchId }, data: { status: "leased", leasedAt: now, stageAt: now } });
  await crmNote(s!.email, "Signed a lease through their broker", r.address);
  await alertNetworkTeam(`Lease reported: ${p!.name} · referral ${usd(due)}`, `Fee collected ${usd(r.grossFeeCents)} at ${p!.referralPctBp / 100}%.\nInvoice it: ${base()}/admin/referrals?tab=fees`);
  await mail(p!.email, `Lease recorded — referral fee ${usd(due)}`, `Thanks, ${p!.name.split(" ")[0]}. We recorded the lease for ${s!.name}. Your brokerage will receive an invoice for the referral fee of ${usd(due)} (${p!.referralPctBp / 100}% of ${usd(r.grossFeeCents)}).`);
  await mail(
    s!.email,
    "Congratulations on your new home",
    `Hi ${s!.name.split(" ")[0]},\n\nCongratulations! How was ${p!.name}? Rate them in your search room — it helps the next renter:\n${roomLink(s!)}\n\n${SAFETY}`,
  );
  return deal;
}

export async function invoiceDeal(dealId: string, actorId: string) {
  const d = await prisma.networkDeal.findUnique({ where: { id: dealId } });
  if (!d) fail("That deal no longer exists.");
  if (d!.invoiceId) return d!.invoiceId;
  if (d!.referralDueCents <= 0) fail("No referral fee is due on this deal.");
  const p = await prisma.networkPartner.findUnique({ where: { id: d!.partnerId } });
  if (!p) fail("The partner no longer exists.");
  const s = await booksSettings();
  const today = booksToday();
  const items = [{ description: `Referral fee — lease ${d!.address || "for referred tenant"}, signed ${d!.leaseSignedOn} (${d!.referralPctBp / 100}% of ${usd(d!.grossFeeCents)})`, quantity: 1, unitCents: d!.referralDueCents }];
  const t = invoiceTotals(items, 0);
  const due = new Date(Date.parse(`${today}T00:00:00Z`) + Math.max(10, s.terms) * DAY).toISOString().slice(0, 10);
  const billTo = p!.supervisorEmail && p!.supervisorName ? { name: `${p!.brokerage} (attn. ${p!.supervisorName})`, email: p!.supervisorEmail } : { name: p!.brokerage, email: p!.email };
  for (let attempt = 0; attempt < 4; attempt++) {
    const number = await nextInvoiceNumber(Number(today.slice(0, 4)));
    const inv = await prisma.invoice
      .create({
        data: {
          number: attempt ? `${number}-${attempt}` : number,
          billToName: billTo.name.slice(0, 120),
          billToEmail: billTo.email,
          issueDate: today,
          dueDate: due,
          itemsJson: JSON.stringify(items),
          subtotalCents: t.subtotal,
          taxCents: 0,
          totalCents: t.total,
          note: "Broker-to-broker referral fee under the RentLeaks referral partner agreement.",
          createdById: actorId,
        },
      })
      .catch(() => null);
    if (inv) {
      await prisma.networkDeal.update({ where: { id: dealId }, data: { invoiceId: inv.id, status: "invoiced" } });
      return inv.id;
    }
  }
  return fail("Couldn't number the invoice — try again.");
}

export async function rateBroker(searchId: string, stars: number) {
  const s = await prisma.networkSearch.findUnique({ where: { id: searchId } });
  if (!s || !s.chosenPartnerId || !["leased", "closed", "lost"].includes(s.status)) fail("You can rate your broker once your search is finished.");
  if (s!.rating) fail("Thanks — you've already rated your broker.");
  const n = Math.max(1, Math.min(5, Math.round(stars)));
  await prisma.networkSearch.update({ where: { id: searchId }, data: { rating: n } });
  await prisma.networkPartner.update({ where: { id: s!.chosenPartnerId! }, data: { ratingSum: { increment: n }, ratingCount: { increment: 1 } } });
}

export async function cancelSearch(searchId: string, why: string, now = new Date()) {
  const s = await prisma.networkSearch.findUnique({ where: { id: searchId }, include: { offers: { include: { partner: true } } } });
  if (!s || ["leased", "closed", "lost", "spam"].includes(s.status)) fail("This search is already closed.");
  if (s!.agreementId && s!.status !== "chosen") fail("Your agreement is signed — end it by emailing your broker, who will close the search.");
  if (s!.agreementId) await voidEnvelope(s!.agreementId, "The tenant cancelled the search", "tenant", now).catch(() => undefined);
  await prisma.networkOffer.updateMany({ where: { searchId, status: { in: ["offered", "proposed", "chosen"] } }, data: { status: "withdrawn" } });
  await prisma.networkSearch.update({ where: { id: searchId }, data: { status: "lost", lostReason: `Tenant cancelled: ${why.slice(0, 200) || "no reason"}`, stageAt: now, chosenPartnerId: null } });
  for (const o of s!.offers.filter((x) => x.status === "offered" || x.status === "proposed" || x.status === "chosen")) {
    await mail(o.partner.email, `Search withdrawn: ${s!.city}`, `The tenant in ${s!.city} stopped their search. Nothing more is needed.\n\n${portalLink(o.partner)}`);
  }
}

/* ------------------------------------------------------------------------
   Cron
   ------------------------------------------------------------------------ */

export async function runNetwork(now = new Date()) {
  const out = { expired: 0, refilled: 0, noMatch: 0, reminded: 0, envelopesExpired: 0, nudged: 0, stale: 0 };
  // 1. Lead offers nobody answered in time.
  const late = await prisma.networkOffer.findMany({ where: { status: "offered", expiresAt: { lt: now } }, take: 200, select: { id: true, searchId: true } });
  if (late.length) {
    await prisma.networkOffer.updateMany({ where: { id: { in: late.map((o) => o.id) } }, data: { status: "expired" } });
    out.expired = late.length;
    for (const id of new Set(late.map((o) => o.searchId))) out.refilled += await matchSearch(id, now);
  }
  // 2. Searches with nobody working them.
  const lonely = await prisma.networkSearch.findMany({ where: { status: "matching", noMatchAt: null, createdAt: { lt: new Date(now.getTime() - 2 * HOUR) } }, include: { offers: { select: { status: true } } }, take: 100 });
  for (const s of lonely) {
    if (s.offers.some((o) => o.status === "offered" || o.status === "proposed")) continue;
    const made = await matchSearch(s.id, now);
    if (made) {
      out.refilled += made;
      continue;
    }
    await prisma.networkSearch.update({ where: { id: s.id }, data: { noMatchAt: now } });
    await alertNetworkTeam(`No broker available: ${s.city}, ${s.state}`, `Nobody in the network can take this search. Offer it by hand or recruit a partner.\n${base()}/admin/referrals?open=${s.id}`);
    await mail(s.email, "We're finding the right broker for you", `Hi ${s.name.split(" ")[0]},\n\nOur team is personally finding a broker for ${s.city} — you'll hear from us within one business day.\n\n${roomLink(s)}`);
    out.noMatch++;
  }
  // 3. Signers who haven't signed: remind after 48 hours, twice at most.
  const waiting = await prisma.agreementSigner.findMany({
    where: { status: { in: ["pending", "viewed"] }, role: { not: "rentleaks" }, reminders: { lt: 2 }, agreement: { status: { in: ["sent", "partial"] }, expiresAt: { gt: now } } },
    include: { agreement: { include: { signers: true, events: { where: { type: { in: ["sent", "reminded", "signed"] } }, orderBy: { createdAt: "desc" }, take: 1 } } } },
    take: 200,
  });
  for (const s of waiting) {
    if (!canSignNow(s.agreement.signers, s.id)) continue;
    const last = s.remindedAt ?? s.agreement.events[0]?.createdAt ?? s.agreement.createdAt;
    if (now.getTime() - last.getTime() < 48 * HOUR) continue;
    // In-app signers (tenant, and the partner on a referral agreement) get a fresh link.
    const fresh = await prisma.agreementSigner.update({ where: { id: s.id }, data: { remindedAt: now, reminders: { increment: 1 }, tokenHash: nonce() } });
    await inviteSigner(s.agreement, fresh, true);
    out.reminded++;
  }
  // 4. Envelopes past their date.
  const stale = await prisma.agreement.findMany({ where: { status: { in: ["sent", "partial"] }, expiresAt: { lt: now } }, take: 100 });
  for (const env of stale) {
    await prisma.agreement.update({ where: { id: env.id }, data: { status: "expired" } });
    await prisma.agreementEvent.create({ data: { agreementId: env.id, type: "expired", detail: "Not fully signed in time" } });
    await reopenAfterEnvelope(env, "The agreement wasn't signed in time.", now);
    out.envelopesExpired++;
  }
  // 5. Proposals waiting on the tenant for two days: one nudge.
  const choosing = await prisma.networkSearch.findMany({ where: { status: "proposals", nudgedAt: null, stageAt: { lt: new Date(now.getTime() - 48 * HOUR) } }, take: 100 });
  for (const s of choosing) {
    const n = await prisma.networkOffer.count({ where: { searchId: s.id, status: "proposed" } });
    await mail(s.email, `${n} broker proposal${n === 1 ? " is" : "s are"} waiting for you`, `Hi ${s.name.split(" ")[0]},\n\nCompare them and choose — or tell us none fits:\n${roomLink(s)}`);
    await prisma.networkSearch.update({ where: { id: s.id }, data: { nudgedAt: now } });
    out.nudged++;
  }
  // 6. Signed searches with no update in three weeks: ask the partner.
  const quiet = await prisma.networkSearch.findMany({ where: { status: { in: ["signed", "touring", "applied"] }, stageAt: { lt: new Date(now.getTime() - 21 * DAY) } }, take: 100 });
  for (const s of quiet) {
    const p = s.chosenPartnerId ? await prisma.networkPartner.findUnique({ where: { id: s.chosenPartnerId } }) : null;
    if (!p) continue;
    await mail(p.email, `Update needed: ${s.name}'s search`, `Hi ${p.name.split(" ")[0]},\n\nIt's been three weeks since the last update on ${s.name}'s search in ${s.city}. Mark it touring, applied, leased or ended:\n${portalLink(p)}`);
    await prisma.networkSearch.update({ where: { id: s.id }, data: { stageAt: now } });
    out.stale++;
  }
  return out;
}

/** Numbers for the desk overview and the advisor. */
export async function networkFacts(now = new Date()) {
  const safe = <T,>(q: Promise<T>, f: T) => q.catch(() => f);
  const [toVerify, noMatch, toInvoice, feesDue, waitingSign] = await Promise.all([
    safe(prisma.networkPartner.count({ where: { status: "verifying" } }), 0),
    safe(prisma.networkSearch.count({ where: { status: "matching", noMatchAt: { not: null } } }), 0),
    safe(prisma.networkDeal.count({ where: { status: "reported" } }), 0),
    safe(prisma.networkDeal.aggregate({ where: { status: { in: ["reported", "invoiced"] } }, _sum: { referralDueCents: true } }), { _sum: { referralDueCents: 0 } }),
    safe(prisma.agreement.count({ where: { status: { in: ["sent", "partial"] }, createdAt: { lt: new Date(now.getTime() - 3 * DAY) } } }), 0),
  ]);
  return { toVerify, noMatch, toInvoice, feesDueCents: feesDue._sum.referralDueCents ?? 0, waitingSign };
}

export function clientIp(h: Headers) {
  return h.get("cf-connecting-ip") || (h.get("x-forwarded-for") || "").split(",")[0].trim() || null;
}
