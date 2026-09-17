import Link from "next/link";
import { moduleByHref } from "@/lib/admin/nav";

export type SignalTone = "live" | "ok" | "warn" | "critical";
export type Signal = { label: string; value: React.ReactNode; tone?: SignalTone; href?: string };

/**
 * The header every desk module shares: an ink surface with slow liquid colour
 * behind the type, the module code and live badge, the title and brief from
 * the nav map, optional signal chips and the page's own actions.
 *
 * The blobs are decoration only — they sit under an opaque-enough surface so
 * contrast never depends on where one has drifted.
 */
export function DeskHeader({
  href,
  title,
  brief,
  signals = [],
  actions,
  flash,
  crumbs,
  compact = false,
}: {
  /** The module this page belongs to (nav href). */
  href: string;
  /** Overrides the module label, e.g. a contact's name. */
  title?: React.ReactNode;
  brief?: React.ReactNode;
  signals?: Signal[];
  actions?: React.ReactNode;
  flash?: { ok?: string; err?: string };
  crumbs?: Array<{ label: string; href?: string }>;
  compact?: boolean;
}) {
  const m = moduleByHref(href);
  return (
    <>
      <header className={`dk-head${compact ? " dk-head--compact" : ""}`}>
        <div className="dk-head__blobs" aria-hidden="true">
          <span className="dk-head__blob dk-head__blob--a" />
          <span className="dk-head__blob dk-head__blob--b" />
          <span className="dk-head__blob dk-head__blob--c" />
        </div>
        <div className="dk-head__body">
          <div className="dk-head__row">
            <div className="dk-head__intro">
              <p className="dk-head__meta">
                <span className="dk-live">
                  <i aria-hidden="true" />
                  {m.live}
                </span>
                <span className="dk-head__code">
                  {m.code} · RentLeaks desk
                </span>
              </p>
              {crumbs?.length ? (
                <nav className="dk-crumbs" aria-label="Breadcrumb">
                  <Link prefetch={false} href={m.href}>{m.label}</Link>
                  {crumbs.map((c) => (
                    <span key={c.label}>
                      <i aria-hidden="true">/</i>
                      {c.href ? <Link prefetch={false} href={c.href}>{c.label}</Link> : c.label}
                    </span>
                  ))}
                </nav>
              ) : null}
              <h1>{title ?? m.label}</h1>
              {compact ? null : <p className="dk-head__brief">{brief ?? m.brief}</p>}
            </div>
            {actions ? <div className="dk-head__actions">{actions}</div> : null}
          </div>
          {signals.length ? (
            <div className="dk-signals">
              {signals.map((s) => {
                const body = (
                  <>
                    <span>{s.label}</span>
                    <b>{s.value}</b>
                  </>
                );
                const cls = `dk-signal dk-signal--${s.tone ?? "ok"}`;
                return s.href ? (
                  <Link prefetch={false} key={s.label} href={s.href} className={cls}>
                    {body}
                  </Link>
                ) : (
                  <div key={s.label} className={cls}>
                    {body}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </header>
      {flash?.ok ? (
        <p className="dk-flash dk-flash--ok" role="status">
          {flash.ok}
        </p>
      ) : null}
      {flash?.err ? (
        <p className="dk-flash dk-flash--err" role="alert">
          {flash.err}
        </p>
      ) : null}
    </>
  );
}
