import type { NextRequest } from "next/server";
import { preflight } from "@/lib/api";
import { booksToday } from "@/lib/books/data";
import { parseSearch } from "@/lib/network/core";
import { createSearch, roomLink } from "@/lib/network/engine";
import { clientKey, rateLimit, readJson } from "@/lib/v1/http";
import { METHODS, replier } from "../_shared";

export const dynamic = "force-dynamic";

export function OPTIONS(req: NextRequest) {
  return preflight(req, METHODS);
}

/** A tenant's brief: they want to hire a broker. Returns the private search-room link. */
export async function POST(req: NextRequest) {
  const { reply, refuse, fromError } = replier(req);
  try {
    await rateLimit(`netsearch:${clientKey(req)}`, 5, 10 * 60_000);
    const parsed = parseSearch(await readJson(req), booksToday());
    if (!parsed.ok) return refuse(400, parsed.field, parsed.message);
    if (parsed.spam) return reply(201, { ok: true, room: null });
    const { search, duplicate } = await createSearch(parsed.value);
    return reply(201, { ok: true, room: roomLink(search), duplicate });
  } catch (err) {
    return fromError(err, "api/network/search");
  }
}
