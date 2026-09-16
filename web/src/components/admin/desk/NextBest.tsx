"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { snoozeContact } from "@/app/admin/_actions/desk";
import { CATEGORY_META, laneOf, type ActionCategory, type NextAction } from "@/lib/admin/score";
import { Composer, Drawer } from "./Drawer";
import { Icon } from "./Icon";
import type { DeskIcon } from "@/lib/admin/nav";

const LANES = [
  { key: "today", label: "Act today" },
  { key: "week", label: "This week" },
  { key: "opportunity", label: "Top opportunities" },
  { key: "all", label: "Everything" },
] as const;
type LaneKey = (typeof LANES)[number]["key"];

const CAT_ICON: Record<ActionCategory, DeskIcon> = {
  "new-lead": "leads",
  "waiting-lead": "clock",
  "follow-up": "clock",
  "going-quiet": "outreach",
  review: "check",
  "trial-ending": "ticket",
  "invite-idle": "ticket",
  declined: "flag",
  report: "shield",
  "post-due": "social",
  upsell: "revenue",
  qualified: "spark",
};

function priorityTone(p: number) {
  return p >= 80 ? "bad" : p >= 65 ? "warn" : p >= 50 ? "value" : "ink";
}

/**
 * "Next best actions": the ranked list of moves across the desk. Lanes split
 * it by urgency; each row carries its reason, a one-click draft where the move
 * is an email, and snooze / done so the list shrinks as the day goes.
 */
export function NextBest({ actions, limit = 12, compact = false }: { actions: NextAction[]; limit?: number; compact?: boolean }) {
  const router = useRouter();
  const [lane, setLane] = useState<LaneKey>("today");
  const [cat, setCat] = useState<ActionCategory | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<NextAction | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const live = useMemo(() => actions.filter((a) => !done.has(a.id)), [actions, done]);
  const counts = useMemo(() => {
    const c: Record<LaneKey, number> = { today: 0, week: 0, opportunity: 0, all: live.length };
    for (const a of live) c[laneOf(a)] += 1;
    return c;
  }, [live]);
  const cats = useMemo(() => {
    const m = new Map<ActionCategory, number>();
    for (const a of live) if (lane === "all" || laneOf(a) === lane) m.set(a.category, (m.get(a.category) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [live, lane]);
  const shown = live.filter((a) => (lane === "all" || laneOf(a) === lane) && (!cat || a.category === cat));
  const visible = expanded ? shown : shown.slice(0, limit);

  const finish = (a: NextAction, message?: string) => {
    setDone((s) => new Set(s).add(a.id));
    if (message) setNote(message);
  };

  return (
    <div className="dk-nba">
      <div className="dk-nba__bar">
        <nav className="dk-seg" aria-label="Lanes">
          {LANES.map((l) => (
            <button
              key={l.key}
              type="button"
              className={lane === l.key ? "is-on" : undefined}
              onClick={() => {
                setLane(l.key);
                setCat(null);
              }}
            >
              {l.label}
              <b>{counts[l.key]}</b>
            </button>
          ))}
        </nav>
        {note ? (
          <span className="dk-hint" role="status">
            {note}
          </span>
        ) : null}
      </div>
      {cats.length > 1 ? (
        <div className="dk-chiprow">
          {cats.map(([k, n]) => (
            <button key={k} type="button" className={`dk-chip dk-chip--${CATEGORY_META[k].tone}${cat === k ? " is-on" : ""}`} onClick={() => setCat(cat === k ? null : k)}>
              {CATEGORY_META[k].label} · {n}
            </button>
          ))}
        </div>
      ) : null}

      {visible.length === 0 ? (
        <div className="dk-emptybox">
          <b>{lane === "today" ? "Nothing urgent." : "Nothing here."}</b>
          <p>
            {lane === "today"
              ? "Every new lead has a reply, the review queue is clear and no follow-up is overdue."
              : "When something needs a move it lands in this lane."}
          </p>
        </div>
      ) : (
        <ol className={`dk-nba__list${compact ? " is-compact" : ""}`}>
          {visible.map((a) => {
            const meta = CATEGORY_META[a.category];
            const contactId = a.draft?.kind === "contact" ? a.draft.id : a.id.startsWith("due-") ? a.id.slice(4) : null;
            return (
              <li key={a.id} className={`dk-nba__row dk-nba__row--${meta.tone}`}>
                <span className={`dk-nba__icon dk-nba__icon--${meta.tone}`}>
                  <Icon name={CAT_ICON[a.category]} size={17} />
                </span>
                <div className="dk-nba__main">
                  <p className="dk-nba__meta">
                    <span className={`dk-chip dk-chip--${meta.tone}`}>{meta.label}</span>
                    <span className={`dk-prio dk-prio--${priorityTone(a.priority)}`} title="Priority out of 100">
                      {a.priority}
                    </span>
                    {a.who?.email ? <span className="dk-nba__who">{a.who.email}</span> : null}
                  </p>
                  <b className="dk-nba__title">{a.title}</b>
                  <p className="dk-nba__reason">{a.reason}</p>
                  {a.context ? <span className="dk-chip dk-chip--soft">{a.context}</span> : null}
                </div>
                <div className="dk-nba__actions">
                  {a.draft ? (
                    <button type="button" className="dk-btn dk-btn--primary dk-btn--sm" onClick={() => setOpen(a)}>
                      <Icon name="mail" size={14} /> {a.cta}
                    </button>
                  ) : (
                    <Link prefetch={false} className="dk-btn dk-btn--primary dk-btn--sm" href={a.href}>
                      {a.cta} →
                    </Link>
                  )}
                  <div className="dk-nba__minor">
                    {a.draft ? <Link prefetch={false} href={a.href}>Open</Link> : null}
                    {a.who?.phone ? <a href={`tel:${a.who.phone.replace(/[^\d+]/g, "")}`}>Call</a> : null}
                    {contactId && (a.category === "follow-up" || a.category === "going-quiet" || a.category === "qualified") ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            const r = await snoozeContact(contactId, 2);
                            if (r.ok) finish(a, r.message);
                            else setNote(r.error);
                          })
                        }
                      >
                        Snooze 2d
                      </button>
                    ) : null}
                    <button type="button" onClick={() => finish(a)}>
                      Done
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {shown.length > limit ? (
        <button type="button" className="dk-more" onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Show fewer" : `Show all ${shown.length}`}
        </button>
      ) : null}

      <Drawer open={Boolean(open)} onClose={() => setOpen(null)} kicker={open ? CATEGORY_META[open.category].label : undefined} title={open?.title ?? ""}>
        {open?.draft ? (
          <>
            <p className="dk-hint">{open.reason}</p>
            <Composer
              key={open.id}
              draft={open.draft}
              onSent={(m) => {
                finish(open, m);
                router.refresh();
              }}
            />
          </>
        ) : null}
      </Drawer>
    </div>
  );
}
