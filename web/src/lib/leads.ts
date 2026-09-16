/**
 * Leads from the public forms — above all the Facebook landing page
 * (rentleaks.com/facebook.html), which is where the Page's "Book now" button
 * and posts send people.
 *
 * Three kinds:
 *   match   — "find me a home": city, budget, dates; no listing yet;
 *   viewing — a viewing of one listing, with up to three preferred slots;
 *   stay    — a request to book one listing for given dates.
 *
 * Nothing here takes money. A "booking" is a request the host accepts or
 * declines; RentLeaks is never a party to rent or deposits.
 *
 * Fair housing: the form asks about the home (where, when, budget, type), never
 * about the people — no household size, age, children, income source or
 * nationality. Keep it that way.
 *
 * No server imports: the same rules run in tests and could run in a client.
 */

export const LEAD_KINDS = ["match", "viewing", "stay"] as const;
export const LEAD_STATUSES = ["new", "contacted", "booked", "closed", "spam"] as const;
export const LEAD_SOURCES = ["fb_page", "fb_button", "fb_post", "fb_ad", "messenger", "instagram", "web"] as const;
export const VIEWING_WINDOWS = ["morning", "afternoon", "evening"] as const;
export const VIEWING_MODES = ["in-person", "video"] as const;

export type LeadKind = (typeof LEAD_KINDS)[number];
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type ViewingSlot = { date: string; window: (typeof VIEWING_WINDOWS)[number] };

export type LeadInput = {
  kind: LeadKind;
  listingId: string | null;
  name: string;
  email: string;
  phone: string | null;
  cityId: string | null;
  housingType: string | null;
  budgetMax: number | null;
  currency: string;
  moveIn: string | null;
  moveOut: string | null;
  stayMonths: number | null;
  viewingSlots: ViewingSlot[];
  viewingMode: (typeof VIEWING_MODES)[number] | null;
  message: string;
  consent: true;
  source: (typeof LEAD_SOURCES)[number];
  campaign: string | null;
  referrer: string | null;
};

export type LeadParse =
  | { ok: true; lead: LeadInput; spam: boolean }
  | { ok: false; field: string; message: string };

export const LEAD_WINDOW_LABEL: Record<ViewingSlot["window"], string> = {
  morning: "Morning (9–12)",
  afternoon: "Afternoon (12–5)",
  evening: "Evening (5–8)",
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SLUG = /^[a-z0-9][a-z0-9-]{0,59}$/;
const MAX_VIEWING_DAYS = 60;

function text(v: unknown, max: number) {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function isDate(v: string) {
  if (!ISO.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function intIn(v: unknown, min: number, max: number) {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}

const bad = (field: string, message: string): LeadParse => ({ ok: false, field, message });

/**
 * Validate a submitted lead. `today` is the caller's date (UTC, YYYY-MM-DD) so
 * the rules are testable; dates before it are refused.
 */
export function parseLead(body: Record<string, unknown>, today: string): LeadParse {
  /* Honeypot: a field people never see. Bots fill it; we answer as if all was
     well and store nothing. */
  const spam = text(body.website, 200) !== "";

  const kind = LEAD_KINDS.find((k) => k === body.kind);
  if (!kind) return bad("kind", "Choose what you would like to do.");

  const name = text(body.name, 80);
  if (name.length < 2) return bad("name", "Add your name.");
  /* The renter's copy goes to the address given, so a name must not be a way
     to put a link in front of someone else. */
  if (/https?:|www\.|@|<|>/i.test(name)) return bad("name", "Add just your name.");
  const email = text(body.email, 160).toLowerCase();
  if (!EMAIL.test(email)) return bad("email", "Add an email address we can reply to.");
  const phoneRaw = text(body.phone, 32);
  let phone: string | null = null;
  if (phoneRaw) {
    const digits = phoneRaw.replace(/\D/g, "");
    if (!/^[+\d][\d\s().-]*$/.test(phoneRaw) || digits.length < 7 || digits.length > 15) {
      return bad("phone", "That phone number doesn't look right. Leave it empty if you prefer email.");
    }
    phone = phoneRaw;
  }
  if (body.consent !== true) {
    return bad("consent", "Tick the box so we are allowed to contact you about this request.");
  }

  const listingId = text(body.listingId, 200) || null;
  if (kind !== "match" && !listingId) return bad("listingId", "Choose a home first.");

  const cityId = text(body.cityId, 60) || null;
  if (cityId && !SLUG.test(cityId)) return bad("cityId", "Choose a city from the list.");
  const housingType = text(body.housingType, 30) || null;
  if (housingType && !SLUG.test(housingType)) return bad("housingType", "Choose a type of home from the list.");

  const budgetMax = intIn(body.budgetMax, 0, 1_000_000);
  if (budgetMax === undefined) return bad("budgetMax", "Budget should be a monthly amount.");
  const currency = /^[A-Z]{3}$/.test(text(body.currency, 3)) ? text(body.currency, 3) : "USD";
  const stayMonths = intIn(body.stayMonths, 1, 36);
  if (stayMonths === undefined) return bad("stayMonths", "Stay length should be between 1 and 36 months.");

  const moveIn = text(body.moveIn, 10) || null;
  const moveOut = text(body.moveOut, 10) || null;
  if (moveIn && !isDate(moveIn)) return bad("moveIn", "Move-in should be a date.");
  if (moveOut && !isDate(moveOut)) return bad("moveOut", "Move-out should be a date.");
  if (moveIn && moveIn < today) return bad("moveIn", "Move-in can't be in the past.");
  if (kind === "stay") {
    if (!moveIn) return bad("moveIn", "Add a move-in date.");
    if (!moveOut) return bad("moveOut", "Add a move-out date.");
  }
  if (moveIn && moveOut && moveOut <= moveIn) return bad("moveOut", "Move-out must be after move-in.");

  const viewingSlots: ViewingSlot[] = [];
  let viewingMode: LeadInput["viewingMode"] = null;
  if (kind === "viewing") {
    const raw = Array.isArray(body.viewingSlots) ? body.viewingSlots.slice(0, 6) : [];
    const last = addDays(today, MAX_VIEWING_DAYS);
    for (const s of raw) {
      const slot = (s ?? {}) as Record<string, unknown>;
      const date = text(slot.date, 10);
      const window = VIEWING_WINDOWS.find((w) => w === slot.window);
      if (!date && !window) continue;
      if (!isDate(date) || date < today || date > last) {
        return bad("viewingSlots", `Pick viewing dates between today and ${last}.`);
      }
      if (!window) return bad("viewingSlots", "Pick a time of day for each date.");
      if (viewingSlots.length < 3 && !viewingSlots.some((x) => x.date === date && x.window === window)) {
        viewingSlots.push({ date, window });
      }
    }
    if (!viewingSlots.length) return bad("viewingSlots", "Pick at least one date and time for the viewing.");
    viewingMode = VIEWING_MODES.find((m) => m === body.viewingMode) ?? "in-person";
  }

  const source = LEAD_SOURCES.find((s) => s === body.source) ?? "web";

  return {
    ok: true,
    spam,
    lead: {
      kind,
      listingId: kind === "match" ? null : listingId,
      name,
      email,
      phone,
      cityId,
      housingType,
      budgetMax,
      currency,
      moveIn,
      moveOut,
      stayMonths,
      viewingSlots,
      viewingMode,
      message: typeof body.message === "string" ? body.message.trim().slice(0, 1000) : "",
      consent: true,
      source,
      campaign: text(body.campaign, 80) || null,
      referrer: text(body.referrer, 200) || null,
    },
  };
}

export const KIND_LABEL: Record<LeadKind, string> = {
  match: "Find me a home",
  viewing: "Viewing request",
  stay: "Request to book",
};

/** One plain-text summary, used in the emails and in the Messenger hand-off. */
export function leadSummary(
  lead: Pick<LeadInput, "kind" | "name" | "cityId" | "housingType" | "budgetMax" | "currency" | "moveIn" | "moveOut" | "stayMonths" | "viewingSlots" | "viewingMode" | "message">,
  listing?: { title: string; url?: string } | null,
) {
  const lines = [`${KIND_LABEL[lead.kind]} — ${lead.name}`];
  if (listing) lines.push(`Home: ${listing.title}${listing.url ? ` (${listing.url})` : ""}`);
  if (lead.cityId) lines.push(`City: ${lead.cityId}`);
  if (lead.housingType) lines.push(`Type: ${lead.housingType}`);
  if (lead.budgetMax) lines.push(`Budget: up to ${lead.budgetMax.toLocaleString("en-US")} ${lead.currency}/month`);
  if (lead.moveIn) lines.push(`Move-in: ${lead.moveIn}${lead.moveOut ? ` · Move-out: ${lead.moveOut}` : ""}`);
  if (lead.stayMonths) lines.push(`Stay: ${lead.stayMonths} month${lead.stayMonths === 1 ? "" : "s"}`);
  if (lead.viewingSlots.length) {
    lines.push(
      `Viewing (${lead.viewingMode === "video" ? "video call" : "in person"}): ` +
        lead.viewingSlots.map((s) => `${s.date} ${LEAD_WINDOW_LABEL[s.window]}`).join("; "),
    );
  }
  if (lead.message) lines.push(`Note: ${lead.message}`);
  return lines.join("\n");
}

/**
 * A link that opens a chat with the Page. `ref` reaches a Messenger webhook if
 * one is ever connected; `text` pre-fills the message where Messenger honours
 * it (the landing page also copies the summary, so it can be pasted).
 */
export function messengerLink(summary: string, ref?: string, base = MESSENGER_URL) {
  const qs = new URLSearchParams();
  if (ref) qs.set("ref", ref);
  qs.set("text", summary.slice(0, 600));
  return `${base}?${qs.toString()}`;
}

/* Kept in step with the Page username by tools/apply-facebook.py. */
export const MESSENGER_URL = "https://m.me/rentleakshq";
