"use client";

/**
 * Desk figures: KPI tiles that count up and filter the page, and hand-drawn
 * SVG charts (no chart library) that animate once when scrolled into view and
 * hold still for anyone who asked their OS for less motion.
 *
 * Everything takes plain data so server pages can pass it straight through;
 * formatting is chosen by name because functions cannot cross that boundary.
 */

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";

export type Fmt = "int" | "usd" | "pct" | "hours" | "raw";

export const SERIES = ["#1c5b69", "#3795a6", "#7cc6d3", "#c4892a", "#2e6e58", "#c45c26", "#6b7f85"];

function reducedMotion() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useInView<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion() || typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, seen };
}

export function formatValue(n: number, fmt: Fmt = "int") {
  if (!Number.isFinite(n)) return "—";
  switch (fmt) {
    case "usd":
      return `$${Math.round(n).toLocaleString("en-US")}`;
    case "pct":
      return `${n >= 10 || n === 0 ? Math.round(n) : n.toFixed(1)}%`;
    case "hours":
      return n < 1 ? "<1h" : n < 48 ? `${Math.round(n)}h` : `${Math.round(n / 24)}d`;
    case "raw":
      return String(n);
    default:
      return Math.round(n).toLocaleString("en-US");
  }
}

export function CountUp({ value, fmt = "int" }: { value: number; fmt?: Fmt }) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);
  useEffect(() => {
    if (reducedMotion() || !Number.isFinite(value) || fmt === "hours") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no animation requested
      setShown(value);
      return;
    }
    const start = performance.now();
    const base = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 750);
      const eased = 1 - (1 - p) ** 3;
      setShown(base + (value - base) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, fmt]);
  return <span className="dk-num">{formatValue(shown, fmt)}</span>;
}

/**
 * A KPI tile. With `href` it is the filter for that slice of the page — the
 * tile for "New" opens the new leads — and `active` marks the slice on screen.
 */
export function Kpi({
  label,
  value,
  sub,
  href,
  active,
  fmt = "int",
  tone,
  spark,
}: {
  label: string;
  value: number | string;
  sub?: React.ReactNode;
  href?: string;
  active?: boolean;
  fmt?: Fmt;
  tone?: "brand" | "value" | "alert" | "good";
  spark?: number[];
}) {
  const body = (
    <>
      <span className="dk-kpi__label">{label}</span>
      <span className="dk-kpi__value">{typeof value === "number" ? <CountUp value={value} fmt={fmt} /> : value}</span>
      {sub ? <span className="dk-kpi__sub">{sub}</span> : null}
      {spark && spark.length > 1 ? <Sparkline values={spark} /> : null}
    </>
  );
  const cls = `dk-kpi${active ? " is-on" : ""}${tone ? ` dk-kpi--${tone}` : ""}`;
  return href ? (
    <Link prefetch={false} href={href} className={cls} aria-current={active ? "true" : undefined} scroll={false}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - (v / max) * 26}`).join(" ");
  return (
    <svg className="dk-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Area chart with a scrubber: hover or focus a day to read both series.
 * `a` is the primary series (filled), `b` a dashed comparison.
 */
export function TrendArea({
  points,
  aLabel,
  bLabel,
  height = 180,
}: {
  points: Array<{ label: string; a: number; b?: number }>;
  aLabel: string;
  bLabel?: string;
  height?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const { ref, seen } = useInView<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  if (!points.length) return <p className="dk-empty">Nothing to chart yet.</p>;
  const W = 100;
  const H = 50;
  const pad = 3;
  const max = Math.max(1, ...points.map((p) => Math.max(p.a, p.b ?? 0)));
  const x = (i: number) => pad + (i / Math.max(1, points.length - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  // Smooth the line with a monotone-ish cubic so a quiet week does not look jagged.
  const path = (vals: number[]) =>
    vals
      .map((v, i) => {
        if (i === 0) return `M ${x(0)} ${y(v)}`;
        const cx = (x(i - 1) + x(i)) / 2;
        return `C ${cx} ${y(vals[i - 1])} ${cx} ${y(v)} ${x(i)} ${y(v)}`;
      })
      .join(" ");
  const aPath = path(points.map((p) => p.a));
  const area = `${aPath} L ${x(points.length - 1)} ${H - pad} L ${x(0)} ${H - pad} Z`;
  const hasB = points.some((p) => p.b !== undefined);
  const bPath = hasB ? path(points.map((p) => p.b ?? 0)) : "";
  const hp = hover !== null ? points[hover] : null;
  const totalA = points.reduce((n, p) => n + p.a, 0);
  const peak = points.reduce((best, p) => (p.a > best.a ? p : best), points[0]);

  return (
    <div ref={ref} className="dk-trend">
      <div className="dk-trend__plot" style={{ height }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${aLabel}: ${totalA} in total, peak ${peak.a} on ${peak.label}`}>
          <defs>
            <linearGradient id={`g${uid}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#3795a6" stopOpacity="0.42" />
              <stop offset="100%" stopColor="#7cc6d3" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={pad} x2={W - pad} y1={pad + f * (H - pad * 2)} y2={pad + f * (H - pad * 2)} className="dk-trend__grid" />
          ))}
          {seen ? (
            <>
              <path d={area} fill={`url(#g${uid})`} className="dk-fade" />
              <path d={aPath} fill="none" stroke="#1c5b69" strokeWidth="2" vectorEffect="non-scaling-stroke" className="dk-fade" />
              {hasB ? <path d={bPath} fill="none" stroke="#c4892a" strokeWidth="1.5" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" className="dk-fade" /> : null}
            </>
          ) : null}
          {hp && hover !== null ? (
            <line x1={x(hover)} x2={x(hover)} y1={pad} y2={H - pad} className="dk-trend__cursor" vectorEffect="non-scaling-stroke" />
          ) : null}
        </svg>
        {hp && hover !== null ? (
          <>
            <span className="dk-trend__dot" style={{ left: `${x(hover)}%`, top: `${(y(hp.a) / H) * 100}%` }} />
            <div className="dk-trend__tip" style={{ left: `${Math.min(82, Math.max(18, x(hover)))}%` }}>
              <b>{hp.label}</b>
              <span>
                {hp.a.toLocaleString("en-US")} {aLabel}
              </span>
              {hasB && bLabel ? (
                <span className="dk-trend__tip-b">
                  {(hp.b ?? 0).toLocaleString("en-US")} {bLabel}
                </span>
              ) : null}
            </div>
          </>
        ) : null}
        <div className="dk-trend__hits">
          {points.map((p, i) => (
            <button
              key={`${p.label}-${i}`}
              type="button"
              aria-label={`${p.label}: ${p.a} ${aLabel}${hasB ? `, ${p.b ?? 0} ${bLabel}` : ""}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            />
          ))}
        </div>
      </div>
      <div className="dk-trend__axis">
        <span>{points[0].label}</span>
        <span className="dk-legend">
          <i className="dk-legend__a" /> {aLabel}
          {hasB && bLabel ? (
            <>
              <i className="dk-legend__b" /> {bLabel}
            </>
          ) : null}
        </span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  );
}

/** Multi-segment donut with a clickable legend. */
export function Donut({
  items,
  centerLabel = "TOTAL",
  size = 150,
}: {
  items: Array<{ label: string; value: number; href?: string }>;
  centerLabel?: string;
  size?: number;
}) {
  const { ref, seen } = useInView<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const total = items.reduce((n, i) => n + i.value, 0);
  const r = 58;
  const c = 2 * Math.PI * r;
  const focus = hover !== null ? items[hover] : null;
  if (!total) return <p className="dk-empty">Nothing to chart yet.</p>;
  const segs = items.map((it, i) => {
    const len = (it.value / total) * c;
    const start = items.slice(0, i).reduce((n, x) => n + (x.value / total) * c, 0);
    return { it, i, len, start };
  });
  return (
    <div ref={ref} className="dk-donut">
      <svg width={size} height={size} viewBox="0 0 150 150" role="img" aria-label={items.map((i) => `${i.label} ${i.value}`).join(", ")}>
        <circle cx="75" cy="75" r={r} fill="none" stroke="var(--dk-track)" strokeWidth="16" />
        {segs.map(({ it, i, len, start }) => (
            <circle
              key={it.label}
              cx="75"
              cy="75"
              r={r}
              fill="none"
              stroke={SERIES[i % SERIES.length]}
              strokeWidth={hover === i ? 20 : 16}
              strokeDasharray={`${seen ? Math.max(0, len - 1.5) : 0} ${c}`}
              strokeDashoffset={-start}
              transform="rotate(-90 75 75)"
              className="dk-donut__seg"
              opacity={hover === null || hover === i ? 1 : 0.35}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
        ))}
        <text x="75" y="74" textAnchor="middle" className="dk-donut__big">
          {focus ? `${Math.round((focus.value / total) * 100)}%` : total.toLocaleString("en-US")}
        </text>
        <text x="75" y="92" textAnchor="middle" className="dk-donut__small">
          {focus ? focus.label.slice(0, 16).toUpperCase() : centerLabel}
        </text>
      </svg>
      <ul className="dk-donut__legend">
        {items.map((it, i) => {
          const inner = (
            <>
              <i style={{ background: SERIES[i % SERIES.length] }} />
              <span>{it.label}</span>
              <b>{it.value.toLocaleString("en-US")}</b>
            </>
          );
          return (
            <li key={it.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {it.href ? <Link prefetch={false} href={it.href}>{inner}</Link> : <span className="dk-donut__row">{inner}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** A single-value ring, e.g. conversion rate. */
export function Gauge({ pct, label, sub }: { pct: number; label: string; sub?: string }) {
  const { ref, seen } = useInView<HTMLDivElement>();
  const uid = useId().replace(/:/g, "");
  const r = 52;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  return (
    <div ref={ref} className="dk-gauge">
      <svg width="132" height="132" viewBox="0 0 132 132" role="img" aria-label={`${label}: ${v.toFixed(1)}%`}>
        <defs>
          <linearGradient id={`r${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1c5b69" />
            <stop offset="100%" stopColor="#7cc6d3" />
          </linearGradient>
        </defs>
        <circle cx="66" cy="66" r={r} fill="none" stroke="var(--dk-track)" strokeWidth="12" />
        <circle
          cx="66"
          cy="66"
          r={r}
          fill="none"
          stroke={`url(#r${uid})`}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={seen ? c - (v / 100) * c : c}
          transform="rotate(-90 66 66)"
          className="dk-gauge__ring"
        />
        <text x="66" y="72" textAnchor="middle" className="dk-donut__big">
          {formatValue(v, "pct")}
        </text>
      </svg>
      <b>{label}</b>
      {sub ? <small>{sub}</small> : null}
    </div>
  );
}

/** Horizontal ranked bars; with `href` each bar is a filter. */
export function RankedBars({
  rows,
  activeKey,
  fmt = "int",
  empty = "Nothing to rank yet.",
}: {
  rows: Array<{ key: string; label: string; value: number; href?: string; hint?: string }>;
  activeKey?: string;
  fmt?: Fmt;
  empty?: string;
}) {
  const { ref, seen } = useInView<HTMLUListElement>();
  if (!rows.length) return <p className="dk-empty">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((n, r) => n + r.value, 0);
  return (
    <ul ref={ref} className="dk-rank">
      {rows.map((r, i) => {
        const inner = (
          <>
            <span className="dk-rank__top">
              <span className="dk-rank__label">{r.label}</span>
              <span className="dk-rank__value">
                {formatValue(r.value, fmt)}
                {fmt === "int" && total ? <small>{Math.round((r.value / total) * 100)}%</small> : null}
                {r.hint ? <small>{r.hint}</small> : null}
              </span>
            </span>
            <span className="dk-rank__track">
              <span
                className="dk-rank__fill"
                style={{
                  width: seen ? `${Math.max(2, (r.value / max) * 100)}%` : "0%",
                  background: `linear-gradient(90deg, ${SERIES[i % SERIES.length]}, #7cc6d3)`,
                  transitionDelay: `${i * 60}ms`,
                }}
              />
            </span>
          </>
        );
        const cls = `dk-rank__row${activeKey && activeKey !== r.key ? " is-dim" : ""}${activeKey === r.key ? " is-on" : ""}`;
        return (
          <li key={r.key}>
            {r.href ? (
              <Link prefetch={false} href={r.href} className={cls} scroll={false}>
                {inner}
              </Link>
            ) : (
              <span className={cls}>{inner}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Funnel lanes with step-to-step conversion in ochre. */
export function FunnelLanes({ stages }: { stages: Array<{ label: string; value: number; href?: string }> }) {
  const { ref, seen } = useInView<HTMLOListElement>();
  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <ol ref={ref} className="dk-funnel">
      {stages.map((s, i) => {
        const prev = i ? stages[i - 1].value : 0;
        const step = i && prev ? (s.value / prev) * 100 : null;
        const inner = (
          <>
            <span className="dk-rank__top">
              <span className="dk-rank__label">
                {s.label}
                {s.href ? <em> Open →</em> : null}
              </span>
              <span className="dk-rank__value">
                {s.value.toLocaleString("en-US")}
                {step !== null ? <small className="dk-funnel__step">{formatValue(step, "pct")}</small> : null}
              </span>
            </span>
            <span className="dk-funnel__track">
              <span
                className="dk-funnel__fill"
                style={{
                  width: seen ? `${Math.max(4, (s.value / max) * 100)}%` : "0%",
                  background: `linear-gradient(90deg, ${SERIES[i % SERIES.length]}, #7cc6d3)`,
                  transitionDelay: `${i * 80}ms`,
                }}
              />
            </span>
          </>
        );
        return <li key={s.label}>{s.href ? <Link prefetch={false} href={s.href} className="dk-rank__row">{inner}</Link> : <span className="dk-rank__row">{inner}</span>}</li>;
      })}
    </ol>
  );
}

/** Vertical columns, e.g. money by month or posts per day. */
export function Columns({ rows, fmt = "int", height = 170 }: { rows: Array<{ label: string; value: number; href?: string }>; fmt?: Fmt; height?: number }) {
  const { ref, seen } = useInView<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  if (!rows.length) return <p className="dk-empty">Nothing to chart yet.</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div ref={ref} className={`dk-cols${rows.length > 16 ? " dk-cols--dense" : ""}`} style={{ height }}>
      {rows.map((r, i) => {
        const inner = (
          <>
            <span className="dk-cols__value">{hover === i || rows.length <= 8 ? formatValue(r.value, fmt) : ""}</span>
            <span className="dk-cols__bar" style={{ height: seen ? `${Math.max(2, (r.value / max) * 100)}%` : "0%", transitionDelay: `${i * 40}ms` }} />
            <span className="dk-cols__label">{r.label}</span>
          </>
        );
        return r.href ? (
          <Link prefetch={false} key={`${r.label}-${i}`} href={r.href} className="dk-cols__col" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            {inner}
          </Link>
        ) : (
          <div key={`${r.label}-${i}`} className="dk-cols__col" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} title={`${r.label}: ${formatValue(r.value, fmt)}`}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
