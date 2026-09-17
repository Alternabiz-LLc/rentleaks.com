"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { verifyCodeAction, type VerifyState } from "@/app/actions/auth";
import { confirmTwoFactorAction, type CodesState } from "@/app/actions/security";

/** The six-digit (or recovery) code box used at sign-in. */
export function VerifyCodeForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<VerifyState, FormData>(verifyCodeAction, {});
  const [recovery, setRecovery] = useState(false);
  return (
    <form action={action} className="gt__form">
      <input type="hidden" name="next" value={next} />
      {state.error ? (
        <p className="gt__error" role="alert">
          {state.error}
        </p>
      ) : null}
      <label className="gt__field">
        {recovery ? "Recovery code" : "6-digit code"}
        <input
          key={recovery ? "r" : "c"}
          name="code"
          className={recovery ? undefined : "gt__code"}
          inputMode={recovery ? "text" : "numeric"}
          autoComplete="one-time-code"
          pattern={recovery ? "[A-Za-z0-9]{5}-?[A-Za-z0-9]{5}" : "[0-9 ]{6,7}"}
          maxLength={recovery ? 11 : 7}
          placeholder={recovery ? "abcde-fghjk" : "000000"}
          required
          autoFocus
          spellCheck={false}
          autoCapitalize="none"
        />
      </label>
      <button className="gt__btn" disabled={pending}>
        {pending ? "Checking…" : "Verify and open the desk"}
      </button>
      <p className="gt__muted">
        {recovery ? (
          <>
            Each recovery code works once.{" "}
            <button type="button" className="gt__link" onClick={() => setRecovery(false)}>
              Use the authenticator app instead
            </button>
          </>
        ) : (
          <>
            Lost your phone?{" "}
            <button type="button" className="gt__link" onClick={() => setRecovery(true)}>
              Use a recovery code
            </button>
          </>
        )}
      </p>
    </form>
  );
}

function download(codes: string[], email: string) {
  const text = `RentLeaks desk — recovery codes for ${email}\nCreated ${new Date().toISOString().slice(0, 10)}\n\nEach code works once. Keep them somewhere safe and offline.\n\n${codes.join("\n")}\n`;
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "rentleaks-recovery-codes.txt";
  a.click();
  URL.revokeObjectURL(url);
}

/** Shows fresh recovery codes once, with copy / download / print. */
export function RecoveryCodes({ codes, email, done }: { codes: string[]; email: string; done?: { href: string; label: string } }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <div className="gt__form">
      <p className="gt__ok" role="status">
        Two-factor is on. Save these recovery codes now — they won&rsquo;t be shown again.
      </p>
      <ul className="gt__codes" aria-label="Recovery codes">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="gt__row gt__row--start gt__noprint">
        <button
          type="button"
          className="gt__btn gt__btn--ghost"
          onClick={async () => {
            await navigator.clipboard?.writeText(codes.join("\n")).catch(() => undefined);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <button type="button" className="gt__btn gt__btn--ghost" onClick={() => download(codes, email)}>
          Download .txt
        </button>
        <button type="button" className="gt__btn gt__btn--ghost" onClick={() => window.print()}>
          Print
        </button>
      </div>
      {done ? (
        <>
          <label className="gt__check gt__noprint">
            <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> I saved my recovery codes somewhere safe.
          </label>
          {saved ? (
            <Link className="gt__btn gt__noprint" href={done.href} prefetch={false}>
              {done.label}
            </Link>
          ) : (
            <button type="button" className="gt__btn gt__noprint" disabled>
              {done.label}
            </button>
          )}
        </>
      ) : null}
    </div>
  );
}

/** Step 3 of set-up: password + first code, then the recovery codes. */
export function ConfirmSetupForm({ email, next, changing, children }: { email: string; next: string; changing: boolean; children: React.ReactNode }) {
  const [state, action, pending] = useActionState<CodesState, FormData>(confirmTwoFactorAction, {});
  /* Once confirmed, the QR code and key disappear: they are live secrets now. */
  if (state.codes) {
    return <RecoveryCodes codes={state.codes} email={email} done={{ href: next, label: changing ? "Back to security" : "Continue to the desk" }} />;
  }
  return (
    <>
    {children}
    <form action={action} className="gt__form">
      {state.error ? (
        <p className="gt__error" role="alert">
          {state.error}
        </p>
      ) : null}
      <label className="gt__field">
        Code shown in the app
        <input name="code" className="gt__code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} placeholder="000000" required spellCheck={false} />
      </label>
      <label className="gt__field">
        Your RentLeaks password
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      <button className="gt__btn" disabled={pending}>
        {pending ? "Checking…" : changing ? "Switch to this authenticator" : "Turn on two-factor"}
      </button>
    </form>
    </>
  );
}
