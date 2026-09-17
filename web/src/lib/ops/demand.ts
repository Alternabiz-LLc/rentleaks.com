/**
 * Demand Map: what renters ask for (requests and saved searches) against what
 * is live, by market, type and budget. A gap is renters who want something at
 * a price no live home meets — where recruiting hosts pays first.
 */
import { liveListingWhere } from "@/lib/billing";
import { toUsd } from "@/lib/listing-rules";
import { prisma } from "@/lib/prisma";
import { sampleCatalogIds } from "@/lib/sample-catalog";
import { coerceSearch } from "@/lib/v1/search";

export const BANDS = [
  { key: "lt1000", label: "Under $1,000", max: 1000 },
  { key: "1000", label: "$1,000–1,500", max: 1500 },
  { key: "1500", label: "$1,500–2,000", max: 2000 },
  { key: "2000", label: "$2,000–3,000", max: 3000 },
  { key: "3000", label: "$3,000+", max: Infinity },
] as const;

export function bandOf(usd: number) {
  return BANDS.find((b) => usd < b.max)?.key ?? "3000";
}

export type Want = { cityId: string; type: string | null; maxUsd: number | null; source: "request" | "search" };
export type Have = { cityId: string; type: string; usd: number };

export type Cell = { cityId: string; type: string; demand: number; supply: number; affordable: number; budget: number | null; gap: number };

function medianOf(v: number[]) {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Pure: demand vs supply per city × type ("any" collects typeless demand). */
export function buildCells(wants: Want[], haves: Have[]): Cell[] {
  const key = (c: string, t: string) => `${c}|${t}`;
  const groups = new Map<string, Want[]>();
  for (const w of wants) {
    const k = key(w.cityId, w.type ?? "any");
    groups.set(k, [...(groups.get(k) ?? []), w]);
  }
  const cells: Cell[] = [];
  for (const [k, ws] of groups) {
    const [cityId, type] = k.split("|");
    const supplyRows = haves.filter((h) => h.cityId === cityId && (type === "any" || h.type === type));
    const budget = medianOf(ws.map((w) => w.maxUsd).filter((x): x is number => typeof x === "number" && x > 0));
    const affordable = budget ? supplyRows.filter((h) => h.usd <= budget).length : supplyRows.length;
    cells.push({ cityId, type, demand: ws.length, supply: supplyRows.length, affordable, budget, gap: Math.max(0, ws.length - affordable) });
  }
  return cells.sort((a, b) => b.gap - a.gap || b.demand - a.demand);
}

export async function loadDemand(days = 90) {
  const since = new Date(Date.now() - days * 86_400_000);
  let sample: Set<string>;
  try {
    sample = await sampleCatalogIds();
  } catch {
    sample = new Set();
  }
  const [leads, searches, live] = await Promise.all([
    prisma.lead.findMany({
      where: { createdAt: { gte: since }, status: { not: "spam" }, cityId: { not: null } },
      select: { cityId: true, housingType: true, budgetMax: true, currency: true },
    }),
    prisma.savedSearch.findMany({ where: { updatedAt: { gte: since } }, select: { query: true }, take: 5000 }),
    liveListingWhere(),
  ]);
  const listings = await prisma.listing.findMany({ where: { AND: [live, { allInUsd: { gt: 0 } }] }, select: { id: true, cityId: true, housingType: true, allInUsd: true }, take: 10000 });
  const wants: Want[] = [
    ...leads.map((l) => ({ cityId: l.cityId!, type: l.housingType, maxUsd: l.budgetMax ? Math.round(toUsd(l.budgetMax, l.currency)) : null, source: "request" as const })),
    ...searches
      .map((s) => coerceSearch(s.query))
      .filter((q) => q.city)
      .map((q) => ({ cityId: q.city!, type: q.type ?? null, maxUsd: q.maxUsd ?? null, source: "search" as const })),
  ];
  const haves: Have[] = listings.filter((l) => !sample.has(l.id)).map((l) => ({ cityId: l.cityId, type: l.housingType, usd: l.allInUsd }));
  return { wants, haves, cells: buildCells(wants, haves), examplesHidden: listings.length - haves.length };
}
