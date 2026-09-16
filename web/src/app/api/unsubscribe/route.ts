import { NextResponse } from "next/server";
import { unsubscribeEmail } from "@/lib/unsubscribe";
import { verifyUnsubscribeToken } from "@/lib/marketing";

export const dynamic = "force-dynamic";

/**
 * One-click unsubscribe (RFC 8058): mail clients POST here from the
 * List-Unsubscribe header without showing a page. GET sends people to the
 * confirmation page instead, so a link scanner can't unsubscribe anyone.
 */
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("t") || "";
  const email = verifyUnsubscribeToken(token);
  if (!email) return NextResponse.json({ ok: false }, { status: 400 });
  await unsubscribeEmail(email, "one-click");
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("t") || "";
  return NextResponse.redirect(new URL(`/u/${encodeURIComponent(token)}`, url.origin), 303);
}
