import type { NextRequest } from "next/server";
import { preflight } from "@/lib/api";
import { booksToday } from "@/lib/books/data";
import { parsePartner } from "@/lib/network/core";
import { applyPartner, networkSettings } from "@/lib/network/engine";
import { clientKey, rateLimit, readJson } from "@/lib/v1/http";
import { METHODS, replier } from "../_shared";

export const dynamic = "force-dynamic";

export function OPTIONS(req: NextRequest) {
  return preflight(req, METHODS);
}

/** Applies to the network; signing access is delivered only to the applicant mailbox. */
export async function POST(req: NextRequest) {
  const { reply, refuse, fromError } = replier(req);
  try {
    await rateLimit(`netpartner:${clientKey(req)}`, 4, 10 * 60_000);
    if (!(await networkSettings()).open) return refuse(503, "paused", "Applications are paused for a moment. Please try again later.");
    const body = await readJson(req);
    const parsed = parsePartner(body, booksToday());
    if (!parsed.ok) return refuse(400, parsed.field, parsed.message);
    if (parsed.spam) return reply(201, { ok: true, sign: null });
    await rateLimit(`netpartner-email:${parsed.value.email}`, 3, 60 * 60_000);
    const src = typeof body.source === "string" && /^[a-z0-9_]{1,24}$/.test(body.source) ? body.source : "web";
    const { signLink } = await applyPartner(parsed.value, src);
    return reply(201, { ok: true, sign: signLink, checkEmail: true });
  } catch (err) {
    return fromError(err, "api/network/partners");
  }
}
