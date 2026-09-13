/**
 * Jurisdiction rules.
 *
 * The DATA lives in ./rules.json — one file, read by this typed wrapper and,
 * via tools/build-rules.mjs, by the static layer's rentleaks-rules.js. Only
 * the merge below is written twice, and a merge function does not drift; a
 * deposit cap does, which is why it is not written twice any more.
 *
 * Every rule carries the instrument it comes from and the date it took effect,
 * so a stale rule is visible rather than silently wrong. Rules resolve city →
 * region → country → defaults.
 *
 * This is research, not legal advice.
 */

import book from "./rules.json";

export type Source = { label: string; eff: string; url: string };

export const SOURCES: Record<string, Source> = book.sources as Record<string, Source>;
export const BANNED_TERMS: string[] = book.bannedTerms;
export const FX_PER_USD: Record<string, number> = book.fx.perUsd;
export const FX_UPDATED: string = book.fx.updated;

const CURRENCY_BY_COUNTRY: Record<string, string> = book.fx.byCountry;

export function currencyForCountry(code: string) {
  return CURRENCY_BY_COUNTRY[code] || "USD";
}

/** Amount in `from`, expressed in US dollars. */
export function toUsd(amount: number, from: string) {
  const rate = FX_PER_USD[from] ?? 1;
  return rate ? (Number(amount) || 0) / rate : Number(amount) || 0;
}

/** Convert between any two supported currencies. */
export function convert(amount: number, from: string, to: string) {
  if (from === to) return Number(amount) || 0;
  return toUsd(amount, from) * (FX_PER_USD[to] ?? 1);
}

export type Rules = {
  cityName: string;
  country: string;
  region: string;
  minStayDays: number;
  minStaySrc: Source | null;
  depositCapMonths: number | null;
  depositSrc: Source | null;
  appFeeCap: number | null;
  appFeeCurrency: string;
  appFeeSrc: Source | null;
  applicationFeeBanned: boolean;
  applicationFeeSrc: Source | null;
  screeningFeeCap: number | null;
  moveInFeesBarred: boolean;
  moveInFeesSrc: Source | null;
  subLessorNamed: boolean;
  landlordAgentMayChargeTenant: boolean;
  tenantBrokerFeeSrc: Source | null;
  soiProtected: boolean;
  soiSrc: Source | null;
  fairChance: boolean;
  registrationRequired: boolean;
  registrationSrc: Source | null;
  allInDisclosure: boolean;
  allInSrc: Source | null;
  listingFeeDisclosureSrc: Source | null;
  subletSurchargePct: number | null;
  subletSurchargeSrc: Source | null;
  contractType: string | null;
  unassessed: boolean;
  notes: string[];
};

/* Fields whose JSON value is a key into `sources`. */
const SRC_FIELDS = [
  "minStaySrc", "depositSrc", "appFeeSrc", "applicationFeeSrc", "moveInFeesSrc",
  "tenantBrokerFeeSrc", "soiSrc", "fairChanceSrc", "allInSrc", "listingFeeDisclosureSrc",
  "registrationSrc", "subletSurchargeSrc", "brokerLicenceSrc", "reusableSrc",
  "screeningLaw", "adLaw", "dataLaw",
] as const;

type Bag = Record<string, unknown>;

export function rulesFor(input: { cityId: string; citySlug?: string; cityName?: string; state?: string; country?: string }): Rules {
  const out: Bag = { ...(book.defaults as Bag), notes: [] as string[] };

  const merge = (src?: Bag) => {
    if (!src) return;
    for (const [k, v] of Object.entries(src)) {
      if (k === "notes") {
        out.notes = (out.notes as string[]).concat((v as string[]) || []);
        continue;
      }
      out[k] = v;
    }
  };

  /* rules.json keys cities by slug ("new-york"), the database by id ("nyc").
     Try both rather than silently resolving New York to the bare defaults —
     which is the shape of bug that turns a compliance panel into decoration. */
  merge((book.country as Bag)[input.country || "US"] as Bag);
  merge((book.region as Bag)[input.state || ""] as Bag);
  const cityRules =
    (input.citySlug ? ((book.city as Bag)[input.citySlug] as Bag) : undefined) ??
    ((book.city as Bag)[input.cityId] as Bag);
  merge(cityRules);

  /* Resolve source keys to source objects, so a citation cannot point at
     nothing. */
  for (const field of SRC_FIELDS) {
    const value = out[field];
    if (typeof value === "string") out[field] = SOURCES[value] ?? null;
  }

  out.cityName = input.cityName || "";
  out.country = input.country || "US";
  out.region = input.state || "";
  return out as unknown as Rules;
}

/* ------------------------------------------------------------------------ */

export type Fee = { type: string; amount: number; cadence: "monthly" | "once"; mandatory: boolean };

export type ListingDraft = {
  role: string;
  housingType: string;
  cityId: string;
  citySlug?: string;
  cityName?: string;
  state?: string;
  country?: string;
  title: string;
  neighborhood: string;
  address: string;
  description: string;
  price: number;
  deposit: number;
  fees: Fee[];
  availableFrom: string;
  availableUntil: string;
  minStayMonths: number;
  maxStayMonths: number;
  leaseEnd?: string;
  consentStatus?: string;
  registrationNumber?: string;
  photoCount: number;
};

export type Check = {
  id: string;
  ok: boolean;
  blocking: boolean;
  title: string;
  why: string;
};

/* The lexicon lives in rules.json and is exported at the top of this file. */

export function scanText(text: string): string[] {
  const low = String(text || "").toLowerCase();
  return BANNED_TERMS.filter((t) => low.includes(t));
}

export function monthlyFees(fees: Fee[]) {
  return fees.filter((f) => f.cadence === "monthly").reduce((a, f) => a + (Number(f.amount) || 0), 0);
}

export function allInOf(draft: Pick<ListingDraft, "price" | "fees">) {
  return (Number(draft.price) || 0) + monthlyFees(draft.fees);
}

function daysBetween(a: string, b: string) {
  const x = new Date(`${a}T00:00:00`).getTime();
  const y = new Date(`${b}T00:00:00`).getTime();
  if (Number.isNaN(x) || Number.isNaN(y)) return null;
  return Math.round((y - x) / 86_400_000);
}

/**
 * The publication gate. Runs identically in the browser and in the server
 * action — the browser copy is there so nobody wastes five minutes filling a
 * form that will be rejected, and the server copy is the one that decides.
 */
export function checkListing(draft: ListingDraft): Check[] {
  const r = rulesFor({ cityId: draft.cityId, citySlug: draft.citySlug, cityName: draft.cityName, state: draft.state, country: draft.country });
  const out: Check[] = [];
  const add = (id: string, ok: boolean, blocking: boolean, title: string, why: string) =>
    out.push({ id, ok, blocking, title, why });

  add(
    "basics",
    draft.title.trim().length > 8 && !!draft.neighborhood.trim() && !!draft.address.trim(),
    true,
    "Title, neighbourhood and address",
    "The address is never published in full — it sets the map pin and is what an ownership document gets matched against.",
  );

  add(
    "photos",
    draft.photoCount >= 4,
    true,
    "At least four photographs of this unit",
    draft.photoCount >= 4
      ? `${draft.photoCount} uploaded. The first is the cover.`
      : `You have ${draft.photoCount}. Renters abandon listings without photographs of the actual place more than for any other reason, and stock images are the clearest fraud signal there is.`,
  );

  add(
    "fees",
    draft.fees.length > 0 && draft.fees.every((f) => !!f.type && Number(f.amount) >= 0),
    true,
    "Every fee itemised",
    r.listingFeeDisclosureSrc
      ? `Required on the listing itself in this market — ${r.listingFeeDisclosureSrc.label}.`
      : "Renters abandon at the point they discover a fee that was not in the advert.",
  );

  const minDays = Math.max(1, Math.round((Number(draft.minStayMonths) || 1) * 30));
  add(
    "minstay",
    minDays >= r.minStayDays,
    true,
    `Minimum stay clears ${r.minStayDays} days`,
    minDays >= r.minStayDays
      ? `Yours is ${minDays} days.${r.minStaySrc ? ` Floor set by ${r.minStaySrc.label}.` : ""}`
      : `This market sets a floor of ${r.minStayDays} days${r.minStaySrc ? ` under ${r.minStaySrc.label}` : ""}. Yours is ${minDays}.`,
  );

  const w = draft.availableFrom && draft.availableUntil ? daysBetween(draft.availableFrom, draft.availableUntil) : null;
  add(
    "window",
    !!(w && w >= minDays),
    true,
    "Availability window",
    draft.availableUntil
      ? w && w >= minDays
        ? `Open ${w} days — long enough for your own minimum.`
        : "The window is shorter than the minimum stay you set."
      : 'An end date is what makes "available March through June" answerable — by our search, and by an assistant reading the page.',
  );

  if (r.depositCapMonths != null) {
    const cap = Math.round((Number(draft.price) || 0) * r.depositCapMonths);
    add(
      "deposit",
      (Number(draft.deposit) || 0) <= cap,
      true,
      `Deposit within ${r.depositCapMonths} month${r.depositCapMonths === 1 ? "" : "s"}`,
      (Number(draft.deposit) || 0) <= cap
        ? `Cap here is ${cap}. It reaches advances too, so no "first, last and security".`
        : `Over the cap of ${cap}${r.depositSrc ? ` under ${r.depositSrc.label}` : ""}.`,
    );
  }

  if (!r.landlordAgentMayChargeTenant) {
    const broker = draft.fees.filter((f) => f.type === "broker").reduce((a, f) => a + (Number(f.amount) || 0), 0);
    add(
      "broker",
      broker === 0,
      true,
      "No broker fee charged to the renter",
      broker === 0
        ? "None on this listing. A broker the renter retains themselves is a different arrangement and is unaffected."
        : `A landlord’s agent may not charge the renter here${r.tenantBrokerFeeSrc ? ` — ${r.tenantBrokerFeeSrc.label}` : ""}.`,
    );
  }

  if (r.applicationFeeBanned) {
    const moveIn = draft.fees
      .filter((f) => ["admin", "move_in", "key", "access"].includes(f.type))
      .reduce((a, f) => a + (Number(f.amount) || 0), 0);
    add(
      "movein",
      moveIn === 0,
      true,
      "No move-in, admin or key fee",
      moveIn === 0
        ? "None charged."
        : `Charges demanded before or at the start of a tenancy are barred here${r.applicationFeeSrc ? ` under ${r.applicationFeeSrc.label}` : ""} — and the statute names sub-lessors as well as landlords.`,
    );
  }

  const hits = scanText(`${draft.title} ${draft.description}`);
  add(
    "wording",
    hits.length === 0,
    true,
    "Wording is publishable",
    hits.length
      ? `The phrase “${hits[0]}” states a preference based on a protected characteristic. Describe the home, not the person you want in it.`
      : "Nothing in the title or description states a preference about who may live here.",
  );

  add(
    "description",
    draft.description.trim().length >= 120,
    false,
    "Description with some substance",
    "Who else lives there, what is genuinely included, what the building is like at 8am.",
  );

  if (r.registrationRequired) {
    add(
      "registration",
      !!(draft.registrationNumber || "").trim(),
      true,
      "Registration number",
      `Required on the listing in this market${r.registrationSrc ? ` under ${r.registrationSrc.label}` : ""}.`,
    );
  }

  if (draft.housingType === "lease-break") {
    add("leaseend", !!draft.leaseEnd, true, "Lease end date", "It sets the remaining term, which is the first thing anyone taking over a lease looks at.");
    add(
      "consent",
      draft.consentStatus !== "pending",
      false,
      "Landlord consent settled",
      draft.consentStatus === "pending"
        ? "You can publish without it. The listing will show that consent is not yet settled."
        : "Recorded. The takeover desk shows this to renters.",
    );
  }

  return out;
}

export function blockersFor(draft: ListingDraft) {
  return checkListing(draft).filter((c) => c.blocking && !c.ok);
}
