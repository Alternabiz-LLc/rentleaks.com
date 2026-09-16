"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

export type BulkOp = {
  op: string;
  label: string;
  danger?: boolean;
  needs?: "value" | "note";
  /** For needs="value": a fixed list, otherwise a text box with this placeholder. */
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
};

/**
 * Wraps a server-action form whose rows carry `<input type="checkbox" name="ids">`.
 * Ticking a row slides a bar up from the bottom with the actions; Esc clears.
 * The bar's buttons are ordinary submit buttons of the same form, so the
 * server action and its redirect-with-message behave as before.
 */
export function BulkForm({
  action,
  returnTo,
  ops,
  noun = "item",
  children,
}: {
  action: (fd: FormData) => void | Promise<void>;
  returnTo: string;
  ops: BulkOp[];
  noun?: string;
  children: React.ReactNode;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [count, setCount] = useState(0);
  const [op, setOp] = useState(ops[0]?.op ?? "");

  const recount = useCallback(() => {
    const boxes = form.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name="ids"]') ?? [];
    let n = 0;
    boxes.forEach((b) => {
      if (b.checked) n += 1;
    });
    setCount(n);
    const all = form.current?.querySelector<HTMLInputElement>("input[data-select-all]");
    if (all) {
      all.checked = n > 0 && n === boxes.length;
      all.indeterminate = n > 0 && n < boxes.length;
    }
    form.current?.querySelectorAll<HTMLElement>("[data-row]").forEach((row) => {
      const box = row.querySelector<HTMLInputElement>('input[name="ids"]');
      row.classList.toggle("is-picked", Boolean(box?.checked));
    });
  }, []);

  const clear = useCallback(() => {
    form.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name="ids"]').forEach((b) => {
      b.checked = false;
    });
    recount();
  }, [recount]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && count) clear();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, clear]);

  const current = ops.find((o) => o.op === op);

  return (
    <form
      ref={form}
      action={action}
      className="dk-bulkform"
      onChange={(e) => {
        const t = e.target as unknown as HTMLInputElement;
        if (t.dataset.selectAll !== undefined) {
          form.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name="ids"]').forEach((b) => {
            b.checked = t.checked;
          });
        }
        if (t.type === "checkbox") recount();
      }}
    >
      <input type="hidden" name="returnTo" value={returnTo} />
      {children}
      <div className={`dk-bulkbar${count ? " is-up" : ""}`} aria-hidden={!count}>
        <span className="dk-bulkbar__count">
          <b>{count}</b> {noun}
          {count === 1 ? "" : "s"} selected
        </span>
        <select name="op" value={op} onChange={(e) => setOp(e.target.value)} aria-label="Action" tabIndex={count ? 0 : -1}>
          {ops.map((o) => (
            <option key={o.op} value={o.op}>
              {o.label}
            </option>
          ))}
        </select>
        {current?.needs === "value" ? (
          current.options ? (
            <select key={current.op} name="value" aria-label={current.label} tabIndex={count ? 0 : -1}>
              {current.options.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          ) : (
            <input key={current.op} name="value" placeholder={current.placeholder ?? "Value"} aria-label={current.label} tabIndex={count ? 0 : -1} />
          )
        ) : null}
        {current?.needs === "note" ? <input name="note" placeholder="Reason — the seller sees it" aria-label="Reason" required tabIndex={count ? 0 : -1} /> : null}
        <button type="submit" className={`dk-btn ${current?.danger ? "dk-btn--danger" : "dk-btn--primary"}`} tabIndex={count ? 0 : -1}>
          <Icon name="check" size={14} /> Apply
        </button>
        <button type="button" className="dk-btn dk-btn--ghost" onClick={clear} tabIndex={count ? 0 : -1}>
          Clear <kbd>esc</kbd>
        </button>
      </div>
    </form>
  );
}

/** The header checkbox for a BulkForm table. */
export function SelectAll({ label = "Select all" }: { label?: string }) {
  return <input type="checkbox" data-select-all="" aria-label={label} />;
}
