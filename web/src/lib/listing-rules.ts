/**
 * Jurisdiction rules for listing validation.
 *
 * This is the canonical TypeScript copy of the engine the static layer runs in
 * `rentleaks-x.js`. It exists because the composer needs it in the browser AND
 * the server action needs it to enforce, and a client-side gate is user
 * experience rather than enforcement — anyone can post a form.
 *
 * Every rule carries the instrument it comes from and the date it took effect,
 * so a stale rule is visible rather than silently wrong. Rules resolve city →
 * region → country → default.
 *
 * This is research, not legal advice.
 */

export type Source = { label: string; eff: string; url: string };

export const SOURCES = {
  fare: {
    label: "NYC FARE Act, Local Law 119 of 2024",
    eff: "2025-06-11",
    url: "https://www.nyc.gov/site/dca/news/018-25/dcwp-the-fare-act-now-effect",
  },
  fareDisclosure: {
    label: "NYC Admin. Code § 20-699.22 — fee disclosure on every listing",
    eff: "2025-06-11",
    url: "https://www.nyc.gov/assets/dca/downloads/pdf/about/FAQ-Broker-Fees.pdf",
  },
  ll18: {
    label: "NYC Local Law 18 — short-term rental registration",
    eff: "2023-09-05",
    url: "https://www.nyc.gov/site/specialenforcement/registration-law/registration.page",
  },
  gol7108: {
    label: "NY General Obligations Law § 7-108 (HSTPA)",
    eff: "2019-06-14",
    url: "https://www.nysenate.gov/legislation/laws/GOB/7-108",
  },
  rpl238a: {
    label: "NY Real Property Law § 238-a — application and move-in charges",
    eff: "2019-06-14",
    url: "https://www.nysenate.gov/legislation/laws/RPP/238-A",
  },
  rpl226b: {
    label: "NY Real Property Law § 226-b — sublet and assignment",
    eff: "1983-01-01",
    url: "https://www.nysenate.gov/legislation/laws/RPP/226-B",
  },
  rsc25256: {
    label: "Rent Stabilization Code § 2525.6 — subletting",
    eff: "1987-05-01",
    url: "https://www.law.cornell.edu/regulations/new-york/9-NYCRR-2525.6",
  },
  nycSoi: {
    label: "NYC Human Rights Law — source of income",
    eff: "2008-03-01",
    url: "https://www.nyc.gov/site/cchr/media/source-of-income.page",
  },
  ftcFees: {
    label: "FTC Rule on Unfair or Deceptive Fees, 16 CFR Part 464",
    eff: "2025-05-12",
    url: "https://www.ftc.gov/business-guidance/resources/rule-unfair-or-deceptive-fees-frequently-asked-questions",
  },
  coHb1090: {
    label: "Colorado HB25-1090 price transparency",
    eff: "2026-01-01",
    url: "https://leg.colorado.gov/bills/hb25-1090",
  },
  esReg: {
    label: "Spain Real Decreto 1312/2024 — Registro Único de Arrendamientos",
    eff: "2025-07-01",
    url: "https://www.boe.es/diario_boe/txt.php?id=BOE-A-2024-26931",
  },
  catSeason: {
    label: "Catalonia Llei 11/2025 — seasonal and room rentals",
    eff: "2026-01-01",
    url: "https://www.cuatrecasas.com/en/spain/real-estate/art/catalonia-regulates-seasonal-rentals",
  },
  itCin: {
    label: "Italy CIN — Codice Identificativo Nazionale",
    eff: "2024-09-02",
    url: "https://fiscomania.com/cin-affitti-brevi/",
  },
  deZweck: {
    label: "Berlin Zweckentfremdungsverbot",
    eff: "2014-05-01",
    url: "https://www.berlin.de/sen/wohnen/rechtliches/zweckentfremdungsverbot/",
  },
  frMobilite: {
    label: "France bail mobilité (loi ELAN)",
    eff: "2018-11-24",
    url: "https://www.lodgis.com/en/owners/helpful-hints/bail-mobilite-the-new-contract-for-furnished-rentals/",
  },
  nlGoed: {
    label: "Netherlands Wet goed verhuurderschap",
    eff: "2023-07-01",
    url: "https://en.straatmankoster.nl/actueel/wet-goed-verhuurderschap",
  },
  ukRra: {
    label: "UK Renters’ Rights Act 2025",
    eff: "2026-05-01",
    url: "https://www.legislation.gov.uk/ukpga/2025/26/contents",
  },
  euStr: {
    label: "Regulation (EU) 2024/1028 — short-term rental data sharing",
    eff: "2026-05-20",
    url: "https://eur-lex.europa.eu/eli/reg/2024/1028/oj/eng",
  },
  toronto: {
    label: "Toronto short-term rental by-law — 28-day threshold",
    eff: "2019-09-10",
    url: "https://www.keycafe.com/s/blog/understanding-torontos-short-term-rental-regulations",
  },
  vancouver: {
    label: "BC / Vancouver short-term rental rules — 30-day threshold",
    eff: "2024-05-01",
    url: "https://liv.rent/blog/landlords/vancouver-short-term-rental-rules/",
  },
  montreal: {
    label: "Québec tourist accommodation — 31-day threshold",
    eff: "2023-09-01",
    url: "https://lendcity.ca/blog/short-term-rental-regulations-across-canada-city-by-city-guide/",
  },
} satisfies Record<string, Source>;

export type Rules = {
  cityName: string;
  country: string;
  region: string;
  minStayDays: number;
  minStaySrc: Source | null;
  depositCapMonths: number | null;
  depositSrc: Source | null;
  applicationFeeBanned: boolean;
  applicationFeeSrc: Source | null;
  screeningFeeCap: number | null;
  moveInFeesBarred: boolean;
  moveInFeesSrc: Source | null;
  subLessorNamed: boolean;
  landlordAgentMayChargeTenant: boolean;
  brokerFeeSrc: Source | null;
  soiProtected: boolean;
  soiSrc: Source | null;
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

const DEFAULTS: Rules = {
  cityName: "",
  country: "US",
  region: "",
  minStayDays: 30,
  minStaySrc: null,
  depositCapMonths: null,
  depositSrc: null,
  applicationFeeBanned: false,
  applicationFeeSrc: null,
  screeningFeeCap: null,
  moveInFeesBarred: false,
  moveInFeesSrc: null,
  subLessorNamed: false,
  landlordAgentMayChargeTenant: true,
  brokerFeeSrc: null,
  soiProtected: false,
  soiSrc: null,
  registrationRequired: false,
  registrationSrc: null,
  allInDisclosure: false,
  allInSrc: null,
  listingFeeDisclosureSrc: null,
  subletSurchargePct: null,
  subletSurchargeSrc: null,
  contractType: null,
  unassessed: false,
  notes: [],
};

type Partial_ = Partial<Rules>;

const BY_CITY: Record<string, Partial_> = {
  nyc: {
    minStayDays: 30,
    minStaySrc: SOURCES.ll18,
    depositCapMonths: 1,
    depositSrc: SOURCES.gol7108,
    applicationFeeBanned: true,
    applicationFeeSrc: SOURCES.rpl238a,
    screeningFeeCap: 20,
    moveInFeesBarred: true,
    moveInFeesSrc: SOURCES.rpl238a,
    subLessorNamed: true,
    landlordAgentMayChargeTenant: false,
    brokerFeeSrc: SOURCES.fare,
    soiProtected: true,
    soiSrc: SOURCES.nycSoi,
    allInDisclosure: true,
    allInSrc: SOURCES.fare,
    listingFeeDisclosureSrc: SOURCES.fareDisclosure,
    subletSurchargePct: 10,
    subletSurchargeSrc: SOURCES.rsc25256,
    contractType: "NY residential lease; sublet or assignment under § 226-b",
    notes: [
      "A tenant may not be charged the broker fee when the landlord engaged the broker.",
      "Every fee a tenant will owe must be disclosed in the listing and in the lease.",
    ],
  },
  berlin: {
    minStayDays: 90,
    minStaySrc: SOURCES.deZweck,
    registrationRequired: true,
    registrationSrc: SOURCES.deZweck,
    contractType: "Zeitmietvertrag with a documented temporary purpose",
    notes: [
      "Berlin’s misappropriation ban is the binding constraint, and the practical threshold sits near three months rather than 30 days.",
    ],
  },
  barcelona: {
    registrationRequired: true,
    registrationSrc: SOURCES.catSeason,
    contractType: "Contracte de temporada — the temporary purpose must be documented",
    notes: ["Catalonia’s seasonal and room-rental regime reaches mid-term lets, not only tourist lets."],
  },
  paris: {
    depositCapMonths: 0,
    depositSrc: SOURCES.frMobilite,
    contractType: "Bail mobilité — 1 to 10 months, non-renewable, no deposit permitted",
  },
  amsterdam: {
    depositCapMonths: 2,
    depositSrc: SOURCES.nlGoed,
    landlordAgentMayChargeTenant: false,
    brokerFeeSrc: SOURCES.nlGoed,
  },
  toronto: { minStayDays: 28, minStaySrc: SOURCES.toronto },
  vancouver: { minStayDays: 30, minStaySrc: SOURCES.vancouver },
  montreal: { minStayDays: 31, minStaySrc: SOURCES.montreal },
  seattle: { soiProtected: true },
  denver: { allInDisclosure: true, allInSrc: SOURCES.coHb1090, soiProtected: true },
  boston: { soiProtected: true },
  dc: { soiProtected: true },
  chicago: { soiProtected: true },
  portland: { soiProtected: true },
};

const BY_REGION: Record<string, Partial_> = {
  NY: {
    depositCapMonths: 1,
    depositSrc: SOURCES.gol7108,
    applicationFeeBanned: true,
    applicationFeeSrc: SOURCES.rpl238a,
    screeningFeeCap: 20,
    moveInFeesBarred: true,
    moveInFeesSrc: SOURCES.rpl238a,
    subLessorNamed: true,
    subletSurchargePct: 10,
    subletSurchargeSrc: SOURCES.rsc25256,
  },
  CA: { soiProtected: true, allInDisclosure: true, allInSrc: SOURCES.ftcFees },
  CO: { allInDisclosure: true, allInSrc: SOURCES.coHb1090 },
  MA: { soiProtected: true, allInDisclosure: true, allInSrc: SOURCES.ftcFees },
  WA: { soiProtected: true },
  OR: { soiProtected: true },
  NJ: { soiProtected: true },
  CT: { soiProtected: true, allInDisclosure: true, allInSrc: SOURCES.ftcFees },
  DC: { soiProtected: true },
  England: { contractType: "Assured tenancy, periodic", allInDisclosure: true, allInSrc: SOURCES.ukRra },
  ON: { minStayDays: 28, minStaySrc: SOURCES.toronto },
  BC: { minStayDays: 30, minStaySrc: SOURCES.vancouver },
  QC: { minStayDays: 31, minStaySrc: SOURCES.montreal },
};

const BY_COUNTRY: Record<string, Partial_> = {
  US: { minStayDays: 30, allInDisclosure: true, allInSrc: SOURCES.ftcFees },
  CA: { minStayDays: 30 },
  GB: { minStayDays: 30, allInDisclosure: true, allInSrc: SOURCES.ukRra, contractType: "Assured tenancy, periodic" },
  IE: {
    minStayDays: 30,
    unassessed: true,
    notes: ["Irish law was not assessed in the source research. Treat Dublin, Cork and Galway as unverified."],
  },
  FR: { minStayDays: 30, registrationRequired: true, registrationSrc: SOURCES.euStr, contractType: "Bail mobilité or bail meublé" },
  ES: { minStayDays: 30, registrationRequired: true, registrationSrc: SOURCES.esReg, contractType: "Arrendamiento de temporada" },
  NL: { minStayDays: 30, depositCapMonths: 2, depositSrc: SOURCES.nlGoed, landlordAgentMayChargeTenant: false, brokerFeeSrc: SOURCES.nlGoed },
  DE: { minStayDays: 30, registrationRequired: true, registrationSrc: SOURCES.euStr, contractType: "Zeitmietvertrag" },
  IT: { minStayDays: 30, registrationRequired: true, registrationSrc: SOURCES.itCin, contractType: "Locazione transitoria" },
  CH: {
    minStayDays: 30,
    unassessed: true,
    notes: ["Swiss law was not assessed in the source research. Treat Zurich, Geneva, Basel and Bern as unverified."],
  },
};

export function rulesFor(input: { cityId: string; cityName?: string; state?: string; country?: string }): Rules {
  const out: Rules = { ...DEFAULTS, notes: [] };

  const merge = (src?: Partial_) => {
    if (!src) return;
    for (const [k, v] of Object.entries(src)) {
      if (k === "notes") {
        out.notes = out.notes.concat((v as string[]) || []);
        continue;
      }
      (out as Record<string, unknown>)[k] = v;
    }
  };

  merge(BY_COUNTRY[input.country || "US"]);
  merge(BY_REGION[input.state || ""]);
  merge(BY_CITY[input.cityId]);

  out.cityName = input.cityName || "";
  out.country = input.country || "US";
  out.region = input.state || "";
  return out;
}

/* ------------------------------------------------------------------------ */

export type Fee = { type: string; amount: number; cadence: "monthly" | "once"; mandatory: boolean };

export type ListingDraft = {
  role: string;
  housingType: string;
  cityId: string;
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

/**
 * Wording that cannot lawfully be published in a housing advertisement. The
 * composer never asks a structured question about a protected characteristic —
 * a drop-down on one is the line that costs a platform its intermediary
 * protection — so free text is where this has to be caught.
 */
export const BANNED_TERMS = [
  "no kids", "no children", "adults only", "no families", "child free", "childfree",
  "no wheelchair", "able bodied", "able-bodied", "no disabilities", "no service animals",
  "no foreigners", "americans only", "english speakers only", "christian only", "christians only",
  "muslim only", "no muslims", "jewish only", "whites only", "no immigrants",
  "no vouchers", "no section 8", "no section8", "no dss", "no housing benefit", "no cityfheps",
  "working professionals only", "employed only",
  "females only", "males only", "women only", "men only", "no gays", "straight only", "no couples",
];

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
  const r = rulesFor({ cityId: draft.cityId, cityName: draft.cityName, state: draft.state, country: draft.country });
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
        : `A landlord’s agent may not charge the renter here${r.brokerFeeSrc ? ` — ${r.brokerFeeSrc.label}` : ""}.`,
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
