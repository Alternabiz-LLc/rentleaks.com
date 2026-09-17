import { redirect } from "next/navigation";
import { Gate } from "@/components/auth/Gate";
import { readLink, type FreshAnswer } from "@/lib/ops/links";
import { applyFreshAnswer } from "@/lib/ops/freshness";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Is it still available?", robots: { index: false }, referrer: "no-referrer" as const };

const COPY: Record<FreshAnswer, { title: string; button: string; done: string }> = {
  available: { title: "Still available?", button: "Yes, it's still available", done: "Thanks — it stays live for renters." },
  rented: { title: "Rented?", button: "Yes, it's rented — take it down", done: "Congratulations — it's no longer shown to renters." },
  pause: { title: "Pause this listing?", button: "Pause it for now", done: "Paused. The “still available” link brings it back." },
};

async function answer(fd: FormData) {
  "use server";
  const token = String(fd.get("token") || "");
  const parts = readLink(token);
  if (!parts || parts[0] !== "f") redirect("/go/f/expired");
  const [, id, a] = parts as [string, string, FreshAnswer];
  if (!(a in COPY)) redirect("/go/f/expired");
  await applyFreshAnswer(id, a);
  redirect(`/go/f/${encodeURIComponent(token)}?done=1`);
}

/**
 * A host's one-tap freshness answer. The email link opens this page and the
 * button posts it — mail scanners that pre-open links can't answer for them.
 */
export default async function FreshPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ done?: string }> }) {
  const { token } = await params;
  const { done } = await searchParams;
  const parts = readLink(token);
  if (!parts || parts[0] !== "f" || !(parts[2] in COPY)) {
    return (
      <Gate kicker="Listing check" title="This link has expired">
        <p className="gt__muted">Open your listings from your RentLeaks account to update them.</p>
        <a className="gt__btn" href="/account">
          Go to my account
        </a>
      </Gate>
    );
  }
  const [, id, a] = parts as [string, string, FreshAnswer];
  const listing = await prisma.listing.findUnique({ where: { id }, select: { title: true, neighborhood: true, status: true } });
  const copy = COPY[a];
  return (
    <Gate kicker="Listing check" title={done ? "Done" : copy.title} sub={listing ? `${listing.title} · ${listing.neighborhood}` : undefined}>
      {done ? (
        <>
          <p className="gt__ok">{copy.done}</p>
          <a className="gt__btn gt__btn--ghost" href="/account">
            See all my listings
          </a>
        </>
      ) : listing ? (
        <form action={answer} className="gt__form">
          <input type="hidden" name="token" value={token} />
          <button className="gt__btn">{copy.button}</button>
          <p className="gt__muted">Wrong button? Open the other link from the same email, or manage everything from your account.</p>
        </form>
      ) : (
        <p className="gt__error">This listing no longer exists.</p>
      )}
    </Gate>
  );
}
