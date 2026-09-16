"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveLead, saveLeadNote } from "@/app/admin/_actions/desk";

const STATUSES = [
  ["new", "New"],
  ["contacted", "Contacted"],
  ["booked", "Booked"],
  ["closed", "Closed"],
  ["spam", "Spam"],
] as const;

/** Status and private note for one lead, saved in place. */
export function LeadControls({ id, status, note }: { id: string; status: string; note: string }) {
  const router = useRouter();
  const [cur, setCur] = useState(status);
  const [text, setText] = useState(note);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="dk-leadctl">
      <div className="dk-seg" role="group" aria-label="Status">
        {STATUSES.map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={cur === k ? "is-on" : undefined}
            aria-pressed={cur === k}
            disabled={pending}
            onClick={() => {
              const prev = cur;
              setCur(k);
              start(async () => {
                const r = await moveLead(id, k);
                if (!r.ok) {
                  setCur(prev);
                  setMsg({ ok: false, text: r.error });
                } else {
                  setMsg({ ok: true, text: r.message ?? "Saved." });
                  router.refresh();
                }
              });
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="dk-field dk-field--wide">
        <span>Private note — only you see this</span>
        <textarea
          rows={3}
          maxLength={1000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            if (text === note) return;
            start(async () => {
              const r = await saveLeadNote(id, text);
              setMsg(r.ok ? { ok: true, text: r.message ?? "Saved." } : { ok: false, text: r.error });
            });
          }}
        />
      </label>
      {msg ? (
        <p className={`dk-hint ${msg.ok ? "is-ok" : "is-bad"}`} role={msg.ok ? "status" : "alert"}>
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}
