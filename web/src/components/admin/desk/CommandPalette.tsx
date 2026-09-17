"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DESK_ACTIONS, DESK_MODULES, type DeskIcon } from "@/lib/admin/nav";
import type { AccessKey } from "@/lib/access";
import { Icon } from "./Icon";

const OPEN_EVENT = "rl-desk-palette";

/** Opens the palette from anywhere on the desk. */
export function openPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

type Hit = { href: string; label: string; hint: string; icon: DeskIcon; group: string };

type SearchHit = { kind: "lead" | "contact" | "listing" | "account"; id: string; title: string; sub: string; href: string };

const KIND: Record<SearchHit["kind"], { label: string; icon: DeskIcon }> = {
  lead: { label: "Lead", icon: "leads" },
  contact: { label: "Contact", icon: "crm" },
  listing: { label: "Listing", icon: "listings" },
  account: { label: "Account", icon: "accounts" },
};

/**
 * ⌘K: jump to any module, run a quick action, or find a record by name,
 * email or id. Records come from /api/admin/search, debounced, so typing a
 * renter's name lands on their lead or contact in two keystrokes and Enter.
 */
export function CommandPalette({ allowed }: { allowed: AccessKey[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const [records, setRecords] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setRecords([]);
    setCursor(0);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) window.setTimeout(() => input.current?.focus(), 10);
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (!open || term.length < 2) return;
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const data = (await res.json()) as { hits?: SearchHit[] };
        setRecords(Array.isArray(data.hits) ? data.hits : []);
      } catch {
        /* aborted or offline: keep the module matches */
      } finally {
        setSearching(false);
      }
    }, 180);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [q, open]);

  const hits = useMemo<Hit[]>(() => {
    const term = q.trim().toLowerCase();
    const match = (s: string) => !term || s.toLowerCase().includes(term);
    const modules = DESK_MODULES.filter((m) => allowed.includes(m.key) && match(`${m.label} ${m.brief} ${m.keywords ?? ""} ${m.code}`)).map((m) => ({
      href: m.href,
      label: m.label,
      hint: m.code,
      icon: m.icon,
      group: "Go to",
    }));
    const actions = DESK_ACTIONS.filter((a) => (a.key === "any" || allowed.includes(a.key)) && match(`${a.label} ${a.hint}`)).map((a) => ({
      href: a.href,
      label: a.label,
      hint: a.hint,
      icon: a.icon,
      group: "Do",
    }));
    const found = (term.length >= 2 ? records : []).map((r) => ({
      href: r.href,
      label: r.title,
      hint: `${KIND[r.kind].label} · ${r.sub}`,
      icon: KIND[r.kind].icon,
      group: "Records",
    }));
    return [...found, ...modules, ...actions].slice(0, 40);
  }, [q, records, allowed]);

  const go = (hit: Hit | undefined) => {
    if (!hit) return;
    close();
    if (hit.href.startsWith("/api/")) window.location.href = hit.href;
    else router.push(hit.href);
  };

  if (!open) return null;

  let lastGroup = "";
  return (
    <div className="dk-palette" role="dialog" aria-modal="true" aria-label="Search the desk" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="dk-palette__box">
        <div className="dk-palette__input">
          <Icon name="search" />
          <input
            ref={input}
            autoFocus
            value={q}
            placeholder="Jump to a module, run an action, or find a lead, contact, listing…"
            onChange={(e) => {
              setQ(e.target.value);
              setCursor(0);
              if (e.target.value.trim().length < 2) setRecords([]);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(hits.length - 1, c + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(0, c - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(hits[cursor]);
              }
            }}
            aria-controls="dk-palette-list"
          />
          {searching ? <span className="dk-spinner" aria-label="Searching" /> : <kbd>esc</kbd>}
        </div>
        <ul id="dk-palette-list" className="dk-palette__list" role="listbox">
          {hits.length === 0 ? <li className="dk-palette__empty">Nothing matches “{q}”.</li> : null}
          {hits.map((h, i) => {
            const head = h.group !== lastGroup ? h.group : null;
            lastGroup = h.group;
            return (
              <li key={`${h.group}-${h.href}-${i}`} role="presentation">
                {head ? <p className="dk-palette__group">{head}</p> : null}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === cursor}
                  className={i === cursor ? "is-on" : undefined}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(h)}
                >
                  <span className="dk-link__icon">
                    <Icon name={h.icon} size={15} />
                  </span>
                  <span className="dk-palette__label">{h.label}</span>
                  <span className="dk-palette__hint">{h.hint}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="dk-palette__foot">
          <kbd>↑</kbd> <kbd>↓</kbd> to move · <kbd>↵</kbd> to open · <kbd>/</kbd> or <kbd>⌘K</kbd> from anywhere
        </p>
      </div>
    </div>
  );
}
