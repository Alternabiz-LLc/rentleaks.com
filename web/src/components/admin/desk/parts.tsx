/**
 * Server-safe building blocks for desk pages: panels, chips, grades, avatars,
 * view switches, command rails and the filter card. No hooks here, so any
 * server page can use them directly.
 */
import Link from "next/link";
import type { DeskIcon } from "@/lib/admin/nav";
import { Icon } from "./Icon";

export function Panel({
  title,
  kicker,
  sub,
  actions,
  children,
  id,
  className = "",
  flush = false,
}: {
  title?: React.ReactNode;
  kicker?: string;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
  className?: string;
  flush?: boolean;
}) {
  return (
    <section id={id} className={`dk-panel${flush ? " dk-panel--flush" : ""} ${className}`}>
      {title || actions ? (
        <div className="dk-panel__head">
          <div>
            {kicker ? <p className="dk-kicker">{kicker}</p> : null}
            {title ? <h2>{title}</h2> : null}
            {sub ? <p className="dk-panel__sub">{sub}</p> : null}
          </div>
          {actions ? <div className="dk-panel__actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export type ChipTone = "" | "brand" | "value" | "good" | "warn" | "bad" | "ink";

export function Chip({ tone = "", children, title }: { tone?: ChipTone; children: React.ReactNode; title?: string }) {
  return (
    <span className={`dk-chip${tone ? ` dk-chip--${tone}` : ""}`} title={title}>
      {children}
    </span>
  );
}

export type Grade = "A" | "B" | "C" | "D";

export function gradeOf(score: number): Grade {
  return score >= 80 ? "A" : score >= 62 ? "B" : score >= 42 ? "C" : "D";
}

/** "B · 72" — the score chip on every lead and contact card. */
export function GradeChip({ score, title }: { score: number; title?: string }) {
  const g = gradeOf(score);
  return (
    <span className={`dk-grade dk-grade--${g}`} title={title ?? `Priority score ${score} of 100`}>
      {g} · {Math.round(score)}
    </span>
  );
}

export function initials(name: string, email = "") {
  const words = (name || email.split("@")[0] || "?").replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/);
  return ((words[0]?.[0] || "?") + (words.length > 1 ? words[words.length - 1][0] : words[0]?.[1] || "")).toUpperCase();
}

export function Avatar({ name, email, tone }: { name: string; email?: string; tone?: "warm" | "cool" }) {
  return (
    <span className={`dk-avatar${tone ? ` dk-avatar--${tone}` : ""}`} aria-hidden="true">
      {initials(name, email)}
    </span>
  );
}

/** Segmented links: board / cards / spreadsheet, or any set of tabs. */
export function ViewSwitch({
  items,
  label = "View",
}: {
  items: Array<{ key: string; label: string; href: string; on: boolean; icon?: DeskIcon; count?: number }>;
  label?: string;
}) {
  return (
    <nav className="dk-seg" aria-label={label}>
      {items.map((i) => (
        <Link prefetch={false} key={i.key} href={i.href} className={i.on ? "is-on" : undefined} aria-current={i.on ? "page" : undefined} scroll={false}>
          {i.icon ? <Icon name={i.icon} size={15} /> : null}
          {i.label}
          {i.count !== undefined ? <b>{i.count}</b> : null}
        </Link>
      ))}
    </nav>
  );
}

/** Numbered vertical tabs with an optional quick-create list under them. */
export function CommandRail({
  title,
  sub,
  tabs,
  quick,
}: {
  title: string;
  sub: string;
  tabs: Array<{ key: string; label: string; href: string; on: boolean; count?: number }>;
  quick?: { title: string; items: Array<{ label: string; href: string; mark: React.ReactNode; note?: string }> };
}) {
  return (
    <aside className="dk-railcard">
      <p className="dk-kicker">Operations</p>
      <b className="dk-railcard__title">{title}</b>
      <small>{sub}</small>
      <nav className="dk-railcard__tabs">
        {tabs.map((t, i) => (
          <Link prefetch={false} key={t.key} href={t.href} className={t.on ? "is-on" : undefined} aria-current={t.on ? "page" : undefined} scroll={false}>
            <span className="dk-railcard__n">{String(i + 1).padStart(2, "0")}</span>
            {t.label}
            {t.count ? <b>{t.count}</b> : null}
          </Link>
        ))}
      </nav>
      {quick ? (
        <>
          <p className="dk-kicker dk-railcard__qt">{quick.title}</p>
          <ul className="dk-railcard__quick">
            {quick.items.map((q) => (
              <li key={q.label}>
                <Link prefetch={false} href={q.href} scroll={false}>
                  <span className="dk-railcard__mark">{q.mark}</span>
                  <span>{q.label}</span>
                  {q.note ? <small>{q.note}</small> : null}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </aside>
  );
}

/** Numbered steps for a 1-2-3 workflow, links or plain. */
export function Steps({ steps }: { steps: Array<{ label: string; state: "done" | "on" | "todo"; href?: string }> }) {
  const done = steps.filter((s) => s.state === "done").length;
  const on = steps.findIndex((s) => s.state === "on");
  const pct = ((done + (on >= 0 ? 0.5 : 0)) / steps.length) * 100;
  return (
    <div className="dk-steps">
      <ol>
        {steps.map((s, i) => {
          const body = (
            <>
              <span className="dk-steps__n">{s.state === "done" ? "✓" : i + 1}</span>
              {s.label}
            </>
          );
          return (
            <li key={s.label} className={`is-${s.state}`}>
              {s.href ? <Link prefetch={false} href={s.href}>{body}</Link> : <span>{body}</span>}
            </li>
          );
        })}
      </ol>
      <span className="dk-steps__bar" style={{ width: `${pct}%` }} aria-hidden="true" />
    </div>
  );
}

export function Empty({ title, children, action }: { title?: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="dk-emptybox">
      {title ? <b>{title}</b> : null}
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}

export function FilterCard({
  title = "Filters & search",
  children,
  actions,
}: {
  title?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <form className="dk-filters" method="get">
      <div className="dk-filters__head">
        <b>{title}</b>
        {actions}
      </div>
      <div className="dk-filters__grid">{children}</div>
    </form>
  );
}

export function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`dk-field${wide ? " dk-field--wide" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

/** A tile that states a cohort and how many of it can be reached. */
export function CohortTile({ kicker, title, sub, href, on }: { kicker: string; title: string; sub: string; href?: string; on?: boolean }) {
  const body = (
    <>
      <span className="dk-kicker">{kicker}</span>
      <b>{title}</b>
      <small>{sub}</small>
    </>
  );
  return href ? (
    <Link prefetch={false} href={href} className={`dk-cohort${on ? " is-on" : ""}`} scroll={false}>
      {body}
    </Link>
  ) : (
    <div className="dk-cohort">{body}</div>
  );
}

export function money(amount: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount)}`;
  }
}

/** "3h ago", "2d ago" from a millisecond age. */
export function ago(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const h = ms / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(ms / 60_000))}m ago`;
  if (h < 48) return `${Math.round(h)}h ago`;
  const d = Math.round(h / 24);
  return d < 60 ? `${d}d ago` : `${Math.round(d / 30)}mo ago`;
}

/** A coloured tile for command-rail quick items (the rail paints text white). */
export function MarkTile({ children, bg = "var(--dk-teal-deep)" }: { children: React.ReactNode; bg?: string }) {
  return (
    <span className="dk-railcard__mark" style={{ background: bg }}>
      {children}
    </span>
  );
}
