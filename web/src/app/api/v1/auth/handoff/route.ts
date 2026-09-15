import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { handle, ok } from "@/lib/v1/http";
import { issueHandoff, redeemHandoff, requireUser } from "@/lib/v1/session";
import { safePath } from "@/lib/site";

export const dynamic = "force-dynamic";

/** App → issue a single-use code for opening a web page signed in. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  const code = await issueHandoff(user.id);
  return ok({ code, expiresInSeconds: 120 });
});

/** Browser → redeem the code, set the cookie, go to `next`. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = safePath(url.searchParams.get("next") || "/verify", "/verify");
  const userId = await redeemHandoff(url.searchParams.get("code") || "");
  if (!userId) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, url.origin));
  await createSession(userId);
  return NextResponse.redirect(new URL(next, url.origin));
}
