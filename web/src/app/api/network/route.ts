import type { NextRequest } from "next/server";
import { preflight } from "@/lib/api";
import { networkSettings } from "@/lib/network/engine";
import { prisma } from "@/lib/prisma";
import { json } from "@/lib/network/engine";
import { roster } from "@/lib/network/guides";
import { GUIDES, ROSTER_SLOTS } from "@/lib/network/core";
import { METHODS, replier } from "./_shared";

export const dynamic = "force-dynamic";

export function OPTIONS(req: NextRequest) {
  return preflight(req, METHODS);
}

/** Public numbers for rentleaks.com/hire-a-broker/: open or paused, active partners and the markets they cover. */
export async function GET(req: NextRequest) {
  const { reply, fromError } = replier(req, "public, max-age=300, stale-while-revalidate=600");
  try {
    const [s, partners, cards] = await Promise.all([
      networkSettings(),
      prisma.networkPartner.findMany({ where: { status: "active" }, select: { markets: true, licenseState: true } }),
      roster().catch(() => []),
    ]);
    const markets = new Map<string, number>();
    for (const p of partners) for (const m of json<string[]>(p.markets, [])) markets.set(`${m}, ${p.licenseState}`, (markets.get(`${m}, ${p.licenseState}`) ?? 0) + 1);
    return reply(200, {
      open: s.open,
      partners: partners.length,
      offersPerSearch: s.offersPerSearch,
      offerHours: s.offerHours,
      referralPct: s.referralPctBp / 100,
      markets: [...markets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([m]) => m),
      rosterSlots: ROSTER_SLOTS,
      roster: cards,
      guides: GUIDES.map((g) => ({ id: g.id, audience: g.audience, title: g.title, pages: g.pages })),
    });
  } catch (err) {
    return fromError(err, "api/network");
  }
}
