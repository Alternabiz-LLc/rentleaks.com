/**
 * The RentLeaks broker network — tenants who want to hire a broker, and the
 * licensed brokers and agents who sign up to receive them as referrals.
 *
 *   Tenant:  1 · Tell us what you need   2 · Pick your broker   3 · Sign & search
 *   Broker:  1 · Join & get verified      2 · Accept a lead      3 · Sign, close, get paid
 *
 * This file is the pure part: the menu, the request and application parsers,
 * the matching score, the fee maths, the agreement templates and the canonical
 * document string that is hashed for tamper evidence. No database, no Node
 * APIs, erasable TypeScript only — the website builder imports it directly.
 *
 * Rules it keeps:
 * - Fair housing: the brief is about the home; nothing about who lives there.
 * - The tenant hires their own broker, in writing, with the fee agreed before
 *   anything is signed (NYC FARE Act). No broker may condition specific homes
 *   on being hired, or charge the tenant on a home they list for the landlord.
 * - Referral fees move broker-to-broker only (NY RPL § 442): the partner's
 *   brokerage pays RentLeaks' licensed brokerage, never an individual agent.
 * - RentLeaks never holds rent, deposits or the broker's fee.
 *
 * The agreement text is a careful starting point, not legal advice — have
 * counsel review it for each state before relying on it.
 */

/* ------------------------------------------------------------------------
   The menu
   ------------------------------------------------------------------------ */

export const HOME_TYPES = [
  { id: "apartment", label: "Apartment", specialty: "apartments" },
  { id: "room", label: "Room in a shared home", specialty: "rooms" },
  { id: "coliving", label: "Co-living", specialty: "rooms" },
  { id: "furnished", label: "Furnished apartment", specialty: "furnished" },
  { id: "house", label: "House or townhouse", specialty: "houses" },
  { id: "luxury", label: "Luxury / doorman building", specialty: "luxury" },
] as const;

export const BUILDING_AGES = [
  { id: "any", label: "Any building" },
  { id: "new", label: "New development" },
  { id: "renovated", label: "Renovated" },
  { id: "classic", label: "Pre-war / classic" },
] as const;

export const TERMS = [
  { id: "long", label: "Long term (12 months +)" },
  { id: "mid", label: "Short term (1–11 months)" },
  { id: "flexible", label: "Flexible" },
] as const;

export const MUST_HAVES = [
  { id: "laundry", label: "Laundry in unit or building" },
  { id: "elevator", label: "Elevator" },
  { id: "doorman", label: "Doorman / concierge" },
  { id: "outdoor", label: "Outdoor space" },
  { id: "parking", label: "Parking" },
  { id: "pets", label: "Pet-friendly" },
  { id: "dishwasher", label: "Dishwasher" },
  { id: "gym", label: "Gym" },
  { id: "stepfree", label: "Step-free entry" },
  { id: "transit", label: "Near transit" },
  { id: "workspace", label: "Room for a workspace" },
  { id: "noFeeListings", label: "Show me no-fee listings too" },
] as const;

export const SPECIALTIES = [
  { id: "apartments", label: "Apartments" },
  { id: "rooms", label: "Rooms & co-living" },
  { id: "furnished", label: "Furnished & short term (30 days +)" },
  { id: "houses", label: "Houses & townhouses" },
  { id: "luxury", label: "Luxury & doorman" },
  { id: "newdev", label: "New development" },
  { id: "relocation", label: "Relocation & international" },
  { id: "students", label: "Students & first rentals" },
  { id: "budget", label: "Value & budget" },
] as const;

export const LANGUAGES = ["English", "Spanish", "French", "Mandarin", "Cantonese", "Russian", "Portuguese", "Italian", "German", "Arabic", "Hindi", "Korean", "Japanese", "Hebrew", "Haitian Creole", "Polish", "Bengali"] as const;

export const LICENSE_TYPES = [
  { id: "salesperson", label: "Real estate salesperson", needsBroker: true },
  { id: "associate_broker", label: "Associate real estate broker", needsBroker: true },
  { id: "broker", label: "Real estate broker (broker of record)", needsBroker: false },
] as const;

export type FeeType = "pct" | "months" | "flat";

export const FEE_TYPES: Array<{ id: FeeType; label: string; hint: string }> = [
  { id: "months", label: "Months of rent", hint: "e.g. 1 = one month's rent" },
  { id: "pct", label: "% of first-year rent", hint: "e.g. 12 = 12% of twelve months' rent" },
  { id: "flat", label: "Flat fee", hint: "a fixed dollar amount" },
];

export const TENANT_STEPS = [
  { n: "1", title: "Tell us what you need", body: "Where, when, your budget and the kind of home — two minutes. Set the most you're willing to pay a broker." },
  { n: "2", title: "Pick your broker", body: "Up to three licensed, verified brokers who work your area send a short pitch and their fee. You choose — or none." },
  { n: "3", title: "Sign & search", body: "Sign one clear agreement in the app. Your broker takes it from there: viewings, applications, the lease." },
];

export const PARTNER_STEPS = [
  { n: "1", title: "Join & get verified", body: "Apply with your licence, sign the referral agreement in the app, and we verify you with the state." },
  { n: "2", title: "Accept a lead", body: "Tenants who already want a broker, in your markets. Accept with your fee and a short pitch — within 24 hours." },
  { n: "3", title: "Sign, close, get paid", body: "The tenant signs your agreement in the app. Find the home, report the lease, and your brokerage pays the referral fee." },
];

export const NETWORK_FAQ: Array<{ q: string; a: string; who: "tenant" | "partner" | "both" }> = [
  {
    q: "Why would I pay a broker when many listings are no-fee?",
    a: "You don't have to. Hiring your own broker is a choice: someone who searches, books viewings, knows the buildings and negotiates for you. You agree the fee in writing first, and you owe it only if you sign a lease for a home your broker found or showed you.",
    who: "tenant",
  },
  {
    q: "How much does it cost?",
    a: "You set the most you're willing to pay before any broker sees your brief — a number of months' rent, a percentage of the first year's rent, or a flat fee. Brokers can only propose at or below that. There is no charge from RentLeaks.",
    who: "tenant",
  },
  {
    q: "Can a broker charge me for an apartment they list for the landlord?",
    a: "No. In New York City the FARE Act puts the landlord's broker fee on the landlord. Your broker must tell you in writing if they also work for a home's landlord, and they won't charge you for that home.",
    who: "both",
  },
  {
    q: "Is the electronic signature binding?",
    a: "Yes. Electronic signatures are valid under the federal ESIGN Act and New York's Electronic Signatures and Records Act. You consent first, every step is time-stamped, and everyone gets the same signed copy with a tamper check.",
    who: "both",
  },
  {
    q: "Do you pay agents directly?",
    a: "No — referral fees move between brokerages only. Your brokerage (the broker of record) pays RentLeaks' licensed brokerage, as New York law requires. Salespersons and associate brokers join with their supervising broker's sign-off.",
    who: "partner",
  },
  {
    q: "What does it cost to join?",
    a: "Nothing up front. When a referred tenant signs a lease and your brokerage collects its fee, the brokerage pays RentLeaks the referral percentage in your agreement.",
    who: "partner",
  },
  {
    q: "Who sees my details?",
    a: "Brokers see your brief — area, budget, dates, home type — but not your name, email or phone until you choose one of them. RentLeaks never sells your details.",
    who: "tenant",
  },
];

/* ------------------------------------------------------------------------
   Money
   ------------------------------------------------------------------------ */

export function isFeeType(v: string): v is FeeType {
  return v === "pct" || v === "months" || v === "flat";
}

/**
 * Parses what a person typed for a fee into the stored integer:
 * pct → basis points (12.5 → 1250), months → hundredths (1 → 100), flat → cents.
 */
export function parseFeeValue(type: FeeType, raw: string): number | null {
  const s = String(raw ?? "").replace(/[\s$,%]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Math.round(Number(s) * 100);
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  if (type === "pct" && n > 3000) return null; // 30% of a year is already three and a half months
  if (type === "months" && n > 300) return null;
  if (type === "flat" && n > 5_000_000) return null;
  return n;
}

export function feeLabel(type: string, value: number) {
  if (type === "pct") return `${trim(value / 100)}% of first-year rent`;
  if (type === "months") return value === 100 ? "one month's rent" : `${trim(value / 100)} months' rent`;
  if (type === "flat") return `$${(value / 100).toLocaleString("en-US", { minimumFractionDigits: value % 100 ? 2 : 0 })} flat`;
  return "no fee cap set";
}

function trim(n: number) {
  return String(Math.round(n * 100) / 100);
}

/** The fee in cents at a given monthly rent (whole dollars). */
export function feeEstimateCents(type: string, value: number, monthlyRent: number) {
  const rentCents = Math.max(0, Math.round(monthlyRent)) * 100;
  if (type === "pct") return Math.round((rentCents * 12 * value) / 10_000);
  if (type === "months") return Math.round((rentCents * value) / 100);
  if (type === "flat") return value;
  return 0;
}

/** Is a broker's proposal at or under the tenant's cap, at the tenant's top budget? */
export function withinCap(proposal: { type: string; value: number }, cap: { type: string; value: number }, budgetMax: number) {
  if (cap.type === "none" || !cap.value) return true;
  return feeEstimateCents(proposal.type, proposal.value, budgetMax) <= feeEstimateCents(cap.type, cap.value, budgetMax);
}

export function referralDue(grossFeeCents: number, pctBp: number) {
  return Math.max(0, Math.round((Math.max(0, grossFeeCents) * pctBp) / 10_000));
}

export const usd = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

/* ------------------------------------------------------------------------
   Stages
   ------------------------------------------------------------------------ */

export const SEARCH_STAGES = ["new", "matching", "proposals", "chosen", "signed", "touring", "applied", "leased", "closed", "lost", "spam"] as const;
export type SearchStage = (typeof SEARCH_STAGES)[number];

export const SEARCH_STAGE: Record<SearchStage, { label: string; hint: string; tone: "brand" | "warn" | "value" | "good" | "bad" | "ink" }> = {
  new: { label: "New", hint: "Brief received", tone: "warn" },
  matching: { label: "Matching", hint: "Waiting on broker proposals", tone: "brand" },
  proposals: { label: "Proposals in", hint: "Tenant is choosing", tone: "value" },
  chosen: { label: "Broker chosen", hint: "Agreement out for signature", tone: "value" },
  signed: { label: "Signed", hint: "Search under way", tone: "good" },
  touring: { label: "Touring", hint: "Viewings booked", tone: "good" },
  applied: { label: "Applied", hint: "Application in", tone: "good" },
  leased: { label: "Leased", hint: "Report the fee", tone: "good" },
  closed: { label: "Closed", hint: "Done", tone: "ink" },
  lost: { label: "Lost", hint: "Ended without a lease", tone: "bad" },
  spam: { label: "Spam", hint: "", tone: "bad" },
};

/** The board shows the working stages. */
export const BOARD_STAGES: SearchStage[] = ["new", "matching", "proposals", "chosen", "signed", "touring", "applied", "leased"];

/** Stages a partner may move their own client to. */
export const PARTNER_MOVES: SearchStage[] = ["touring", "applied", "leased", "lost"];

export const PARTNER_STATUSES = ["applied", "verifying", "active", "paused", "rejected"] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];
export const PARTNER_STATUS: Record<PartnerStatus, { label: string; tone: "brand" | "warn" | "value" | "good" | "bad" | "ink" }> = {
  applied: { label: "Signing", tone: "warn" },
  verifying: { label: "To verify", tone: "value" },
  active: { label: "Active", tone: "good" },
  paused: { label: "Paused", tone: "ink" },
  rejected: { label: "Declined", tone: "bad" },
};

export const OFFER_STATUSES = ["offered", "proposed", "declined", "expired", "chosen", "not_chosen", "withdrawn"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const AGREEMENT_STATUS = {
  sent: { label: "Out for signature", tone: "warn" },
  partial: { label: "Partly signed", tone: "value" },
  completed: { label: "Completed", tone: "good" },
  declined: { label: "Declined", tone: "bad" },
  expired: { label: "Expired", tone: "ink" },
  voided: { label: "Voided", tone: "bad" },
} as const;
export type AgreementStatus = keyof typeof AGREEMENT_STATUS;

/** The envelope's status from its signers. */
export function envelopeStatus(signers: Array<{ status: string }>, current: string): AgreementStatus {
  if (current === "voided" || current === "expired") return current;
  if (signers.some((s) => s.status === "declined")) return "declined";
  const signed = signers.filter((s) => s.status === "signed").length;
  if (signed && signed === signers.length) return "completed";
  return signed ? "partial" : "sent";
}

/** Who may sign now: everyone before them in order must have signed. */
export function canSignNow(signers: Array<{ id: string; order: number; status: string }>, signerId: string) {
  const me = signers.find((s) => s.id === signerId);
  if (!me || me.status === "signed" || me.status === "declined") return false;
  return signers.filter((s) => s.order < me.order).every((s) => s.status === "signed");
}

/* ------------------------------------------------------------------------
   The tenant brief
   ------------------------------------------------------------------------ */

export type SearchInput = {
  name: string;
  email: string;
  phone: string | null;
  city: string;
  state: string;
  neighborhoods: string[];
  homeType: string;
  buildingAge: string;
  bedrooms: number | null;
  budgetMin: number | null;
  budgetMax: number;
  moveIn: string | null;
  term: string;
  termMonths: number | null;
  mustHaves: string[];
  language: string | null;
  feeCapType: string;
  feeCapValue: number;
  notes: string;
  source: string;
  campaign: string | null;
  referrer: string | null;
};

export type Parse<T> = { ok: true; value: T; spam: boolean } | { ok: false; field: string; message: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const STATE = /^[A-Z]{2}$/;

function text(v: unknown, max: number) {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : typeof v === "number" ? String(v) : "";
}
function note(v: unknown, max: number) {
  return typeof v === "string"
    ? v
        .replace(/\r\n?/g, "\n")
        .replace(/[^\S\n]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, max)
    : "";
}
function list(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === "string" && v.trim()) return v.split(",").map((x) => x.trim()).filter(Boolean);
  return [];
}
function int(v: unknown, min: number, max: number) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[\s$,]/g, ""));
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : NaN;
}
const has = <T extends { id: string }>(xs: readonly T[], id: string) => xs.some((x) => x.id === id);

/** "Brooklyn, NY" → { city: "Brooklyn", state: "NY" }. */
export function splitCity(raw: string, fallbackState = "") {
  const m = /^(.*?)[,\s]+([A-Za-z]{2})$/.exec(raw.trim());
  if (m && STATE.test(m[2].toUpperCase())) return { city: m[1].trim(), state: m[2].toUpperCase() };
  return { city: raw.trim(), state: fallbackState.toUpperCase() };
}

function fairLanguage(s: string) {
  // A free-text brief must not become a way to state a preference about people.
  return /\b(no (kids|children|section ?8|vouchers?)|adults? only|christian|muslim|jewish|white|black|hispanic|asian|straight|gay|married couple only|single (man|woman) only|young professionals only|no (men|women|males|females))\b/i.test(s);
}

export function parseSearch(body: Record<string, unknown>, today: string): Parse<SearchInput> {
  const name = text(body.name, 120);
  if (name.length < 2) return { ok: false, field: "name", message: "Add your name." };
  const email = text(body.email, 200).toLowerCase();
  if (!EMAIL.test(email)) return { ok: false, field: "email", message: "Add an email so your broker proposals can reach you." };
  const phone = text(body.phone, 40);
  if (phone && !/^\+?[\d\s().-]{7,}$/.test(phone)) return { ok: false, field: "phone", message: "That phone number doesn't look right." };
  const loc = splitCity(text(body.city, 80), text(body.state, 2));
  if (loc.city.length < 2) return { ok: false, field: "city", message: "Which city are you looking in?" };
  if (!STATE.test(loc.state)) return { ok: false, field: "state", message: "Add the state, e.g. Brooklyn, NY." };
  const homeType = has(HOME_TYPES, text(body.homeType, 20)) ? text(body.homeType, 20) : "apartment";
  const buildingAge = has(BUILDING_AGES, text(body.buildingAge, 20)) ? text(body.buildingAge, 20) : "any";
  const term = has(TERMS, text(body.term, 20)) ? text(body.term, 20) : "long";
  const bedrooms = int(body.bedrooms, 0, 10);
  if (Number.isNaN(bedrooms)) return { ok: false, field: "bedrooms", message: "Bedrooms should be 0 (studio) to 10." };
  const budgetMax = int(body.budgetMax, 100, 100_000);
  if (budgetMax === null || Number.isNaN(budgetMax)) return { ok: false, field: "budgetMax", message: "Add your top monthly budget." };
  const budgetMin = int(body.budgetMin, 0, 100_000);
  if (Number.isNaN(budgetMin) || (budgetMin !== null && budgetMin > budgetMax)) return { ok: false, field: "budgetMin", message: "The lowest budget can't be above the highest." };
  const moveIn = text(body.moveIn, 10);
  if (moveIn && (!ISO.test(moveIn) || moveIn < today)) return { ok: false, field: "moveIn", message: "Pick a move-in date from today on." };
  const termMonths = int(body.termMonths, 1, 60);
  if (Number.isNaN(termMonths)) return { ok: false, field: "termMonths", message: "Stay length should be 1 to 60 months." };
  if (term === "mid" && termMonths !== null && termMonths >= 12) return { ok: false, field: "termMonths", message: "Short term is under 12 months — pick long term instead." };
  const capTypeRaw = text(body.feeCapType, 10);
  const feeCapType = isFeeType(capTypeRaw) ? capTypeRaw : "none";
  let feeCapValue = 0;
  if (feeCapType !== "none") {
    const v = parseFeeValue(feeCapType, text(body.feeCapValue, 12));
    if (v === null) return { ok: false, field: "feeCapValue", message: "Set the most you'll pay — e.g. 1 month, 12%, or $2,500." };
    feeCapValue = v;
  }
  const notes = note(body.notes, 2000);
  if (fairLanguage(notes)) return { ok: false, field: "notes", message: "Please describe the home, not the people — fair-housing rules apply to every search." };
  if (body.consent !== true && body.consent !== "on" && body.consent !== "true") return { ok: false, field: "consent", message: "Please agree to share your brief with matched brokers." };
  const src = text(body.source, 24).toLowerCase();
  const lang = text(body.language, 30);
  return {
    ok: true,
    spam: text(body.website, 200) !== "",
    value: {
      name,
      email,
      phone: phone || null,
      city: loc.city.slice(0, 60),
      state: loc.state,
      neighborhoods: [...new Set(list(body.neighborhoods).map((n) => n.slice(0, 40)))].slice(0, 8),
      homeType,
      buildingAge,
      bedrooms,
      budgetMin,
      budgetMax,
      moveIn: moveIn || null,
      term,
      termMonths,
      mustHaves: [...new Set(list(body.mustHaves))].filter((m) => has(MUST_HAVES, m)),
      language: (LANGUAGES as readonly string[]).includes(lang) ? lang : null,
      feeCapType,
      feeCapValue,
      notes,
      source: /^[a-z0-9_]{1,24}$/.test(src) ? src : "web",
      campaign: text(body.campaign, 80) || null,
      referrer: text(body.referrer, 300) || null,
    },
  };
}

const label = <T extends { id: string; label: string }>(xs: readonly T[], id: string | null | undefined) => xs.find((x) => x.id === id)?.label ?? id ?? "";

/** The brief as a broker sees it before being chosen: no name, email or phone. */
export function briefLines(s: {
  city: string;
  state: string;
  neighborhoods: string[];
  homeType: string;
  buildingAge: string;
  bedrooms: number | null;
  budgetMin: number | null;
  budgetMax: number;
  moveIn: string | null;
  term: string;
  termMonths: number | null;
  mustHaves: string[];
  language: string | null;
  feeCapType: string;
  feeCapValue: number;
}) {
  const beds = s.bedrooms === null ? "" : s.bedrooms === 0 ? "Studio" : `${s.bedrooms} bedroom${s.bedrooms === 1 ? "" : "s"}`;
  return [
    ["Where", `${s.city}, ${s.state}${s.neighborhoods.length ? ` — ${s.neighborhoods.join(", ")}` : ""}`],
    ["Home", [label(HOME_TYPES, s.homeType), beds, s.buildingAge !== "any" ? label(BUILDING_AGES, s.buildingAge) : ""].filter(Boolean).join(" · ")],
    ["Budget", `${s.budgetMin ? `$${s.budgetMin.toLocaleString("en-US")}–` : "up to "}$${s.budgetMax.toLocaleString("en-US")} a month`],
    ["When", [s.moveIn ? `move in ${s.moveIn}` : "flexible move-in", `${label(TERMS, s.term)}${s.termMonths ? `, ${s.termMonths} months` : ""}`].join(" · ")],
    ["Must-haves", s.mustHaves.map((m) => label(MUST_HAVES, m)).join(", ") || "—"],
    ["Broker fee cap", s.feeCapType === "none" ? "Open to proposals" : `Up to ${feeLabel(s.feeCapType, s.feeCapValue)} (≈ ${usd(feeEstimateCents(s.feeCapType, s.feeCapValue, s.budgetMax))} at top budget)`],
    ...(s.language ? [["Preferred language", s.language]] : []),
  ] as Array<[string, string]>;
}

/** 0–100: how ready and valuable a brief is. */
export function searchScore(s: { phone: string | null; moveIn: string | null; budgetMax: number; feeCapType: string; neighborhoods: string[]; notes: string }, today: string) {
  let n = 20;
  if (s.phone) n += 10;
  if (s.moveIn) {
    const days = (Date.parse(`${s.moveIn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
    n += days <= 30 ? 25 : days <= 60 ? 15 : 5;
  }
  n += s.budgetMax >= 5000 ? 20 : s.budgetMax >= 2500 ? 12 : 6;
  if (s.feeCapType !== "none") n += 10;
  if (s.neighborhoods.length) n += 5;
  if (s.notes.length >= 30) n += 5;
  return Math.min(100, n);
}

/* ------------------------------------------------------------------------
   The partner application
   ------------------------------------------------------------------------ */

export type PartnerInput = {
  name: string;
  email: string;
  phone: string;
  brokerage: string;
  licenseType: string;
  licenseNumber: string;
  licenseState: string;
  licenseExpires: string | null;
  supervisorName: string | null;
  supervisorEmail: string | null;
  markets: string[];
  specialties: string[];
  languages: string[];
  bio: string;
  website: string | null;
  capacity: number;
};

export function parsePartner(body: Record<string, unknown>, today: string): Parse<PartnerInput> {
  const name = text(body.name, 120);
  if (name.length < 3) return { ok: false, field: "name", message: "Add your name as it appears on your licence." };
  const email = text(body.email, 200).toLowerCase();
  if (!EMAIL.test(email)) return { ok: false, field: "email", message: "Add your work email." };
  const phone = text(body.phone, 40);
  if (!/^\+?[\d\s().-]{7,}$/.test(phone)) return { ok: false, field: "phone", message: "Add a phone number tenants can reach." };
  const brokerage = text(body.brokerage, 120);
  if (brokerage.length < 2) return { ok: false, field: "brokerage", message: "Add your brokerage (the broker of record)." };
  const licenseType = text(body.licenseType, 20);
  const lt = LICENSE_TYPES.find((x) => x.id === licenseType);
  if (!lt) return { ok: false, field: "licenseType", message: "Pick your licence type." };
  const licenseNumber = text(body.licenseNumber, 30).toUpperCase();
  if (!/^[A-Z0-9-]{5,30}$/.test(licenseNumber)) return { ok: false, field: "licenseNumber", message: "Add your licence number." };
  const licenseState = text(body.licenseState, 2).toUpperCase();
  if (!STATE.test(licenseState)) return { ok: false, field: "licenseState", message: "Add the state that issued your licence (two letters)." };
  const licenseExpires = text(body.licenseExpires, 10);
  if (licenseExpires && (!ISO.test(licenseExpires) || licenseExpires <= today)) return { ok: false, field: "licenseExpires", message: "That licence has expired — renew it first." };
  const supervisorName = text(body.supervisorName, 120) || null;
  const supervisorEmail = text(body.supervisorEmail, 200).toLowerCase() || null;
  if (lt.needsBroker) {
    if (!supervisorName || !supervisorEmail || !EMAIL.test(supervisorEmail)) return { ok: false, field: "supervisorEmail", message: "Add your supervising broker's name and email — they sign the referral agreement too." };
    if (supervisorEmail === email) return { ok: false, field: "supervisorEmail", message: "Your supervising broker needs their own email." };
  }
  const markets = [...new Set(list(body.markets).map((m) => m.slice(0, 50)))].slice(0, 20);
  if (!markets.length) return { ok: false, field: "markets", message: "Add at least one city or neighborhood you cover." };
  const specialties = [...new Set(list(body.specialties))].filter((s) => has(SPECIALTIES, s));
  if (!specialties.length) return { ok: false, field: "specialties", message: "Pick at least one specialty." };
  const languages = [...new Set(list(body.languages))].filter((l) => (LANGUAGES as readonly string[]).includes(l));
  const capacity = int(body.capacity, 1, 50);
  const site = text(body.site, 200);
  if (site && !/^https?:\/\/[^\s]+\.[^\s]+$/.test(site)) return { ok: false, field: "site", message: "The website should start with https://" };
  if (body.consent !== true && body.consent !== "on" && body.consent !== "true") return { ok: false, field: "consent", message: "Please confirm your licence is active and the details are correct." };
  return {
    ok: true,
    spam: text(body.website, 200) !== "",
    value: {
      name,
      email,
      phone,
      brokerage,
      licenseType,
      licenseNumber,
      licenseState,
      licenseExpires: licenseExpires || null,
      supervisorName: lt.needsBroker ? supervisorName : null,
      supervisorEmail: lt.needsBroker ? supervisorEmail : null,
      markets,
      specialties,
      languages: languages.length ? languages : ["English"],
      bio: note(body.bio, 600),
      website: site || null,
      capacity: capacity === null || Number.isNaN(capacity) ? 5 : capacity,
    },
  };
}

export function licenseLookupUrl(state: string) {
  return state === "NY" ? "https://appext20.dos.ny.gov/lcns_public/chk_load" : null;
}

/* ------------------------------------------------------------------------
   Matching
   ------------------------------------------------------------------------ */

export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export type MatchPartner = {
  id: string;
  status: string;
  licenseState: string;
  markets: string[];
  specialties: string[];
  languages: string[];
  capacity: number;
  openLeads: number;
  medianReplyMins: number | null;
  offers: number;
  accepted: number;
  wins: number;
  rating: number | null;
  lastOfferedAt: number | null;
};

export type MatchSearch = { city: string; state: string; neighborhoods: string[]; homeType: string; buildingAge: string; term: string; language: string | null; budgetMax: number };

/** Score one partner for one brief; null when they can't take it. Every point has a reason. */
export function matchScore(s: MatchSearch, p: MatchPartner, now: number): { score: number; reasons: string[] } | null {
  if (p.status !== "active") return null;
  if (p.licenseState !== s.state) return null;
  if (p.openLeads >= p.capacity) return null;
  const markets = p.markets.map(norm);
  const city = norm(s.city);
  const hoods = s.neighborhoods.map(norm);
  const cityHit = markets.some((m) => m === city || m.startsWith(`${city} `) || city.startsWith(`${m} `));
  const hoodHits = hoods.filter((h) => markets.includes(h));
  if (!cityHit && !hoodHits.length) return null;
  const reasons: string[] = [];
  let n = 0;
  if (cityHit) {
    n += 40;
    reasons.push(`Works ${s.city}`);
  }
  if (hoodHits.length) {
    n += Math.min(20, 10 * hoodHits.length);
    reasons.push(`Knows ${hoodHits.length === 1 ? "the neighborhood" : `${hoodHits.length} of the neighborhoods`}`);
  }
  const specialty = HOME_TYPES.find((h) => h.id === s.homeType)?.specialty;
  if (specialty && p.specialties.includes(specialty)) {
    n += 15;
    reasons.push("Specialises in this kind of home");
  }
  if (s.buildingAge === "new" && p.specialties.includes("newdev")) {
    n += 5;
    reasons.push("New-development specialist");
  }
  if (s.term === "mid" && p.specialties.includes("furnished")) {
    n += 5;
    reasons.push("Short-term specialist");
  }
  if (s.budgetMax < 2000 && p.specialties.includes("budget")) n += 4;
  if (s.budgetMax >= 6000 && p.specialties.includes("luxury")) n += 4;
  if (s.language && p.languages.includes(s.language)) {
    n += 10;
    reasons.push(`Speaks ${s.language}`);
  }
  if (p.medianReplyMins !== null) {
    if (p.medianReplyMins <= 60) {
      n += 10;
      reasons.push("Replies within the hour");
    } else if (p.medianReplyMins <= 240) n += 6;
    else if (p.medianReplyMins > 24 * 60) n -= 6;
  }
  if (p.offers >= 3) n += Math.round((p.accepted / p.offers) * 5);
  if (p.accepted >= 3) {
    n += Math.round(Math.min(1, p.wins / p.accepted) * 6);
    if (p.wins) reasons.push(`${p.wins} lease${p.wins === 1 ? "" : "s"} closed through RentLeaks`);
  }
  if (p.rating !== null) n += Math.round((p.rating - 3) * 3);
  n -= p.openLeads * 2;
  // Rotation: a partner who hasn't had a lead for a while moves up a little.
  const idle = p.lastOfferedAt === null ? 14 : Math.min(14, (now - p.lastOfferedAt) / 86_400_000);
  n += Math.round(idle / 3);
  return { score: Math.max(1, Math.min(100, n)), reasons };
}

export function rankPartners(s: MatchSearch, partners: MatchPartner[], now: number, exclude: Set<string> = new Set()) {
  return partners
    .filter((p) => !exclude.has(p.id))
    .map((p) => ({ p, m: matchScore(s, p, now) }))
    .filter((x): x is { p: MatchPartner; m: { score: number; reasons: string[] } } => x.m !== null)
    .sort((a, b) => b.m.score - a.m.score || (a.p.lastOfferedAt ?? 0) - (b.p.lastOfferedAt ?? 0));
}

export function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/* ------------------------------------------------------------------------
   Agreements
   ------------------------------------------------------------------------ */

export const TENANT_AGREEMENT_VERSION = "tenant-rep-2026.09";
export const PARTNER_AGREEMENT_VERSION = "partner-referral-2026.09";

export type Section = { heading: string; body: string };

export const ESIGN_DISCLOSURE =
  "By checking the box you agree to receive this agreement and related notices electronically and to sign it electronically. " +
  "Your electronic signature has the same effect as a handwritten one. You can ask for a paper copy at any time, free of charge, by replying to any RentLeaks email; " +
  "you can withdraw this consent the same way before you sign, and the agreement will then be sent to you on paper instead. " +
  "To view and keep this agreement you need a current web browser and the ability to print or save a page as PDF. You'll get a copy by email when everyone has signed.";

export type Referrer = { name: string; licence: string; states: string; contact: string };

function referrerLine(r: Referrer) {
  return r.licence ? `${r.name}, a licensed real estate broker (licence ${r.licence}, ${r.states})${r.contact ? `, ${r.contact}` : ""}` : `${r.name}`;
}

export type TenantAgreementInput = {
  date: string;
  tenant: { name: string; email: string };
  partner: { name: string; email: string; licenseType: string; licenseNumber: string; licenseState: string; brokerage: string; supervisorName: string | null };
  search: MatchSearch & { bedrooms: number | null; moveIn: string | null; termMonths: number | null; homeType: string; mustHaves: string[] };
  fee: { type: string; value: number };
  termDays: number;
  referralPctBp: number;
  referrer: Referrer;
};

export function tenantAgreement(a: TenantAgreementInput): { title: string; sections: Section[]; terms: Record<string, unknown> } {
  const lt = LICENSE_TYPES.find((x) => x.id === a.partner.licenseType)?.label.toLowerCase() ?? "real estate licensee";
  const est = feeEstimateCents(a.fee.type, a.fee.value, a.search.budgetMax);
  const ny = a.search.state === "NY";
  const beds = a.search.bedrooms === null ? "" : a.search.bedrooms === 0 ? "a studio" : `${a.search.bedrooms} bedroom${a.search.bedrooms === 1 ? "" : "s"}`;
  const sections: Section[] = [
    {
      heading: "1. Who this agreement is between",
      body:
        `You, ${a.tenant.name} (${a.tenant.email}) — the "Tenant" — and ${a.partner.brokerage} — the "Brokerage" — acting through ${a.partner.name}, a licensed ${lt} ` +
        `(licence ${a.partner.licenseNumber}, ${a.partner.licenseState}), your "Broker"${a.partner.supervisorName ? `, supervised by ${a.partner.supervisorName}, broker of record` : ""}. ` +
        `The introduction was made through RentLeaks by ${referrerLine(a.referrer)}. RentLeaks is not a party to your search and does not represent you or any landlord.`,
    },
    {
      heading: "2. What you are hiring your Broker to do",
      body:
        `Find you a place to rent in ${a.search.city}, ${a.search.state}${a.search.neighborhoods.length ? ` (${a.search.neighborhoods.join(", ")})` : ""}: ${[label(HOME_TYPES, a.search.homeType), beds].filter(Boolean).join(", ")}, ` +
        `up to $${a.search.budgetMax.toLocaleString("en-US")} a month${a.search.moveIn ? `, moving in around ${a.search.moveIn}` : ""}${a.search.termMonths ? ` for about ${a.search.termMonths} months` : ""}. ` +
        "Your Broker works for you: searching, arranging viewings in person or by live video, advising on buildings, rents and lease terms, helping with your application and negotiating on your behalf. " +
        "You can change the brief at any time by telling your Broker in writing.",
    },
    {
      heading: "3. How long it lasts and how to end it",
      body:
        `It starts when the last person signs below and ends after ${a.termDays} days, or earlier when you sign a lease. ` +
        "You can end it at any time by email to your Broker; so can your Broker. If you end it, no fee is owed unless, within 30 days, you sign a lease for a home your Broker showed or introduced to you before it ended.",
    },
    {
      heading: "4. The fee",
      body:
        `You agree to pay the Brokerage ${feeLabel(a.fee.type, a.fee.value)} — about ${usd(est)} at a rent of $${a.search.budgetMax.toLocaleString("en-US")} a month; the exact amount is worked out from the rent in your signed lease. ` +
        "The fee is earned only if you sign a lease for a home your Broker found, showed or introduced to you during this agreement, and it is due when that lease is signed — never before. " +
        "No lease, no fee. There are no other charges from your Broker, and nothing is owed to RentLeaks. " +
        "You chose to hire your own broker; no landlord required it" +
        (ny ? ", and under New York City's FARE Act the fee for a broker who works for a landlord is the landlord's to pay." : "."),
    },
    {
      heading: "5. Your Broker's promises",
      body:
        "Your Broker acts in your interest, tells you in writing before any viewing if they or the Brokerage also represent that home's landlord, and never charges you a fee for a home they represent for the landlord. " +
        "They will not make any specific home available only on condition that you hire them. They follow fair-housing law in every step and never steer or screen by any protected characteristic. " +
        (ny ? "You confirm you received the New York State Disclosure Form for Landlord and Tenant (DOS-1735-f), which explains agency relationships, and that your Broker is acting as the tenant's agent. " : "") +
        "Your Broker will give you any application fee limits and required disclosures that apply in your city.",
    },
    {
      heading: "6. Your money",
      body:
        "Rent and security deposits go only to the landlord or its managing agent, against a signed lease. Never wire money or pay anyone before you've seen the home (in person or on a live video call) and have a lease to sign. " +
        "RentLeaks never collects rent, deposits or broker fees.",
    },
    {
      heading: "7. The RentLeaks referral",
      body:
        `The Brokerage pays RentLeaks' licensed brokerage a referral fee of ${trim(a.referralPctBp / 100)}% out of the fee it receives. It is paid by the Brokerage, not by you, and it does not increase what you pay.`,
    },
    {
      heading: "8. Your details",
      body: "Your contact details are shared with your Broker only for this search. Your Broker won't sell them or add you to marketing lists without asking.",
    },
    {
      heading: "9. Signing electronically",
      body: `${ESIGN_DISCLOSURE} Each party can keep a copy. The copy shows a fingerprint (SHA-256) of this text so anyone can check it hasn't changed.`,
    },
    {
      heading: "10. Law",
      body: `The laws of the State of ${a.search.state} apply. This is the whole agreement about your search; any change must be in writing and agreed by both of you.`,
    },
  ];
  return {
    title: `Tenant representation & fee agreement — ${a.tenant.name} and ${a.partner.brokerage}`,
    sections,
    terms: {
      version: TENANT_AGREEMENT_VERSION,
      date: a.date,
      feeType: a.fee.type,
      feeValue: a.fee.value,
      feeEstimateCents: est,
      termDays: a.termDays,
      referralPctBp: a.referralPctBp,
      state: a.search.state,
      agencyDisclosure: ny ? "NY DOS-1735-f" : null,
    },
  };
}

export type PartnerAgreementInput = {
  date: string;
  partner: { name: string; email: string; licenseType: string; licenseNumber: string; licenseState: string; brokerage: string; supervisorName: string | null; supervisorEmail: string | null };
  referralPctBp: number;
  offerHours: number;
  referrer: Referrer;
};

export function partnerAgreement(a: PartnerAgreementInput): { title: string; sections: Section[]; terms: Record<string, unknown> } {
  const lt = LICENSE_TYPES.find((x) => x.id === a.partner.licenseType);
  const pct = trim(a.referralPctBp / 100);
  const sections: Section[] = [
    {
      heading: "1. Who this agreement is between",
      body:
        `${referrerLine(a.referrer)} — "RentLeaks" — and ${a.partner.brokerage} — the "Brokerage" — together with ${a.partner.name}, a licensed ${lt?.label.toLowerCase() ?? "real estate licensee"} ` +
        `(licence ${a.partner.licenseNumber}, ${a.partner.licenseState}) — the "Partner"${a.partner.supervisorName ? `, whose broker of record ${a.partner.supervisorName} signs for the Brokerage` : ""}.`,
    },
    {
      heading: "2. Referrals",
      body:
        "RentLeaks introduces tenants who have asked to hire a broker. Each introduction is a lead offer showing the tenant's brief without contact details. " +
        `The Partner may accept within ${a.offerHours} hours with a fee at or under the tenant's cap and a short pitch, or decline. The tenant chooses; RentLeaks does not guarantee any number of leads.`,
    },
    {
      heading: "3. The referral fee",
      body:
        `For every tenant introduced through RentLeaks, the Brokerage pays RentLeaks ${pct}% of the gross fee it receives for a lease that tenant signs within 12 months of the introduction, whatever home it is for. ` +
        "The Partner reports each lease in the RentLeaks portal within five business days of signing; RentLeaks invoices the Brokerage, which pays within ten days of receiving its fee. " +
        "Referral fees are paid only between brokerages, as New York Real Property Law § 442 requires — never by or to an individual salesperson.",
    },
    {
      heading: "4. Licences",
      body:
        "The Partner and the Brokerage keep their licences active and in good standing, tell RentLeaks within five business days of any change, and allow RentLeaks to verify them with the state. " +
        "Only licensed people working under the Brokerage work a referred search.",
    },
    {
      heading: "5. How referred tenants are served",
      body:
        "Before charging a tenant anything, the Partner has the tenant sign the RentLeaks tenant representation & fee agreement, with the fee the tenant accepted. " +
        "The Partner never charges a tenant for a home the Partner or the Brokerage represents for the landlord, never conditions a specific home on being hired, gives every agency and fee disclosure the law requires, " +
        "follows fair-housing law in every ad, conversation and screening, and never asks a tenant to pay before a viewing and a lease. The Partner keeps the search moving and updates its stage in the portal.",
    },
    {
      heading: "6. No going around",
      body: "For 12 months after an introduction, a lease with that tenant counts as a referred lease, whether or not it was arranged through the portal.",
    },
    {
      heading: "7. Tenant data",
      body: "Tenant details are used only for that tenant's search, kept secure, never sold, and deleted on the tenant's request unless the law requires keeping them.",
    },
    {
      heading: "8. Records",
      body: "Both sides keep this agreement, tenant agreements and fee records for at least three years, and share them on request with the other side or a regulator.",
    },
    {
      heading: "9. Ending the agreement",
      body: "Either side may end this agreement with 30 days' email notice, or at once if a licence lapses or this agreement is seriously broken. Referral fees for tenants introduced before the end remain payable.",
    },
    {
      heading: "10. Signing electronically",
      body: `${ESIGN_DISCLOSURE} RentLeaks countersigns after verifying the licence.`,
    },
    {
      heading: "11. Law",
      body: `The laws of the State of ${a.partner.licenseState} apply. This is the whole agreement; changes must be in writing and signed by both sides.`,
    },
  ];
  return {
    title: `Referral partner agreement — ${a.partner.brokerage} (${a.partner.name})`,
    sections,
    terms: { version: PARTNER_AGREEMENT_VERSION, date: a.date, referralPctBp: a.referralPctBp, offerHours: a.offerHours, state: a.partner.licenseState },
  };
}

/** The exact text that is hashed. Stable key order; any change to a word changes the hash. */
export function canonicalDocument(doc: { title: string; sections: Section[]; terms: Record<string, unknown> }) {
  const keys = Object.keys(doc.terms).sort();
  const terms = keys.map((k) => `${k}=${JSON.stringify(doc.terms[k])}`).join("\n");
  return [`# ${doc.title}`, ...doc.sections.map((s) => `## ${s.heading}\n${s.body}`), `---\n${terms}`].join("\n\n");
}

/** Typed signatures must be the signer's own name (case and spacing don't matter). */
export function signatureMatches(typed: string, name: string) {
  const a = norm(typed);
  const b = norm(name);
  if (a.length < 2) return false;
  if (a === b) return true;
  const parts = b.split(" ");
  return parts.length > 1 && a === `${parts[0]} ${parts[parts.length - 1]}`;
}

/** "203.0.113.42" → "203.0.113.x"; IPv6 keeps its first three groups. */
export function maskIp(ip: string | null | undefined) {
  if (!ip) return "—";
  if (ip.includes(".")) return ip.split(".").slice(0, 3).join(".") + ".x";
  return ip.split(":").slice(0, 3).join(":") + ":…";
}

/* ------------------------------------------------------------------------
   Lead magnets: the two guides, the consent people give for them, and the
   public roster of partner headshots. The website, the API and the desk all
   read these, so a guide can never exist in one place and not another.
   ------------------------------------------------------------------------ */

export type Audience = "tenant" | "partner";

export type Guide = {
  id: string;
  audience: Audience;
  title: string;
  /** One line, for the card and the email subject. */
  tagline: string;
  file: string;
  pages: number;
  inside: string[];
  /** What the form asks for beyond name and email. */
  extra: "city" | "brokerage";
  cta: string;
};

export const GUIDES: Guide[] = [
  {
    id: "renter-playbook",
    audience: "tenant",
    title: "The New York renter's broker playbook",
    tagline: "Who pays a broker fee now, what your agreement must say, and how to hire an agent for a fee you set.",
    file: "rentleaks-renter-broker-playbook.pdf",
    pages: 5,
    inside: [
      "The FARE Act in plain English — and the one case where a renter still pays",
      "What a broker actually costs: months, percentages and flat fees, side by side",
      "A fee-cap worksheet you fill in before you talk to anyone",
      "The eight things a fair representation & fee agreement says",
      "12 questions to ask a broker (and four reasons to walk away)",
    ],
    extra: "city",
    cta: "Send me the playbook",
  },
  {
    id: "partner-kit",
    audience: "partner",
    title: "RentLeaks referral partner kit",
    tagline: "How the referral program works, what a lead looks like, what it pays, and what you sign.",
    file: "rentleaks-referral-partner-kit.pdf",
    pages: 5,
    inside: [
      "What a lead contains before you spend a minute on it",
      "The fee math, with worked numbers at five rent levels",
      "How leads are shared out — and why you can't pay for position",
      "The referral agreement, section by section",
      "A compliance checklist to print and keep with your files",
    ],
    extra: "brokerage",
    cta: "Send me the partner kit",
  },
];

export const GUIDE = new Map(GUIDES.map((g) => [g.id, g]));

/** The sentence someone agrees to when they ask for a guide. Stored with the lead. */
export const GUIDE_CONSENT: Record<Audience, string> = {
  tenant:
    "Email me the guide and have a RentLeaks agent or one of our referral partner brokers contact me by email, phone or text about finding a rental. " +
    "I can ask to stop at any time by replying to any email.",
  partner:
    "Email me the kit and have the RentLeaks broker network team contact me by email, phone or text about joining the referral partner program. " +
    "I can ask to stop at any time by replying to any email.",
};

/** The one-line promise printed under both forms. */
export const GUIDE_PROMISE = "One guide, a reply from a person, and nothing else. We never sell your details, and there's nothing to pay.";

export const ROSTER_SLOTS = 10;

export type RosterCard = {
  id: string;
  name: string;
  brokerage: string;
  headline: string;
  markets: string[];
  languages: string[];
  photo: string | null;
  rating: number | null;
  leases: number;
  state: string;
};

export type GuideInput = {
  audience: Audience;
  guideId: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  brokerage: string | null;
  licenseState: string | null;
  consentText: string;
  source: string;
  campaign: string | null;
  referrer: string | null;
};

export function parseGuide(body: Record<string, unknown>): Parse<GuideInput> {
  const guideId = text(body.guideId, 40);
  const guide = GUIDE.get(guideId);
  if (!guide) return { ok: false, field: "guideId", message: "Pick a guide." };
  const name = text(body.name, 120);
  if (name.length < 2) return { ok: false, field: "name", message: "Add your name." };
  const email = text(body.email, 200).toLowerCase();
  if (!EMAIL.test(email)) return { ok: false, field: "email", message: "Add an email we can send the guide to." };
  const phone = text(body.phone, 40);
  if (phone && !/^\+?[\d\s().-]{7,}$/.test(phone)) return { ok: false, field: "phone", message: "That phone number doesn't look right." };
  if (body.consent !== true && body.consent !== "on" && body.consent !== "true") {
    return { ok: false, field: "consent", message: "Please agree to be contacted so we can send the guide and follow up." };
  }
  const where = splitCity(text(body.city, 80));
  const brokerage = text(body.brokerage, 120);
  if (guide.audience === "partner" && brokerage.length < 2) return { ok: false, field: "brokerage", message: "Add your brokerage." };
  const src = text(body.source, 24).toLowerCase();
  return {
    ok: true,
    spam: text(body.website, 200) !== "",
    value: {
      audience: guide.audience,
      guideId,
      name,
      email,
      phone: phone || null,
      city: where.city ? [where.city, where.state].filter(Boolean).join(", ").slice(0, 80) : null,
      brokerage: brokerage || null,
      licenseState: guide.audience === "partner" && STATE.test(text(body.licenseState, 2).toUpperCase()) ? text(body.licenseState, 2).toUpperCase() : null,
      consentText: GUIDE_CONSENT[guide.audience],
      source: /^[a-z0-9_]{1,24}$/.test(src) ? src : "web",
      campaign: text(body.campaign, 80) || null,
      referrer: text(body.referrer, 300) || null,
    },
  };
}

/** What a renter would pay at each fee shape — the calculator on the public page uses the same math. */
export function feeCompare(monthlyRent: number) {
  const rent = Math.max(0, Math.round(monthlyRent));
  return [
    { label: "One month's rent", cents: rent * 100 },
    { label: "12% of a year", cents: Math.round(rent * 12 * 0.12) * 100 },
    { label: "15% of a year", cents: Math.round(rent * 12 * 0.15) * 100 },
  ];
}
