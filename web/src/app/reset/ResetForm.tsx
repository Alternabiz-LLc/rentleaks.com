"use client";

import { useState } from "react";

type Result = { ok?: boolean; message?: string; error?: { message: string } };

export function ResetForm({ token }: { token: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const post = async (path: string, body: unknown): Promise<Result & { status: number }> => {
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as Result;
    return { ...data, status: res.status };
  };

  const request = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await post("/api/v1/auth/forgot", { email });
    setBusy(false);
    setNote(r.error ? { tone: "error", text: r.error.message } : { tone: "ok", text: r.message ?? "Check your email." });
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setNote({ tone: "error", text: "The two passwords don’t match." });
    setBusy(true);
    const r = await post("/api/v1/auth/reset", { token, password });
    setBusy(false);
    if (r.error) return setNote({ tone: "error", text: r.error.message });
    setNote({ tone: "ok", text: "Password changed. You’ve been signed out everywhere — sign in with the new one." });
    setTimeout(() => window.location.assign("/login"), 1800);
  };

  return (
    <>
      {note ? <p className={note.tone === "error" ? "rl-error" : undefined}>{note.text}</p> : null}
      {token ? (
        <form onSubmit={reset} className="rl-form">
          <label htmlFor="reset-password">
            New password
            <input id="reset-password" type="password" minLength={8} required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label htmlFor="reset-confirm">
            Repeat it
            <input id="reset-confirm" type="password" minLength={8} required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </label>
          <button className="rl-cta" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save new password"}
          </button>
        </form>
      ) : (
        <form onSubmit={request} className="rl-form">
          <label htmlFor="reset-email">
            Email
            <input id="reset-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button className="rl-cta" type="submit" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </>
  );
}
