"use client";

/**
 * The verification desk.
 *
 * Documents never leave the browser. The file goes into an object URL held in
 * a ref, is displayed for the person to check against their own selfie, and is
 * revoked when the step ends or the page is hidden — there is no upload
 * endpoint to send it to, on purpose. What reaches the server is a name, a
 * date of birth, a document type and the attestations.
 *
 * That is a weaker check than a KYC vendor would run and it is honest about
 * being one: the trust ledger on a listing says "document and selfie checked,
 * name matched" and nothing more, because that is all this does.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { submitVerification } from "@/app/actions/verification";

const DOCS = [
  { id: "passport", label: "Passport" },
  { id: "driving-licence", label: "Driving licence" },
  { id: "national-id", label: "National ID card" },
  { id: "residence-permit", label: "Residence permit" },
];

const ATTESTATIONS = [
  {
    id: "control",
    claim: "I own this home, or I am the tenant of record, or I am authorised in writing to let it.",
    why: "Everything else on RentLeaks rests on this one. Letting a home you have no right to let is fraud in every market we operate in.",
  },
  {
    id: "accurate",
    claim: "The rent, the term, the deposit and every fee on my listings are accurate and complete.",
    why: "This is also the fee-disclosure duty in several markets: every charge the incoming renter will owe has to appear on the listing itself, not at signing.",
  },
  {
    id: "nomoney",
    claim: "I will never ask a renter to pay RentLeaks, and I understand RentLeaks holds no money.",
    why: "Deposits and rent go direct to you. We cannot reverse a payment, which is why impersonating the platform is the usual shape of a rental scam.",
  },
  {
    id: "fairhousing",
    claim: "I will not screen or advertise on a protected characteristic.",
    why: "Fair housing law applies to a private landlord letting one room, not only to agencies. Wording counts as much as the decision.",
  },
  {
    id: "photos",
    claim: "The photographs are of the unit being let and were taken by me or for me.",
    why: "Stock and duplicated photographs are the most common reason a listing is declined here, and what renters have been trained by scams to look for.",
  },
];

type Step = "start" | "document" | "selfie" | "attest" | "done";

export default function VerifyDesk({ status, name }: { status: string; name: string }) {
  const [step, setStep] = useState<Step>(status === "verified" || status === "pending" ? "done" : "start");
  const [legalName, setLegalName] = useState(name);
  const [dob, setDob] = useState("");
  const [docType, setDocType] = useState("passport");
  const [docPreview, setDocPreview] = useState<string | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [addressConfirmed, setAddressConfirmed] = useState(false);
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urls = useRef<string[]>([]);

  /* Nothing survives the page. Revoking on unload is not politeness — an
     object URL left alive is a readable copy of someone's passport. */
  const wipe = useCallback(() => {
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current = [];
    setDocPreview(null);
    setSelfiePreview(null);
  }, []);

  useEffect(() => {
    window.addEventListener("pagehide", wipe);
    return () => {
      window.removeEventListener("pagehide", wipe);
      wipe();
    };
  }, [wipe]);

  function take(file: File | undefined, set: (v: string) => void) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    urls.current.push(url);
    set(url);
  }

  const allTicked = ATTESTATIONS.every((a) => ticked[a.id]);

  async function submit() {
    setError(null);
    setBusy(true);
    const result = await submitVerification({
      legalName,
      dateOfBirth: dob,
      documentType: docType,
      livenessPassed: !!selfiePreview,
      addressConfirmed,
      attestations: ATTESTATIONS.filter((a) => ticked[a.id]).map((a) => a.id),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    wipe();
    setStep("done");
  }

  if (step === "done") {
    const verified = status === "verified";
    return (
      <div className="v-card">
        <span className="v-kicker">{verified ? "Verified" : "Submitted"}</span>
        <h2 className="v-title">{verified ? "Your account is verified" : "With us for review"}</h2>
        <p className="v-lede">
          {verified
            ? "Your listings carry the verified mark and rank above unverified ones. Nothing you uploaded was kept — the document was checked in your browser and discarded."
            : "A person checks this, usually the same day. Nothing you uploaded was kept: the document was checked in your browser against your selfie and discarded when the step ended. What we hold is your name, date of birth, document type and the statements you signed."}
        </p>
        <div className="v-actions">
          <Link className="btn btn--primary" href="/account">Back to your listings</Link>
          <Link className="btn btn--outline" href="/list">List a place</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="v-shell">
      {error ? <p className="m-queue__err" role="alert">{error}</p> : null}

      {step === "start" && (
        <div className="v-card">
          <span className="v-kicker">Four minutes</span>
          <h2 className="v-title">Prove who you are</h2>
          <p className="v-lede">
            Verified listings rank above unverified ones and are the only ones most renters will pay a deposit
            against. It costs nothing.
          </p>
          <p className="v-privacy">
            <b>Your document never leaves this browser.</b> There is no upload endpoint. You will photograph it, check
            it against your own selfie on this screen, and it is discarded when you move on. What we keep is your name,
            date of birth, which kind of document you used, and the statements you sign at the end.
          </p>
          <div className="v-actions">
            <button className="btn btn--primary" type="button" onClick={() => setStep("document")}>Start</button>
          </div>
        </div>
      )}

      {step === "document" && (
        <div className="v-card">
          <span className="v-kicker">Step 1 of 3</span>
          <h2 className="v-title">Your document</h2>
          <p className="v-lede">Government-issued, in date, all four corners in frame, no glare across the photo page.</p>

          <label className="v-field">
            <span>Full name, exactly as printed on it</span>
            <input value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="As printed" />
          </label>
          <div className="c-row">
            <label className="v-field">
              <span>Date of birth</span>
              <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </label>
            <label className="v-field">
              <span>Document</span>
              <select value={docType} onChange={(e) => setDocType(e.target.value)}>
                {DOCS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </label>
          </div>

          <label className="v-upload">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => take(e.target.files?.[0], setDocPreview)}
            />
            <span>{docPreview ? "Retake the document photo" : "Photograph the document"}</span>
          </label>
          {docPreview ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img className="v-shot" src={docPreview} alt="The document you just photographed, shown for you to check" />
          ) : null}

          <div className="v-actions">
            <button className="btn btn--ghost" type="button" onClick={() => setStep("start")}>Back</button>
            <button
              className="btn btn--primary"
              type="button"
              disabled={!docPreview || legalName.trim().length < 3 || !dob}
              onClick={() => setStep("selfie")}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {step === "selfie" && (
        <div className="v-card">
          <span className="v-kicker">Step 2 of 3</span>
          <h2 className="v-title">And a selfie</h2>
          <p className="v-lede">
            Side by side, they should obviously be the same person. This is the step that stops a stolen or bought
            document being used, which is why it is not optional.
          </p>
          <label className="v-upload">
            <input type="file" accept="image/*" capture="user" onChange={(e) => take(e.target.files?.[0], setSelfiePreview)} />
            <span>{selfiePreview ? "Retake the selfie" : "Take a selfie"}</span>
          </label>
          {docPreview && selfiePreview ? (
            <div className="v-docgrid">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="v-shot" src={docPreview} alt="Your document" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="v-shot" src={selfiePreview} alt="Your selfie" />
            </div>
          ) : null}
          <div className="v-actions">
            <button className="btn btn--ghost" type="button" onClick={() => setStep("document")}>Back</button>
            <button className="btn btn--primary" type="button" disabled={!selfiePreview} onClick={() => setStep("attest")}>
              Next
            </button>
          </div>
        </div>
      )}

      {step === "attest" && (
        <div className="v-card">
          <span className="v-kicker">Step 3 of 3</span>
          <h2 className="v-title">Sign the statements</h2>
          <p className="v-lede">
            Five of them. Each is a rule someone has lost money or a home over, so read them rather than clicking
            through.
          </p>
          <div className="v-attest">
            {ATTESTATIONS.map((a) => (
              <label className={ticked[a.id] ? "v-attest__row is-on" : "v-attest__row"} key={a.id}>
                <input
                  type="checkbox"
                  checked={!!ticked[a.id]}
                  onChange={(e) => setTicked((t) => ({ ...t, [a.id]: e.target.checked }))}
                />
                <span>
                  <b>{a.claim}</b>
                  {a.why}
                </span>
              </label>
            ))}
          </div>
          <label className="v-attest__row" style={{ marginTop: "var(--s-3)" }}>
            <input type="checkbox" checked={addressConfirmed} onChange={(e) => setAddressConfirmed(e.target.checked)} />
            <span>
              <b>Optional: I can produce a document showing control of the address if asked.</b>
              A deed, a rates bill, a lease or a management agreement. We are not asking for it now — ticking this
              says you have one.
            </span>
          </label>
          <div className="v-actions">
            <button className="btn btn--ghost" type="button" onClick={() => setStep("selfie")}>Back</button>
            <button className="btn btn--primary" type="button" disabled={!allTicked || busy} onClick={submit}>
              {busy ? "Sending…" : "Submit for review"}
            </button>
          </div>
          {!allTicked ? <p className="v-note">All five have to be true before this can be submitted.</p> : null}
        </div>
      )}
    </div>
  );
}
