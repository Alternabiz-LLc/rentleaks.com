"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { sendDraft } from "@/app/admin/_actions/desk";
import type { Draft } from "@/lib/admin/score";
import { Icon } from "./Icon";

/** A side sheet. Esc or the scrim closes it; focus moves into it on open. */
export function Drawer({
  open,
  onClose,
  title,
  kicker,
  children,
  width = 560,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  kicker?: string;
  children: React.ReactNode;
  width?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => box.current?.focus(), 20);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="dk-drawer" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : "Details"}>
      <button type="button" className="dk-drawer__scrim" aria-label="Close" onClick={onClose} />
      <div ref={box} tabIndex={-1} className="dk-drawer__box" style={{ maxWidth: width }}>
        <div className="dk-drawer__head">
          <div>
            {kicker ? <p className="dk-kicker">{kicker}</p> : null}
            <h2>{title}</h2>
          </div>
          <button type="button" className="dk-iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="dk-drawer__body">{children}</div>
      </div>
    </div>
  );
}

/**
 * An editable email draft with Send. Merge fields ({{first_name}}, {{city}}…)
 * are filled at send time; the mail-app link is there for when no provider is
 * configured or the founder would rather send from their phone.
 */
export function Composer({ draft, onSent }: { draft: Draft; onSent?: (message: string) => void }) {
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const send = () => {
    setResult(null);
    start(async () => {
      const r = await sendDraft({ kind: draft.kind, id: draft.id, subject, body });
      if (r.ok) {
        setResult({ ok: true, text: r.message || "Sent." });
        onSent?.(r.message || "Sent.");
      } else setResult({ ok: false, text: r.error });
    });
  };

  const mailto = `mailto:${draft.to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div className="dk-compose">
      <div className="dk-compose__to">
        <span>To</span>
        <b>{draft.to}</b>
      </div>
      <label className="dk-field dk-field--wide">
        <span>Subject</span>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
      </label>
      <label className="dk-field dk-field--wide">
        <span>Message</span>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} />
      </label>
      <p className="dk-hint">
        Merge fields fill in when it sends: {"{{first_name}} {{name}} {{city}} {{app_url}}"}. Your mailing address and a
        “sent personally” line are added at the foot.
      </p>
      {result ? (
        <p className={`dk-flash ${result.ok ? "dk-flash--ok" : "dk-flash--err"}`} role={result.ok ? "status" : "alert"}>
          {result.text}
        </p>
      ) : null}
      <div className="dk-compose__actions">
        <button type="button" className="dk-btn dk-btn--primary" onClick={send} disabled={pending || result?.ok}>
          <Icon name="mail" size={15} />
          {pending ? "Sending…" : result?.ok ? "Sent" : "Send email"}
        </button>
        <a className="dk-btn" href={mailto}>
          <Icon name="external" size={14} /> Open in mail app
        </a>
        <button
          type="button"
          className="dk-btn dk-btn--ghost"
          onClick={() => {
            void navigator.clipboard?.writeText(`${subject}\n\n${body}`).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          <Icon name="copy" size={14} /> {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
