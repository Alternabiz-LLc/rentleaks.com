/**
 * RentLeaks Enterprise: the service menu for landlords with buildings,
 * corporate portfolios, developers and out-of-state owners.
 *
 * One source of truth. The public pages (rentleaks.com/enterprise/, built by
 * tools/build-enterprise-pages.mjs straight from this file), the request API,
 * the desk and the tests all read it — so a package can't say one thing on the
 * website and another on the proposal.
 *
 * Rules this file keeps:
 * - No invented prices. A package shows how it is priced; a "from" figure only
 *   appears when the founder sets one in the desk.
 * - Brokerage and management are licensed work, done under a signed agreement;
 *   the licence details come from the desk settings, never from code.
 * - Fair housing: the request asks about the property, never about people.
 * - The RentLeaks floor stays: 30 days or more, no hotel nights.
 *
 * Pure and dependency-free (erasable TypeScript only) so Node can import it
 * without a build step.
 */

export type TrackId = "marketing" | "brokerage" | "management" | "owners";
export type ServiceId = "brokerage" | "syndication" | "social" | "media" | "leaseup" | "remote" | "management" | "furnished";

export type Service = {
  id: ServiceId;
  title: string;
  short: string;
  body: string;
  bullets: string[];
  page: string;
  track: TrackId;
  licensed: boolean;
  icon: string;
};

export type Package = {
  id: string;
  track: TrackId;
  name: string;
  tagline: string;
  bestFor: string;
  basis: string;
  includes: string[];
  services: ServiceId[];
  featured?: boolean;
  /** Deliverables the desk turns into a checklist when the engagement is signed. */
  tasks: string[];
  /** The fee model a proposal starts from. */
  fee: FeeModel;
};

export type FeeModel = "flat" | "monthly" | "per_unit" | "percent" | "commission";

export const FEE_LABEL: Record<FeeModel, string> = {
  flat: "One-time fee",
  monthly: "Monthly retainer",
  per_unit: "Per unit, per month",
  percent: "% of rent collected",
  commission: "Leasing commission (% of first-year rent)",
};

export const TRACKS: Array<{ id: TrackId; label: string; title: string; lede: string; page: string }> = [
  {
    id: "marketing",
    label: "Marketing & media",
    title: "Fill a building faster",
    lede: "Photos, 3D tours, video, listing distribution and social campaigns — one team, one report, one inbox for every lead.",
    page: "marketing.html",
  },
  {
    id: "brokerage",
    label: "Brokerage & leasing",
    title: "Licensed leasing, landlord-side",
    lede: "Our licensed brokerage markets, shows and leases your units under a written agreement — fees paid by the owner who hires us, disclosed up front.",
    page: "brokerage.html",
  },
  {
    id: "management",
    label: "Property management",
    title: "Buildings, rooms and furnished units, run for you",
    lede: "Rent collection into a client trust account, maintenance, turnovers and a clear statement every month — for multi-room homes, whole buildings and furnished portfolios.",
    page: "management.html",
  },
  {
    id: "owners",
    label: "Out-of-state owners",
    title: "Own it from anywhere",
    lede: "A local, licensed team for owners who don't live near the property: long-term leasing done by the book, then managed with photos and statements you can read from anywhere.",
    page: "owners.html",
  },
];

export const SERVICES: Service[] = [
  {
    id: "brokerage",
    title: "Exclusive leasing & brokerage",
    short: "Your licensed leasing agent, landlord-side.",
    body: "We price, market, show and lease your vacancies under a signed exclusive agreement. Applicants are screened on the same written criteria for everyone, and every lease is prepared with the riders your market requires.",
    bullets: ["Rent pricing study per unit type", "Showings and open houses, in person or live video", "One written screening standard for every applicant", "Lease preparation, required riders and renewals"],
    page: "brokerage.html",
    track: "brokerage",
    licensed: true,
    icon: "key",
  },
  {
    id: "syndication",
    title: "Listing distribution",
    short: "Every unit on the portals renters actually use.",
    body: "One source of truth for your units: we publish them to the major rental portals, local marketplaces and social marketplaces you choose, keep price and availability in step, and route every inquiry into one inbox.",
    bullets: ["Major national rental portals and local sites", "Social marketplace listings", "Price and availability kept in sync", "Every inquiry answered within one business day"],
    page: "marketing.html",
    track: "marketing",
    licensed: false,
    icon: "broadcast",
  },
  {
    id: "social",
    title: "Social & global campaigns",
    short: "Content calendar, reels and paid social — US and Europe.",
    body: "A content calendar for your building, short videos and posts across your channels and ours, and paid campaigns run under the housing ad rules (no targeting by age, gender or ZIP code). Multilingual copy reaches relocation and international renters.",
    bullets: ["Monthly content calendar and posting", "Reels and short-form walkthroughs", "Paid social under housing special-ad rules", "Copy in English, French, Spanish, German, Italian and Dutch"],
    page: "marketing.html",
    track: "marketing",
    licensed: false,
    icon: "megaphone",
  },
  {
    id: "media",
    title: "Photography, video & virtual tours",
    short: "HDR photos, 3D tours, video, floor plans, aerial.",
    body: "Professional photo sets for every unit type and the amenities, 3D virtual tours renters can walk from abroad, video walkthroughs, measured floor plans and aerial footage by a licensed drone pilot. Virtual staging is always labelled as such.",
    bullets: ["HDR and twilight photography", "3D virtual tours and live video tours", "Video walkthroughs and reels", "Floor plans, aerial footage, labelled virtual staging"],
    page: "marketing.html",
    track: "marketing",
    licensed: false,
    icon: "camera",
  },
  {
    id: "leaseup",
    title: "New development lease-up",
    short: "From pre-leasing to a stabilised building.",
    body: "A launch plan for new buildings: waitlist and pre-leasing, model-unit tours, a launch campaign and a weekly absorption report against your target — through to stabilisation.",
    bullets: ["Pre-leasing waitlist and launch campaign", "Model-unit and amenity tours", "Concession strategy that stays honest in the all-in price", "Weekly absorption report"],
    page: "brokerage.html",
    track: "brokerage",
    licensed: true,
    icon: "building",
  },
  {
    id: "remote",
    title: "Out-of-state owner program",
    short: "Long-term leasing and care, wherever you live.",
    body: "We are your team on the ground: we check the local rules before the first listing, lease to a qualified long-term renter, handle keys and move-in, and send photos and a statement you can read from anywhere.",
    bullets: ["Local rules checked before listing", "Remote signing and key handover", "Move-in and move-out condition reports with photos", "Monthly statement and annual review"],
    page: "owners.html",
    track: "owners",
    licensed: true,
    icon: "globe",
  },
  {
    id: "management",
    title: "Property management",
    short: "Multi-room homes and whole buildings.",
    body: "Rent collected into a client trust account and paid out with a monthly statement, maintenance handled with vendors you approve, inspections with photos, renewals and a compliance calendar so nothing lapses.",
    bullets: ["Rent collection and monthly owner statements", "Maintenance with owner-approved vendors and limits", "Inspections and turnover with photo reports", "Renewals and a compliance calendar"],
    page: "management.html",
    track: "management",
    licensed: true,
    icon: "tools",
  },
  {
    id: "furnished",
    title: "Furnished & co-living operations",
    short: "Room-by-room leasing, cleaning, supplies, utilities.",
    body: "For furnished apartments and co-living homes: room-by-room leasing for stays of 30 days or more, cleaning and linen schedules, supplies, utilities and wifi, and house rules that keep a shared home working. Never hotel nights.",
    bullets: ["Room-by-room leasing, 30 days or more", "Cleaning, linen and supply schedules", "Utilities, wifi and all-in pricing", "Furnishing plans and inventory"],
    page: "management.html",
    track: "management",
    licensed: true,
    icon: "sofa",
  },
];

export const SERVICE = new Map(SERVICES.map((s) => [s.id, s]));

/** One or two words per service, for chips and chart legends. */
export const SERVICE_SHORT: Record<ServiceId, string> = {
  brokerage: "Leasing",
  syndication: "Distribution",
  social: "Social",
  media: "Photo & tours",
  leaseup: "Lease-up",
  remote: "Remote owner",
  management: "Management",
  furnished: "Furnished ops",
};

export const PACKAGES: Package[] = [
  {
    id: "mk-launch",
    track: "marketing",
    name: "Launch",
    tagline: "Everything a building needs to be seen.",
    bestFor: "A building or a handful of units coming to market",
    basis: "Set-up per building, then monthly",
    includes: ["Professional photo set per unit type", "RentLeaks listings with all-in pricing", "Distribution to the major rental portals", "One lead inbox, replies within one business day", "Monthly performance report"],
    services: ["media", "syndication"],
    tasks: ["Kick-off call and unit list", "Photo shoot booked", "Photos delivered and approved", "Listings live on RentLeaks", "Portal distribution live", "First monthly report sent"],
    fee: "monthly",
  },
  {
    id: "mk-leaseup",
    track: "marketing",
    name: "Lease-up",
    tagline: "Launch, plus tours and a campaign.",
    bestFor: "Buildings with several vacancies to fill this season",
    basis: "Set-up per building, then monthly",
    includes: [
      "Everything in Launch",
      "3D virtual tour per unit type",
      "Video walkthrough and floor plans",
      "30-day social campaign",
      "Sponsored placement on RentLeaks",
      "Open-house events",
      "Weekly leasing report",
    ],
    services: ["media", "syndication", "social"],
    featured: true,
    tasks: [
      "Kick-off call and unit list",
      "Photo, video and 3D tour shoot booked",
      "Media delivered and approved",
      "Floor plans delivered",
      "Listings and sponsored placement live",
      "Portal distribution live",
      "Social campaign calendar approved",
      "Open house scheduled",
      "Weekly report cadence set",
    ],
    fee: "monthly",
  },
  {
    id: "mk-global",
    track: "marketing",
    name: "Global",
    tagline: "Always-on marketing across the US and Europe.",
    bestFor: "Portfolios and corporate housing that lease all year",
    basis: "Monthly retainer, per portfolio",
    includes: [
      "Everything in Lease-up",
      "Paid social campaigns under housing ad rules",
      "Listings in six languages",
      "Aerial footage and twilight photos",
      "Always-on content calendar",
      "Relocation and corporate-housing outreach",
      "Dedicated account manager and quarterly review",
    ],
    services: ["media", "syndication", "social", "leaseup"],
    tasks: [
      "Kick-off and portfolio audit",
      "Media plan per building",
      "Translations approved",
      "Paid social account set up (housing category)",
      "Content calendar for the quarter",
      "Relocation partner list agreed",
      "Quarterly review booked",
    ],
    fee: "monthly",
  },
  {
    id: "br-placement",
    track: "brokerage",
    name: "Tenant placement",
    tagline: "We find, qualify and lease — you approve.",
    bestFor: "Owners with one or a few vacancies",
    basis: "Leasing commission paid by the owner",
    includes: ["Rent pricing study", "Listing, photos and distribution", "Showings in person or by live video", "Applications on one written standard", "Lease and required riders prepared"],
    services: ["brokerage", "syndication", "media"],
    tasks: ["Exclusive agreement signed", "Pricing study shared", "Unit photographed", "Listing live and distributed", "Showings scheduled", "Applicant approved by owner", "Lease signed", "Keys handed over"],
    fee: "commission",
  },
  {
    id: "br-exclusive",
    track: "brokerage",
    name: "Exclusive building agent",
    tagline: "One agent for every vacancy in the building.",
    bestFor: "Buildings and apartment complexes",
    basis: "Leasing commission per lease, agreed per building",
    includes: ["Everything in Tenant placement, for every unit", "Open houses and a showing calendar", "Renewal desk 90 days before each lease ends", "Weekly vacancy and pipeline report", "Quarterly rent review"],
    services: ["brokerage", "syndication", "media", "social"],
    featured: true,
    tasks: ["Exclusive agreement signed", "Rent roll and vacancy list received", "Pricing study per unit type", "Building media shoot", "All vacancies listed", "Showing calendar live", "Renewal desk set up", "Weekly report cadence set"],
    fee: "commission",
  },
  {
    id: "br-development",
    track: "brokerage",
    name: "New development",
    tagline: "Pre-leasing through stabilisation.",
    bestFor: "Developers and new buildings",
    basis: "Commission per lease plus a launch fee",
    includes: ["Everything in Exclusive building agent", "Pre-leasing waitlist", "Launch campaign and model-unit tours", "Concession plan kept honest in the all-in price", "Weekly absorption report against target"],
    services: ["leaseup", "brokerage", "media", "social", "syndication"],
    tasks: ["Agreement signed", "Absorption target agreed", "Waitlist page live", "Model unit ready for tours", "Launch campaign live", "First 25% leased", "Stabilisation reached"],
    fee: "commission",
  },
  {
    id: "pm-essentials",
    track: "management",
    name: "Essentials",
    tagline: "Rent in, bills paid, a statement every month.",
    bestFor: "Owners who lease themselves but want the running handled",
    basis: "Percentage of rent collected",
    includes: ["Rent collection into a client trust account", "Monthly owner statement", "Maintenance with owner-approved vendors and limits", "Annual inspection with photos", "Compliance calendar"],
    services: ["management"],
    tasks: ["Management agreement signed", "Trust account details confirmed", "Rent roll and leases received", "Vendor list and spending limit agreed", "Tenants notified of new payment instructions", "First statement sent"],
    fee: "percent",
  },
  {
    id: "pm-full",
    track: "management",
    name: "Full service",
    tagline: "Leasing, renewals and turnovers included.",
    bestFor: "Multi-room homes and whole buildings",
    basis: "Percentage of rent collected, leasing included",
    includes: ["Everything in Essentials", "Leasing and renewals", "Move-in and move-out reports with photos", "Turnovers and vendor bids", "Annual budget", "Collections and legal coordination with your counsel"],
    services: ["management", "brokerage", "media", "syndication"],
    featured: true,
    tasks: [
      "Management agreement signed",
      "Trust account details confirmed",
      "Rent roll, leases and keys received",
      "Vendor list and spending limit agreed",
      "Tenants notified of new payment instructions",
      "Property inspection with photos",
      "Vacancies listed",
      "Annual budget shared",
      "First statement sent",
    ],
    fee: "percent",
  },
  {
    id: "pm-furnished",
    track: "management",
    name: "Furnished & co-living",
    tagline: "Room-by-room, 30 days or more.",
    bestFor: "Furnished apartments and co-living homes",
    basis: "Percentage of rent collected, per room",
    includes: ["Everything in Full service", "Room-by-room leasing", "Cleaning, linen and supply schedules", "Utilities and wifi in the all-in price", "House rules and housemate onboarding", "Furnishing plan and inventory"],
    services: ["furnished", "management", "brokerage", "media"],
    tasks: [
      "Management agreement signed",
      "Room inventory and furniture list",
      "Cleaning schedule set",
      "Utilities and wifi transferred",
      "House rules agreed",
      "Rooms photographed and listed",
      "First statement sent",
    ],
    fee: "percent",
  },
  {
    id: "ow-lease",
    track: "owners",
    name: "Remote lease",
    tagline: "Leased by the book, while you're away.",
    bestFor: "Out-of-state owners with a long-term rental",
    basis: "Leasing commission paid by the owner",
    includes: ["Local rules checked before listing", "Photos, listing and distribution", "Showings and one written screening standard", "Remote signing and key handover", "Move-in condition report with photos"],
    services: ["remote", "brokerage", "media", "syndication"],
    featured: true,
    tasks: ["Agreement signed", "Local compliance checklist done", "Keys received", "Unit photographed", "Listing live", "Applicant approved by owner", "Lease signed remotely", "Move-in report sent"],
    fee: "commission",
  },
  {
    id: "ow-manage",
    track: "owners",
    name: "Remote manage",
    tagline: "Leased, then looked after.",
    bestFor: "Out-of-state owners who want one local team",
    basis: "Percentage of rent collected, leasing included",
    includes: ["Everything in Remote lease", "Rent collection and monthly statement", "Maintenance with your spending limit", "Seasonal inspection with photos", "Renewal and annual review"],
    services: ["remote", "management", "brokerage", "media"],
    tasks: ["Management agreement signed", "Local compliance checklist done", "Trust account details confirmed", "Vendor list and spending limit agreed", "Unit leased", "First statement sent", "Seasonal inspection booked"],
    fee: "percent",
  },
];

export const PACKAGE = new Map(PACKAGES.map((p) => [p.id, p]));

export const ADD_ONS: Array<{ id: string; label: string; service: ServiceId }> = [
  { id: "drone", label: "Aerial photos and video (licensed pilot)", service: "media" },
  { id: "twilight", label: "Twilight photography", service: "media" },
  { id: "tour3d", label: "3D virtual tour", service: "media" },
  { id: "video", label: "Video walkthrough", service: "media" },
  { id: "floorplan", label: "Measured floor plans", service: "media" },
  { id: "staging", label: "Virtual staging (always labelled)", service: "media" },
  { id: "translate", label: "Listing translations", service: "social" },
  { id: "openhouse", label: "Open-house event", service: "brokerage" },
  { id: "renewal", label: "Lease renewal", service: "brokerage" },
  { id: "inspection", label: "Condition report with photos", service: "management" },
  { id: "furnish", label: "Furnishing design and install", service: "furnished" },
  { id: "compliance", label: "Local rules check for a new market", service: "remote" },
];

/** What an out-of-state owner's compliance check covers (where the market requires it). */
export const COMPLIANCE_CHECKS = [
  "Rental registration or licence with the city or county",
  "Lead-based paint disclosure for homes built before 1978",
  "Security deposit limits and where the deposit must be held",
  "Smoke and carbon-monoxide detector rules",
  "Required lease riders and notices (for example window-guard and bedbug notices in New York City)",
  "Fee disclosures and who pays the broker (New York City's FARE Act)",
  "Rent regulation status and registration",
  "Fair-housing wording in every ad",
];

export const HOW_IT_WORKS = [
  { title: "Tell us about the property", body: "Units, location, what you need. Two minutes, no obligation." },
  { title: "Walk-through and proposal", body: "A call or visit, then a written proposal with the package, the fee and what's delivered when." },
  { title: "Sign and start", body: "Licensed work begins only under a signed agreement. You get a checklist and a named contact." },
  { title: "Reports you can read", body: "Weekly leasing reports or monthly statements, with photos — from wherever you are." },
];

export const FAQ: Array<{ q: string; a: string; track?: TrackId }> = [
  {
    q: "Who pays the broker fee?",
    a: "The owner who hires us. We work landlord-side under a written agreement and never charge renters a fee for our leasing work. In New York City the FARE Act makes this the rule, and every fee a renter does pay must be disclosed in the listing.",
    track: "brokerage",
  },
  {
    q: "Are you licensed?",
    a: "Brokerage and property management are provided by our licensed real estate brokerage. The licence holder, licence number and states appear on every page of this section. Where we are not licensed, we work with a licensed local partner and say so in the proposal.",
  },
  {
    q: "How do you screen applicants?",
    a: "With one written standard, applied the same way to every applicant, and within the limits of local law on fees and checks. We never ask about or advertise a preference for a protected characteristic.",
    track: "brokerage",
  },
  {
    q: "Where does the rent go?",
    a: "Into a client trust (escrow) account kept separate from our own money, then to you with a monthly statement showing rent collected, expenses paid and our fee.",
    track: "management",
  },
  {
    q: "Do you manage short stays?",
    a: "No hotel nights, ever. Furnished and co-living homes are leased for 30 days or more — the same floor as the rest of RentLeaks.",
    track: "management",
  },
  {
    q: "I live in another state. How do I sign and hand over keys?",
    a: "Agreements and leases are signed electronically. Keys go to us by courier or a lockbox we install; we send a photo condition report at move-in and move-out.",
    track: "owners",
  },
  {
    q: "Which platforms do you advertise on?",
    a: "The major national rental portals, local listing sites, social marketplaces and RentLeaks — the mix depends on your market and is set out in the proposal. Some portals charge their own fees; we show those separately.",
    track: "marketing",
  },
  {
    q: "Can you run ads in Europe?",
    a: "Yes — RentLeaks covers major cities in the UK, Ireland, France, Spain, the Netherlands, Switzerland, Germany and Italy, and listings can run in six languages. Brokerage and management abroad are arranged through licensed local partners.",
    track: "marketing",
  },
];

/* ------------------------------------------------------------------------
   Requests from the public form
   ------------------------------------------------------------------------ */

export const CLIENT_ROLES = [
  { id: "landlord", label: "Landlord or owner" },
  { id: "company", label: "Corporation or family office" },
  { id: "developer", label: "Developer" },
  { id: "operator", label: "Co-living or furnished operator" },
  { id: "investor", label: "Investor or fund" },
  { id: "other", label: "Something else" },
] as const;

export const PROPERTY_KINDS = [
  { id: "building", label: "Apartment building" },
  { id: "complex", label: "Apartment complex" },
  { id: "portfolio", label: "Portfolio across addresses" },
  { id: "multi_room", label: "Multi-room home" },
  { id: "furnished", label: "Furnished units" },
  { id: "single", label: "Single home or condo" },
  { id: "development", label: "New development" },
] as const;

export const TIMELINES = [
  { id: "now", label: "Right away" },
  { id: "30d", label: "Within 30 days" },
  { id: "90d", label: "Within 3 months" },
  { id: "exploring", label: "Just exploring" },
] as const;

export const REQUEST_STATUSES = ["new", "contacted", "proposal", "won", "lost", "spam"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_STAGE: Record<Exclude<RequestStatus, "spam">, { label: string; hint: string; tone: "brand" | "warn" | "value" | "good" | "bad" }> = {
  new: { label: "New", hint: "Reply within a business day", tone: "warn" },
  contacted: { label: "Talking", hint: "Walk-through or call booked", tone: "brand" },
  proposal: { label: "Proposal sent", hint: "Waiting on their signature", tone: "value" },
  won: { label: "Won", hint: "Engagement created", tone: "good" },
  lost: { label: "Lost", hint: "Note why", tone: "bad" },
};

export const ENGAGEMENT_STATUSES = ["proposal", "signed", "active", "paused", "completed", "cancelled"] as const;
export type EngagementStatus = (typeof ENGAGEMENT_STATUSES)[number];

export const ENGAGEMENT_STAGE: Record<EngagementStatus, { label: string; hint: string; tone: "brand" | "warn" | "value" | "good" | "bad" | "ink" }> = {
  proposal: { label: "Proposal", hint: "Scope and fee agreed, not signed", tone: "value" },
  signed: { label: "Signed", hint: "Agreement on file, onboarding", tone: "brand" },
  active: { label: "Active", hint: "Delivering", tone: "good" },
  paused: { label: "Paused", hint: "On hold", tone: "warn" },
  completed: { label: "Completed", hint: "Delivered", tone: "ink" },
  cancelled: { label: "Cancelled", hint: "Ended early", tone: "bad" },
};

export const PROPERTY_STATUSES = ["onboarding", "active", "paused", "ended"] as const;

export type RequestInput = {
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  role: string;
  propertyKind: string;
  units: number | null;
  buildings: number | null;
  market: string | null;
  address: string | null;
  ownerLocation: string | null;
  outOfState: boolean;
  services: ServiceId[];
  packageId: string | null;
  addOns: string[];
  timeline: string;
  message: string;
  consent: true;
  source: string;
  campaign: string | null;
  referrer: string | null;
};

export type RequestParse = { ok: true; request: RequestInput; spam: boolean } | { ok: false; field: string; message: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SOURCE = /^[a-z0-9_]{1,24}$/;

function text(v: unknown, max: number) {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
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

function count(v: unknown, max: number) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.min(max, Math.round(n)) : NaN;
}

function list(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === "string" && v) return v.split(",");
  return [];
}

const ids = <T extends { id: string }>(xs: readonly T[]) => xs.map((x) => x.id) as string[];

/**
 * Validates a public request. Unknown services and add-ons are dropped rather
 * than refused (the menu may change while a page is open); anything that
 * identifies the person or the property must be right.
 */
export function parseServiceRequest(body: Record<string, unknown>): RequestParse {
  const name = text(body.name, 120);
  if (name.length < 2) return { ok: false, field: "name", message: "Add your name." };
  const email = text(body.email, 200).toLowerCase();
  if (!EMAIL.test(email)) return { ok: false, field: "email", message: "Add an email we can reply to." };
  const phoneRaw = text(body.phone, 40);
  if (phoneRaw && !/^\+?[\d\s().-]{7,}$/.test(phoneRaw)) return { ok: false, field: "phone", message: "That phone number doesn't look right." };
  const role = ids(CLIENT_ROLES).includes(text(body.role, 20)) ? text(body.role, 20) : "landlord";
  const propertyKind = ids(PROPERTY_KINDS).includes(text(body.propertyKind, 20)) ? text(body.propertyKind, 20) : "building";
  const units = count(body.units, 100_000);
  if (Number.isNaN(units)) return { ok: false, field: "units", message: "Units should be a number." };
  const buildings = count(body.buildings, 10_000);
  if (Number.isNaN(buildings)) return { ok: false, field: "buildings", message: "Buildings should be a number." };
  const services = [...new Set(list(body.services).map((s) => s.trim()))].filter((s): s is ServiceId => SERVICE.has(s as ServiceId));
  const packageId = PACKAGE.has(text(body.packageId, 40)) ? text(body.packageId, 40) : null;
  if (packageId) for (const s of PACKAGE.get(packageId)!.services) if (!services.includes(s)) services.push(s);
  if (!services.length) return { ok: false, field: "services", message: "Pick at least one service, or a package." };
  const addOns = [...new Set(list(body.addOns).map((s) => s.trim()))].filter((a) => ADD_ONS.some((x) => x.id === a));
  const timeline = ids(TIMELINES).includes(text(body.timeline, 20)) ? text(body.timeline, 20) : "exploring";
  const market = text(body.market, 80) || null;
  const address = text(body.address, 200) || null;
  if (!market && !address) return { ok: false, field: "market", message: "Tell us the city or the address." };
  if (body.consent !== true && body.consent !== "on" && body.consent !== "true") {
    return { ok: false, field: "consent", message: "Please agree to be contacted about this request." };
  }
  const src = text(body.source, 24).toLowerCase();
  const ownerLocation = text(body.ownerLocation, 80) || null;
  return {
    ok: true,
    spam: text(body.website, 200) !== "",
    request: {
      name,
      email,
      phone: phoneRaw || null,
      company: text(body.company, 120) || null,
      role,
      propertyKind,
      units,
      buildings,
      market,
      address,
      ownerLocation,
      outOfState: body.outOfState === true || body.outOfState === "on" || body.outOfState === "true" || services.includes("remote"),
      services,
      packageId,
      addOns,
      timeline,
      message: note(body.message, 3000),
      consent: true,
      source: SOURCE.test(src) ? src : "web",
      campaign: text(body.campaign, 80) || null,
      referrer: text(body.referrer, 300) || null,
    },
  };
}

const label = <T extends { id: string; label: string }>(xs: readonly T[], id: string) => xs.find((x) => x.id === id)?.label ?? id;

/** The plain-text summary the team, the requester and the CRM all get. */
export function requestSummary(r: Pick<RequestInput, "name" | "company" | "role" | "propertyKind" | "units" | "buildings" | "market" | "address" | "ownerLocation" | "outOfState" | "services" | "packageId" | "addOns" | "timeline" | "message">, withMessage = true) {
  const lines = [`Enterprise request — ${r.name}${r.company ? ` (${r.company})` : ""}`];
  lines.push(`Who: ${label(CLIENT_ROLES, r.role)}${r.outOfState ? " · out-of-state owner" : ""}${r.ownerLocation ? ` · based in ${r.ownerLocation}` : ""}`);
  const size = [r.units ? `${r.units} unit${r.units === 1 ? "" : "s"}` : "", r.buildings ? `${r.buildings} building${r.buildings === 1 ? "" : "s"}` : ""].filter(Boolean).join(", ");
  lines.push(`Property: ${label(PROPERTY_KINDS, r.propertyKind)}${size ? ` · ${size}` : ""}`);
  lines.push(`Where: ${[r.address, r.market].filter(Boolean).join(", ")}`);
  if (r.packageId) lines.push(`Package: ${packageTitle(r.packageId)}`);
  lines.push(`Services: ${r.services.map((s) => SERVICE.get(s)?.title ?? s).join(", ")}`);
  if (r.addOns.length) lines.push(`Add-ons: ${r.addOns.map((a) => ADD_ONS.find((x) => x.id === a)?.label ?? a).join(", ")}`);
  lines.push(`Timeline: ${label(TIMELINES, r.timeline)}`);
  if (withMessage && r.message) lines.push("", r.message);
  return lines.join("\n");
}

export function packageTitle(id: string | null | undefined) {
  const p = id ? PACKAGE.get(id) : undefined;
  if (!p) return "";
  const track = TRACKS.find((t) => t.id === p.track);
  return `${track?.label ?? p.track} · ${p.name}`;
}

/** The best-fit package for a request that didn't pick one — a suggestion, never applied silently. */
export function suggestPackage(r: Pick<RequestInput, "services" | "propertyKind" | "units" | "outOfState">): string {
  const has = (s: ServiceId) => r.services.includes(s);
  const units = r.units ?? 0;
  if (r.outOfState || has("remote")) return has("management") ? "ow-manage" : "ow-lease";
  if (has("furnished") || r.propertyKind === "furnished") return "pm-furnished";
  if (has("management")) return has("brokerage") || units >= 4 ? "pm-full" : "pm-essentials";
  if (has("leaseup") || r.propertyKind === "development") return "br-development";
  if (has("brokerage")) return units >= 6 || r.propertyKind === "building" || r.propertyKind === "complex" ? "br-exclusive" : "br-placement";
  if (has("social") && (units >= 50 || r.propertyKind === "portfolio")) return "mk-global";
  if (has("social") || units >= 6) return "mk-leaseup";
  return "mk-launch";
}

/** 0–100 priority for the desk: size, timing, licensed work, completeness. Transparent parts. */
export function requestScore(r: Pick<RequestInput, "units" | "buildings" | "timeline" | "services" | "phone" | "company" | "message" | "outOfState">) {
  const parts: Array<{ label: string; points: number }> = [];
  const add = (l: string, p: number) => p && parts.push({ label: l, points: p });
  const units = r.units ?? 0;
  add(units >= 100 ? "100+ units" : units >= 20 ? "20+ units" : units >= 5 ? "5+ units" : units ? "A few units" : "", units >= 100 ? 35 : units >= 20 ? 28 : units >= 5 ? 18 : units ? 8 : 0);
  add((r.buildings ?? 0) > 1 ? "Several buildings" : "", (r.buildings ?? 0) > 1 ? 10 : 0);
  add({ now: "Needs it now", "30d": "Within a month", "90d": "Within 3 months", exploring: "" }[r.timeline as "now"] ?? "", { now: 20, "30d": 14, "90d": 6, exploring: 0 }[r.timeline as "now"] ?? 0);
  add(r.services.some((s) => SERVICE.get(s)?.licensed) ? "Licensed work (recurring fees)" : "", r.services.some((s) => SERVICE.get(s)?.licensed) ? 12 : 0);
  add(r.services.length >= 3 ? "Several services" : "", r.services.length >= 3 ? 8 : 0);
  add(r.phone ? "Left a phone number" : "", r.phone ? 5 : 0);
  add(r.company ? "Company named" : "", r.company ? 5 : 0);
  add(r.message.length >= 40 ? "Wrote a real note" : "", r.message.length >= 40 ? 5 : 0);
  return { score: Math.min(100, parts.reduce((n, p) => n + p.points, 0)), parts };
}

/* ------------------------------------------------------------------------
   Money: engagements and owner statements (cents, basis points)
   ------------------------------------------------------------------------ */

export function isFeeModel(v: string): v is FeeModel {
  return Object.prototype.hasOwnProperty.call(FEE_LABEL, v);
}

/** "8" / "8.5%" → 800 / 850 basis points; null when it isn't a sane percentage. */
export function parsePct(raw: string): number | null {
  const s = String(raw ?? "").replace(/[\s%]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const bp = Math.round(Number(s) * 100);
  return bp <= 10_000 ? bp : null;
}

export function pctLabel(bp: number) {
  return `${(bp / 100).toFixed(bp % 100 ? (bp % 10 ? 2 : 1) : 0)}%`;
}

/**
 * What an engagement is worth, split into recurring monthly and one-time.
 * `rentRollCents` is the monthly rent under management (percent) or the
 * monthly rent of the leased units (commission, on twelve months).
 */
export function engagementValue(e: { feeModel: string; amountCents: number; pctBp: number; units: number; rentRollCents: number }) {
  switch (e.feeModel) {
    case "monthly":
      return { monthly: e.amountCents, once: 0 };
    case "per_unit":
      return { monthly: e.amountCents * Math.max(0, e.units), once: 0 };
    case "percent":
      return { monthly: Math.round((e.rentRollCents * e.pctBp) / 10_000) + e.amountCents, once: 0 };
    case "commission":
      return { monthly: 0, once: Math.round((e.rentRollCents * 12 * e.pctBp) / 10_000) + e.amountCents };
    default:
      return { monthly: 0, once: e.amountCents };
  }
}

export function statementTotals(s: { collectedCents: number; expensesCents: number; pctBp: number; flatFeeCents: number }) {
  const fee = Math.max(0, Math.round((Math.max(0, s.collectedCents) * s.pctBp) / 10_000) + s.flatFeeCents);
  return { fee, net: s.collectedCents - s.expensesCents - fee };
}

export function occupancy(units: number, occupied: number) {
  return units > 0 ? Math.round((Math.min(occupied, units) / units) * 100) : 0;
}

/** "2026-08" → "August 2026". */
export function monthName(ym: string) {
  const d = new Date(`${ym}-01T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? ym : d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** The month before `today` (YYYY-MM-DD) as YYYY-MM — the one a statement is due for. */
export function statementMonth(today: string) {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** Statements are due by the 10th for the month before. */
export function statementDue(p: { status: string; lastMonth: string | null }, today: string) {
  if (p.status !== "active") return false;
  const month = statementMonth(today);
  return Number(today.slice(8, 10)) >= 5 && (!p.lastMonth || p.lastMonth < month);
}

/** Licence details as shown on every enterprise page; `complete` is what the law asks for at minimum. */
export type BrokerDetails = { name: string; licence: string; states: string; phone: string; address: string; email: string };

export function brokerComplete(b: Partial<BrokerDetails>) {
  return Boolean(b.name?.trim() && b.licence?.trim() && b.states?.trim() && (b.phone?.trim() || b.address?.trim()));
}

export function brokerLine(b: Partial<BrokerDetails>) {
  if (!brokerComplete(b)) return "";
  const contact = [b.address?.trim(), b.phone?.trim()].filter(Boolean).join(" · ");
  return `${b.name!.trim()}, licensed real estate broker · Licence ${b.licence!.trim()} (${b.states!.trim()})${contact ? ` · ${contact}` : ""}`;
}

/** Only New York is in the notice rule we link to; other states have their own. */
export function licensedIn(b: Partial<BrokerDetails>, state: string) {
  return (b.states ?? "")
    .toUpperCase()
    .split(/[^A-Z]+/)
    .includes(state.toUpperCase());
}
