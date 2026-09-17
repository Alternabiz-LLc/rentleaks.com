import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { handle, HttpError, ok } from "@/lib/v1/http";
import { issueHandoff, optionalSession, redeemHandoff } from "@/lib/v1/session";
import { safePath } from "@/lib/site";

export const dynamic = "force-dynamic";

/** App → issue a single-use code for opening a web page signed in. */
export const POST = handle(async (req: Request) => {
  const s = await optionalSession(req);
  if (!s) throw new HttpError(401, "unauthenticated", "Sign in to continue.");
  const code = await issueHandoff(s.user.id, Boolean(s.mfaAt));
  return ok({ code, expiresInSeconds: 120 });
});

/** Browser → redeem the code, set the cookie, go to `next`. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = safePath(url.searchParams.get("next") || "/verify", "/verify");
  const handoff = await redeemHandoff(url.searchParams.get("code") || "");
  if (!handoff) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, url.origin));
  await createSession(handoff.userId, { mfa: handoff.mfa });
  return NextResponse.redirect(new URL(next, url.origin));
}
