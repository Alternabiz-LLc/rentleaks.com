"use client";

import { useActionState, useState } from "react";
import { changePasswordAction, regenerateCodesAction, type CodesState, type PasswordState } from "@/app/actions/security";
import { Icon } from "./Icon";

function downloadCodes(codes: string[], email: string) {
  const text = `RentLeaks desk — recovery codes for ${email}\nCreated ${new Date().toISOString().slice(0, 10)}\n\nEach code works once. Keep them somewhere safe and offline.\n\n${codes.join("\n")}\n`;
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "rentleaks-recovery-codes.txt";
  a.click();
  URL.revokeObjectURL(url);
}

/** Fresh recovery codes, shown once in the desk. */
export function DeskCodes({ codes, email }: { codes: string[]; email: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="dk-stack">
      <p className="dk-flash dk-flash--ok" role="status">
        New recovery codes. The old ones stopped working. Save these now — they won&rsquo;t be shown again.
      </p>
      <ul className="dk-codes" aria-label="Recovery codes">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="dk-inline">
        <button
          type="button"
          className="dk-btn dk-btn--sm"
          onClick={async () => {
            await navigator.clipboard?.writeText(codes.join("\n")).catch(() => undefined);
            setCopied(true);
          }}
        >
          <Icon name="copy" size={13} /> {copied ? "Copied" : "Copy"}
        </button>
        <button type="button" className="dk-btn dk-btn--sm" onClick={() => downloadCodes(codes, email)}>
          <Icon name="export" size={13} /> Download .txt
        </button>
      </div>
    </div>
  );
}

export function RegenerateCodesForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<CodesState, FormData>(regenerateCodesAction, {});
  if (state.codes) return <DeskCodes codes={state.codes} email={email} />;
  return (
    <form action={action} className="dk-form">
      {state.error ? (
        <p className="dk-flash dk-flash--err dk-field--wide" role="alert">
          {state.error}
        </p>
      ) : null}
      <label className="dk-field">
        <span>Current code from your app</span>
        <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} placeholder="000000" required />
      </label>
      <button className="dk-btn dk-btn--primary" disabled={pending}>
        <Icon name="spark" size={14} /> {pending ? "Checking…" : "Print new codes"}
      </button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePasswordAction, {});
  return (
    <form action={action} className="dk-form" key={state.ok ? "done" : "form"}>
      {state.error ? (
        <p className="dk-flash dk-flash--err dk-field--wide" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="dk-flash dk-flash--ok dk-field--wide" role="status">
          {state.ok}
        </p>
      ) : null}
      <label className="dk-field dk-field--wide">
        <span>Current password</span>
        <input name="current" type="password" autoComplete="current-password" required />
      </label>
      <label className="dk-field">
        <span>New password (12+ characters)</span>
        <input name="password" type="password" autoComplete="new-password" minLength={12} required />
      </label>
      <label className="dk-field">
        <span>Repeat it</span>
        <input name="confirm" type="password" autoComplete="new-password" minLength={12} required />
      </label>
      <button className="dk-btn dk-btn--primary" disabled={pending}>
        <Icon name="lock" size={14} /> {pending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
