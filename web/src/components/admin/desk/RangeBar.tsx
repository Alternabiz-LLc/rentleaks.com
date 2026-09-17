import Link from "next/link";
import type { Range } from "@/lib/books/core";

const PRESETS: Array<{ key: string; label: string }> = [
  { key: "mtd", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "qtd", label: "Quarter" },
  { key: "ytd", label: "Year" },
  { key: "12m", label: "12 months" },
  { key: "last_year", label: "Last year" },
];

/**
 * Period picker: presets as one segmented row, plus a custom from/to that
 * submits as a plain GET so the page stays a server page. `keep` carries the
 * other query params (tab, filters) across.
 */
export function RangeBar({ path, range, keep, compare }: { path: string; range: Range; keep: Record<string, string | undefined>; compare?: string }) {
  const href = (key: string) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...keep, range: key })) if (v && k !== "from" && k !== "to" && k !== "ok" && k !== "err") q.set(k, v);
    return `${path}?${q.toString()}`;
  };
  return (
    <div className="dk-range">
      <nav className="dk-seg" aria-label="Period">
        {PRESETS.map((p) => (
          <Link key={p.key} prefetch={false} scroll={false} href={href(p.key)} className={range.key === p.key ? "is-on" : undefined} aria-current={range.key === p.key ? "true" : undefined}>
            {p.label}
          </Link>
        ))}
      </nav>
      <form className="dk-range__custom" action={path} method="get">
        {Object.entries(keep).map(([k, v]) => (v && !["range", "from", "to", "ok", "err"].includes(k) ? <input key={k} type="hidden" name={k} value={v} /> : null))}
        <input type="hidden" name="range" value="custom" />
        <label>
          <span className="dk-sr">From</span>
          <input type="date" name="from" defaultValue={range.from} aria-label="From" />
        </label>
        <span aria-hidden="true">→</span>
        <label>
          <span className="dk-sr">To</span>
          <input type="date" name="to" defaultValue={range.to} aria-label="To" />
        </label>
        <button className="dk-btn dk-btn--sm">Apply</button>
      </form>
      <small className="dk-range__label">
        {range.label}
        {compare ? ` · vs ${compare}` : ""}
      </small>
    </div>
  );
}
