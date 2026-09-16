"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Draft } from "@/lib/admin/score";
import { Composer, Drawer } from "./Drawer";
import { Icon } from "./Icon";

export type RecordCard = {
  id: string;
  title: string;
  sub: string;
  initials: string;
  status: { label: string; tone: string };
  score?: number;
  scoreWhy?: string;
  chips?: Array<{ label: string; tone?: string }>;
  lines: Array<{ k?: string; v: string; tone?: "bad" | "warn" }>;
  accent?: "bad" | "warn" | "good" | "brand" | "ink";
  href: string;
  phone?: string | null;
  draft?: Draft;
  primary?: { label: string; href: string };
  selectable?: boolean;
};

function grade(score: number) {
  return score >= 80 ? "A" : score >= 62 ? "B" : score >= 42 ? "C" : "D";
}

/**
 * The card grid: initials, name and company, status and A–D chips, the
 * contact lines, and View / Reply along the bottom. Cards carry
 * `name="ids"` checkboxes so a surrounding BulkForm can act on them.
 */
export function RecordCards({ cards, empty = "Nothing matches." }: { cards: RecordCard[]; empty?: string }) {
  const router = useRouter();
  const [drafting, setDrafting] = useState<RecordCard | null>(null);
  if (!cards.length) {
    return (
      <div className="dk-emptybox">
        <b>{empty}</b>
      </div>
    );
  }
  return (
    <>
      <ul className="dk-cards">
        {cards.map((c) => (
          <li key={c.id} data-row="" className={`dk-rcard dk-rcard--${c.accent ?? "ink"}`}>
            <div className="dk-rcard__top">
              {c.selectable !== false ? <input type="checkbox" name="ids" value={c.id} aria-label={`Select ${c.title}`} /> : null}
              <span className="dk-avatar">{c.initials}</span>
              <div className="dk-rcard__who">
                <Link prefetch={false} href={c.href} className="dk-rcard__title" scroll={false}>
                  {c.title}
                </Link>
                <small>{c.sub}</small>
                <div className="dk-chiprow dk-chiprow--tight">
                  <span className={`dk-chip dk-chip--${c.status.tone}`}>{c.status.label}</span>
                  {typeof c.score === "number" ? (
                    <span className={`dk-grade dk-grade--${grade(c.score)}`} title={c.scoreWhy ?? "Priority score"}>
                      {grade(c.score)} · {c.score}
                    </span>
                  ) : null}
                  {c.chips?.map((ch) => (
                    <span key={ch.label} className={`dk-chip${ch.tone ? ` dk-chip--${ch.tone}` : ""}`}>
                      {ch.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <dl className="dk-rcard__lines">
              {c.lines.map((l, i) => (
                <div key={`${l.k}-${i}`} className={l.tone ? `is-${l.tone}` : undefined}>
                  {l.k ? <dt>{l.k}</dt> : null}
                  <dd>{l.v}</dd>
                </div>
              ))}
            </dl>
            <div className="dk-rcard__foot">
              <Link prefetch={false} className="dk-btn dk-btn--wide" href={c.href} scroll={false}>
                View
              </Link>
              {c.draft ? (
                <button type="button" className="dk-btn dk-btn--primary" onClick={() => setDrafting(c)}>
                  <Icon name="mail" size={14} /> Reply
                </button>
              ) : c.primary ? (
                <Link prefetch={false} className="dk-btn dk-btn--primary" href={c.primary.href}>
                  {c.primary.label}
                </Link>
              ) : null}
              {c.phone ? (
                <a className="dk-btn" href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} aria-label={`Call ${c.title}`}>
                  <Icon name="phone" size={14} />
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <Drawer open={Boolean(drafting)} onClose={() => setDrafting(null)} kicker="Reply" title={drafting?.title ?? ""}>
        {drafting?.draft ? <Composer key={drafting.id} draft={drafting.draft} onSent={() => router.refresh()} /> : null}
      </Drawer>
    </>
  );
}
