"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { moveContact, moveLead, reviewFromBoard, type DeskResult } from "@/app/admin/_actions/desk";
import { moveBooking } from "@/app/admin/_actions/bookings";
import { moveEngagement, moveRequest } from "@/app/admin/_actions/enterprise";
import { moveSearch } from "@/app/admin/_actions/referrals";
import type { Draft } from "@/lib/admin/score";
import { Composer, Drawer } from "./Drawer";
import { Icon } from "./Icon";

export type BoardColumn = { key: string; label: string; hint?: string; tone?: "brand" | "good" | "warn" | "bad" | "ink" | "value"; more?: { count: number; href: string } };

export type BoardCard = {
  id: string;
  column: string;
  title: string;
  sub?: string;
  initials?: string;
  score?: number;
  chips?: Array<{ label: string; tone?: string }>;
  lines?: string[];
  alert?: string;
  href?: string;
  external?: string;
  phone?: string | null;
  draft?: Draft;
  image?: string | null;
};

type Mode = "lead" | "contact" | "listing" | "booking" | "request" | "engagement" | "search";

const DRAG = "text/rl-card";

function grade(score: number) {
  return score >= 80 ? "A" : score >= 62 ? "B" : score >= 42 ? "C" : "D";
}

async function move(mode: Mode, id: string, to: string, note: string): Promise<DeskResult> {
  if (mode === "lead") return moveLead(id, to);
  if (mode === "contact") return moveContact(id, to);
  if (mode === "booking") return moveBooking(id, to);
  if (mode === "request") return moveRequest(id, to);
  if (mode === "engagement") return moveEngagement(id, to);
  if (mode === "search") return moveSearch(id, to);
  return reviewFromBoard(id, to, note);
}

/**
 * Kanban for leads, contacts and listings in review. Drag a card, or use its
 * "Move to" menu (keyboard and touch). Moves are optimistic and roll back with
 * the server's reason if refused — e.g. declining a listing without saying why.
 */
export function Board({ mode, columns, cards: initial, empty = "Nothing here." }: { mode: Mode; columns: BoardColumn[]; cards: BoardCard[]; empty?: string }) {
  const router = useRouter();
  const [cards, setCards] = useState(initial);
  const [over, setOver] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [asking, setAsking] = useState<{ id: string; to: string } | null>(null);
  const [reason, setReason] = useState("");
  const [drafting, setDrafting] = useState<BoardCard | null>(null);
  const [, start] = useTransition();
  const [seed, setSeed] = useState(initial);
  if (seed !== initial) {
    // New server data (after a refresh): take it.
    setSeed(initial);
    setCards(initial);
  }

  const doMove = (id: string, to: string, note = "") => {
    const card = cards.find((c) => c.id === id);
    if (!card || card.column === to) return;
    if (mode === "listing" && to === "declined" && note.trim().length < 8) {
      setAsking({ id, to });
      setReason("");
      return;
    }
    const from = card.column;
    setCards((cur) => cur.map((c) => (c.id === id ? { ...c, column: to } : c)));
    setBusy((b) => new Set(b).add(id));
    setMsg(null);
    start(async () => {
      const r = await move(mode, id, to, note);
      setBusy((b) => {
        const n = new Set(b);
        n.delete(id);
        return n;
      });
      if (!r.ok) {
        setCards((cur) => cur.map((c) => (c.id === id ? { ...c, column: from } : c)));
        setMsg({ ok: false, text: r.error });
      } else {
        setMsg({ ok: true, text: `${card.title}: ${r.message ?? "moved"}` });
        router.refresh();
      }
    });
  };

  return (
    <div className="dk-board-wrap">
      {msg ? (
        <p className={`dk-flash ${msg.ok ? "dk-flash--ok" : "dk-flash--err"}`} role={msg.ok ? "status" : "alert"}>
          {msg.text}
        </p>
      ) : null}
      <div className="dk-board" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(264px, 1fr))` }}>
        {columns.map((col) => {
          const mine = cards.filter((c) => c.column === col.key);
          return (
            <section
              key={col.key}
              className={`dk-col${over === col.key ? " is-over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (over !== col.key) setOver(col.key);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const id = e.dataTransfer.getData(DRAG);
                if (id) doMove(id, col.key);
              }}
              aria-label={`${col.label}: ${mine.length}`}
            >
              <header className={`dk-col__head dk-col__head--${col.tone ?? "ink"}`}>
                <b>{col.label}</b>
                <span className="dk-count dk-count--soft">{mine.length + (col.more?.count ?? 0)}</span>
                {col.hint ? <small>{col.hint}</small> : null}
              </header>
              <ul className="dk-col__cards">
                {mine.length === 0 ? <li className="dk-col__empty">{empty}</li> : null}
                {mine.map((c) => (
                  <li
                    key={c.id}
                    className={`dk-card${busy.has(c.id) ? " is-busy" : ""}${c.alert ? " has-alert" : ""}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DRAG, c.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                  >
                    {c.image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- R2 and seeded images of any origin
                      <img className="dk-card__img" src={c.image} alt="" loading="lazy" />
                    ) : null}
                    <div className="dk-card__top">
                      {c.initials ? <span className="dk-avatar dk-avatar--sm">{c.initials}</span> : null}
                      <div className="dk-card__who">
                        {c.href ? (
                          <Link prefetch={false} href={c.href} className="dk-card__title" scroll={false}>
                            {c.title}
                          </Link>
                        ) : (
                          <b className="dk-card__title">{c.title}</b>
                        )}
                        {c.sub ? <small>{c.sub}</small> : null}
                      </div>
                      {typeof c.score === "number" ? (
                        <span className={`dk-grade dk-grade--${grade(c.score)}`} title="Priority score">
                          {grade(c.score)} · {c.score}
                        </span>
                      ) : null}
                    </div>
                    {c.chips?.length ? (
                      <div className="dk-chiprow dk-chiprow--tight">
                        {c.chips.map((ch) => (
                          <span key={ch.label} className={`dk-chip${ch.tone ? ` dk-chip--${ch.tone}` : ""}`}>
                            {ch.label}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {c.lines?.map((l) => (
                      <p key={l} className="dk-card__line">
                        {l}
                      </p>
                    ))}
                    {c.alert ? <p className="dk-card__alert">{c.alert}</p> : null}
                    <div className="dk-card__foot">
                      <select
                        aria-label={`Move ${c.title} to`}
                        value=""
                        onChange={(e) => e.target.value && doMove(c.id, e.target.value)}
                      >
                        <option value="">Move to…</option>
                        {columns
                          .filter((k) => k.key !== c.column)
                          .map((k) => (
                            <option key={k.key} value={k.key}>
                              {k.label}
                            </option>
                          ))}
                      </select>
                      {c.draft ? (
                        <button type="button" className="dk-btn dk-btn--primary dk-btn--sm" onClick={() => setDrafting(c)}>
                          <Icon name="mail" size={13} /> Reply
                        </button>
                      ) : null}
                      {c.phone ? (
                        <a className="dk-btn dk-btn--sm" href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} aria-label={`Call ${c.title}`}>
                          <Icon name="phone" size={13} />
                        </a>
                      ) : null}
                      {c.external ? (
                        <a className="dk-btn dk-btn--sm" href={c.external} target="_blank" rel="noreferrer" aria-label="Open the public page">
                          <Icon name="external" size={13} />
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
                {col.more ? (
                  <li>
                    <Link prefetch={false} className="dk-more" href={col.more.href}>
                      +{col.more.count} more in the list →
                    </Link>
                  </li>
                ) : null}
              </ul>
            </section>
          );
        })}
      </div>

      <Drawer open={Boolean(asking)} onClose={() => setAsking(null)} kicker="Decline" title="Why is this listing declined?" width={480}>
        <p className="dk-hint">The seller sees this sentence verbatim. Without one, the same listing comes back next week.</p>
        <div className="dk-chiprow">
          {[
            "Photographs are of the building or stock images, not this unit.",
            "The all-in price does not include every mandatory fee listed.",
            "No availability end date, so the listing cannot answer a date search.",
            "Cannot confirm the person listing has the right to let this home.",
          ].map((r) => (
            <button key={r} type="button" className="dk-chip dk-chip--soft" onClick={() => setReason(r)}>
              {r}
            </button>
          ))}
        </div>
        <label className="dk-field dk-field--wide">
          <span>Reason</span>
          <textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <div className="dk-compose__actions">
          <button
            type="button"
            className="dk-btn dk-btn--danger"
            disabled={reason.trim().length < 8}
            onClick={() => {
              if (asking) doMove(asking.id, asking.to, reason);
              setAsking(null);
            }}
          >
            Decline listing
          </button>
          <button type="button" className="dk-btn dk-btn--ghost" onClick={() => setAsking(null)}>
            Cancel
          </button>
        </div>
      </Drawer>

      <Drawer open={Boolean(drafting)} onClose={() => setDrafting(null)} kicker="Reply" title={drafting?.title ?? ""}>
        {drafting?.draft ? (
          <Composer
            key={drafting.id}
            draft={drafting.draft}
            onSent={() => {
              router.refresh();
            }}
          />
        ) : null}
      </Drawer>
    </div>
  );
}
