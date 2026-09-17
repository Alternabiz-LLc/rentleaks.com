import { redirect } from "next/navigation";
import { cancelSignInAction } from "@/app/actions/auth";
import { Gate } from "@/components/auth/Gate";
import { VerifyCodeForm } from "@/components/auth/TwoFactorForms";
import { isStaffRole } from "@/lib/access";
import { getCurrentSession, getPendingSignIn } from "@/lib/auth";
import { safePath } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata = { title: "Enter your code", robots: { index: false } };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const next = safePath(params.next || "/admin", "/admin");
  const pending = await getPendingSignIn();
  let email = pending?.user.email;
  if (!pending) {
    const ctx = await getCurrentSession();
    if (!ctx || !isStaffRole(ctx.user)) redirect(`/login?error=expired&next=${encodeURIComponent(next)}`);
    if (!ctx.user.totpEnabledAt) redirect(`/login/two-factor?next=${encodeURIComponent(next)}`);
    if (ctx.session.mfaAt) redirect(next);
    email = ctx.user.email;
  }
  return (
    <Gate
      kicker="Two-factor sign-in"
      title="Enter your code"
      sub={
        <>
          Open your authenticator app and type the current code for <b>RentLeaks ({email})</b>.
        </>
      }
      steps={[
        { label: "Password", state: "done" },
        { label: "Code", state: "on" },
        { label: "Desk", state: "todo" },
      ]}
    >
      <VerifyCodeForm next={next} />
      <form action={cancelSignInAction}>
        <button className="gt__link" type="submit">
          Not you? Start over
        </button>
      </form>
    </Gate>
  );
}
