"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const LINKS = [
  { href: "/stays?type=room", label: "Rooms", type: "room" },
  { href: "/stays?type=coliving", label: "Co-living", type: "coliving" },
  { href: "/stays?type=furnished", label: "Furnished", type: "furnished" },
  { href: "/stays?type=short-term", label: "1-month+", type: "short-term" },
  { href: "/stays?type=lease-break", label: "Lease-break", type: "lease-break" },
  { href: "/stays?view=map", label: "Map", view: "map" },
  { href: "/stays", label: "Stays" },
  { href: "/list", label: "List a place" },
] as const;

function linkActive(
  href: (typeof LINKS)[number]["href"],
  pathname: string,
  type: string | null,
  view: string | null,
) {
  switch (href) {
    case "/list":
      return pathname === "/list";
    case "/stays?type=room":
      return pathname.startsWith("/stays") && type === "room";
    case "/stays?type=coliving":
      return pathname.startsWith("/stays") && type === "coliving";
    case "/stays?type=furnished":
      return pathname.startsWith("/stays") && type === "furnished";
    case "/stays?type=short-term":
      return pathname.startsWith("/stays") && type === "short-term";
    case "/stays?type=lease-break":
      return pathname.startsWith("/stays") && type === "lease-break";
    case "/stays?view=map":
      return pathname.startsWith("/stays") && view === "map";
    case "/stays":
      return pathname.startsWith("/stays") && !type && view !== "map";
    default: {
      const _never: never = href;
      return _never;
    }
  }
}

export function AppNav({ accountName }: { accountName?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const type = searchParams.get("type");
  const view = searchParams.get("view");

  return (
    <nav className="rl-nav" aria-label="App">
      {LINKS.map((item) => {
        const on = linkActive(item.href, pathname, type, view);
        return (
          <Link key={item.href} href={item.href} className={on ? "is-on" : undefined} aria-current={on ? "page" : undefined}>
            {item.label}
          </Link>
        );
      })}
      {accountName ? (
        <Link href="/account" className={pathname === "/account" ? "is-on" : undefined} aria-current={pathname === "/account" ? "page" : undefined}>
          {accountName}
        </Link>
      ) : null}
    </nav>
  );
}
