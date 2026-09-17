"use client";

/**
 * Money figures for the books: a monthly income/expense chart with the net
 * drawn on the same dollar axis (one scale, zero line visible), a hover
 * readout per month, and a table view for anyone who prefers numbers.
 * Animates once when scrolled into view; holds still for reduced motion.
 */

import { useEffect, useRef, useState } from "react";

type Row = { month: string; label: string; income: number; expenses: number; net: number };

function reduced() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const usd = (cents: number) => {
  const v = Math.round(cents / 100);
  return `${v < 0 ? "−" : ""}$${Math.abs(v).toLocaleString("en-US")}`;
};

const short = (cents: number) => {
  const v = Math.abs(cents / 100);
  const s = v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(v >= 10_000 ? 0 : 1)}k` : `${Math.round(v)}`;
  return `${cents < 0 ? "−" : ""}$${s}`;
};

function niceMax(v: number) {
  if (v <= 0) return 100;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

export function CashChart({ rows, height = 240 }: { rows: Row[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced() || typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (!rows.length) return <p className="dk-empty">Nothing to chart yet.</p>;
  const hi = niceMax(Math.max(0, ...rows.flatMap((r) => [r.income, r.expenses, r.net])));
  const lo = Math.min(0, ...rows.map((r) => r.net));
  const loNice = lo < 0 ? -niceMax(-lo) : 0;
  const W = 720;
  const H = height;
  const pad = { l: 48, r: 10, t: 12, b: 26 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const y = (v: number) => pad.t + ((hi - v) / (hi - loNice)) * ih;
  const band = iw / rows.length;
  const bw = Math.max(3, Math.min(18, band * 0.28));
  const gap = 2;
  const cx = (i: number) => pad.l + band * i + band / 2;
  const ticks = [hi, hi / 2, 0, ...(loNice < 0 ? [loNice] : [])];
  const netPath = rows.map((r, i) => `${i ? "L" : "M"}${cx(i).toFixed(1)},${y(r.net).toFixed(1)}`).join(" ");
  const h = hover === null ? null : rows[hover];
  const every = rows.length > 12 ? Math.ceil(rows.length / 12) : 1;

  return (
    <div className="dk-cash" ref={ref}>
      <div className="dk-cash__top">
        <ul className="dk-cash__legend" aria-label="Legend">
          <li>
            <i className="is-in" /> Income
          </li>
          <li>
            <i className="is-out" /> Expenses
          </li>
          <li>
            <i className="is-net" /> Net
          </li>
        </ul>
        <button type="button" className="dk-btn dk-btn--ghost dk-btn--sm" onClick={() => setTable((t) => !t)} aria-pressed={table}>
          {table ? "Chart" : "Table"}
        </button>
      </div>
      {table ? (
        <div className="dk-tablewrap">
          <table className="dk-table">
            <thead>
              <tr>
                <th>Month</th>
                <th className="dk-right">Income</th>
                <th className="dk-right">Expenses</th>
                <th className="dk-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month}>
                  <td>{r.label}</td>
                  <td className="dk-right">{usd(r.income)}</td>
                  <td className="dk-right">{usd(r.expenses)}</td>
                  <td className="dk-right">
                    <b>{usd(r.net)}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="dk-cash__plot">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Income, expenses and net by month" onMouseLeave={() => setHover(null)}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className={t === 0 ? "dk-cash__zero" : "dk-cash__grid"} />
                <text x={pad.l - 8} y={y(t) + 4} className="dk-cash__tick" textAnchor="end">
                  {short(t)}
                </text>
              </g>
            ))}
            {rows.map((r, i) => {
              const hIn = seen ? y(0) - y(r.income) : 0;
              const hOut = seen ? y(0) - y(r.expenses) : 0;
              const x0 = cx(i) - bw - gap / 2;
              return (
                <g key={r.month} className={hover !== null && hover !== i ? "is-dim" : undefined}>
                  <rect className="dk-cash__in" x={x0} width={bw} y={y(0) - hIn} height={Math.max(0, hIn)} rx={Math.min(4, bw / 2)} style={{ transitionDelay: `${i * 35}ms` }} />
                  <rect className="dk-cash__out" x={cx(i) + gap / 2} width={bw} y={y(0) - hOut} height={Math.max(0, hOut)} rx={Math.min(4, bw / 2)} style={{ transitionDelay: `${i * 35 + 60}ms` }} />
                  {i % every === 0 ? (
                    <text x={cx(i)} y={H - 8} className="dk-cash__tick" textAnchor="middle">
                      {r.label}
                    </text>
                  ) : null}
                </g>
              );
            })}
            <path d={netPath} className={`dk-cash__net${seen ? " is-drawn" : ""}`} pathLength={1} />
            {rows.map((r, i) => (
              <circle key={`n-${r.month}`} cx={cx(i)} cy={y(r.net)} r={hover === i ? 5 : 3.5} className={`dk-cash__dot${seen ? " is-on" : ""}`} />
            ))}
            {hover !== null ? <line x1={cx(hover)} x2={cx(hover)} y1={pad.t} y2={H - pad.b} className="dk-cash__cross" /> : null}
            {rows.map((r, i) => (
              <rect
                key={`hit-${r.month}`}
                x={pad.l + band * i}
                y={pad.t}
                width={band}
                height={ih}
                fill="transparent"
                tabIndex={0}
                aria-label={`${r.label}: income ${usd(r.income)}, expenses ${usd(r.expenses)}, net ${usd(r.net)}`}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
              />
            ))}
          </svg>
          {h && hover !== null ? (
            <div className="dk-cash__tip" style={{ left: `${(cx(hover) / W) * 100}%` }} role="status">
              <b>{h.label}</b>
              <span>
                <i className="is-in" /> Income <em>{usd(h.income)}</em>
              </span>
              <span>
                <i className="is-out" /> Expenses <em>{usd(h.expenses)}</em>
              </span>
              <span className="is-total">
                Net <em>{usd(h.net)}</em>
              </span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
