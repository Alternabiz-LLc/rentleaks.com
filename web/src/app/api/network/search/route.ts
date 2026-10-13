import type { NextRequest } from "next/server";
import { preflight } from "@/lib/api";
import { booksToday } from "@/lib/books/data";
import { parseSearch } from "@/lib/network/core";
import { createSearch } from "@/lib/network/engine";
import { clientKey, rateLimit, readJson } from "@/lib/v1/http";
import { METHODS, replier } from "../_shared";

export const dynamic = "force-dynamic";

export function OPTIONS(req: NextRequest) {
  return preflight(req, METHODS);
}

/** Receives a brief; private room access is delivered only to its email address. */
export async function POST(req: NextRequest) {
  const { reply, refuse, fromError } = replier(req);
  try {
    await rateLimit(`netsearch:${clientKey(req)}`, 5, 10 * 60_000);
    const parsed = parseSearch(await readJson(req), booksToday());
    if (!parsed.ok) return refuse(400, parsed.field, parsed.message);
    if (parsed.spam) return reply(201, { ok: true, room: null, checkEmail: true });
    await rateLimit(`netsearch-email:${parsed.value.email}`, 3, 60 * 60_000);
    await createSearch(parsed.value);
    return reply(201, { ok: true, room: null, checkEmail: true });
  } catch (err) {
    return fromError(err, "api/network/search");
  }
}
