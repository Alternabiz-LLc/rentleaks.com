"use client";

/**
 * The review queue.
 *
 * One listing at a time, with everything needed to decide in front of you: the
 * photographs, the money, who is letting it, and the compliance checks the
 * composer's gate already ran against that market. Approving without seeing
 * the fee verdicts would be rubber-stamping.
 *
 * Decline demands a reason and the seller is shown it verbatim. A rejection
 * with no reason is a support ticket, and a seller who cannot tell what was
 * wrong resubmits the same listing.
 */

import { useState, useTransition } from "react";
import Link from "next/link";
import { reviewListing } from "@/app/actions/moderation";

export type QueueItem = {
  id: string;
  title: string;
  href: string;
  cityName: string;
  typeLabel: string;
  hostName: string;
  hostVerified: boolean;
  listedBy: string;
  price: string;
  allIn: string;
  deposit: string;
  feeLines: string[];
  photos: string[];
  availableFrom: string;
  availableUntil: string | null;
  createdAt: string;
  moderation: string;
  moderationNote: string | null;
  blockers: string[];
  warnings: string[];
};

const CANNED = [
  "Photographs are of the building or stock images, not this unit.",
  "The all-in price does not include every mandatory fee listed.",
  "A charge on this listing is not lawful in this market.",
  "No availability end date, so the listing cannot answer a date search.",
  "Cannot confirm the person listing has the right to let this home.",
];

export default function ModerationQueue({ items }: { items: QueueItem[] }) {
  const [pending, startTransition] = useTransition();
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, string>>({});

  function decide(id: string, decision: "approved" | "declined") {
    setError(null);
    const note = notes[id] || "";
    if (decision === "declined" && note.trim().length < 8) {
      setError("Give the seller a reason before declining — they are shown it, and without one they resubmit the same listing.");
      return;
    }
    startTransition(async () => {
      const result = await reviewListing(id, decision, note);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone((d) => ({ ...d, [id]: decision }));
      const next = items.find((i) => i.id !== id && !done[i.id]);
      setOpenId(next?.id ?? null);
    });
  }

  if (!items.length) {
    return <p className="v-note">Nothing waiting. Every listing in the catalogue has been reviewed.</p>;
  }

  return (
    <div className="m-queue">
      {error ? <p className="m-queue__err" role="alert">{error}</p> : null}

      {items.map((item) => {
        const settled = done[item.id];
        const open = openId === item.id;
        return (
          <article className="m-card" data-open={open ? "1" : undefined} data-settled={settled} key={item.id}>
            <button
              type="button"
              className="m-card__head"
              onClick={() => setOpenId(open ? null : item.id)}
              aria-expanded={open}
            >
              <span className="m-card__who">
                <b>{item.title}</b>
                {item.cityName} · {item.typeLabel} · {item.allIn} all-in · listed {item.createdAt}
              </span>
              <span className="m-card__marks">
                {item.blockers.length ? (
                  <span className="x-verdict x-verdict--fail">{item.blockers.length} blocking</span>
                ) : (
                  <span className="x-verdict x-verdict--pass">Gate clear</span>
                )}
                {item.hostVerified ? null : <span className="x-verdict x-verdict--na">Host unverified</span>}
                {settled ? (
                  <span className={`x-verdict ${settled === "approved" ? "x-verdict--pass" : "x-verdict--fail"}`}>
                    {settled === "approved" ? "Approved" : "Declined"}
                  </span>
                ) : null}
              </span>
            </button>

            {open && !settled ? (
              <div className="m-card__body">
                {item.photos.length ? (
                  <div className="m-shots">
                    {item.photos.slice(0, 6).map((src, i) => (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={src} alt={`${item.title}, photograph ${i + 1}`} key={`${src}-${i}`} />
                    ))}
                  </div>
                ) : (
                  <p className="v-note">No photographs on this listing at all.</p>
                )}

                <dl className="m-facts">
                  <div><dt>Base rent</dt><dd>{item.price}</dd></div>
                  <div><dt>All-in</dt><dd>{item.allIn}</dd></div>
                  <div><dt>Deposit</dt><dd>{item.deposit}</dd></div>
                  <div><dt>Listed by</dt><dd>{item.listedBy}</dd></div>
                  <div><dt>Host</dt><dd>{item.hostName}{item.hostVerified ? " · verified" : " · unverified"}</dd></div>
                  <div>
                    <dt>Window</dt>
                    <dd>{item.availableFrom} → {item.availableUntil || "open-ended"}</dd>
                  </div>
                </dl>

                {item.feeLines.length ? (
                  <ul className="m-fees">
                    {item.feeLines.map((f) => <li key={f}>{f}</li>)}
                  </ul>
                ) : null}

                {item.blockers.length || item.warnings.length ? (
                  <ul className="c-checks">
                    {item.blockers.map((b) => (
                      <li className="c-check" data-ok="block" key={b}>
                        <span className="c-check__m" aria-hidden="true">!</span>
                        <span><b>Blocking</b>{b}</span>
                      </li>
                    ))}
                    {item.warnings.map((w) => (
                      <li className="c-check" data-ok="0" key={w}>
                        <span className="c-check__m" aria-hidden="true">–</span>
                        <span><b>Worth asking about</b>{w}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <label className="m-note">
                  <span>Note to the seller {`(required to decline)`}</span>
                  <textarea
                    rows={2}
                    value={notes[item.id] || ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [item.id]: e.target.value }))}
                    placeholder="What has to change before this can go live?"
                  />
                </label>

                <div className="m-canned">
                  {CANNED.map((c) => (
                    <button
                      type="button"
                      className="x-chip"
                      key={c}
                      onClick={() => setNotes((n) => ({ ...n, [item.id]: c }))}
                    >
                      {c}
                    </button>
                  ))}
                </div>

                <div className="m-actions">
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={pending}
                    onClick={() => decide(item.id, "approved")}
                  >
                    Approve and publish
                  </button>
                  <button
                    type="button"
                    className="btn btn--outline"
                    disabled={pending}
                    onClick={() => decide(item.id, "declined")}
                  >
                    Decline
                  </button>
                  <Link className="btn btn--ghost" href={item.href}>
                    Open the listing page
                  </Link>
                </div>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
