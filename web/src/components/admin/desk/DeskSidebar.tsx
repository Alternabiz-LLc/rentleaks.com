"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { moduleFor, type DeskGroup, type DeskModule } from "@/lib/admin/nav";
import { Icon } from "./Icon";
import { openPalette } from "./CommandPalette";

const COLLAPSED_KEY = "rl.desk.collapsed";

export type DeskCounts = Partial<Record<NonNullable<DeskModule["badge"]>, number>>;

/**
 * The desk rail: grouped by what the founder is trying to do, each entry with
 * its icon tile and a one-line brief. Groups fold and stay folded per browser;
 * a folded group that holds the current page shows a dot rather than hiding
 * where you are.
 */
export function DeskSidebar({
  counts,
  user,
  groups,
}: {
  counts: DeskCounts;
  user: { name: string; email: string; title: string; founder: boolean };
  /** Only the modules this person may open (see groupsFor). */
  groups: DeskGroup[];
}) {
  const deskName = user.founder ? "Founder desk" : "Team desk";
  const pathname = usePathname() || "/admin";
  const active = moduleFor(pathname);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COLLAPSED_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring a per-browser preference after hydration
      if (raw) setCollapsed(JSON.parse(raw) as string[]);
    } catch {
      /* storage refused: every group stays open */
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- close the mobile drawer on navigation
    setOpen(false);
  }, [pathname]);

  const toggle = (title: string) => {
    setCollapsed((cur) => {
      const next = cur.includes(title) ? cur.filter((t) => t !== title) : [...cur, title];
      try {
        window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
      } catch {
        /* a browser refusing storage must not break navigation */
      }
      return next;
    });
  };

  const initial = (user.name || user.email || "F").trim().charAt(0).toUpperCase();

  return (
    <>
      <div className="dk-mobilebar">
        <button type="button" className="dk-iconbtn" onClick={() => setOpen(true)} aria-label="Open the desk menu">
          <Icon name="menu" />
        </button>
        <Link href="/admin" className="dk-brand dk-brand--inline">
          <span className="dk-brand__mark">RL</span>
          <span>
            <b>RentLeaks</b>
            <small>{deskName}</small>
          </span>
        </Link>
        <button type="button" className="dk-iconbtn" onClick={openPalette} aria-label="Search the desk">
          <Icon name="search" />
        </button>
      </div>

      {open ? <button type="button" className="dk-scrim" aria-label="Close the menu" onClick={() => setOpen(false)} /> : null}

      <aside className={`dk-rail${open ? " is-open" : ""}`} aria-label={deskName}>
        <div className="dk-rail__top">
          <Link href="/admin" className="dk-brand">
            <span className="dk-brand__mark">RL</span>
            <span>
              <b>RentLeaks</b>
              <small>{deskName}</small>
            </span>
          </Link>
          <button type="button" className="dk-iconbtn dk-rail__close" onClick={() => setOpen(false)} aria-label="Close the menu">
            <Icon name="close" />
          </button>
        </div>

        <button type="button" className="dk-search" onClick={openPalette}>
          <Icon name="search" size={16} />
          <span>Search leads, homes, people…</span>
          <kbd>⌘K</kbd>
        </button>

        <nav className="dk-nav">
          {groups.map((group) => {
            const holds = group.modules.some((m) => m.href === active?.href);
            const isFolded = collapsed.includes(group.title) && !holds;
            const groupCount = group.modules.reduce((n, m) => n + (m.badge ? counts[m.badge] || 0 : 0), 0);
            return (
              <div key={group.title} className="dk-nav__group">
                <button
                  type="button"
                  className="dk-nav__title"
                  aria-expanded={!isFolded}
                  onClick={() => toggle(group.title)}
                >
                  <span>{group.title}</span>
                  {isFolded && groupCount ? <b className="dk-count dk-count--soft">{groupCount}</b> : null}
                  <svg viewBox="0 0 12 12" width="12" height="12" className={isFolded ? "is-folded" : undefined} aria-hidden="true">
                    <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {!isFolded ? (
                  <ul>
                    {group.modules.map((m) => {
                      const on = m.href === active?.href;
                      const n = m.badge ? counts[m.badge] || 0 : 0;
                      return (
                        <li key={m.href}>
                          <Link href={m.href} className={`dk-link${on ? " is-on" : ""}`} aria-current={on ? "page" : undefined}>
                            <span className="dk-link__icon">
                              <Icon name={m.icon} size={16} />
                            </span>
                            <span className="dk-link__text">
                              <span className="dk-link__label">
                                {m.label}
                                {n ? <b className={`dk-count${m.badge === "reports" ? " dk-count--alert" : ""}`}>{n > 99 ? "99+" : n}</b> : null}
                              </span>
                              <span className="dk-link__brief">{m.brief}</span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className="dk-rail__foot">
          <div className="dk-me">
            <span className="dk-me__avatar">{initial}</span>
            <span className="dk-me__text">
              <b>{user.name || "Founder"}</b>
              <small>{user.title}</small>
            </span>
          </div>
          <div className="dk-rail__actions">
            <Link className={`dk-btn dk-btn--ghost${pathname === "/admin/security" ? " is-on" : ""}`} href="/admin/security">
              <Icon name="lock" size={14} /> Security
            </Link>
            <Link className="dk-btn dk-btn--ghost" href="/stays">
              <Icon name="external" size={14} /> View app
            </Link>
            <form action={logoutAction}>
              <button className="dk-btn dk-btn--ghost" type="submit">
                <Icon name="logout" size={14} /> Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
