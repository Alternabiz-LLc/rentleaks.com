/**
 * The founder desk's map: one entry per module.
 *
 * The sidebar, the page headers and the ⌘K palette all read this list, so a
 * module's title, code and one-line brief cannot drift between the link that
 * opens it and the header at the top of it.
 *
 * Groups are ordered by how often a working day touches them — the book first,
 * growth second, the plumbing last — and within a group by the order of the
 * work: capture before chase, review before publish.
 */

import type { AccessKey } from "@/lib/access";

export type DeskIcon =
  | "team"
  | "lock"
  | "overview"
  | "leads"
  | "listings"
  | "accounts"
  | "shield"
  | "crm"
  | "outreach"
  | "mail"
  | "social"
  | "ads"
  | "ticket"
  | "revenue"
  | "markets"
  | "system"
  | "search"
  | "board"
  | "list"
  | "spark"
  | "export"
  | "plus"
  | "close"
  | "menu"
  | "logout"
  | "external"
  | "check"
  | "clock"
  | "flag"
  | "phone"
  | "copy";

export type DeskModule = {
  href: string;
  /** Access key (lib/access.ts) that opens this module. */
  key: AccessKey;
  label: string;
  icon: DeskIcon;
  /** Module code shown on the header, e.g. "LD-01". */
  code: string;
  /** One line under the label and under the page title. */
  brief: string;
  /** The live badge on the header. */
  live: string;
  /** Key into the layout's counts for the sidebar badge. */
  badge?: "leads" | "review" | "reports" | "followups" | "copilot";
  /** Extra words the palette should match. */
  keywords?: string;
};

export type DeskGroup = { title: string; modules: DeskModule[] };

export const DESK_GROUPS: DeskGroup[] = [
  {
    title: "Run",
    modules: [
      {
        href: "/admin",
        key: "overview",
        label: "Overview",
        icon: "overview",
        code: "OV-01",
        brief: "Today's best moves, the review queue and the whole book at a glance.",
        live: "Desk live",
        badge: "copilot",
        keywords: "dashboard copilot next best today",
      },
      {
        href: "/admin/leads",
        key: "leads",
        label: "Leads",
        icon: "leads",
        code: "LD-01",
        brief: "Viewing requests and booking asks — drag across the board, reply inside a day.",
        live: "Inbox live",
        badge: "leads",
        keywords: "inbox requests bookings viewings pipeline",
      },
      {
        href: "/admin/listings",
        key: "listings",
        label: "Listings",
        icon: "listings",
        code: "LS-01",
        brief: "Approve, decline, sponsor and correct — nothing reaches renters until it passes here.",
        live: "Catalogue live",
        badge: "review",
        keywords: "review moderation approve decline catalogue homes",
      },
      {
        href: "/admin/accounts",
        key: "accounts",
        label: "Accounts",
        icon: "accounts",
        code: "AC-01",
        brief: "Hosts, renters and founders — roles, verification status, trials and suspensions.",
        live: "Accounts live",
        keywords: "users hosts renters suspend verify",
      },
      {
        href: "/admin/reports",
        key: "reports",
        label: "Reports & safety",
        icon: "shield",
        code: "TS-01",
        brief: "Member reports and scam-guard flags, oldest first.",
        live: "Safety live",
        badge: "reports",
        keywords: "trust safety scam flags abuse",
      },
    ],
  },
  {
    title: "Grow",
    modules: [
      {
        href: "/admin/crm",
        key: "crm",
        label: "CRM",
        icon: "crm",
        code: "CR-01",
        brief: "Everyone the business talks to — stages on a board, follow-ups that come due.",
        live: "CRM live",
        badge: "followups",
        keywords: "contacts pipeline stages follow-up prospects",
      },
      {
        href: "/admin/outreach",
        key: "outreach",
        label: "Outreach",
        icon: "outreach",
        code: "OR-01",
        brief: "Host and operator recruiting — drafts ready to send, templates, touches this week.",
        live: "Outreach live",
        keywords: "templates prospects recruit hosts operators",
      },
      {
        href: "/admin/campaigns",
        key: "campaigns",
        label: "Email & newsletters",
        icon: "mail",
        code: "EM-01",
        brief: "Newsletters, announcements and outreach waves, sent in paced batches.",
        live: "Outbox live",
        keywords: "newsletter bulk messaging campaign broadcast",
      },
      {
        href: "/admin/social",
        key: "social",
        label: "Social posts",
        icon: "social",
        code: "SO-01",
        brief: "Write once, schedule across channels — Facebook publishes itself.",
        live: "Channels live",
        keywords: "facebook instagram schedule bulk post",
      },
      {
        href: "/admin/ads",
        key: "ads",
        label: "Paid ads",
        icon: "ads",
        code: "AD-01",
        brief: "Every paid campaign against the leads it actually brought in.",
        live: "Attribution live",
        keywords: "meta google ads cost per lead utm",
      },
      {
        href: "/admin/trials",
        key: "trials",
        label: "Free-trial invites",
        icon: "ticket",
        code: "TR-01",
        brief: "Personal links that let a host list free for a week — sent, redeemed, listed.",
        live: "Invites live",
        keywords: "trial invite one week free hosts",
      },
    ],
  },
  {
    title: "Business",
    modules: [
      {
        href: "/admin/revenue",
        key: "revenue",
        label: "Revenue & analytics",
        icon: "revenue",
        code: "RV-01",
        brief: "Money collected, recurring at posted rates, and the growth funnel over twelve weeks.",
        live: "Analytics live",
        keywords: "payments mrr funnel growth analytics",
      },
      {
        href: "/admin/markets",
        key: "markets",
        label: "Markets & operators",
        icon: "markets",
        code: "MK-01",
        brief: "City ranking, featured markets and the medians behind the Leak Score.",
        live: "Markets live",
        keywords: "cities medians operators brands",
      },
      {
        href: "/admin/team",
        key: "team",
        label: "Team & access",
        icon: "team",
        code: "TM-01",
        brief: "Employees, what each one can open, invitations and two-factor status.",
        live: "Team live",
        keywords: "staff employees users permissions roles invite two-factor 2fa",
      },
      {
        href: "/admin/system",
        key: "system",
        label: "System & settings",
        icon: "system",
        code: "SY-01",
        brief: "Health of every integration, business settings and the audit log.",
        live: "Systems live",
        keywords: "health email settings audit log cron",
      },
    ],
  },
];

export const DESK_MODULES: DeskModule[] = DESK_GROUPS.flatMap((g) => g.modules);

/**
 * The module a path belongs to. Longest href wins, so /admin/crm/abc resolves
 * to CRM, and /admin (a prefix of everything) only matches itself.
 */
export function moduleFor(pathname: string): DeskModule | undefined {
  return DESK_MODULES.filter((m) => (m.href === "/admin" ? pathname === "/admin" : pathname === m.href || pathname.startsWith(`${m.href}/`))).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
}

/** Pages every desk member has that are not modules in the rail. */
export const DESK_PERSONAL: DeskModule[] = [
  {
    href: "/admin/security",
    key: "overview",
    label: "Security",
    icon: "lock",
    code: "ME-01",
    brief: "Your password, two-factor sign-in, recovery codes and signed-in devices.",
    live: "Protected",
  },
];

export function moduleByHref(href: string): DeskModule {
  const m = DESK_MODULES.find((x) => x.href === href) ?? DESK_PERSONAL.find((x) => x.href === href);
  if (!m) throw new Error(`No desk module at ${href}`);
  return m;
}

/** Quick actions the palette offers alongside the modules. */
export const DESK_ACTIONS: Array<{ href: string; label: string; hint: string; icon: DeskIcon; key: AccessKey | "any" }> = [
  { href: "/admin/leads?status=new", label: "Reply to new leads", hint: "Leads", icon: "leads", key: "leads" },
  { href: "/admin/listings?moderation=pending&view=board", label: "Review pending listings", hint: "Listings", icon: "check", key: "listings" },
  { href: "/admin/crm?due=1", label: "Follow-ups due", hint: "CRM", icon: "clock", key: "crm" },
  { href: "/admin/crm?view=board", label: "CRM board", hint: "CRM", icon: "board", key: "crm" },
  { href: "/admin/campaigns#new", label: "New email campaign", hint: "Email", icon: "plus", key: "campaigns" },
  { href: "/admin/social?tab=compose", label: "Schedule a social post", hint: "Social", icon: "plus", key: "social" },
  { href: "/admin/trials#invite", label: "Invite hosts to a free week", hint: "Trials", icon: "ticket", key: "trials" },
  { href: "/admin/ads?tab=create", label: "Track a new ad campaign", hint: "Ads", icon: "plus", key: "ads" },
  { href: "/admin/crm#add", label: "Add a contact", hint: "CRM", icon: "plus", key: "crm" },
  { href: "/admin/team?tab=invite", label: "Invite a team member", hint: "Team", icon: "team", key: "team" },
  { href: "/admin/security", label: "Security: password, two-factor, devices", hint: "You", icon: "lock", key: "any" },
  { href: "/api/admin/export/leads", label: "Export leads (CSV)", hint: "Export", icon: "export", key: "leads" },
  { href: "/api/admin/export/contacts", label: "Export contacts (CSV)", hint: "Export", icon: "export", key: "crm" },
  { href: "/api/admin/export/listings", label: "Export listings (CSV)", hint: "Export", icon: "export", key: "listings" },
  { href: "/admin/system#test-email", label: "Send a test email", hint: "System", icon: "mail", key: "system" },
];

/** The rail for someone with `allowed` access: empty groups disappear. */
export function groupsFor(allowed: readonly AccessKey[]): DeskGroup[] {
  return DESK_GROUPS.map((g) => ({ ...g, modules: g.modules.filter((m) => allowed.includes(m.key)) })).filter((g) => g.modules.length > 0);
}
