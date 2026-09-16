/**
 * Small server-rendered building blocks for the admin pages.
 */
import Link from "next/link";

export function PageHead({
  title,
  sub,
  flash,
  children,
}: {
  title: string;
  sub?: React.ReactNode;
  flash?: { ok?: string; err?: string };
  children?: React.ReactNode;
}) {
  return (
    <header className="adm-head">
      <div>
        <h1>{title}</h1>
        {sub ? <p>{sub}</p> : null}
      </div>
      {children ? <div className="adm-head__actions">{children}</div> : null}
      {flash?.ok ? <p className="adm-flash adm-flash--ok" role="status">{flash.ok}</p> : null}
      {flash?.err ? <p className="adm-flash adm-flash--err" role="alert">{flash.err}</p> : null}
    </header>
  );
}

export function Stats({ items }: { items: Array<{ k: string; v: React.ReactNode; s?: React.ReactNode }> }) {
  return (
    <div className="s-summary">
      {items.map((i) => (
        <div key={i.k}>
          <span className="s-summary__k">{i.k}</span>
          <b>{i.v}</b>
          {i.s ? <small>{i.s}</small> : null}
        </div>
      ))}
    </div>
  );
}

export function Section({ title, sub, children, id }: { title: string; sub?: React.ReactNode; children: React.ReactNode; id?: string }) {
  return (
    <section className="c-section adm-section" id={id}>
      <div className="c-section__head">
        <h2 className="c-section__title">{title}</h2>
        {sub ? <p className="c-section__sub">{sub}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="v-note adm-empty">{children}</p>;
}

/** Horizontal bars; values are plain numbers, labels are shown as given. */
export function Bars({ rows, unit = "" }: { rows: Array<{ label: string; value: number; hint?: string }>; unit?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <Empty>No data yet.</Empty>;
  return (
    <ul className="adm-bars">
      {rows.map((r) => (
        <li key={r.label}>
          <span className="adm-bars__label">{r.label}</span>
          <span className="adm-bars__track" aria-hidden="true">
            <span className="adm-bars__fill" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="adm-bars__value">
            {unit}
            {r.value.toLocaleString("en-US")}
            {r.hint ? <small> {r.hint}</small> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Pager({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav className="adm-pager" aria-label="Pages">
      {page > 1 ? <Link href={href(page - 1)}>← Previous</Link> : <span />}
      <span>
        Page {page} of {pages}
      </span>
      {page < pages ? <Link href={href(page + 1)}>Next →</Link> : <span />}
    </nav>
  );
}

export function Pill({ tone = "", children }: { tone?: "" | "good" | "warn" | "bad" | "brand"; children: React.ReactNode }) {
  return <span className={`adm-pill${tone ? ` adm-pill--${tone}` : ""}`}>{children}</span>;
}

export function when(d: Date | null | undefined, withTime = true) {
  if (!d) return "—";
  const iso = d.toISOString();
  return withTime ? `${iso.slice(0, 10)} ${iso.slice(11, 16)}` : iso.slice(0, 10);
}

/** Builds a query string from the current params with overrides; empty values are dropped. */
export function qs(base: Record<string, string | undefined>, over: Record<string, string | number | undefined> = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...over })) {
    if (v !== undefined && v !== "" && v !== null) p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export type SP = Promise<Record<string, string | string[] | undefined>>;

export async function readParams(sp: SP) {
  const raw = await sp;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) out[k] = Array.isArray(v) ? v[0] ?? "" : v ?? "";
  return out;
}

export function flashOf(p: Record<string, string>) {
  return { ok: p.ok || undefined, err: p.err || undefined };
}

export const CAMPAIGN_TONE: Record<string, "" | "good" | "warn" | "bad" | "brand"> = {
  draft: "",
  scheduled: "brand",
  sending: "warn",
  sent: "good",
  cancelled: "bad",
};
