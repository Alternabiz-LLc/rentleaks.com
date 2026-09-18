"use client";

/**
 * Leads from the Facebook landing page and the other public forms, newest
 * first. Each row opens to the full request with reply links; the status and a
 * private note are saved per lead.
 */

import { useState, useTransition } from "react";
import Link from "next/link";
import { updateLead } from "@/app/actions/leads";
import { LEAD_SOURCE_LABEL as SOURCE_LABEL } from "@/lib/leads";

export type LeadRow = {
  id: string;
  kind: string;
  kindLabel: string;
  status: string;
  name: string;
  email: string;
  phone: string | null;
  summary: string;
  listingTitle: string | null;
  listingHref: string | null;
  source: string;
  campaign: string | null;
  note: string | null;
  createdAt: string;
  waitingHours: number | null;
};

const STATUSES = [
  ["new", "New"],
  ["contacted", "Contacted"],
  ["booked", "Booked"],
  ["closed", "Closed"],
  ["spam", "Spam"],
] as const;


export default function LeadsInbox({ leads }: { leads: LeadRow[] }) {
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<string>("open");
  const [openId, setOpenId] = useState<string | null>(null);
  const [state, setState] = useState<Record<string, { status: string; note: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const current = (l: LeadRow) => state[l.id] ?? { status: l.status, note: l.note ?? "" };
  const shown = leads.filter((l) => {
    const s = current(l).status;
    if (filter === "open") return s === "new" || s === "contacted";
    return filter === "all" ? s !== "spam" : s === filter;
  });

  function save(l: LeadRow, next: { status: string; note: string }) {
    setError(null);
    setSaved(null);
    setState((m) => ({ ...m, [l.id]: next }));
    startTransition(async () => {
      const result = await updateLead(l.id, next.status, next.note);
      if (!result.ok) setError(result.error);
      else setSaved(l.id);
    });
  }

  if (!leads.length) {
    return (
      <p className="v-note">
        No leads yet. They arrive from <a href="https://rentleaks.com/facebook.html">rentleaks.com/facebook.html</a> —
        the page the Facebook &ldquo;Book now&rdquo; button and posts link to.
      </p>
    );
  }

  return (
    <div className="l-inbox">
      <div className="l-filters" role="tablist" aria-label="Filter leads">
        {[
          ["open", "Open"],
          ["new", "New"],
          ["booked", "Booked"],
          ["closed", "Closed"],
          ["all", "All"],
          ["spam", "Spam"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            className={`x-chip${filter === key ? " is-on" : ""}`}
            onClick={() => setFilter(key)}
          >
            {label}
            {key === "new" ? ` · ${leads.filter((l) => current(l).status === "new").length}` : ""}
          </button>
        ))}
      </div>
      {error ? <p className="m-queue__err" role="alert">{error}</p> : null}
      {shown.length === 0 ? <p className="v-note">Nothing in this view.</p> : null}
      <ul className="l-list">
        {shown.map((l) => {
          const c = current(l);
          const open = openId === l.id;
          const late = c.status === "new" && (l.waitingHours ?? 0) >= 24;
          return (
            <li key={l.id} className={`l-item${open ? " is-open" : ""}`} data-status={c.status}>
              <button type="button" className="l-item__head" aria-expanded={open} onClick={() => setOpenId(open ? null : l.id)}>
                <span className={`l-badge l-badge--${c.status}`}>{STATUSES.find(([k]) => k === c.status)?.[1] ?? c.status}</span>
                <b>{l.name}</b>
                <span>{l.kindLabel}{l.listingTitle ? ` · ${l.listingTitle}` : ""}</span>
                <span className={`a-dim${late ? " a-bad" : ""}`}>
                  {SOURCE_LABEL[l.source] ?? l.source} · {l.createdAt}
                  {late ? ` · waiting ${Math.floor((l.waitingHours ?? 0) / 24)}d` : ""}
                </span>
              </button>
              {open ? (
                <div className="l-item__body">
                  <pre className="l-summary">{l.summary}</pre>
                  <p className="l-contact">
                    <a className="btn btn--primary" href={`mailto:${l.email}?subject=${encodeURIComponent(`Your RentLeaks request${l.listingTitle ? ` — ${l.listingTitle}` : ""}`)}`}>
                      Email {l.email}
                    </a>
                    {l.phone ? (
                      <>
                        <a className="btn btn--outline" href={`tel:${l.phone.replace(/[^\d+]/g, "")}`}>Call {l.phone}</a>
                        <a className="btn btn--outline" href={`sms:${l.phone.replace(/[^\d+]/g, "")}`}>Text</a>
                      </>
                    ) : null}
                    {l.listingHref ? <Link className="btn btn--outline" href={l.listingHref}>Open the listing</Link> : null}
                  </p>
                  {l.campaign ? <p className="a-dim">Campaign: {l.campaign}</p> : null}
                  <div className="l-controls">
                    <label>
                      Status
                      <select
                        className="form-input"
                        value={c.status}
                        disabled={pending}
                        onChange={(e) => save(l, { ...c, status: e.target.value })}
                      >
                        {STATUSES.map(([k, label]) => (
                          <option key={k} value={k}>{label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="l-note">
                      Private note
                      <textarea
                        className="form-input"
                        rows={2}
                        maxLength={1000}
                        defaultValue={c.note}
                        placeholder="Only you see this."
                        onBlur={(e) => {
                          if (e.target.value !== c.note) save(l, { ...c, note: e.target.value });
                        }}
                      />
                    </label>
                    {saved === l.id && !pending ? <span className="a-dim" role="status">Saved</span> : null}
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
