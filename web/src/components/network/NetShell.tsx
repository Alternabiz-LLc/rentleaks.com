import { Fraunces } from "next/font/google";
import "@/app/network.css";

const display = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });

export type Step = { label: string; state: "done" | "on" | "todo" };

/**
 * The broker-network frame: tenant search room, partner portal and the
 * signing page. Its own quiet chrome — these pages are reached from private
 * links in emails, so there is no site navigation to wander off into.
 */
export function NetShell({
  kicker,
  title,
  sub,
  steps,
  flash,
  aside,
  children,
}: {
  kicker: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  steps?: Step[];
  flash?: { ok?: string; err?: string };
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={`nw ${display.variable}`}>
      <header className="nw-top">
        <div className="nw-wrap nw-top__in">
          <a className="nw-brand" href="https://rentleaks.com/hire-a-broker/">
            <span>RL</span> RentLeaks <em>broker network</em>
          </a>
          <span className="nw-top__safe">Private link · don&rsquo;t share it</span>
        </div>
      </header>
      <main className="nw-wrap nw-main">
        <section className="nw-hero">
          <p className="nw-kicker">{kicker}</p>
          <h1>{title}</h1>
          {sub ? <p className="nw-sub">{sub}</p> : null}
          {steps ? (
            <ol className="nw-steps" aria-label="Progress">
              {steps.map((s, i) => (
                <li key={s.label} className={`is-${s.state}`} aria-current={s.state === "on" ? "step" : undefined}>
                  <b>{s.state === "done" ? "✓" : i + 1}</b>
                  <span>{s.label}</span>
                </li>
              ))}
            </ol>
          ) : null}
        </section>
        {flash?.ok ? (
          <p className="nw-flash nw-flash--ok" role="status">
            {flash.ok}
          </p>
        ) : null}
        {flash?.err ? (
          <p className="nw-flash nw-flash--err" role="alert">
            {flash.err}
          </p>
        ) : null}
        <div className={aside ? "nw-grid" : undefined}>
          <div className="nw-stack">{children}</div>
          {aside ? <aside className="nw-stack nw-aside">{aside}</aside> : null}
        </div>
      </main>
      <footer className="nw-wrap nw-foot">
        <p>
          RentLeaks never collects rent, deposits or broker fees. Never wire money before you&rsquo;ve seen a home and have a lease to sign. Equal housing opportunity — fair-housing law applies to
          every search.
        </p>
      </footer>
    </div>
  );
}

export function Card({ title, kicker, children, tone, id, actions }: { title?: React.ReactNode; kicker?: string; children: React.ReactNode; tone?: "brand" | "warn" | "good"; id?: string; actions?: React.ReactNode }) {
  return (
    <section id={id} className={`nw-card${tone ? ` nw-card--${tone}` : ""}`}>
      {title || kicker ? (
        <header className="nw-card__head">
          <div>
            {kicker ? <p className="nw-kicker">{kicker}</p> : null}
            {title ? <h2>{title}</h2> : null}
          </div>
          {actions}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function Facts({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="nw-facts">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Pill({ tone = "", children }: { tone?: "" | "good" | "warn" | "bad" | "brand" | "value"; children: React.ReactNode }) {
  return <span className={`nw-pill${tone ? ` nw-pill--${tone}` : ""}`}>{children}</span>;
}

export function flashOf(sp: Record<string, string | string[] | undefined>) {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
  return { ok: one(sp.ok)?.slice(0, 300), err: one(sp.err)?.slice(0, 300) };
}

export const since = (d: Date, now: number) => {
  const m = Math.max(0, Math.round((now - d.getTime()) / 60_000));
  if (m < 60) return `${m || 1} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
};

export const until = (d: Date, now: number) => {
  const m = Math.round((d.getTime() - now) / 60_000);
  if (m <= 0) return "expired";
  if (m < 60) return `${m} min left`;
  return `${Math.round(m / 60)} h left`;
};
