import type { NextRequest } from "next/server";
import { preflight } from "@/lib/api";
import { parseGuide } from "@/lib/network/core";
import { clientIp } from "@/lib/network/engine";
import { requestGuide } from "@/lib/network/guides";
import { clientKey, rateLimit, readJson } from "@/lib/v1/http";
import { METHODS, replier } from "../_shared";

export const dynamic = "force-dynamic";

export function OPTIONS(req: NextRequest) {
  return preflight(req, METHODS);
}

/**
 * Someone asks for a lead magnet and agrees to be contacted. Returns the
 * private download link, which is also emailed; the consent sentence is stored
 * with the lead.
 */
export async function POST(req: NextRequest) {
  const { reply, refuse, fromError } = replier(req);
  try {
    await rateLimit(`netguide:${clientKey(req)}`, 6, 10 * 60_000);
    const parsed = parseGuide(await readJson(req));
    if (!parsed.ok) return refuse(400, parsed.field, parsed.message);
    if (parsed.spam) return reply(201, { ok: true, download: null });
    const { link, duplicate } = await requestGuide(parsed.value, { ip: clientIp(req.headers), ua: req.headers.get("user-agent") });
    return reply(201, { ok: true, download: link, duplicate });
  } catch (err) {
    return fromError(err, "api/network/guide");
  }
}
