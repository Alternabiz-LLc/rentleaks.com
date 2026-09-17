import type { DeskIcon } from "@/lib/admin/nav";

/**
 * Inline stroke icons for the founder desk. One 24px grid, 1.75 stroke, so
 * every tile in the sidebar reads as a set rather than a collection.
 */
const PATHS: Record<DeskIcon, string> = {
  team: "M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20v-.5A5.5 5.5 0 0 1 7.5 14h1a5.5 5.5 0 0 1 5.5 5.5v.5M16 4.2a3.5 3.5 0 0 1 0 6.6M17.5 14a5.5 5.5 0 0 1 4.5 5.4v.6",
  lock: "M6 11h12v10H6zM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11M12 15v2",
  match: "M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 20v-.5A5.5 5.5 0 0 1 7.5 14H9M14 13l3 3 5-6M14 19h8",
  calendar: "M4 6h16v15H4zM4 10h16M9 3v4M15 3v4M8 14h3v3H8z",
  radar: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12l6.5-6.5M12 12h.01",
  health: "M3 12h4l2-5 4 10 2-5h6M12 21s-8-4.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10",
  map: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7z",
  books: "M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5zM4 19.5A1.5 1.5 0 0 0 5.5 21H20v-3M9 8h7M9 11.5h5",
  invoice: "M6 2h9l4 4v16l-2.5-1.5L14 22l-2-1.5L10 22l-2.5-1.5L5 22V2zM15 2v4h4M9 10h6M9 13.5h6M9 17h3",
  user: "M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM4 21v-.5A6.5 6.5 0 0 1 10.5 14h3a6.5 6.5 0 0 1 6.5 6.5v.5",
  idea: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z",
  overview: "M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z",
  leads: "M4 4h16v12H5.5L4 17.5zM8 9h8M8 12h5",
  listings: "M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6",
  accounts: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4",
  crm: "M4 6h4v12H4zM10 6h4v8h-4zM16 6h4v5h-4z",
  outreach: "M3 11l18-8-8 18-2-8zM11 13l4-4",
  mail: "M3 5h18v14H3zM3 6l9 7 9-7",
  social: "M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4",
  ads: "M3 10v4h3l6 5V5L6 10zM16 8.5a5 5 0 0 1 0 7M19 5.5a9 9 0 0 1 0 13",
  ticket: "M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4zM14 7v10",
  revenue: "M3 20h18M6 16v-5M11 16V8M16 16v-8M21 4l-5 4-5-3-5 4",
  markets: "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  system: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3.1 14H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 20.9 10H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3",
  board: "M4 4h5v16H4zM10.5 4h5v10h-5zM17 4h3v7h-3z",
  list: "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
  export: "M12 3v12M7 10l5 5 5-5M4 21h16",
  plus: "M12 5v14M5 12h14",
  close: "M6 6l12 12M18 6L6 18",
  menu: "M4 6h16M4 12h16M4 18h16",
  logout: "M15 17l5-5-5-5M20 12H9M12 21H5V3h7",
  external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  check: "M5 12l5 5L20 7",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  building: "M4 21V5l8-3v19M12 8h8v13M2 21h20M7 7h2M7 11h2M7 15h2M15 12h2M15 16h2",
};

export function Icon({ name, size = 18, className }: { name: DeskIcon; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
