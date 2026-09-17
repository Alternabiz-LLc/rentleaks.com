/**
 * Who may open which part of the desk.
 *
 * - role "admin" is the founder: everything, always.
 * - role "staff" is an employee: the modules in `staffAccess`, never the
 *   founder-only ones (money, system settings, the team itself).
 * - everyone else: nothing.
 *
 * Pure — no database — so the same rules run in pages, server actions, API
 * routes and tests.
 */

export const ACCESS_KEYS = [
  "overview",
  "leads",
  "bookings",
  "listings",
  "accounts",
  "trust",
  "reports",
  "crm",
  "outreach",
  "campaigns",
  "social",
  "ads",
  "trials",
  "hosts",
  "enterprise",
  "revenue",
  "books",
  "markets",
  "automation",
  "system",
  "team",
] as const;
export type AccessKey = (typeof ACCESS_KEYS)[number];

/** Never granted to staff, whatever the list says. */
export const FOUNDER_ONLY: readonly AccessKey[] = ["revenue", "books", "system", "team"];

/** What a staff member can be given — every key except the founder-only ones. */
export const GRANTABLE: readonly AccessKey[] = ACCESS_KEYS.filter((k) => !FOUNDER_ONLY.includes(k));

export const ACCESS_LABEL: Record<AccessKey, string> = {
  overview: "Overview",
  leads: "Leads & Match",
  bookings: "Bookings & leases",
  listings: "Listings & compliance",
  accounts: "Accounts",
  trust: "Trust radar",
  reports: "Reports & safety",
  crm: "CRM",
  outreach: "Outreach",
  campaigns: "Email & newsletters",
  social: "Social posts",
  ads: "Paid ads",
  trials: "Free-trial invites",
  hosts: "Host scorecards",
  enterprise: "Enterprise & owner services",
  revenue: "Revenue & analytics",
  books: "Books & accounting",
  markets: "Markets & demand",
  automation: "Playbooks & autopilot",
  system: "System & settings",
  team: "Team & access",
};

export type PresetKey = "manager" | "sales" | "moderator" | "marketing";

export const PRESETS: Record<PresetKey, { label: string; brief: string; access: AccessKey[] }> = {
  manager: {
    label: "Manager",
    brief: "Runs the day-to-day: every module except money, system settings and the team.",
    access: [...GRANTABLE],
  },
  sales: {
    label: "Sales & CRM",
    brief: "Answers leads, works the pipeline, sends outreach and trial invites.",
    access: ["overview", "leads", "bookings", "crm", "outreach", "campaigns", "trials", "enterprise"],
  },
  moderator: {
    label: "Moderator",
    brief: "Reviews listings, works the trust radar and reports, verifies accounts.",
    access: ["overview", "listings", "accounts", "trust", "reports", "markets", "hosts"],
  },
  marketing: {
    label: "Marketing",
    brief: "Social posts, paid ads, newsletters, outreach and the demand map.",
    access: ["overview", "social", "ads", "campaigns", "outreach", "crm", "markets", "hosts"],
  },
};

export type AccessCarrier = { role?: string | null; staffAccess?: readonly string[] | null };

export function isFounder(user: AccessCarrier | null | undefined) {
  return !!user && user.role === "admin";
}

export function isStaffRole(user: AccessCarrier | null | undefined) {
  return !!user && (user.role === "admin" || user.role === "staff");
}

/** Keeps known, grantable keys, in canonical order. Overview is always in. */
export function cleanAccess(list: readonly string[] | null | undefined): AccessKey[] {
  const set = new Set((list ?? []).filter((k): k is AccessKey => (GRANTABLE as readonly string[]).includes(k)));
  set.add("overview");
  return GRANTABLE.filter((k) => set.has(k));
}

export function canAccess(user: AccessCarrier | null | undefined, key: AccessKey) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role !== "staff") return false;
  if (FOUNDER_ONLY.includes(key)) return false;
  return cleanAccess(user.staffAccess).includes(key);
}

export function accessList(user: AccessCarrier | null | undefined): AccessKey[] {
  return ACCESS_KEYS.filter((k) => canAccess(user, k));
}

/** The preset a list matches exactly, if any — for labels. */
export function presetOf(list: readonly string[] | null | undefined): PresetKey | null {
  const have = cleanAccess(list).join(",");
  for (const [k, p] of Object.entries(PRESETS) as Array<[PresetKey, (typeof PRESETS)[PresetKey]]>) {
    if (cleanAccess(p.access).join(",") === have) return k;
  }
  return null;
}

/**
 * The access key behind an admin path. Unknown admin paths (the personal
 * Security page) return null: any signed-in staff member may open them.
 */
export function accessKeyForPath(pathname: string): AccessKey | null {
  const clean = pathname.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  if (clean === "/admin") return "overview";
  const m = /^\/admin\/([a-z-]+)/.exec(clean);
  if (!m) return null;
  const map: Record<string, AccessKey> = {
    leads: "leads",
    match: "leads",
    bookings: "bookings",
    listings: "listings",
    compliance: "listings",
    accounts: "accounts",
    trust: "trust",
    reports: "reports",
    crm: "crm",
    outreach: "outreach",
    campaigns: "campaigns",
    social: "social",
    ads: "ads",
    trials: "trials",
    hosts: "hosts",
    enterprise: "enterprise",
    revenue: "revenue",
    books: "books",
    markets: "markets",
    demand: "markets",
    playbooks: "automation",
    system: "system",
    team: "team",
  };
  return map[m[1]] ?? null;
}

/** Export kinds → the module that owns the data. */
export const EXPORT_ACCESS: Record<string, AccessKey> = {
  leads: "leads",
  contacts: "crm",
  listings: "listings",
  accounts: "accounts",
  payments: "revenue",
  campaign: "campaigns",
  invites: "trials",
  bookings: "bookings",
  ledger: "books",
  invoices: "books",
  pnl: "books",
  hosts: "hosts",
  demand: "markets",
  playbooks: "automation",
  requests: "enterprise",
  engagements: "enterprise",
  properties: "enterprise",
  statements: "enterprise",
};
