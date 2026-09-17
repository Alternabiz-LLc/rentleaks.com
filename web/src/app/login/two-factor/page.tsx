import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { renderSVG } from "uqr";
import { Gate } from "@/components/auth/Gate";
import { ConfirmSetupForm } from "@/components/auth/TwoFactorForms";
import { isStaffRole } from "@/lib/access";
import { getCurrentSession } from "@/lib/auth";
import { safePath } from "@/lib/site";
import { sealingReady } from "@/lib/security/seal";
import { groupSecret, otpauthUrl } from "@/lib/security/totp";
import { pendingSecret } from "@/lib/security/two-factor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set up two-factor", robots: { index: false } };

/**
 * Authenticator set-up, required before the desk opens for the first time.
 * `?change=1` moves an existing account to a new phone (verified session only).
 */
export default async function TwoFactorSetupPage({ searchParams }: { searchParams: Promise<{ next?: string; change?: string }> }) {
  const params = await searchParams;
  const changing = params.change === "1";
  const next = changing ? "/admin/security?ok=Your+new+authenticator+is+active." : safePath(params.next || "/admin", "/admin");
  const ctx = await getCurrentSession();
  if (!ctx) redirect(`/login?next=${encodeURIComponent("/login/two-factor")}`);
  const { user, session } = ctx;
  if (!isStaffRole(user)) notFound();
  if (user.totpEnabledAt && !session.mfaAt) redirect(`/login/verify?next=${encodeURIComponent(changing ? "/login/two-factor?change=1" : next)}`);
  if (user.totpEnabledAt && !changing) redirect(next);

  if (!sealingReady()) {
    return (
      <Gate kicker="Two-factor sign-in" title="One setting is missing">
        <p className="gt__error">AUTH_SECRET is not set on the server, so authenticator keys can&rsquo;t be stored safely yet.</p>
        <p className="gt__muted">Run the deploy script once more (bash tools/deploy-cloudflare.sh). It creates AUTH_SECRET automatically; then reload this page.</p>
      </Gate>
    );
  }

  const secret = await pendingSecret(user.id);
  const qr = renderSVG(otpauthUrl(secret, user.email), { border: 1, ecc: "M" });

  return (
    <Gate
      wide
      kicker={changing ? "Move to a new phone" : "Required for desk accounts"}
      title={changing ? "Switch your authenticator" : "Turn on two-factor sign-in"}
      sub={
        changing
          ? "Scan with the new phone. Your old authenticator keeps working until you confirm."
          : "Every sign-in to the desk will ask for your password and a code from your phone. It takes a minute."
      }
    >
      <ConfirmSetupForm email={user.email} next={next} changing={changing}>
      <div className="gt__pair">
        <div className="gt__qr" role="img" aria-label="QR code for your authenticator app" dangerouslySetInnerHTML={{ __html: qr }} />
        <div className="gt__form">
          <p className="gt__muted">
            <b>1.</b> Install an authenticator app on your phone:
          </p>
          <ul className="gt__apps">
            <li>Google Authenticator</li>
            <li>Microsoft Authenticator</li>
            <li>1Password</li>
            <li>Authy</li>
          </ul>
          <p className="gt__muted">
            <b>2.</b> In the app, tap <b>+</b> and scan this QR code. Can&rsquo;t scan? Choose &ldquo;enter a setup key&rdquo; and type:
          </p>
          <div className="gt__secret" aria-label="Setup key">
            {groupSecret(secret)}
          </div>
          <p className="gt__muted">
            <b>3.</b> Type the 6-digit code the app shows, with your password.
          </p>
        </div>
      </div>
      </ConfirmSetupForm>
      {changing ? (
        <Link className="gt__link" href="/admin/security" prefetch={false}>
          Cancel — keep my current authenticator
        </Link>
      ) : null}
    </Gate>
  );
}
