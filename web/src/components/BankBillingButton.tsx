"use client";
import { useState } from "react";

export function BankBillingButton({ listingId, subscriptionId, disabled = false }: { listingId?: string; subscriptionId?: string; disabled?: boolean }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function openCheckout() {
    setBusy(true); setError("");
    try {
      const response = await fetch(subscriptionId ? "/api/bank-portal" : "/api/create-checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(subscriptionId ? { id: subscriptionId } : { listingId }), signal: AbortSignal.timeout(20_000) });
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error(result.error?.message || "Billing is temporarily unavailable.");
      window.location.assign(result.url);
    } catch (e) { setError(e instanceof Error ? e.message : "Please retry shortly."); setBusy(false); }
  }
  return <div><button type="button" className="btn btn--primary" disabled={disabled || busy} onClick={openCheckout}>{busy ? "Opening secure billing…" : subscriptionId ? "Manage subscription" : "Subscribe via Bank"}</button>{error ? <p role="alert">{error}</p> : null}</div>;
}
