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

export type DeskIcon =
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
        label: "Accounts",
        icon: "accounts",
        code: "AC-01",
        brief: "Hosts, renters and founders — roles, verification status, trials and suspensions.",
        live: "Accounts live",
        keywords: "users hosts renters suspend verify",
      },
      {
        href: "/admin/reports",
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
        label: "Outreach",
        icon: "outreach",
        code: "OR-01",
        brief: "Host and operator recruiting — drafts ready to send, templates, touches this week.",
        live: "Outreach live",
        keywords: "templates prospects recruit hosts operators",
      },
      {
        href: "/admin/campaigns",
        label: "Email & newsletters",
        icon: "mail",
        code: "EM-01",
        brief: "Newsletters, announcements and outreach waves, sent in paced batches.",
        live: "Outbox live",
        keywords: "newsletter bulk messaging campaign broadcast",
      },
      {
        href: "/admin/social",
        label: "Social posts",
        icon: "social",
        code: "SO-01",
        brief: "Write once, schedule across channels — Facebook publishes itself.",
        live: "Channels live",
        keywords: "facebook instagram schedule bulk post",
      },
      {
        href: "/admin/ads",
        label: "Paid ads",
        icon: "ads",
        code: "AD-01",
        brief: "Every paid campaign against the leads it actually brought in.",
        live: "Attribution live",
        keywords: "meta google ads cost per lead utm",
      },
      {
        href: "/admin/trials",
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
        label: "Revenue & analytics",
        icon: "revenue",
        code: "RV-01",
        brief: "Money collected, recurring at posted rates, and the growth funnel over twelve weeks.",
        live: "Analytics live",
        keywords: "payments mrr funnel growth analytics",
      },
      {
        href: "/admin/markets",
        label: "Markets & operators",
        icon: "markets",
        code: "MK-01",
        brief: "City ranking, featured markets and the medians behind the Leak Score.",
        live: "Markets live",
        keywords: "cities medians operators brands",
      },
      {
        href: "/admin/system",
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

export function moduleByHref(href: string): DeskModule {
  const m = DESK_MODULES.find((x) => x.href === href);
  if (!m) throw new Error(`No desk module at ${href}`);
  return m;
}

/** Quick actions the palette offers alongside the modules. */
export const DESK_ACTIONS: Array<{ href: string; label: string; hint: string; icon: DeskIcon }> = [
  { href: "/admin/leads?status=new", label: "Reply to new leads", hint: "Leads", icon: "leads" },
  { href: "/admin/listings?moderation=pending&view=board", label: "Review pending listings", hint: "Listings", icon: "check" },
  { href: "/admin/crm?due=1", label: "Follow-ups due", hint: "CRM", icon: "clock" },
  { href: "/admin/crm?view=board", label: "CRM board", hint: "CRM", icon: "board" },
  { href: "/admin/campaigns#new", label: "New email campaign", hint: "Email", icon: "plus" },
  { href: "/admin/social#new", label: "Schedule a social post", hint: "Social", icon: "plus" },
  { href: "/admin/trials#invite", label: "Invite hosts to a free week", hint: "Trials", icon: "ticket" },
  { href: "/admin/ads#new", label: "Track a new ad campaign", hint: "Ads", icon: "plus" },
  { href: "/admin/crm#add", label: "Add a contact", hint: "CRM", icon: "plus" },
  { href: "/api/admin/export/leads", label: "Export leads (CSV)", hint: "Export", icon: "export" },
  { href: "/api/admin/export/contacts", label: "Export contacts (CSV)", hint: "Export", icon: "export" },
  { href: "/api/admin/export/listings", label: "Export listings (CSV)", hint: "Export", icon: "export" },
  { href: "/admin/system#test-email", label: "Send a test email", hint: "System", icon: "mail" },
];
