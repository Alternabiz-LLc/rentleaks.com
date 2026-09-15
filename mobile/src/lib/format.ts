export function money(n: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(Math.round(n) || 0);
  } catch {
    return `${currency} ${Math.round(n).toLocaleString()}`;
  }
}

export function isoToday(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return toIso(d);
}

export function toIso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromIso(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function shortDate(iso?: string | null) {
  if (!iso) return "Open-ended";
  const d = fromIso(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined });
}

/** Same day-of-month N months on, clamped to the target month's length. */
export function addMonths(iso: string, months: number) {
  const d = fromIso(iso);
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), last));
  return toIso(target);
}

export function daysBetween(a: string, b: string) {
  return Math.round((fromIso(b).getTime() - fromIso(a).getTime()) / 86_400_000);
}

export function stayLabel(moveIn?: string, moveOut?: string) {
  if (!moveIn && !moveOut) return "Any dates";
  if (moveIn && moveOut) {
    const days = daysBetween(moveIn, moveOut);
    const months = Math.floor(days / 30);
    return `${shortDate(moveIn)} → ${shortDate(moveOut)} · ${months >= 1 ? `${months} mo` : `${days} d`}`;
  }
  return moveIn ? `From ${shortDate(moveIn)}` : `Until ${shortDate(moveOut)}`;
}

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)}d`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const LISTED_BY: Record<string, string> = {
  owner: "By owner",
  manager: "Managing agent",
  tenant: "Lease takeover",
};

export const PETS: Record<string, string> = {
  none: "No pets",
  cats: "Cats OK",
  dogs: "Dogs OK",
  "cats-dogs": "Cats & dogs OK",
  "case-by-case": "Pets case by case",
};

export const AMENITY_LABELS: Record<string, string> = {
  wifi: "Wi-Fi",
  workspace: "Workspace",
  laundry: "Laundry",
  "in-unit-laundry": "In-unit laundry",
  dishwasher: "Dishwasher",
  ac: "Air conditioning",
  heating: "Heating",
  gym: "Gym",
  elevator: "Elevator",
  doorman: "Doorman",
  parking: "Parking",
  outdoor: "Outdoor space",
  "bike-storage": "Bike storage",
};

export function humanize(key: string) {
  return AMENITY_LABELS[key] ?? key.replace(/[-_]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
