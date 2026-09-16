import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { verifyUnsubscribeToken } from "@/lib/marketing";
import { unsubscribeEmail } from "@/lib/unsubscribe";

export const dynamic = "force-dynamic";
export const metadata = { title: "Unsubscribe — RentLeaks", robots: { index: false } };

async function confirm(formData: FormData) {
  "use server";
  const token = String(formData.get("t") || "");
  const email = verifyUnsubscribeToken(token);
  if (email) await unsubscribeEmail(email, "unsubscribe page");
  redirect(`/u/${encodeURIComponent(token)}?done=1`);
}

function mask(email: string) {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}${"•".repeat(Math.max(1, user.length - 2))}@${domain}`;
}

export default async function UnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { token } = await params;
  const { done } = await searchParams;
  const email = verifyUnsubscribeToken(decodeURIComponent(token));
  return (
    <Shell>
      <section className="container page-hero">
        {!email ? (
          <>
            <h1>Link not recognised</h1>
            <p>This unsubscribe link is incomplete. Reply to any of our emails with “unsubscribe” and we&rsquo;ll remove you by hand.</p>
          </>
        ) : done ? (
          <>
            <h1>You&rsquo;re unsubscribed</h1>
            <p>{mask(email)} won&rsquo;t receive newsletters or promotional email from RentLeaks again. Messages about your own requests or account still arrive.</p>
          </>
        ) : (
          <>
            <h1>Unsubscribe?</h1>
            <p>Stop newsletters and promotional email to {mask(email)}.</p>
            <form action={confirm}>
              <input type="hidden" name="t" value={decodeURIComponent(token)} />
              <button className="btn btn--primary" type="submit">Unsubscribe</button>
            </form>
          </>
        )}
      </section>
    </Shell>
  );
}
