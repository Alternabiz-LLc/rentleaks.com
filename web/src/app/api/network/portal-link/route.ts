import type { NextRequest } from "next/server";
import { preflight } from "@/lib/api";
import { emailPortalLink } from "@/lib/network/engine";
import { clientKey, rateLimit, readJson } from "@/lib/v1/http";
import { METHODS, replier } from "../_shared";

export const dynamic = "force-dynamic";

export function OPTIONS(req: NextRequest) {
  return preflight(req, METHODS);
}

/** "Email me my portal link." Always answers the same way, so it can't be used to test addresses. */
export async function POST(req: NextRequest) {
  const { reply, fromError } = replier(req);
  try {
    await rateLimit(`netlink:${clientKey(req)}`, 5, 10 * 60_000);
    const body = await readJson(req);
    const email = typeof body.email === "string" ? body.email.slice(0, 200) : "";
    if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) await emailPortalLink(email).catch((e) => console.error("[portal-link]", e));
    return reply(200, { ok: true });
  } catch (err) {
    return fromError(err, "api/network/portal-link");
  }
}
