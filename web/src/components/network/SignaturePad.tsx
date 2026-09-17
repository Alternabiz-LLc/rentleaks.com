"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Draw a signature with a finger, pen or mouse. The drawing is optional — the
 * typed name is the signature — and goes into a hidden input as a small PNG.
 */
export function SignaturePad({ name = "drawn" }: { name?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState("");
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const rect = c.getBoundingClientRect();
    c.width = Math.round(rect.width * ratio);
    c.height = Math.round(rect.height * ratio);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = getComputedStyle(c).color || "#1c5b69";
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    const c = canvas.current;
    if (!c) return;
    // Downscale for storage: signatures don't need retina pixels.
    const out = document.createElement("canvas");
    out.width = 480;
    out.height = Math.round((c.height / c.width) * 480);
    out.getContext("2d")?.drawImage(c, 0, 0, out.width, out.height);
    setData(out.toDataURL("image/png"));
  };
  const clear = () => {
    const c = canvas.current;
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    setData("");
  };

  return (
    <div className="nw-pad" style={{ color: "var(--nw-brand-2)" }}>
      <canvas ref={canvas} aria-label="Draw your signature (optional)" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} />
      {data ? null : <span className="nw-pad__hint">Optional: draw your signature here</span>}
      {data ? (
        <button type="button" className="nw-btn nw-btn--ghost nw-pad__clear" onClick={clear}>
          Clear
        </button>
      ) : null}
      <input type="hidden" name={name} value={data} />
    </div>
  );
}

/** Mirrors the typed name in a signature font as the person types. */
export function TypedSignature({ expected }: { expected: string }) {
  const [v, setV] = useState("");
  const ok = v.trim().length > 1;
  return (
    <label>
      Type your full name to sign — {expected}
      <input name="typedName" className="nw-typed" autoComplete="name" required value={v} onChange={(e) => setV(e.target.value)} placeholder={expected} aria-describedby="typed-hint" />
      <span id="typed-hint" className="nw-muted" style={{ fontWeight: 400 }}>
        {ok ? "This is your electronic signature." : "It must match the name above."}
      </span>
    </label>
  );
}

export function PrintButton({ label = "Print or save as PDF" }: { label?: string }) {
  return (
    <button type="button" className="nw-btn nw-btn--ghost nw-noprint" onClick={() => window.print()}>
      {label}
    </button>
  );
}
