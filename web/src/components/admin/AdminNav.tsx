"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const GROUPS: Array<{ title: string; links: Array<{ href: string; label: string; badge?: string }> }> = [
  {
    title: "Run",
    links: [
      { href: "/admin", label: "Overview" },
      { href: "/admin/leads", label: "Leads", badge: "leads" },
      { href: "/admin/listings", label: "Listings", badge: "review" },
      { href: "/admin/accounts", label: "Accounts" },
      { href: "/admin/reports", label: "Reports & safety", badge: "reports" },
    ],
  },
  {
    title: "Grow",
    links: [
      { href: "/admin/crm", label: "CRM", badge: "followups" },
      { href: "/admin/outreach", label: "Outreach" },
      { href: "/admin/campaigns", label: "Email & newsletters" },
      { href: "/admin/social", label: "Social posts" },
      { href: "/admin/ads", label: "Paid ads" },
      { href: "/admin/trials", label: "Free-trial invites" },
    ],
  },
  {
    title: "Business",
    links: [
      { href: "/admin/revenue", label: "Revenue & analytics" },
      { href: "/admin/markets", label: "Markets & operators" },
      { href: "/admin/system", label: "System & settings" },
    ],
  },
];

export function AdminNav({ counts }: { counts: Record<string, number> }) {
  const pathname = usePathname();
  const active = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  return (
    <nav className="adm-nav" aria-label="Admin">
      {GROUPS.map((g) => (
        <div className="adm-nav__group" key={g.title}>
          <span className="adm-nav__title">{g.title}</span>
          {g.links.map((l) => {
            const n = l.badge ? counts[l.badge] || 0 : 0;
            const on = active(l.href);
            return (
              <Link key={l.href} href={l.href} className={on ? "is-on" : undefined} aria-current={on ? "page" : undefined}>
                <span>{l.label}</span>
                {n ? <b className="adm-nav__badge">{n > 99 ? "99+" : n}</b> : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
