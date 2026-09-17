"use client";

import { useActionState } from "react";
import { acceptInviteAction, type JoinState } from "@/app/actions/join";

export function JoinForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState<JoinState, FormData>(acceptInviteAction, {});
  return (
    <form action={action} className="gt__form">
      <input type="hidden" name="token" value={token} />
      {/* Lets password managers save the right username. */}
      <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
      {state.error ? (
        <p className="gt__error" role="alert">
          {state.error}
        </p>
      ) : null}
      <label className="gt__field">
        Choose a password (12+ characters)
        <input name="password" type="password" autoComplete="new-password" minLength={12} required autoFocus />
      </label>
      <label className="gt__field">
        Repeat it
        <input name="confirm" type="password" autoComplete="new-password" minLength={12} required />
      </label>
      <button className="gt__btn" disabled={pending}>
        {pending ? "Saving…" : "Save password and continue"}
      </button>
      <p className="gt__muted">Next: scan a QR code with an authenticator app on your phone.</p>
    </form>
  );
}
